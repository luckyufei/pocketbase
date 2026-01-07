package core

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/pocketbase/pocketbase/tools/types"
)

// ============================================================================
// T-7.1.1: 定义 vector 字段类型
// ============================================================================

func TestVectorFieldType(t *testing.T) {
	t.Run("字段类型常量", func(t *testing.T) {
		if FieldTypeVector != "vector" {
			t.Errorf("期望 'vector', 实际 '%s'", FieldTypeVector)
		}
	})

	t.Run("字段注册", func(t *testing.T) {
		factory, ok := Fields[FieldTypeVector]
		if !ok {
			t.Fatal("vector 字段类型未注册")
		}

		field := factory()
		if field == nil {
			t.Fatal("工厂函数返回 nil")
		}

		if field.Type() != FieldTypeVector {
			t.Errorf("期望类型 'vector', 实际 '%s'", field.Type())
		}
	})
}

func TestVectorFieldBasicProperties(t *testing.T) {
	field := &VectorField{
		Name:        "embedding",
		Id:          "field_123",
		System:      true,
		Hidden:      true,
		Presentable: false,
		Dimension:   1536,
		Required:    true,
	}

	t.Run("Type", func(t *testing.T) {
		if field.Type() != FieldTypeVector {
			t.Errorf("期望 'vector', 实际 '%s'", field.Type())
		}
	})

	t.Run("GetId/SetId", func(t *testing.T) {
		if field.GetId() != "field_123" {
			t.Errorf("期望 'field_123', 实际 '%s'", field.GetId())
		}

		field.SetId("new_id")
		if field.GetId() != "new_id" {
			t.Errorf("期望 'new_id', 实际 '%s'", field.GetId())
		}
		field.SetId("field_123") // 恢复
	})

	t.Run("GetName/SetName", func(t *testing.T) {
		if field.GetName() != "embedding" {
			t.Errorf("期望 'embedding', 实际 '%s'", field.GetName())
		}

		field.SetName("vector_field")
		if field.GetName() != "vector_field" {
			t.Errorf("期望 'vector_field', 实际 '%s'", field.GetName())
		}
		field.SetName("embedding") // 恢复
	})

	t.Run("GetSystem/SetSystem", func(t *testing.T) {
		if !field.GetSystem() {
			t.Error("期望 System=true")
		}

		field.SetSystem(false)
		if field.GetSystem() {
			t.Error("期望 System=false")
		}
		field.SetSystem(true) // 恢复
	})

	t.Run("GetHidden/SetHidden", func(t *testing.T) {
		if !field.GetHidden() {
			t.Error("期望 Hidden=true")
		}

		field.SetHidden(false)
		if field.GetHidden() {
			t.Error("期望 Hidden=false")
		}
		field.SetHidden(true) // 恢复
	})
}

func TestVectorFieldColumnType(t *testing.T) {
	t.Run("SQLite 列类型", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 1536,
		}

		// 使用 nil app 模拟 SQLite (默认)
		colType := field.ColumnType(nil)

		// SQLite 使用 JSON 存储
		if colType != "JSON DEFAULT '[]' NOT NULL" {
			t.Errorf("期望 JSON 列类型, 实际 '%s'", colType)
		}
	})

	t.Run("PostgreSQL 列类型", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 1536,
		}

		// 创建 mock app 来模拟 PostgreSQL
		// 由于我们没有真正的 app，这里只测试 SQLite 行为
		// PostgreSQL 行为需要集成测试
		colType := field.ColumnType(nil)
		if colType == "" {
			t.Error("列类型不应为空")
		}
	})
}

func TestVectorFieldPrepareValue(t *testing.T) {
	field := &VectorField{
		Name:      "embedding",
		Dimension: 3,
	}

	t.Run("准备 nil 值", func(t *testing.T) {
		val, err := field.PrepareValue(nil, nil)
		if err != nil {
			t.Fatalf("PrepareValue 失败: %v", err)
		}

		vec, ok := val.(types.Vector)
		if !ok {
			t.Fatalf("期望 types.Vector, 实际 %T", val)
		}

		if len(vec) != 0 {
			t.Errorf("期望空向量, 实际 %v", vec)
		}
	})

	t.Run("准备 Vector 值", func(t *testing.T) {
		input := types.Vector{1.0, 2.0, 3.0}
		val, err := field.PrepareValue(nil, input)
		if err != nil {
			t.Fatalf("PrepareValue 失败: %v", err)
		}

		vec, ok := val.(types.Vector)
		if !ok {
			t.Fatalf("期望 types.Vector, 实际 %T", val)
		}

		if len(vec) != 3 || vec[0] != 1.0 {
			t.Errorf("期望 [1,2,3], 实际 %v", vec)
		}
	})

	t.Run("准备 []float64 值", func(t *testing.T) {
		input := []float64{1.0, 2.0, 3.0}
		val, err := field.PrepareValue(nil, input)
		if err != nil {
			t.Fatalf("PrepareValue 失败: %v", err)
		}

		vec, ok := val.(types.Vector)
		if !ok {
			t.Fatalf("期望 types.Vector, 实际 %T", val)
		}

		if len(vec) != 3 {
			t.Errorf("期望 3 维, 实际 %d 维", len(vec))
		}
	})

	t.Run("准备 JSON 字符串", func(t *testing.T) {
		input := "[1.5, 2.5, 3.5]"
		val, err := field.PrepareValue(nil, input)
		if err != nil {
			t.Fatalf("PrepareValue 失败: %v", err)
		}

		vec, ok := val.(types.Vector)
		if !ok {
			t.Fatalf("期望 types.Vector, 实际 %T", val)
		}

		if len(vec) != 3 || vec[0] != 1.5 {
			t.Errorf("期望 [1.5,2.5,3.5], 实际 %v", vec)
		}
	})

	t.Run("准备 []interface{}", func(t *testing.T) {
		input := []interface{}{1.0, 2.0, 3.0}
		val, err := field.PrepareValue(nil, input)
		if err != nil {
			t.Fatalf("PrepareValue 失败: %v", err)
		}

		vec, ok := val.(types.Vector)
		if !ok {
			t.Fatalf("期望 types.Vector, 实际 %T", val)
		}

		if len(vec) != 3 {
			t.Errorf("期望 3 维, 实际 %d 维", len(vec))
		}
	})
}

func TestVectorFieldValidateValue(t *testing.T) {
	ctx := context.Background()
	collection := NewBaseCollection("test")

	t.Run("验证空向量 (非必填)", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 3,
			Required:  false,
		}

		record := NewRecord(collection)
		record.SetRaw(field.Name, types.Vector{})

		err := field.ValidateValue(ctx, nil, record)
		if err != nil {
			t.Errorf("非必填字段空值应该通过验证, 错误: %v", err)
		}
	})

	t.Run("验证空向量 (必填)", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 3,
			Required:  true,
		}

		record := NewRecord(collection)
		record.SetRaw(field.Name, types.Vector{})

		err := field.ValidateValue(ctx, nil, record)
		if err == nil {
			t.Error("必填字段空值应该验证失败")
		}
	})

	t.Run("验证正确维度", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 3,
			Required:  true,
		}

		record := NewRecord(collection)
		record.SetRaw(field.Name, types.Vector{1.0, 2.0, 3.0})

		err := field.ValidateValue(ctx, nil, record)
		if err != nil {
			t.Errorf("正确维度应该通过验证, 错误: %v", err)
		}
	})

	t.Run("验证错误维度", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 3,
			Required:  true,
		}

		record := NewRecord(collection)
		record.SetRaw(field.Name, types.Vector{1.0, 2.0}) // 只有 2 维

		err := field.ValidateValue(ctx, nil, record)
		if err == nil {
			t.Error("错误维度应该验证失败")
		}
	})

	t.Run("维度为 0 时不检查", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 0, // 不限制维度
			Required:  true,
		}

		record := NewRecord(collection)
		record.SetRaw(field.Name, types.Vector{1.0, 2.0, 3.0, 4.0, 5.0})

		err := field.ValidateValue(ctx, nil, record)
		if err != nil {
			t.Errorf("不限制维度时应该通过验证, 错误: %v", err)
		}
	})
}

func TestVectorFieldValidateSettings(t *testing.T) {
	ctx := context.Background()

	t.Run("有效设置", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Id:        "field_123",
			Dimension: 1536,
		}

		err := field.ValidateSettings(ctx, nil, nil)
		if err != nil {
			t.Errorf("有效设置应该通过验证, 错误: %v", err)
		}
	})

	t.Run("空名称", func(t *testing.T) {
		field := &VectorField{
			Name:      "",
			Dimension: 1536,
		}

		err := field.ValidateSettings(ctx, nil, nil)
		if err == nil {
			t.Error("空名称应该验证失败")
		}
	})

	t.Run("负维度", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: -1,
		}

		err := field.ValidateSettings(ctx, nil, nil)
		if err == nil {
			t.Error("负维度应该验证失败")
		}
	})

	t.Run("维度过大", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 100000, // 超过最大限制
		}

		err := field.ValidateSettings(ctx, nil, nil)
		if err == nil {
			t.Error("维度过大应该验证失败")
		}
	})
}

func TestVectorFieldJSON(t *testing.T) {
	t.Run("JSON 序列化", func(t *testing.T) {
		field := &VectorField{
			Name:        "embedding",
			Id:          "field_123",
			Dimension:   1536,
			Required:    true,
			IndexType:   VectorIndexHNSW,
			DistanceFunc: VectorDistanceL2,
		}

		data, err := json.Marshal(field)
		if err != nil {
			t.Fatalf("Marshal 失败: %v", err)
		}

		var result map[string]interface{}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("Unmarshal 失败: %v", err)
		}

		if result["name"] != "embedding" {
			t.Errorf("期望 name='embedding', 实际 '%v'", result["name"])
		}
		if result["dimension"].(float64) != 1536 {
			t.Errorf("期望 dimension=1536, 实际 %v", result["dimension"])
		}
	})

	t.Run("JSON 反序列化", func(t *testing.T) {
		jsonStr := `{
			"name": "embedding",
			"id": "field_123",
			"dimension": 1536,
			"required": true,
			"indexType": "hnsw",
			"distanceFunc": "l2"
		}`

		var field VectorField
		if err := json.Unmarshal([]byte(jsonStr), &field); err != nil {
			t.Fatalf("Unmarshal 失败: %v", err)
		}

		if field.Name != "embedding" {
			t.Errorf("期望 name='embedding', 实际 '%s'", field.Name)
		}
		if field.Dimension != 1536 {
			t.Errorf("期望 dimension=1536, 实际 %d", field.Dimension)
		}
		if field.IndexType != VectorIndexHNSW {
			t.Errorf("期望 indexType='hnsw', 实际 '%s'", field.IndexType)
		}
	})
}

// ============================================================================
// T-7.1.3: 自动执行 CREATE EXTENSION vector
// ============================================================================

func TestVectorExtensionSQL(t *testing.T) {
	t.Run("生成创建扩展 SQL", func(t *testing.T) {
		sql := CreateVectorExtensionSQL()
		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if sql != "CREATE EXTENSION IF NOT EXISTS vector" {
			t.Errorf("期望 'CREATE EXTENSION IF NOT EXISTS vector', 实际 '%s'", sql)
		}
	})
}

// ============================================================================
// T-7.1.4: 自动创建 HNSW 索引
// ============================================================================

func TestVectorIndexSQL(t *testing.T) {
	t.Run("生成 HNSW 索引 SQL (L2)", func(t *testing.T) {
		field := &VectorField{
			Name:         "embedding",
			Dimension:    1536,
			IndexType:    VectorIndexHNSW,
			DistanceFunc: VectorDistanceL2,
		}

		sql := field.CreateIndexSQL("posts")
		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !vectorContains(sql, "USING hnsw") {
			t.Errorf("应该包含 'USING hnsw', 实际 '%s'", sql)
		}
		if !vectorContains(sql, "vector_l2_ops") {
			t.Errorf("应该包含 'vector_l2_ops', 实际 '%s'", sql)
		}
	})

	t.Run("生成 HNSW 索引 SQL (Cosine)", func(t *testing.T) {
		field := &VectorField{
			Name:         "embedding",
			Dimension:    1536,
			IndexType:    VectorIndexHNSW,
			DistanceFunc: VectorDistanceCosine,
		}

		sql := field.CreateIndexSQL("posts")
		if !vectorContains(sql, "vector_cosine_ops") {
			t.Errorf("应该包含 'vector_cosine_ops', 实际 '%s'", sql)
		}
	})

	t.Run("生成 HNSW 索引 SQL (Inner Product)", func(t *testing.T) {
		field := &VectorField{
			Name:         "embedding",
			Dimension:    1536,
			IndexType:    VectorIndexHNSW,
			DistanceFunc: VectorDistanceIP,
		}

		sql := field.CreateIndexSQL("posts")
		if !vectorContains(sql, "vector_ip_ops") {
			t.Errorf("应该包含 'vector_ip_ops', 实际 '%s'", sql)
		}
	})

	t.Run("生成 IVFFlat 索引 SQL", func(t *testing.T) {
		field := &VectorField{
			Name:         "embedding",
			Dimension:    1536,
			IndexType:    VectorIndexIVFFlat,
			DistanceFunc: VectorDistanceL2,
		}

		sql := field.CreateIndexSQL("posts")
		if !vectorContains(sql, "USING ivfflat") {
			t.Errorf("应该包含 'USING ivfflat', 实际 '%s'", sql)
		}
	})

	t.Run("无索引类型时返回空", func(t *testing.T) {
		field := &VectorField{
			Name:      "embedding",
			Dimension: 1536,
			IndexType: "",
		}

		sql := field.CreateIndexSQL("posts")
		if sql != "" {
			t.Errorf("无索引类型应该返回空, 实际 '%s'", sql)
		}
	})
}

// ============================================================================
// T-7.1.5 & T-7.1.6: 距离查询
// ============================================================================

func TestVectorDistanceQuery(t *testing.T) {
	t.Run("L2 距离查询 (<->)", func(t *testing.T) {
		query := VectorDistanceExpr("embedding", types.Vector{1, 2, 3}, VectorDistanceL2)
		if query == "" {
			t.Error("查询不应为空")
		}
		if !vectorContains(query, "<->") {
			t.Errorf("应该包含 '<->', 实际 '%s'", query)
		}
	})

	t.Run("余弦距离查询 (<=>)", func(t *testing.T) {
		query := VectorDistanceExpr("embedding", types.Vector{1, 2, 3}, VectorDistanceCosine)
		if !vectorContains(query, "<=>") {
			t.Errorf("应该包含 '<=>', 实际 '%s'", query)
		}
	})

	t.Run("内积查询 (<#>)", func(t *testing.T) {
		query := VectorDistanceExpr("embedding", types.Vector{1, 2, 3}, VectorDistanceIP)
		if !vectorContains(query, "<#>") {
			t.Errorf("应该包含 '<#>', 实际 '%s'", query)
		}
	})
}

// 辅助函数
func vectorContains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
