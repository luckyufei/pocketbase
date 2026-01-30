package tests

import (
	"net/http"
	"testing"
)

// TestRecordListBothDBs 示例：使用 TestBothDBs 在双数据库上运行测试
// 这是推荐的写法，现有测试可以逐步迁移到这种模式
func TestRecordListBothDBs(t *testing.T) {
	t.Parallel()

	scenarios := []ApiScenario{
		{
			Name:           "demo2 列表 - 公开访问",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records",
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
				`"page":1`,
				`"perPage":30`,
			},
			NotExpectedContent: []string{
				`"SQLSTATE"`,
			},
		},
		{
			Name:           "demo2 列表 - 带分页",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records?page=1&perPage=10",
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"page":1`,
				`"perPage":10`,
			},
		},
		{
			Name:           "demo2 列表 - 带排序",
			Method:         http.MethodGet,
			URL:            "/api/collections/demo2/records?sort=-created",
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"items":[`,
			},
		},
	}

	// 使用新的 TestBothDBs 方法
	for _, scenario := range scenarios {
		scenario.TestBothDBs(t)
	}
}

// TestRecordViewBothDBs 示例：单条记录查看
func TestRecordViewBothDBs(t *testing.T) {
	t.Parallel()

	scenario := ApiScenario{
		Name:           "demo2 单条记录",
		Method:         http.MethodGet,
		URL:            "/api/collections/demo2/records/achvryl401bhse3",
		ExpectedStatus: 200,
		ExpectedContent: []string{
			`"id":"achvryl401bhse3"`,
		},
		NotExpectedContent: []string{
			`"SQLSTATE"`,
		},
	}

	scenario.TestBothDBs(t)
}

// TestCollectionListBothDBs 示例：集合列表（需要 superuser 权限）
func TestCollectionListBothDBs(t *testing.T) {
	t.Parallel()

	scenario := ApiScenario{
		Name:   "集合列表 - superuser",
		Method: http.MethodGet,
		URL:    "/api/collections",
		Headers: map[string]string{
			"Authorization": "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InN5d2JoZWNuaDQ2cmhtMCIsInR5cGUiOiJhdXRoIiwiY29sbGVjdGlvbklkIjoicGJjXzMxNDI2MzU4MjMiLCJleHAiOjI1MjQ2MDQ0NjEsInJlZnJlc2hhYmxlIjp0cnVlfQ.UXgO3j-0BumcugrFjbd7j0M4MQvbrLggLlcu_YNGjoY",
		},
		ExpectedStatus: 200,
		ExpectedContent: []string{
			`"items":[`,
		},
	}

	scenario.TestBothDBs(t)
}
