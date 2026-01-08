package wasm

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

// TestNewBridge 测试创建桥接层
func TestNewBridge(t *testing.T) {
	b := NewBridge()
	if b == nil {
		t.Fatal("NewBridge() 返回 nil")
	}
	if b.handlers == nil {
		t.Error("handlers 不应为 nil")
	}
}

// TestBridgeRegisterHandler 测试注册处理器
func TestBridgeRegisterHandler(t *testing.T) {
	b := NewBridge()

	b.RegisterHandler(OpDBQuery, func(ctx context.Context, payload *RequestPayload) (any, error) {
		return map[string]string{"status": "ok"}, nil
	})

	// 验证处理器已注册
	if _, ok := b.handlers[OpDBQuery]; !ok {
		t.Error("处理器未注册")
	}
}

// TestBridgeHandle 测试处理请求
func TestBridgeHandle(t *testing.T) {
	b := NewBridge()

	t.Run("成功处理", func(t *testing.T) {
		b.RegisterHandler(OpDBQuery, func(ctx context.Context, payload *RequestPayload) (any, error) {
			return map[string]string{"result": "success"}, nil
		})

		ctx := context.Background()
		result, err := b.Handle(ctx, OpDBQuery, []byte(`{"op":"list","col":"users"}`))
		if err != nil {
			t.Fatalf("Handle() error = %v", err)
		}

		var resp ResponsePayload
		if err := json.Unmarshal(result, &resp); err != nil {
			t.Fatalf("Unmarshal error = %v", err)
		}

		if resp.Error != "" {
			t.Errorf("Error = %s, want empty", resp.Error)
		}
	})

	t.Run("处理器返回错误", func(t *testing.T) {
		b.RegisterHandler(OpFetch, func(ctx context.Context, payload *RequestPayload) (any, error) {
			return nil, errors.New("fetch failed")
		})

		ctx := context.Background()
		result, err := b.Handle(ctx, OpFetch, []byte(`{"url":"https://example.com"}`))
		if err != nil {
			t.Fatalf("Handle() error = %v", err)
		}

		var resp ResponsePayload
		if err := json.Unmarshal(result, &resp); err != nil {
			t.Fatalf("Unmarshal error = %v", err)
		}

		if resp.Error != "fetch failed" {
			t.Errorf("Error = %s, want 'fetch failed'", resp.Error)
		}
	})

	t.Run("未知操作码", func(t *testing.T) {
		ctx := context.Background()
		_, err := b.Handle(ctx, OpCode(999), []byte(`{}`))
		if err == nil {
			t.Error("未知操作码应返回错误")
		}
	})

	t.Run("无效 JSON", func(t *testing.T) {
		ctx := context.Background()
		_, err := b.Handle(ctx, OpDBQuery, []byte(`{invalid}`))
		if err == nil {
			t.Error("无效 JSON 应返回错误")
		}
	})
}

// TestBridgeToHostFunctionHandler 测试转换为 HostFunctionHandler
func TestBridgeToHostFunctionHandler(t *testing.T) {
	b := NewBridge()
	b.RegisterHandler(OpKVGet, func(ctx context.Context, payload *RequestPayload) (any, error) {
		return map[string]string{"value": "test"}, nil
	})

	handler := b.ToHostFunctionHandler()
	if handler == nil {
		t.Fatal("ToHostFunctionHandler() 返回 nil")
	}

	ctx := context.Background()
	result, err := handler(ctx, OpKVGet, []byte(`{"key":"mykey"}`))
	if err != nil {
		t.Fatalf("handler() error = %v", err)
	}
	if len(result) == 0 {
		t.Error("result 不应为空")
	}
}

// TestParseDBQueryPayload 测试解析 DB 查询载荷
func TestParseDBQueryPayload(t *testing.T) {
	t.Run("完整载荷", func(t *testing.T) {
		data := []byte(`{
			"op": "list",
			"col": "users",
			"page": 1,
			"perPage": 20,
			"filter": "active = true",
			"sort": "-created",
			"expand": "profile"
		}`)

		payload, err := ParseDBQueryPayload(data)
		if err != nil {
			t.Fatalf("ParseDBQueryPayload() error = %v", err)
		}

		if payload.Op != "list" {
			t.Errorf("Op = %s, want list", payload.Op)
		}
		if payload.Col != "users" {
			t.Errorf("Col = %s, want users", payload.Col)
		}
		if payload.Page != 1 {
			t.Errorf("Page = %d, want 1", payload.Page)
		}
		if payload.PerPage != 20 {
			t.Errorf("PerPage = %d, want 20", payload.PerPage)
		}
		if payload.Filter != "active = true" {
			t.Errorf("Filter = %s, want 'active = true'", payload.Filter)
		}
	})

	t.Run("向量搜索载荷", func(t *testing.T) {
		data := []byte(`{
			"op": "vector",
			"col": "docs",
			"vector": [0.1, 0.2, 0.3],
			"field": "embedding",
			"top": 5
		}`)

		payload, err := ParseDBQueryPayload(data)
		if err != nil {
			t.Fatalf("ParseDBQueryPayload() error = %v", err)
		}

		if len(payload.Vector) != 3 {
			t.Errorf("Vector length = %d, want 3", len(payload.Vector))
		}
		if payload.Field != "embedding" {
			t.Errorf("Field = %s, want embedding", payload.Field)
		}
		if payload.Top != 5 {
			t.Errorf("Top = %d, want 5", payload.Top)
		}
	})

	t.Run("无效 JSON", func(t *testing.T) {
		_, err := ParseDBQueryPayload([]byte(`{invalid}`))
		if err == nil {
			t.Error("无效 JSON 应返回错误")
		}
	})
}

// TestParseFetchPayload 测试解析 Fetch 载荷
func TestParseFetchPayload(t *testing.T) {
	data := []byte(`{
		"url": "https://api.example.com/data",
		"method": "POST",
		"headers": {"Authorization": "Bearer token"},
		"body": "{\"key\":\"value\"}",
		"timeout": 30
	}`)

	payload, err := ParseFetchPayload(data)
	if err != nil {
		t.Fatalf("ParseFetchPayload() error = %v", err)
	}

	if payload.URL != "https://api.example.com/data" {
		t.Errorf("URL = %s, want https://api.example.com/data", payload.URL)
	}
	if payload.Method != "POST" {
		t.Errorf("Method = %s, want POST", payload.Method)
	}
	if payload.Headers["Authorization"] != "Bearer token" {
		t.Errorf("Authorization header 不正确")
	}
	if payload.Timeout != 30 {
		t.Errorf("Timeout = %d, want 30", payload.Timeout)
	}
}

// TestParseKVPayload 测试解析 KV 载荷
func TestParseKVPayload(t *testing.T) {
	data := []byte(`{"key": "session:123", "value": {"stage": "step_2"}, "ttl": 600}`)

	payload, err := ParseKVPayload(data)
	if err != nil {
		t.Fatalf("ParseKVPayload() error = %v", err)
	}

	if payload.Key != "session:123" {
		t.Errorf("Key = %s, want session:123", payload.Key)
	}
	if payload.TTL != 600 {
		t.Errorf("TTL = %d, want 600", payload.TTL)
	}
}

// TestParseSecretPayload 测试解析 Secret 载荷
func TestParseSecretPayload(t *testing.T) {
	data := []byte(`{"key": "OPENAI_API_KEY"}`)

	payload, err := ParseSecretPayload(data)
	if err != nil {
		t.Fatalf("ParseSecretPayload() error = %v", err)
	}

	if payload.Key != "OPENAI_API_KEY" {
		t.Errorf("Key = %s, want OPENAI_API_KEY", payload.Key)
	}
}

// TestParseJobPayload 测试解析 Job 载荷
func TestParseJobPayload(t *testing.T) {
	data := []byte(`{"topic": "send_email", "payload": {"to": "user@example.com"}}`)

	payload, err := ParseJobPayload(data)
	if err != nil {
		t.Fatalf("ParseJobPayload() error = %v", err)
	}

	if payload.Topic != "send_email" {
		t.Errorf("Topic = %s, want send_email", payload.Topic)
	}
}

// TestParseFilePayload 测试解析 File 载荷
func TestParseFilePayload(t *testing.T) {
	data := []byte(`{"collection": "users", "recordId": "abc123", "filename": "avatar.jpg"}`)

	payload, err := ParseFilePayload(data)
	if err != nil {
		t.Fatalf("ParseFilePayload() error = %v", err)
	}

	if payload.Collection != "users" {
		t.Errorf("Collection = %s, want users", payload.Collection)
	}
	if payload.RecordID != "abc123" {
		t.Errorf("RecordID = %s, want abc123", payload.RecordID)
	}
	if payload.Filename != "avatar.jpg" {
		t.Errorf("Filename = %s, want avatar.jpg", payload.Filename)
	}
}

// TestParseTxPayload 测试解析 Tx 载荷
func TestParseTxPayload(t *testing.T) {
	data := []byte(`{"txId": "tx-12345"}`)

	payload, err := ParseTxPayload(data)
	if err != nil {
		t.Fatalf("ParseTxPayload() error = %v", err)
	}

	if payload.TxID != "tx-12345" {
		t.Errorf("TxID = %s, want tx-12345", payload.TxID)
	}
}

// TestParseUtilsPayload 测试解析 Utils 载荷
func TestParseUtilsPayload(t *testing.T) {
	data := []byte(`{"func": "hash", "input": "password123", "len": 32}`)

	payload, err := ParseUtilsPayload(data)
	if err != nil {
		t.Fatalf("ParseUtilsPayload() error = %v", err)
	}

	if payload.Func != "hash" {
		t.Errorf("Func = %s, want hash", payload.Func)
	}
	if payload.Input != "password123" {
		t.Errorf("Input = %s, want password123", payload.Input)
	}
	if payload.Len != 32 {
		t.Errorf("Len = %d, want 32", payload.Len)
	}
}

// TestParsePayloadErrors 测试解析错误
func TestParsePayloadErrors(t *testing.T) {
	invalidJSON := []byte(`{invalid}`)

	t.Run("FetchPayload", func(t *testing.T) {
		_, err := ParseFetchPayload(invalidJSON)
		if err == nil {
			t.Error("应返回错误")
		}
	})

	t.Run("KVPayload", func(t *testing.T) {
		_, err := ParseKVPayload(invalidJSON)
		if err == nil {
			t.Error("应返回错误")
		}
	})

	t.Run("SecretPayload", func(t *testing.T) {
		_, err := ParseSecretPayload(invalidJSON)
		if err == nil {
			t.Error("应返回错误")
		}
	})

	t.Run("JobPayload", func(t *testing.T) {
		_, err := ParseJobPayload(invalidJSON)
		if err == nil {
			t.Error("应返回错误")
		}
	})

	t.Run("FilePayload", func(t *testing.T) {
		_, err := ParseFilePayload(invalidJSON)
		if err == nil {
			t.Error("应返回错误")
		}
	})

	t.Run("TxPayload", func(t *testing.T) {
		_, err := ParseTxPayload(invalidJSON)
		if err == nil {
			t.Error("应返回错误")
		}
	})

	t.Run("UtilsPayload", func(t *testing.T) {
		_, err := ParseUtilsPayload(invalidJSON)
		if err == nil {
			t.Error("应返回错误")
		}
	})
}
