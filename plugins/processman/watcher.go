package processman

import (
	"os"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
)

// watch 监听文件变化并重启进程
// User Story 4: Acceptance Scenarios
func (pm *ProcessManager) watch(cfg *ProcessConfig) {
	// Scenario 3: devMode 为 false 时不启动监听
	if !cfg.DevMode {
		return
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		if pm.app != nil {
			pm.app.Logger().Error("Failed to create file watcher", "id", cfg.ID, "error", err)
		}
		return
	}
	defer watcher.Close()

	// 添加监听路径（递归添加子目录）
	for _, watchPath := range cfg.WatchPaths {
		absPath := watchPath
		if !filepath.IsAbs(watchPath) {
			absPath = filepath.Join(cfg.Cwd, watchPath)
		}

		// 递归添加目录
		filepath.Walk(absPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() {
				watcher.Add(path)
			}
			return nil
		})
	}

	// Scenario 1, 2: 500ms 防抖
	debounceTimer := time.NewTimer(0)
	debounceTimer.Stop()
	debounceDuration := 500 * time.Millisecond

	for {
		select {
		case <-pm.ctx.Done():
			return

		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			// 只关注写入事件
			if event.Op&fsnotify.Write == fsnotify.Write ||
				event.Op&fsnotify.Create == fsnotify.Create {
				// 重置防抖计时器
				debounceTimer.Reset(debounceDuration)
			}

		case <-debounceTimer.C:
			// 防抖结束，执行重启
			if pm.app != nil {
				pm.app.Logger().Info("File changed, restarting process", "id", cfg.ID)
			}
			pm.Restart(cfg.ID)

		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			if pm.app != nil {
				pm.app.Logger().Warn("File watcher error", "id", cfg.ID, "error", err)
			}
		}
	}
}
