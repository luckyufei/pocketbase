// Package tests 提供 PostgreSQL 测试数据导入功能
package tests

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// ImportTestDataToPostgres 从 SQLite 测试数据库导入数据到 PostgreSQL
// 这个函数用于在 PostgreSQL 测试中导入与 SQLite 相同的测试数据
func ImportTestDataToPostgres(app *core.BaseApp) error {
	if !app.IsPostgres() {
		return nil // 不是 PostgreSQL，跳过
	}

	// 获取 SQLite 测试数据目录
	_, currentFile, _, _ := runtime.Caller(0)
	sqliteDataPath := filepath.Join(path.Dir(currentFile), "data", "data.db")

	// 检查 SQLite 数据库是否存在
	if _, err := os.Stat(sqliteDataPath); os.IsNotExist(err) {
		return fmt.Errorf("SQLite 测试数据库不存在: %s", sqliteDataPath)
	}

	log.Printf("[PostgreSQL Import] 开始从 %s 导入测试数据", sqliteDataPath)

	// 打开 SQLite 数据库（只读模式）
	sqliteDB, err := sql.Open("sqlite", sqliteDataPath+"?mode=ro")
	if err != nil {
		return fmt.Errorf("无法打开 SQLite 测试数据库: %w", err)
	}
	defer sqliteDB.Close()

	// 获取所有需要导入的表
	tables, err := getTableNames(sqliteDB)
	if err != nil {
		return fmt.Errorf("获取表列表失败: %w", err)
	}

	log.Printf("[PostgreSQL Import] 发现 %d 个表需要导入: %v", len(tables), tables)

	// 导入每个表的数据
	for _, table := range tables {
		if err := importTable(sqliteDB, app, table); err != nil {
			return fmt.Errorf("导入表 %s 失败: %w", table, err)
		}
	}

	log.Printf("[PostgreSQL Import] 数据导入完成，开始重新加载 collections")

	// 重新加载 collections 以创建视图
	if err := app.ReloadCachedCollections(); err != nil {
		log.Printf("[PostgreSQL Import] 重新加载 collections 警告: %v", err)
		// 不返回错误，因为这可能是正常的（例如视图创建可能依赖于特定的表结构）
	}

	// 创建视图 collections 对应的数据库视图
	if err := createViewsFromCollections(sqliteDB, app); err != nil {
		log.Printf("[PostgreSQL Import] 创建视图警告: %v", err)
	}

	log.Printf("[PostgreSQL Import] 完成")

	return nil
}

// createViewsFromCollections 从 SQLite 导入视图定义并在 PostgreSQL 中创建
func createViewsFromCollections(sqliteDB *sql.DB, app *core.BaseApp) error {
	// 查询 SQLite 中的视图
	rows, err := sqliteDB.Query(`
		SELECT name, sql FROM sqlite_master 
		WHERE type='view' 
		ORDER BY name
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var viewName, viewSQL string
		if err := rows.Scan(&viewName, &viewSQL); err != nil {
			return err
		}

		// SQLite 视图 SQL 不能直接在 PostgreSQL 中使用
		// 我们需要从 _collections 表获取视图的 options.query
		var viewQuery string
		err := app.ConcurrentDB().NewQuery(`
			SELECT options->>'viewQuery' FROM "_collections" WHERE name = {:name} AND type = 'view'
		`).Bind(map[string]interface{}{"name": viewName}).Row(&viewQuery)
		
		if err != nil || viewQuery == "" {
			log.Printf("[PostgreSQL Import] 跳过视图 %s: 无法获取视图查询", viewName)
			continue
		}

		// 删除已存在的视图
		app.ConcurrentDB().NewQuery(fmt.Sprintf(`DROP VIEW IF EXISTS %q`, viewName)).Execute()

		// 创建视图
		createSQL := fmt.Sprintf(`CREATE VIEW %q AS %s`, viewName, viewQuery)
		if _, err := app.ConcurrentDB().NewQuery(createSQL).Execute(); err != nil {
			log.Printf("[PostgreSQL Import] 创建视图 %s 失败: %v", viewName, err)
			continue
		}

		log.Printf("[PostgreSQL Import] 视图 %s 创建成功", viewName)
	}

	return rows.Err()
}

// getTableNames 获取 SQLite 数据库中的所有表名
func getTableNames(db *sql.DB) ([]string, error) {
	rows, err := db.Query(`
		SELECT name FROM sqlite_master 
		WHERE type='table' 
		AND name NOT LIKE 'sqlite_%'
		AND name NOT IN ('_migrations')
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}

	return tables, rows.Err()
}

// importTable 将单个表的数据从 SQLite 导入到 PostgreSQL
func importTable(sqliteDB *sql.DB, app *core.BaseApp, tableName string) error {
	// 检查 PostgreSQL 中是否存在该表
	hasTable := app.HasTable(tableName)
	if !hasTable {
		// 表不存在，可能是 view 或需要创建
		// 检查是否是视图
		var tableType string
		err := sqliteDB.QueryRow(`
			SELECT type FROM sqlite_master WHERE name = ?
		`, tableName).Scan(&tableType)
		if err != nil {
			return err
		}
		if tableType == "view" {
			// 跳过视图，视图由 PocketBase 在创建 collection 时自动创建
			return nil
		}

		// 尝试创建表
		if err := createTableInPostgres(sqliteDB, app, tableName); err != nil {
			return err
		}
	}

	// 获取 SQLite 表列信息（包括类型）
	sqliteColumns, sqliteColumnTypes, err := getTableColumnsWithTypes(sqliteDB, tableName)
	if err != nil {
		return err
	}

	if len(sqliteColumns) == 0 {
		return nil // 空表
	}

	// 获取 PostgreSQL 中存在的列
	pgColumns, err := getPostgresTableColumns(app, tableName)
	if err != nil {
		return fmt.Errorf("获取 PostgreSQL 表列失败: %w", err)
	}

	// 找出两边都有的列
	commonColumns := make([]string, 0)
	commonColumnTypes := make([]string, 0)
	for i, col := range sqliteColumns {
		for _, pgCol := range pgColumns {
			if strings.EqualFold(col, pgCol) {
				commonColumns = append(commonColumns, col)
				commonColumnTypes = append(commonColumnTypes, sqliteColumnTypes[i])
				break
			}
		}
	}

	if len(commonColumns) == 0 {
		log.Printf("[PostgreSQL Import] 表 %s 没有公共列，跳过", tableName)
		return nil
	}

	// 读取 SQLite 数据
	rows, err := sqliteDB.Query(fmt.Sprintf("SELECT %s FROM %q", strings.Join(commonColumns, ", "), tableName))
	if err != nil {
		return err
	}
	defer rows.Close()

	// 准备插入语句使用命名参数
	placeholders := make([]string, len(commonColumns))
	for i := range commonColumns {
		placeholders[i] = fmt.Sprintf("{:p%d}", i)
	}

	insertSQL := fmt.Sprintf(
		`INSERT INTO %q (%s) VALUES (%s) ON CONFLICT DO NOTHING`,
		tableName,
		strings.Join(quoteColumns(commonColumns), ", "),
		strings.Join(placeholders, ", "),
	)

	// 逐行插入数据
	rowCount := 0
	for rows.Next() {
		values := make([]interface{}, len(commonColumns))
		valuePtrs := make([]interface{}, len(commonColumns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return err
		}

		// 转换值（处理 JSON 字段、布尔值等）
		for i, v := range values {
			values[i] = convertValueForPostgres(v, commonColumnTypes[i])
		}

		if _, err := app.DB().NewQuery(insertSQL).Bind(valuesToMap(commonColumns, values)).Execute(); err != nil {
			// 忽略重复键错误
			if !strings.Contains(err.Error(), "duplicate") && !strings.Contains(err.Error(), "unique constraint") {
				return fmt.Errorf("插入数据失败 (%s): %w", tableName, err)
			}
		}
		rowCount++
	}

	log.Printf("[PostgreSQL Import] 表 %s 导入了 %d 行数据", tableName, rowCount)
	return rows.Err()
}

// getPostgresTableColumns 获取 PostgreSQL 表的列名
func getPostgresTableColumns(app *core.BaseApp, tableName string) ([]string, error) {
	var columns []string
	err := app.ConcurrentDB().NewQuery(`
		SELECT column_name 
		FROM information_schema.columns 
		WHERE LOWER(table_name) = LOWER({:tableName})
		AND table_schema = 'public'
		ORDER BY ordinal_position
	`).Bind(map[string]interface{}{"tableName": tableName}).Column(&columns)
	return columns, err
}

// getTableColumnsWithTypes 获取表的列名和类型
func getTableColumnsWithTypes(db *sql.DB, tableName string) ([]string, []string, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%q)", tableName))
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var columns []string
	var columnTypes []string
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var dfltValue interface{}
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return nil, nil, err
		}
		columns = append(columns, name)
		columnTypes = append(columnTypes, colType)
	}

	return columns, columnTypes, rows.Err()
}

// quoteColumns 引用列名
func quoteColumns(columns []string) []string {
	quoted := make([]string, len(columns))
	for i, col := range columns {
		quoted[i] = fmt.Sprintf("%q", col)
	}
	return quoted
}

// valuesToMap 将列名和值转换为 map
func valuesToMap(columns []string, values []interface{}) map[string]interface{} {
	m := make(map[string]interface{})
	for i := range columns {
		m[fmt.Sprintf("p%d", i)] = values[i]
	}
	return m
}

// convertValueForPostgres 转换 SQLite 值为 PostgreSQL 兼容格式
func convertValueForPostgres(v interface{}, colType string) interface{} {
	if v == nil {
		return nil
	}

	upperType := strings.ToUpper(colType)

	// 处理布尔值
	if strings.Contains(upperType, "BOOL") {
		switch val := v.(type) {
		case int64:
			return val != 0
		case int:
			return val != 0
		case bool:
			return val
		case string:
			return val == "1" || strings.ToLower(val) == "true"
		}
	}

	switch val := v.(type) {
	case []byte:
		str := string(val)
		// 空字符串处理
		if str == "" {
			// 对于日期时间类型，返回 epoch 时间作为占位符
			// (或者返回 nil 如果允许为空)
			return "1970-01-01T00:00:00Z"
		}
		// 尝试解析为 JSON
		if len(str) > 0 && (str[0] == '{' || str[0] == '[') {
			var js interface{}
			if err := json.Unmarshal(val, &js); err == nil {
				// 返回 JSON 字符串，PostgreSQL 会自动处理
				return str
			}
		}
		return str
	case string:
		// 空字符串处理
		if val == "" {
			// 对于日期时间类型，返回 epoch 时间作为占位符
			return "1970-01-01T00:00:00Z"
		}
		// 检查是否是 JSON
		if len(val) > 0 && (val[0] == '{' || val[0] == '[') {
			var js interface{}
			if err := json.Unmarshal([]byte(val), &js); err == nil {
				return val
			}
		}
		return val
	default:
		return val
	}
}

// createTableInPostgres 在 PostgreSQL 中创建表
func createTableInPostgres(sqliteDB *sql.DB, app *core.BaseApp, tableName string) error {
	// 获取 SQLite 表结构
	rows, err := sqliteDB.Query(fmt.Sprintf("PRAGMA table_info(%q)", tableName))
	if err != nil {
		return err
	}
	defer rows.Close()

	var columns []string
	var primaryKey string

	for rows.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var dfltValue interface{}
		if err := rows.Scan(&cid, &name, &colType, &notNull, &dfltValue, &pk); err != nil {
			return err
		}

		pgType := sqliteToPgType(colType)
		colDef := fmt.Sprintf("%q %s", name, pgType)

		if notNull == 1 {
			colDef += " NOT NULL"
		}

		if pk == 1 {
			primaryKey = name
		}

		columns = append(columns, colDef)
	}

	if primaryKey != "" {
		columns = append(columns, fmt.Sprintf("PRIMARY KEY (%q)", primaryKey))
	}

	createSQL := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %q (%s)", tableName, strings.Join(columns, ", "))

	if _, err := app.DB().NewQuery(createSQL).Execute(); err != nil {
		return err
	}

	return nil
}

// sqliteToPgType 将 SQLite 类型转换为 PostgreSQL 类型
func sqliteToPgType(sqliteType string) string {
	upperType := strings.ToUpper(sqliteType)

	switch {
	case strings.Contains(upperType, "INT"):
		return "BIGINT"
	case strings.Contains(upperType, "TEXT"), strings.Contains(upperType, "CHAR"), strings.Contains(upperType, "CLOB"):
		return "TEXT"
	case strings.Contains(upperType, "BLOB"):
		return "BYTEA"
	case strings.Contains(upperType, "REAL"), strings.Contains(upperType, "FLOA"), strings.Contains(upperType, "DOUB"):
		return "DOUBLE PRECISION"
	case strings.Contains(upperType, "BOOL"):
		return "BOOLEAN"
	case strings.Contains(upperType, "JSON"):
		return "JSONB"
	default:
		return "TEXT"
	}
}
