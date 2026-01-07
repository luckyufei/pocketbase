// Package environment 提供测试环境验证工具
package environment

import (
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"testing"
)

// TestSystemRequirements 验证系统是否满足性能测试要求
func TestSystemRequirements(t *testing.T) {
	t.Run("CPU_Count", func(t *testing.T) {
		cpus := runtime.NumCPU()
		if cpus < 4 {
			t.Fatalf("CPU 核心数不足: 当前 %d 核心，建议至少 4 核心", cpus)
		}
		t.Logf("✅ CPU 核心数: %d", cpus)
	})

	t.Run("Go_Version", func(t *testing.T) {
		version := runtime.Version()
		t.Logf("✅ Go 版本: %s", version)
	})

	t.Run("OS_Architecture", func(t *testing.T) {
		t.Logf("✅ 操作系统: %s/%s", runtime.GOOS, runtime.GOARCH)
	})
}

// TestColimaConfiguration 验证 Colima 配置是否满足性能测试要求
func TestColimaConfiguration(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("Colima 测试仅适用于 macOS")
	}

	// 测试 Colima 是否运行
	t.Run("Colima_Running", func(t *testing.T) {
		cmd := exec.Command("colima", "status")
		output, err := cmd.Output()
		if err != nil {
			t.Skipf("Colima 未安装或未运行: %v", err)
		}

		outputStr := string(output)
		if !strings.Contains(outputStr, "colima is running") && !strings.Contains(outputStr, "Running") {
			t.Skipf("Colima 未运行: %s", outputStr)
		}
		t.Log("✅ Colima 正在运行")
	})

	// 测试 CPU 配置
	t.Run("CPU_Configuration", func(t *testing.T) {
		cmd := exec.Command("colima", "list")
		output, err := cmd.Output()
		if err != nil {
			t.Skipf("无法获取 Colima 配置: %v", err)
		}

		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.Contains(line, "default") && strings.Contains(line, "Running") {
				fields := strings.Fields(line)
				if len(fields) >= 4 {
					cpus, err := strconv.Atoi(fields[3])
					if err != nil {
						t.Fatalf("无法解析 CPU 数量: %v", err)
					}

					if cpus < 4 {
						t.Logf("⚠️  CPU 配置较低: 当前 %d 核心，建议至少 8 核心", cpus)
					} else {
						t.Logf("✅ CPU 配置: %d 核心", cpus)
					}
					return
				}
			}
		}
		t.Skip("无法找到 Colima 配置信息")
	})

	// 测试内存配置
	t.Run("Memory_Configuration", func(t *testing.T) {
		cmd := exec.Command("colima", "list")
		output, err := cmd.Output()
		if err != nil {
			t.Skipf("无法获取 Colima 配置: %v", err)
		}

		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.Contains(line, "default") && strings.Contains(line, "Running") {
				fields := strings.Fields(line)
				if len(fields) >= 5 {
					memoryStr := fields[4]
					if strings.HasSuffix(memoryStr, "GiB") {
						memoryGiB, err := strconv.ParseFloat(strings.TrimSuffix(memoryStr, "GiB"), 64)
						if err != nil {
							t.Fatalf("无法解析内存配置: %v", err)
						}

						if memoryGiB < 8 {
							t.Logf("⚠️  内存配置较低: 当前 %.1f GiB，建议至少 16 GiB", memoryGiB)
						} else {
							t.Logf("✅ 内存配置: %.1f GiB", memoryGiB)
						}
						return
					}
				}
			}
		}
		t.Skip("无法找到内存配置信息")
	})
}

// TestDockerConnectivity 验证 Docker 连接性
func TestDockerConnectivity(t *testing.T) {
	t.Run("Docker_Version", func(t *testing.T) {
		cmd := exec.Command("docker", "version", "--format", "{{.Server.Version}}")
		output, err := cmd.Output()
		if err != nil {
			t.Skipf("Docker 未安装或未运行: %v", err)
		}

		version := strings.TrimSpace(string(output))
		if version == "" {
			t.Fatal("无法获取 Docker 版本")
		}
		t.Logf("✅ Docker 连接正常，版本: %s", version)
	})

	t.Run("Docker_Info", func(t *testing.T) {
		cmd := exec.Command("docker", "info", "--format", "{{.NCPU}} CPUs, {{.MemTotal}} Memory")
		output, err := cmd.Output()
		if err != nil {
			t.Skipf("无法获取 Docker 信息: %v", err)
		}
		t.Logf("✅ Docker 资源信息: %s", strings.TrimSpace(string(output)))
	})
}

// TestPostgreSQLConnectivity 验证 PostgreSQL 连接性
func TestPostgreSQLConnectivity(t *testing.T) {
	t.Run("PostgreSQL_Docker", func(t *testing.T) {
		// 检查是否有运行中的 PostgreSQL 容器
		cmd := exec.Command("docker", "ps", "--filter", "ancestor=postgres", "--format", "{{.Names}}")
		output, err := cmd.Output()
		if err != nil {
			t.Skipf("无法检查 PostgreSQL 容器: %v", err)
		}

		containers := strings.TrimSpace(string(output))
		if containers == "" {
			t.Skip("没有运行中的 PostgreSQL 容器")
		}
		t.Logf("✅ PostgreSQL 容器运行中: %s", containers)
	})
}

// TestNetworkPerformance 网络性能测试
func TestNetworkPerformance(t *testing.T) {
	t.Run("Localhost_Latency", func(t *testing.T) {
		cmd := exec.Command("ping", "-c", "3", "localhost")
		output, err := cmd.Output()
		if err != nil {
			t.Fatalf("网络测试失败: %v", err)
		}
		t.Logf("✅ 本地网络测试通过:\n%s", string(output))
	})
}

// EnvironmentReport 环境报告
type EnvironmentReport struct {
	OS           string `json:"os"`
	Arch         string `json:"arch"`
	NumCPU       int    `json:"num_cpu"`
	GoVersion    string `json:"go_version"`
	DockerOK     bool   `json:"docker_ok"`
	ColimaOK     bool   `json:"colima_ok"`
	PostgresOK   bool   `json:"postgres_ok"`
}

// CheckEnvironment 检查环境并返回报告
func CheckEnvironment() EnvironmentReport {
	report := EnvironmentReport{
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		NumCPU:    runtime.NumCPU(),
		GoVersion: runtime.Version(),
	}

	// 检查 Docker
	cmd := exec.Command("docker", "version")
	if err := cmd.Run(); err == nil {
		report.DockerOK = true
	}

	// 检查 Colima (仅 macOS)
	if runtime.GOOS == "darwin" {
		cmd := exec.Command("colima", "status")
		output, err := cmd.Output()
		if err == nil && strings.Contains(string(output), "colima is running") {
			report.ColimaOK = true
		}
	}

	// 检查 PostgreSQL
	cmd = exec.Command("docker", "ps", "--filter", "ancestor=postgres", "-q")
	output, err := cmd.Output()
	if err == nil && strings.TrimSpace(string(output)) != "" {
		report.PostgresOK = true
	}

	return report
}

// PrintEnvironmentReport 打印环境报告
func PrintEnvironmentReport() {
	report := CheckEnvironment()

	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Println("║                    测试环境检查报告                           ║")
	fmt.Println("╠══════════════════════════════════════════════════════════════╣")
	fmt.Printf("║ 操作系统:     %-47s ║\n", fmt.Sprintf("%s/%s", report.OS, report.Arch))
	fmt.Printf("║ CPU 核心数:   %-47d ║\n", report.NumCPU)
	fmt.Printf("║ Go 版本:      %-47s ║\n", report.GoVersion)
	fmt.Printf("║ Docker:       %-47s ║\n", statusIcon(report.DockerOK))
	if report.OS == "darwin" {
		fmt.Printf("║ Colima:       %-47s ║\n", statusIcon(report.ColimaOK))
	}
	fmt.Printf("║ PostgreSQL:   %-47s ║\n", statusIcon(report.PostgresOK))
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()
}

func statusIcon(ok bool) string {
	if ok {
		return "✅ 可用"
	}
	return "❌ 不可用"
}
