#!/bin/bash
# PostgreSQL 主节点初始化脚本
# 配置复制用户和权限

set -e

echo "🔧 配置 PostgreSQL 主节点复制..."

# 创建复制用户
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 创建复制用户
    CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_password';
    
    -- 授予复制权限
    GRANT pg_read_all_data TO replicator;
    
    -- 创建复制槽
    SELECT pg_create_physical_replication_slot('replica1_slot', true);
    SELECT pg_create_physical_replication_slot('replica2_slot', true);
    SELECT pg_create_physical_replication_slot('replica3_slot', true);
    SELECT pg_create_physical_replication_slot('replica4_slot', true);
    
    -- 启用 pg_stat_statements
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EOSQL

# 配置 pg_hba.conf 允许复制连接
cat >> "$PGDATA/pg_hba.conf" <<EOF

# 允许复制连接
host    replication     replicator      172.21.0.0/16           scram-sha-256
host    all             pocketbase      172.21.0.0/16           scram-sha-256
EOF

echo "✅ PostgreSQL 主节点配置完成"
