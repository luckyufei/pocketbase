// Package core 提供 PocketBase 核心功能
package core

import (
	"strings"
	"testing"
)

// ============================================================================
// T-8.3.1: Dockerfile 生成
// ============================================================================

// TestDockerfileGenerator 测试 Dockerfile 生成器
func TestDockerfileGenerator(t *testing.T) {
	t.Run("生成基本 Dockerfile", func(t *testing.T) {
		gen := NewDockerfileGenerator()
		dockerfile := gen.Generate()

		if dockerfile == "" {
			t.Error("Dockerfile 不应为空")
		}
		if !strings.Contains(dockerfile, "FROM") {
			t.Errorf("应该包含 'FROM': %s", dockerfile)
		}
	})

	t.Run("设置基础镜像", func(t *testing.T) {
		gen := NewDockerfileGenerator()
		gen.SetBaseImage("golang:1.21-alpine")

		dockerfile := gen.Generate()
		if !strings.Contains(dockerfile, "golang:1.21-alpine") {
			t.Errorf("应该包含基础镜像: %s", dockerfile)
		}
	})

	t.Run("添加构建阶段", func(t *testing.T) {
		gen := NewDockerfileGenerator()
		gen.EnableMultiStage(true)

		dockerfile := gen.Generate()
		if !strings.Contains(dockerfile, "AS builder") {
			t.Errorf("应该包含构建阶段: %s", dockerfile)
		}
	})

	t.Run("设置工作目录", func(t *testing.T) {
		gen := NewDockerfileGenerator()
		gen.SetWorkDir("/app")

		dockerfile := gen.Generate()
		if !strings.Contains(dockerfile, "WORKDIR /app") {
			t.Errorf("应该包含工作目录: %s", dockerfile)
		}
	})

	t.Run("暴露端口", func(t *testing.T) {
		gen := NewDockerfileGenerator()
		gen.ExposePort(8090)

		dockerfile := gen.Generate()
		if !strings.Contains(dockerfile, "EXPOSE 8090") {
			t.Errorf("应该包含端口暴露: %s", dockerfile)
		}
	})
}

// ============================================================================
// T-8.3.2: docker-compose.yml 生成
// ============================================================================

// TestDockerComposeGenerator 测试 docker-compose 生成器
func TestDockerComposeGenerator(t *testing.T) {
	t.Run("生成基本 docker-compose", func(t *testing.T) {
		gen := NewDockerComposeGenerator()
		compose := gen.Generate()

		if compose == "" {
			t.Error("docker-compose 不应为空")
		}
		if !strings.Contains(compose, "version") || !strings.Contains(compose, "services") {
			t.Errorf("应该包含 version 和 services: %s", compose)
		}
	})

	t.Run("添加 PocketBase 服务", func(t *testing.T) {
		gen := NewDockerComposeGenerator()
		gen.AddPocketBaseService()

		compose := gen.Generate()
		if !strings.Contains(compose, "pocketbase") {
			t.Errorf("应该包含 pocketbase 服务: %s", compose)
		}
	})

	t.Run("添加 PostgreSQL 服务", func(t *testing.T) {
		gen := NewDockerComposeGenerator()
		gen.AddPostgreSQLService()

		compose := gen.Generate()
		if !strings.Contains(compose, "postgres") {
			t.Errorf("应该包含 postgres 服务: %s", compose)
		}
	})

	t.Run("设置网络", func(t *testing.T) {
		gen := NewDockerComposeGenerator()
		gen.SetNetwork("pocketbase-network")

		compose := gen.Generate()
		if !strings.Contains(compose, "networks") {
			t.Errorf("应该包含网络配置: %s", compose)
		}
	})
}

// ============================================================================
// T-8.3.3: 环境变量配置
// ============================================================================

// TestEnvConfigGenerator 测试环境变量配置生成器
func TestEnvConfigGenerator(t *testing.T) {
	t.Run("生成基本环境变量", func(t *testing.T) {
		gen := NewEnvConfigGenerator()
		env := gen.Generate()

		if env == "" {
			t.Error("环境变量不应为空")
		}
	})

	t.Run("设置数据库连接", func(t *testing.T) {
		gen := NewEnvConfigGenerator()
		gen.SetDatabaseURL("postgres://user:pass@localhost:5432/db")

		env := gen.Generate()
		if !strings.Contains(env, "DATABASE_URL") {
			t.Errorf("应该包含 DATABASE_URL: %s", env)
		}
	})

	t.Run("设置加密密钥", func(t *testing.T) {
		gen := NewEnvConfigGenerator()
		gen.SetEncryptionKey("my-secret-key")

		env := gen.Generate()
		if !strings.Contains(env, "PB_ENCRYPTION_KEY") {
			t.Errorf("应该包含 PB_ENCRYPTION_KEY: %s", env)
		}
	})

	t.Run("设置开发模式", func(t *testing.T) {
		gen := NewEnvConfigGenerator()
		gen.SetDevMode(true)

		env := gen.Generate()
		if !strings.Contains(env, "PB_DEV") {
			t.Errorf("应该包含 PB_DEV: %s", env)
		}
	})

	t.Run("添加自定义变量", func(t *testing.T) {
		gen := NewEnvConfigGenerator()
		gen.AddCustomVar("CUSTOM_VAR", "custom_value")

		env := gen.Generate()
		if !strings.Contains(env, "CUSTOM_VAR") {
			t.Errorf("应该包含自定义变量: %s", env)
		}
	})
}

// ============================================================================
// T-8.3.4: 健康检查配置
// ============================================================================

// TestHealthCheckConfig 测试健康检查配置
func TestHealthCheckConfig(t *testing.T) {
	t.Run("默认健康检查配置", func(t *testing.T) {
		config := DefaultHealthCheckConfig()

		if config.Endpoint == "" {
			t.Error("端点不应为空")
		}
		if config.Interval <= 0 {
			t.Error("间隔应大于 0")
		}
		if config.Timeout <= 0 {
			t.Error("超时应大于 0")
		}
		if config.Retries <= 0 {
			t.Error("重试次数应大于 0")
		}
	})

	t.Run("生成 Docker 健康检查命令", func(t *testing.T) {
		config := DefaultHealthCheckConfig()
		cmd := config.DockerHealthCheckCmd()

		if cmd == "" {
			t.Error("命令不应为空")
		}
		if !strings.Contains(cmd, "curl") && !strings.Contains(cmd, "wget") {
			t.Errorf("应该包含 curl 或 wget: %s", cmd)
		}
	})

	t.Run("生成 docker-compose 健康检查配置", func(t *testing.T) {
		config := DefaultHealthCheckConfig()
		yaml := config.ComposeHealthCheck()

		if yaml == "" {
			t.Error("配置不应为空")
		}
		if !strings.Contains(yaml, "healthcheck") {
			t.Errorf("应该包含 healthcheck: %s", yaml)
		}
	})
}

// ============================================================================
// T-8.3.5: 持久化卷配置
// ============================================================================

// TestVolumeConfig 测试持久化卷配置
func TestVolumeConfig(t *testing.T) {
	t.Run("默认卷配置", func(t *testing.T) {
		config := DefaultVolumeConfig()

		if config.DataVolume == "" {
			t.Error("数据卷不应为空")
		}
		if config.BackupVolume == "" {
			t.Error("备份卷不应为空")
		}
	})

	t.Run("生成 docker-compose 卷配置", func(t *testing.T) {
		config := DefaultVolumeConfig()
		yaml := config.ComposeVolumes()

		if yaml == "" {
			t.Error("配置不应为空")
		}
		if !strings.Contains(yaml, "volumes") {
			t.Errorf("应该包含 volumes: %s", yaml)
		}
	})

	t.Run("生成卷挂载配置", func(t *testing.T) {
		config := DefaultVolumeConfig()
		mounts := config.VolumeMounts()

		if len(mounts) == 0 {
			t.Error("挂载配置不应为空")
		}
	})

	t.Run("添加自定义卷", func(t *testing.T) {
		config := DefaultVolumeConfig()
		config.AddCustomVolume("logs", "/app/logs")

		mounts := config.VolumeMounts()
		found := false
		for _, m := range mounts {
			if strings.Contains(m, "logs") {
				found = true
				break
			}
		}
		if !found {
			t.Error("应该包含自定义卷")
		}
	})
}

// ============================================================================
// 完整部署配置测试
// ============================================================================

// TestFullDeploymentConfig 测试完整部署配置
func TestFullDeploymentConfig(t *testing.T) {
	t.Run("生成完整部署配置", func(t *testing.T) {
		config := NewDeploymentConfig()

		// 设置各项配置
		config.SetBaseImage("golang:1.21-alpine")
		config.SetDatabaseURL("postgres://localhost/db")
		config.EnableHealthCheck(true)
		config.EnablePersistence(true)

		// 验证配置
		if err := config.Validate(); err != nil {
			t.Errorf("配置验证失败: %v", err)
		}
	})

	t.Run("生成所有部署文件", func(t *testing.T) {
		config := NewDeploymentConfig()
		files := config.GenerateAllFiles()

		if len(files) == 0 {
			t.Error("应该生成部署文件")
		}

		// 检查必要文件
		expectedFiles := []string{"Dockerfile", "docker-compose.yml", ".env.example"}
		for _, expected := range expectedFiles {
			found := false
			for name := range files {
				if name == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("应该包含文件: %s", expected)
			}
		}
	})
}
