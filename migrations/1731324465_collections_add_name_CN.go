package migrations

import (
	"github.com/pocketbase/dbx"
)

// adds nameCN column to _collection table
func init() {
	AppMigrations.Register(func(db dbx.Builder) error {
		_, tablesError := db.NewQuery(`
		ALTER TABLE {{_collections}} ADD COLUMN nameCN TEXT DEFAULT "" NOT NULL;
		UPDATE {{_collections}} SET nameCN = '' WHERE nameCN IS NULL;
		`).Execute()

		if tablesError != nil {
			return tablesError
		}
		return nil
	}, nil)
}
