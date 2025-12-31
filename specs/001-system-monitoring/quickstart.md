# Quickstart: System Monitoring

**Feature**: 001-system-monitoring  
**Date**: 2025-12-31

## 概述

本功能为 Pocketbase 新增系统监控能力，采用双数据库隔离架构，提供实时指标查看和历史趋势分析。

## 快速开始

### 1. 启动服务

```bash
cd examples/base
go run main.go serve
```

服务启动后，监控功能自动启用：
- 监控数据库 `pb_data/metrics.db` 自动创建
- 指标采集器每分钟自动采集一次

### 2. 访问监控页面

1. 打开浏览器访问 `http://localhost:8090/_/`
2. 使用管理员账号登录
3. 点击左侧导航栏的 **"监控"** 菜单

### 3. API 访问

```bash
# 获取最近 24 小时监控数据
curl -X GET "http://localhost:8090/api/system/metrics?hours=24" \
  -H "Authorization: Bearer <admin_token>"

# 获取当前系统状态
curl -X GET "http://localhost:8090/api/system/metrics/current" \
  -H "Authorization: Bearer <admin_token>"
```

## 功能特性

### 实时监控指标

| 指标 | 说明 | 单位 |
|------|------|------|
| CPU Usage | 进程 CPU 使用率 | % |
| Memory Alloc | Go 堆内存分配 | MB |
| Goroutines | 活跃协程数量 | 个 |
| WAL Size | SQLite WAL 文件大小 | MB |
| Open Conns | 数据库连接数 | 个 |
| P95 Latency | 请求 P95 延迟 | ms |
| 5xx Errors | 服务端错误计数 | 次/分钟 |

### 历史趋势

支持查看以下时间范围的趋势图：
- 过去 1 小时
- 过去 24 小时
- 过去 7 天

### 数据保留

- 采集间隔：1 分钟
- 保留周期：7 天
- 自动清理：每天凌晨 3:00

## 架构说明

```
┌─────────────────────────────────────────────────────────┐
│                    Pocketbase Process                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ HTTP Server │  │ Collector   │  │ Cleanup Cron    │  │
│  │ (metrics    │  │ (goroutine) │  │ (daily 03:00)   │  │
│  │  middleware)│  │             │  │                 │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                   │           │
│         └────────────────┼───────────────────┘           │
│                          ▼                               │
│                   ┌─────────────┐                        │
│                   │ metrics.db  │ (独立数据库)            │
│                   └─────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## 故障排查

### 监控页面无数据

1. 检查是否以管理员身份登录
2. 等待至少 1 分钟让采集器运行
3. 检查 `pb_data/metrics.db` 文件是否存在

### API 返回 403

确保使用管理员账号的 JWT Token 进行认证。

### 监控数据库损坏

删除 `pb_data/metrics.db` 文件，重启服务会自动重建。业务数据不受影响。

## 配置选项

当前版本使用默认配置，未来版本可能支持：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 采集间隔 | 60s | 指标采集频率 |
| 保留天数 | 7 | 历史数据保留周期 |
| 清理时间 | 03:00 | 每日清理任务执行时间 |
