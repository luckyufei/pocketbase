package dbutils_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

func TestBoolValue(t *testing.T) {
	scenarios := []struct {
		name     string
		input    interface{}
		expected bool
	}{
		// nil
		{"nil", nil, false},

		// bool
		{"bool true", true, true},
		{"bool false", false, false},

		// int types
		{"int 0", int(0), false},
		{"int 1", int(1), true},
		{"int -1", int(-1), true},
		{"int64 0", int64(0), false},
		{"int64 1", int64(1), true},

		// uint types
		{"uint 0", uint(0), false},
		{"uint 1", uint(1), true},

		// float types
		{"float64 0", float64(0), false},
		{"float64 1", float64(1), true},
		{"float64 0.5", float64(0.5), true},

		// string
		{"string 'true'", "true", true},
		{"string 'TRUE'", "TRUE", true},
		{"string 'True'", "True", true},
		{"string 'false'", "false", false},
		{"string 'FALSE'", "FALSE", false},
		{"string '1'", "1", true},
		{"string '0'", "0", false},
		{"string 'yes'", "yes", true},
		{"string 'no'", "no", false},
		{"string 'on'", "on", true},
		{"string 'off'", "off", false},
		{"string empty", "", false},
		{"string ' true '", " true ", true},

		// []byte
		{"[]byte 'true'", []byte("true"), true},
		{"[]byte '0'", []byte("0"), false},

		// sql.NullBool
		{"NullBool valid true", sql.NullBool{Bool: true, Valid: true}, true},
		{"NullBool valid false", sql.NullBool{Bool: false, Valid: true}, false},
		{"NullBool invalid", sql.NullBool{Bool: true, Valid: false}, false},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.BoolValue(s.input)
			if result != s.expected {
				t.Fatalf("BoolValue(%v) = %v, expected %v", s.input, result, s.expected)
			}
		})
	}
}

func TestIntValue(t *testing.T) {
	scenarios := []struct {
		name     string
		input    interface{}
		expected int64
	}{
		{"nil", nil, 0},
		{"int 42", int(42), 42},
		{"int64 -100", int64(-100), -100},
		{"uint 50", uint(50), 50},
		{"float64 3.7", float64(3.7), 3},
		{"bool true", true, 1},
		{"bool false", false, 0},
		{"string '123'", "123", 123},
		{"string '-456'", "-456", -456},
		{"string 'invalid'", "invalid", 0},
		{"[]byte '789'", []byte("789"), 789},
		{"NullInt64 valid", sql.NullInt64{Int64: 999, Valid: true}, 999},
		{"NullInt64 invalid", sql.NullInt64{Int64: 999, Valid: false}, 0},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.IntValue(s.input)
			if result != s.expected {
				t.Fatalf("IntValue(%v) = %v, expected %v", s.input, result, s.expected)
			}
		})
	}
}

func TestFloatValue(t *testing.T) {
	scenarios := []struct {
		name     string
		input    interface{}
		expected float64
	}{
		{"nil", nil, 0},
		{"float64 3.14", float64(3.14), 3.14},
		{"float32 2.5", float32(2.5), 2.5},
		{"int 42", int(42), 42},
		{"string '3.14'", "3.14", 3.14},
		{"string 'invalid'", "invalid", 0},
		{"NullFloat64 valid", sql.NullFloat64{Float64: 1.5, Valid: true}, 1.5},
		{"NullFloat64 invalid", sql.NullFloat64{Float64: 1.5, Valid: false}, 0},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.FloatValue(s.input)
			if result != s.expected {
				t.Fatalf("FloatValue(%v) = %v, expected %v", s.input, result, s.expected)
			}
		})
	}
}

func TestStringValue(t *testing.T) {
	scenarios := []struct {
		name     string
		input    interface{}
		expected string
	}{
		{"nil", nil, ""},
		{"string 'hello'", "hello", "hello"},
		{"[]byte 'world'", []byte("world"), "world"},
		{"bool true", true, "true"},
		{"bool false", false, "false"},
		{"int 42", int(42), "42"},
		{"int64 -100", int64(-100), "-100"},
		{"float64 3.14", float64(3.14), "3.14"},
		{"NullString valid", sql.NullString{String: "test", Valid: true}, "test"},
		{"NullString invalid", sql.NullString{String: "test", Valid: false}, ""},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.StringValue(s.input)
			if result != s.expected {
				t.Fatalf("StringValue(%v) = %q, expected %q", s.input, result, s.expected)
			}
		})
	}
}

func TestTimeValue(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	nowPtr := &now

	scenarios := []struct {
		name     string
		input    interface{}
		expected time.Time
	}{
		{"nil", nil, time.Time{}},
		{"time.Time", now, now},
		{"*time.Time", nowPtr, now},
		{"*time.Time nil", (*time.Time)(nil), time.Time{}},
		{"int64 unix", now.Unix(), time.Unix(now.Unix(), 0)},
		{"NullTime valid", sql.NullTime{Time: now, Valid: true}, now},
		{"NullTime invalid", sql.NullTime{Time: now, Valid: false}, time.Time{}},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.TimeValue(s.input)
			if !result.Equal(s.expected) {
				t.Fatalf("TimeValue(%v) = %v, expected %v", s.input, result, s.expected)
			}
		})
	}
}

func TestTimeValue_StringFormats(t *testing.T) {
	// 测试各种时间字符串格式
	scenarios := []struct {
		name   string
		input  string
		valid  bool
	}{
		{"RFC3339", "2024-01-15T10:30:00Z", true},
		{"RFC3339Nano", "2024-01-15T10:30:00.123456789Z", true},
		{"RFC3339 with offset", "2024-01-15T10:30:00+08:00", true},
		{"PostgreSQL TIMESTAMPTZ", "2024-01-15 10:30:00.123456+00", true},
		{"PostgreSQL TIMESTAMPTZ with tz", "2024-01-15 10:30:00.123456-07:00", true},
		{"Date only", "2024-01-15", true},
		{"DateTime without tz", "2024-01-15 10:30:00", true},
		{"DateTime with ms", "2024-01-15 10:30:00.123", true},
		{"Empty string", "", false},
		{"Invalid", "not a date", false},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.TimeValue(s.input)
			if s.valid && result.IsZero() {
				t.Fatalf("TimeValue(%q) should parse successfully", s.input)
			}
			if !s.valid && !result.IsZero() {
				t.Fatalf("TimeValue(%q) should return zero time", s.input)
			}
		})
	}
}

func TestFormatTimeForDB(t *testing.T) {
	testTime := time.Date(2024, 1, 15, 10, 30, 0, 123456000, time.UTC)

	// PostgreSQL 格式
	pgResult := dbutils.FormatTimeForDB(testTime, dbutils.DBTypePostgres)
	if pgResult == "" {
		t.Fatal("PostgreSQL format should not be empty")
	}
	// 验证包含微秒
	if len(pgResult) < 26 {
		t.Fatalf("PostgreSQL format should include microseconds: %s", pgResult)
	}

	// SQLite 格式
	sqliteResult := dbutils.FormatTimeForDB(testTime, dbutils.DBTypeSQLite)
	if sqliteResult == "" {
		t.Fatal("SQLite format should not be empty")
	}
	// 验证包含毫秒和 Z 后缀
	if sqliteResult[len(sqliteResult)-1] != 'Z' {
		t.Fatalf("SQLite format should end with Z: %s", sqliteResult)
	}

	// 零值
	zeroResult := dbutils.FormatTimeForDB(time.Time{}, dbutils.DBTypePostgres)
	if zeroResult != "" {
		t.Fatalf("Zero time should return empty string, got %q", zeroResult)
	}
}

func TestFormatBoolForDB(t *testing.T) {
	// PostgreSQL
	pgTrue := dbutils.FormatBoolForDB(true, dbutils.DBTypePostgres)
	if pgTrue != true {
		t.Fatalf("PostgreSQL true should be bool true, got %v", pgTrue)
	}
	pgFalse := dbutils.FormatBoolForDB(false, dbutils.DBTypePostgres)
	if pgFalse != false {
		t.Fatalf("PostgreSQL false should be bool false, got %v", pgFalse)
	}

	// SQLite
	sqliteTrue := dbutils.FormatBoolForDB(true, dbutils.DBTypeSQLite)
	if sqliteTrue != 1 {
		t.Fatalf("SQLite true should be 1, got %v", sqliteTrue)
	}
	sqliteFalse := dbutils.FormatBoolForDB(false, dbutils.DBTypeSQLite)
	if sqliteFalse != 0 {
		t.Fatalf("SQLite false should be 0, got %v", sqliteFalse)
	}
}

func TestNullHelpers(t *testing.T) {
	t.Run("NullString", func(t *testing.T) {
		ns := dbutils.NullString("test")
		if !ns.Valid || ns.String != "test" {
			t.Fatal("NullString should be valid with value")
		}

		empty := dbutils.NullString("")
		if empty.Valid {
			t.Fatal("NullString with empty string should be invalid")
		}
	})

	t.Run("NullInt64", func(t *testing.T) {
		ni := dbutils.NullInt64(42)
		if !ni.Valid || ni.Int64 != 42 {
			t.Fatal("NullInt64 should be valid with value")
		}
	})

	t.Run("NullFloat64", func(t *testing.T) {
		nf := dbutils.NullFloat64(3.14)
		if !nf.Valid || nf.Float64 != 3.14 {
			t.Fatal("NullFloat64 should be valid with value")
		}
	})

	t.Run("NullBool", func(t *testing.T) {
		nb := dbutils.NullBool(true)
		if !nb.Valid || !nb.Bool {
			t.Fatal("NullBool should be valid with value")
		}
	})

	t.Run("NullTime", func(t *testing.T) {
		now := time.Now()
		nt := dbutils.NullTime(now)
		if !nt.Valid || !nt.Time.Equal(now) {
			t.Fatal("NullTime should be valid with value")
		}

		zero := dbutils.NullTime(time.Time{})
		if zero.Valid {
			t.Fatal("NullTime with zero time should be invalid")
		}
	})
}
