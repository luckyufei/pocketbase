// Package dbutils 提供数据库工具函数
package dbutils

import (
	"database/sql"
	"strconv"
	"strings"
	"time"
)

// BoolValue 将各种类型的值转换为布尔值
// 支持 SQLite 的 0/1 和 PostgreSQL 的 true/false
func BoolValue(v interface{}) bool {
	if v == nil {
		return false
	}

	switch val := v.(type) {
	case bool:
		return val
	case int:
		return val != 0
	case int8:
		return val != 0
	case int16:
		return val != 0
	case int32:
		return val != 0
	case int64:
		return val != 0
	case uint:
		return val != 0
	case uint8:
		return val != 0
	case uint16:
		return val != 0
	case uint32:
		return val != 0
	case uint64:
		return val != 0
	case float32:
		return val != 0
	case float64:
		return val != 0
	case string:
		lower := strings.ToLower(strings.TrimSpace(val))
		return lower == "true" || lower == "1" || lower == "yes" || lower == "on"
	case []byte:
		return BoolValue(string(val))
	case sql.NullBool:
		return val.Valid && val.Bool
	default:
		return false
	}
}

// IntValue 将各种类型的值转换为 int64
func IntValue(v interface{}) int64 {
	if v == nil {
		return 0
	}

	switch val := v.(type) {
	case int:
		return int64(val)
	case int8:
		return int64(val)
	case int16:
		return int64(val)
	case int32:
		return int64(val)
	case int64:
		return val
	case uint:
		return int64(val)
	case uint8:
		return int64(val)
	case uint16:
		return int64(val)
	case uint32:
		return int64(val)
	case uint64:
		return int64(val)
	case float32:
		return int64(val)
	case float64:
		return int64(val)
	case bool:
		if val {
			return 1
		}
		return 0
	case string:
		i, _ := strconv.ParseInt(val, 10, 64)
		return i
	case []byte:
		return IntValue(string(val))
	case sql.NullInt64:
		if val.Valid {
			return val.Int64
		}
		return 0
	default:
		return 0
	}
}

// FloatValue 将各种类型的值转换为 float64
func FloatValue(v interface{}) float64 {
	if v == nil {
		return 0
	}

	switch val := v.(type) {
	case float32:
		return float64(val)
	case float64:
		return val
	case int:
		return float64(val)
	case int8:
		return float64(val)
	case int16:
		return float64(val)
	case int32:
		return float64(val)
	case int64:
		return float64(val)
	case uint:
		return float64(val)
	case uint8:
		return float64(val)
	case uint16:
		return float64(val)
	case uint32:
		return float64(val)
	case uint64:
		return float64(val)
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	case []byte:
		return FloatValue(string(val))
	case sql.NullFloat64:
		if val.Valid {
			return val.Float64
		}
		return 0
	default:
		return 0
	}
}

// StringValue 将各种类型的值转换为字符串
func StringValue(v interface{}) string {
	if v == nil {
		return ""
	}

	switch val := v.(type) {
	case string:
		return val
	case []byte:
		return string(val)
	case bool:
		if val {
			return "true"
		}
		return "false"
	case int, int8, int16, int32, int64:
		return strconv.FormatInt(IntValue(val), 10)
	case uint, uint8, uint16, uint32, uint64:
		return strconv.FormatUint(uint64(IntValue(val)), 10)
	case float32, float64:
		return strconv.FormatFloat(FloatValue(val), 'f', -1, 64)
	case time.Time:
		return val.Format(time.RFC3339Nano)
	case sql.NullString:
		if val.Valid {
			return val.String
		}
		return ""
	default:
		return ""
	}
}

// TimeValue 将各种类型的值转换为 time.Time
// 支持多种时间格式，包括 PostgreSQL 的 TIMESTAMPTZ
func TimeValue(v interface{}) time.Time {
	if v == nil {
		return time.Time{}
	}

	switch val := v.(type) {
	case time.Time:
		return val
	case *time.Time:
		if val != nil {
			return *val
		}
		return time.Time{}
	case string:
		return parseTimeString(val)
	case []byte:
		return parseTimeString(string(val))
	case int64:
		// Unix timestamp (秒)
		return time.Unix(val, 0)
	case float64:
		// Unix timestamp (秒，带小数)
		sec := int64(val)
		nsec := int64((val - float64(sec)) * 1e9)
		return time.Unix(sec, nsec)
	case sql.NullTime:
		if val.Valid {
			return val.Time
		}
		return time.Time{}
	default:
		return time.Time{}
	}
}

// parseTimeString 解析时间字符串
func parseTimeString(s string) time.Time {
	if s == "" {
		return time.Time{}
	}

	// 常见时间格式列表
	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.999999999Z07:00",
		"2006-01-02T15:04:05.999999Z07:00",
		"2006-01-02T15:04:05.999Z07:00",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999-07:00",
		"2006-01-02 15:04:05.999-07:00",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02 15:04:05.999999999+00",  // PostgreSQL TIMESTAMPTZ
		"2006-01-02 15:04:05.999999+00",     // PostgreSQL TIMESTAMPTZ
		"2006-01-02 15:04:05.999+00",        // PostgreSQL TIMESTAMPTZ
		"2006-01-02 15:04:05+00",            // PostgreSQL TIMESTAMPTZ
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05.999",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, s); err == nil {
			return t
		}
	}

	return time.Time{}
}

// FormatTimeForDB 将 time.Time 格式化为数据库兼容的字符串
func FormatTimeForDB(t time.Time, dbType DBType) string {
	if t.IsZero() {
		return ""
	}

	if dbType.IsPostgres() {
		// PostgreSQL TIMESTAMPTZ 格式
		return t.UTC().Format("2006-01-02 15:04:05.999999-07:00")
	}

	// SQLite 使用 ISO 8601 格式
	return t.UTC().Format("2006-01-02 15:04:05.000Z")
}

// FormatBoolForDB 将布尔值格式化为数据库兼容的值
func FormatBoolForDB(b bool, dbType DBType) interface{} {
	if dbType.IsPostgres() {
		// PostgreSQL 原生支持布尔类型
		return b
	}

	// SQLite 使用 0/1
	if b {
		return 1
	}
	return 0
}

// NullString 创建一个 sql.NullString
func NullString(s string) sql.NullString {
	return sql.NullString{
		String: s,
		Valid:  s != "",
	}
}

// NullInt64 创建一个 sql.NullInt64
func NullInt64(i int64) sql.NullInt64 {
	return sql.NullInt64{
		Int64: i,
		Valid: true,
	}
}

// NullFloat64 创建一个 sql.NullFloat64
func NullFloat64(f float64) sql.NullFloat64 {
	return sql.NullFloat64{
		Float64: f,
		Valid:   true,
	}
}

// NullBool 创建一个 sql.NullBool
func NullBool(b bool) sql.NullBool {
	return sql.NullBool{
		Bool:  b,
		Valid: true,
	}
}

// NullTime 创建一个 sql.NullTime
func NullTime(t time.Time) sql.NullTime {
	return sql.NullTime{
		Time:  t,
		Valid: !t.IsZero(),
	}
}
