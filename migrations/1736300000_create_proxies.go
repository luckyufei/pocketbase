package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/gateway"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	core.SystemMigrations.Register(func(txApp core.App) error {
		return createProxiesCollection(txApp)
	}, func(txApp core.App) error {
		col, err := txApp.FindCollectionByNameOrId(gateway.CollectionNameProxies)
		if err != nil {
			return nil // collection 不存在，无需回滚
		}
		return txApp.Delete(col)
	}, "1736300000_create_proxies.go")
}

// createProxiesCollection 创建 _proxies 系统 Collection
// 用于存储 API 代理配置，实现动态网关功能
func createProxiesCollection(txApp core.App) error {
	col := core.NewBaseCollection(gateway.CollectionNameProxies)
	col.System = true

	// 访问规则：仅 Superuser 可管理代理配置
	// ListRule/ViewRule 为 nil 表示仅 Superuser 可访问
	col.ListRule = nil
	col.ViewRule = nil
	col.CreateRule = nil
	col.UpdateRule = nil
	col.DeleteRule = nil

	// path - 拦截路径 (唯一, 必填)
	col.Fields.Add(&core.TextField{
		Name:     gateway.ProxyFieldPath,
		System:   true,
		Required: true,
		Min:      2, // 至少 "/x"
		Max:      500,
	})

	// upstream - 目标服务地址 (必填)
	col.Fields.Add(&core.URLField{
		Name:          gateway.ProxyFieldUpstream,
		System:        true,
		Required:      true,
		OnlyDomains:   []string{}, // 允许任意域名
		ExceptDomains: []string{},
	})

	// stripPath - 转发时是否移除匹配的前缀 (默认 true)
	col.Fields.Add(&core.BoolField{
		Name:   gateway.ProxyFieldStripPath,
		System: true,
	})

	// accessRule - 访问控制规则 (空表示仅 Superuser)
	col.Fields.Add(&core.TextField{
		Name:   gateway.ProxyFieldAccessRule,
		System: true,
		Max:    2000,
	})

	// headers - 注入的请求头配置 (JSON)
	col.Fields.Add(&core.JSONField{
		Name:    gateway.ProxyFieldHeaders,
		System:  true,
		MaxSize: 10000, // 10KB
	})

	// timeout - 超时时间 (秒, 默认 30)
	col.Fields.Add(&core.NumberField{
		Name:   gateway.ProxyFieldTimeout,
		System: true,
		Min:    types.Pointer(1.0),
		Max:    types.Pointer(300.0), // 最大 5 分钟
	})

	// active - 是否启用 (默认 true)
	col.Fields.Add(&core.BoolField{
		Name:   gateway.ProxyFieldActive,
		System: true,
	})

	// created - 创建时间
	col.Fields.Add(&core.AutodateField{
		Name:     "created",
		System:   true,
		OnCreate: true,
	})

	// updated - 更新时间
	col.Fields.Add(&core.AutodateField{
		Name:     "updated",
		System:   true,
		OnCreate: true,
		OnUpdate: true,
	})

	// 唯一索引：path 必须唯一
	col.AddIndex("idx_proxies_path", true, "path", "")

	// 活跃代理索引：用于快速加载活跃代理
	col.AddIndex("idx_proxies_active", false, "active", "")

	return txApp.Save(col)
}
