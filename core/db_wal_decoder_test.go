package core

import (
	"testing"
	"time"
)

// ============================================================================
// T-5.1.4: 解析 WAL 消息测试
// T-5.1.5: 转换为 PocketBase Record 测试
// ============================================================================

// TestWALMessageDecoder 测试 WAL 消息解码器
func TestWALMessageDecoder(t *testing.T) {
	t.Run("创建解码器", func(t *testing.T) {
		decoder := NewWALMessageDecoder()
		if decoder == nil {
			t.Fatal("解码器不应为 nil")
		}
	})

	t.Run("解码 BEGIN 消息", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		// 模拟 BEGIN 消息数据
		// 格式: B + FinalLSN(8) + CommitTime(8) + Xid(4)
		data := []byte{
			'B',                                     // 消息类型
			0, 0, 0, 0, 0, 0, 0x12, 0x34,            // FinalLSN
			0, 0, 0, 0, 0, 0, 0, 0,                  // CommitTime (PostgreSQL epoch)
			0, 0, 0, 1,                              // Xid
		}

		msg, err := decoder.Decode(data)
		if err != nil {
			t.Fatalf("解码 BEGIN 失败: %v", err)
		}

		if msg.Type != WALChangeBegin {
			t.Errorf("消息类型期望 BEGIN, 实际 %s", msg.Type)
		}
	})

	t.Run("解码 COMMIT 消息", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		// 模拟 COMMIT 消息数据
		data := []byte{
			'C',                                     // 消息类型
			0,                                       // Flags
			0, 0, 0, 0, 0, 0, 0x12, 0x34,            // CommitLSN
			0, 0, 0, 0, 0, 0, 0x12, 0x35,            // TransactionEndLSN
			0, 0, 0, 0, 0, 0, 0, 0,                  // CommitTime
		}

		msg, err := decoder.Decode(data)
		if err != nil {
			t.Fatalf("解码 COMMIT 失败: %v", err)
		}

		if msg.Type != WALChangeCommit {
			t.Errorf("消息类型期望 COMMIT, 实际 %s", msg.Type)
		}
	})

	t.Run("解码未知消息类型", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		data := []byte{'X', 0, 0, 0}

		_, err := decoder.Decode(data)
		if err == nil {
			t.Error("解码未知消息类型应该返回错误")
		}
	})

	t.Run("解码空数据", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		_, err := decoder.Decode(nil)
		if err == nil {
			t.Error("解码空数据应该返回错误")
		}

		_, err = decoder.Decode([]byte{})
		if err == nil {
			t.Error("解码空数据应该返回错误")
		}
	})
}

// TestRelationMessageDecoding 测试关系消息解码
func TestRelationMessageDecoding(t *testing.T) {
	t.Run("解码关系消息", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		// 构建关系消息
		// R + RelationID(4) + Namespace(string) + RelationName(string) + ReplicaIdentity(1) + NumColumns(2) + Columns
		data := buildRelationMessage(12345, "public", "users", 'd', []ColumnInfo{
			{Name: "id", TypeOID: 25, Flags: 1},
			{Name: "name", TypeOID: 25, Flags: 0},
		})

		msg, err := decoder.Decode(data)
		if err != nil {
			t.Fatalf("解码关系消息失败: %v", err)
		}

		// 关系消息不产生变更消息，而是缓存关系信息
		if msg != nil {
			t.Error("关系消息不应产生变更消息")
		}

		// 检查关系是否被缓存
		rel := decoder.GetRelation(12345)
		if rel == nil {
			t.Fatal("关系信息应该被缓存")
		}
		if rel.RelationName != "users" {
			t.Errorf("关系名期望 users, 实际 %s", rel.RelationName)
		}
	})
}

// TestInsertMessageDecoding 测试 INSERT 消息解码
func TestInsertMessageDecoding(t *testing.T) {
	t.Run("解码 INSERT 消息", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		// 先添加关系信息
		decoder.SetRelation(&RelationInfo{
			RelationID:   12345,
			Namespace:    "public",
			RelationName: "users",
			Columns: []ColumnInfo{
				{Name: "id", TypeOID: 25, Flags: 1},
				{Name: "name", TypeOID: 25, Flags: 0},
			},
		})

		// 构建 INSERT 消息
		data := buildInsertMessage(12345, map[string]string{
			"id":   "user-1",
			"name": "Test User",
		})

		msg, err := decoder.Decode(data)
		if err != nil {
			t.Fatalf("解码 INSERT 失败: %v", err)
		}

		if msg == nil {
			t.Fatal("INSERT 消息不应为 nil")
		}
		if msg.Type != WALChangeInsert {
			t.Errorf("消息类型期望 INSERT, 实际 %s", msg.Type)
		}
		if msg.Table != "users" {
			t.Errorf("表名期望 users, 实际 %s", msg.Table)
		}
		if msg.NewTuple == nil {
			t.Error("NewTuple 不应为 nil")
		}
	})
}

// TestUpdateMessageDecoding 测试 UPDATE 消息解码
func TestUpdateMessageDecoding(t *testing.T) {
	t.Run("解码 UPDATE 消息 (有旧值)", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		// 先添加关系信息
		decoder.SetRelation(&RelationInfo{
			RelationID:   12345,
			Namespace:    "public",
			RelationName: "users",
			Columns: []ColumnInfo{
				{Name: "id", TypeOID: 25, Flags: 1},
				{Name: "name", TypeOID: 25, Flags: 0},
			},
		})

		// 构建 UPDATE 消息
		data := buildUpdateMessage(12345,
			map[string]string{"id": "user-1", "name": "Old Name"},
			map[string]string{"id": "user-1", "name": "New Name"},
		)

		msg, err := decoder.Decode(data)
		if err != nil {
			t.Fatalf("解码 UPDATE 失败: %v", err)
		}

		if msg == nil {
			t.Fatal("UPDATE 消息不应为 nil")
		}
		if msg.Type != WALChangeUpdate {
			t.Errorf("消息类型期望 UPDATE, 实际 %s", msg.Type)
		}
		if msg.OldTuple == nil {
			t.Error("OldTuple 不应为 nil")
		}
		if msg.NewTuple == nil {
			t.Error("NewTuple 不应为 nil")
		}
	})
}

// TestDeleteMessageDecoding 测试 DELETE 消息解码
func TestDeleteMessageDecoding(t *testing.T) {
	t.Run("解码 DELETE 消息", func(t *testing.T) {
		decoder := NewWALMessageDecoder()

		// 先添加关系信息
		decoder.SetRelation(&RelationInfo{
			RelationID:   12345,
			Namespace:    "public",
			RelationName: "users",
			Columns: []ColumnInfo{
				{Name: "id", TypeOID: 25, Flags: 1},
				{Name: "name", TypeOID: 25, Flags: 0},
			},
		})

		// 构建 DELETE 消息
		data := buildDeleteMessage(12345, map[string]string{
			"id": "user-1",
		})

		msg, err := decoder.Decode(data)
		if err != nil {
			t.Fatalf("解码 DELETE 失败: %v", err)
		}

		if msg == nil {
			t.Fatal("DELETE 消息不应为 nil")
		}
		if msg.Type != WALChangeDelete {
			t.Errorf("消息类型期望 DELETE, 实际 %s", msg.Type)
		}
		if msg.OldTuple == nil {
			t.Error("OldTuple 不应为 nil")
		}
	})
}

// TestRecordConversion 测试记录转换
func TestRecordConversion(t *testing.T) {
	t.Run("WAL 消息转换为 Record 事件", func(t *testing.T) {
		converter := NewWALToRecordConverter()

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

		event, err := converter.Convert(msg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}

		if event == nil {
			t.Fatal("事件不应为 nil")
		}
		if event.Action != RealtimeRecordActionCreate {
			t.Errorf("动作期望 Create, 实际 %v", event.Action)
		}
		if event.Collection != "users" {
			t.Errorf("集合期望 users, 实际 %s", event.Collection)
		}
	})

	t.Run("UPDATE 消息转换", func(t *testing.T) {
		converter := NewWALToRecordConverter()

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

		event, err := converter.Convert(msg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}

		if event.Action != RealtimeRecordActionUpdate {
			t.Errorf("动作期望 Update, 实际 %v", event.Action)
		}
		if event.OldRecord == nil {
			t.Error("OldRecord 不应为 nil")
		}
	})

	t.Run("DELETE 消息转换", func(t *testing.T) {
		converter := NewWALToRecordConverter()

		msg := &WALChangeMessage{
			Type:   WALChangeDelete,
			Schema: "public",
			Table:  "users",
			OldTuple: map[string]interface{}{
				"id": "user-1",
			},
		}

		event, err := converter.Convert(msg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}

		if event.Action != RealtimeRecordActionDelete {
			t.Errorf("动作期望 Delete, 实际 %v", event.Action)
		}
	})

	t.Run("忽略 BEGIN/COMMIT 消息", func(t *testing.T) {
		converter := NewWALToRecordConverter()

		beginMsg := &WALChangeMessage{Type: WALChangeBegin}
		commitMsg := &WALChangeMessage{Type: WALChangeCommit}

		event, err := converter.Convert(beginMsg)
		if err != nil {
			t.Fatalf("转换 BEGIN 失败: %v", err)
		}
		if event != nil {
			t.Error("BEGIN 消息不应产生事件")
		}

		event, err = converter.Convert(commitMsg)
		if err != nil {
			t.Fatalf("转换 COMMIT 失败: %v", err)
		}
		if event != nil {
			t.Error("COMMIT 消息不应产生事件")
		}
	})
}

// TestTableNameMapping 测试表名映射
func TestTableNameMapping(t *testing.T) {
	t.Run("系统表过滤", func(t *testing.T) {
		converter := NewWALToRecordConverter()

		// 系统表应该被过滤
		systemTables := []string{
			"_collections",
			"_params",
			"_migrations",
		}

		for _, table := range systemTables {
			msg := &WALChangeMessage{
				Type:  WALChangeInsert,
				Table: table,
				NewTuple: map[string]interface{}{
					"id": "test",
				},
			}

			event, err := converter.Convert(msg)
			if err != nil {
				t.Fatalf("转换失败: %v", err)
			}
			if event != nil {
				t.Errorf("系统表 %s 不应产生事件", table)
			}
		}
	})

	t.Run("普通表不过滤", func(t *testing.T) {
		converter := NewWALToRecordConverter()

		msg := &WALChangeMessage{
			Type:  WALChangeInsert,
			Table: "users",
			NewTuple: map[string]interface{}{
				"id": "user-1",
			},
		}

		event, err := converter.Convert(msg)
		if err != nil {
			t.Fatalf("转换失败: %v", err)
		}
		if event == nil {
			t.Error("普通表应该产生事件")
		}
	})
}

// TestValueTypeConversion 测试值类型转换
func TestValueTypeConversion(t *testing.T) {
	t.Run("字符串值", func(t *testing.T) {
		value := convertPGValue("text", []byte("hello"))
		if value != "hello" {
			t.Errorf("字符串值期望 hello, 实际 %v", value)
		}
	})

	t.Run("整数值", func(t *testing.T) {
		value := convertPGValue("int4", []byte("123"))
		if v, ok := value.(int64); !ok || v != 123 {
			t.Errorf("整数值期望 123, 实际 %v", value)
		}
	})

	t.Run("布尔值", func(t *testing.T) {
		value := convertPGValue("bool", []byte("t"))
		if v, ok := value.(bool); !ok || !v {
			t.Errorf("布尔值期望 true, 实际 %v", value)
		}

		value = convertPGValue("bool", []byte("f"))
		if v, ok := value.(bool); !ok || v {
			t.Errorf("布尔值期望 false, 实际 %v", value)
		}
	})

	t.Run("JSON 值", func(t *testing.T) {
		jsonStr := `{"key": "value"}`
		value := convertPGValue("jsonb", []byte(jsonStr))
		if v, ok := value.(map[string]interface{}); !ok {
			t.Errorf("JSON 值应该是 map, 实际 %T", value)
		} else if v["key"] != "value" {
			t.Errorf("JSON 值期望 {key: value}, 实际 %v", value)
		}
	})

	t.Run("NULL 值", func(t *testing.T) {
		value := convertPGValue("text", nil)
		if value != nil {
			t.Errorf("NULL 值期望 nil, 实际 %v", value)
		}
	})
}

// ============================================================================
// 辅助函数 - 构建测试消息
// ============================================================================

// buildRelationMessage 构建关系消息
func buildRelationMessage(relID uint32, namespace, relName string, replicaIdentity byte, columns []ColumnInfo) []byte {
	var buf []byte
	buf = append(buf, 'R')

	// RelationID (4 bytes, big-endian)
	buf = append(buf, byte(relID>>24), byte(relID>>16), byte(relID>>8), byte(relID))

	// Namespace (null-terminated string)
	buf = append(buf, []byte(namespace)...)
	buf = append(buf, 0)

	// RelationName (null-terminated string)
	buf = append(buf, []byte(relName)...)
	buf = append(buf, 0)

	// ReplicaIdentity (1 byte)
	buf = append(buf, replicaIdentity)

	// NumColumns (2 bytes, big-endian)
	numCols := uint16(len(columns))
	buf = append(buf, byte(numCols>>8), byte(numCols))

	// Columns
	for _, col := range columns {
		// Flags (1 byte)
		buf = append(buf, col.Flags)
		// Name (null-terminated string)
		buf = append(buf, []byte(col.Name)...)
		buf = append(buf, 0)
		// TypeOID (4 bytes)
		buf = append(buf, byte(col.TypeOID>>24), byte(col.TypeOID>>16), byte(col.TypeOID>>8), byte(col.TypeOID))
		// TypeModifier (4 bytes)
		buf = append(buf, 0xFF, 0xFF, 0xFF, 0xFF) // -1
	}

	return buf
}

// buildInsertMessage 构建 INSERT 消息
func buildInsertMessage(relID uint32, values map[string]string) []byte {
	var buf []byte
	buf = append(buf, 'I')

	// RelationID (4 bytes)
	buf = append(buf, byte(relID>>24), byte(relID>>16), byte(relID>>8), byte(relID))

	// TupleType ('N' = new tuple)
	buf = append(buf, 'N')

	// NumColumns (2 bytes)
	numCols := uint16(len(values))
	buf = append(buf, byte(numCols>>8), byte(numCols))

	// Column values
	for _, v := range values {
		// Type ('t' = text)
		buf = append(buf, 't')
		// Length (4 bytes)
		length := uint32(len(v))
		buf = append(buf, byte(length>>24), byte(length>>16), byte(length>>8), byte(length))
		// Value
		buf = append(buf, []byte(v)...)
	}

	return buf
}

// buildUpdateMessage 构建 UPDATE 消息
func buildUpdateMessage(relID uint32, oldValues, newValues map[string]string) []byte {
	var buf []byte
	buf = append(buf, 'U')

	// RelationID (4 bytes)
	buf = append(buf, byte(relID>>24), byte(relID>>16), byte(relID>>8), byte(relID))

	// OldTupleType ('K' = key, 'O' = old)
	buf = append(buf, 'O')

	// Old tuple columns
	numCols := uint16(len(oldValues))
	buf = append(buf, byte(numCols>>8), byte(numCols))
	for _, v := range oldValues {
		buf = append(buf, 't')
		length := uint32(len(v))
		buf = append(buf, byte(length>>24), byte(length>>16), byte(length>>8), byte(length))
		buf = append(buf, []byte(v)...)
	}

	// NewTupleType ('N' = new)
	buf = append(buf, 'N')

	// New tuple columns
	numCols = uint16(len(newValues))
	buf = append(buf, byte(numCols>>8), byte(numCols))
	for _, v := range newValues {
		buf = append(buf, 't')
		length := uint32(len(v))
		buf = append(buf, byte(length>>24), byte(length>>16), byte(length>>8), byte(length))
		buf = append(buf, []byte(v)...)
	}

	return buf
}

// buildDeleteMessage 构建 DELETE 消息
func buildDeleteMessage(relID uint32, keyValues map[string]string) []byte {
	var buf []byte
	buf = append(buf, 'D')

	// RelationID (4 bytes)
	buf = append(buf, byte(relID>>24), byte(relID>>16), byte(relID>>8), byte(relID))

	// KeyType ('K' = key, 'O' = old)
	buf = append(buf, 'K')

	// Key columns
	numCols := uint16(len(keyValues))
	buf = append(buf, byte(numCols>>8), byte(numCols))
	for _, v := range keyValues {
		buf = append(buf, 't')
		length := uint32(len(v))
		buf = append(buf, byte(length>>24), byte(length>>16), byte(length>>8), byte(length))
		buf = append(buf, []byte(v)...)
	}

	return buf
}
