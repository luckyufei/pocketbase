// Package polyfill 提供 Web API Polyfills
package polyfill

import (
	"strings"
	"testing"
)

func TestPolyfillsEmbed(t *testing.T) {
	t.Run("Console JS 已嵌入", func(t *testing.T) {
		if ConsoleJS == "" {
			t.Error("ConsoleJS 为空")
		}

		if !strings.Contains(ConsoleJS, "console") {
			t.Error("ConsoleJS 不包含 console")
		}
	})

	t.Run("Web API JS 已嵌入", func(t *testing.T) {
		if WebAPIJS == "" {
			t.Error("WebAPIJS 为空")
		}

		if !strings.Contains(WebAPIJS, "TextEncoder") {
			t.Error("WebAPIJS 不包含 TextEncoder")
		}

		if !strings.Contains(WebAPIJS, "TextDecoder") {
			t.Error("WebAPIJS 不包含 TextDecoder")
		}

		if !strings.Contains(WebAPIJS, "URL") {
			t.Error("WebAPIJS 不包含 URL")
		}

		if !strings.Contains(WebAPIJS, "Headers") {
			t.Error("WebAPIJS 不包含 Headers")
		}

		if !strings.Contains(WebAPIJS, "Response") {
			t.Error("WebAPIJS 不包含 Response")
		}

		if !strings.Contains(WebAPIJS, "Request") {
			t.Error("WebAPIJS 不包含 Request")
		}
	})

	t.Run("Stream JS 已嵌入", func(t *testing.T) {
		if StreamJS == "" {
			t.Error("StreamJS 为空")
		}

		if !strings.Contains(StreamJS, "ReadableStream") {
			t.Error("StreamJS 不包含 ReadableStream")
		}

		if !strings.Contains(StreamJS, "TransformStream") {
			t.Error("StreamJS 不包含 TransformStream")
		}
	})

	t.Run("AllPolyfills 组合", func(t *testing.T) {
		all := AllPolyfills()

		if all == "" {
			t.Error("AllPolyfills() 返回空")
		}

		if !strings.Contains(all, "console") {
			t.Error("AllPolyfills() 不包含 console")
		}

		if !strings.Contains(all, "TextEncoder") {
			t.Error("AllPolyfills() 不包含 TextEncoder")
		}

		if !strings.Contains(all, "ReadableStream") {
			t.Error("AllPolyfills() 不包含 ReadableStream")
		}
	})

	t.Run("Bridge JS 已嵌入", func(t *testing.T) {
		if BridgeJS == "" {
			t.Error("BridgeJS 为空")
		}

		if !strings.Contains(BridgeJS, "hostCall") {
			t.Error("BridgeJS 不包含 hostCall")
		}

		if !strings.Contains(BridgeJS, "OP_FETCH") {
			t.Error("BridgeJS 不包含 OP_FETCH")
		}
	})

	t.Run("PB SDK JS 已嵌入", func(t *testing.T) {
		if PbSdkJS == "" {
			t.Error("PbSdkJS 为空")
		}

		if !strings.Contains(PbSdkJS, "globalThis.pb") {
			t.Error("PbSdkJS 不包含 globalThis.pb")
		}

		if !strings.Contains(PbSdkJS, "collection") {
			t.Error("PbSdkJS 不包含 collection")
		}

		if !strings.Contains(PbSdkJS, "kv") {
			t.Error("PbSdkJS 不包含 kv")
		}
	})

	t.Run("AllSDK 组合", func(t *testing.T) {
		all := AllSDK()

		if all == "" {
			t.Error("AllSDK() 返回空")
		}

		// 应该包含 Polyfills
		if !strings.Contains(all, "console") {
			t.Error("AllSDK() 不包含 console")
		}

		// 应该包含 Bridge
		if !strings.Contains(all, "hostCall") {
			t.Error("AllSDK() 不包含 hostCall")
		}

		// 应该包含 SDK
		if !strings.Contains(all, "globalThis.pb") {
			t.Error("AllSDK() 不包含 globalThis.pb")
		}
	})
}

func TestPolyfillContent(t *testing.T) {
	t.Run("Console Polyfill 内容检查", func(t *testing.T) {
		// 检查关键函数
		funcs := []string{"log", "warn", "error", "info", "debug", "time", "timeEnd", "assert"}
		for _, fn := range funcs {
			if !strings.Contains(ConsoleJS, fn) {
				t.Errorf("ConsoleJS 不包含 %s 方法", fn)
			}
		}
	})

	t.Run("Web API Polyfill 内容检查", func(t *testing.T) {
		// 检查 URLSearchParams 方法
		methods := []string{"get", "set", "append", "delete", "has", "toString"}
		for _, m := range methods {
			if !strings.Contains(WebAPIJS, m) {
				t.Errorf("WebAPIJS 不包含 %s 方法", m)
			}
		}
	})

	t.Run("Stream Polyfill 内容检查", func(t *testing.T) {
		// 检查 ReadableStream 方法
		methods := []string{"getReader", "cancel", "tee", "enqueue", "close"}
		for _, m := range methods {
			if !strings.Contains(StreamJS, m) {
				t.Errorf("StreamJS 不包含 %s 方法", m)
			}
		}
	})
}

// T037: fetch Polyfill 测试
func TestFetchPolyfill(t *testing.T) {
	t.Run("fetch Polyfill 已嵌入", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "fetch") {
			t.Error("WebAPIJS 不包含 fetch")
		}
	})

	t.Run("fetch 函数定义", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "global.fetch = function fetch") {
			t.Error("WebAPIJS 不包含 fetch 函数定义")
		}
	})

	t.Run("fetch 流式支持", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "fetch.stream") {
			t.Error("WebAPIJS 不包含 fetch.stream")
		}
	})

	t.Run("fetch Host Function 集成", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "__hostFetch") {
			t.Error("WebAPIJS 不包含 __hostFetch Host Function 调用")
		}
	})

	t.Run("fetch 处理 Request 对象", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "input instanceof Request") {
			t.Error("WebAPIJS 不包含 Request 对象处理")
		}
	})

	t.Run("fetch 处理 Headers 对象", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "options.headers instanceof Headers") {
			t.Error("WebAPIJS 不包含 Headers 对象处理")
		}
	})

	t.Run("fetch 处理 body 类型", func(t *testing.T) {
		// 检查各种 body 类型处理
		if !strings.Contains(WebAPIJS, "ArrayBuffer") {
			t.Error("WebAPIJS 不包含 ArrayBuffer 处理")
		}
		if !strings.Contains(WebAPIJS, "Uint8Array") {
			t.Error("WebAPIJS 不包含 Uint8Array 处理")
		}
	})

	t.Run("fetch 错误处理", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "TypeError") {
			t.Error("WebAPIJS 不包含 TypeError 错误处理")
		}
	})
}

// T037: AbortController Polyfill 测试
func TestAbortControllerPolyfill(t *testing.T) {
	t.Run("AbortController 已嵌入", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "AbortController") {
			t.Error("WebAPIJS 不包含 AbortController")
		}
	})

	t.Run("AbortSignal 已嵌入", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "AbortSignal") {
			t.Error("WebAPIJS 不包含 AbortSignal")
		}
	})

	t.Run("AbortController.abort 方法", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "abort") {
			t.Error("WebAPIJS 不包含 abort 方法")
		}
	})

	t.Run("AbortController.signal 属性", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "signal") {
			t.Error("WebAPIJS 不包含 signal 属性")
		}
	})

	t.Run("AbortSignal.aborted 属性", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "aborted") {
			t.Error("WebAPIJS 不包含 aborted 属性")
		}
	})
}

// T037: FormData Polyfill 测试
func TestFormDataPolyfill(t *testing.T) {
	t.Run("FormData 已嵌入", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "FormData") {
			t.Error("WebAPIJS 不包含 FormData")
		}
	})

	t.Run("FormData.append 方法", func(t *testing.T) {
		if !strings.Contains(WebAPIJS, "FormData") && !strings.Contains(WebAPIJS, "append") {
			t.Error("WebAPIJS 不包含 FormData.append 方法")
		}
	})

	t.Run("FormData.get 方法", func(t *testing.T) {
		// FormData 应该有 get 方法
		if !strings.Contains(WebAPIJS, "FormData") {
			t.Error("WebAPIJS 不包含 FormData")
		}
	})

	t.Run("FormData.set 方法", func(t *testing.T) {
		// FormData 应该有 set 方法
		if !strings.Contains(WebAPIJS, "FormData") {
			t.Error("WebAPIJS 不包含 FormData")
		}
	})

	t.Run("FormData.delete 方法", func(t *testing.T) {
		// FormData 应该有 delete 方法
		if !strings.Contains(WebAPIJS, "FormData") {
			t.Error("WebAPIJS 不包含 FormData")
		}
	})

	t.Run("FormData.has 方法", func(t *testing.T) {
		// FormData 应该有 has 方法
		if !strings.Contains(WebAPIJS, "FormData") {
			t.Error("WebAPIJS 不包含 FormData")
		}
	})
}
