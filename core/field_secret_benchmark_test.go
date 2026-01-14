package core_test

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// BenchmarkSecretFieldSet 基准测试 SecretField 设置值性能
func BenchmarkSecretFieldSet(b *testing.B) {
	// 设置 master key
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	defer os.Unsetenv(core.MasterKeyEnvVar)

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	collection := core.NewBaseCollection("bench_secret_set")
	collection.Fields.Add(&core.SecretField{
		Id:   "secret_field",
		Name: "api_key",
	})
	if err := app.Save(collection); err != nil {
		b.Fatalf("Failed to save collection: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		record := core.NewRecord(collection)
		record.Set("api_key", "sk-benchmark-test-key-123456")
	}
}

// BenchmarkSecretFieldGet 基准测试 SecretField 获取值性能
func BenchmarkSecretFieldGet(b *testing.B) {
	// 设置 master key
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	defer os.Unsetenv(core.MasterKeyEnvVar)

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	collection := core.NewBaseCollection("bench_secret_get")
	collection.Fields.Add(&core.SecretField{
		Id:   "secret_field",
		Name: "api_key",
	})
	if err := app.Save(collection); err != nil {
		b.Fatalf("Failed to save collection: %v", err)
	}

	record := core.NewRecord(collection)
	record.Set("api_key", "sk-benchmark-test-key-123456")
	if err := app.Save(record); err != nil {
		b.Fatalf("Failed to save record: %v", err)
	}

	// 从数据库加载（确保有密文）
	loaded, _ := app.FindRecordById(collection.Name, record.Id)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = loaded.GetString("api_key")
	}
}

// BenchmarkSecretFieldSave 基准测试 SecretField 保存性能
func BenchmarkSecretFieldSave(b *testing.B) {
	// 设置 master key
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	defer os.Unsetenv(core.MasterKeyEnvVar)

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	collection := core.NewBaseCollection("bench_secret_save")
	collection.Fields.Add(&core.SecretField{
		Id:   "secret_field",
		Name: "api_key",
	})
	if err := app.Save(collection); err != nil {
		b.Fatalf("Failed to save collection: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		record := core.NewRecord(collection)
		record.Set("api_key", "sk-benchmark-test-key-123456")
		if err := app.Save(record); err != nil {
			b.Fatalf("Failed to save record: %v", err)
		}
	}
}

// BenchmarkSecretFieldLoad 基准测试 SecretField 加载性能
func BenchmarkSecretFieldLoad(b *testing.B) {
	// 设置 master key
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	defer os.Unsetenv(core.MasterKeyEnvVar)

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	collection := core.NewBaseCollection("bench_secret_load")
	collection.Fields.Add(&core.SecretField{
		Id:   "secret_field",
		Name: "api_key",
	})
	if err := app.Save(collection); err != nil {
		b.Fatalf("Failed to save collection: %v", err)
	}

	// 创建测试记录
	record := core.NewRecord(collection)
	record.Set("api_key", "sk-benchmark-test-key-123456")
	if err := app.Save(record); err != nil {
		b.Fatalf("Failed to save record: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		loaded, err := app.FindRecordById(collection.Name, record.Id)
		if err != nil {
			b.Fatalf("Failed to load record: %v", err)
		}
		// 验证解密成功
		_ = loaded.GetString("api_key")
	}
}

// BenchmarkSecretFieldBatchRead 基准测试批量读取 SecretField 性能
func BenchmarkSecretFieldBatchRead(b *testing.B) {
	// 设置 master key
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	defer os.Unsetenv(core.MasterKeyEnvVar)

	app, _ := tests.NewTestApp()
	defer app.Cleanup()

	collection := core.NewBaseCollection("bench_secret_batch")
	collection.Fields.Add(&core.SecretField{
		Id:   "secret_field",
		Name: "api_key",
	})
	if err := app.Save(collection); err != nil {
		b.Fatalf("Failed to save collection: %v", err)
	}

	// 创建 100 条测试记录
	for i := 0; i < 100; i++ {
		record := core.NewRecord(collection)
		record.Set("api_key", "sk-benchmark-test-key-123456")
		if err := app.Save(record); err != nil {
			b.Fatalf("Failed to save record: %v", err)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		records, err := app.FindAllRecords(collection.Name)
		if err != nil {
			b.Fatalf("Failed to find records: %v", err)
		}
		// 解密所有记录
		for _, r := range records {
			_ = r.GetString("api_key")
		}
	}
}
