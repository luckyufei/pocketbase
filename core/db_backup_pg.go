// Package core 提供 PocketBase 核心功能
package core

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"
)

// ============================================================================
// T-8.2.1: 备份请求拦截器
// ============================================================================

// PGBackupInterceptor PostgreSQL 备份拦截器
type PGBackupInterceptor struct{}

// NewPGBackupInterceptor 创建新的备份拦截器
func NewPGBackupInterceptor() *PGBackupInterceptor {
	return &PGBackupInterceptor{}
}

// IsBackupRequest 检查是否为备份请求
func (i *PGBackupInterceptor) IsBackupRequest(path string) bool {
	return strings.HasPrefix(path, "/api/backups")
}

// ShouldUsePGDump 检查是否应该使用 pg_dump
func (i *PGBackupInterceptor) ShouldUsePGDump(connStr string) bool {
	return IsPGConnectionString(connStr)
}

// ============================================================================
// T-8.2.2: pg_dump 命令生成
// ============================================================================

// PGDumpFormat pg_dump 输出格式
type PGDumpFormat string

const (
	// PGDumpFormatPlain 纯文本 SQL 格式
	PGDumpFormatPlain PGDumpFormat = "plain"
	// PGDumpFormatCustom 自定义格式 (支持 pg_restore)
	PGDumpFormatCustom PGDumpFormat = "custom"
	// PGDumpFormatDirectory 目录格式
	PGDumpFormatDirectory PGDumpFormat = "directory"
	// PGDumpFormatTar tar 归档格式
	PGDumpFormatTar PGDumpFormat = "tar"
)

// PGDumpConfig pg_dump 配置
type PGDumpConfig struct {
	// Format 输出格式
	Format PGDumpFormat

	// Compression 压缩级别 (0-9)
	Compression int

	// SchemaOnly 只导出 schema
	SchemaOnly bool

	// DataOnly 只导出数据
	DataOnly bool

	// ExcludeTables 排除的表
	ExcludeTables []string

	// IncludeTables 包含的表 (为空表示所有)
	IncludeTables []string

	// NoOwner 不导出所有者信息
	NoOwner bool

	// NoPrivileges 不导出权限信息
	NoPrivileges bool

	// Clean 添加 DROP 语句
	Clean bool

	// IfExists 使用 IF EXISTS
	IfExists bool
}

// DefaultPGDumpConfig 返回默认配置
func DefaultPGDumpConfig() *PGDumpConfig {
	return &PGDumpConfig{
		Format:       PGDumpFormatCustom,
		Compression:  6,
		NoOwner:      true,
		NoPrivileges: true,
	}
}

// PGDumper pg_dump 命令生成器
type PGDumper struct {
	config *PGDumpConfig
}

// NewPGDumper 创建新的 pg_dump 生成器
func NewPGDumper() *PGDumper {
	return &PGDumper{
		config: DefaultPGDumpConfig(),
	}
}

// SetFormat 设置输出格式
func (d *PGDumper) SetFormat(format PGDumpFormat) {
	d.config.Format = format
}

// SetCompression 设置压缩级别
func (d *PGDumper) SetCompression(level int) {
	if level < 0 {
		level = 0
	}
	if level > 9 {
		level = 9
	}
	d.config.Compression = level
}

// SetSchemaOnly 设置只导出 schema
func (d *PGDumper) SetSchemaOnly(schemaOnly bool) {
	d.config.SchemaOnly = schemaOnly
	if schemaOnly {
		d.config.DataOnly = false
	}
}

// SetDataOnly 设置只导出数据
func (d *PGDumper) SetDataOnly(dataOnly bool) {
	d.config.DataOnly = dataOnly
	if dataOnly {
		d.config.SchemaOnly = false
	}
}

// ExcludeTables 排除表
func (d *PGDumper) ExcludeTables(tables ...string) {
	d.config.ExcludeTables = append(d.config.ExcludeTables, tables...)
}

// IncludeTables 包含表
func (d *PGDumper) IncludeTables(tables ...string) {
	d.config.IncludeTables = append(d.config.IncludeTables, tables...)
}

// BuildCommand 生成 pg_dump 命令
func (d *PGDumper) BuildCommand(connStr string) string {
	var args []string
	args = append(args, "pg_dump")

	// 格式
	switch d.config.Format {
	case PGDumpFormatPlain:
		args = append(args, "-Fp")
	case PGDumpFormatCustom:
		args = append(args, "-Fc")
	case PGDumpFormatDirectory:
		args = append(args, "-Fd")
	case PGDumpFormatTar:
		args = append(args, "-Ft")
	}

	// 压缩
	if d.config.Compression > 0 {
		args = append(args, fmt.Sprintf("-Z%d", d.config.Compression))
	}

	// Schema/Data only
	if d.config.SchemaOnly {
		args = append(args, "--schema-only")
	}
	if d.config.DataOnly {
		args = append(args, "--data-only")
	}

	// 排除表
	for _, table := range d.config.ExcludeTables {
		args = append(args, fmt.Sprintf("--exclude-table=%s", table))
	}

	// 包含表
	for _, table := range d.config.IncludeTables {
		args = append(args, fmt.Sprintf("--table=%s", table))
	}

	// 其他选项
	if d.config.NoOwner {
		args = append(args, "--no-owner")
	}
	if d.config.NoPrivileges {
		args = append(args, "--no-privileges")
	}
	if d.config.Clean {
		args = append(args, "--clean")
	}
	if d.config.IfExists {
		args = append(args, "--if-exists")
	}

	// 连接字符串
	args = append(args, fmt.Sprintf("'%s'", connStr))

	return strings.Join(args, " ")
}

// ============================================================================
// T-8.2.3: ZIP 写入器
// ============================================================================

// BackupMetadata 备份元数据
type BackupMetadata struct {
	Version     string   `json:"version"`
	DBType      string   `json:"dbType"`
	CreatedAt   string   `json:"createdAt"`
	Collections []string `json:"collections"`
	FileCount   int      `json:"fileCount"`
	TotalSize   int64    `json:"totalSize"`
}

// PGBackupZipWriter PostgreSQL 备份 ZIP 写入器
type PGBackupZipWriter struct {
	mu    sync.Mutex
	files map[string][]byte
}

// NewPGBackupZipWriter 创建新的 ZIP 写入器
func NewPGBackupZipWriter() *PGBackupZipWriter {
	return &PGBackupZipWriter{
		files: make(map[string][]byte),
	}
}

// AddDatabaseDump 添加数据库转储
func (w *PGBackupZipWriter) AddDatabaseDump(filename string, data []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.files[filename] = data
	return nil
}

// AddMetadata 添加元数据
func (w *PGBackupZipWriter) AddMetadata(metadata *BackupMetadata) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化元数据失败: %w", err)
	}

	w.files["metadata.json"] = data
	return nil
}

// AddFile 添加文件
func (w *PGBackupZipWriter) AddFile(filename string, data []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.files[filename] = data
	return nil
}

// HasFile 检查是否包含文件
func (w *PGBackupZipWriter) HasFile(filename string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()

	_, exists := w.files[filename]
	return exists
}

// ListFiles 列出所有文件
func (w *PGBackupZipWriter) ListFiles() []string {
	w.mu.Lock()
	defer w.mu.Unlock()

	files := make([]string, 0, len(w.files))
	for name := range w.files {
		files = append(files, name)
	}
	return files
}

// GetFile 获取文件内容
func (w *PGBackupZipWriter) GetFile(filename string) ([]byte, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()

	data, exists := w.files[filename]
	return data, exists
}

// ============================================================================
// T-8.2.4: 文件收集器
// ============================================================================

// PGBackupFileCollector PostgreSQL 备份文件收集器
type PGBackupFileCollector struct {
	storagePath     string
	includePatterns []string
	excludePatterns []string
	maxFileSize     int64
}

// NewPGBackupFileCollector 创建新的文件收集器
func NewPGBackupFileCollector(storagePath string) *PGBackupFileCollector {
	return &PGBackupFileCollector{
		storagePath:     storagePath,
		includePatterns: []string{},
		excludePatterns: []string{},
		maxFileSize:     0, // 0 表示不限制
	}
}

// SetIncludePatterns 设置包含模式
func (c *PGBackupFileCollector) SetIncludePatterns(patterns ...string) {
	c.includePatterns = patterns
}

// GetIncludePatterns 获取包含模式
func (c *PGBackupFileCollector) GetIncludePatterns() []string {
	return c.includePatterns
}

// SetExcludePatterns 设置排除模式
func (c *PGBackupFileCollector) SetExcludePatterns(patterns ...string) {
	c.excludePatterns = patterns
}

// GetExcludePatterns 获取排除模式
func (c *PGBackupFileCollector) GetExcludePatterns() []string {
	return c.excludePatterns
}

// SetMaxFileSize 设置最大文件大小
func (c *PGBackupFileCollector) SetMaxFileSize(size int64) {
	c.maxFileSize = size
}

// GetMaxFileSize 获取最大文件大小
func (c *PGBackupFileCollector) GetMaxFileSize() int64 {
	return c.maxFileSize
}

// ============================================================================
// T-8.2.5: 自动备份调度器
// ============================================================================

// BackupRetentionPolicy 备份保留策略
type BackupRetentionPolicy struct {
	// MaxBackups 最大备份数量
	MaxBackups int

	// MaxAgeDays 最大保留天数
	MaxAgeDays int
}

// DefaultBackupRetentionPolicy 返回默认保留策略
func DefaultBackupRetentionPolicy() *BackupRetentionPolicy {
	return &BackupRetentionPolicy{
		MaxBackups: 7,
		MaxAgeDays: 30,
	}
}

// Validate 验证策略
func (p *BackupRetentionPolicy) Validate() error {
	if p.MaxBackups <= 0 && p.MaxAgeDays <= 0 {
		return fmt.Errorf("至少需要设置 MaxBackups 或 MaxAgeDays")
	}
	return nil
}

// PGAutoBackupScheduler PostgreSQL 自动备份调度器
type PGAutoBackupScheduler struct {
	mu              sync.RWMutex
	interval        int
	cronExpression  string
	retentionPolicy *BackupRetentionPolicy
	running         bool
	stopChan        chan struct{}
}

// NewPGAutoBackupScheduler 创建新的自动备份调度器
func NewPGAutoBackupScheduler() *PGAutoBackupScheduler {
	return &PGAutoBackupScheduler{
		retentionPolicy: DefaultBackupRetentionPolicy(),
		stopChan:        make(chan struct{}),
	}
}

// SetInterval 设置备份间隔 (秒)
func (s *PGAutoBackupScheduler) SetInterval(seconds int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.interval = seconds
}

// GetInterval 获取备份间隔
func (s *PGAutoBackupScheduler) GetInterval() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.interval
}

// SetCronExpression 设置 Cron 表达式
func (s *PGAutoBackupScheduler) SetCronExpression(expr string) error {
	// 简单验证 Cron 表达式
	if !isValidCronExpression(expr) {
		return fmt.Errorf("无效的 Cron 表达式: %s", expr)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.cronExpression = expr
	return nil
}

// GetCronExpression 获取 Cron 表达式
func (s *PGAutoBackupScheduler) GetCronExpression() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cronExpression
}

// SetRetentionPolicy 设置保留策略
func (s *PGAutoBackupScheduler) SetRetentionPolicy(policy *BackupRetentionPolicy) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.retentionPolicy = policy
}

// GetRetentionPolicy 获取保留策略
func (s *PGAutoBackupScheduler) GetRetentionPolicy() *BackupRetentionPolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.retentionPolicy
}

// Start 启动调度器
func (s *PGAutoBackupScheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return
	}

	s.running = true
	s.stopChan = make(chan struct{})
}

// Stop 停止调度器
func (s *PGAutoBackupScheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return
	}

	s.running = false
	close(s.stopChan)
}

// IsRunning 检查是否在运行
func (s *PGAutoBackupScheduler) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

// isValidCronExpression 验证 Cron 表达式
func isValidCronExpression(expr string) bool {
	// 简单验证: 5 或 6 个字段
	parts := strings.Fields(expr)
	if len(parts) < 5 || len(parts) > 6 {
		return false
	}

	// 验证每个字段的基本格式
	cronFieldPattern := regexp.MustCompile(`^[\d\*,\-/]+$`)
	for _, part := range parts {
		if !cronFieldPattern.MatchString(part) {
			return false
		}
	}

	return true
}
