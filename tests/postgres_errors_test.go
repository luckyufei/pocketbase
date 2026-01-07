package tests_test

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/pocketbase/pocketbase/tests"
	"github.com/pocketbase/pocketbase/tools/dbutils"
)

// PostgreSQL 错误码常量
// 参考: https://www.postgresql.org/docs/current/errcodes-appendix.html
const (
	// Class 23 — Integrity Constraint Violation
	PGErrUniqueViolation     = "23505"
	PGErrForeignKeyViolation = "23503"
	PGErrNotNullViolation    = "23502"
	PGErrCheckViolation      = "23514"

	// Class 42 — Syntax Error or Access Rule Violation
	PGErrUndefinedTable    = "42P01"
	PGErrUndefinedColumn   = "42703"
	PGErrSyntaxError       = "42601"
	PGErrDuplicateTable    = "42P07"
	PGErrDuplicateColumn   = "42701"
	PGErrInsufficientPriv  = "42501"

	// Class 22 — Data Exception
	PGErrInvalidTextRep    = "22P02"
	PGErrNumericValueOOR   = "22003"
	PGErrStringDataTooLong = "22001"

	// Class 40 — Transaction Rollback
	PGErrDeadlockDetected  = "40P01"
	PGErrSerializationFail = "40001"
)

// getPGErrorCode 从错误中提取 PostgreSQL 错误码
func getPGErrorCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

// TestPostgres_ErrorCodes 测试 PostgreSQL 错误码
func TestPostgres_ErrorCodes(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE error_test (
			id SERIAL PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			email TEXT NOT NULL CHECK (email LIKE '%@%'),
			age INTEGER CHECK (age >= 0 AND age <= 150)
		);
		
		CREATE TABLE error_ref (
			id SERIAL PRIMARY KEY,
			error_test_id INTEGER REFERENCES error_test(id)
		);
		
		INSERT INTO error_test (name, email, age) VALUES ('Alice', 'alice@example.com', 30);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 测试唯一约束违反
	t.Run("unique_violation", func(t *testing.T) {
		_, err := container.DB().Exec(`
			INSERT INTO error_test (name, email, age) VALUES ('Alice', 'other@example.com', 25)
		`)
		if err == nil {
			t.Fatal("expected unique violation error")
		}

		code := getPGErrorCode(err)
		if code != PGErrUniqueViolation {
			t.Errorf("expected error code %s, got %s", PGErrUniqueViolation, code)
		}
	})

	// 测试外键约束违反
	t.Run("foreign_key_violation", func(t *testing.T) {
		_, err := container.DB().Exec(`
			INSERT INTO error_ref (error_test_id) VALUES (9999)
		`)
		if err == nil {
			t.Fatal("expected foreign key violation error")
		}

		code := getPGErrorCode(err)
		if code != PGErrForeignKeyViolation {
			t.Errorf("expected error code %s, got %s", PGErrForeignKeyViolation, code)
		}
	})

	// 测试非空约束违反
	t.Run("not_null_violation", func(t *testing.T) {
		_, err := container.DB().Exec(`
			INSERT INTO error_test (name, email, age) VALUES (NULL, 'test@example.com', 25)
		`)
		if err == nil {
			t.Fatal("expected not null violation error")
		}

		code := getPGErrorCode(err)
		if code != PGErrNotNullViolation {
			t.Errorf("expected error code %s, got %s", PGErrNotNullViolation, code)
		}
	})

	// 测试检查约束违反
	t.Run("check_violation", func(t *testing.T) {
		// 无效的邮箱格式
		_, err := container.DB().Exec(`
			INSERT INTO error_test (name, email, age) VALUES ('Bob', 'invalid-email', 25)
		`)
		if err == nil {
			t.Fatal("expected check violation error")
		}

		code := getPGErrorCode(err)
		if code != PGErrCheckViolation {
			t.Errorf("expected error code %s, got %s", PGErrCheckViolation, code)
		}

		// 无效的年龄
		_, err = container.DB().Exec(`
			INSERT INTO error_test (name, email, age) VALUES ('Charlie', 'charlie@example.com', -1)
		`)
		if err == nil {
			t.Fatal("expected check violation error for age")
		}

		code = getPGErrorCode(err)
		if code != PGErrCheckViolation {
			t.Errorf("expected error code %s, got %s", PGErrCheckViolation, code)
		}
	})

	// 测试未定义表
	t.Run("undefined_table", func(t *testing.T) {
		_, err := container.DB().Exec(`SELECT * FROM nonexistent_table`)
		if err == nil {
			t.Fatal("expected undefined table error")
		}

		code := getPGErrorCode(err)
		if code != PGErrUndefinedTable {
			t.Errorf("expected error code %s, got %s", PGErrUndefinedTable, code)
		}
	})

	// 测试未定义列
	t.Run("undefined_column", func(t *testing.T) {
		_, err := container.DB().Exec(`SELECT nonexistent_column FROM error_test`)
		if err == nil {
			t.Fatal("expected undefined column error")
		}

		code := getPGErrorCode(err)
		if code != PGErrUndefinedColumn {
			t.Errorf("expected error code %s, got %s", PGErrUndefinedColumn, code)
		}
	})

	// 测试语法错误
	t.Run("syntax_error", func(t *testing.T) {
		_, err := container.DB().Exec(`SELEC * FROM error_test`)
		if err == nil {
			t.Fatal("expected syntax error")
		}

		code := getPGErrorCode(err)
		if code != PGErrSyntaxError {
			t.Errorf("expected error code %s, got %s", PGErrSyntaxError, code)
		}
	})

	// 测试重复表
	t.Run("duplicate_table", func(t *testing.T) {
		_, err := container.DB().Exec(`CREATE TABLE error_test (id SERIAL)`)
		if err == nil {
			t.Fatal("expected duplicate table error")
		}

		code := getPGErrorCode(err)
		if code != PGErrDuplicateTable {
			t.Errorf("expected error code %s, got %s", PGErrDuplicateTable, code)
		}
	})

	// 测试无效的文本表示
	t.Run("invalid_text_representation", func(t *testing.T) {
		_, err := container.DB().Exec(`SELECT 'not_a_number'::integer`)
		if err == nil {
			t.Fatal("expected invalid text representation error")
		}

		code := getPGErrorCode(err)
		if code != PGErrInvalidTextRep {
			t.Errorf("expected error code %s, got %s", PGErrInvalidTextRep, code)
		}
	})
}

// TestPostgres_ErrorHandling 测试错误处理辅助函数
func TestPostgres_ErrorHandling(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 测试 IsUniqueViolation
	t.Run("IsUniqueViolation", func(t *testing.T) {
		err := container.ExecSQL(`
			CREATE TABLE unique_test (id SERIAL PRIMARY KEY, name TEXT UNIQUE);
			INSERT INTO unique_test (name) VALUES ('test');
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		_, err = container.DB().Exec(`INSERT INTO unique_test (name) VALUES ('test')`)
		if err == nil {
			t.Fatal("expected error")
		}

		if !dbutils.IsUniqueViolation(err) {
			t.Error("expected IsUniqueViolation to return true")
		}

		// 测试非唯一约束错误
		_, err = container.DB().Exec(`SELECT * FROM nonexistent`)
		if err == nil {
			t.Fatal("expected error")
		}

		if dbutils.IsUniqueViolation(err) {
			t.Error("expected IsUniqueViolation to return false for non-unique error")
		}
	})

	// 测试 IsForeignKeyViolation
	t.Run("IsForeignKeyViolation", func(t *testing.T) {
		err := container.ExecSQL(`
			CREATE TABLE fk_parent (id SERIAL PRIMARY KEY);
			CREATE TABLE fk_child (id SERIAL PRIMARY KEY, parent_id INTEGER REFERENCES fk_parent(id));
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		_, err = container.DB().Exec(`INSERT INTO fk_child (parent_id) VALUES (9999)`)
		if err == nil {
			t.Fatal("expected error")
		}

		if !dbutils.IsForeignKeyViolation(err) {
			t.Error("expected IsForeignKeyViolation to return true")
		}
	})

	// 测试 IsNotNullViolation
	t.Run("IsNotNullViolation", func(t *testing.T) {
		err := container.ExecSQL(`
			CREATE TABLE notnull_test (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
		`)
		if err != nil {
			t.Fatalf("创建表失败: %v", err)
		}

		_, err = container.DB().Exec(`INSERT INTO notnull_test (name) VALUES (NULL)`)
		if err == nil {
			t.Fatal("expected error")
		}

		if !dbutils.IsNotNullViolation(err) {
			t.Error("expected IsNotNullViolation to return true")
		}
	})
}

// TestPostgres_TransactionErrors 测试事务相关错误
func TestPostgres_TransactionErrors(t *testing.T) {
	skipIfNoDocker(t)

	container, err := tests.NewPostgresContainer(tests.PostgresConfig{
		Version: "15",
	})
	if err != nil {
		t.Fatalf("创建 PostgreSQL 容器失败: %v", err)
	}
	defer container.Close()

	// 创建测试表
	err = container.ExecSQL(`
		CREATE TABLE tx_test (
			id SERIAL PRIMARY KEY,
			value INTEGER NOT NULL
		);
		INSERT INTO tx_test (value) VALUES (100);
	`)
	if err != nil {
		t.Fatalf("创建测试表失败: %v", err)
	}

	// 测试事务中的错误回滚
	t.Run("transaction_error_rollback", func(t *testing.T) {
		tx, err := container.DB().Begin()
		if err != nil {
			t.Fatalf("开始事务失败: %v", err)
		}

		// 正常操作
		_, err = tx.Exec(`UPDATE tx_test SET value = 200 WHERE id = 1`)
		if err != nil {
			tx.Rollback()
			t.Fatalf("更新失败: %v", err)
		}

		// 触发错误
		_, err = tx.Exec(`INSERT INTO nonexistent_table VALUES (1)`)
		if err == nil {
			tx.Rollback()
			t.Fatal("expected error")
		}

		// 事务应该回滚
		tx.Rollback()

		// 验证值未改变
		var value int
		err = container.DB().QueryRow(`SELECT value FROM tx_test WHERE id = 1`).Scan(&value)
		if err != nil {
			t.Fatalf("查询失败: %v", err)
		}
		if value != 100 {
			t.Errorf("expected value 100, got %d (rollback failed)", value)
		}
	})

	// 测试事务隔离
	t.Run("transaction_isolation", func(t *testing.T) {
		// 开始两个事务
		tx1, err := container.DB().Begin()
		if err != nil {
			t.Fatalf("开始事务1失败: %v", err)
		}
		defer tx1.Rollback()

		tx2, err := container.DB().Begin()
		if err != nil {
			t.Fatalf("开始事务2失败: %v", err)
		}
		defer tx2.Rollback()

		// tx1 更新值
		_, err = tx1.Exec(`UPDATE tx_test SET value = 300 WHERE id = 1`)
		if err != nil {
			t.Fatalf("tx1 更新失败: %v", err)
		}

		// tx2 应该看到旧值 (READ COMMITTED 默认隔离级别)
		var value int
		err = tx2.QueryRow(`SELECT value FROM tx_test WHERE id = 1`).Scan(&value)
		if err != nil {
			t.Fatalf("tx2 查询失败: %v", err)
		}
		if value != 100 {
			t.Errorf("tx2 should see old value 100, got %d", value)
		}

		// tx1 提交
		err = tx1.Commit()
		if err != nil {
			t.Fatalf("tx1 提交失败: %v", err)
		}

		// tx2 现在应该看到新值
		err = tx2.QueryRow(`SELECT value FROM tx_test WHERE id = 1`).Scan(&value)
		if err != nil {
			t.Fatalf("tx2 再次查询失败: %v", err)
		}
		if value != 300 {
			t.Errorf("tx2 should see new value 300, got %d", value)
		}
	})
}

// TestPostgres_ConnectionErrors 测试连接相关错误
func TestPostgres_ConnectionErrors(t *testing.T) {
	// 测试无效 DSN
	t.Run("invalid_dsn", func(t *testing.T) {
		_, err := sql.Open("pgx", "postgres://invalid:invalid@localhost:99999/invalid")
		if err != nil {
			// sql.Open 不会立即连接，所以可能不会报错
			t.Logf("sql.Open error: %v", err)
		}

		// 实际连接时会报错
		db, _ := sql.Open("pgx", "postgres://invalid:invalid@localhost:99999/invalid")
		if db != nil {
			err = db.Ping()
			if err == nil {
				t.Error("expected connection error")
			}
			db.Close()
		}
	})
}
