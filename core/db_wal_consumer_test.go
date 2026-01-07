package core

import (
	"context"
	"testing"
	"time"
)

// ============================================================================
// T-5.1.1: 集成 pglogrepl 库测试
// ============================================================================

// TestWALConsumerConfig 测试 WAL 消费者配置
func TestWALConsumerConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		config := DefaultWALConsumerConfig()

		if config.SlotName == "" {
			t.Error("SlotName 不应为空")
		}
		if config.PublicationName == "" {
			t.Error("PublicationName 不应为空")
		}
		if config.OutputPlugin != "pgoutput" {
			t.Errorf("OutputPlugin 期望 pgoutput, 实际 %s", config.OutputPlugin)
		}
		if config.StandbyTimeout <= 0 {
			t.Error("StandbyTimeout 应该大于 0")
		}
	})

	t.Run("自定义配置", func(t *testing.T) {
		config := &WALConsumerConfig{
			SlotName:        "custom_slot",
			PublicationName: "custom_pub",
			OutputPlugin:    "pgoutput",
			StandbyTimeout:  30 * time.Second,
		}

		if config.SlotName != "custom_slot" {
			t.Errorf("SlotName 期望 custom_slot, 实际 %s", config.SlotName)
		}
	})
}

// TestWALConsumer 测试 WAL 消费者
func TestWALConsumer(t *testing.T) {
	t.Run("创建消费者", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		if consumer == nil {
			t.Fatal("消费者不应为 nil")
		}
		if consumer.config == nil {
			t.Error("配置不应为 nil")
		}
	})

	t.Run("消费者状态", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		if consumer.IsRunning() {
			t.Error("初始状态不应该是运行中")
		}
	})
}

// TestWALConsumerSlotManagement 测试复制槽管理
func TestWALConsumerSlotManagement(t *testing.T) {
	t.Run("生成创建复制槽 SQL", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		sql := consumer.CreateSlotSQL()
		if sql == "" {
			t.Error("创建复制槽 SQL 不应为空")
		}

		// 验证 SQL 包含必要的元素
		if !containsAll(sql, "pg_create_logical_replication_slot", config.SlotName, config.OutputPlugin) {
			t.Errorf("创建复制槽 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成删除复制槽 SQL", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		sql := consumer.DropSlotSQL()
		if sql == "" {
			t.Error("删除复制槽 SQL 不应为空")
		}

		if !containsAll(sql, "pg_drop_replication_slot", config.SlotName) {
			t.Errorf("删除复制槽 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成检查复制槽存在 SQL", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		sql := consumer.CheckSlotExistsSQL()
		if sql == "" {
			t.Error("检查复制槽 SQL 不应为空")
		}

		if !containsAll(sql, "pg_replication_slots", config.SlotName) {
			t.Errorf("检查复制槽 SQL 格式不正确: %s", sql)
		}
	})
}

// TestWALConsumerPublicationManagement 测试发布管理
func TestWALConsumerPublicationManagement(t *testing.T) {
	t.Run("生成创建发布 SQL (所有表)", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		sql := consumer.CreatePublicationSQL(nil)
		if sql == "" {
			t.Error("创建发布 SQL 不应为空")
		}

		if !containsAll(sql, "CREATE PUBLICATION", config.PublicationName, "FOR ALL TABLES") {
			t.Errorf("创建发布 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成创建发布 SQL (指定表)", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		tables := []string{"users", "posts", "comments"}
		sql := consumer.CreatePublicationSQL(tables)
		if sql == "" {
			t.Error("创建发布 SQL 不应为空")
		}

		if !containsAll(sql, "CREATE PUBLICATION", config.PublicationName, "FOR TABLE", "users", "posts", "comments") {
			t.Errorf("创建发布 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成删除发布 SQL", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		sql := consumer.DropPublicationSQL()
		if sql == "" {
			t.Error("删除发布 SQL 不应为空")
		}

		if !containsAll(sql, "DROP PUBLICATION", "IF EXISTS", config.PublicationName) {
			t.Errorf("删除发布 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成添加表到发布 SQL", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		sql := consumer.AddTableToPublicationSQL("new_table")
		if sql == "" {
			t.Error("添加表到发布 SQL 不应为空")
		}

		if !containsAll(sql, "ALTER PUBLICATION", config.PublicationName, "ADD TABLE", "new_table") {
			t.Errorf("添加表到发布 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成从发布移除表 SQL", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		sql := consumer.RemoveTableFromPublicationSQL("old_table")
		if sql == "" {
			t.Error("从发布移除表 SQL 不应为空")
		}

		if !containsAll(sql, "ALTER PUBLICATION", config.PublicationName, "DROP TABLE", "old_table") {
			t.Errorf("从发布移除表 SQL 格式不正确: %s", sql)
		}
	})
}

// TestWALConsumerReplicationConnectionString 测试复制连接字符串
func TestWALConsumerReplicationConnectionString(t *testing.T) {
	t.Run("生成复制连接字符串", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		baseDSN := "postgres://user:pass@localhost:5432/mydb"
		replDSN := consumer.BuildReplicationDSN(baseDSN)

		if replDSN == "" {
			t.Error("复制连接字符串不应为空")
		}

		// 应该包含 replication=database 参数
		if !containsAll(replDSN, "replication=database") {
			t.Errorf("复制连接字符串应包含 replication=database: %s", replDSN)
		}
	})

	t.Run("处理已有参数的 DSN", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		baseDSN := "postgres://user:pass@localhost:5432/mydb?sslmode=disable"
		replDSN := consumer.BuildReplicationDSN(baseDSN)

		if !containsAll(replDSN, "replication=database", "sslmode=disable") {
			t.Errorf("复制连接字符串应保留原有参数: %s", replDSN)
		}
	})
}

// TestWALConsumerMessageHandler 测试消息处理器
func TestWALConsumerMessageHandler(t *testing.T) {
	t.Run("注册消息处理器", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		consumer.OnMessage(func(msg *WALChangeMessage) error {
			return nil
		})

		if consumer.messageHandler == nil {
			t.Error("消息处理器不应为 nil")
		}
	})

	t.Run("注册错误处理器", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		consumer.OnError(func(err error) {
			// 错误处理
		})

		if consumer.errorHandler == nil {
			t.Error("错误处理器不应为 nil")
		}
	})
}

// TestWALChangeMessage 测试 WAL 变更消息
func TestWALChangeMessage(t *testing.T) {
	t.Run("INSERT 消息", func(t *testing.T) {
		msg := &WALChangeMessage{
			Type:       WALChangeInsert,
			Schema:     "public",
			Table:      "users",
			LSN:        12345,
			CommitTime: time.Now(),
			NewTuple: map[string]interface{}{
				"id":    "user-1",
				"name":  "Test User",
				"email": "test@example.com",
			},
		}

		if msg.Type != WALChangeInsert {
			t.Error("消息类型应为 INSERT")
		}
		if msg.IsDelete() {
			t.Error("INSERT 消息不应该是 DELETE")
		}
		if !msg.IsInsert() {
			t.Error("INSERT 消息应该返回 true")
		}
	})

	t.Run("UPDATE 消息", func(t *testing.T) {
		msg := &WALChangeMessage{
			Type:   WALChangeUpdate,
			Schema: "public",
			Table:  "users",
			OldTuple: map[string]interface{}{
				"id":   "user-1",
				"name": "Old Name",
			},
			NewTuple: map[string]interface{}{
				"id":   "user-1",
				"name": "New Name",
			},
		}

		if !msg.IsUpdate() {
			t.Error("UPDATE 消息应该返回 true")
		}
		if msg.OldTuple == nil {
			t.Error("UPDATE 消息应包含旧值")
		}
		if msg.NewTuple == nil {
			t.Error("UPDATE 消息应包含新值")
		}
	})

	t.Run("DELETE 消息", func(t *testing.T) {
		msg := &WALChangeMessage{
			Type:   WALChangeDelete,
			Schema: "public",
			Table:  "users",
			OldTuple: map[string]interface{}{
				"id": "user-1",
			},
		}

		if !msg.IsDelete() {
			t.Error("DELETE 消息应该返回 true")
		}
		if msg.OldTuple == nil {
			t.Error("DELETE 消息应包含旧值")
		}
	})
}

// TestWALConsumerLifecycle 测试消费者生命周期
func TestWALConsumerLifecycle(t *testing.T) {
	t.Run("启动和停止 (无连接)", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		// 没有连接时启动应该返回错误
		err := consumer.Start(ctx, "")
		if err == nil {
			t.Error("没有有效 DSN 时启动应该返回错误")
		}
	})

	t.Run("停止未启动的消费者", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		// 停止未启动的消费者不应该 panic
		err := consumer.Stop()
		if err != nil {
			t.Errorf("停止未启动的消费者不应返回错误: %v", err)
		}
	})
}

// TestWALConsumerMetrics 测试消费者指标
func TestWALConsumerMetrics(t *testing.T) {
	t.Run("获取指标", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		metrics := consumer.Metrics()

		if metrics == nil {
			t.Fatal("指标不应为 nil")
		}
		if metrics.MessagesReceived != 0 {
			t.Error("初始消息接收数应为 0")
		}
		if metrics.MessagesProcessed != 0 {
			t.Error("初始消息处理数应为 0")
		}
	})

	t.Run("重置指标", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		// 模拟一些指标
		consumer.metrics.MessagesReceived = 100
		consumer.metrics.MessagesProcessed = 95

		consumer.ResetMetrics()

		metrics := consumer.Metrics()
		if metrics.MessagesReceived != 0 {
			t.Error("重置后消息接收数应为 0")
		}
	})
}

// TestWALConsumerTableFilter 测试表过滤
func TestWALConsumerTableFilter(t *testing.T) {
	t.Run("添加表过滤", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		consumer.AddTableFilter("users")
		consumer.AddTableFilter("posts")

		if !consumer.ShouldProcessTable("users") {
			t.Error("users 表应该被处理")
		}
		if !consumer.ShouldProcessTable("posts") {
			t.Error("posts 表应该被处理")
		}
		if consumer.ShouldProcessTable("comments") {
			t.Error("comments 表不应该被处理")
		}
	})

	t.Run("移除表过滤", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		consumer.AddTableFilter("users")
		consumer.RemoveTableFilter("users")

		// 没有过滤器时，所有表都应该被处理
		if !consumer.ShouldProcessTable("users") {
			t.Error("移除过滤器后所有表都应该被处理")
		}
	})

	t.Run("清空表过滤", func(t *testing.T) {
		config := DefaultWALConsumerConfig()
		consumer := NewWALConsumer(config)

		consumer.AddTableFilter("users")
		consumer.AddTableFilter("posts")
		consumer.ClearTableFilters()

		// 清空后所有表都应该被处理
		if !consumer.ShouldProcessTable("any_table") {
			t.Error("清空过滤器后所有表都应该被处理")
		}
	})
}

// ============================================================================
// 辅助函数
// ============================================================================

// walContainsAll 检查字符串是否包含所有子串
func walContainsAll(s string, subs ...string) bool {
	for _, sub := range subs {
		if !walContains(s, sub) {
			return false
		}
	}
	return true
}

func walContains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && walContainsHelper(s, sub))
}

func walContainsHelper(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
