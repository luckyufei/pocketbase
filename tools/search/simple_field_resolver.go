package search

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/tools/dbutils"
	"github.com/pocketbase/pocketbase/tools/inflector"
	"github.com/pocketbase/pocketbase/tools/list"
)

// ResolverResult defines a single FieldResolver.Resolve() successfully parsed result.
type ResolverResult struct {
	// Identifier is the plain SQL identifier/column that will be used
	// in the final db expression as left or right operand.
	Identifier string

	// NoCoalesce instructs to not use COALESCE or NULL fallbacks
	// when building the identifier expression.
	NoCoalesce bool

	// Params is a map with db placeholder->value pairs that will be added
	// to the query when building both resolved operands/sides in a single expression.
	Params dbx.Params

	// MultiMatchSubQuery is an optional sub query expression that will be added
	// in addition to the combined ResolverResult expression during build.
	MultiMatchSubQuery dbx.Expression

	// AfterBuild is an optional function that will be called after building
	// and combining the result of both resolved operands/sides in a single expression.
	AfterBuild func(expr dbx.Expression) dbx.Expression
}

// FieldResolver defines an interface for managing search fields.
type FieldResolver interface {
	// UpdateQuery allows to updated the provided db query based on the
	// resolved search fields (eg. adding joins aliases, etc.).
	//
	// Called internally by `search.Provider` before executing the search request.
	UpdateQuery(query *dbx.SelectQuery) error

	// Resolve parses the provided field and returns a properly
	// formatted db identifier (eg. NULL, quoted column, placeholder parameter, etc.).
	Resolve(field string) (*ResolverResult, error)
}

// DBTypeResolver 是可选接口，用于获取数据库类型
// 如果 FieldResolver 实现了此接口，过滤器将使用对应的数据库语法
type DBTypeResolver interface {
	// DBType 返回数据库类型
	DBType() dbutils.DBType
}

// NewSimpleFieldResolver creates a new `SimpleFieldResolver` with the
// provided `allowedFields`.
//
// Each `allowedFields` could be a plain string (eg. "name")
// or a regexp pattern (eg. `^\w+[\w\.]*$`).
func NewSimpleFieldResolver(allowedFields ...string) *SimpleFieldResolver {
	return &SimpleFieldResolver{
		allowedFields: allowedFields,
		dbType:        dbutils.DBTypeSQLite, // 默认 SQLite
	}
}

// NewSimpleFieldResolverWithDBType 创建带数据库类型的 SimpleFieldResolver
func NewSimpleFieldResolverWithDBType(dbType dbutils.DBType, allowedFields ...string) *SimpleFieldResolver {
	return &SimpleFieldResolver{
		allowedFields: allowedFields,
		dbType:        dbType,
	}
}

// SimpleFieldResolver defines a generic search resolver that allows
// only its listed fields to be resolved and take part in a search query.
//
// If `allowedFields` are empty no fields filtering is applied.
type SimpleFieldResolver struct {
	allowedFields []string
	dbType        dbutils.DBType
}

// UpdateQuery implements `search.UpdateQuery` interface.
func (r *SimpleFieldResolver) UpdateQuery(query *dbx.SelectQuery) error {
	// nothing to update...
	return nil
}

// DBType 返回数据库类型，实现 DBTypeResolver 接口
func (r *SimpleFieldResolver) DBType() dbutils.DBType {
	return r.dbType
}

// Resolve implements `search.Resolve` interface.
//
// Returns error if `field` is not in `r.allowedFields`.
func (r *SimpleFieldResolver) Resolve(field string) (*ResolverResult, error) {
	if !list.ExistInSliceWithRegex(field, r.allowedFields) {
		return nil, fmt.Errorf("failed to resolve field %q", field)
	}

	parts := strings.Split(field, ".")

	// single regular field
	if len(parts) == 1 {
		return &ResolverResult{
			Identifier: "[[" + inflector.Columnify(parts[0]) + "]]",
		}, nil
	}

	// treat as json path
	// PostgreSQL 使用 -> 和 ->> 操作符，SQLite 使用 JSON_EXTRACT
	if r.dbType.IsPostgres() {
		// PostgreSQL: 使用 -> 和 ->> 操作符
		// 例如: data->'auth' 或 data->>'auth' (返回文本)
		var expr strings.Builder
		expr.WriteString("[[")
		expr.WriteString(inflector.Columnify(parts[0]))
		expr.WriteString("]]")
		for i, part := range parts[1:] {
			isLast := i == len(parts[1:])-1
			if _, err := strconv.Atoi(part); err == nil {
				// 数组索引
				if isLast {
					expr.WriteString("->>")
				} else {
					expr.WriteString("->")
				}
				expr.WriteString(part)
			} else {
				// 对象键
				if isLast {
					expr.WriteString("->>")
				} else {
					expr.WriteString("->")
				}
				expr.WriteString("'")
				expr.WriteString(inflector.Columnify(part))
				expr.WriteString("'")
			}
		}
		return &ResolverResult{
			NoCoalesce: true,
			Identifier: expr.String(),
		}, nil
	}

	// SQLite: 使用 JSON_EXTRACT
	var jsonPath strings.Builder
	jsonPath.WriteString("$")
	for _, part := range parts[1:] {
		if _, err := strconv.Atoi(part); err == nil {
			jsonPath.WriteString("[")
			jsonPath.WriteString(inflector.Columnify(part))
			jsonPath.WriteString("]")
		} else {
			jsonPath.WriteString(".")
			jsonPath.WriteString(inflector.Columnify(part))
		}
	}

	return &ResolverResult{
		NoCoalesce: true,
		Identifier: fmt.Sprintf(
			"JSON_EXTRACT([[%s]], '%s')",
			inflector.Columnify(parts[0]),
			jsonPath.String(),
		),
	}, nil
}
