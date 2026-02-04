// Package kv 提供键值存储插件
package kv

import "errors"

// KV 相关错误
var (
	// ErrNotFound 表示 Key 不存在
	ErrNotFound = errors.New("key not found")

	// ErrKeyTooLong 表示 Key 长度超过限制
	ErrKeyTooLong = errors.New("key too long (max 256 characters)")

	// ErrValueTooLarge 表示 Value 大小超过限制
	ErrValueTooLarge = errors.New("value too large (max 1MB)")
)
