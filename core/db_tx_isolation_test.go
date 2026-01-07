package core

import (
	"database/sql"
	"testing"
)

// TestIsolationLevelString 测试隔离级别字符串转换
func TestIsolationLevelString(t *testing.T) {
	testCases := []struct {
		level    sql.IsolationLevel
		expected string
	}{
		{sql.LevelDefault, "DEFAULT"},
		{sql.LevelReadUncommitted, "READ UNCOMMITTED"},
		{sql.LevelReadCommitted, "READ COMMITTED"},
		{sql.LevelRepeatableRead, "REPEATABLE READ"},
		{sql.LevelSerializable, "SERIALIZABLE"},
	}

	for _, tc := range testCases {
		t.Run(tc.expected, func(t *testing.T) {
			result := IsolationLevelToString(tc.level)
			if result != tc.expected {
				t.Errorf("expected %q, got %q", tc.expected, result)
			}
		})
	}
}

// TestParseIsolationLevel 测试解析隔离级别
func TestParseIsolationLevel(t *testing.T) {
	testCases := []struct {
		input    string
		expected sql.IsolationLevel
		hasError bool
	}{
		{"default", sql.LevelDefault, false},
		{"DEFAULT", sql.LevelDefault, false},
		{"read uncommitted", sql.LevelReadUncommitted, false},
		{"READ UNCOMMITTED", sql.LevelReadUncommitted, false},
		{"read committed", sql.LevelReadCommitted, false},
		{"READ COMMITTED", sql.LevelReadCommitted, false},
		{"repeatable read", sql.LevelRepeatableRead, false},
		{"REPEATABLE READ", sql.LevelRepeatableRead, false},
		{"serializable", sql.LevelSerializable, false},
		{"SERIALIZABLE", sql.LevelSerializable, false},
		{"invalid", sql.LevelDefault, true},
		{"", sql.LevelDefault, true},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			result, err := ParseIsolationLevel(tc.input)
			if tc.hasError {
				if err == nil {
					t.Error("expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				if result != tc.expected {
					t.Errorf("expected %v, got %v", tc.expected, result)
				}
			}
		})
	}
}

// TestTxOptionsBuilder 测试事务选项构建器
func TestTxOptionsBuilder(t *testing.T) {
	t.Run("默认选项", func(t *testing.T) {
		opts := DefaultTxOptions()
		if opts.Isolation != sql.LevelDefault {
			t.Errorf("expected LevelDefault, got %v", opts.Isolation)
		}
		if opts.ReadOnly {
			t.Error("expected ReadOnly to be false")
		}
	})

	t.Run("链式设置", func(t *testing.T) {
		opts := DefaultTxOptions().
			WithIsolation(sql.LevelSerializable).
			WithReadOnly(true)

		if opts.Isolation != sql.LevelSerializable {
			t.Errorf("expected LevelSerializable, got %v", opts.Isolation)
		}
		if !opts.ReadOnly {
			t.Error("expected ReadOnly to be true")
		}
	})

	t.Run("转换为 sql.TxOptions", func(t *testing.T) {
		opts := &TxOptions{
			Isolation: sql.LevelRepeatableRead,
			ReadOnly:  true,
		}

		sqlOpts := opts.ToSqlTxOptions()
		if sqlOpts.Isolation != sql.LevelRepeatableRead {
			t.Errorf("expected LevelRepeatableRead, got %v", sqlOpts.Isolation)
		}
		if !sqlOpts.ReadOnly {
			t.Error("expected ReadOnly to be true")
		}
	})
}

// TestRecommendedIsolationLevel 测试推荐的隔离级别
func TestRecommendedIsolationLevel(t *testing.T) {
	testCases := []struct {
		operation string
		expected  sql.IsolationLevel
	}{
		{"financial_transfer", sql.LevelSerializable},
		{"inventory_update", sql.LevelRepeatableRead},
		{"read_report", sql.LevelReadCommitted},
		{"unknown_operation", sql.LevelDefault},
	}

	for _, tc := range testCases {
		t.Run(tc.operation, func(t *testing.T) {
			result := GetRecommendedIsolationLevel(tc.operation)
			if result != tc.expected {
				t.Errorf("expected %v, got %v", tc.expected, result)
			}
		})
	}
}
