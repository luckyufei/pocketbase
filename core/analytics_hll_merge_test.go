package core

import (
	"testing"
)

// TestMergeHLLBytes_CrossDay 测试跨天 HLL 合并。
// 这是 US5 的核心测试：同一用户在多天访问，合并后 UV 应该正确去重。
func TestMergeHLLBytes_CrossDay(t *testing.T) {
	// 模拟 3 天的数据
	day1 := NewHLL()
	day1.Add("user1")
	day1.Add("user2")
	day1.Add("user3")
	day1Bytes, _ := day1.Bytes()

	day2 := NewHLL()
	day2.Add("user1") // 同一用户
	day2.Add("user4")
	day2.Add("user5")
	day2Bytes, _ := day2.Bytes()

	day3 := NewHLL()
	day3.Add("user1") // 同一用户
	day3.Add("user2") // 同一用户
	day3.Add("user6")
	day3Bytes, _ := day3.Bytes()

	// 合并 3 天的 HLL
	_, count, err := MergeHLLBytes(day1Bytes, day2Bytes, day3Bytes)
	if err != nil {
		t.Fatalf("MergeHLLBytes failed: %v", err)
	}

	// 预期 UV = 6（user1-6，去重后）
	// HLL 有约 2% 误差，允许 5-7 的范围
	if count < 5 || count > 7 {
		t.Errorf("Expected UV around 6, got %d", count)
	}
}

// TestMergeHLLBytes_EmptySketches 测试空 Sketch 合并。
func TestMergeHLLBytes_EmptySketches(t *testing.T) {
	_, count, err := MergeHLLBytes()
	if err != nil {
		t.Fatalf("MergeHLLBytes with empty input failed: %v", err)
	}
	if count != 0 {
		t.Errorf("Expected 0 for empty merge, got %d", count)
	}
}

// TestMergeHLLBytes_SingleSketch 测试单个 Sketch 合并。
func TestMergeHLLBytes_SingleSketch(t *testing.T) {
	hll := NewHLL()
	hll.Add("user1")
	hll.Add("user2")
	bytes, _ := hll.Bytes()

	_, count, err := MergeHLLBytes(bytes)
	if err != nil {
		t.Fatalf("MergeHLLBytes with single sketch failed: %v", err)
	}
	if count != 2 {
		t.Errorf("Expected 2, got %d", count)
	}
}

// TestMergeHLLBytes_WithNilBytes 测试包含 nil 的 Sketch 合并。
func TestMergeHLLBytes_WithNilBytes(t *testing.T) {
	hll := NewHLL()
	hll.Add("user1")
	bytes, _ := hll.Bytes()

	_, count, err := MergeHLLBytes(nil, bytes, nil)
	if err != nil {
		t.Fatalf("MergeHLLBytes with nil bytes failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1, got %d", count)
	}
}

// TestMergeHLLBytes_LargeDataset 测试大数据量的 HLL 合并精度。
func TestMergeHLLBytes_LargeDataset(t *testing.T) {
	// 模拟 7 天，每天 1000 个用户，其中 500 个重复
	days := make([][]byte, 7)
	uniqueUsers := make(map[string]bool)

	for d := 0; d < 7; d++ {
		hll := NewHLL()
		// 500 个重复用户
		for i := 0; i < 500; i++ {
			userID := "common_user_" + string(rune('0'+i%10)) + string(rune('0'+i/10%10)) + string(rune('0'+i/100%10))
			hll.Add(userID)
			uniqueUsers[userID] = true
		}
		// 500 个每天独立用户
		for i := 0; i < 500; i++ {
			userID := "day" + string(rune('0'+d)) + "_user_" + string(rune('0'+i%10)) + string(rune('0'+i/10%10)) + string(rune('0'+i/100%10))
			hll.Add(userID)
			uniqueUsers[userID] = true
		}
		days[d], _ = hll.Bytes()
	}

	_, count, err := MergeHLLBytes(days...)
	if err != nil {
		t.Fatalf("MergeHLLBytes large dataset failed: %v", err)
	}

	expectedUV := len(uniqueUsers)
	// HLL 误差约 2%，允许 ±5% 的范围
	errorMargin := float64(expectedUV) * 0.05
	if float64(count) < float64(expectedUV)-errorMargin || float64(count) > float64(expectedUV)+errorMargin {
		t.Errorf("Expected UV around %d, got %d (error: %.2f%%)", expectedUV, count, float64(int64(count)-int64(expectedUV))/float64(expectedUV)*100)
	}
}
