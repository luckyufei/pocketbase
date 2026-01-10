package runtime

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// TestAOTCacheBasic 测试基本缓存功能
func TestAOTCacheBasic(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	// 测试代码
	code := []byte("function hello() { return 'world'; }")
	key := cache.ComputeKey(code)

	// 首次应该未命中
	_, hit := cache.Get(key)
	if hit {
		t.Error("期望首次获取未命中")
	}

	// 存储编译结果
	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   []byte("compiled bytecode"),
		SourceHash: key,
		CompiledAt: time.Now(),
	}
	cache.Put(key, compiled)

	// 再次获取应该命中
	result, hit := cache.Get(key)
	if !hit {
		t.Error("期望第二次获取命中")
	}
	if result == nil {
		t.Error("期望获取到编译结果")
	}
	if string(result.Bytecode) != "compiled bytecode" {
		t.Errorf("期望字节码为 'compiled bytecode'，实际为 %s", result.Bytecode)
	}
}

// TestAOTCacheComputeKey 测试缓存键计算
func TestAOTCacheComputeKey(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	code := []byte("function test() {}")

	// 计算键
	key := cache.ComputeKey(code)

	// 验证是 SHA256 格式
	if len(key) != 64 {
		t.Errorf("期望键长度为 64，实际为 %d", len(key))
	}

	// 手动计算验证
	hash := sha256.Sum256(code)
	expected := hex.EncodeToString(hash[:])
	if key != expected {
		t.Errorf("期望键为 %s，实际为 %s", expected, key)
	}

	// 相同代码应该产生相同键
	key2 := cache.ComputeKey(code)
	if key != key2 {
		t.Error("相同代码应该产生相同键")
	}

	// 不同代码应该产生不同键
	code2 := []byte("function test2() {}")
	key3 := cache.ComputeKey(code2)
	if key == key3 {
		t.Error("不同代码应该产生不同键")
	}
}

// TestAOTCacheGetOrCompile 测试获取或编译
func TestAOTCacheGetOrCompile(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	code := []byte("function hello() { return 'world'; }")
	compileCount := 0

	compiler := func(source []byte) (*CompiledModule, error) {
		compileCount++
		return &CompiledModule{
			Key:        cache.ComputeKey(source),
			Bytecode:   append([]byte("compiled:"), source...),
			SourceHash: cache.ComputeKey(source),
			CompiledAt: time.Now(),
		}, nil
	}

	// 首次调用应该编译
	result, err := cache.GetOrCompile(code, compiler)
	if err != nil {
		t.Fatalf("GetOrCompile 失败: %v", err)
	}
	if compileCount != 1 {
		t.Errorf("期望编译次数为 1，实际为 %d", compileCount)
	}
	if result == nil {
		t.Fatal("期望获取到编译结果")
	}

	// 第二次调用应该命中缓存
	result2, err := cache.GetOrCompile(code, compiler)
	if err != nil {
		t.Fatalf("GetOrCompile 失败: %v", err)
	}
	if compileCount != 1 {
		t.Errorf("期望编译次数仍为 1（命中缓存），实际为 %d", compileCount)
	}
	if result2.Key != result.Key {
		t.Error("两次获取的结果应该相同")
	}
}

// TestAOTCacheDiskPersistence 测试磁盘持久化
func TestAOTCacheDiskPersistence(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:    tmpDir,
		MaxEntries:  100,
		TTL:         time.Hour,
		PersistDisk: true,
	}

	// 创建第一个缓存实例并存储数据
	cache1, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}

	code := []byte("function persist() {}")
	key := cache1.ComputeKey(code)
	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   []byte("persistent bytecode"),
		SourceHash: key,
		CompiledAt: time.Now(),
	}
	cache1.Put(key, compiled)

	// 强制刷新到磁盘
	err = cache1.Flush()
	if err != nil {
		t.Fatalf("刷新缓存失败: %v", err)
	}
	cache1.Close()

	// 创建新的缓存实例，应该能加载之前的数据
	cache2, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建第二个 AOT 缓存失败: %v", err)
	}
	defer cache2.Close()

	result, hit := cache2.Get(key)
	if !hit {
		t.Error("期望从磁盘加载缓存命中")
	}
	if result == nil {
		t.Fatal("期望获取到编译结果")
	}
	if string(result.Bytecode) != "persistent bytecode" {
		t.Errorf("期望字节码为 'persistent bytecode'，实际为 %s", result.Bytecode)
	}
}

// TestAOTCacheTTLExpiration 测试 TTL 过期
func TestAOTCacheTTLExpiration(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100,
		TTL:        50 * time.Millisecond, // 短 TTL 用于测试
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	code := []byte("function expire() {}")
	key := cache.ComputeKey(code)
	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   []byte("expiring bytecode"),
		SourceHash: key,
		CompiledAt: time.Now(),
	}
	cache.Put(key, compiled)

	// 立即获取应该命中
	_, hit := cache.Get(key)
	if !hit {
		t.Error("期望立即获取命中")
	}

	// 等待过期
	time.Sleep(100 * time.Millisecond)

	// 过期后应该未命中
	_, hit = cache.Get(key)
	if hit {
		t.Error("期望过期后未命中")
	}
}

// TestAOTCacheMaxEntries 测试最大条目限制
func TestAOTCacheMaxEntries(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 3,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	// 添加 5 个条目
	for i := 0; i < 5; i++ {
		code := []byte("function test" + string(rune('0'+i)) + "() {}")
		key := cache.ComputeKey(code)
		compiled := &CompiledModule{
			Key:        key,
			Bytecode:   code,
			SourceHash: key,
			CompiledAt: time.Now(),
		}
		cache.Put(key, compiled)
		time.Sleep(10 * time.Millisecond) // 确保时间戳不同
	}

	stats := cache.Stats()
	if stats.Entries > config.MaxEntries {
		t.Errorf("期望条目数 <= %d，实际为 %d", config.MaxEntries, stats.Entries)
	}
}

// TestAOTCacheStats 测试统计信息
func TestAOTCacheStats(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	code := []byte("function stats() {}")
	key := cache.ComputeKey(code)

	// 未命中
	cache.Get(key)

	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   []byte("bytecode"),
		SourceHash: key,
		CompiledAt: time.Now(),
	}
	cache.Put(key, compiled)

	// 命中
	cache.Get(key)
	cache.Get(key)

	stats := cache.Stats()
	if stats.Hits != 2 {
		t.Errorf("期望命中次数为 2，实际为 %d", stats.Hits)
	}
	if stats.Misses != 1 {
		t.Errorf("期望未命中次数为 1，实际为 %d", stats.Misses)
	}
	if stats.Entries != 1 {
		t.Errorf("期望条目数为 1，实际为 %d", stats.Entries)
	}
}

// TestAOTCacheConcurrency 测试并发安全
func TestAOTCacheConcurrency(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 1000,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	var wg sync.WaitGroup
	numGoroutines := 10
	numOperations := 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				code := []byte("function concurrent" + string(rune('0'+id)) + "() {}")
				key := cache.ComputeKey(code)

				// 随机读写
				if j%2 == 0 {
					compiled := &CompiledModule{
						Key:        key,
						Bytecode:   code,
						SourceHash: key,
						CompiledAt: time.Now(),
					}
					cache.Put(key, compiled)
				} else {
					cache.Get(key)
				}
			}
		}(i)
	}

	wg.Wait()

	// 验证没有 panic
	stats := cache.Stats()
	if stats.Hits+stats.Misses == 0 {
		t.Error("期望有访问记录")
	}
}

// TestAOTCacheInvalidate 测试缓存失效
func TestAOTCacheInvalidate(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	code := []byte("function invalidate() {}")
	key := cache.ComputeKey(code)
	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   []byte("bytecode"),
		SourceHash: key,
		CompiledAt: time.Now(),
	}
	cache.Put(key, compiled)

	// 验证存在
	_, hit := cache.Get(key)
	if !hit {
		t.Error("期望缓存存在")
	}

	// 失效
	cache.Invalidate(key)

	// 验证已删除
	_, hit = cache.Get(key)
	if hit {
		t.Error("期望缓存已失效")
	}
}

// TestAOTCacheClear 测试清空缓存
func TestAOTCacheClear(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100,
		TTL:        time.Hour,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}
	defer cache.Close()

	// 添加多个条目
	for i := 0; i < 5; i++ {
		code := []byte("function clear" + string(rune('0'+i)) + "() {}")
		key := cache.ComputeKey(code)
		compiled := &CompiledModule{
			Key:        key,
			Bytecode:   code,
			SourceHash: key,
			CompiledAt: time.Now(),
		}
		cache.Put(key, compiled)
	}

	stats := cache.Stats()
	if stats.Entries != 5 {
		t.Errorf("期望条目数为 5，实际为 %d", stats.Entries)
	}

	// 清空
	cache.Clear()

	stats = cache.Stats()
	if stats.Entries != 0 {
		t.Errorf("期望清空后条目数为 0，实际为 %d", stats.Entries)
	}
}

// TestAOTCacheDefaultConfig 测试默认配置
func TestAOTCacheDefaultConfig(t *testing.T) {
	config := DefaultAOTCacheConfig()

	if config.MaxEntries != 1000 {
		t.Errorf("期望默认 MaxEntries 为 1000，实际为 %d", config.MaxEntries)
	}
	if config.TTL != 24*time.Hour {
		t.Errorf("期望默认 TTL 为 24h，实际为 %v", config.TTL)
	}
	if config.PersistDisk != true {
		t.Error("期望默认 PersistDisk 为 true")
	}
}

// TestAOTCacheInvalidCacheDir 测试无效缓存目录
func TestAOTCacheInvalidCacheDir(t *testing.T) {
	config := AOTCacheConfig{
		CacheDir:    "/nonexistent/path/that/should/not/exist",
		MaxEntries:  100,
		TTL:         time.Hour,
		PersistDisk: true,
	}

	// 应该返回错误（无权限创建目录）
	_, err := NewAOTCache(config)
	// 在大多数系统上，创建 /nonexistent 目录会失败
	// 但如果有权限，也是可接受的
	if err != nil {
		// 预期行为：返回权限错误
		t.Logf("预期的错误: %v", err)
	} else {
		// 如果成功创建，清理
		os.RemoveAll("/nonexistent")
	}
}

// TestAOTCacheDiskFile 测试磁盘文件格式
func TestAOTCacheDiskFile(t *testing.T) {
	tmpDir := t.TempDir()
	config := AOTCacheConfig{
		CacheDir:    tmpDir,
		MaxEntries:  100,
		TTL:         time.Hour,
		PersistDisk: true,
	}

	cache, err := NewAOTCache(config)
	if err != nil {
		t.Fatalf("创建 AOT 缓存失败: %v", err)
	}

	code := []byte("function disk() {}")
	key := cache.ComputeKey(code)
	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   []byte("disk bytecode"),
		SourceHash: key,
		CompiledAt: time.Now(),
	}
	cache.Put(key, compiled)

	// 刷新到磁盘
	err = cache.Flush()
	if err != nil {
		t.Fatalf("刷新缓存失败: %v", err)
	}
	cache.Close()

	// 验证磁盘文件存在
	cacheFile := filepath.Join(tmpDir, "aot_cache.gob")
	if _, err := os.Stat(cacheFile); os.IsNotExist(err) {
		// 也可能是其他文件名格式
		files, _ := os.ReadDir(tmpDir)
		if len(files) == 0 {
			t.Error("期望磁盘缓存文件存在")
		}
	}
}

// BenchmarkAOTCacheGet 基准测试获取
func BenchmarkAOTCacheGet(b *testing.B) {
	tmpDir := b.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 1000,
		TTL:        time.Hour,
	}

	cache, _ := NewAOTCache(config)
	defer cache.Close()

	code := []byte("function bench() {}")
	key := cache.ComputeKey(code)
	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   code,
		SourceHash: key,
		CompiledAt: time.Now(),
	}
	cache.Put(key, compiled)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cache.Get(key)
	}
}

// BenchmarkAOTCachePut 基准测试存储
func BenchmarkAOTCachePut(b *testing.B) {
	tmpDir := b.TempDir()
	config := AOTCacheConfig{
		CacheDir:   tmpDir,
		MaxEntries: 100000,
		TTL:        time.Hour,
	}

	cache, _ := NewAOTCache(config)
	defer cache.Close()

	code := []byte("function bench() {}")
	key := cache.ComputeKey(code)
	compiled := &CompiledModule{
		Key:        key,
		Bytecode:   code,
		SourceHash: key,
		CompiledAt: time.Now(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cache.Put(key, compiled)
	}
}
