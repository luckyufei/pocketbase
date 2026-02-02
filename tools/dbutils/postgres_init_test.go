package dbutils_test

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

func TestPostgresInitSQL(t *testing.T) {
	sql := dbutils.PostgresInitSQL()

	// 验证包含必要的函数
	requiredFunctions := []string{
		"pb_is_json",
		"pb_json_extract",
		"pb_json_each",
		"pb_json_array_length",
		"uuid_generate_v7",
	}

	for _, fn := range requiredFunctions {
		if !strings.Contains(sql, fn) {
			t.Fatalf("PostgresInitSQL should contain function %s", fn)
		}
	}

	// 验证包含扩展
	requiredExtensions := []string{
		"pgcrypto",
		"citext",
	}

	for _, ext := range requiredExtensions {
		if !strings.Contains(sql, ext) {
			t.Fatalf("PostgresInitSQL should contain extension %s", ext)
		}
	}
}

func TestPostgresCollectionsTableSQL(t *testing.T) {
	sql := dbutils.PostgresCollectionsTableSQL()

	// 验证使用 PostgreSQL 语法
	if !strings.Contains(sql, "JSONB") {
		t.Fatal("Should use JSONB type")
	}

	if !strings.Contains(sql, "TIMESTAMPTZ") {
		t.Fatal("Should use TIMESTAMPTZ type")
	}

	if !strings.Contains(sql, "gen_random_bytes") {
		t.Fatal("Should use gen_random_bytes for ID generation")
	}

	// 验证表结构
	requiredColumns := []string{
		"id", "system", "type", "name", "fields", "indexes",
		"listRule", "viewRule", "createRule", "updateRule", "deleteRule",
		"options", "created", "updated",
	}

	for _, col := range requiredColumns {
		if !strings.Contains(sql, `"`+col+`"`) {
			t.Fatalf("Should contain column %s", col)
		}
	}
}

func TestPostgresParamsTableSQL(t *testing.T) {
	sql := dbutils.PostgresParamsTableSQL()

	if !strings.Contains(sql, "JSONB") {
		t.Fatal("Should use JSONB type")
	}

	if !strings.Contains(sql, "TIMESTAMPTZ") {
		t.Fatal("Should use TIMESTAMPTZ type")
	}
}

func TestGeneratePostgresRecordTableSQL(t *testing.T) {
	fields := []dbutils.FieldDef{
		{Name: "name", PostgresType: "TEXT", NotNull: true},
		{Name: "email", PostgresType: "CITEXT", NotNull: true},
		{Name: "data", PostgresType: "JSONB", Default: "'{}'::jsonb"},
		{Name: "created", PostgresType: "TIMESTAMPTZ", NotNull: true, Default: "NOW()"},
	}

	sql := dbutils.GeneratePostgresRecordTableSQL("test_table", fields)

	// 验证表名
	if !strings.Contains(sql, `"test_table"`) {
		t.Fatal("Should contain table name")
	}

	// 验证字段
	for _, field := range fields {
		if !strings.Contains(sql, `"`+field.Name+`"`) {
			t.Fatalf("Should contain field %s", field.Name)
		}
		if !strings.Contains(sql, field.PostgresType) {
			t.Fatalf("Should contain type %s", field.PostgresType)
		}
	}

	// 验证 NOT NULL
	if !strings.Contains(sql, "NOT NULL") {
		t.Fatal("Should contain NOT NULL constraints")
	}

	// 验证 DEFAULT
	if !strings.Contains(sql, "DEFAULT") {
		t.Fatal("Should contain DEFAULT values")
	}
}

func TestConvertSQLiteTypeToPostgres(t *testing.T) {
	scenarios := []struct {
		sqliteType   string
		expectedType string
	}{
		{"TEXT", "TEXT"},
		{"INTEGER", "INTEGER"},
		{"REAL", "DOUBLE PRECISION"},
		{"BLOB", "BYTEA"},
		{"BOOLEAN", "BOOLEAN"},
		{"JSON", "JSONB"},
		{"DATETIME", "TIMESTAMPTZ"},
		{"UNKNOWN", "UNKNOWN"}, // 未知类型保持不变
	}

	for _, s := range scenarios {
		t.Run(s.sqliteType, func(t *testing.T) {
			result := dbutils.ConvertSQLiteTypeToPostgres(s.sqliteType)
			if result != s.expectedType {
				t.Fatalf("Expected %s, got %s", s.expectedType, result)
			}
		})
	}
}

func TestTypeMapping(t *testing.T) {
	// 验证类型映射完整性
	expectedMappings := map[string]string{
		"TEXT":     "TEXT",
		"INTEGER":  "INTEGER",
		"REAL":     "DOUBLE PRECISION",
		"BLOB":     "BYTEA",
		"BOOLEAN":  "BOOLEAN",
		"JSON":     "JSONB",
		"DATETIME": "TIMESTAMPTZ",
	}

	for sqliteType, expectedPgType := range expectedMappings {
		if pgType, ok := dbutils.TypeMapping[sqliteType]; !ok {
			t.Fatalf("Missing mapping for %s", sqliteType)
		} else if pgType != expectedPgType {
			t.Fatalf("Wrong mapping for %s: expected %s, got %s", sqliteType, expectedPgType, pgType)
		}
	}
}
