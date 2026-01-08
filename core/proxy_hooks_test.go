package core_test

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestProxyValidationHook(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 确保 _proxies collection 存在
	col, err := app.FindCollectionByNameOrId(core.CollectionNameProxies)
	if err != nil {
		t.Skip("_proxies collection not found, skipping hook test")
	}

	testCases := []struct {
		name      string
		path      string
		upstream  string
		expectErr bool
	}{
		// 有效路径
		{"valid gateway path", "/-/openai", "https://api.openai.com", false},
		{"valid webhook path", "/webhooks/stripe", "https://internal.example.com", false},

		// 无效路径
		{"invalid api path", "/api/users", "https://example.com", true},
		{"invalid admin path", "/_/admin", "https://example.com", true},
		{"empty path", "", "https://example.com", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			record := core.NewRecord(col)
			record.Set(core.ProxyFieldPath, tc.path)
			record.Set(core.ProxyFieldUpstream, tc.upstream)
			record.Set(core.ProxyFieldStripPath, true)
			record.Set(core.ProxyFieldTimeout, 30)
			record.Set(core.ProxyFieldActive, true)

			err := app.Validate(record)
			if tc.expectErr && err == nil {
				t.Errorf("expected validation error for path %q, got nil", tc.path)
			}
			if !tc.expectErr && err != nil {
				t.Errorf("expected no validation error for path %q, got %v", tc.path, err)
			}
		})
	}
}

func TestProxyHotReload(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	// 获取 ProxyManager
	pm := app.ProxyManager()
	if pm == nil {
		t.Skip("ProxyManager not available")
	}

	// 初始状态应该没有代理
	if proxy := pm.MatchProxy("/-/test"); proxy != nil {
		t.Error("expected no proxy initially")
	}

	// 创建一个代理记录
	col, err := app.FindCollectionByNameOrId(core.CollectionNameProxies)
	if err != nil {
		t.Skip("_proxies collection not found")
	}

	record := core.NewRecord(col)
	record.Set(core.ProxyFieldPath, "/-/test")
	record.Set(core.ProxyFieldUpstream, "https://example.com")
	record.Set(core.ProxyFieldStripPath, true)
	record.Set(core.ProxyFieldTimeout, 30)
	record.Set(core.ProxyFieldActive, true)

	if err := app.Save(record); err != nil {
		t.Fatalf("failed to save proxy record: %v", err)
	}

	// Hot Reload 现在是同步的，保存后立即生效
	// Hot Reload 后应该能匹配到代理
	if proxy := pm.MatchProxy("/-/test"); proxy == nil {
		t.Error("expected proxy after save, got nil")
	}

	// 删除代理记录
	if err := app.Delete(record); err != nil {
		t.Fatalf("failed to delete proxy record: %v", err)
	}

	// 删除后应该无法匹配
	if proxy := pm.MatchProxy("/-/test"); proxy != nil {
		t.Error("expected no proxy after delete")
	}
}

func TestProxyUniquePathConstraint(t *testing.T) {
	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	col, err := app.FindCollectionByNameOrId(core.CollectionNameProxies)
	if err != nil {
		t.Skip("_proxies collection not found")
	}

	// 创建第一个代理
	record1 := core.NewRecord(col)
	record1.Set(core.ProxyFieldPath, "/-/unique-test")
	record1.Set(core.ProxyFieldUpstream, "https://example1.com")
	record1.Set(core.ProxyFieldStripPath, true)
	record1.Set(core.ProxyFieldTimeout, 30)
	record1.Set(core.ProxyFieldActive, true)

	if err := app.Save(record1); err != nil {
		t.Fatalf("failed to save first proxy: %v", err)
	}

	// 尝试创建相同路径的代理应该失败
	record2 := core.NewRecord(col)
	record2.Set(core.ProxyFieldPath, "/-/unique-test")
	record2.Set(core.ProxyFieldUpstream, "https://example2.com")
	record2.Set(core.ProxyFieldStripPath, true)
	record2.Set(core.ProxyFieldTimeout, 30)
	record2.Set(core.ProxyFieldActive, true)

	if err := app.Save(record2); err == nil {
		t.Error("expected error when saving duplicate path, got nil")
	}

	// 清理
	app.Delete(record1)
}
