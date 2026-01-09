package core

import (
	"fmt"
	"testing"
)

func TestNewHLL(t *testing.T) {
	hll := NewHLL()
	if hll == nil {
		t.Fatal("NewHLL returned nil")
	}
	if hll.Count() != 0 {
		t.Errorf("Count() = %d, want 0", hll.Count())
	}
}

func TestHLLAdd(t *testing.T) {
	hll := NewHLL()

	// 添加不同的元素
	hll.Add("user_001")
	hll.Add("user_002")
	hll.Add("user_003")

	count := hll.Count()
	if count != 3 {
		t.Errorf("Count() = %d, want 3", count)
	}

	// 添加重复元素不应增加计数
	hll.Add("user_001")
	hll.Add("user_002")

	count = hll.Count()
	if count != 3 {
		t.Errorf("Count() after duplicates = %d, want 3", count)
	}
}

func TestHLLBytes(t *testing.T) {
	hll := NewHLL()
	hll.Add("user_001")
	hll.Add("user_002")
	hll.Add("user_003")

	// 序列化
	data, err := hll.Bytes()
	if err != nil {
		t.Fatalf("Bytes() error = %v", err)
	}
	if len(data) == 0 {
		t.Error("Bytes() returned empty data")
	}

	// 反序列化
	restored, err := NewHLLFromBytes(data)
	if err != nil {
		t.Fatalf("NewHLLFromBytes() error = %v", err)
	}

	if restored.Count() != hll.Count() {
		t.Errorf("Restored Count() = %d, want %d", restored.Count(), hll.Count())
	}
}

func TestHLLFromEmptyBytes(t *testing.T) {
	hll, err := NewHLLFromBytes(nil)
	if err != nil {
		t.Fatalf("NewHLLFromBytes(nil) error = %v", err)
	}
	if hll.Count() != 0 {
		t.Errorf("Count() = %d, want 0", hll.Count())
	}

	hll, err = NewHLLFromBytes([]byte{})
	if err != nil {
		t.Fatalf("NewHLLFromBytes([]) error = %v", err)
	}
	if hll.Count() != 0 {
		t.Errorf("Count() = %d, want 0", hll.Count())
	}
}

func TestHLLMerge(t *testing.T) {
	hll1 := NewHLL()
	hll1.Add("user_001")
	hll1.Add("user_002")

	hll2 := NewHLL()
	hll2.Add("user_003")
	hll2.Add("user_004")

	// 合并
	err := hll1.Merge(hll2)
	if err != nil {
		t.Fatalf("Merge() error = %v", err)
	}

	count := hll1.Count()
	if count != 4 {
		t.Errorf("Count() after merge = %d, want 4", count)
	}
}

func TestHLLMergeWithOverlap(t *testing.T) {
	hll1 := NewHLL()
	hll1.Add("user_001")
	hll1.Add("user_002")

	hll2 := NewHLL()
	hll2.Add("user_002") // 重复
	hll2.Add("user_003")

	err := hll1.Merge(hll2)
	if err != nil {
		t.Fatalf("Merge() error = %v", err)
	}

	count := hll1.Count()
	if count != 3 {
		t.Errorf("Count() after merge with overlap = %d, want 3", count)
	}
}

func TestHLLMergeNil(t *testing.T) {
	hll := NewHLL()
	hll.Add("user_001")

	err := hll.Merge(nil)
	if err != nil {
		t.Fatalf("Merge(nil) error = %v", err)
	}

	if hll.Count() != 1 {
		t.Errorf("Count() = %d, want 1", hll.Count())
	}
}

func TestHLLMergeBytes(t *testing.T) {
	hll1 := NewHLL()
	hll1.Add("user_001")
	hll1.Add("user_002")

	hll2 := NewHLL()
	hll2.Add("user_003")
	data, _ := hll2.Bytes()

	err := hll1.MergeBytes(data)
	if err != nil {
		t.Fatalf("MergeBytes() error = %v", err)
	}

	if hll1.Count() != 3 {
		t.Errorf("Count() = %d, want 3", hll1.Count())
	}
}

func TestHLLClone(t *testing.T) {
	hll := NewHLL()
	hll.Add("user_001")
	hll.Add("user_002")

	clone, err := hll.Clone()
	if err != nil {
		t.Fatalf("Clone() error = %v", err)
	}

	// 修改原始 HLL 不应影响克隆
	hll.Add("user_003")

	if clone.Count() != 2 {
		t.Errorf("Clone Count() = %d, want 2", clone.Count())
	}
	if hll.Count() != 3 {
		t.Errorf("Original Count() = %d, want 3", hll.Count())
	}
}

func TestHLLReset(t *testing.T) {
	hll := NewHLL()
	hll.Add("user_001")
	hll.Add("user_002")

	hll.Reset()

	if hll.Count() != 0 {
		t.Errorf("Count() after Reset = %d, want 0", hll.Count())
	}
}

func TestMergeHLLBytes(t *testing.T) {
	hll1 := NewHLL()
	hll1.Add("user_001")
	hll1.Add("user_002")
	data1, _ := hll1.Bytes()

	hll2 := NewHLL()
	hll2.Add("user_003")
	hll2.Add("user_004")
	data2, _ := hll2.Bytes()

	hll3 := NewHLL()
	hll3.Add("user_002") // 重复
	hll3.Add("user_005")
	data3, _ := hll3.Bytes()

	merged, count, err := MergeHLLBytes(data1, data2, data3)
	if err != nil {
		t.Fatalf("MergeHLLBytes() error = %v", err)
	}

	if count != 5 {
		t.Errorf("Count = %d, want 5", count)
	}

	if len(merged) == 0 {
		t.Error("Merged bytes should not be empty")
	}
}

func TestHLLAccuracy(t *testing.T) {
	// 测试 HLL 的准确性（误差应在 2% 以内）
	hll := NewHLL()
	n := 10000

	for i := 0; i < n; i++ {
		hll.Add(fmt.Sprintf("user_%d", i))
	}

	count := hll.Count()
	errorRate := float64(int(count)-n) / float64(n) * 100

	// 误差应在 ±5% 以内（HLL 标准误差约 2%）
	if errorRate > 5 || errorRate < -5 {
		t.Errorf("Error rate = %.2f%%, should be within ±5%%", errorRate)
	}

	t.Logf("HLL accuracy test: actual=%d, estimated=%d, error=%.2f%%", n, count, errorRate)
}

func BenchmarkHLLAdd(b *testing.B) {
	hll := NewHLL()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		hll.Add(fmt.Sprintf("user_%d", i))
	}
}

func BenchmarkHLLMerge(b *testing.B) {
	hll1 := NewHLL()
	for i := 0; i < 1000; i++ {
		hll1.Add(fmt.Sprintf("user_%d", i))
	}

	hll2 := NewHLL()
	for i := 1000; i < 2000; i++ {
		hll2.Add(fmt.Sprintf("user_%d", i))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		clone, _ := hll1.Clone()
		clone.Merge(hll2)
	}
}

func BenchmarkHLLBytes(b *testing.B) {
	hll := NewHLL()
	for i := 0; i < 1000; i++ {
		hll.Add(fmt.Sprintf("user_%d", i))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		hll.Bytes()
	}
}
