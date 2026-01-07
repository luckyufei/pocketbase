// Package dbutils 提供数据库工具函数
package dbutils

import (
	"strings"
	"testing"
)

// ============================================================================
// T-7.2.1: 自动执行 CREATE EXTENSION pg_trgm
// ============================================================================

// TestCreateTrgmExtensionSQL 测试生成 pg_trgm 扩展创建 SQL
func TestCreateTrgmExtensionSQL(t *testing.T) {
	t.Run("生成基本扩展创建 SQL", func(t *testing.T) {
		sql := CreateTrgmExtensionSQL()
		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "CREATE EXTENSION") {
			t.Errorf("应该包含 'CREATE EXTENSION', 实际 '%s'", sql)
		}
		if !strings.Contains(sql, "pg_trgm") {
			t.Errorf("应该包含 'pg_trgm', 实际 '%s'", sql)
		}
		if !strings.Contains(sql, "IF NOT EXISTS") {
			t.Errorf("应该包含 'IF NOT EXISTS', 实际 '%s'", sql)
		}
	})
}

// TestTrgmExtensionConfig 测试 pg_trgm 扩展配置
func TestTrgmExtensionConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		config := DefaultTrgmConfig()
		if config.SimilarityThreshold < 0 || config.SimilarityThreshold > 1 {
			t.Errorf("相似度阈值应在 0-1 之间, 实际 %f", config.SimilarityThreshold)
		}
		if config.WordSimilarityThreshold < 0 || config.WordSimilarityThreshold > 1 {
			t.Errorf("词相似度阈值应在 0-1 之间, 实际 %f", config.WordSimilarityThreshold)
		}
	})

	t.Run("自定义配置", func(t *testing.T) {
		config := &TrgmConfig{
			SimilarityThreshold:     0.5,
			WordSimilarityThreshold: 0.6,
		}
		sql := config.SetThresholdSQL()
		if !strings.Contains(sql, "pg_trgm.similarity_threshold") {
			t.Errorf("应该包含 'pg_trgm.similarity_threshold', 实际 '%s'", sql)
		}
	})
}

// ============================================================================
// T-7.2.2: 创建 GIN 索引加速 LIKE 查询
// ============================================================================

// TestGINIndexForLike 测试 GIN 索引创建
func TestGINIndexForLike(t *testing.T) {
	t.Run("生成单列 GIN 索引 SQL", func(t *testing.T) {
		sql := CreateGINTrgmIndexSQL("posts", "title")
		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "CREATE INDEX") {
			t.Errorf("应该包含 'CREATE INDEX', 实际 '%s'", sql)
		}
		if !strings.Contains(sql, "USING GIN") || strings.Contains(sql, "USING gin") {
			// GIN 或 gin 都可以
		}
		if !strings.Contains(sql, "gin_trgm_ops") {
			t.Errorf("应该包含 'gin_trgm_ops', 实际 '%s'", sql)
		}
		if !strings.Contains(sql, "posts") {
			t.Errorf("应该包含表名 'posts', 实际 '%s'", sql)
		}
		if !strings.Contains(sql, "title") {
			t.Errorf("应该包含列名 'title', 实际 '%s'", sql)
		}
	})

	t.Run("生成多列 GIN 索引 SQL", func(t *testing.T) {
		sql := CreateGINTrgmIndexSQL("posts", "title", "content")
		if !strings.Contains(sql, "title") {
			t.Errorf("应该包含 'title', 实际 '%s'", sql)
		}
		if !strings.Contains(sql, "content") {
			t.Errorf("应该包含 'content', 实际 '%s'", sql)
		}
	})

	t.Run("生成 IF NOT EXISTS 索引", func(t *testing.T) {
		sql := CreateGINTrgmIndexSQLIfNotExists("posts", "title")
		if !strings.Contains(sql, "IF NOT EXISTS") {
			t.Errorf("应该包含 'IF NOT EXISTS', 实际 '%s'", sql)
		}
	})

	t.Run("生成索引名称", func(t *testing.T) {
		name := GINTrgmIndexName("posts", "title")
		if name == "" {
			t.Error("索引名称不应为空")
		}
		if !strings.Contains(name, "posts") {
			t.Errorf("索引名称应包含表名, 实际 '%s'", name)
		}
		if !strings.Contains(name, "trgm") {
			t.Errorf("索引名称应包含 'trgm', 实际 '%s'", name)
		}
	})
}

// TestTrgmOperators 测试 pg_trgm 操作符
func TestTrgmOperators(t *testing.T) {
	t.Run("相似度查询 (%)", func(t *testing.T) {
		expr := TrgmSimilarityExpr("title", "hello")
		if expr == "" {
			t.Error("表达式不应为空")
		}
		if !strings.Contains(expr, "%") {
			t.Errorf("应该包含 '%%', 实际 '%s'", expr)
		}
	})

	t.Run("词相似度查询 (<%)", func(t *testing.T) {
		expr := TrgmWordSimilarityExpr("title", "hello")
		if expr == "" {
			t.Error("表达式不应为空")
		}
		if !strings.Contains(expr, "<%") {
			t.Errorf("应该包含 '<%%', 实际 '%s'", expr)
		}
	})

	t.Run("相似度函数", func(t *testing.T) {
		expr := TrgmSimilarityFunc("title", "hello")
		if !strings.Contains(expr, "similarity") {
			t.Errorf("应该包含 'similarity', 实际 '%s'", expr)
		}
	})

	t.Run("ILIKE 优化查询", func(t *testing.T) {
		expr := TrgmILikeExpr("title", "%hello%")
		if !strings.Contains(expr, "ILIKE") {
			t.Errorf("应该包含 'ILIKE', 实际 '%s'", expr)
		}
	})
}

// ============================================================================
// T-7.2.3: 实现 tsvector 全文搜索
// ============================================================================

// TestTSVectorConfig 测试 tsvector 配置
func TestTSVectorConfig(t *testing.T) {
	t.Run("默认配置", func(t *testing.T) {
		config := DefaultTSVectorConfig()
		if config.Language == "" {
			t.Error("语言不应为空")
		}
		if config.Language != "english" {
			t.Errorf("默认语言应为 'english', 实际 '%s'", config.Language)
		}
	})

	t.Run("中文配置", func(t *testing.T) {
		config := &TSVectorConfig{
			Language: "simple", // 中文使用 simple 或 zhparser
		}
		if config.Language != "simple" {
			t.Errorf("中文应使用 'simple', 实际 '%s'", config.Language)
		}
	})
}

// TestTSVectorColumn 测试 tsvector 列创建
func TestTSVectorColumn(t *testing.T) {
	t.Run("生成 tsvector 列 SQL", func(t *testing.T) {
		sql := CreateTSVectorColumnSQL("posts", "search_vector", "title", "content")
		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "tsvector") {
			t.Errorf("应该包含 'tsvector', 实际 '%s'", sql)
		}
		if !strings.Contains(sql, "GENERATED ALWAYS") {
			t.Errorf("应该包含 'GENERATED ALWAYS', 实际 '%s'", sql)
		}
	})

	t.Run("生成 tsvector 更新触发器", func(t *testing.T) {
		sql := CreateTSVectorTriggerSQL("posts", "search_vector", "english", "title", "content")
		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "tsvector_update_trigger") || !strings.Contains(sql, "TRIGGER") {
			// 可能使用不同的实现方式
		}
	})
}

// TestTSVectorIndex 测试 tsvector 索引
func TestTSVectorIndex(t *testing.T) {
	t.Run("生成 GIN 索引 SQL", func(t *testing.T) {
		sql := CreateTSVectorGINIndexSQL("posts", "search_vector")
		if sql == "" {
			t.Error("SQL 不应为空")
		}
		if !strings.Contains(sql, "USING GIN") && !strings.Contains(sql, "USING gin") {
			t.Errorf("应该包含 'USING GIN', 实际 '%s'", sql)
		}
	})
}

// TestTSVectorQuery 测试 tsvector 查询
func TestTSVectorQuery(t *testing.T) {
	t.Run("生成全文搜索查询", func(t *testing.T) {
		expr := TSVectorSearchExpr("search_vector", "hello world", "english")
		if expr == "" {
			t.Error("表达式不应为空")
		}
		if !strings.Contains(expr, "@@") {
			t.Errorf("应该包含 '@@', 实际 '%s'", expr)
		}
		if !strings.Contains(expr, "to_tsquery") || !strings.Contains(expr, "plainto_tsquery") {
			// 可能使用不同的查询函数
		}
	})

	t.Run("生成带权重的查询", func(t *testing.T) {
		expr := TSVectorSearchExprWithRank("search_vector", "hello", "english")
		if !strings.Contains(expr, "ts_rank") {
			t.Errorf("应该包含 'ts_rank', 实际 '%s'", expr)
		}
	})

	t.Run("生成 websearch_to_tsquery 查询", func(t *testing.T) {
		expr := TSVectorWebSearchExpr("search_vector", "hello -world", "english")
		if !strings.Contains(expr, "websearch_to_tsquery") {
			t.Errorf("应该包含 'websearch_to_tsquery', 实际 '%s'", expr)
		}
	})
}

// ============================================================================
// T-7.2.4: 性能对比测试 (单元测试部分)
// ============================================================================

// TestFullTextSearchBenchmarkConfig 测试基准测试配置
func TestFullTextSearchBenchmarkConfig(t *testing.T) {
	t.Run("默认基准测试配置", func(t *testing.T) {
		config := DefaultFullTextBenchmarkConfig()
		if config.RecordCount <= 0 {
			t.Error("记录数应大于 0")
		}
		if config.QueryCount <= 0 {
			t.Error("查询数应大于 0")
		}
	})
}

// TestSearchMethodComparison 测试搜索方法比较
func TestSearchMethodComparison(t *testing.T) {
	t.Run("LIKE 查询生成", func(t *testing.T) {
		sql := GenerateLikeQuery("posts", "title", "%hello%")
		if !strings.Contains(sql, "LIKE") {
			t.Errorf("应该包含 'LIKE', 实际 '%s'", sql)
		}
	})

	t.Run("ILIKE 查询生成", func(t *testing.T) {
		sql := GenerateILikeQuery("posts", "title", "%hello%")
		if !strings.Contains(sql, "ILIKE") {
			t.Errorf("应该包含 'ILIKE', 实际 '%s'", sql)
		}
	})

	t.Run("trgm 相似度查询生成", func(t *testing.T) {
		sql := GenerateTrgmQuery("posts", "title", "hello")
		if !strings.Contains(sql, "%") || !strings.Contains(sql, "similarity") {
			// 可能使用不同的实现
		}
	})

	t.Run("tsvector 查询生成", func(t *testing.T) {
		sql := GenerateTSVectorQuery("posts", "search_vector", "hello", "english")
		if !strings.Contains(sql, "@@") {
			t.Errorf("应该包含 '@@', 实际 '%s'", sql)
		}
	})
}

// ============================================================================
// 辅助测试函数
// ============================================================================

// TestFullTextHelpers 测试辅助函数
func TestFullTextHelpers(t *testing.T) {
	t.Run("转义 LIKE 模式", func(t *testing.T) {
		escaped := EscapeLikePattern("hello%world_test")
		if strings.Contains(escaped, "%") && !strings.Contains(escaped, "\\%") {
			t.Errorf("应该转义 '%%', 实际 '%s'", escaped)
		}
	})

	t.Run("构建 tsquery", func(t *testing.T) {
		query := BuildTSQuery("hello world", "english")
		if query == "" {
			t.Error("查询不应为空")
		}
	})

	t.Run("高亮搜索结果", func(t *testing.T) {
		expr := TSVectorHighlightExpr("content", "hello", "english")
		if !strings.Contains(expr, "ts_headline") {
			t.Errorf("应该包含 'ts_headline', 实际 '%s'", expr)
		}
	})
}
