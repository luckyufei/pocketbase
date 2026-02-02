package core_test

import (
	"slices"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestFindAllMFAsByRecord(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		if err := tests.StubMFARecords(app); err != nil {
			t.Fatal(err)
		}

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

		user1, err := app.FindAuthRecordByEmail("users", "test@example.com")
		if err != nil {
			t.Fatal(err)
		}

		scenarios := []struct {
			record   *core.Record
			expected []string
		}{
			{demo1, nil},
			{superuser2, []string{"superuser2_0", "superuser2_3", "superuser2_2", "superuser2_1", "superuser2_4"}},
			{superuser4, nil},
			{user1, []string{"user1_0"}},
		}

		for _, s := range scenarios {
			t.Run(s.record.Collection().Name+"_"+s.record.Id, func(t *testing.T) {
				result, err := app.FindAllMFAsByRecord(s.record)
				if err != nil {
					t.Fatal(err)
				}

				if len(result) != len(s.expected) {
					t.Fatalf("Expected total mfas %d, got %d", len(s.expected), len(result))
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

func TestFindAllMFAsByCollection(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		if err := tests.StubMFARecords(app); err != nil {
			t.Fatal(err)
		}

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

		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			t.Fatal(err)
		}

		scenarios := []struct {
			collection *core.Collection
			expected   []string
		}{
			{demo1, nil},
			{superusers, []string{
				"superuser2_0",
				"superuser2_3",
				"superuser3_0",
				"superuser2_2",
				"superuser3_1",
				"superuser2_1",
				"superuser2_4",
			}},
			{clients, nil},
			{users, []string{"user1_0"}},
		}

		for _, s := range scenarios {
			t.Run(s.collection.Name, func(t *testing.T) {
				result, err := app.FindAllMFAsByCollection(s.collection)
				if err != nil {
					t.Fatal(err)
				}

				if len(result) != len(s.expected) {
					t.Fatalf("Expected total mfas %d, got %d", len(s.expected), len(result))
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

func TestFindMFAById(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		if err := tests.StubMFARecords(app); err != nil {
			t.Fatal(err)
		}

		scenarios := []struct {
			id          string
			expectError bool
		}{
			{"", true},
			{"84nmscqy84lsi1t", true}, // non-mfa id
			{"superuser2_0", false},
			{"superuser2_4", false}, // expired
			{"user1_0", false},
		}

		for _, s := range scenarios {
			t.Run(s.id, func(t *testing.T) {
				result, err := app.FindMFAById(s.id)

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

func TestDeleteAllMFAsByRecord(t *testing.T) {
	// 定义测试场景 - 这些需要在 DualDBTest 外部定义
	// 因为每个场景需要独立的 app 实例（删除操作会修改数据库状态）
	scenarios := []struct {
		name           string
		recordFinder   func(app *tests.TestApp) (*core.Record, error)
		deletedIds     []string
	}{
		{
			"0_demo1_non_auth",
			func(app *tests.TestApp) (*core.Record, error) {
				return app.FindRecordById("demo1", "84nmscqy84lsi1t")
			},
			nil,
		},
		{
			"1_superuser2",
			func(app *tests.TestApp) (*core.Record, error) {
				return app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test2@example.com")
			},
			[]string{"superuser2_0", "superuser2_1", "superuser2_3", "superuser2_2", "superuser2_4"},
		},
		{
			"2_superuser4",
			func(app *tests.TestApp) (*core.Record, error) {
				return app.FindAuthRecordByEmail(core.CollectionNameSuperusers, "test4@example.com")
			},
			nil,
		},
		{
			"3_user1",
			func(app *tests.TestApp) (*core.Record, error) {
				return app.FindAuthRecordByEmail("users", "test@example.com")
			},
			[]string{"user1_0"},
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			// 每个场景创建独立的 DualDBTest 实例
			tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
				if err := tests.StubMFARecords(app); err != nil {
					t.Fatal(err)
				}

				record, err := s.recordFinder(app)
				if err != nil {
					t.Fatal(err)
				}

				deletedIds := []string{}
				app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
					deletedIds = append(deletedIds, e.Record.Id)
					return e.Next()
				})

				err = app.DeleteAllMFAsByRecord(record)
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
		})
	}
}

func TestDeleteExpiredMFAs(t *testing.T) {
	checkDeletedIds := func(app core.App, t *testing.T, expectedDeletedIds []string) {
		if err := tests.StubMFARecords(app); err != nil {
			t.Fatal(err)
		}

		deletedIds := []string{}
		app.OnRecordDelete().BindFunc(func(e *core.RecordEvent) error {
			deletedIds = append(deletedIds, e.Record.Id)
			return e.Next()
		})

		if err := app.DeleteExpiredMFAs(); err != nil {
			t.Fatal(err)
		}

		if len(deletedIds) != len(expectedDeletedIds) {
			t.Fatalf("Expected deleted ids\n%v\ngot\n%v", expectedDeletedIds, deletedIds)
		}

		for _, id := range expectedDeletedIds {
			if !slices.Contains(deletedIds, id) {
				t.Errorf("Expected to find deleted id %q in %v", id, deletedIds)
			}
		}
	}

	t.Run("default test collections", func(t *testing.T) {
		tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
			checkDeletedIds(app, t, []string{
				"user1_0",
				"superuser2_1",
				"superuser2_4",
			})
		})
	})

	t.Run("mfa collection duration mock", func(t *testing.T) {
		tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
			superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
			if err != nil {
				t.Fatal(err)
			}
			superusers.MFA.Duration = 60
			if err := app.Save(superusers); err != nil {
				t.Fatalf("Failed to mock superusers mfa duration: %v", err)
			}

			checkDeletedIds(app, t, []string{
				"user1_0",
				"superuser2_1",
				"superuser2_2",
				"superuser2_4",
				"superuser3_1",
			})
		})
	})
}
