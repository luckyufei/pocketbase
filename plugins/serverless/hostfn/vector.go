// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// VectorDocument 表示带向量的文档
type VectorDocument struct {
	ID      string
	Vector  []float64
	Content string
	Data    map[string]interface{}
}

// VectorSearchResult 表示向量搜索结果
type VectorSearchResult struct {
	ID    string
	Score float64
	Data  map[string]interface{}
}

// VectorSearchOptions 向量搜索选项
type VectorSearchOptions struct {
	Vector []float64
	Field  string
	Filter string
	Top    int
}

// DefaultVectorSearchOptions 返回默认向量搜索选项
func DefaultVectorSearchOptions() VectorSearchOptions {
	return VectorSearchOptions{
		Field: "embedding",
		Top:   10,
	}
}

// VectorSearch 向量搜索服务
type VectorSearch struct {
	app        core.App
	usePgvector bool
}

// NewVectorSearch 创建向量搜索服务
func NewVectorSearch(app core.App) *VectorSearch {
	vs := &VectorSearch{app: app}
	// 检测是否使用 PostgreSQL
	if app != nil {
		vs.usePgvector = vs.detectPgvector()
	}
	return vs
}

// detectPgvector 检测是否支持 pgvector
func (vs *VectorSearch) detectPgvector() bool {
	if vs.app == nil {
		return false
	}

	// 检查是否是 PostgreSQL
	if !vs.app.IsPostgres() {
		return false
	}

	// 检查 pgvector 扩展是否安装
	var extName string
	err := vs.app.DB().NewQuery("SELECT extname FROM pg_extension WHERE extname = 'vector'").Row(&extName)
	if err != nil || extName == "" {
		return false
	}

	return true
}

// Search 执行向量搜索
func (vs *VectorSearch) Search(collection string, opts VectorSearchOptions) ([]VectorSearchResult, error) {
	if len(opts.Vector) == 0 {
		return nil, errors.New("查询向量不能为空")
	}

	if opts.Top <= 0 {
		opts.Top = 10
	}

	if opts.Field == "" {
		opts.Field = "embedding"
	}

	// 根据数据库类型选择搜索方式
	if vs.usePgvector {
		return vs.searchWithPgvector(collection, opts)
	}
	return vs.searchWithSQLite(collection, opts)
}

// searchWithPgvector 使用 PostgreSQL pgvector 进行向量搜索
// T045: PostgreSQL pgvector 查询实现
func (vs *VectorSearch) searchWithPgvector(collection string, opts VectorSearchOptions) ([]VectorSearchResult, error) {
	if vs.app == nil {
		return nil, errors.New("app not initialized")
	}

	// 构建 SQL 查询
	query := vs.buildPgvectorQuery(collection, opts)

	// 执行查询
	results := make([]VectorSearchResult, 0, opts.Top)

	// 使用 PocketBase 的 DB 接口执行原生 SQL
	rows, err := vs.app.DB().NewQuery(query).Rows()
	if err != nil {
		return nil, fmt.Errorf("pgvector query failed: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id string
		var score float64
		var dataJSON string

		if err := rows.Scan(&id, &score, &dataJSON); err != nil {
			continue
		}

		// 解析 data JSON
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(dataJSON), &data); err != nil {
			data = make(map[string]interface{})
		}

		results = append(results, VectorSearchResult{
			ID:    id,
			Score: score,
			Data:  data,
		})
	}

	return results, nil
}

// searchWithSQLite 使用 SQLite 内存计算进行向量搜索
func (vs *VectorSearch) searchWithSQLite(collection string, opts VectorSearchOptions) ([]VectorSearchResult, error) {
	if vs.app == nil {
		return nil, errors.New("app not initialized")
	}

	// 获取集合中的所有记录
	records, err := vs.app.FindRecordsByFilter(collection, "", "", 0, 0)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch records: %w", err)
	}

	// 构建文档列表
	docs := make([]VectorDocument, 0, len(records))
	for _, record := range records {
		// 获取向量字段
		vectorData := record.Get(opts.Field)
		if vectorData == nil {
			continue
		}

		// 解析向量
		vector, err := parseVector(vectorData)
		if err != nil {
			continue
		}

		// T047: 应用 filter 条件
		if opts.Filter != "" {
			if !vs.matchFilter(record, opts.Filter) {
				continue
			}
		}

		docs = append(docs, VectorDocument{
			ID:     record.Id,
			Vector: vector,
			Data:   record.PublicExport(),
		})
	}

	// 在内存中进行向量搜索
	return vs.SearchInMemory(docs, opts.Vector, opts.Top), nil
}

// parseVector 解析向量数据
func parseVector(data interface{}) ([]float64, error) {
	switch v := data.(type) {
	case []float64:
		return v, nil
	case []interface{}:
		result := make([]float64, len(v))
		for i, val := range v {
			switch n := val.(type) {
			case float64:
				result[i] = n
			case int:
				result[i] = float64(n)
			case int64:
				result[i] = float64(n)
			default:
				return nil, fmt.Errorf("invalid vector element type at index %d", i)
			}
		}
		return result, nil
	case string:
		// JSON 格式的向量
		var result []float64
		if err := json.Unmarshal([]byte(v), &result); err != nil {
			return nil, err
		}
		return result, nil
	default:
		return nil, fmt.Errorf("unsupported vector type: %T", data)
	}
}

// vectorToString 将向量转换为 pgvector 格式字符串
func vectorToString(v []float64) string {
	parts := make([]string, len(v))
	for i, val := range v {
		parts[i] = fmt.Sprintf("%f", val)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

// vectorToPgvectorString 将向量转换为 pgvector 高精度格式字符串
// T045: PostgreSQL pgvector 查询实现
func vectorToPgvectorString(v []float64) string {
	parts := make([]string, len(v))
	for i, val := range v {
		// 使用更高精度格式，保留 9 位小数
		parts[i] = fmt.Sprintf("%.9f", val)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

// buildPgvectorQuery 构建 pgvector SQL 查询
// T045: PostgreSQL pgvector 查询实现
func (vs *VectorSearch) buildPgvectorQuery(collection string, opts VectorSearchOptions) string {
	vectorStr := vectorToPgvectorString(opts.Vector)

	// 构建基础查询
	// pgvector 使用 <=> 操作符计算余弦距离
	// 余弦相似度 = 1 - 余弦距离
	query := fmt.Sprintf(`
		SELECT id, (1 - (%s <=> '%s'::vector)) as score, data
		FROM %s
		WHERE 1=1
	`, opts.Field, vectorStr, collection)

	// 添加 filter 条件
	if opts.Filter != "" {
		filterSQL, err := vs.parseFilterToSQL(opts.Filter)
		if err == nil && filterSQL != "" {
			query += " AND " + filterSQL
		}
	}

	// 添加排序和限制
	query += fmt.Sprintf(" ORDER BY %s <=> '%s'::vector LIMIT %d", opts.Field, vectorStr, opts.Top)

	return query
}

// parseFilterToSQL 解析 filter 字符串为 PostgreSQL SQL WHERE 子句
// T047: filter 条件支持
func (vs *VectorSearch) parseFilterToSQL(filter string) (string, error) {
	// 验证 filter 不包含危险字符（SQL 注入防护）
	if strings.Contains(filter, ";") || strings.Contains(filter, "--") {
		return "", errors.New("invalid filter: potential SQL injection")
	}

	// 检查引号内是否包含危险字符
	// 匹配引号内的内容
	quoteRe := regexp.MustCompile(`"([^"]*)"`)
	matches := quoteRe.FindAllStringSubmatch(filter, -1)
	for _, match := range matches {
		if len(match) > 1 {
			content := match[1]
			if strings.Contains(content, "'") || strings.Contains(content, ";") || strings.Contains(content, "--") {
				return "", errors.New("invalid filter: potential SQL injection in quoted value")
			}
		}
	}

	result := filter

	// 替换字符串比较: field = "value" -> data->>'field' = 'value'
	reStr := regexp.MustCompile(`(\w+)\s*=\s*"([^"]*)"`)
	result = reStr.ReplaceAllString(result, "data->>'$1' = '$2'")

	// 替换字符串不等于: field != "value" -> data->>'field' != 'value'
	reStrNe := regexp.MustCompile(`(\w+)\s*!=\s*"([^"]*)"`)
	result = reStrNe.ReplaceAllString(result, "data->>'$1' != '$2'")

	// 替换数值比较: field > 10 -> (data->>'field')::numeric > 10
	reNum := regexp.MustCompile(`(\w+)\s*(>=|<=|>|<)\s*(\d+(?:\.\d+)?)`)
	result = reNum.ReplaceAllString(result, "(data->>'$1')::numeric $2 $3")

	return result, nil
}

// parseFilter 解析 filter 字符串为 SQL WHERE 子句
// T047: filter 条件支持
func (vs *VectorSearch) parseFilter(filter string) (string, error) {
	// 支持的格式:
	// - field = "value"
	// - field != "value"
	// - field > 10
	// - field >= 10
	// - field < 10
	// - field <= 10
	// - field = "value" AND field2 > 10
	// - field = "value" OR field2 > 10

	// 简单的 filter 解析器
	// 实际生产环境应该使用更完善的解析器

	// 验证 filter 不包含危险字符
	if strings.Contains(filter, ";") || strings.Contains(filter, "--") {
		return "", errors.New("invalid filter: potential SQL injection")
	}

	// 将 PocketBase 风格的 filter 转换为 SQL
	// 例如: status = "published" -> data->>'status' = 'published'
	result := filter

	// 替换字符串比较
	// field = "value" -> data->>'field' = 'value'
	re := regexp.MustCompile(`(\w+)\s*=\s*"([^"]*)"`)
	result = re.ReplaceAllString(result, "data->>'$1' = '$2'")

	// 替换数值比较
	// field > 10 -> (data->>'field')::numeric > 10
	reNum := regexp.MustCompile(`(\w+)\s*(>=|<=|>|<)\s*(\d+(?:\.\d+)?)`)
	result = reNum.ReplaceAllString(result, "(data->>'$1')::numeric $2 $3")

	return result, nil
}

// matchFilter 检查记录是否匹配 filter 条件（用于 SQLite fallback）
// T047: filter 条件支持
func (vs *VectorSearch) matchFilter(record *core.Record, filter string) bool {
	// 简单的 filter 匹配器
	// 支持: field = "value", field != "value", field > 10 等

	// 解析 AND 条件
	conditions := strings.Split(filter, " AND ")
	for _, cond := range conditions {
		cond = strings.TrimSpace(cond)
		if cond == "" {
			continue
		}

		// 解析 OR 条件（简化处理，只支持单层 OR）
		orConditions := strings.Split(cond, " OR ")
		orMatch := false
		for _, orCond := range orConditions {
			if vs.matchSingleCondition(record, strings.TrimSpace(orCond)) {
				orMatch = true
				break
			}
		}
		if !orMatch {
			return false
		}
	}
	return true
}

// matchSingleCondition 匹配单个条件
func (vs *VectorSearch) matchSingleCondition(record *core.Record, cond string) bool {
	// 解析条件: field operator value
	// 支持的操作符: =, !=, >, >=, <, <=

	// 尝试匹配字符串比较: field = "value" 或 field != "value"
	reStr := regexp.MustCompile(`(\w+)\s*(=|!=)\s*"([^"]*)"`)
	if matches := reStr.FindStringSubmatch(cond); len(matches) == 4 {
		field, op, value := matches[1], matches[2], matches[3]
		recordValue := fmt.Sprintf("%v", record.Get(field))
		switch op {
		case "=":
			return recordValue == value
		case "!=":
			return recordValue != value
		}
	}

	// 尝试匹配数值比较: field > 10
	reNum := regexp.MustCompile(`(\w+)\s*(>=|<=|>|<|=|!=)\s*(\d+(?:\.\d+)?)`)
	if matches := reNum.FindStringSubmatch(cond); len(matches) == 4 {
		field, op, valueStr := matches[1], matches[2], matches[3]
		recordValue := record.Get(field)
		if recordValue == nil {
			return false
		}

		var recordNum float64
		switch v := recordValue.(type) {
		case float64:
			recordNum = v
		case int:
			recordNum = float64(v)
		case int64:
			recordNum = float64(v)
		default:
			return false
		}

		var compareNum float64
		fmt.Sscanf(valueStr, "%f", &compareNum)

		switch op {
		case "=":
			return recordNum == compareNum
		case "!=":
			return recordNum != compareNum
		case ">":
			return recordNum > compareNum
		case ">=":
			return recordNum >= compareNum
		case "<":
			return recordNum < compareNum
		case "<=":
			return recordNum <= compareNum
		}
	}

	return true // 无法解析的条件默认通过
}

// CosineSimilarity 计算两个向量的余弦相似度
func (vs *VectorSearch) CosineSimilarity(v1, v2 []float64) float64 {
	if len(v1) != len(v2) || len(v1) == 0 {
		return 0
	}

	var dotProduct, norm1, norm2 float64
	for i := range v1 {
		dotProduct += v1[i] * v2[i]
		norm1 += v1[i] * v1[i]
		norm2 += v2[i] * v2[i]
	}

	if norm1 == 0 || norm2 == 0 {
		return 0
	}

	return dotProduct / (math.Sqrt(norm1) * math.Sqrt(norm2))
}

// ValidateDimensions 验证向量维度
func (vs *VectorSearch) ValidateDimensions(v1, v2 []float64) error {
	if len(v1) == 0 {
		return errors.New("向量不能为空")
	}
	if len(v2) == 0 {
		return errors.New("向量不能为空")
	}
	if len(v1) != len(v2) {
		return errors.New("向量维度不匹配")
	}
	return nil
}

// SearchInMemory 在内存中进行向量搜索（SQLite fallback）
func (vs *VectorSearch) SearchInMemory(docs []VectorDocument, query []float64, top int) []VectorSearchResult {
	results := make([]VectorSearchResult, 0, len(docs))

	for _, doc := range docs {
		score := vs.CosineSimilarity(doc.Vector, query)
		results = append(results, VectorSearchResult{
			ID:    doc.ID,
			Score: score,
			Data:  doc.Data,
		})
	}

	// 按分数降序排序
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	// 返回 top N
	if top > 0 && top < len(results) {
		results = results[:top]
	}

	return results
}

// SortByScore 按分数降序排序
func SortByScore(results []VectorSearchResult) []VectorSearchResult {
	sorted := make([]VectorSearchResult, len(results))
	copy(sorted, results)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Score > sorted[j].Score
	})
	return sorted
}
