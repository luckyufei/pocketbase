// Package dye 提供用户染色功能
package dye

import (
	"errors"
	"time"
)

// 错误定义
var (
	ErrMaxDyedUsersReached = errors.New("max dyed users limit reached")
	ErrDyedUserNotFound    = errors.New("dyed user not found")
)

// DyedUser 染色用户信息
type DyedUser struct {
	UserID    string        `json:"userId"`
	AddedAt   time.Time     `json:"addedAt"`
	ExpiresAt time.Time     `json:"expiresAt"`
	TTL       time.Duration `json:"ttl"`
	AddedBy   string        `json:"addedBy,omitempty"`
	Reason    string        `json:"reason,omitempty"`
}

// DyeStore 染色存储接口
type DyeStore interface {
	// Add 添加染色用户
	Add(userID string, ttl time.Duration, addedBy, reason string) error
	// Remove 移除染色用户
	Remove(userID string) error
	// IsDyed 检查用户是否被染色
	IsDyed(userID string) bool
	// Get 获取染色用户信息
	Get(userID string) (*DyedUser, bool)
	// List 获取所有染色用户
	List() []DyedUser
	// UpdateTTL 更新染色 TTL
	UpdateTTL(userID string, ttl time.Duration) error
	// Count 获取染色用户数量
	Count() int
	// Close 关闭存储（清理资源）
	Close() error
}
