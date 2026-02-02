package processman

import (
	"bufio"
	"io"
	"os"
	"os/exec"
	"syscall"
	"time"
)

// supervise 守护单个进程的主循环
// 实现 PM2 的 Resurrector 逻辑
func (pm *ProcessManager) supervise(cfg *ProcessConfig) {
	failCount := 0
	baseBackoff := pm.parseBackoff(cfg.Backoff) // 默认 1s

	for {
		// 1. 检查是否收到停止信号
		select {
		case <-pm.ctx.Done():
			if pm.app != nil {
				pm.app.Logger().Info("Supervisor shutting down", "id", cfg.ID)
			}
			return
		default:
		}

		// 检查是否被手动停止
		pm.mu.RLock()
		state := pm.states[cfg.ID]
		if state != nil && state.Status == "stopped" {
			pm.mu.RUnlock()
			return
		}
		pm.mu.RUnlock()

		// 2. 解析解释器（支持 auto）
		interpreter := pm.resolveInterpreter(cfg)

		// 3. 构建命令
		var cmd *exec.Cmd
		if cfg.Script != "" {
			if interpreter != "" {
				cmd = exec.CommandContext(pm.ctx, interpreter, cfg.Script)
				cmd.Args = append(cmd.Args, cfg.Args...)
			} else {
				// 脚本可执行
				cmd = exec.CommandContext(pm.ctx, cfg.Script, cfg.Args...)
			}
		} else {
			cmd = exec.CommandContext(pm.ctx, cfg.Command, cfg.Args...)
		}

		cmd.Dir = cfg.Cwd
		cmd.Env = pm.buildEnv(cfg)

		// 4. 进程组管理 - 映射 FR-003
		// 设置 Setpgid，确保 Kill 时能清理整个进程树
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

		// 5. 日志桥接 - 映射 FR-006
		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()
		go pm.bridgeLog(cfg.ID, "STDOUT", stdout)
		go pm.bridgeLog(cfg.ID, "STDERR", stderr)

		// 6. 更新状态为 starting
		pm.updateState(cfg.ID, "starting", 0, "")

		startTime := time.Now()
		if pm.app != nil {
			pm.app.Logger().Info("Starting process", "id", cfg.ID, "cmd", cmd.String())
		}

		// 7. 启动进程
		if err := cmd.Start(); err != nil {
			if pm.app != nil {
				pm.app.Logger().Error("Failed to start process", "id", cfg.ID, "error", err)
			}
			pm.updateState(cfg.ID, "crashed", 0, err.Error())
			failCount++
		} else {
			// 更新状态为 running
			pm.updateState(cfg.ID, "running", cmd.Process.Pid, "")

			// 8. 阻塞等待进程退出
			err := cmd.Wait()
			uptime := time.Since(startTime)

			if pm.app != nil {
				pm.app.Logger().Warn("Process exited",
					"id", cfg.ID,
					"error", err,
					"uptime", uptime)
			}

			// 9. 判断是否为健康运行
			// User Story 2: Acceptance Scenario 1
			// 运行超过 10 秒视为健康启动，重置退避计数器
			if uptime > 10*time.Second {
				failCount = 0
			} else {
				failCount++
			}

			errMsg := ""
			if err != nil {
				errMsg = err.Error()
			}
			pm.updateState(cfg.ID, "crashed", 0, errMsg)
		}

		// 10. 检查是否达到最大重试次数
		if cfg.MaxRetries >= 0 && failCount > cfg.MaxRetries {
			if pm.app != nil {
				pm.app.Logger().Error("Max retries exceeded, giving up",
					"id", cfg.ID,
					"maxRetries", cfg.MaxRetries)
			}
			pm.updateState(cfg.ID, "stopped", 0, "max retries exceeded")
			return
		}

		// 11. 指数退避
		sleepDuration := pm.calculateBackoff(baseBackoff, failCount)

		if pm.app != nil {
			pm.app.Logger().Info("Restarting process after backoff",
				"id", cfg.ID,
				"backoff", sleepDuration,
				"failCount", failCount)
		}

		select {
		case <-time.After(sleepDuration):
			// 继续重启
		case <-pm.ctx.Done():
			return
		}
	}
}

// killProcess 终止进程组
// 使用负数 PID 发送信号给整个进程组
func (pm *ProcessManager) killProcess(id string) error {
	pm.mu.Lock()
	state := pm.states[id]
	var pid int
	if state != nil {
		pid = state.PID
	}
	pm.mu.Unlock()

	if pid == 0 {
		return nil
	}

	// 先尝试 SIGTERM (优雅终止)
	if err := syscall.Kill(-pid, syscall.SIGTERM); err != nil {
		if pm.app != nil {
			pm.app.Logger().Warn("SIGTERM failed, trying SIGKILL", "id", id, "error", err)
		}
		// 降级到 SIGKILL
		return syscall.Kill(-pid, syscall.SIGKILL)
	}

	return nil
}

// KillAll 终止所有管理的进程
func (pm *ProcessManager) KillAll() {
	pm.mu.RLock()
	ids := make([]string, 0, len(pm.states))
	for id := range pm.states {
		ids = append(ids, id)
	}
	pm.mu.RUnlock()

	for _, id := range ids {
		if err := pm.killProcess(id); err != nil {
			if pm.app != nil {
				pm.app.Logger().Error("Failed to kill process", "id", id, "error", err)
			}
		}
	}
}

// Restart 重启指定进程
func (pm *ProcessManager) Restart(id string) error {
	// 杀掉当前进程，supervise 循环会自动重启
	return pm.killProcess(id)
}

// buildEnv 构建环境变量 - 映射 FR-011
func (pm *ProcessManager) buildEnv(cfg *ProcessConfig) []string {
	env := os.Environ()

	// 注入 PB 内置变量
	env = append(env, "PB_PORT=8090")
	if pm.app != nil {
		env = append(env, "PB_DATA_DIR="+pm.app.DataDir())
	}

	// 注入用户配置的环境变量（支持模板替换）
	for k, v := range cfg.Env {
		// os.ExpandEnv 处理 ${VAR} 和 $VAR 语法
		expanded := os.ExpandEnv(v)
		env = append(env, k+"="+expanded)
	}

	return env
}

// bridgeLog 将进程输出桥接到 PB Logger 和日志缓冲区
// User Story 7: Acceptance Scenario 1, 2
// User Story 3: 实时日志流查看 - 日志存储到缓冲区供 API 访问
func (pm *ProcessManager) bridgeLog(processID, source string, reader io.Reader) {
	if reader == nil {
		return
	}

	scanner := bufio.NewScanner(reader)

	for scanner.Scan() {
		line := scanner.Text()

		// 存储到日志缓冲区（用于 API 访问）
		stream := "stdout"
		if source == "STDERR" {
			stream = "stderr"
		}
		pm.addLog(processID, stream, line)

		if pm.app == nil {
			continue
		}

		// 根据来源选择日志级别
		// Scenario 2: stderr 标记为 Error 级别
		if source == "STDERR" {
			pm.app.Logger().Error(line,
				"process", processID,
				"source", source)
		} else {
			pm.app.Logger().Info(line,
				"process", processID,
				"source", source)
		}
	}

	if err := scanner.Err(); err != nil {
		if pm.app != nil {
			pm.app.Logger().Warn("Log bridge error",
				"process", processID,
				"source", source,
				"error", err)
		}
	}
}
