package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/gateway"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	core.SystemMigrations.Register(func(txApp core.App) error {
		return addGatewayHardeningFields(txApp)
	}, func(txApp core.App) error {
		return removeGatewayHardeningFields(txApp)
	}, "20250201045320_gateway_hardening.go")
}

// addGatewayHardeningFields 添加 Gateway Hardening 扩展字段
// T031: 为 _proxies 表添加新字段
//
// 新增字段:
// - maxConcurrent: 最大并发数 (FR-008)
// - circuitBreaker: 熔断器配置 JSON (FR-012)
// - timeoutConfig: 精细超时配置 JSON
func addGatewayHardeningFields(txApp core.App) error {
	col, err := txApp.FindCollectionByNameOrId(gateway.CollectionNameProxies)
	if err != nil {
		// Collection 不存在，可能是首次启动前的状态
		return nil
	}

	// maxConcurrent - 最大并发数
	// 0 或 null 表示不限制
	// FR-008
	if col.Fields.GetByName(gateway.ProxyFieldMaxConcurrent) == nil {
		col.Fields.Add(&core.NumberField{
			Name:    gateway.ProxyFieldMaxConcurrent,
			System:  true,
			Min:     types.Pointer(0.0),
			Max:     types.Pointer(10000.0), // 最大 10000 并发
			OnlyInt: true,
		})
	}

	// circuitBreaker - 熔断器配置
	// JSON 格式: {"enabled": true, "failure_threshold": 5, "recovery_timeout": 30}
	// null 表示不启用熔断
	// FR-012
	if col.Fields.GetByName(gateway.ProxyFieldCircuitBreaker) == nil {
		col.Fields.Add(&core.JSONField{
			Name:    gateway.ProxyFieldCircuitBreaker,
			System:  true,
			MaxSize: 1000, // 1KB 足够
		})
	}

	// timeoutConfig - 精细超时配置
	// JSON 格式: {"dial": 2, "response_header": 30, "idle": 90}
	// null 表示使用默认值
	if col.Fields.GetByName(gateway.ProxyFieldTimeoutConfig) == nil {
		col.Fields.Add(&core.JSONField{
			Name:    gateway.ProxyFieldTimeoutConfig,
			System:  true,
			MaxSize: 1000, // 1KB 足够
		})
	}

	return txApp.Save(col)
}

// removeGatewayHardeningFields 回滚：移除 Gateway Hardening 扩展字段
func removeGatewayHardeningFields(txApp core.App) error {
	col, err := txApp.FindCollectionByNameOrId(gateway.CollectionNameProxies)
	if err != nil {
		return nil // Collection 不存在，无需回滚
	}

	// 移除字段
	col.Fields.RemoveByName(gateway.ProxyFieldMaxConcurrent)
	col.Fields.RemoveByName(gateway.ProxyFieldCircuitBreaker)
	col.Fields.RemoveByName(gateway.ProxyFieldTimeoutConfig)

	return txApp.Save(col)
}
