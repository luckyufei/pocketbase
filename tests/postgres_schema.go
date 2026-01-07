// Package tests 提供 PocketBase 应用测试的通用辅助函数和 mock
package tests

import (
	"github.com/pocketbase/pocketbase/migrations"
)

// PostgresTestSchema 返回用于测试的 PostgreSQL Schema SQL
func PostgresTestSchema() string {
	return migrations.PostgresInitSQL() + `

-- _params 表
` + migrations.PostgresParamsTableSQL() + `

-- _collections 表
` + migrations.PostgresCollectionsTableSQL() + `

-- _mfas 表
CREATE TABLE IF NOT EXISTS "_mfas" (
	"id"            TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
	"collectionRef" TEXT NOT NULL,
	"recordRef"     TEXT NOT NULL,
	"method"        TEXT NOT NULL,
	"created"       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	"updated"       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mfas_collectionRef_recordRef ON "_mfas" ("collectionRef", "recordRef");

-- _otps 表
CREATE TABLE IF NOT EXISTS "_otps" (
	"id"            TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
	"collectionRef" TEXT NOT NULL,
	"recordRef"     TEXT NOT NULL,
	"password"      TEXT NOT NULL,
	"sentTo"        TEXT,
	"created"       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	"updated"       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otps_collectionRef_recordRef ON "_otps" ("collectionRef", "recordRef");

-- _authOrigins 表
CREATE TABLE IF NOT EXISTS "_authOrigins" (
	"id"            TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
	"collectionRef" TEXT NOT NULL,
	"recordRef"     TEXT NOT NULL,
	"fingerprint"   TEXT NOT NULL,
	"created"       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	"updated"       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_authOrigins_unique_pairs ON "_authOrigins" ("collectionRef", "recordRef", "fingerprint");

-- _externalAuths 表
CREATE TABLE IF NOT EXISTS "_externalAuths" (
	"id"            TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
	"collectionRef" TEXT NOT NULL,
	"recordRef"     TEXT NOT NULL,
	"provider"      TEXT NOT NULL,
	"providerId"    TEXT NOT NULL,
	"created"       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	"updated"       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_externalAuths_record_provider ON "_externalAuths" ("collectionRef", "recordRef", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS idx_externalAuths_collection_provider ON "_externalAuths" ("collectionRef", "provider", "providerId");

-- _superusers 表 (auth collection)
CREATE TABLE IF NOT EXISTS "_superusers" (
	"id"              TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
	"email"           CITEXT NOT NULL UNIQUE,
	"tokenKey"        TEXT NOT NULL,
	"password"        TEXT NOT NULL,
	"verified"        BOOLEAN DEFAULT FALSE NOT NULL,
	"emailVisibility" BOOLEAN DEFAULT FALSE NOT NULL,
	"created"         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	"updated"         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- users 表 (auth collection)
CREATE TABLE IF NOT EXISTS "users" (
	"id"              TEXT PRIMARY KEY DEFAULT ('r'||lower(encode(gen_random_bytes(7), 'hex'))) NOT NULL,
	"email"           CITEXT UNIQUE,
	"tokenKey"        TEXT NOT NULL,
	"password"        TEXT NOT NULL,
	"verified"        BOOLEAN DEFAULT FALSE NOT NULL,
	"emailVisibility" BOOLEAN DEFAULT FALSE NOT NULL,
	"name"            TEXT,
	"avatar"          TEXT,
	"created"         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
	"updated"         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 插入系统 collections 元数据
INSERT INTO "_collections" ("id", "system", "type", "name", "fields", "indexes", "options") VALUES
('_pb_mfas', TRUE, 'base', '_mfas', 
 '[{"name":"collectionRef","type":"text","system":true,"required":true},{"name":"recordRef","type":"text","system":true,"required":true},{"name":"method","type":"text","system":true,"required":true}]'::jsonb,
 '["CREATE INDEX idx_mfas_collectionRef_recordRef ON _mfas (collectionRef, recordRef)"]'::jsonb,
 '{}'::jsonb),
('_pb_otps', TRUE, 'base', '_otps',
 '[{"name":"collectionRef","type":"text","system":true,"required":true},{"name":"recordRef","type":"text","system":true,"required":true},{"name":"password","type":"password","system":true,"hidden":true,"required":true},{"name":"sentTo","type":"text","system":true,"hidden":true}]'::jsonb,
 '["CREATE INDEX idx_otps_collectionRef_recordRef ON _otps (collectionRef, recordRef)"]'::jsonb,
 '{}'::jsonb),
('_pb_authOrigins', TRUE, 'base', '_authOrigins',
 '[{"name":"collectionRef","type":"text","system":true,"required":true},{"name":"recordRef","type":"text","system":true,"required":true},{"name":"fingerprint","type":"text","system":true,"required":true}]'::jsonb,
 '["CREATE UNIQUE INDEX idx_authOrigins_unique_pairs ON _authOrigins (collectionRef, recordRef, fingerprint)"]'::jsonb,
 '{}'::jsonb),
('_pb_externalAuths', TRUE, 'base', '_externalAuths',
 '[{"name":"collectionRef","type":"text","system":true,"required":true},{"name":"recordRef","type":"text","system":true,"required":true},{"name":"provider","type":"text","system":true,"required":true},{"name":"providerId","type":"text","system":true,"required":true}]'::jsonb,
 '["CREATE UNIQUE INDEX idx_externalAuths_record_provider ON _externalAuths (collectionRef, recordRef, provider)","CREATE UNIQUE INDEX idx_externalAuths_collection_provider ON _externalAuths (collectionRef, provider, providerId)"]'::jsonb,
 '{}'::jsonb),
('_pb_superusers', TRUE, 'auth', '_superusers',
 '[{"name":"email","type":"email","system":true,"required":true}]'::jsonb,
 '[]'::jsonb,
 '{"authToken":{"duration":86400}}'::jsonb),
('_pb_users', FALSE, 'auth', 'users',
 '[{"name":"name","type":"text","max":255},{"name":"avatar","type":"file","maxSelect":1,"mimeTypes":["image/jpeg","image/png","image/svg+xml","image/gif","image/webp"]}]'::jsonb,
 '[]'::jsonb,
 '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
`
}

// InitPostgresTestSchema 在 PostgreSQL 容器中初始化测试 Schema
func (c *PostgresContainer) InitTestSchema() error {
	return c.ExecSQL(PostgresTestSchema())
}

// InsertTestSuperuser 插入测试超级用户
func (c *PostgresContainer) InsertTestSuperuser(email, password string) error {
	// 注意：实际应用中密码需要使用 bcrypt 加密
	// 这里为了测试简化，使用预计算的 hash
	// 密码 "1234567890" 的 bcrypt hash (cost=10)
	passwordHash := "$2a$10$Tz5WQT6.7DQb9RYjQzKJzOxYqGqLlWvHxTqJYlJvpqMxMqJ8RYj5e"

	sql := `
		INSERT INTO "_superusers" ("id", "email", "tokenKey", "password", "verified")
		VALUES ('test_superuser', $1, 'test_token_key', $2, TRUE)
		ON CONFLICT (id) DO NOTHING
	`
	_, err := c.db.Exec(sql, email, passwordHash)
	return err
}

// InsertTestUser 插入测试用户
func (c *PostgresContainer) InsertTestUser(id, email, name string) error {
	passwordHash := "$2a$10$Tz5WQT6.7DQb9RYjQzKJzOxYqGqLlWvHxTqJYlJvpqMxMqJ8RYj5e"

	sql := `
		INSERT INTO "users" ("id", "email", "tokenKey", "password", "verified", "name")
		VALUES ($1, $2, 'test_token_key', $3, TRUE, $4)
		ON CONFLICT (id) DO NOTHING
	`
	_, err := c.db.Exec(sql, id, email, passwordHash, name)
	return err
}

// InsertTestCollection 插入测试 Collection
func (c *PostgresContainer) InsertTestCollection(id, name, colType string, fields string) error {
	sql := `
		INSERT INTO "_collections" ("id", "name", "type", "fields")
		VALUES ($1, $2, $3, $4::jsonb)
		ON CONFLICT (id) DO NOTHING
	`
	_, err := c.db.Exec(sql, id, name, colType, fields)
	return err
}
