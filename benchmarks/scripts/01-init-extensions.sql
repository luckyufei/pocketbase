-- PostgreSQL 初始化脚本
-- 为 PocketBase 性能测试创建必要的扩展和配置

-- 创建 pg_stat_statements 扩展 (性能监控)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 创建 uuid-ossp 扩展 (UUID 生成)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建 pg_trgm 扩展 (全文搜索优化)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 创建 btree_gin 扩展 (复合索引优化)
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 创建 btree_gist 扩展 (范围查询优化)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 创建性能测试用户 (如果需要)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'perf_test_user') THEN
        CREATE ROLE perf_test_user WITH LOGIN PASSWORD 'perf_test_password';
        GRANT CONNECT ON DATABASE pocketbase_test TO perf_test_user;
        GRANT USAGE ON SCHEMA public TO perf_test_user;
        GRANT CREATE ON SCHEMA public TO perf_test_user;
    END IF;
END
$$;

-- 设置一些性能相关的参数
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 记录超过1秒的查询
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = off;
ALTER SYSTEM SET log_disconnections = off;
ALTER SYSTEM SET log_lock_waits = on;

-- 重新加载配置
SELECT pg_reload_conf();

-- 创建一些测试表结构 (基础结构)
CREATE TABLE IF NOT EXISTS performance_test_log (
    id SERIAL PRIMARY KEY,
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    result_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_perf_test_log_test_name ON performance_test_log(test_name);
CREATE INDEX IF NOT EXISTS idx_perf_test_log_test_type ON performance_test_log(test_type);
CREATE INDEX IF NOT EXISTS idx_perf_test_log_start_time ON performance_test_log(start_time);

-- 插入初始化完成标记
INSERT INTO performance_test_log (test_name, test_type, result_data) 
VALUES ('database_initialization', 'setup', '{"status": "completed", "extensions": ["pg_stat_statements", "uuid-ossp", "pg_trgm", "btree_gin", "btree_gist"]}')
ON CONFLICT DO NOTHING;