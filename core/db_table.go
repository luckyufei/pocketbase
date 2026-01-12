package core

import (
	"database/sql"
	"fmt"

	"github.com/pocketbase/dbx"
)

// TableColumns returns all column names of a single table by its name.
func (app *BaseApp) TableColumns(tableName string) ([]string, error) {
	// 如果使用 PostgreSQL，通过适配器查询
	if app.IsPostgres() {
		return app.DBAdapter().TableColumns(tableName)
	}

	// SQLite: 使用 PRAGMA
	columns := []string{}
	err := app.ConcurrentDB().NewQuery("SELECT name FROM PRAGMA_TABLE_INFO({:tableName})").
		Bind(dbx.Params{"tableName": tableName}).
		Column(&columns)

	return columns, err
}

type TableInfoRow struct {
	// the `db:"pk"` tag has special semantic so we cannot rename
	// the original field without specifying a custom mapper
	PK int

	Index        int            `db:"cid"`
	Name         string         `db:"name"`
	Type         string         `db:"type"`
	NotNull      bool           `db:"notnull"`
	DefaultValue sql.NullString `db:"dflt_value"`
}

// TableInfo returns the "table_info" pragma result for the specified table.
func (app *BaseApp) TableInfo(tableName string) ([]*TableInfoRow, error) {
	// 如果使用 PostgreSQL，通过适配器查询
	if app.IsPostgres() {
		adapterInfo, err := app.DBAdapter().TableInfo(tableName)
		if err != nil {
			return nil, err
		}

		// 转换为 TableInfoRow 格式
		info := make([]*TableInfoRow, len(adapterInfo))
		for i, row := range adapterInfo {
			info[i] = &TableInfoRow{
				Index:   row.CID,
				Name:    row.Name,
				Type:    row.Type,
				NotNull: row.NotNull,
				PK:      row.PK,
			}
			if row.DefaultVal != nil {
				if defaultStr, ok := row.DefaultVal.(string); ok && defaultStr != "" {
					info[i].DefaultValue = sql.NullString{String: defaultStr, Valid: true}
				}
			}
		}
		return info, nil
	}

	// SQLite: 使用 PRAGMA
	info := []*TableInfoRow{}

	err := app.ConcurrentDB().NewQuery("SELECT * FROM PRAGMA_TABLE_INFO({:tableName})").
		Bind(dbx.Params{"tableName": tableName}).
		All(&info)
	if err != nil {
		return nil, err
	}

	// mattn/go-sqlite3 doesn't throw an error on invalid or missing table
	// so we additionally have to check whether the loaded info result is nonempty
	if len(info) == 0 {
		return nil, fmt.Errorf("empty table info probably due to invalid or missing table %s", tableName)
	}

	return info, nil
}

// TableIndexes returns a name grouped map with all non empty index of the specified table.
//
// Note: This method doesn't return an error on nonexisting table.
func (app *BaseApp) TableIndexes(tableName string) (map[string]string, error) {
	// 如果使用 PostgreSQL，通过适配器查询
	if app.IsPostgres() {
		return app.DBAdapter().TableIndexes(tableName)
	}

	// SQLite: 查询 sqlite_master
	indexes := []struct {
		Name string
		Sql  string
	}{}

	err := app.ConcurrentDB().Select("name", "sql").
		From("sqlite_master").
		AndWhere(dbx.NewExp("sql is not null")).
		AndWhere(dbx.HashExp{
			"type":     "index",
			"tbl_name": tableName,
		}).
		All(&indexes)
	if err != nil {
		return nil, err
	}

	result := make(map[string]string, len(indexes))

	for _, idx := range indexes {
		result[idx.Name] = idx.Sql
	}

	return result, nil
}

// DeleteTable drops the specified table.
//
// This method is a no-op if a table with the provided name doesn't exist.
//
// NB! Be aware that this method is vulnerable to SQL injection and the
// "tableName" argument must come only from trusted input!
func (app *BaseApp) DeleteTable(tableName string) error {
	_, err := app.NonconcurrentDB().NewQuery(fmt.Sprintf(
		"DROP TABLE IF EXISTS {{%s}}",
		tableName,
	)).Execute()

	return err
}

// HasTable checks if a table (or view) with the provided name exists (case insensitive).
// in the data.db.
func (app *BaseApp) HasTable(tableName string) bool {
	return app.hasTable(app.ConcurrentDB(), tableName)
}

// AuxHasTable checks if a table (or view) with the provided name exists (case insensitive)
// in the auixiliary.db.
func (app *BaseApp) AuxHasTable(tableName string) bool {
	return app.hasTable(app.AuxConcurrentDB(), tableName)
}

func (app *BaseApp) hasTable(db dbx.Builder, tableName string) bool {
	// 如果使用 PostgreSQL，直接查询 information_schema
	if app.IsPostgres() {
		var exists bool
		err := db.NewQuery(`
			SELECT EXISTS (
				SELECT 1 
				FROM information_schema.tables 
				WHERE LOWER(table_name) = LOWER({:tableName})
				AND table_schema = 'public'
			)
		`).Bind(dbx.Params{"tableName": tableName}).Row(&exists)
		return err == nil && exists
	}

	// SQLite: 查询 sqlite_schema
	var exists int

	err := db.Select("(1)").
		From("sqlite_schema").
		AndWhere(dbx.HashExp{"type": []any{"table", "view"}}).
		AndWhere(dbx.NewExp("LOWER([[name]])=LOWER({:tableName})", dbx.Params{"tableName": tableName})).
		Limit(1).
		Row(&exists)

	return err == nil && exists > 0
}

// Vacuum executes VACUUM on the data.db in order to reclaim unused data db disk space.
func (app *BaseApp) Vacuum() error {
	return app.vacuum(app.NonconcurrentDB())
}

// AuxVacuum executes VACUUM on the auxiliary.db in order to reclaim unused auxiliary db disk space.
func (app *BaseApp) AuxVacuum() error {
	return app.vacuum(app.AuxNonconcurrentDB())
}

func (app *BaseApp) vacuum(db dbx.Builder) error {
	// 如果使用 PostgreSQL，通过适配器执行
	if app.IsPostgres() {
		return app.DBAdapter().Vacuum()
	}

	// SQLite: 直接执行 VACUUM
	_, err := db.NewQuery("VACUUM").Execute()

	return err
}
