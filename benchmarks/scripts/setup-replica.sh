#!/bin/bash
# PostgreSQL 从节点设置脚本
# 用于初始化从节点的流复制

set -e

REPLICA_NAME=${1:-replica1}
PRIMARY_HOST=${2:-172.21.0.10}
SLOT_NAME="${REPLICA_NAME}_slot"

echo "🔧 设置从节点 $REPLICA_NAME..."

# 等待主节点就绪
until pg_isready -h $PRIMARY_HOST -p 5432 -U pocketbase; do
    echo "等待主节点就绪..."
    sleep 2
done

# 停止 PostgreSQL
pg_ctl stop -D $PGDATA -m fast || true

# 清空数据目录
rm -rf $PGDATA/*

# 从主节点复制数据
PGPASSWORD=replicator_password pg_basebackup \
    -h $PRIMARY_HOST \
    -p 5432 \
    -U replicator \
    -D $PGDATA \
    -Fp \
    -Xs \
    -P \
    -R \
    -S $SLOT_NAME

# 配置 standby.signal
touch $PGDATA/standby.signal

# 配置 postgresql.auto.conf
cat >> $PGDATA/postgresql.auto.conf <<EOF
primary_conninfo = 'host=$PRIMARY_HOST port=5432 user=replicator password=replicator_password application_name=$REPLICA_NAME'
primary_slot_name = '$SLOT_NAME'
EOF

echo "✅ 从节点 $REPLICA_NAME 设置完成"
