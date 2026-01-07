package benchmarks

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Environment != EnvLocal {
		t.Errorf("expected environment %s, got %s", EnvLocal, cfg.Environment)
	}
	if cfg.Database != DBSQLite {
		t.Errorf("expected database %s, got %s", DBSQLite, cfg.Database)
	}
	if cfg.Scale != ScaleSmall {
		t.Errorf("expected scale %s, got %s", ScaleSmall, cfg.Scale)
	}
	if cfg.Iterations <= 0 {
		t.Error("iterations should be positive")
	}
	if len(cfg.ConcurrencyLevels) == 0 {
		t.Error("concurrency levels should not be empty")
	}
}

func TestConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		modify  func(*Config)
		wantErr bool
	}{
		{
			name:    "valid default config",
			modify:  func(c *Config) {},
			wantErr: false,
		},
		{
			name:    "zero iterations",
			modify:  func(c *Config) { c.Iterations = 0 },
			wantErr: true,
		},
		{
			name:    "negative iterations",
			modify:  func(c *Config) { c.Iterations = -1 },
			wantErr: true,
		},
		{
			name:    "empty concurrency levels",
			modify:  func(c *Config) { c.ConcurrencyLevels = []int{} },
			wantErr: true,
		},
		{
			name:    "sqlite without path",
			modify:  func(c *Config) { c.Database = DBSQLite; c.SQLitePath = "" },
			wantErr: true,
		},
		{
			name:    "postgresql without connection",
			modify:  func(c *Config) { c.Database = DBPostgreSQL; c.PostgresDSN = ""; c.PostgresHost = "" },
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := DefaultConfig()
			tt.modify(cfg)
			err := cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConfigSaveAndLoad(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "test-config.json")

	// 创建并保存配置
	original := DefaultConfig()
	original.Environment = EnvDocker
	original.Database = DBPostgreSQL
	original.Scale = ScaleMedium
	original.Iterations = 5000
	original.Verbose = true

	if err := original.SaveConfig(configPath); err != nil {
		t.Fatalf("SaveConfig() error = %v", err)
	}

	// 验证文件存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		t.Fatal("config file was not created")
	}

	// 加载配置
	loaded, err := LoadConfig(configPath)
	if err != nil {
		t.Fatalf("LoadConfig() error = %v", err)
	}

	// 验证值
	if loaded.Environment != original.Environment {
		t.Errorf("Environment mismatch: got %s, want %s", loaded.Environment, original.Environment)
	}
	if loaded.Database != original.Database {
		t.Errorf("Database mismatch: got %s, want %s", loaded.Database, original.Database)
	}
	if loaded.Scale != original.Scale {
		t.Errorf("Scale mismatch: got %s, want %s", loaded.Scale, original.Scale)
	}
	if loaded.Iterations != original.Iterations {
		t.Errorf("Iterations mismatch: got %d, want %d", loaded.Iterations, original.Iterations)
	}
	if loaded.Verbose != original.Verbose {
		t.Errorf("Verbose mismatch: got %v, want %v", loaded.Verbose, original.Verbose)
	}
}

func TestGetScaleConfig(t *testing.T) {
	tests := []struct {
		scale         Scale
		expectedUsers int
	}{
		{ScaleSmall, 1000},
		{ScaleMedium, 10000},
		{ScaleLarge, 100000},
		{Scale("unknown"), 1000}, // 默认回退到 small
	}

	for _, tt := range tests {
		t.Run(string(tt.scale), func(t *testing.T) {
			cfg := DefaultConfig()
			cfg.Scale = tt.scale
			sc := cfg.GetScaleConfig()
			if sc.Users != tt.expectedUsers {
				t.Errorf("Users = %d, want %d", sc.Users, tt.expectedUsers)
			}
		})
	}
}

func TestGetPostgresDSN(t *testing.T) {
	cfg := DefaultConfig()
	cfg.PostgresHost = "testhost"
	cfg.PostgresPort = 5433
	cfg.PostgresUser = "testuser"
	cfg.PostgresPass = "testpass"
	cfg.PostgresDB = "testdb"

	dsn := cfg.GetPostgresDSN()
	expected := "host=testhost port=5433 user=testuser password=testpass dbname=testdb sslmode=disable"
	if dsn != expected {
		t.Errorf("GetPostgresDSN() = %s, want %s", dsn, expected)
	}

	// 测试直接设置 DSN
	cfg.PostgresDSN = "custom-dsn"
	if cfg.GetPostgresDSN() != "custom-dsn" {
		t.Error("should return custom DSN when set")
	}
}

func TestGetSystemInfo(t *testing.T) {
	info := GetSystemInfo()

	if info.OS == "" {
		t.Error("OS should not be empty")
	}
	if info.Arch == "" {
		t.Error("Arch should not be empty")
	}
	if info.NumCPU <= 0 {
		t.Error("NumCPU should be positive")
	}
	if info.GoVersion == "" {
		t.Error("GoVersion should not be empty")
	}
}
