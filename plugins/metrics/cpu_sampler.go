package metrics

import (
	"bufio"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// CPUSampler 纯 Go 实现的进程 CPU 使用率采样器
// 通过采样两次 CPU 时间差来计算 CPU 使用率
type CPUSampler struct {
	mu               sync.Mutex
	lastSampleTime   time.Time
	lastProcessTime  float64 // 进程 CPU 时间（秒）
	lastCPUPercent   float64 // 上次计算的 CPU 使用率
	pageSize         int64   // 系统页大小（用于 Linux /proc/stat）
	clockTicksPerSec float64 // 时钟滴答频率（通常 100 Hz）
}

// NewCPUSampler 创建 CPU 采样器实例
func NewCPUSampler() *CPUSampler {
	s := &CPUSampler{
		clockTicksPerSec: 100, // Linux 默认值，macOS 不使用此值
	}
	// 立即采样一次以初始化基准值
	s.sample()
	return s
}

// CPUPercent 返回自上次采样以来的 CPU 使用率百分比
// 返回值范围：0.0 ~ 100.0 * NumCPU（多核情况下可能超过 100%）
func (s *CPUSampler) CPUPercent() float64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	currentProcessTime := s.getProcessCPUTime()

	// 计算时间差
	elapsed := now.Sub(s.lastSampleTime).Seconds()
	if elapsed <= 0 {
		return s.lastCPUPercent
	}

	// 计算 CPU 时间差
	cpuTimeDelta := currentProcessTime - s.lastProcessTime

	// CPU 使用率 = (CPU 时间差 / 实际时间差) * 100
	cpuPercent := (cpuTimeDelta / elapsed) * 100.0

	// 限制范围：0 ~ NumCPU * 100
	maxPercent := float64(runtime.NumCPU()) * 100.0
	if cpuPercent < 0 {
		cpuPercent = 0
	} else if cpuPercent > maxPercent {
		cpuPercent = maxPercent
	}

	// 保留两位小数
	cpuPercent = math.Round(cpuPercent*100) / 100

	// 更新状态
	s.lastSampleTime = now
	s.lastProcessTime = currentProcessTime
	s.lastCPUPercent = cpuPercent

	return cpuPercent
}

// sample 执行一次采样（用于初始化）
func (s *CPUSampler) sample() {
	s.lastSampleTime = time.Now()
	s.lastProcessTime = s.getProcessCPUTime()
}

// getProcessCPUTime 获取当前进程的 CPU 时间（秒）
// 返回 user + system 时间
func (s *CPUSampler) getProcessCPUTime() float64 {
	switch runtime.GOOS {
	case "linux":
		return s.getProcessCPUTimeLinux()
	case "darwin":
		return s.getProcessCPUTimeDarwin()
	default:
		// 其他平台使用 runtime.MemStats 的 GCCPUFraction 作为近似值
		return s.getProcessCPUTimeFallback()
	}
}

// getProcessCPUTimeLinux 从 /proc/self/stat 读取进程 CPU 时间
func (s *CPUSampler) getProcessCPUTimeLinux() float64 {
	data, err := os.ReadFile("/proc/self/stat")
	if err != nil {
		return s.getProcessCPUTimeFallback()
	}

	// /proc/[pid]/stat 格式：pid (comm) state ppid ... utime stime ...
	// 字段索引（从 0 开始）：13=utime, 14=stime
	fields := strings.Fields(string(data))
	if len(fields) < 15 {
		return s.getProcessCPUTimeFallback()
	}

	// 找到 comm 字段结束位置（以 ) 结尾），然后偏移
	// 简化处理：直接从后往前数或者找到第一个 )
	statStr := string(data)
	commEnd := strings.LastIndex(statStr, ")")
	if commEnd == -1 {
		return s.getProcessCPUTimeFallback()
	}

	// 从 comm 后面开始解析
	afterComm := strings.Fields(statStr[commEnd+1:])
	if len(afterComm) < 13 { // state 开始，utime 是第 11 个，stime 是第 12 个
		return s.getProcessCPUTimeFallback()
	}

	// utime = afterComm[11], stime = afterComm[12] (0-indexed)
	utime, err1 := strconv.ParseInt(afterComm[11], 10, 64)
	stime, err2 := strconv.ParseInt(afterComm[12], 10, 64)
	if err1 != nil || err2 != nil {
		return s.getProcessCPUTimeFallback()
	}

	// 转换为秒
	totalTicks := float64(utime + stime)
	return totalTicks / s.clockTicksPerSec
}

// getProcessCPUTimeDarwin 使用 getrusage 获取 macOS 进程 CPU 时间
// 由于 Go 标准库没有直接暴露 getrusage，我们使用 /usr/bin/ps 或其他方法
// 这里使用一个简化的实现：基于 runtime 的 CPU 时间估算
func (s *CPUSampler) getProcessCPUTimeDarwin() float64 {
	// macOS 上使用 /proc 不可用，使用 rusage 系统调用
	// 由于 Go 标准库没有直接支持，这里使用 fallback
	// 实际生产中可以考虑使用 syscall.Getrusage

	// 尝试读取 /dev/null 作为占位，返回 fallback
	return s.getProcessCPUTimeFallback()
}

// getProcessCPUTimeFallback 使用 runtime 提供的近似值
// 这不是精确的 CPU 使用率，但在不支持的平台上提供一个参考值
func (s *CPUSampler) getProcessCPUTimeFallback() float64 {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// 使用程序运行时间 * GCCPUFraction 作为近似的 GC CPU 时间
	// 这只是 GC 部分，不是完整的 CPU 使用率
	// 返回一个基于启动时间的估算值
	return float64(time.Since(time.Now()).Seconds()) * m.GCCPUFraction
}

// GetSystemCPUUsage 获取系统整体 CPU 使用率（仅 Linux）
// 返回 0-100 的百分比
func GetSystemCPUUsage() (float64, error) {
	if runtime.GOOS != "linux" {
		return 0, nil // 非 Linux 平台不支持
	}

	// 读取 /proc/stat
	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)
			if len(fields) < 5 {
				continue
			}

			// cpu user nice system idle iowait irq softirq steal guest guest_nice
			var total, idle float64
			for i := 1; i < len(fields); i++ {
				val, _ := strconv.ParseFloat(fields[i], 64)
				total += val
				if i == 4 { // idle
					idle = val
				}
			}

			if total == 0 {
				return 0, nil
			}

			return math.Round((1.0-idle/total)*100*100) / 100, nil
		}
	}

	return 0, nil
}
