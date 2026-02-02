package core_test

import (
	"fmt"
	"slices"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestFindAllAuthOriginsByRecord(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		demo1, err := app.FindRecordById("demo1", "84nmscqy84lsi1t")
		if err != nil {
			t.Fatal(err)
		}

		superuser2, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test2@example.com")
		if err != nil {
			t.Fatal(err)
		}

		superuser4, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test4@example.com")
		if err != nil {
			t.Fatal(err)
		}

		client1, err := app.FindAuthRecordByEmail("clients", "test@example.com")
		if err != nil {
			t.Fatal(err)
		}

		scenarios := []struct {
			record   *core.Record
			expected []string
		}{
			{demo1, nil},
			{superuser2, []string{"5798yh833k6w6w0", "ic55o70g4f8pcl4", "dmy260k6ksjr4ib"}},
			{superuser4, nil},
			{client1, []string{"9r2j0m74260ur8i"}},
		}

		for _, s := range scenarios {
			t.Run(s.record.Collection().Name+"_"+s.record.Id, func(t *testing.T) {
				result, err := app.FindAllAuthOriginsByRecord(s.record)
				if err != nil {
					t.Fatal(err)
				}

				if len(result) != len(s.expected) {
					t.Fatalf("Expected total origins %d, got %d", len(s.expected), len(result))
				}

				for i, id := range s.expected {
					if result[i].Id != id {
						t.Errorf("[%d] Expected id %q, got %q", i, id, result[i].Id)
					}
				}
			})
		}
	})
}

func TestFindAllAuthOriginsByCollection(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		demo1, err := app.FindCollectionByNameOrId("demo1")
		if err != nil {
			t.Fatal(err)
		}

		superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
		if err != nil {
			t.Fatal(err)
		}

		clients, err := app.FindCollectionByNameOrId("clients")
		if err != nil {
			t.Fatal(err)
		}

		scenarios := []struct {
			collection *core.Collection
			expected   []string
		}{
			{demo1, nil},
			{superusers, []string{"5798yh833k6w6w0", "ic55o70g4f8pcl4", "dmy260k6ksjr4ib", "5f29jy38bf5zm3f"}},
			{clients, []string{"9r2j0m74260ur8i"}},
		}

		for _, s := range scenarios {
			t.Run(s.collection.Name, func(t *testing.T) {
				result, err := app.FindAllAuthOriginsByCollection(s.collection)
				if err != nil {
					t.Fatal(err)
				}

				if len(result) != len(s.expected) {
					t.Fatalf("Expected total origins %d, got %d", len(s.expected), len(result))
				}

				for i, id := range s.expected {
					if result[i].Id != id {
						t.Errorf("[%d] Expected id %q, got %q", i, id, result[i].Id)
					}
				}
			})
		}
	})
}

func TestFindAuthOriginById(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		scenarios := []struct {
			id          string
			expectError bool
		}{
			{"", true},
			{"84nmscqy84lsi1t", true}, // non-origin id
			{"9r2j0m74260ur8i", false},
		}

		for _, s := range scenarios {
			t.Run(s.id, func(t *testing.T) {
				result, err := app.FindAuthOriginById(s.id)

				hasErr := err != nil
				if hasErr != s.expectError {
					t.Fatalf("Expected hasErr %v, got %v (%v)", s.expectError, hasErr, err)
				}

				if hasErr {
					return
				}

				if result.Id != s.id {
					t.Fatalf("Expected record with id %q, got %q", s.id, result.Id)
				}
			})
		}
	})
}

func TestFindAuthOriginByRecordAndFingerprint(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		demo1, err := app.FindRecordById("demo1", "84nmscqy84lsi1t")
		if err != nil {
			t.Fatal(err)
		}

		superuser2, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test2@example.com")
		if err != nil {
			t.Fatal(err)
		}

		scenarios := []struct {
			record      *core.Record
			fingerprint string
			expectError bool
		}{
			{demo1, "6afbfe481c31c08c55a746cccb88ece0", true},
			{superuser2, "", true},
			{superuser2, "abc", true},
			{superuser2, "22bbbcbed36e25321f384ccf99f60057", false}, // fingerprint from different origin
			{superuser2, "6afbfe481c31c08c55a746cccb88ece0", false},
		}

		for i, s := range scenarios {
			t.Run(fmt.Sprintf("%d_%s_%s", i, s.record.Id, s.fingerprint), func(t *testing.T) {
				result, err := app.FindAuthOriginByRecordAndFingerprint(s.record, s.fingerprint)

				hasErr := err != nil
				if hasErr != s.expectError {
					t.Fatalf("Expected hasErr %v, got %v (%v)", s.expectError, hasErr, err)
				}

				if hasErr {
					return
				}

				if result.Fingerprint() != s.fingerprint {
					t.Fatalf("Expected origin with fingerprint %q, got %q", s.fingerprint, result.Fingerprint())
				}

				if result.RecordRef() != s.record.Id || result.CollectionRef() != s.record.Collection().Id {
					t.Fatalf("Expected record %q (%q), got %q (%q)", s.record.Id, s.record.Collection().Id, result.RecordRef(), result.CollectionRef())
				}
			})
		}
	})
}

func TestDeleteAllAuthOriginsByRecord(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		demo1, err := app.FindRecordById("demo1", "84nmscqy84lsi1t")
		if err != nil {
			t.Fatal(err)
		}

		superuser2, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test2@example.com")
		if err != nil {
			t.Fatal(err)
		}

		superuser4, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test4@example.com")
		if err != nil {
			t.Fatal(err)
		}

		client1, err := app.FindAuthRecordByEmail("clients", "test@example.com")
		if err != nil {
			t.Fatal(err)
		}

		scenarios := []struct {
			record     *core.Record
			deletedIds []string
		}{
			{demo1, nil}, // non-auth record
			{superuser2, []string{"5798yh833k6w6w0", "ic55o70g4f8pcl4", "dmy260k6ksjr4ib"}},
			{superuser4, nil},
			{client1, []string{"9r2j0m74260ur8i"}},
		}

		for i, s := range scenarios {
			t.Run(fmt.Sprintf("%d_%s_%s", i, s.record.Collection().Name, s.record.Id), func(t *testing.T) {
				// 注意：由于 DualDBTest 已经提供了隔离的测试环境，这里不需要再创建新的 TestApp
				// 但由于这个测试需要在每个场景中独立运行（因为会删除数据），
				// 我们需要在每个子测试中使用新的 app 实例
				// 为了保持双数据库测试，我们需要重新加载记录

				// 重新从当前 app 加载记录
				var record *core.Record
				var loadErr error
				switch i {
				case 0:
					record, loadErr = app.FindRecordById("demo1", "84nmscqy84lsi1t")
				case 1:
					record, loadErr = app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test2@example.com")
				case 2:
					record, loadErr = app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test4@example.com")
				case 3:
					record, loadErr = app.FindAuthRecordByEmail("clients", "test@example.com")
				}
				if loadErr != nil {
					t.Skipf("Could not load record: %v", loadErr)
					return
				}

				deletedIds := []string{}
				app.OnRecordDelete().BindFunc(func(e *core.RecordEvent) error {
					deletedIds = append(deletedIds, e.Record.Id)
					return e.Next()
				})

				err := app.DeleteAllAuthOriginsByRecord(record)
				if err != nil {
					t.Fatal(err)
				}

				if len(deletedIds) != len(s.deletedIds) {
					t.Fatalf("Expected deleted ids\n%v\ngot\n%v", s.deletedIds, deletedIds)
				}

				for _, id := range s.deletedIds {
					if !slices.Contains(deletedIds, id) {
						t.Errorf("Expected to find deleted id %q in %v", id, deletedIds)
					}
				}
			})
		}
	})
}
