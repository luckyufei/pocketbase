// Package core 提供 PocketBase 核心功能
package core

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================================
// T-5.1.4: WAL 消息解码器
// ============================================================================

// WALMessageDecoder WAL 消息解码器
type WALMessageDecoder struct {
	relations map[uint32]*RelationInfo
	mu        sync.RWMutex
}

// NewWALMessageDecoder 创建 WAL 消息解码器
func NewWALMessageDecoder() *WALMessageDecoder {
	return &WALMessageDecoder{
		relations: make(map[uint32]*RelationInfo),
	}
}

// SetRelation 设置关系信息
func (d *WALMessageDecoder) SetRelation(rel *RelationInfo) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.relations[rel.RelationID] = rel
}

// GetRelation 获取关系信息
func (d *WALMessageDecoder) GetRelation(relID uint32) *RelationInfo {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.relations[relID]
}

// Decode 解码 WAL 消息
func (d *WALMessageDecoder) Decode(data []byte) (*WALChangeMessage, error) {
	if len(data) == 0 {
		return nil, errors.New("消息数据为空")
	}

	msgType := PGOutputMessageType(data[0])

	switch msgType {
	case PGOutputMessageBegin:
		return d.decodeBegin(data)
	case PGOutputMessageCommit:
		return d.decodeCommit(data)
	case PGOutputMessageRelation:
		return d.decodeRelation(data)
	case PGOutputMessageInsert:
		return d.decodeInsert(data)
	case PGOutputMessageUpdate:
		return d.decodeUpdate(data)
	case PGOutputMessageDelete:
		return d.decodeDelete(data)
	case PGOutputMessageTruncate:
		return d.decodeTruncate(data)
	default:
		return nil, fmt.Errorf("未知的消息类型: %c", msgType)
	}
}

// decodeBegin 解码 BEGIN 消息
func (d *WALMessageDecoder) decodeBegin(data []byte) (*WALChangeMessage, error) {
	if len(data) < 21 {
		return nil, errors.New("BEGIN 消息数据不完整")
	}

	// 跳过消息类型 (1 byte)
	// FinalLSN (8 bytes)
	finalLSN := binary.BigEndian.Uint64(data[1:9])
	// CommitTime (8 bytes) - PostgreSQL epoch (2000-01-01)
	commitTimestamp := binary.BigEndian.Uint64(data[9:17])
	// Xid (4 bytes)
	// xid := binary.BigEndian.Uint32(data[17:21])

	return &WALChangeMessage{
		Type:       WALChangeBegin,
		LSN:        finalLSN,
		CommitTime: pgTimestampToTime(commitTimestamp),
	}, nil
}

// decodeCommit 解码 COMMIT 消息
func (d *WALMessageDecoder) decodeCommit(data []byte) (*WALChangeMessage, error) {
	if len(data) < 25 {
		return nil, errors.New("COMMIT 消息数据不完整")
	}

	// 跳过消息类型 (1 byte)
	// Flags (1 byte)
	// CommitLSN (8 bytes)
	commitLSN := binary.BigEndian.Uint64(data[2:10])
	// TransactionEndLSN (8 bytes)
	// endLSN := binary.BigEndian.Uint64(data[10:18])
	// CommitTime (8 bytes)
	commitTimestamp := binary.BigEndian.Uint64(data[18:26])

	return &WALChangeMessage{
		Type:       WALChangeCommit,
		LSN:        commitLSN,
		CommitTime: pgTimestampToTime(commitTimestamp),
	}, nil
}

// decodeRelation 解码 RELATION 消息
func (d *WALMessageDecoder) decodeRelation(data []byte) (*WALChangeMessage, error) {
	if len(data) < 8 {
		return nil, errors.New("RELATION 消息数据不完整")
	}

	offset := 1

	// RelationID (4 bytes)
	relID := binary.BigEndian.Uint32(data[offset : offset+4])
	offset += 4

	// Namespace (null-terminated string)
	namespace, n := readNullTerminatedString(data[offset:])
	offset += n

	// RelationName (null-terminated string)
	relName, n := readNullTerminatedString(data[offset:])
	offset += n

	// ReplicaIdentity (1 byte)
	replicaIdentity := data[offset]
	offset++

	// NumColumns (2 bytes)
	numCols := binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	// Columns
	columns := make([]ColumnInfo, 0, numCols)
	for i := uint16(0); i < numCols; i++ {
		if offset >= len(data) {
			break
		}

		// Flags (1 byte)
		flags := data[offset]
		offset++

		// Name (null-terminated string)
		name, n := readNullTerminatedString(data[offset:])
		offset += n

		// TypeOID (4 bytes)
		typeOID := uint32(0)
		if offset+4 <= len(data) {
			typeOID = binary.BigEndian.Uint32(data[offset : offset+4])
			offset += 4
		}

		// TypeModifier (4 bytes)
		typeMod := int32(-1)
		if offset+4 <= len(data) {
			typeMod = int32(binary.BigEndian.Uint32(data[offset : offset+4]))
			offset += 4
		}

		columns = append(columns, ColumnInfo{
			Name:         name,
			TypeOID:      typeOID,
			Flags:        flags,
			TypeModifier: typeMod,
		})
	}

	// 缓存关系信息
	rel := &RelationInfo{
		RelationID:      relID,
		Namespace:       namespace,
		RelationName:    relName,
		ReplicaIdentity: replicaIdentity,
		Columns:         columns,
	}
	d.SetRelation(rel)

	// RELATION 消息不产生变更消息
	return nil, nil
}

// decodeInsert 解码 INSERT 消息
func (d *WALMessageDecoder) decodeInsert(data []byte) (*WALChangeMessage, error) {
	if len(data) < 6 {
		return nil, errors.New("INSERT 消息数据不完整")
	}

	offset := 1

	// RelationID (4 bytes)
	relID := binary.BigEndian.Uint32(data[offset : offset+4])
	offset += 4

	// 获取关系信息
	rel := d.GetRelation(relID)
	if rel == nil {
		return nil, fmt.Errorf("未找到关系信息: %d", relID)
	}

	// TupleType (1 byte) - 'N' for new tuple
	if offset >= len(data) || data[offset] != 'N' {
		return nil, errors.New("INSERT 消息缺少新元组")
	}
	offset++

	// 解析元组
	newTuple, _, err := d.decodeTuple(data[offset:], rel.Columns)
	if err != nil {
		return nil, fmt.Errorf("解析 INSERT 元组失败: %w", err)
	}

	return &WALChangeMessage{
		Type:       WALChangeInsert,
		Schema:     rel.Namespace,
		Table:      rel.RelationName,
		RelationID: relID,
		NewTuple:   newTuple,
	}, nil
}

// decodeUpdate 解码 UPDATE 消息
func (d *WALMessageDecoder) decodeUpdate(data []byte) (*WALChangeMessage, error) {
	if len(data) < 6 {
		return nil, errors.New("UPDATE 消息数据不完整")
	}

	offset := 1

	// RelationID (4 bytes)
	relID := binary.BigEndian.Uint32(data[offset : offset+4])
	offset += 4

	// 获取关系信息
	rel := d.GetRelation(relID)
	if rel == nil {
		return nil, fmt.Errorf("未找到关系信息: %d", relID)
	}

	var oldTuple map[string]interface{}
	var newTuple map[string]interface{}

	// 检查是否有旧元组
	if offset < len(data) {
		tupleType := data[offset]
		if tupleType == 'K' || tupleType == 'O' {
			offset++
			var n int
			var err error
			oldTuple, n, err = d.decodeTuple(data[offset:], rel.Columns)
			if err != nil {
				return nil, fmt.Errorf("解析 UPDATE 旧元组失败: %w", err)
			}
			offset += n
		}
	}

	// 解析新元组
	if offset < len(data) && data[offset] == 'N' {
		offset++
		var err error
		newTuple, _, err = d.decodeTuple(data[offset:], rel.Columns)
		if err != nil {
			return nil, fmt.Errorf("解析 UPDATE 新元组失败: %w", err)
		}
	}

	return &WALChangeMessage{
		Type:       WALChangeUpdate,
		Schema:     rel.Namespace,
		Table:      rel.RelationName,
		RelationID: relID,
		OldTuple:   oldTuple,
		NewTuple:   newTuple,
	}, nil
}

// decodeDelete 解码 DELETE 消息
func (d *WALMessageDecoder) decodeDelete(data []byte) (*WALChangeMessage, error) {
	if len(data) < 6 {
		return nil, errors.New("DELETE 消息数据不完整")
	}

	offset := 1

	// RelationID (4 bytes)
	relID := binary.BigEndian.Uint32(data[offset : offset+4])
	offset += 4

	// 获取关系信息
	rel := d.GetRelation(relID)
	if rel == nil {
		return nil, fmt.Errorf("未找到关系信息: %d", relID)
	}

	// KeyType (1 byte) - 'K' for key, 'O' for old
	if offset >= len(data) {
		return nil, errors.New("DELETE 消息缺少键元组")
	}
	offset++ // 跳过 K 或 O

	// 解析键元组
	oldTuple, _, err := d.decodeTuple(data[offset:], rel.Columns)
	if err != nil {
		return nil, fmt.Errorf("解析 DELETE 键元组失败: %w", err)
	}

	return &WALChangeMessage{
		Type:       WALChangeDelete,
		Schema:     rel.Namespace,
		Table:      rel.RelationName,
		RelationID: relID,
		OldTuple:   oldTuple,
	}, nil
}

// decodeTruncate 解码 TRUNCATE 消息
func (d *WALMessageDecoder) decodeTruncate(data []byte) (*WALChangeMessage, error) {
	// TRUNCATE 消息格式较复杂，这里简化处理
	return &WALChangeMessage{
		Type: WALChangeTruncate,
	}, nil
}

// decodeTuple 解码元组
func (d *WALMessageDecoder) decodeTuple(data []byte, columns []ColumnInfo) (map[string]interface{}, int, error) {
	if len(data) < 2 {
		return nil, 0, errors.New("元组数据不完整")
	}

	offset := 0

	// NumColumns (2 bytes)
	numCols := binary.BigEndian.Uint16(data[offset : offset+2])
	offset += 2

	tuple := make(map[string]interface{})

	for i := uint16(0); i < numCols && i < uint16(len(columns)); i++ {
		if offset >= len(data) {
			break
		}

		colName := columns[i].Name
		colType := data[offset]
		offset++

		switch colType {
		case 'n': // NULL
			tuple[colName] = nil
		case 'u': // unchanged TOAST
			// 保持不变，跳过
		case 't': // text
			if offset+4 > len(data) {
				break
			}
			length := binary.BigEndian.Uint32(data[offset : offset+4])
			offset += 4
			if offset+int(length) > len(data) {
				break
			}
			value := string(data[offset : offset+int(length)])
			offset += int(length)
			tuple[colName] = convertPGValue(getTypeNameFromOID(columns[i].TypeOID), []byte(value))
		case 'b': // binary
			if offset+4 > len(data) {
				break
			}
			length := binary.BigEndian.Uint32(data[offset : offset+4])
			offset += 4
			if offset+int(length) > len(data) {
				break
			}
			value := data[offset : offset+int(length)]
			offset += int(length)
			tuple[colName] = value
		}
	}

	return tuple, offset, nil
}

// ============================================================================
// T-5.1.5: 转换为 PocketBase Record
// ============================================================================

// WALToRecordConverter WAL 到 Record 转换器
type WALToRecordConverter struct {
	// 系统表列表 (不产生事件)
	systemTables map[string]struct{}
}

// NewWALToRecordConverter 创建转换器
func NewWALToRecordConverter() *WALToRecordConverter {
	return &WALToRecordConverter{
		systemTables: map[string]struct{}{
			"_collections":   {},
			"_params":        {},
			"_migrations":    {},
			"_admins":        {},
			"_superusers":    {},
			"_externalAuths": {},
			"_mfas":          {},
			"_otps":          {},
			"_authOrigins":   {},
		},
	}
}

// Convert 将 WAL 消息转换为 Record 事件
func (c *WALToRecordConverter) Convert(msg *WALChangeMessage) (*RealtimeRecordEvent, error) {
	// 忽略 BEGIN/COMMIT 消息
	if msg.Type == WALChangeBegin || msg.Type == WALChangeCommit {
		return nil, nil
	}

	// 忽略 TRUNCATE 消息
	if msg.Type == WALChangeTruncate {
		return nil, nil
	}

	// 过滤系统表
	if c.isSystemTable(msg.Table) {
		return nil, nil
	}

	event := &RealtimeRecordEvent{
		Collection: msg.Table,
		Timestamp:  msg.CommitTime,
	}

	switch msg.Type {
	case WALChangeInsert:
		event.Action = RealtimeRecordActionCreate
		event.Record = msg.NewTuple
	case WALChangeUpdate:
		event.Action = RealtimeRecordActionUpdate
		event.Record = msg.NewTuple
		event.OldRecord = msg.OldTuple
	case WALChangeDelete:
		event.Action = RealtimeRecordActionDelete
		event.OldRecord = msg.OldTuple
	default:
		return nil, fmt.Errorf("不支持的消息类型: %v", msg.Type)
	}

	return event, nil
}

// isSystemTable 检查是否是系统表
func (c *WALToRecordConverter) isSystemTable(table string) bool {
	_, ok := c.systemTables[table]
	return ok
}

// AddSystemTable 添加系统表
func (c *WALToRecordConverter) AddSystemTable(table string) {
	c.systemTables[table] = struct{}{}
}

// RemoveSystemTable 移除系统表
func (c *WALToRecordConverter) RemoveSystemTable(table string) {
	delete(c.systemTables, table)
}

// ============================================================================
// 辅助函数
// ============================================================================

// readNullTerminatedString 读取以 null 结尾的字符串
func readNullTerminatedString(data []byte) (string, int) {
	for i, b := range data {
		if b == 0 {
			return string(data[:i]), i + 1
		}
	}
	return string(data), len(data)
}

// pgTimestampToTime 将 PostgreSQL 时间戳转换为 Go time.Time
// PostgreSQL 使用 2000-01-01 作为 epoch
func pgTimestampToTime(pgTimestamp uint64) time.Time {
	// PostgreSQL epoch: 2000-01-01 00:00:00 UTC
	pgEpoch := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	// PostgreSQL 时间戳是微秒
	return pgEpoch.Add(time.Duration(pgTimestamp) * time.Microsecond)
}

// getTypeNameFromOID 根据 OID 获取类型名称
func getTypeNameFromOID(oid uint32) string {
	// 常用 PostgreSQL 类型 OID
	switch oid {
	case 16:
		return "bool"
	case 20:
		return "int8"
	case 21:
		return "int2"
	case 23:
		return "int4"
	case 25:
		return "text"
	case 700:
		return "float4"
	case 701:
		return "float8"
	case 1082:
		return "date"
	case 1114:
		return "timestamp"
	case 1184:
		return "timestamptz"
	case 3802:
		return "jsonb"
	case 114:
		return "json"
	case 2950:
		return "uuid"
	default:
		return "text"
	}
}

// convertPGValue 转换 PostgreSQL 值
func convertPGValue(typeName string, data []byte) interface{} {
	if data == nil {
		return nil
	}

	str := string(data)

	switch typeName {
	case "bool":
		return str == "t" || str == "true" || str == "1"
	case "int2", "int4", "int8":
		v, err := strconv.ParseInt(str, 10, 64)
		if err != nil {
			return str
		}
		return v
	case "float4", "float8":
		v, err := strconv.ParseFloat(str, 64)
		if err != nil {
			return str
		}
		return v
	case "json", "jsonb":
		var v interface{}
		if err := json.Unmarshal(data, &v); err != nil {
			return str
		}
		return v
	case "timestamp", "timestamptz", "date":
		// 尝试解析时间
		formats := []string{
			time.RFC3339,
			"2006-01-02 15:04:05.999999-07",
			"2006-01-02 15:04:05.999999",
			"2006-01-02 15:04:05",
			"2006-01-02",
		}
		for _, format := range formats {
			if t, err := time.Parse(format, str); err == nil {
				return t
			}
		}
		return str
	default:
		return str
	}
}

// isJSONArray 检查字符串是否是 JSON 数组
func isJSONArray(s string) bool {
	s = strings.TrimSpace(s)
	return len(s) >= 2 && s[0] == '[' && s[len(s)-1] == ']'
}

// isJSONObject 检查字符串是否是 JSON 对象
func isJSONObject(s string) bool {
	s = strings.TrimSpace(s)
	return len(s) >= 2 && s[0] == '{' && s[len(s)-1] == '}'
}
