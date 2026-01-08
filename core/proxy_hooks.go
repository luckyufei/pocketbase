package core

import (
	"errors"

	"github.com/pocketbase/pocketbase/tools/hook"
)

// registerProxyHooks 注册代理相关的 hooks
func (app *BaseApp) registerProxyHooks() {
	// 验证 hook：检查 path 是否合法
	app.OnRecordValidate(CollectionNameProxies).Bind(&hook.Handler[*RecordEvent]{
		Id: "pbProxyValidatePath",
		Func: func(e *RecordEvent) error {
			path := e.Record.GetString(ProxyFieldPath)
			if err := ValidateProxyPath(path); err != nil {
				return err
			}
			return e.Next()
		},
		Priority: 99, // 高优先级，确保在其他验证之前执行
	})

	// Hot Reload hooks：监听 CRUD 事件，触发路由表刷新
	reloadHandler := &hook.Handler[*RecordEvent]{
		Id: "pbProxyHotReload",
		Func: func(e *RecordEvent) error {
			// 同步刷新路由表（避免 goroutine 在 app 清理后访问）
			if pm := app.proxyManager; pm != nil {
				pm.Reload()
			}
			return e.Next()
		},
		Priority: -99, // 低优先级，确保在记录保存成功后执行
	}

	app.OnRecordAfterCreateSuccess(CollectionNameProxies).Bind(reloadHandler)
	app.OnRecordAfterUpdateSuccess(CollectionNameProxies).Bind(reloadHandler)
	app.OnRecordAfterDeleteSuccess(CollectionNameProxies).Bind(reloadHandler)

	// 保护 Collection 配置：防止删除或修改 _proxies Collection
	app.OnCollectionDeleteExecute(CollectionNameProxies).Bind(&hook.Handler[*CollectionEvent]{
		Id: "pbProxyCollectionProtect",
		Func: func(e *CollectionEvent) error {
			// 系统 Collection 不允许删除
			return errors.New("cannot delete system collection _proxies")
		},
		Priority: 99,
	})

	// 防止修改 Collection 名称
	app.OnCollectionUpdateExecute(CollectionNameProxies).Bind(&hook.Handler[*CollectionEvent]{
		Id: "pbProxyCollectionNameProtect",
		Func: func(e *CollectionEvent) error {
			e.Collection.Name = CollectionNameProxies
			return e.Next()
		},
		Priority: 99,
	})
}

// initProxyManager 初始化代理管理器
func (app *BaseApp) initProxyManager() {
	app.proxyManager = NewProxyManager(app)
}

// loadProxies 加载代理配置到内存
func (app *BaseApp) loadProxies() error {
	if app.proxyManager == nil {
		return nil
	}
	return app.proxyManager.LoadProxies()
}

// ProxyManager 返回代理管理器实例
func (app *BaseApp) ProxyManager() *ProxyManager {
	return app.proxyManager
}
