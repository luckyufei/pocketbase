package core_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ============================================================================
// Phase 1: Span 结构体测试
// ============================================================================

func TestSpanKindConstants(t *testing.T) {
	// 验证 SpanKind 常量定义
	tests := []struct {
		kind     core.SpanKind
		expected string
	}{
		{core.SpanKindInternal, "INTERNAL"},
		{core.SpanKindServer, "SERVER"},
		{core.SpanKindClient, "CLIENT"},
		{core.SpanKindProducer, "PRODUCER"},
		{core.SpanKindConsumer, "CONSUMER"},
	}

	for _, tt := range tests {
		if string(tt.kind) != tt.expected {
			t.Errorf("SpanKind = %q, want %q", tt.kind, tt.expected)
		}
	}
}

func TestSpanStatusConstants(t *testing.T) {
	// 验证 SpanStatus 常量定义
	tests := []struct {
		status   core.SpanStatus
		expected string
	}{
		{core.SpanStatusUnset, "UNSET"},
		{core.SpanStatusOK, "OK"},
		{core.SpanStatusError, "ERROR"},
	}

	for _, tt := range tests {
		if string(tt.status) != tt.expected {
			t.Errorf("SpanStatus = %q, want %q", tt.status, tt.expected)
		}
	}
}

func TestSpanTableName(t *testing.T) {
	span := &core.Span{}
	if span.TableName() != "_traces" {
		t.Errorf("TableName() = %q, want %q", span.TableName(), "_traces")
	}
}

func TestSpanFields(t *testing.T) {
	now := time.Now()
	attrs := map[string]any{
		"http.method":      "GET",
		"http.status_code": 200,
	}

	span := &core.Span{
		TraceID:    "0123456789abcdef0123456789abcdef",
		SpanID:     "0123456789abcdef",
		ParentID:   "fedcba9876543210",
		Name:       "GET /api/users",
		Kind:       core.SpanKindServer,
		StartTime:  now.UnixMicro(),
		Duration:   1500,
		Status:     core.SpanStatusOK,
		Attributes: attrs,
	}

	if span.TraceID != "0123456789abcdef0123456789abcdef" {
		t.Errorf("TraceID = %q, want 32 chars", span.TraceID)
	}
	if span.SpanID != "0123456789abcdef" {
		t.Errorf("SpanID = %q, want 16 chars", span.SpanID)
	}
	if span.ParentID != "fedcba9876543210" {
		t.Errorf("ParentID = %q", span.ParentID)
	}
	if span.Name != "GET /api/users" {
		t.Errorf("Name = %q", span.Name)
	}
	if span.Kind != core.SpanKindServer {
		t.Errorf("Kind = %q", span.Kind)
	}
	if span.Duration != 1500 {
		t.Errorf("Duration = %d", span.Duration)
	}
	if span.Status != core.SpanStatusOK {
		t.Errorf("Status = %q", span.Status)
	}
	if span.Attributes["http.method"] != "GET" {
		t.Errorf("Attributes[http.method] = %v", span.Attributes["http.method"])
	}
}

func TestSpanAttributesJSON(t *testing.T) {
	span := &core.Span{
		TraceID:  "0123456789abcdef0123456789abcdef",
		SpanID:   "0123456789abcdef",
		Name:     "test",
		Kind:     core.SpanKindInternal,
		Status:   core.SpanStatusOK,
		Attributes: map[string]any{
			"key1": "value1",
			"key2": 123,
			"key3": true,
		},
	}

	// 测试 JSON 序列化
	data, err := json.Marshal(span)
	if err != nil {
		t.Fatalf("JSON marshal failed: %v", err)
	}

	// 测试 JSON 反序列化
	var decoded core.Span
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("JSON unmarshal failed: %v", err)
	}

	if decoded.TraceID != span.TraceID {
		t.Errorf("decoded.TraceID = %q, want %q", decoded.TraceID, span.TraceID)
	}
	if decoded.Attributes["key1"] != "value1" {
		t.Errorf("decoded.Attributes[key1] = %v", decoded.Attributes["key1"])
	}
}

func TestSpanValidateTraceID(t *testing.T) {
	tests := []struct {
		name    string
		traceID string
		wantErr bool
	}{
		{"valid 32 chars", "0123456789abcdef0123456789abcdef", false},
		{"empty", "", true},
		{"too short", "0123456789abcdef", true},
		{"too long", "0123456789abcdef0123456789abcdef00", true},
		{"invalid chars", "0123456789GHIJKL0123456789abcdef", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			span := &core.Span{
				TraceID:   tt.traceID,
				SpanID:    "0123456789abcdef",
				Name:      "test",
				Kind:      core.SpanKindInternal,
				StartTime: time.Now().UnixMicro(),
				Status:    core.SpanStatusOK,
			}
			err := span.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSpanValidateSpanID(t *testing.T) {
	tests := []struct {
		name    string
		spanID  string
		wantErr bool
	}{
		{"valid 16 chars", "0123456789abcdef", false},
		{"empty", "", true},
		{"too short", "01234567", true},
		{"too long", "0123456789abcdef00", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			span := &core.Span{
				TraceID:   "0123456789abcdef0123456789abcdef",
				SpanID:    tt.spanID,
				Name:      "test",
				Kind:      core.SpanKindInternal,
				StartTime: time.Now().UnixMicro(),
				Status:    core.SpanStatusOK,
			}
			err := span.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSpanValidateName(t *testing.T) {
	span := &core.Span{
		TraceID:   "0123456789abcdef0123456789abcdef",
		SpanID:    "0123456789abcdef",
		Name:      "", // empty name
		Kind:      core.SpanKindInternal,
		StartTime: time.Now().UnixMicro(),
		Status:    core.SpanStatusOK,
	}
	if err := span.Validate(); err == nil {
		t.Error("Validate() should fail for empty name")
	}
}

func TestSpanValidateAttributesSize(t *testing.T) {
	// 创建超过 64KB 的 attributes
	largeValue := make([]byte, 65*1024)
	for i := range largeValue {
		largeValue[i] = 'a'
	}

	span := &core.Span{
		TraceID:   "0123456789abcdef0123456789abcdef",
		SpanID:    "0123456789abcdef",
		Name:      "test",
		Kind:      core.SpanKindInternal,
		StartTime: time.Now().UnixMicro(),
		Status:    core.SpanStatusOK,
		Attributes: map[string]any{
			"large": string(largeValue),
		},
	}
	if err := span.Validate(); err == nil {
		t.Error("Validate() should fail for attributes > 64KB")
	}
}

func TestSpanIsRootSpan(t *testing.T) {
	rootSpan := &core.Span{
		TraceID:  "0123456789abcdef0123456789abcdef",
		SpanID:   "0123456789abcdef",
		ParentID: "", // no parent
	}
	if !rootSpan.IsRoot() {
		t.Error("IsRoot() should return true for root span")
	}

	childSpan := &core.Span{
		TraceID:  "0123456789abcdef0123456789abcdef",
		SpanID:   "0123456789abcdef",
		ParentID: "fedcba9876543210",
	}
	if childSpan.IsRoot() {
		t.Error("IsRoot() should return false for child span")
	}
}
