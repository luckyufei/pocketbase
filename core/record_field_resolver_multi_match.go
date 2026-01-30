package core

import (
	"fmt"
	"strings"

	"github.com/pocketbase/dbx"
)

var _ dbx.Expression = (*multiMatchSubquery)(nil)

// join defines the specification for a single SQL JOIN clause.
type join struct {
	tableName  string
	tableAlias string
	on         dbx.Expression
	// columnDef 用于 PostgreSQL 中 jsonb_array_elements 的列定义 (e.g., "(value)")
	// SQLite 的 json_each 自动有 value 列，不需要此字段
	columnDef string
}

// multiMatchSubquery defines a record multi-match subquery expression.
type multiMatchSubquery struct {
	baseTableAlias  string
	fromTableName   string
	fromTableAlias  string
	valueIdentifier string
	joins           []*join
	params          dbx.Params
}

// Build converts the expression into a SQL fragment.
//
// Implements [dbx.Expression] interface.
func (m *multiMatchSubquery) Build(db *dbx.DB, params dbx.Params) string {
	if m.baseTableAlias == "" || m.fromTableName == "" || m.fromTableAlias == "" {
		return "0=1"
	}

	if params == nil {
		params = m.params
	} else {
		// merge by updating the parent params
		for k, v := range m.params {
			params[k] = v
		}
	}

	var mergedJoins strings.Builder
	for i, j := range m.joins {
		if i > 0 {
			mergedJoins.WriteString(" ")
		}
		mergedJoins.WriteString("LEFT JOIN ")
		mergedJoins.WriteString(db.QuoteTableName(j.tableName))
		mergedJoins.WriteString(" ")
		mergedJoins.WriteString(db.QuoteTableName(j.tableAlias))
		// PostgreSQL 需要为 jsonb_array_elements 指定列定义
		if j.columnDef != "" {
			mergedJoins.WriteString(j.columnDef)
		}
		if j.on != nil {
			mergedJoins.WriteString(" ON ")
			mergedJoins.WriteString(j.on.Build(db, params))
		}
	}

	return fmt.Sprintf(
		`SELECT %s as [[multiMatchValue]] FROM %s %s %s WHERE %s = %s`,
		db.QuoteColumnName(m.valueIdentifier),
		db.QuoteTableName(m.fromTableName),
		db.QuoteTableName(m.fromTableAlias),
		mergedJoins.String(),
		db.QuoteColumnName(m.fromTableAlias+".id"),
		db.QuoteColumnName(m.baseTableAlias+".id"),
	)
}
