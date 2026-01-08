// Package polyfill 提供 Web API Polyfills 和 PocketBase SDK
package polyfill

import (
	_ "embed"
)

//go:embed console.js
var ConsoleJS string

//go:embed web_api.js
var WebAPIJS string

//go:embed stream.js
var StreamJS string

//go:embed bridge.js
var BridgeJS string

//go:embed pb-sdk.js
var PbSdkJS string

// AllPolyfills 返回所有 Polyfills 的组合
func AllPolyfills() string {
	return ConsoleJS + "\n" + WebAPIJS + "\n" + StreamJS
}

// AllSDK 返回完整的 SDK（包含 Polyfills + Bridge + SDK）
func AllSDK() string {
	return AllPolyfills() + "\n" + BridgeJS + "\n" + PbSdkJS
}
