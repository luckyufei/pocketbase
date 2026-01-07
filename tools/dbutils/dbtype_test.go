package dbutils_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/tools/dbutils"
)

func TestDBTypeString(t *testing.T) {
	scenarios := []struct {
		name     string
		dbType   dbutils.DBType
		expected string
	}{
		{
			name:     "SQLite",
			dbType:   dbutils.DBTypeSQLite,
			expected: "sqlite",
		},
		{
			name:     "PostgreSQL",
			dbType:   dbutils.DBTypePostgres,
			expected: "postgres",
		},
		{
			name:     "Unknown",
			dbType:   dbutils.DBTypeUnknown,
			expected: "unknown",
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := s.dbType.String()
			if result != s.expected {
				t.Fatalf("Expected %q, got %q", s.expected, result)
			}
		})
	}
}

func TestDBTypeIsSQLite(t *testing.T) {
	scenarios := []struct {
		name     string
		dbType   dbutils.DBType
		expected bool
	}{
		{
			name:     "SQLite",
			dbType:   dbutils.DBTypeSQLite,
			expected: true,
		},
		{
			name:     "PostgreSQL",
			dbType:   dbutils.DBTypePostgres,
			expected: false,
		},
		{
			name:     "Unknown",
			dbType:   dbutils.DBTypeUnknown,
			expected: false,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := s.dbType.IsSQLite()
			if result != s.expected {
				t.Fatalf("Expected %v, got %v", s.expected, result)
			}
		})
	}
}

func TestDBTypeIsPostgres(t *testing.T) {
	scenarios := []struct {
		name     string
		dbType   dbutils.DBType
		expected bool
	}{
		{
			name:     "SQLite",
			dbType:   dbutils.DBTypeSQLite,
			expected: false,
		},
		{
			name:     "PostgreSQL",
			dbType:   dbutils.DBTypePostgres,
			expected: true,
		},
		{
			name:     "Unknown",
			dbType:   dbutils.DBTypeUnknown,
			expected: false,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := s.dbType.IsPostgres()
			if result != s.expected {
				t.Fatalf("Expected %v, got %v", s.expected, result)
			}
		})
	}
}

func TestDetectDBTypeFromDriverName(t *testing.T) {
	scenarios := []struct {
		name       string
		driverName string
		expected   dbutils.DBType
	}{
		{
			name:       "sqlite lowercase",
			driverName: "sqlite",
			expected:   dbutils.DBTypeSQLite,
		},
		{
			name:       "sqlite3",
			driverName: "sqlite3",
			expected:   dbutils.DBTypeSQLite,
		},
		{
			name:       "SQLite uppercase",
			driverName: "SQLite",
			expected:   dbutils.DBTypeSQLite,
		},
		{
			name:       "postgres lowercase",
			driverName: "postgres",
			expected:   dbutils.DBTypePostgres,
		},
		{
			name:       "postgresql",
			driverName: "postgresql",
			expected:   dbutils.DBTypePostgres,
		},
		{
			name:       "pgx",
			driverName: "pgx",
			expected:   dbutils.DBTypePostgres,
		},
		{
			name:       "pgx/v5",
			driverName: "pgx/v5/stdlib",
			expected:   dbutils.DBTypePostgres,
		},
		{
			name:       "unknown driver",
			driverName: "mysql",
			expected:   dbutils.DBTypeUnknown,
		},
		{
			name:       "empty driver",
			driverName: "",
			expected:   dbutils.DBTypeUnknown,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			result := dbutils.DetectDBTypeFromDriverName(s.driverName)
			if result != s.expected {
				t.Fatalf("Expected %v, got %v", s.expected, result)
			}
		})
	}
}

func TestDetectDBType_NilDB(t *testing.T) {
	result := dbutils.DetectDBType(nil)
	if result != dbutils.DBTypeUnknown {
		t.Fatalf("Expected DBTypeUnknown for nil db, got %v", result)
	}
}
