package core_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestHasTable(t *testing.T) {
	t.Parallel()

	scenarios := []struct {
		tableName string
		expected  bool
	}{
		{"", false},
		{"test", false},
		{core.CollectionNameSuperusers, true},
		{"demo3", true},
		{"DEMO3", true}, // table names are case insensitives by default
		{"view1", true}, // view
	}

	for _, s := range scenarios {
		tests.RunWithBothDBs(t, s.tableName, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
			result := app.HasTable(s.tableName)
			if result != s.expected {
				t.Fatalf("Expected %v, got %v", s.expected, result)
			}
		})
	}
}

func TestAuxHasTable(t *testing.T) {
	t.Parallel()

	scenarios := []struct {
		tableName string
		expected  bool
	}{
		{"", false},
		{"test", false},
		{"_lOGS", true}, // table names are case insensitives by default
	}

	for _, s := range scenarios {
		tests.RunWithBothDBs(t, s.tableName, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
			result := app.AuxHasTable(s.tableName)
			if result != s.expected {
				t.Fatalf("Expected %v, got %v", s.expected, result)
			}
		})
	}
}

func TestTableColumns(t *testing.T) {
	t.Parallel()

	scenarios := []struct {
		tableName string
		expected  []string
	}{
		{"", nil},
		{"_params", []string{"id", "value", "created", "updated"}},
	}

	for i, s := range scenarios {
		tests.RunWithBothDBs(t, fmt.Sprintf("%d_%s", i, s.tableName), func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
			columns, _ := app.TableColumns(s.tableName)

			if len(columns) != len(s.expected) {
				t.Fatalf("Expected columns %v, got %v", s.expected, columns)
			}

			for _, c := range columns {
				if !slices.Contains(s.expected, c) {
					t.Errorf("Didn't expect column %s", c)
				}
			}
		})
	}
}

func TestTableInfo(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// PostgreSQL 和 SQLite 有不同的默认值语法和类型名称
		var expectedParams string
		if dbType == tests.DBTypePostgres {
			// PostgreSQL 的 _params 表结构（由系统迁移创建）
			// 注意：列顺序按 ordinal_position 排序（id 先，created/updated 后）
			// 类型名称是 PostgreSQL 原生类型（timestamp with time zone）
			expectedParams = `[{"PK":1,"Index":0,"Name":"id","Type":"text","NotNull":true,"DefaultValue":{"String":"('r'::text || lower(encode(gen_random_bytes(7), 'hex'::text)))","Valid":true}},{"PK":0,"Index":1,"Name":"value","Type":"jsonb","NotNull":false,"DefaultValue":{"String":"","Valid":false}},{"PK":0,"Index":2,"Name":"created","Type":"timestamp with time zone","NotNull":true,"DefaultValue":{"String":"now()","Valid":true}},{"PK":0,"Index":3,"Name":"updated","Type":"timestamp with time zone","NotNull":true,"DefaultValue":{"String":"now()","Valid":true}}]`
		} else {
			expectedParams = `[{"PK":0,"Index":0,"Name":"created","Type":"TEXT","NotNull":true,"DefaultValue":{"String":"''","Valid":true}},{"PK":1,"Index":1,"Name":"id","Type":"TEXT","NotNull":true,"DefaultValue":{"String":"'r'||lower(hex(randomblob(7)))","Valid":true}},{"PK":0,"Index":2,"Name":"updated","Type":"TEXT","NotNull":true,"DefaultValue":{"String":"''","Valid":true}},{"PK":0,"Index":3,"Name":"value","Type":"JSON","NotNull":false,"DefaultValue":{"String":"NULL","Valid":true}}]`
		}

		scenarios := []struct {
			tableName string
			expected  string
		}{
			{"", "null"},
			{"missing", "null"},
			{"_params", expectedParams},
		}

		for i, s := range scenarios {
			t.Run(fmt.Sprintf("%d_%s", i, s.tableName), func(t *testing.T) {
				rows, _ := app.TableInfo(s.tableName)

				raw, err := json.Marshal(rows)
				if err != nil {
					t.Fatal(err)
				}

				if str := string(raw); str != s.expected {
					t.Fatalf("Expected\n%s\ngot\n%s", s.expected, str)
				}
			})
		}
	})
}

func TestTableIndexes(t *testing.T) {
	t.Parallel()

	// PostgreSQL 索引名称包含不同的后缀（因为 collection id 不同）
	// 所以我们使用前缀匹配来验证
	scenarios := []struct {
		tableName        string
		expectedPrefixes []string // 期望的索引名前缀
		minCount         int      // 最小索引数量（PostgreSQL 可能包含主键索引）
	}{
		{"", nil, 0},
		{"missing", nil, 0},
		{
			core.CollectionNameSuperusers,
			[]string{"idx_email_", "idx_tokenKey_"},
			2,
		},
	}

	for i, s := range scenarios {
		tests.RunWithBothDBs(t, fmt.Sprintf("%d_%s", i, s.tableName), func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
			indexes, _ := app.TableIndexes(s.tableName)

			// 验证最小索引数量
			if len(indexes) < s.minCount {
				t.Fatalf("Expected at least %d indexes, got %d\n%v", s.minCount, len(indexes), indexes)
			}

			// 验证期望的索引前缀存在
			for _, prefix := range s.expectedPrefixes {
				found := false
				for name := range indexes {
					if strings.HasPrefix(name, prefix) {
						found = true
						break
					}
				}
				if !found {
					t.Fatalf("Expected index with prefix %q not found in \n%v", prefix, indexes)
				}
			}
		})
	}
}

func TestDeleteTable(t *testing.T) {
	t.Parallel()

	scenarios := []struct {
		tableName   string
		expectError bool
	}{
		{"", true},
		{"test", false}, // missing tables are ignored
		{"_admins", false},
		{"demo3", false},
	}

	for i, s := range scenarios {
		tests.RunWithBothDBs(t, fmt.Sprintf("%d_%s", i, s.tableName), func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
			err := app.DeleteTable(s.tableName)

			hasErr := err != nil
			if hasErr != s.expectError {
				t.Fatalf("Expected hasErr %v, got %v", s.expectError, hasErr)
			}
		})
	}
}

func TestVacuum(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		calledQueries := []string{}
		app.NonconcurrentDB().(*dbx.DB).QueryLogFunc = func(ctx context.Context, t time.Duration, sql string, rows *sql.Rows, err error) {
			calledQueries = append(calledQueries, sql)
		}
		app.NonconcurrentDB().(*dbx.DB).ExecLogFunc = func(ctx context.Context, t time.Duration, sql string, result sql.Result, err error) {
			calledQueries = append(calledQueries, sql)
		}

		if err := app.Vacuum(); err != nil {
			t.Fatal(err)
		}

		if total := len(calledQueries); total != 1 {
			t.Fatalf("Expected 1 query, got %d", total)
		}

		// SQLite uses VACUUM, PostgreSQL uses VACUUM ANALYZE
		expectedQuery := "VACUUM"
		if dbType == tests.DBTypePostgres {
			expectedQuery = "VACUUM ANALYZE"
		}

		if calledQueries[0] != expectedQuery {
			t.Fatalf("Expected %s query, got %s", expectedQuery, calledQueries[0])
		}
	})
}

func TestAuxVacuum(t *testing.T) {
	t.Parallel()

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		calledQueries := []string{}
		app.AuxNonconcurrentDB().(*dbx.DB).QueryLogFunc = func(ctx context.Context, t time.Duration, sql string, rows *sql.Rows, err error) {
			calledQueries = append(calledQueries, sql)
		}
		app.AuxNonconcurrentDB().(*dbx.DB).ExecLogFunc = func(ctx context.Context, t time.Duration, sql string, result sql.Result, err error) {
			calledQueries = append(calledQueries, sql)
		}

		if err := app.AuxVacuum(); err != nil {
			t.Fatal(err)
		}

		if total := len(calledQueries); total != 1 {
			t.Fatalf("Expected 1 query, got %d", total)
		}

		// SQLite uses VACUUM, PostgreSQL uses VACUUM ANALYZE
		// Note: AuxDB is always SQLite for logs, so we expect VACUUM
		expectedQuery := "VACUUM"

		if calledQueries[0] != expectedQuery {
			t.Fatalf("Expected %s query, got %s", expectedQuery, calledQueries[0])
		}
	})
}
