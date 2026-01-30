package dbutils_test

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

func TestJSONFunctions_SQLite(t *testing.T) {
	jf := dbutils.NewJSONFunctions(dbutils.DBTypeSQLite)

	t.Run("Each", func(t *testing.T) {
		result := jf.Each("data")
		if !strings.Contains(result, "json_each") {
			t.Fatalf("SQLite Each should use json_each, got: %s", result)
		}
	})

	t.Run("EachColumnDef", func(t *testing.T) {
		result := jf.EachColumnDef()
		if result != "" {
			t.Fatalf("SQLite EachColumnDef should be empty, got: %s", result)
		}
	})

	t.Run("EachParamColumnDef", func(t *testing.T) {
		result := jf.EachParamColumnDef()
		if result != "" {
			t.Fatalf("SQLite EachParamColumnDef should be empty, got: %s", result)
		}
	})

	t.Run("ArrayLength", func(t *testing.T) {
		result := jf.ArrayLength("data")
		if !strings.Contains(result, "json_array_length") {
			t.Fatalf("SQLite ArrayLength should use json_array_length, got: %s", result)
		}
	})

	t.Run("Extract", func(t *testing.T) {
		result := jf.Extract("data", "name")
		if !strings.Contains(result, "JSON_EXTRACT") {
			t.Fatalf("SQLite Extract should use JSON_EXTRACT, got: %s", result)
		}
	})

	t.Run("Valid", func(t *testing.T) {
		result := jf.Valid("data")
		if !strings.Contains(result, "json_valid") {
			t.Fatalf("SQLite Valid should use json_valid, got: %s", result)
		}
	})

	t.Run("BuildObject", func(t *testing.T) {
		result := jf.BuildObject("'key'", "'value'")
		if !strings.Contains(result, "json_object") {
			t.Fatalf("SQLite BuildObject should use json_object, got: %s", result)
		}
	})

	t.Run("BuildArray", func(t *testing.T) {
		result := jf.BuildArray("1", "2", "3")
		if !strings.Contains(result, "json_array") {
			t.Fatalf("SQLite BuildArray should use json_array, got: %s", result)
		}
	})

	t.Run("Agg", func(t *testing.T) {
		result := jf.Agg("data")
		if !strings.Contains(result, "json_group_array") {
			t.Fatalf("SQLite Agg should use json_group_array, got: %s", result)
		}
	})

	t.Run("Cast", func(t *testing.T) {
		result := jf.Cast("'{}'")
		if !strings.Contains(result, "json(") {
			t.Fatalf("SQLite Cast should use json(), got: %s", result)
		}
	})
}

func TestJSONFunctions_PostgreSQL(t *testing.T) {
	jf := dbutils.NewJSONFunctions(dbutils.DBTypePostgres)

	t.Run("Each", func(t *testing.T) {
		result := jf.Each("data")
		if !strings.Contains(result, "jsonb_array_elements") {
			t.Fatalf("PostgreSQL Each should use jsonb_array_elements, got: %s", result)
		}
	})

	t.Run("EachColumnDef", func(t *testing.T) {
		result := jf.EachColumnDef()
		if result != "(value)" {
			t.Fatalf("PostgreSQL EachColumnDef should be '(value)', got: %s", result)
		}
	})

	t.Run("EachParamColumnDef", func(t *testing.T) {
		result := jf.EachParamColumnDef()
		if result != "(value)" {
			t.Fatalf("PostgreSQL EachParamColumnDef should be '(value)', got: %s", result)
		}
	})

	t.Run("ArrayLength", func(t *testing.T) {
		result := jf.ArrayLength("data")
		if !strings.Contains(result, "jsonb_array_length") {
			t.Fatalf("PostgreSQL ArrayLength should use jsonb_array_length, got: %s", result)
		}
	})

	t.Run("Extract", func(t *testing.T) {
		result := jf.Extract("data", "name")
		if !strings.Contains(result, "jsonb_path_query_first") {
			t.Fatalf("PostgreSQL Extract should use jsonb_path_query_first, got: %s", result)
		}
	})

	t.Run("Valid", func(t *testing.T) {
		result := jf.Valid("data")
		if !strings.Contains(result, "pb_is_json") {
			t.Fatalf("PostgreSQL Valid should use pb_is_json, got: %s", result)
		}
	})

	t.Run("Contains", func(t *testing.T) {
		result := jf.Contains("tags", `'"test"'`)
		if !strings.Contains(result, "@>") {
			t.Fatalf("PostgreSQL Contains should use @> operator, got: %s", result)
		}
	})

	t.Run("Exists", func(t *testing.T) {
		result := jf.Exists("data", "'name'")
		if !strings.Contains(result, "?") {
			t.Fatalf("PostgreSQL Exists should use ? operator, got: %s", result)
		}
	})

	t.Run("Type", func(t *testing.T) {
		result := jf.Type("data")
		if !strings.Contains(result, "jsonb_typeof") {
			t.Fatalf("PostgreSQL Type should use jsonb_typeof, got: %s", result)
		}
	})

	t.Run("BuildObject", func(t *testing.T) {
		result := jf.BuildObject("'key'", "'value'")
		if !strings.Contains(result, "jsonb_build_object") {
			t.Fatalf("PostgreSQL BuildObject should use jsonb_build_object, got: %s", result)
		}
	})

	t.Run("BuildArray", func(t *testing.T) {
		result := jf.BuildArray("1", "2", "3")
		if !strings.Contains(result, "jsonb_build_array") {
			t.Fatalf("PostgreSQL BuildArray should use jsonb_build_array, got: %s", result)
		}
	})

	t.Run("Agg", func(t *testing.T) {
		result := jf.Agg("data")
		if !strings.Contains(result, "jsonb_agg") {
			t.Fatalf("PostgreSQL Agg should use jsonb_agg, got: %s", result)
		}
	})

	t.Run("ObjectAgg", func(t *testing.T) {
		result := jf.ObjectAgg("key", "value")
		if !strings.Contains(result, "jsonb_object_agg") {
			t.Fatalf("PostgreSQL ObjectAgg should use jsonb_object_agg, got: %s", result)
		}
	})

	t.Run("Cast", func(t *testing.T) {
		result := jf.Cast("'{}'")
		if !strings.Contains(result, "::jsonb") {
			t.Fatalf("PostgreSQL Cast should use ::jsonb, got: %s", result)
		}
	})
}

func TestJSONFunctions_DBType(t *testing.T) {
	scenarios := []struct {
		name     string
		dbType   dbutils.DBType
		expected dbutils.DBType
	}{
		{
			name:     "SQLite",
			dbType:   dbutils.DBTypeSQLite,
			expected: dbutils.DBTypeSQLite,
		},
		{
			name:     "PostgreSQL",
			dbType:   dbutils.DBTypePostgres,
			expected: dbutils.DBTypePostgres,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			jf := dbutils.NewJSONFunctions(s.dbType)
			if jf.DBType() != s.expected {
				t.Fatalf("Expected DBType %v, got %v", s.expected, jf.DBType())
			}
		})
	}
}

func TestJSONFunctions_BuildObject_OddPairs(t *testing.T) {
	jf := dbutils.NewJSONFunctions(dbutils.DBTypeSQLite)
	result := jf.BuildObject("'key'") // 奇数个参数
	if result != "'{}'" {
		t.Fatalf("BuildObject with odd pairs should return '{}', got: %s", result)
	}
}
