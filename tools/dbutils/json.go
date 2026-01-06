package dbutils

import (
	"fmt"
	"strings"

	"github.com/pocketbase/dbx"
)

// TODO: replace json with `jsonb` everywhere in the codebase
// TODO: Use PostgreSQL's native JSON functions instead of manually simulate JSON functions like SQLite.

// JSONEach returns JSON_EACH SQLite string expression with
// some normalizations for non-json columns.
func JSONEach(column string) string {
	// note: we are not using the new and shorter "if(x,y)" syntax for
	// compatibility with custom drivers that use older SQLite version
	/* SQLite:
	return fmt.Sprintf(
		`json_each(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) THEN [[%s]] ELSE json_array([[%s]]) END)`,
		column, column, column, column,
	)
	*/
	// PostgreSQL:
	return fmt.Sprintf(
		`jsonb_array_elements_text(CASE WHEN ([[%s]] IS JSON OR json_valid([[%s]]::text)) AND jsonb_typeof([[%s]]::jsonb) = 'array' THEN [[%s]]::jsonb ELSE jsonb_build_array([[%s]]) END)`,
		column, column, column, column, column,
	)
}

// JSONEachByPlaceholder expands a given user input json array to multiple rows.
// Use [JSONEach] if you want to expand a column value instead.
// The [placeholder] is the parameter placeholder in SQL prepared statements.
// We assume the parameter value is a marshalled JSON array.
func JSONEachByPlaceholder(placeholder string) string {
	return fmt.Sprintf(
		`jsonb_array_elements({:%s}::jsonb)`,
		placeholder,
	)
}

// JsonArrayExistsStr is used to determine whether a JSON string array contains a string element.
// Right now it only used to determine whether a JSON string ID array contains a specific ID.
// Operation "?" definition: Does the string exist as a top-level key within the JSON value?
// The type of the key is only supported to be string.
// If we want to support other types, we may need to use `@>` operator instead.
func JsonArrayExistsStr(column string, strValue string) dbx.Expression {
	return dbx.NewExp(fmt.Sprintf("[[%s]] ? {:value}::text", column), dbx.Params{
		"value": strValue,
	})
}

// JSONArrayLength returns JSON_ARRAY_LENGTH SQLite string expression
// with some normalizations for non-json columns.
//
// It works with both json and non-json column values.
//
// Returns 0 for empty string or NULL column values.
func JSONArrayLength(column string) string {
	// note: we are not using the new and shorter "if(x,y)" syntax for
	// compatibility with custom drivers that use older SQLite version
	/* SQLite:
	return fmt.Sprintf(
		`json_array_length(CASE WHEN iif(json_valid([[%s]]), json_type([[%s]])='array', FALSE) THEN [[%s]] ELSE (CASE WHEN [[%s]] = '' OR [[%s]] IS NULL THEN json_array() ELSE json_array([[%s]]) END) END)`,
		column, column, column, column, column, column,
	)
	*/
	// PostgreSQL:
	return fmt.Sprintf(
		`(CASE WHEN ([[%s]] IS JSON OR JSON_VALID([[%s]]::text)) AND jsonb_typeof([[%s]]::jsonb) = 'array' THEN jsonb_array_length([[%s]]::jsonb) ELSE 0 END)`,
		column, column, column, column,
	)
}

// JSONExtract returns a JSON_EXTRACT SQLite string expression with
// some normalizations for non-json columns.
//
// PostgreSQL 15+ 兼容: 使用自定义函数 json_query_or_null，
// 该函数内部使用 jsonb_path_query_first (PG12+) 而非 JSON_QUERY (PG17+)
func JSONExtract(column string, path string) string {
	// prefix the path with dot if it is not starting with array notation
	if path != "" && !strings.HasPrefix(path, "[") {
		path = "." + path
	}

	/* SQLite:
	return fmt.Sprintf(
		// note: the extra object wrapping is needed to workaround the cases where a json_extract is used with non-json columns.
		"(CASE WHEN json_valid([[%s]]) THEN JSON_EXTRACT([[%s]], '$%s') ELSE JSON_EXTRACT(json_object('pb', [[%s]]), '$.pb%s') END)",
		column,
		column,
		path,
		column,
		path,
	)
	*/

	// PostgreSQL (PG15+ 兼容):
	// 使用自定义函数 json_query_or_null，该函数内部使用 jsonb_path_query_first
	// 而非 JSON_QUERY (仅 PG17+ 支持)
	// 添加 ::jsonb 后缀作为类型提示，用于 typeAwareJoin 进行类型推断
	return fmt.Sprintf(
		`json_query_or_null([[%s]], '$%s')::jsonb`,
		column,
		path,
	)
}
