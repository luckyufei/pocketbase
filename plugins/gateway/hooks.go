package gateway

import (
	"errors"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// registerHooks 注册代理相关的 hooks
func (p *gatewayPlugin) registerHooks() {
	// 验证 hook：检查 path 是否合法
	p.app.OnRecordValidate(CollectionNameProxies).Bind(&hook.Handler[*core.RecordEvent]{
		Id: "pbGatewayValidatePath",
		Func: func(e *core.RecordEvent) error {
			path := e.Record.GetString(ProxyFieldPath)
			if err := ValidateProxyPath(path); err != nil {
				return err
			}
			return e.Next()
		},
		Priority: 99, // 高优先级，确保在其他验证之前执行
	})

	// Hot Reload hooks：监听 CRUD 事件，触发路由表刷新
	reloadHandler := &hook.Handler[*core.RecordEvent]{
		Id: "pbGatewayHotReload",
		Func: func(e *core.RecordEvent) error {
			// 同步刷新路由表（避免 goroutine 在 app 清理后访问）
			if p.manager != nil {
				if err := p.loadProxies(); err != nil {
					p.app.Logger().Warn("failed to reload proxies", "error", err)
				}
			}
			return e.Next()
		},
		Priority: -99, // 低优先级，确保在记录保存成功后执行
	}

	p.app.OnRecordAfterCreateSuccess(CollectionNameProxies).Bind(reloadHandler)
	p.app.OnRecordAfterUpdateSuccess(CollectionNameProxies).Bind(reloadHandler)
	p.app.OnRecordAfterDeleteSuccess(CollectionNameProxies).Bind(reloadHandler)

	// 保护 Collection 配置：防止删除或修改 _proxies Collection
	p.app.OnCollectionDeleteExecute(CollectionNameProxies).Bind(&hook.Handler[*core.CollectionEvent]{
		Id: "pbGatewayCollectionProtect",
		Func: func(e *core.CollectionEvent) error {
			// 系统 Collection 不允许删除
			return errors.New("cannot delete system collection _proxies")
		},
		Priority: 99,
	})

	// 防止修改 Collection 名称
	p.app.OnCollectionUpdateExecute(CollectionNameProxies).Bind(&hook.Handler[*core.CollectionEvent]{
		Id: "pbGatewayCollectionNameProtect",
		Func: func(e *core.CollectionEvent) error {
			e.Collection.Name = CollectionNameProxies
			return e.Next()
		},
		Priority: 99,
	})
}
