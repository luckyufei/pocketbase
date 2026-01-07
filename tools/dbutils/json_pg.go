// Package dbutils 提供数据库工具函数
package dbutils

import (
	"fmt"
	"regexp"
	"strings"
)

// JSONEachPG 返回 PostgreSQL 兼容的 JSON 数组展开表达式
// 等价于 SQLite 的 json_each
func JSONEachPG(column string) string {
	// PostgreSQL 使用 jsonb_array_elements
	// 需要处理非数组情况
	return fmt.Sprintf(
		`jsonb_array_elements(CASE WHEN jsonb_typeof([[%s]]::jsonb) = 'array' THEN [[%s]]::jsonb ELSE jsonb_build_array([[%s]]) END)`,
		column, column, column,
	)
}

// JSONArrayLengthPG 返回 PostgreSQL 兼容的 JSON 数组长度表达式
// 等价于 SQLite 的 json_array_length
func JSONArrayLengthPG(column string) string {
	return fmt.Sprintf(
		`jsonb_array_length(CASE WHEN jsonb_typeof([[%s]]::jsonb) = 'array' THEN [[%s]]::jsonb ELSE (CASE WHEN [[%s]] = '' OR [[%s]] IS NULL THEN '[]'::jsonb ELSE jsonb_build_array([[%s]]) END) END)`,
		column, column, column, column, column,
	)
}

// JSONExtractPG 返回 PostgreSQL 兼容的 JSON 提取表达式
// 使用 jsonb_path_query_first (PostgreSQL 12+) 替代 JSON_QUERY (PostgreSQL 17+)
func JSONExtractPG(column string, path string) string {
	if path == "" {
		// 空路径，返回整个 JSON
		return fmt.Sprintf(
			"(CASE WHEN [[%s]] IS NOT NULL AND [[%s]]::text <> '' THEN [[%s]]::jsonb ELSE to_jsonb([[%s]]) END)",
			column, column, column, column,
		)
	}

	// 转换 JSON 路径格式
	// SQLite: $.a.b[0].c -> PostgreSQL jsonpath: $.a.b[0].c
	jsonPath := convertToJSONPath(path)

	return fmt.Sprintf(
		"(CASE WHEN pb_is_json([[%s]]) THEN jsonb_path_query_first([[%s]]::jsonb, '%s') ELSE jsonb_path_query_first(jsonb_build_object('pb', [[%s]]), '$.pb%s') END)",
		column,
		column,
		jsonPath,
		column,
		path,
	)
}

// JSONExtractTextPG 返回 PostgreSQL 兼容的 JSON 提取文本表达式
// 返回文本而非 JSON 值
func JSONExtractTextPG(column string, path string) string {
	if path == "" {
		return fmt.Sprintf("([[%s]]::jsonb #>> '{}')", column)
	}

	// 转换路径为 PostgreSQL 数组格式
	pathArray := convertPathToArray(path)

	return fmt.Sprintf(
		"(CASE WHEN pb_is_json([[%s]]) THEN [[%s]]::jsonb #>> '%s' ELSE (jsonb_build_object('pb', [[%s]]) #>> '{pb,%s}') END)",
		column,
		column,
		pathArray,
		column,
		strings.Trim(pathArray, "{}"),
	)
}

// convertToJSONPath 将点分隔的路径转换为 JSONPath 格式
// 输入: "a.b[0].c" 或 "[0].a.b"
// 输出: "$.a.b[0].c" 或 "$[0].a.b"
func convertToJSONPath(path string) string {
	if path == "" {
		return "$"
	}

	// 如果已经以 $ 开头，直接返回
	if strings.HasPrefix(path, "$") {
		return path
	}

	// 如果以 [ 开头（数组索引），直接添加 $
	if strings.HasPrefix(path, "[") {
		return "$" + path
	}

	// 否则添加 $.
	return "$." + path
}

// convertPathToArray 将点分隔的路径转换为 PostgreSQL 数组格式
// 输入: "a.b[0].c"
// 输出: "{a,b,0,c}"
func convertPathToArray(path string) string {
	if path == "" {
		return "{}"
	}

	// 移除开头的点
	path = strings.TrimPrefix(path, ".")

	// 分割路径
	parts := splitJSONPath(path)

	return "{" + strings.Join(parts, ",") + "}"
}

// splitJSONPath 分割 JSON 路径为各个部分
// 输入: "a.b[0].c[1][2]"
// 输出: ["a", "b", "0", "c", "1", "2"]
func splitJSONPath(path string) []string {
	var parts []string

	// 正则匹配：标识符或数组索引
	re := regexp.MustCompile(`([^.\[\]]+)|\[(\d+)\]`)
	matches := re.FindAllStringSubmatch(path, -1)

	for _, match := range matches {
		if match[1] != "" {
			parts = append(parts, match[1])
		} else if match[2] != "" {
			parts = append(parts, match[2])
		}
	}

	return parts
}

// JSONContainsPG 返回 PostgreSQL 的 JSON 包含检查表达式
// 等价于检查 JSON 数组是否包含某个值
func JSONContainsPG(column string, value string) string {
	return fmt.Sprintf("[[%s]]::jsonb @> %s::jsonb", column, value)
}

// JSONExistsPG 返回 PostgreSQL 的 JSON 键存在检查表达式
func JSONExistsPG(column string, key string) string {
	return fmt.Sprintf("[[%s]]::jsonb ? %s", column, key)
}

// JSONTypePG 返回 PostgreSQL 的 JSON 类型检查表达式
func JSONTypePG(column string) string {
	return fmt.Sprintf("jsonb_typeof([[%s]]::jsonb)", column)
}

// JSONValidPG 返回 PostgreSQL 的 JSON 有效性检查表达式
// PostgreSQL 没有直接的 json_valid 函数，使用 try-catch 模式
func JSONValidPG(column string) string {
	return fmt.Sprintf("pb_is_json([[%s]])", column)
}

// CreatePGHelperFunctions 返回创建 PostgreSQL 辅助函数的 SQL
func CreatePGHelperFunctions() string {
	return `
-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pb_is_json: 检查字符串是否为有效 JSON
CREATE OR REPLACE FUNCTION pb_is_json(text_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF text_value IS NULL OR text_value = '' THEN
        RETURN FALSE;
    END IF;
    PERFORM text_value::jsonb;
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- pb_json_extract: 兼容 SQLite json_extract 的函数
CREATE OR REPLACE FUNCTION pb_json_extract(json_value JSONB, path TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF json_value IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- 使用 jsonb_path_query_first 提取值
    EXECUTE format('SELECT jsonb_path_query_first($1, %L)', path)
    INTO result
    USING json_value;
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- pb_json_each: 兼容 SQLite json_each 的函数
CREATE OR REPLACE FUNCTION pb_json_each(json_value JSONB)
RETURNS TABLE(key TEXT, value JSONB) AS $$
BEGIN
    IF jsonb_typeof(json_value) = 'array' THEN
        RETURN QUERY SELECT NULL::TEXT, elem FROM jsonb_array_elements(json_value) AS elem;
    ELSE
        RETURN QUERY SELECT k, v FROM jsonb_each(json_value) AS x(k, v);
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- pb_json_array_length: 兼容 SQLite json_array_length 的函数
CREATE OR REPLACE FUNCTION pb_json_array_length(json_value JSONB)
RETURNS INTEGER AS $$
BEGIN
    IF json_value IS NULL THEN
        RETURN 0;
    END IF;
    
    IF jsonb_typeof(json_value) = 'array' THEN
        RETURN jsonb_array_length(json_value);
    ELSE
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- uuid_generate_v7: UUID v7 生成函数 (如果不存在)
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS UUID AS $$
DECLARE
    unix_ts_ms BYTEA;
    uuid_bytes BYTEA;
BEGIN
    unix_ts_ms = substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
    uuid_bytes = unix_ts_ms || gen_random_bytes(10);
    uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
    uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
    RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;
`
}
