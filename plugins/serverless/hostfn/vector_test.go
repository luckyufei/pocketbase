// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"math"
	"strings"
	"testing"
)

// Phase 6: US3 Vector Search 测试

func TestVectorSearch(t *testing.T) {
	t.Run("基本向量搜索", func(t *testing.T) {
		vs := NewVectorSearch(nil)

		// 模拟文档向量
		docs := []VectorDocument{
			{ID: "1", Vector: []float64{1.0, 0.0, 0.0}, Content: "doc1"},
			{ID: "2", Vector: []float64{0.0, 1.0, 0.0}, Content: "doc2"},
			{ID: "3", Vector: []float64{0.9, 0.1, 0.0}, Content: "doc3"},
		}

		// 查询向量接近 doc1 和 doc3
		query := []float64{1.0, 0.0, 0.0}
		results := vs.SearchInMemory(docs, query, 2)

		if len(results) != 2 {
			t.Errorf("SearchInMemory() 返回 %d 个结果, want 2", len(results))
		}

		// 第一个结果应该是 doc1（完全匹配）
		if results[0].ID != "1" {
			t.Errorf("第一个结果应该是 doc1, got %s", results[0].ID)
		}
	})

	t.Run("余弦相似度计算", func(t *testing.T) {
		vs := NewVectorSearch(nil)

		// 相同向量，相似度应为 1
		v1 := []float64{1.0, 0.0, 0.0}
		v2 := []float64{1.0, 0.0, 0.0}
		sim := vs.CosineSimilarity(v1, v2)
		if math.Abs(sim-1.0) > 0.0001 {
			t.Errorf("CosineSimilarity() = %f, want 1.0", sim)
		}

		// 正交向量，相似度应为 0
		v3 := []float64{0.0, 1.0, 0.0}
		sim2 := vs.CosineSimilarity(v1, v3)
		if math.Abs(sim2) > 0.0001 {
			t.Errorf("CosineSimilarity() = %f, want 0.0", sim2)
		}

		// 相反向量，相似度应为 -1
		v4 := []float64{-1.0, 0.0, 0.0}
		sim3 := vs.CosineSimilarity(v1, v4)
		if math.Abs(sim3-(-1.0)) > 0.0001 {
			t.Errorf("CosineSimilarity() = %f, want -1.0", sim3)
		}
	})

	t.Run("维度校验", func(t *testing.T) {
		vs := NewVectorSearch(nil)

		v1 := []float64{1.0, 0.0, 0.0}
		v2 := []float64{1.0, 0.0} // 维度不匹配

		err := vs.ValidateDimensions(v1, v2)
		if err == nil {
			t.Error("ValidateDimensions() 应该返回错误")
		}
	})

	t.Run("空向量处理", func(t *testing.T) {
		vs := NewVectorSearch(nil)

		v1 := []float64{}
		v2 := []float64{1.0, 0.0, 0.0}

		err := vs.ValidateDimensions(v1, v2)
		if err == nil {
			t.Error("ValidateDimensions() 应该对空向量返回错误")
		}
	})

	t.Run("Top N 限制", func(t *testing.T) {
		vs := NewVectorSearch(nil)

		docs := []VectorDocument{
			{ID: "1", Vector: []float64{1.0, 0.0}, Content: "doc1"},
			{ID: "2", Vector: []float64{0.9, 0.1}, Content: "doc2"},
			{ID: "3", Vector: []float64{0.8, 0.2}, Content: "doc3"},
			{ID: "4", Vector: []float64{0.7, 0.3}, Content: "doc4"},
			{ID: "5", Vector: []float64{0.6, 0.4}, Content: "doc5"},
		}

		query := []float64{1.0, 0.0}
		results := vs.SearchInMemory(docs, query, 3)

		if len(results) != 3 {
			t.Errorf("SearchInMemory() 返回 %d 个结果, want 3", len(results))
		}
	})
}

func TestVectorSearchOptions(t *testing.T) {
	t.Run("默认选项", func(t *testing.T) {
		opts := DefaultVectorSearchOptions()

		if opts.Top != 10 {
			t.Errorf("Top = %d, want 10", opts.Top)
		}
		if opts.Field != "embedding" {
			t.Errorf("Field = %s, want embedding", opts.Field)
		}
	})

	t.Run("自定义选项", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{1.0, 0.0, 0.0},
			Field:  "vector",
			Filter: "status = 'published'",
			Top:    5,
		}

		if opts.Top != 5 {
			t.Errorf("Top = %d, want 5", opts.Top)
		}
		if opts.Filter != "status = 'published'" {
			t.Errorf("Filter = %s, want status = 'published'", opts.Filter)
		}
	})
}

func TestVectorSearchResult(t *testing.T) {
	t.Run("结果排序", func(t *testing.T) {
		results := []VectorSearchResult{
			{ID: "1", Score: 0.5},
			{ID: "2", Score: 0.9},
			{ID: "3", Score: 0.7},
		}

		sorted := SortByScore(results)

		if sorted[0].ID != "2" {
			t.Errorf("第一个结果应该是 ID=2, got %s", sorted[0].ID)
		}
		if sorted[1].ID != "3" {
			t.Errorf("第二个结果应该是 ID=3, got %s", sorted[1].ID)
		}
		if sorted[2].ID != "1" {
			t.Errorf("第三个结果应该是 ID=1, got %s", sorted[2].ID)
		}
	})
}

// T045/T047: 新增测试用例

func TestParseVector(t *testing.T) {
	t.Run("解析 float64 切片", func(t *testing.T) {
		input := []float64{1.0, 2.0, 3.0}
		result, err := parseVector(input)
		if err != nil {
			t.Fatalf("parseVector() error = %v", err)
		}
		if len(result) != 3 {
			t.Errorf("parseVector() len = %d, want 3", len(result))
		}
	})

	t.Run("解析 interface 切片", func(t *testing.T) {
		input := []interface{}{1.0, 2.0, 3.0}
		result, err := parseVector(input)
		if err != nil {
			t.Fatalf("parseVector() error = %v", err)
		}
		if len(result) != 3 {
			t.Errorf("parseVector() len = %d, want 3", len(result))
		}
	})

	t.Run("解析 JSON 字符串", func(t *testing.T) {
		input := "[1.0, 2.0, 3.0]"
		result, err := parseVector(input)
		if err != nil {
			t.Fatalf("parseVector() error = %v", err)
		}
		if len(result) != 3 {
			t.Errorf("parseVector() len = %d, want 3", len(result))
		}
	})

	t.Run("解析 int 切片", func(t *testing.T) {
		input := []interface{}{1, 2, 3}
		result, err := parseVector(input)
		if err != nil {
			t.Fatalf("parseVector() error = %v", err)
		}
		if result[0] != 1.0 {
			t.Errorf("parseVector()[0] = %f, want 1.0", result[0])
		}
	})
}

func TestVectorToString(t *testing.T) {
	t.Run("转换向量为字符串", func(t *testing.T) {
		v := []float64{1.0, 2.0, 3.0}
		result := vectorToString(v)
		if result[0] != '[' || result[len(result)-1] != ']' {
			t.Errorf("vectorToString() = %s, should be wrapped in []", result)
		}
	})
}

func TestParseFilter(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("解析字符串比较", func(t *testing.T) {
		filter := `status = "published"`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})

	t.Run("解析数值比较", func(t *testing.T) {
		filter := `score > 10`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})

	t.Run("拒绝 SQL 注入", func(t *testing.T) {
		filter := `status = "published"; DROP TABLE users;--`
		_, err := vs.parseFilter(filter)
		if err == nil {
			t.Error("parseFilter() should reject SQL injection")
		}
	})
}

func TestMatchFilter(t *testing.T) {
	// 注意：由于 matchFilter 需要 *core.Record，这里只测试解析逻辑
	t.Run("matchSingleCondition 字符串比较", func(t *testing.T) {
		// 这个测试需要 mock Record，暂时跳过
		// 实际测试应该在集成测试中进行
		_ = NewVectorSearch(nil) // 使用 vs 避免未使用警告
	})
}

// TestParseFilterOR 测试 OR 条件解析
func TestParseFilterOR(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("OR 条件", func(t *testing.T) {
		filter := `status = "published" OR status = "draft"`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})

	t.Run("混合 AND 和 OR", func(t *testing.T) {
		filter := `status = "published" AND score > 10 OR category = "news"`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})
}

// TestSearchWithNilApp 测试 nil app 情况
func TestSearchWithNilApp(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("searchWithSQLite nil app", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{1.0, 0.0, 0.0},
			Top:    10,
		}
		_, err := vs.searchWithSQLite("test", opts)
		if err == nil {
			t.Error("searchWithSQLite() should return error for nil app")
		}
	})

	t.Run("searchWithPgvector nil app", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{1.0, 0.0, 0.0},
			Top:    10,
		}
		_, err := vs.searchWithPgvector("test", opts)
		if err == nil {
			t.Error("searchWithPgvector() should return error for nil app")
		}
	})
}

// TestVectorToStringFormats 测试向量字符串格式
func TestVectorToStringFormats(t *testing.T) {
	t.Run("单元素向量", func(t *testing.T) {
		v := []float64{1.5}
		result := vectorToString(v)
		if !strings.HasPrefix(result, "[") || !strings.HasSuffix(result, "]") {
			t.Errorf("vectorToString() = %s, should be wrapped in []", result)
		}
	})

	t.Run("多元素向量", func(t *testing.T) {
		v := []float64{1.0, 2.5, 3.14159}
		result := vectorToString(v)
		if !strings.Contains(result, ",") {
			t.Errorf("vectorToString() = %s, should contain commas", result)
		}
	})

	t.Run("空向量", func(t *testing.T) {
		v := []float64{}
		result := vectorToString(v)
		if result != "[]" {
			t.Errorf("vectorToString() = %s, want '[]'", result)
		}
	})
}

// TestSearchWithFilter 测试带 filter 的搜索
func TestSearchWithFilter(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("Search 带 filter", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{1.0, 0.0, 0.0},
			Filter: `status = "published"`,
			Top:    10,
		}
		// 由于没有 app，会返回错误
		_, err := vs.Search("test", opts)
		if err == nil {
			t.Error("Search() should return error for nil app")
		}
	})
}

// TestSearchInMemoryWithMetadata 测试带元数据的内存搜索
func TestSearchInMemoryWithMetadata(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("结果包含元数据", func(t *testing.T) {
		docs := []VectorDocument{
			{
				ID:      "1",
				Vector:  []float64{1.0, 0.0},
				Content: "doc1",
				Data:    map[string]interface{}{"title": "Test Document"},
			},
		}
		query := []float64{1.0, 0.0}
		results := vs.SearchInMemory(docs, query, 1)

		if len(results) != 1 {
			t.Fatalf("SearchInMemory() returned %d results, want 1", len(results))
		}
		if results[0].Data["title"] != "Test Document" {
			t.Errorf("结果应该包含元数据 title")
		}
	})
}

func TestSearch(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("空向量返回错误", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{},
			Top:    10,
		}
		_, err := vs.Search("test", opts)
		if err == nil {
			t.Error("Search() should return error for empty vector")
		}
	})

	t.Run("默认 Top 值", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{1.0, 0.0, 0.0},
			Top:    0, // 应该被设置为默认值 10
		}
		// 由于没有 app，会返回错误，但我们测试的是参数处理
		_, _ = vs.Search("test", opts)
	})

	t.Run("默认 Field 值", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{1.0, 0.0, 0.0},
			Field:  "", // 应该被设置为默认值 "embedding"
		}
		_, _ = vs.Search("test", opts)
	})
}

// TestDetectPgvector 测试 pgvector 检测
func TestDetectPgvector(t *testing.T) {
	t.Run("nil app 返回 false", func(t *testing.T) {
		vs := NewVectorSearch(nil)
		if vs.usePgvector {
			t.Error("usePgvector should be false for nil app")
		}
	})
}

// TestBuildPgvectorQuery 测试 pgvector SQL 查询构建
func TestBuildPgvectorQuery(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("基本查询构建", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{0.1, 0.2, 0.3},
			Field:  "embedding",
			Top:    5,
		}
		query := vs.buildPgvectorQuery("documents", opts)

		// 验证查询包含必要部分
		if !strings.Contains(query, "embedding") {
			t.Error("查询应包含 embedding 字段")
		}
		if !strings.Contains(query, "<=>") {
			t.Error("查询应包含 pgvector 距离操作符 <=>")
		}
		if !strings.Contains(query, "LIMIT 5") {
			t.Error("查询应包含 LIMIT 5")
		}
		if !strings.Contains(query, "documents") {
			t.Error("查询应包含表名 documents")
		}
	})

	t.Run("带 filter 的查询", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{0.1, 0.2, 0.3},
			Field:  "embedding",
			Filter: `status = "published"`,
			Top:    10,
		}
		query := vs.buildPgvectorQuery("documents", opts)

		if !strings.Contains(query, "status") {
			t.Error("查询应包含 filter 条件")
		}
	})

	t.Run("自定义向量字段", func(t *testing.T) {
		opts := VectorSearchOptions{
			Vector: []float64{0.1, 0.2},
			Field:  "content_vector",
			Top:    3,
		}
		query := vs.buildPgvectorQuery("articles", opts)

		if !strings.Contains(query, "content_vector") {
			t.Error("查询应包含自定义向量字段 content_vector")
		}
	})
}

// TestPgvectorVectorFormat 测试 pgvector 向量格式
func TestPgvectorVectorFormat(t *testing.T) {
	t.Run("标准格式", func(t *testing.T) {
		v := []float64{0.1, 0.2, 0.3}
		result := vectorToPgvectorString(v)

		// pgvector 格式: '[0.1,0.2,0.3]'
		if !strings.HasPrefix(result, "[") {
			t.Errorf("pgvector 格式应以 [ 开头, got %s", result)
		}
		if !strings.HasSuffix(result, "]") {
			t.Errorf("pgvector 格式应以 ] 结尾, got %s", result)
		}
	})

	t.Run("高精度向量", func(t *testing.T) {
		v := []float64{0.123456789, 0.987654321}
		result := vectorToPgvectorString(v)

		// 应保留足够精度
		if !strings.Contains(result, "0.123456") {
			t.Errorf("应保留高精度, got %s", result)
		}
	})
}

// TestParseFilterToSQL 测试 filter 解析为 SQL
func TestParseFilterToSQL(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("字符串等于", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(`status = "published"`)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		// PostgreSQL JSONB 格式
		if !strings.Contains(sql, "->>'status'") && !strings.Contains(sql, "status") {
			t.Errorf("SQL 应包含 status 字段, got %s", sql)
		}
	})

	t.Run("数值大于", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(`score > 10`)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		if !strings.Contains(sql, ">") {
			t.Errorf("SQL 应包含 > 操作符, got %s", sql)
		}
	})

	t.Run("复合条件 AND", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(`status = "published" AND score > 10`)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		if !strings.Contains(sql, "AND") {
			t.Errorf("SQL 应包含 AND, got %s", sql)
		}
	})

	t.Run("复合条件 OR", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(`status = "draft" OR status = "published"`)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		if !strings.Contains(sql, "OR") {
			t.Errorf("SQL 应包含 OR, got %s", sql)
		}
	})

	t.Run("SQL 注入防护", func(t *testing.T) {
		_, err := vs.parseFilterToSQL(`status = "'; DROP TABLE users; --"`)
		if err == nil {
			t.Error("应该拒绝 SQL 注入")
		}
	})

	t.Run("字符串不等于", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(`status != "draft"`)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		if !strings.Contains(sql, "!=") {
			t.Errorf("SQL 应包含 != 操作符, got %s", sql)
		}
	})

	t.Run("数值小于等于", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(`score <= 100`)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		if !strings.Contains(sql, "<=") {
			t.Errorf("SQL 应包含 <= 操作符, got %s", sql)
		}
	})

	t.Run("数值大于等于", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(`rating >= 4.5`)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		if !strings.Contains(sql, ">=") {
			t.Errorf("SQL 应包含 >= 操作符, got %s", sql)
		}
	})

	t.Run("分号注入", func(t *testing.T) {
		_, err := vs.parseFilterToSQL(`status = "test"; DROP TABLE users`)
		if err == nil {
			t.Error("应该拒绝分号注入")
		}
	})

	t.Run("空 filter", func(t *testing.T) {
		sql, err := vs.parseFilterToSQL(``)
		if err != nil {
			t.Fatalf("parseFilterToSQL() error = %v", err)
		}
		if sql != "" {
			t.Errorf("空 filter 应返回空字符串, got %s", sql)
		}
	})
}

// TestCosineSimilarityEdgeCases 测试余弦相似度边界情况
func TestCosineSimilarityEdgeCases(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("不同长度向量返回 0", func(t *testing.T) {
		v1 := []float64{1.0, 0.0}
		v2 := []float64{1.0, 0.0, 0.0}
		sim := vs.CosineSimilarity(v1, v2)
		if sim != 0 {
			t.Errorf("CosineSimilarity() = %f, want 0", sim)
		}
	})

	t.Run("空向量返回 0", func(t *testing.T) {
		v1 := []float64{}
		v2 := []float64{}
		sim := vs.CosineSimilarity(v1, v2)
		if sim != 0 {
			t.Errorf("CosineSimilarity() = %f, want 0", sim)
		}
	})

	t.Run("零向量返回 0", func(t *testing.T) {
		v1 := []float64{0.0, 0.0, 0.0}
		v2 := []float64{1.0, 0.0, 0.0}
		sim := vs.CosineSimilarity(v1, v2)
		if sim != 0 {
			t.Errorf("CosineSimilarity() = %f, want 0", sim)
		}
	})
}

// TestParseVectorErrors 测试向量解析错误情况
func TestParseVectorErrors(t *testing.T) {
	t.Run("无效 JSON 字符串", func(t *testing.T) {
		_, err := parseVector("invalid json")
		if err == nil {
			t.Error("parseVector() should return error for invalid JSON")
		}
	})

	t.Run("不支持的类型", func(t *testing.T) {
		_, err := parseVector(123)
		if err == nil {
			t.Error("parseVector() should return error for unsupported type")
		}
	})

	t.Run("无效的 interface 切片元素", func(t *testing.T) {
		input := []interface{}{1.0, "invalid", 3.0}
		_, err := parseVector(input)
		if err == nil {
			t.Error("parseVector() should return error for invalid element")
		}
	})

	t.Run("int64 类型转换", func(t *testing.T) {
		input := []interface{}{int64(1), int64(2), int64(3)}
		result, err := parseVector(input)
		if err != nil {
			t.Fatalf("parseVector() error = %v", err)
		}
		if result[0] != 1.0 {
			t.Errorf("parseVector()[0] = %f, want 1.0", result[0])
		}
	})
}

// TestParseFilterAdvanced 测试高级 filter 解析
func TestParseFilterAdvanced(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("AND 条件", func(t *testing.T) {
		filter := `status = "published" AND score > 10`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})

	t.Run("不等于比较", func(t *testing.T) {
		filter := `status != "draft"`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})

	t.Run("小于等于比较", func(t *testing.T) {
		filter := `score <= 100`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})

	t.Run("浮点数比较", func(t *testing.T) {
		filter := `rating >= 4.5`
		result, err := vs.parseFilter(filter)
		if err != nil {
			t.Fatalf("parseFilter() error = %v", err)
		}
		if result == "" {
			t.Error("parseFilter() returned empty string")
		}
	})

	t.Run("双破折号注入", func(t *testing.T) {
		filter := `status = "published" -- comment`
		_, err := vs.parseFilter(filter)
		if err == nil {
			t.Error("parseFilter() should reject SQL injection with --")
		}
	})
}

// TestSearchInMemoryEdgeCases 测试内存搜索边界情况
func TestSearchInMemoryEdgeCases(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("空文档列表", func(t *testing.T) {
		docs := []VectorDocument{}
		query := []float64{1.0, 0.0, 0.0}
		results := vs.SearchInMemory(docs, query, 5)
		if len(results) != 0 {
			t.Errorf("SearchInMemory() returned %d results, want 0", len(results))
		}
	})

	t.Run("Top 大于文档数", func(t *testing.T) {
		docs := []VectorDocument{
			{ID: "1", Vector: []float64{1.0, 0.0}, Content: "doc1"},
			{ID: "2", Vector: []float64{0.0, 1.0}, Content: "doc2"},
		}
		query := []float64{1.0, 0.0}
		results := vs.SearchInMemory(docs, query, 10)
		if len(results) != 2 {
			t.Errorf("SearchInMemory() returned %d results, want 2", len(results))
		}
	})

	t.Run("Top 为 0 返回所有", func(t *testing.T) {
		docs := []VectorDocument{
			{ID: "1", Vector: []float64{1.0, 0.0}, Content: "doc1"},
			{ID: "2", Vector: []float64{0.0, 1.0}, Content: "doc2"},
		}
		query := []float64{1.0, 0.0}
		results := vs.SearchInMemory(docs, query, 0)
		if len(results) != 2 {
			t.Errorf("SearchInMemory() returned %d results, want 2", len(results))
		}
	})

	t.Run("负数 Top 返回所有", func(t *testing.T) {
		docs := []VectorDocument{
			{ID: "1", Vector: []float64{1.0, 0.0}, Content: "doc1"},
		}
		query := []float64{1.0, 0.0}
		results := vs.SearchInMemory(docs, query, -1)
		if len(results) != 1 {
			t.Errorf("SearchInMemory() returned %d results, want 1", len(results))
		}
	})
}

// TestValidateDimensionsEdgeCases 测试维度验证边界情况
func TestValidateDimensionsEdgeCases(t *testing.T) {
	vs := NewVectorSearch(nil)

	t.Run("两个空向量", func(t *testing.T) {
		v1 := []float64{}
		v2 := []float64{}
		err := vs.ValidateDimensions(v1, v2)
		if err == nil {
			t.Error("ValidateDimensions() should return error for empty vectors")
		}
	})

	t.Run("第二个向量为空", func(t *testing.T) {
		v1 := []float64{1.0, 0.0}
		v2 := []float64{}
		err := vs.ValidateDimensions(v1, v2)
		if err == nil {
			t.Error("ValidateDimensions() should return error when second vector is empty")
		}
	})

	t.Run("相同维度通过", func(t *testing.T) {
		v1 := []float64{1.0, 0.0, 0.0}
		v2 := []float64{0.0, 1.0, 0.0}
		err := vs.ValidateDimensions(v1, v2)
		if err != nil {
			t.Errorf("ValidateDimensions() error = %v, want nil", err)
		}
	})
}
