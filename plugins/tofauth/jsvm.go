package tofauth

import (
	"github.com/dop251/goja"
)

// BindToVM 将 $tof 对象绑定到 goja.Runtime
// 用于在 jsvm.Config.OnInit 中调用，使 JS Hooks 可以使用 TOF 身份验证功能
//
// 使用示例:
//
//	jsvm.MustRegister(app, jsvm.Config{
//	    OnInit: func(vm *goja.Runtime) {
//	        tofauth.BindToVM(vm, "your-app-token", true, true)
//	    },
//	})
//
// 在 JS Hooks 中使用:
//
//	const identity = $tof.getTofIdentity(taiId, timestamp, signature, seq);
//	console.log(identity.loginname, identity.staffid);
func BindToVM(vm *goja.Runtime, appToken string, safeMode, checkTimestamp bool) {
	obj := vm.NewObject()
	vm.Set("$tof", obj)

	// 绑定 getTofIdentity 方法
	obj.Set("getTofIdentity", func(taiId, timestamp, signature, seq string) goja.Value {
		identity, err := GetTofIdentity(appToken, taiId, timestamp, signature, seq, safeMode, checkTimestamp)
		if err != nil {
			panic(vm.ToValue(err.Error()))
		}

		// 转换为 JS 对象
		result := vm.NewObject()
		result.Set("loginname", identity.LoginName)
		result.Set("staffid", identity.StaffId)
		result.Set("expiration", identity.Expiration)
		if identity.Ticket != nil {
			result.Set("ticket", *identity.Ticket)
		}
		return result
	})
}

// BindToVMWithConfig 使用 Config 绑定 $tof 对象到 goja.Runtime
// 这是一个便捷方法，直接使用 Config 中的配置
func BindToVMWithConfig(vm *goja.Runtime, config Config) {
	config = applyDefaults(config)
	BindToVM(vm, config.AppToken, config.getSafeMode(), config.getCheckTimestamp())
}
