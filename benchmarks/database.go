package benchmarks

import (
	"database/sql"
	"fmt"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

// Database 数据库抽象接口
type Database interface {
	Open() error
	Close() error
	DB() *sql.DB
	Type() DatabaseType
	Setup() error
	Cleanup() error
}

// SQLiteDB SQLite 数据库
type SQLiteDB struct {
	path      string
	db        *sql.DB
	enableWAL bool
}

// NewSQLiteDB 创建 SQLite 数据库实例
func NewSQLiteDB(path string, enableWAL bool) *SQLiteDB {
	return &SQLiteDB{
		path:      path,
		enableWAL: enableWAL,
	}
}

func (s *SQLiteDB) Open() error {
	db, err := sql.Open("sqlite", s.path)
	if err != nil {
		return fmt.Errorf("failed to open SQLite: %w", err)
	}

	// SQLite 配置
	db.SetMaxOpenConns(1) // SQLite 单写
	db.SetMaxIdleConns(1)

	pragmas := []string{
		"PRAGMA busy_timeout = 5000",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA cache_size = -64000", // 64MB
		"PRAGMA temp_store = MEMORY",
	}

	if s.enableWAL {
		pragmas = append(pragmas, "PRAGMA journal_mode = WAL")
	}

	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return fmt.Errorf("failed to execute %s: %w", pragma, err)
		}
	}

	s.db = db
	return nil
}

func (s *SQLiteDB) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *SQLiteDB) DB() *sql.DB {
	return s.db
}

func (s *SQLiteDB) Type() DatabaseType {
	return DBSQLite
}

func (s *SQLiteDB) Setup() error {
	return s.createTables()
}

func (s *SQLiteDB) Cleanup() error {
	tables := []string{"comments", "articles", "files", "users"}
	for _, table := range tables {
		if _, err := s.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table)); err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLiteDB) createTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			name TEXT,
			avatar TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS articles (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			content TEXT,
			author_id TEXT NOT NULL,
			status TEXT DEFAULT 'draft',
			tags TEXT,
			view_count INTEGER DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (author_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS comments (
			id TEXT PRIMARY KEY,
			article_id TEXT NOT NULL,
			author_id TEXT NOT NULL,
			parent_id TEXT,
			content TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (article_id) REFERENCES articles(id),
			FOREIGN KEY (author_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS files (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			path TEXT NOT NULL,
			size INTEGER NOT NULL,
			mime_type TEXT,
			owner_id TEXT NOT NULL,
			created_at TEXT NOT NULL,
			FOREIGN KEY (owner_id) REFERENCES users(id)
		)`,
		// 索引
		`CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id)`,
		`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`,
		`CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id)`,
		`CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id)`,
	}

	for _, schema := range schemas {
		if _, err := s.db.Exec(schema); err != nil {
			return fmt.Errorf("failed to create schema: %w", err)
		}
	}

	return nil
}

// PostgresDB PostgreSQL 数据库
type PostgresDB struct {
	dsn      string
	db       *sql.DB
	poolSize int
}

// NewPostgresDB 创建 PostgreSQL 数据库实例
func NewPostgresDB(dsn string, poolSize int) *PostgresDB {
	return &PostgresDB{
		dsn:      dsn,
		poolSize: poolSize,
	}
}

func (p *PostgresDB) Open() error {
	db, err := sql.Open("postgres", p.dsn)
	if err != nil {
		return fmt.Errorf("failed to open PostgreSQL: %w", err)
	}

	db.SetMaxOpenConns(p.poolSize)
	db.SetMaxIdleConns(p.poolSize / 2)

	if err := db.Ping(); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	p.db = db
	return nil
}

func (p *PostgresDB) Close() error {
	if p.db != nil {
		return p.db.Close()
	}
	return nil
}

func (p *PostgresDB) DB() *sql.DB {
	return p.db
}

func (p *PostgresDB) Type() DatabaseType {
	return DBPostgreSQL
}

func (p *PostgresDB) Setup() error {
	return p.createTables()
}

func (p *PostgresDB) Cleanup() error {
	tables := []string{"comments", "articles", "files", "users"}
	for _, table := range tables {
		if _, err := p.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE", table)); err != nil {
			return err
		}
	}
	return nil
}

func (p *PostgresDB) createTables() error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(36) PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			username VARCHAR(100) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			name VARCHAR(255),
			avatar VARCHAR(500),
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS articles (
			id VARCHAR(36) PRIMARY KEY,
			title VARCHAR(500) NOT NULL,
			content TEXT,
			author_id VARCHAR(36) NOT NULL REFERENCES users(id),
			status VARCHAR(20) DEFAULT 'draft',
			tags TEXT,
			view_count INTEGER DEFAULT 0,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS comments (
			id VARCHAR(36) PRIMARY KEY,
			article_id VARCHAR(36) NOT NULL REFERENCES articles(id),
			author_id VARCHAR(36) NOT NULL REFERENCES users(id),
			parent_id VARCHAR(36),
			content TEXT NOT NULL,
			created_at TIMESTAMP NOT NULL,
			updated_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS files (
			id VARCHAR(36) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			path VARCHAR(500) NOT NULL,
			size BIGINT NOT NULL,
			mime_type VARCHAR(100),
			owner_id VARCHAR(36) NOT NULL REFERENCES users(id),
			created_at TIMESTAMP NOT NULL
		)`,
		// 索引
		`CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id)`,
		`CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)`,
		`CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id)`,
		`CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id)`,
	}

	for _, schema := range schemas {
		if _, err := p.db.Exec(schema); err != nil {
			return fmt.Errorf("failed to create schema: %w", err)
		}
	}

	return nil
}

// NewDatabase 根据配置创建数据库实例
func NewDatabase(cfg *Config) (Database, error) {
	switch cfg.Database {
	case DBSQLite:
		return NewSQLiteDB(cfg.SQLitePath, cfg.EnableWAL), nil
	case DBPostgreSQL:
		return NewPostgresDB(cfg.GetPostgresDSN(), cfg.PoolSize), nil
	default:
		return nil, fmt.Errorf("unsupported database type: %s", cfg.Database)
	}
}
