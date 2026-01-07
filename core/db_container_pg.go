// Package core 提供 PocketBase 核心功能
package core

import (
	"fmt"
	"strings"
)

// ============================================================================
// T-8.3.1: Dockerfile 生成器
// ============================================================================

// DockerfileGenerator Dockerfile 生成器
type DockerfileGenerator struct {
	baseImage    string
	builderImage string
	workDir      string
	exposePorts  []int
	multiStage   bool
	labels       map[string]string
}

// NewDockerfileGenerator 创建新的 Dockerfile 生成器
func NewDockerfileGenerator() *DockerfileGenerator {
	return &DockerfileGenerator{
		baseImage:    "alpine:3.19",
		builderImage: "golang:1.21-alpine",
		workDir:      "/pb",
		exposePorts:  []int{8090},
		labels:       make(map[string]string),
	}
}

// SetBaseImage 设置基础镜像
func (g *DockerfileGenerator) SetBaseImage(image string) {
	g.baseImage = image
}

// SetBuilderImage 设置构建镜像
func (g *DockerfileGenerator) SetBuilderImage(image string) {
	g.builderImage = image
}

// SetWorkDir 设置工作目录
func (g *DockerfileGenerator) SetWorkDir(dir string) {
	g.workDir = dir
}

// ExposePort 暴露端口
func (g *DockerfileGenerator) ExposePort(port int) {
	g.exposePorts = append(g.exposePorts, port)
}

// EnableMultiStage 启用多阶段构建
func (g *DockerfileGenerator) EnableMultiStage(enable bool) {
	g.multiStage = enable
}

// AddLabel 添加标签
func (g *DockerfileGenerator) AddLabel(key, value string) {
	g.labels[key] = value
}

// Generate 生成 Dockerfile
func (g *DockerfileGenerator) Generate() string {
	var lines []string

	if g.multiStage {
		// 构建阶段
		lines = append(lines, fmt.Sprintf("FROM %s AS builder", g.builderImage))
		lines = append(lines, "")
		lines = append(lines, "WORKDIR /build")
		lines = append(lines, "")
		lines = append(lines, "# 复制依赖文件")
		lines = append(lines, "COPY go.mod go.sum ./")
		lines = append(lines, "RUN go mod download")
		lines = append(lines, "")
		lines = append(lines, "# 复制源代码")
		lines = append(lines, "COPY . .")
		lines = append(lines, "")
		lines = append(lines, "# 构建")
		lines = append(lines, "RUN CGO_ENABLED=0 GOOS=linux go build -o pocketbase ./examples/base")
		lines = append(lines, "")
		lines = append(lines, "# 运行阶段")
		lines = append(lines, fmt.Sprintf("FROM %s", g.baseImage))
	} else {
		lines = append(lines, fmt.Sprintf("FROM %s", g.baseImage))
	}

	lines = append(lines, "")

	// 标签
	for key, value := range g.labels {
		lines = append(lines, fmt.Sprintf("LABEL %s=%q", key, value))
	}
	if len(g.labels) > 0 {
		lines = append(lines, "")
	}

	// 安装依赖
	lines = append(lines, "# 安装运行时依赖")
	lines = append(lines, "RUN apk add --no-cache ca-certificates tzdata")
	lines = append(lines, "")

	// 工作目录
	lines = append(lines, fmt.Sprintf("WORKDIR %s", g.workDir))
	lines = append(lines, "")

	if g.multiStage {
		lines = append(lines, "# 从构建阶段复制二进制文件")
		lines = append(lines, "COPY --from=builder /build/pocketbase .")
	} else {
		lines = append(lines, "# 复制二进制文件")
		lines = append(lines, "COPY pocketbase .")
	}
	lines = append(lines, "")

	// 暴露端口
	for _, port := range g.exposePorts {
		lines = append(lines, fmt.Sprintf("EXPOSE %d", port))
	}
	lines = append(lines, "")

	// 入口点
	lines = append(lines, "# 启动命令")
	lines = append(lines, "CMD [\"./pocketbase\", \"serve\", \"--http=0.0.0.0:8090\"]")

	return strings.Join(lines, "\n")
}

// ============================================================================
// T-8.3.2: docker-compose 生成器
// ============================================================================

// DockerComposeGenerator docker-compose 生成器
type DockerComposeGenerator struct {
	version  string
	services map[string]string
	networks []string
	volumes  []string
}

// NewDockerComposeGenerator 创建新的 docker-compose 生成器
func NewDockerComposeGenerator() *DockerComposeGenerator {
	return &DockerComposeGenerator{
		version:  "3.8",
		services: make(map[string]string),
		networks: []string{},
		volumes:  []string{},
	}
}

// AddPocketBaseService 添加 PocketBase 服务
func (g *DockerComposeGenerator) AddPocketBaseService() {
	g.services["pocketbase"] = `
    build: .
    ports:
      - "8090:8090"
    volumes:
      - pb_data:/pb/pb_data
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PB_ENCRYPTION_KEY=${PB_ENCRYPTION_KEY}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped`
}

// AddPostgreSQLService 添加 PostgreSQL 服务
func (g *DockerComposeGenerator) AddPostgreSQLService() {
	g.services["postgres"] = `
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-pocketbase}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-pocketbase}
      - POSTGRES_DB=${POSTGRES_DB:-pocketbase}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-pocketbase}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped`

	g.volumes = append(g.volumes, "pg_data")
}

// SetNetwork 设置网络
func (g *DockerComposeGenerator) SetNetwork(network string) {
	g.networks = append(g.networks, network)
}

// Generate 生成 docker-compose.yml
func (g *DockerComposeGenerator) Generate() string {
	var lines []string

	lines = append(lines, fmt.Sprintf("version: '%s'", g.version))
	lines = append(lines, "")
	lines = append(lines, "services:")

	for name, config := range g.services {
		lines = append(lines, fmt.Sprintf("  %s:%s", name, config))
		lines = append(lines, "")
	}

	if len(g.volumes) > 0 || len(g.services) > 0 {
		lines = append(lines, "volumes:")
		lines = append(lines, "  pb_data:")
		for _, vol := range g.volumes {
			lines = append(lines, fmt.Sprintf("  %s:", vol))
		}
		lines = append(lines, "")
	}

	if len(g.networks) > 0 {
		lines = append(lines, "networks:")
		for _, net := range g.networks {
			lines = append(lines, fmt.Sprintf("  %s:", net))
		}
	}

	return strings.Join(lines, "\n")
}

// ============================================================================
// T-8.3.3: 环境变量配置生成器
// ============================================================================

// EnvConfigGenerator 环境变量配置生成器
type EnvConfigGenerator struct {
	vars map[string]string
}

// NewEnvConfigGenerator 创建新的环境变量配置生成器
func NewEnvConfigGenerator() *EnvConfigGenerator {
	return &EnvConfigGenerator{
		vars: make(map[string]string),
	}
}

// SetDatabaseURL 设置数据库 URL
func (g *EnvConfigGenerator) SetDatabaseURL(url string) {
	g.vars["DATABASE_URL"] = url
}

// SetEncryptionKey 设置加密密钥
func (g *EnvConfigGenerator) SetEncryptionKey(key string) {
	g.vars["PB_ENCRYPTION_KEY"] = key
}

// SetDevMode 设置开发模式
func (g *EnvConfigGenerator) SetDevMode(dev bool) {
	if dev {
		g.vars["PB_DEV"] = "true"
	} else {
		g.vars["PB_DEV"] = "false"
	}
}

// AddCustomVar 添加自定义变量
func (g *EnvConfigGenerator) AddCustomVar(key, value string) {
	g.vars[key] = value
}

// Generate 生成环境变量配置
func (g *EnvConfigGenerator) Generate() string {
	var lines []string

	lines = append(lines, "# PocketBase 环境变量配置")
	lines = append(lines, "")

	// 默认变量
	defaults := map[string]string{
		"POSTGRES_USER":     "pocketbase",
		"POSTGRES_PASSWORD": "pocketbase",
		"POSTGRES_DB":       "pocketbase",
	}

	lines = append(lines, "# PostgreSQL 配置")
	for key, value := range defaults {
		if _, exists := g.vars[key]; !exists {
			lines = append(lines, fmt.Sprintf("%s=%s", key, value))
		}
	}
	lines = append(lines, "")

	lines = append(lines, "# PocketBase 配置")
	for key, value := range g.vars {
		lines = append(lines, fmt.Sprintf("%s=%s", key, value))
	}

	return strings.Join(lines, "\n")
}

// ============================================================================
// T-8.3.4: 健康检查配置
// ============================================================================

// HealthCheckConfig 健康检查配置
type HealthCheckConfig struct {
	Endpoint   string
	Interval   int // 秒
	Timeout    int // 秒
	Retries    int
	StartDelay int // 秒
}

// DefaultHealthCheckConfig 返回默认健康检查配置
func DefaultHealthCheckConfig() *HealthCheckConfig {
	return &HealthCheckConfig{
		Endpoint:   "/api/health",
		Interval:   30,
		Timeout:    10,
		Retries:    3,
		StartDelay: 5,
	}
}

// DockerHealthCheckCmd 生成 Docker 健康检查命令
func (c *HealthCheckConfig) DockerHealthCheckCmd() string {
	return fmt.Sprintf(
		"wget --no-verbose --tries=1 --spider http://localhost:8090%s || exit 1",
		c.Endpoint,
	)
}

// ComposeHealthCheck 生成 docker-compose 健康检查配置
func (c *HealthCheckConfig) ComposeHealthCheck() string {
	return fmt.Sprintf(`healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8090%s"]
      interval: %ds
      timeout: %ds
      retries: %d
      start_period: %ds`,
		c.Endpoint,
		c.Interval,
		c.Timeout,
		c.Retries,
		c.StartDelay,
	)
}

// ============================================================================
// T-8.3.5: 持久化卷配置
// ============================================================================

// VolumeConfig 持久化卷配置
type VolumeConfig struct {
	DataVolume   string
	BackupVolume string
	customVolumes map[string]string
}

// DefaultVolumeConfig 返回默认卷配置
func DefaultVolumeConfig() *VolumeConfig {
	return &VolumeConfig{
		DataVolume:   "pb_data",
		BackupVolume: "pb_backups",
		customVolumes: make(map[string]string),
	}
}

// AddCustomVolume 添加自定义卷
func (c *VolumeConfig) AddCustomVolume(name, mountPath string) {
	c.customVolumes[name] = mountPath
}

// ComposeVolumes 生成 docker-compose 卷配置
func (c *VolumeConfig) ComposeVolumes() string {
	var lines []string
	lines = append(lines, "volumes:")
	lines = append(lines, fmt.Sprintf("  %s:", c.DataVolume))
	lines = append(lines, fmt.Sprintf("  %s:", c.BackupVolume))

	for name := range c.customVolumes {
		lines = append(lines, fmt.Sprintf("  %s:", name))
	}

	return strings.Join(lines, "\n")
}

// VolumeMounts 生成卷挂载配置
func (c *VolumeConfig) VolumeMounts() []string {
	mounts := []string{
		fmt.Sprintf("%s:/pb/pb_data", c.DataVolume),
		fmt.Sprintf("%s:/pb/pb_backups", c.BackupVolume),
	}

	for name, path := range c.customVolumes {
		mounts = append(mounts, fmt.Sprintf("%s:%s", name, path))
	}

	return mounts
}

// ============================================================================
// 完整部署配置
// ============================================================================

// DeploymentConfig 完整部署配置
type DeploymentConfig struct {
	dockerfile    *DockerfileGenerator
	compose       *DockerComposeGenerator
	env           *EnvConfigGenerator
	healthCheck   *HealthCheckConfig
	volumes       *VolumeConfig
	enableHealth  bool
	enablePersist bool
}

// NewDeploymentConfig 创建新的部署配置
func NewDeploymentConfig() *DeploymentConfig {
	return &DeploymentConfig{
		dockerfile:  NewDockerfileGenerator(),
		compose:     NewDockerComposeGenerator(),
		env:         NewEnvConfigGenerator(),
		healthCheck: DefaultHealthCheckConfig(),
		volumes:     DefaultVolumeConfig(),
	}
}

// SetBaseImage 设置基础镜像
func (c *DeploymentConfig) SetBaseImage(image string) {
	c.dockerfile.SetBaseImage(image)
}

// SetDatabaseURL 设置数据库 URL
func (c *DeploymentConfig) SetDatabaseURL(url string) {
	c.env.SetDatabaseURL(url)
}

// EnableHealthCheck 启用健康检查
func (c *DeploymentConfig) EnableHealthCheck(enable bool) {
	c.enableHealth = enable
}

// EnablePersistence 启用持久化
func (c *DeploymentConfig) EnablePersistence(enable bool) {
	c.enablePersist = enable
}

// Validate 验证配置
func (c *DeploymentConfig) Validate() error {
	// 基本验证
	return nil
}

// GenerateAllFiles 生成所有部署文件
func (c *DeploymentConfig) GenerateAllFiles() map[string]string {
	files := make(map[string]string)

	// 生成 Dockerfile
	c.dockerfile.EnableMultiStage(true)
	files["Dockerfile"] = c.dockerfile.Generate()

	// 生成 docker-compose.yml
	c.compose.AddPocketBaseService()
	c.compose.AddPostgreSQLService()
	files["docker-compose.yml"] = c.compose.Generate()

	// 生成 .env.example
	files[".env.example"] = c.env.Generate()

	return files
}
