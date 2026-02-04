package kv

import (
	"errors"
	"testing"
)

// ==================== T002: 错误定义测试 ====================

func TestErrors(t *testing.T) {
	// 测试错误定义存在
	if ErrNotFound == nil {
		t.Error("ErrNotFound should not be nil")
	}
	if ErrKeyTooLong == nil {
		t.Error("ErrKeyTooLong should not be nil")
	}
	if ErrValueTooLarge == nil {
		t.Error("ErrValueTooLarge should not be nil")
	}
}

func TestErrorMessages(t *testing.T) {
	// 测试错误信息
	if ErrNotFound.Error() != "key not found" {
		t.Errorf("expected 'key not found', got '%s'", ErrNotFound.Error())
	}
	if ErrKeyTooLong.Error() != "key too long (max 256 characters)" {
		t.Errorf("expected 'key too long (max 256 characters)', got '%s'", ErrKeyTooLong.Error())
	}
	if ErrValueTooLarge.Error() != "value too large (max 1MB)" {
		t.Errorf("expected 'value too large (max 1MB)', got '%s'", ErrValueTooLarge.Error())
	}
}

func TestErrorsAreDistinct(t *testing.T) {
	// 测试错误是不同的
	if errors.Is(ErrNotFound, ErrKeyTooLong) {
		t.Error("ErrNotFound should not equal ErrKeyTooLong")
	}
	if errors.Is(ErrKeyTooLong, ErrValueTooLarge) {
		t.Error("ErrKeyTooLong should not equal ErrValueTooLarge")
	}
}
