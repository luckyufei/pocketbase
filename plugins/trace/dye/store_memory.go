package dye

import (
	"sync"
	"time"
)

// MemoryDyeStore 内存染色存储实现
type MemoryDyeStore struct {
	mu         sync.RWMutex
	users      map[string]*DyedUser
	maxUsers   int
	defaultTTL time.Duration
	stopCh     chan struct{}
}

// NewMemoryDyeStore 创建内存染色存储
func NewMemoryDyeStore(maxUsers int, defaultTTL time.Duration) *MemoryDyeStore {
	if maxUsers <= 0 {
		maxUsers = 100
	}
	if defaultTTL <= 0 {
		defaultTTL = time.Hour
	}

	store := &MemoryDyeStore{
		users:      make(map[string]*DyedUser),
		maxUsers:   maxUsers,
		defaultTTL: defaultTTL,
		stopCh:     make(chan struct{}),
	}

	// 启动过期清理协程
	go store.cleanupLoop()

	return store
}

// Add 添加染色用户
func (s *MemoryDyeStore) Add(userID string, ttl time.Duration, addedBy, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 检查是否已存在
	if _, exists := s.users[userID]; !exists {
		// 检查数量上限
		if len(s.users) >= s.maxUsers {
			return ErrMaxDyedUsersReached
		}
	}

	if ttl <= 0 {
		ttl = s.defaultTTL
	}

	now := time.Now()
	s.users[userID] = &DyedUser{
		UserID:    userID,
		AddedAt:   now,
		ExpiresAt: now.Add(ttl),
		TTL:       ttl,
		AddedBy:   addedBy,
		Reason:    reason,
	}

	return nil
}

// Remove 移除染色用户
func (s *MemoryDyeStore) Remove(userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.users, userID)
	return nil
}

// IsDyed 检查用户是否被染色
func (s *MemoryDyeStore) IsDyed(userID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.users[userID]
	if !exists {
		return false
	}

	// 检查是否过期
	return time.Now().Before(user.ExpiresAt)
}

// Get 获取染色用户信息
func (s *MemoryDyeStore) Get(userID string) (*DyedUser, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, exists := s.users[userID]
	if !exists || time.Now().After(user.ExpiresAt) {
		return nil, false
	}
	// 返回副本
	copy := *user
	return &copy, true
}

// List 获取所有染色用户列表
func (s *MemoryDyeStore) List() []DyedUser {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	result := make([]DyedUser, 0, len(s.users))
	for _, user := range s.users {
		if now.Before(user.ExpiresAt) {
			result = append(result, *user)
		}
	}
	return result
}

// UpdateTTL 更新染色 TTL
func (s *MemoryDyeStore) UpdateTTL(userID string, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, exists := s.users[userID]
	if !exists {
		return ErrDyedUserNotFound
	}

	user.TTL = ttl
	user.ExpiresAt = time.Now().Add(ttl)
	return nil
}

// Count 获取染色用户数量
func (s *MemoryDyeStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.users)
}

// Close 关闭存储
func (s *MemoryDyeStore) Close() error {
	close(s.stopCh)
	return nil
}

// cleanupLoop 定时清理过期用户
func (s *MemoryDyeStore) cleanupLoop() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.cleanup()
		case <-s.stopCh:
			return
		}
	}
}

// cleanup 清理过期用户
func (s *MemoryDyeStore) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for userID, user := range s.users {
		if now.After(user.ExpiresAt) {
			delete(s.users, userID)
		}
	}
}

// 确保实现了接口
var _ DyeStore = (*MemoryDyeStore)(nil)
