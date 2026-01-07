package core

import (
	"context"
	"testing"
	"time"
)

// ============================================================================
// T-5.1.2: 创建 Replication Slot 测试
// T-5.1.3: 建立流式连接测试
// ============================================================================

// TestReplicationConnection 测试复制连接
func TestReplicationConnection(t *testing.T) {
	t.Run("创建复制连接配置", func(t *testing.T) {
		config := &ReplicationConnectionConfig{
			DSN:                "postgres://user:pass@localhost:5432/mydb",
			SlotName:           "test_slot",
			PublicationName:    "test_pub",
			OutputPlugin:       "pgoutput",
			StandbyMessageTimeout: 10 * time.Second,
		}

		if config.DSN == "" {
			t.Error("DSN 不应为空")
		}
		if config.SlotName == "" {
			t.Error("SlotName 不应为空")
		}
	})

	t.Run("默认复制连接配置", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://localhost:5432/mydb")

		if config.SlotName != "pocketbase_realtime" {
			t.Errorf("默认 SlotName 应为 pocketbase_realtime, 实际 %s", config.SlotName)
		}
		if config.OutputPlugin != "pgoutput" {
			t.Errorf("默认 OutputPlugin 应为 pgoutput, 实际 %s", config.OutputPlugin)
		}
	})
}

// TestReplicationSlotOperations 测试复制槽操作
func TestReplicationSlotOperations(t *testing.T) {
	t.Run("生成创建临时复制槽 SQL", func(t *testing.T) {
		ops := NewReplicationSlotOps("test_slot", "pgoutput")

		sql := ops.CreateTemporarySlotSQL()
		if sql == "" {
			t.Error("SQL 不应为空")
		}

		if !containsAll(sql, "pg_create_logical_replication_slot", "test_slot", "pgoutput", "true") {
			t.Errorf("临时复制槽 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成获取复制槽信息 SQL", func(t *testing.T) {
		ops := NewReplicationSlotOps("test_slot", "pgoutput")

		sql := ops.GetSlotInfoSQL()
		if sql == "" {
			t.Error("SQL 不应为空")
		}

		if !containsAll(sql, "pg_replication_slots", "slot_name", "test_slot") {
			t.Errorf("获取复制槽信息 SQL 格式不正确: %s", sql)
		}
	})

	t.Run("生成获取当前 LSN SQL", func(t *testing.T) {
		ops := NewReplicationSlotOps("test_slot", "pgoutput")

		sql := ops.GetCurrentLSNSQL()
		if sql == "" {
			t.Error("SQL 不应为空")
		}

		if !containsAll(sql, "pg_current_wal_lsn") {
			t.Errorf("获取当前 LSN SQL 格式不正确: %s", sql)
		}
	})
}

// TestStreamingConnection 测试流式连接
func TestStreamingConnection(t *testing.T) {
	t.Run("创建流式连接", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://localhost:5432/mydb")
		conn := NewStreamingConnection(config)

		if conn == nil {
			t.Fatal("连接不应为 nil")
		}
		if conn.config == nil {
			t.Error("配置不应为 nil")
		}
	})

	t.Run("流式连接状态", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://localhost:5432/mydb")
		conn := NewStreamingConnection(config)

		if conn.IsConnected() {
			t.Error("初始状态不应该是已连接")
		}
		if conn.IsStreaming() {
			t.Error("初始状态不应该是正在流式传输")
		}
	})

	t.Run("生成开始复制命令", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://localhost:5432/mydb")
		conn := NewStreamingConnection(config)

		cmd := conn.BuildStartReplicationCommand(0)
		if cmd == "" {
			t.Error("命令不应为空")
		}

		if !containsAll(cmd, "START_REPLICATION", "SLOT", config.SlotName, "LOGICAL") {
			t.Errorf("开始复制命令格式不正确: %s", cmd)
		}
	})

	t.Run("生成带 LSN 的开始复制命令", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://localhost:5432/mydb")
		conn := NewStreamingConnection(config)

		// 使用非零 LSN
		lsn := uint64(0x16B374D8) // 示例 LSN
		cmd := conn.BuildStartReplicationCommand(lsn)

		if !containsAll(cmd, "START_REPLICATION", "0/16B374D8") {
			t.Errorf("带 LSN 的开始复制命令格式不正确: %s", cmd)
		}
	})
}

// TestPluginArguments 测试插件参数
func TestPluginArguments(t *testing.T) {
	t.Run("pgoutput 插件参数", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://localhost:5432/mydb")
		conn := NewStreamingConnection(config)

		args := conn.BuildPluginArguments()

		// pgoutput 需要 proto_version 和 publication_names
		if args["proto_version"] == "" {
			t.Error("proto_version 不应为空")
		}
		if args["publication_names"] == "" {
			t.Error("publication_names 不应为空")
		}
	})
}

// TestMessageDecoder 测试消息解码器
func TestMessageDecoder(t *testing.T) {
	t.Run("创建解码器", func(t *testing.T) {
		decoder := NewPGOutputDecoder()
		if decoder == nil {
			t.Fatal("解码器不应为 nil")
		}
	})

	t.Run("解码器关系缓存", func(t *testing.T) {
		decoder := NewPGOutputDecoder()

		// 添加关系信息
		rel := &RelationInfo{
			RelationID: 12345,
			Namespace:  "public",
			RelationName: "users",
			Columns: []ColumnInfo{
				{Name: "id", TypeOID: 25, Flags: 1},
				{Name: "name", TypeOID: 25, Flags: 0},
			},
		}
		decoder.SetRelation(rel)

		// 获取关系信息
		cached := decoder.GetRelation(12345)
		if cached == nil {
			t.Fatal("缓存的关系信息不应为 nil")
		}
		if cached.RelationName != "users" {
			t.Errorf("关系名期望 users, 实际 %s", cached.RelationName)
		}
	})
}

// TestRelationInfo 测试关系信息
func TestRelationInfo(t *testing.T) {
	t.Run("创建关系信息", func(t *testing.T) {
		rel := &RelationInfo{
			RelationID:   12345,
			Namespace:    "public",
			RelationName: "users",
			ReplicaIdentity: 'd', // default
			Columns: []ColumnInfo{
				{Name: "id", TypeOID: 25, Flags: 1},
				{Name: "name", TypeOID: 25, Flags: 0},
				{Name: "email", TypeOID: 25, Flags: 0},
			},
		}

		if rel.RelationID == 0 {
			t.Error("RelationID 不应为 0")
		}
		if len(rel.Columns) != 3 {
			t.Errorf("列数期望 3, 实际 %d", len(rel.Columns))
		}
	})

	t.Run("获取主键列", func(t *testing.T) {
		rel := &RelationInfo{
			RelationID:   12345,
			Namespace:    "public",
			RelationName: "users",
			Columns: []ColumnInfo{
				{Name: "id", TypeOID: 25, Flags: 1},    // 主键
				{Name: "name", TypeOID: 25, Flags: 0},
			},
		}

		pkCols := rel.GetPrimaryKeyColumns()
		if len(pkCols) != 1 {
			t.Errorf("主键列数期望 1, 实际 %d", len(pkCols))
		}
		if len(pkCols) > 0 && pkCols[0] != "id" {
			t.Errorf("主键列名期望 id, 实际 %s", pkCols[0])
		}
	})
}

// TestStandbyStatus 测试备用状态消息
func TestStandbyStatus(t *testing.T) {
	t.Run("创建备用状态", func(t *testing.T) {
		status := NewStandbyStatus(12345, 12340, 12345)

		if status.WalWritePosition == 0 {
			t.Error("WalWritePosition 不应为 0")
		}
		if status.WalFlushPosition == 0 {
			t.Error("WalFlushPosition 不应为 0")
		}
		if status.WalApplyPosition == 0 {
			t.Error("WalApplyPosition 不应为 0")
		}
	})

	t.Run("备用状态时间戳", func(t *testing.T) {
		status := NewStandbyStatus(12345, 12340, 12345)

		if status.ClientTime.IsZero() {
			t.Error("ClientTime 不应为零值")
		}
	})
}

// TestReplicationConnectionLifecycle 测试复制连接生命周期
func TestReplicationConnectionLifecycle(t *testing.T) {
	t.Run("连接超时", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://invalid:5432/mydb")
		conn := NewStreamingConnection(config)

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		// 连接到无效地址应该超时或失败
		err := conn.Connect(ctx)
		if err == nil {
			t.Error("连接到无效地址应该返回错误")
			conn.Close()
		}
	})

	t.Run("关闭未连接的连接", func(t *testing.T) {
		config := DefaultReplicationConnectionConfig("postgres://localhost:5432/mydb")
		conn := NewStreamingConnection(config)

		// 关闭未连接的连接不应该 panic
		err := conn.Close()
		if err != nil {
			t.Errorf("关闭未连接的连接不应返回错误: %v", err)
		}
	})
}

// TestLSNParsing 测试 LSN 解析
func TestLSNParsing(t *testing.T) {
	t.Run("解析 LSN 字符串", func(t *testing.T) {
		testCases := []struct {
			input    string
			expected uint64
		}{
			{"0/0", 0},
			{"0/1", 1},
			{"0/16B374D8", 0x16B374D8},
			{"1/0", 0x100000000},
			{"1/16B374D8", 0x116B374D8},
		}

		for _, tc := range testCases {
			lsn, err := ParseLSN(tc.input)
			if err != nil {
				t.Errorf("解析 LSN %s 失败: %v", tc.input, err)
				continue
			}
			if lsn != tc.expected {
				t.Errorf("LSN %s 期望 %d, 实际 %d", tc.input, tc.expected, lsn)
			}
		}
	})

	t.Run("格式化 LSN", func(t *testing.T) {
		testCases := []struct {
			input    uint64
			expected string
		}{
			{0, "0/0"},
			{1, "0/1"},
			{0x16B374D8, "0/16B374D8"},
			{0x100000000, "1/0"},
			{0x116B374D8, "1/16B374D8"},
		}

		for _, tc := range testCases {
			result := FormatLSN(tc.input)
			if result != tc.expected {
				t.Errorf("格式化 LSN %d 期望 %s, 实际 %s", tc.input, tc.expected, result)
			}
		}
	})

	t.Run("无效 LSN 格式", func(t *testing.T) {
		invalidLSNs := []string{
			"",
			"invalid",
			"0",
			"/0",
			"0/",
			"0/G",
		}

		for _, lsn := range invalidLSNs {
			_, err := ParseLSN(lsn)
			if err == nil {
				t.Errorf("无效 LSN %s 应该返回错误", lsn)
			}
		}
	})
}
