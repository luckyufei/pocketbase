package core_test

import (
	"context"
	"errors"
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestGenerateDefaultRandomId(t *testing.T) {
	t.Parallel()

	id1 := core.GenerateDefaultRandomId()
	id2 := core.GenerateDefaultRandomId()

	if id1 == id2 {
		t.Fatalf("Expected id1 and id2 to differ, got %q", id1)
	}

	if l := len(id1); l != 15 {
		t.Fatalf("Expected id1 length %d, got %d", 15, l)
	}

	if l := len(id2); l != 15 {
		t.Fatalf("Expected id2 length %d, got %d", 15, l)
	}
}

func TestModelQuery(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		modelsQuery := app.ModelQuery(&core.Collection{})
		logsModelQuery := app.AuxModelQuery(&core.Collection{})

		if app.ConcurrentDB() == modelsQuery.Info().Builder {
			t.Fatalf("ModelQuery() is not using app.ConcurrentDB()")
		}

		if app.AuxConcurrentDB() == logsModelQuery.Info().Builder {
			t.Fatalf("AuxModelQuery() is not using app.AuxConcurrentDB()")
		}

		// SQL 模板格式不变，只验证基本结构
		// 实际的引号字符取决于 dbx.Builder 的配置
		expectedSQL := "SELECT {{_collections}}.* FROM `_collections`"
		for i, q := range []*dbx.SelectQuery{modelsQuery, logsModelQuery} {
			sql := q.Build().SQL()
			if sql != expectedSQL {
				t.Fatalf("[%d] Expected select\n%s\ngot\n%s", i, expectedSQL, sql)
			}
		}
	})
}

func TestValidate(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		u := &mockSuperusers{}

		testErr := errors.New("test")

		app.OnModelValidate().BindFunc(func(e *core.ModelEvent) error {
			return testErr
		})

		err := app.Validate(u)
		if err != testErr {
			t.Fatalf("Expected error %v, got %v", testErr, err)
		}
	})
}

func TestValidateWithContext(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		u := &mockSuperusers{}

		testErr := errors.New("test")

		app.OnModelValidate().BindFunc(func(e *core.ModelEvent) error {
			if v := e.Context.Value("test"); v != 123 {
				t.Fatalf("Expected 'test' context value %#v, got %#v", 123, v)
			}
			return testErr
		})

		//nolint:staticcheck
		ctx := context.WithValue(context.Background(), "test", 123)

		err := app.ValidateWithContext(ctx, u)
		if err != testErr {
			t.Fatalf("Expected error %v, got %v", testErr, err)
		}
	})
}

// -------------------------------------------------------------------

type mockSuperusers struct {
	core.BaseModel
	Email string `db:"email"`
}

func (m *mockSuperusers) TableName() string {
	return core.CollectionNameSuperusers
}
