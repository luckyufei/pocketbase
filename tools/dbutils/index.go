package dbutils

import (
	"regexp"
	"strings"

	"github.com/pocketbase/pocketbase/tools/tokenizer"
)

var (
	// 更新正则以支持 USING method 语法 (PostgreSQL)
	indexRegex       = regexp.MustCompile(`(?im)create\s+(unique\s+)?\s*index\s*(if\s+not\s+exists\s+)?(\S*)\s+on\s+(\S*)\s*(?:using\s+(\w+)\s*)?\(([\s\S]*)\)(?:\s*where\s+([\s\S]*))?`)
	indexColumnRegex = regexp.MustCompile(`(?im)^([\s\S]+?)(?:\s+([\w_]+_ops))?(?:\s+collate\s+([\w]+))?(?:\s+(asc|desc))?$`)
)

// IndexColumn represents a single parsed SQL index column.
type IndexColumn struct {
	Name    string `json:"name"`    // identifier or expression
	OpClass string `json:"opClass"` // PostgreSQL operator class (e.g., jsonb_path_ops)
	Collate string `json:"collate"`
	Sort    string `json:"sort"`
}

// Index represents a single parsed SQL CREATE INDEX expression.
type Index struct {
	SchemaName string        `json:"schemaName"`
	IndexName  string        `json:"indexName"`
	TableName  string        `json:"tableName"`
	Method     string        `json:"method"` // PostgreSQL: BTREE, GIN, GIST, BRIN, HASH
	Where      string        `json:"where"`
	Columns    []IndexColumn `json:"columns"`
	Unique     bool          `json:"unique"`
	Optional   bool          `json:"optional"`
}

// IsValid checks if the current Index contains the minimum required fields to be considered valid.
func (idx Index) IsValid() bool {
	return idx.IndexName != "" && idx.TableName != "" && len(idx.Columns) > 0
}

// Build returns a "CREATE INDEX" SQL string from the current index parts.
//
// Returns empty string if idx.IsValid() is false.
func (idx Index) Build() string {
	if !idx.IsValid() {
		return ""
	}

	var str strings.Builder

	str.WriteString("CREATE ")

	if idx.Unique {
		str.WriteString("UNIQUE ")
	}

	str.WriteString("INDEX ")

	if idx.Optional {
		str.WriteString("IF NOT EXISTS ")
	}

	if idx.SchemaName != "" {
		str.WriteString("`")
		str.WriteString(idx.SchemaName)
		str.WriteString("`.")
	}

	str.WriteString("`")
	str.WriteString(idx.IndexName)
	str.WriteString("` ")

	str.WriteString("ON `")
	str.WriteString(idx.TableName)
	str.WriteString("` ")

	// PostgreSQL USING method (GIN, GIST, BRIN, HASH, BTREE)
	if idx.Method != "" {
		str.WriteString("USING ")
		str.WriteString(strings.ToUpper(idx.Method))
		str.WriteString(" ")
	}

	str.WriteString("(")

	if len(idx.Columns) > 1 {
		str.WriteString("\n  ")
	}

	var hasCol bool
	for _, col := range idx.Columns {
		trimmedColName := strings.TrimSpace(col.Name)
		if trimmedColName == "" {
			continue
		}

		if hasCol {
			str.WriteString(",\n  ")
		}

		if strings.Contains(col.Name, "(") || strings.Contains(col.Name, " ") {
			// most likely an expression
			str.WriteString(trimmedColName)
		} else {
			// regular identifier
			str.WriteString("`")
			str.WriteString(trimmedColName)
			str.WriteString("`")
		}

		// PostgreSQL operator class (e.g., jsonb_path_ops, gin_trgm_ops)
		if col.OpClass != "" {
			str.WriteString(" ")
			str.WriteString(col.OpClass)
		}

		if col.Collate != "" {
			str.WriteString(" COLLATE ")
			str.WriteString(col.Collate)
		}

		if col.Sort != "" {
			str.WriteString(" ")
			str.WriteString(strings.ToUpper(col.Sort))
		}

		hasCol = true
	}

	if hasCol && len(idx.Columns) > 1 {
		str.WriteString("\n")
	}

	str.WriteString(")")

	if idx.Where != "" {
		str.WriteString(" WHERE ")
		str.WriteString(idx.Where)
	}

	return str.String()
}

// ParseIndex parses the provided "CREATE INDEX" SQL string into Index struct.
func ParseIndex(createIndexExpr string) Index {
	result := Index{}

	matches := indexRegex.FindStringSubmatch(createIndexExpr)
	if len(matches) != 8 {
		return result
	}

	trimChars := "`\"'[]\r\n\t\f\v "

	// Unique
	// ---
	result.Unique = strings.TrimSpace(matches[1]) != ""

	// Optional (aka. "IF NOT EXISTS")
	// ---
	result.Optional = strings.TrimSpace(matches[2]) != ""

	// SchemaName and IndexName
	// ---
	nameTk := tokenizer.NewFromString(matches[3])
	nameTk.Separators('.')

	nameParts, _ := nameTk.ScanAll()
	if len(nameParts) == 2 {
		result.SchemaName = strings.Trim(nameParts[0], trimChars)
		result.IndexName = strings.Trim(nameParts[1], trimChars)
	} else {
		result.IndexName = strings.Trim(nameParts[0], trimChars)
	}

	// TableName
	// ---
	result.TableName = strings.Trim(matches[4], trimChars)

	// Method (PostgreSQL: BTREE, GIN, GIST, BRIN, HASH)
	// ---
	result.Method = strings.ToUpper(strings.TrimSpace(matches[5]))

	// Columns
	// ---
	columnsTk := tokenizer.NewFromString(matches[6])
	columnsTk.Separators(',')

	rawColumns, _ := columnsTk.ScanAll()

	result.Columns = make([]IndexColumn, 0, len(rawColumns))

	for _, col := range rawColumns {
		colMatches := indexColumnRegex.FindStringSubmatch(col)
		if len(colMatches) != 5 {
			continue
		}

		trimmedName := strings.Trim(colMatches[1], trimChars)
		if trimmedName == "" {
			continue
		}

		result.Columns = append(result.Columns, IndexColumn{
			Name:    trimmedName,
			OpClass: strings.TrimSpace(colMatches[2]), // PostgreSQL operator class
			Collate: strings.TrimSpace(colMatches[3]),
			Sort:    strings.ToUpper(colMatches[4]),
		})
	}

	// WHERE expression
	// ---
	result.Where = strings.TrimSpace(matches[7])

	return result
}

// FindSingleColumnUniqueIndex returns the first matching single column unique index.
func FindSingleColumnUniqueIndex(indexes []string, column string) (Index, bool) {
	var index Index

	for _, idx := range indexes {
		index := ParseIndex(idx)
		if index.Unique && len(index.Columns) == 1 && strings.EqualFold(index.Columns[0].Name, column) {
			return index, true
		}
	}

	return index, false
}

// Deprecated: Use `_, ok := FindSingleColumnUniqueIndex(indexes, column)` instead.
//
// HasColumnUniqueIndex loosely checks whether the specified column has
// a single column unique index (WHERE statements are ignored).
func HasSingleColumnUniqueIndex(column string, indexes []string) bool {
	_, ok := FindSingleColumnUniqueIndex(indexes, column)
	return ok
}
