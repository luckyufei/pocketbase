// Package dbutils 提供数据库工具函数
package dbutils

import (
	"fmt"
	"strings"
)

// ============================================================================
// T-7.2.1: pg_trgm 扩展支持
// ============================================================================

// TrgmConfig pg_trgm 扩展配置
type TrgmConfig struct {
	// SimilarityThreshold 相似度阈值 (0-1)，默认 0.3
	SimilarityThreshold float64

	// WordSimilarityThreshold 词相似度阈值 (0-1)，默认 0.6
	WordSimilarityThreshold float64

	// StrictWordSimilarityThreshold 严格词相似度阈值 (0-1)，默认 0.5
	StrictWordSimilarityThreshold float64
}

// DefaultTrgmConfig 返回默认 pg_trgm 配置
func DefaultTrgmConfig() *TrgmConfig {
	return &TrgmConfig{
		SimilarityThreshold:           0.3,
		WordSimilarityThreshold:       0.6,
		StrictWordSimilarityThreshold: 0.5,
	}
}

// CreateTrgmExtensionSQL 返回创建 pg_trgm 扩展的 SQL
func CreateTrgmExtensionSQL() string {
	return "CREATE EXTENSION IF NOT EXISTS pg_trgm"
}

// SetThresholdSQL 返回设置阈值的 SQL
func (c *TrgmConfig) SetThresholdSQL() string {
	var sqls []string

	if c.SimilarityThreshold > 0 {
		sqls = append(sqls, fmt.Sprintf(
			"SET pg_trgm.similarity_threshold = %f",
			c.SimilarityThreshold,
		))
	}

	if c.WordSimilarityThreshold > 0 {
		sqls = append(sqls, fmt.Sprintf(
			"SET pg_trgm.word_similarity_threshold = %f",
			c.WordSimilarityThreshold,
		))
	}

	if c.StrictWordSimilarityThreshold > 0 {
		sqls = append(sqls, fmt.Sprintf(
			"SET pg_trgm.strict_word_similarity_threshold = %f",
			c.StrictWordSimilarityThreshold,
		))
	}

	return strings.Join(sqls, "; ")
}

// ============================================================================
// T-7.2.2: GIN 索引加速 LIKE 查询
// ============================================================================

// GINTrgmIndexName 生成 GIN trgm 索引名称
func GINTrgmIndexName(table string, columns ...string) string {
	colPart := strings.Join(columns, "_")
	return fmt.Sprintf("idx_%s_%s_trgm", table, colPart)
}

// CreateGINTrgmIndexSQL 生成创建 GIN trgm 索引的 SQL
func CreateGINTrgmIndexSQL(table string, columns ...string) string {
	if len(columns) == 0 {
		return ""
	}

	indexName := GINTrgmIndexName(table, columns...)

	// 为每列添加 gin_trgm_ops
	var colExprs []string
	for _, col := range columns {
		colExprs = append(colExprs, fmt.Sprintf("%s gin_trgm_ops", col))
	}

	return fmt.Sprintf(
		"CREATE INDEX %s ON %s USING GIN (%s)",
		indexName,
		table,
		strings.Join(colExprs, ", "),
	)
}

// CreateGINTrgmIndexSQLIfNotExists 生成创建 GIN trgm 索引的 SQL (如果不存在)
func CreateGINTrgmIndexSQLIfNotExists(table string, columns ...string) string {
	if len(columns) == 0 {
		return ""
	}

	indexName := GINTrgmIndexName(table, columns...)

	var colExprs []string
	for _, col := range columns {
		colExprs = append(colExprs, fmt.Sprintf("%s gin_trgm_ops", col))
	}

	return fmt.Sprintf(
		"CREATE INDEX IF NOT EXISTS %s ON %s USING GIN (%s)",
		indexName,
		table,
		strings.Join(colExprs, ", "),
	)
}

// TrgmSimilarityExpr 生成相似度查询表达式 (使用 % 操作符)
func TrgmSimilarityExpr(column, pattern string) string {
	return fmt.Sprintf("%s %% '%s'", column, escapeSingleQuote(pattern))
}

// TrgmWordSimilarityExpr 生成词相似度查询表达式 (使用 <% 操作符)
func TrgmWordSimilarityExpr(column, pattern string) string {
	return fmt.Sprintf("'%s' <%% %s", escapeSingleQuote(pattern), column)
}

// TrgmSimilarityFunc 生成相似度函数调用
func TrgmSimilarityFunc(column, pattern string) string {
	return fmt.Sprintf("similarity(%s, '%s')", column, escapeSingleQuote(pattern))
}

// TrgmILikeExpr 生成 ILIKE 表达式 (可利用 GIN 索引)
func TrgmILikeExpr(column, pattern string) string {
	return fmt.Sprintf("%s ILIKE '%s'", column, escapeSingleQuote(pattern))
}

// ============================================================================
// T-7.2.3: tsvector 全文搜索
// ============================================================================

// TSVectorConfig tsvector 配置
type TSVectorConfig struct {
	// Language 全文搜索语言配置
	// 常用值: english, simple, german, french, spanish, chinese (需要 zhparser)
	Language string

	// Weights 字段权重配置
	// A: 最高权重, B: 次高, C: 中等, D: 最低
	Weights map[string]string
}

// DefaultTSVectorConfig 返回默认 tsvector 配置
func DefaultTSVectorConfig() *TSVectorConfig {
	return &TSVectorConfig{
		Language: "english",
		Weights:  make(map[string]string),
	}
}

// CreateTSVectorColumnSQL 生成添加 tsvector 生成列的 SQL
func CreateTSVectorColumnSQL(table, vectorColumn string, sourceColumns ...string) string {
	if len(sourceColumns) == 0 {
		return ""
	}

	// 构建 to_tsvector 表达式
	var parts []string
	for _, col := range sourceColumns {
		parts = append(parts, fmt.Sprintf("COALESCE(%s, '')", col))
	}

	concatExpr := strings.Join(parts, " || ' ' || ")

	return fmt.Sprintf(
		"ALTER TABLE %s ADD COLUMN %s tsvector GENERATED ALWAYS AS (to_tsvector('english', %s)) STORED",
		table,
		vectorColumn,
		concatExpr,
	)
}

// CreateTSVectorTriggerSQL 生成 tsvector 更新触发器 SQL
func CreateTSVectorTriggerSQL(table, vectorColumn, language string, sourceColumns ...string) string {
	if len(sourceColumns) == 0 {
		return ""
	}

	triggerName := fmt.Sprintf("tsvector_update_%s_%s", table, vectorColumn)
	funcName := fmt.Sprintf("fn_%s", triggerName)

	// 构建更新表达式
	var parts []string
	weight := 'A'
	for _, col := range sourceColumns {
		parts = append(parts, fmt.Sprintf(
			"setweight(to_tsvector('%s', COALESCE(NEW.%s, '')), '%c')",
			language, col, weight,
		))
		if weight < 'D' {
			weight++
		}
	}

	vectorExpr := strings.Join(parts, " || ")

	return fmt.Sprintf(`
-- 创建触发器函数
CREATE OR REPLACE FUNCTION %s() RETURNS TRIGGER AS $$
BEGIN
    NEW.%s := %s;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS %s ON %s;
CREATE TRIGGER %s
    BEFORE INSERT OR UPDATE ON %s
    FOR EACH ROW
    EXECUTE FUNCTION %s();
`, funcName, vectorColumn, vectorExpr, triggerName, table, triggerName, table, funcName)
}

// CreateTSVectorGINIndexSQL 生成 tsvector GIN 索引 SQL
func CreateTSVectorGINIndexSQL(table, vectorColumn string) string {
	indexName := fmt.Sprintf("idx_%s_%s_gin", table, vectorColumn)
	return fmt.Sprintf(
		"CREATE INDEX IF NOT EXISTS %s ON %s USING GIN (%s)",
		indexName,
		table,
		vectorColumn,
	)
}

// TSVectorSearchExpr 生成全文搜索表达式
func TSVectorSearchExpr(vectorColumn, query, language string) string {
	return fmt.Sprintf(
		"%s @@ plainto_tsquery('%s', '%s')",
		vectorColumn,
		language,
		escapeSingleQuote(query),
	)
}

// TSVectorSearchExprWithRank 生成带排名的全文搜索表达式
func TSVectorSearchExprWithRank(vectorColumn, query, language string) string {
	return fmt.Sprintf(
		"ts_rank(%s, plainto_tsquery('%s', '%s'))",
		vectorColumn,
		language,
		escapeSingleQuote(query),
	)
}

// TSVectorWebSearchExpr 生成 websearch_to_tsquery 查询表达式
// 支持更自然的搜索语法，如 "hello -world" 表示包含 hello 但不包含 world
func TSVectorWebSearchExpr(vectorColumn, query, language string) string {
	return fmt.Sprintf(
		"%s @@ websearch_to_tsquery('%s', '%s')",
		vectorColumn,
		language,
		escapeSingleQuote(query),
	)
}

// TSVectorHighlightExpr 生成搜索结果高亮表达式
func TSVectorHighlightExpr(textColumn, query, language string) string {
	return fmt.Sprintf(
		"ts_headline('%s', %s, plainto_tsquery('%s', '%s'), 'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15')",
		language,
		textColumn,
		language,
		escapeSingleQuote(query),
	)
}

// ============================================================================
// T-7.2.4: 性能对比测试辅助
// ============================================================================

// FullTextBenchmarkConfig 全文搜索基准测试配置
type FullTextBenchmarkConfig struct {
	// RecordCount 测试记录数
	RecordCount int

	// QueryCount 测试查询数
	QueryCount int

	// SearchTerms 测试搜索词
	SearchTerms []string
}

// DefaultFullTextBenchmarkConfig 返回默认基准测试配置
func DefaultFullTextBenchmarkConfig() *FullTextBenchmarkConfig {
	return &FullTextBenchmarkConfig{
		RecordCount: 10000,
		QueryCount:  100,
		SearchTerms: []string{"hello", "world", "test", "search", "example"},
	}
}

// GenerateLikeQuery 生成 LIKE 查询
func GenerateLikeQuery(table, column, pattern string) string {
	return fmt.Sprintf(
		"SELECT * FROM %s WHERE %s LIKE '%s'",
		table,
		column,
		escapeSingleQuote(pattern),
	)
}

// GenerateILikeQuery 生成 ILIKE 查询
func GenerateILikeQuery(table, column, pattern string) string {
	return fmt.Sprintf(
		"SELECT * FROM %s WHERE %s ILIKE '%s'",
		table,
		column,
		escapeSingleQuote(pattern),
	)
}

// GenerateTrgmQuery 生成 pg_trgm 相似度查询
func GenerateTrgmQuery(table, column, term string) string {
	return fmt.Sprintf(
		"SELECT *, similarity(%s, '%s') AS sim FROM %s WHERE %s %% '%s' ORDER BY sim DESC",
		column,
		escapeSingleQuote(term),
		table,
		column,
		escapeSingleQuote(term),
	)
}

// GenerateTSVectorQuery 生成 tsvector 全文搜索查询
func GenerateTSVectorQuery(table, vectorColumn, query, language string) string {
	return fmt.Sprintf(
		"SELECT *, ts_rank(%s, q) AS rank FROM %s, plainto_tsquery('%s', '%s') q WHERE %s @@ q ORDER BY rank DESC",
		vectorColumn,
		table,
		language,
		escapeSingleQuote(query),
		vectorColumn,
	)
}

// ============================================================================
// 辅助函数
// ============================================================================

// EscapeLikePattern 转义 LIKE 模式中的特殊字符
func EscapeLikePattern(pattern string) string {
	// 转义 %, _, \
	pattern = strings.ReplaceAll(pattern, "\\", "\\\\")
	pattern = strings.ReplaceAll(pattern, "%", "\\%")
	pattern = strings.ReplaceAll(pattern, "_", "\\_")
	return pattern
}

// BuildTSQuery 构建 tsquery
func BuildTSQuery(text, language string) string {
	// 简单实现：将空格分隔的词用 & 连接
	words := strings.Fields(text)
	if len(words) == 0 {
		return ""
	}

	var parts []string
	for _, word := range words {
		parts = append(parts, escapeSingleQuote(word))
	}

	return fmt.Sprintf("to_tsquery('%s', '%s')", language, strings.Join(parts, " & "))
}

// escapeSingleQuote 转义单引号
func escapeSingleQuote(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}
