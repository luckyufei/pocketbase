package types

import (
	"database/sql/driver"
	"encoding/json"
	"testing"
)

// ============================================================================
// Vector 类型测试
// ============================================================================

func TestVectorString(t *testing.T) {
	tests := []struct {
		name     string
		vector   Vector
		expected string
	}{
		{
			name:     "空向量",
			vector:   Vector{},
			expected: "[]",
		},
		{
			name:     "单元素向量",
			vector:   Vector{1.5},
			expected: "[1.5]",
		},
		{
			name:     "多元素向量",
			vector:   Vector{1.0, 2.0, 3.0},
			expected: "[1,2,3]",
		},
		{
			name:     "高维向量",
			vector:   Vector{0.1, 0.2, 0.3, 0.4, 0.5},
			expected: "[0.1,0.2,0.3,0.4,0.5]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.vector.String()
			if result != tt.expected {
				t.Errorf("期望 %s, 实际 %s", tt.expected, result)
			}
		})
	}
}

func TestVectorDimension(t *testing.T) {
	tests := []struct {
		name     string
		vector   Vector
		expected int
	}{
		{
			name:     "空向量",
			vector:   Vector{},
			expected: 0,
		},
		{
			name:     "3维向量",
			vector:   Vector{1.0, 2.0, 3.0},
			expected: 3,
		},
		{
			name:     "1536维向量 (OpenAI)",
			vector:   make(Vector, 1536),
			expected: 1536,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.vector.Dimension()
			if result != tt.expected {
				t.Errorf("期望 %d, 实际 %d", tt.expected, result)
			}
		})
	}
}

func TestVectorIsZero(t *testing.T) {
	tests := []struct {
		name     string
		vector   Vector
		expected bool
	}{
		{
			name:     "空向量",
			vector:   Vector{},
			expected: true,
		},
		{
			name:     "全零向量",
			vector:   Vector{0, 0, 0},
			expected: true,
		},
		{
			name:     "非零向量",
			vector:   Vector{1.0, 0, 0},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.vector.IsZero()
			if result != tt.expected {
				t.Errorf("期望 %v, 实际 %v", tt.expected, result)
			}
		})
	}
}

func TestVectorValue(t *testing.T) {
	t.Run("实现 driver.Valuer 接口", func(t *testing.T) {
		var _ driver.Valuer = Vector{}
	})

	t.Run("返回 JSON 字符串", func(t *testing.T) {
		v := Vector{1.0, 2.0, 3.0}
		val, err := v.Value()
		if err != nil {
			t.Fatalf("Value() 失败: %v", err)
		}

		str, ok := val.(string)
		if !ok {
			t.Fatal("Value() 应该返回 string")
		}

		if str != "[1,2,3]" {
			t.Errorf("期望 [1,2,3], 实际 %s", str)
		}
	})

	t.Run("返回 PostgreSQL 向量格式", func(t *testing.T) {
		v := Vector{1.0, 2.0, 3.0}
		pgStr := v.ToPgVector()
		if pgStr != "[1,2,3]" {
			t.Errorf("期望 [1,2,3], 实际 %s", pgStr)
		}
	})
}

func TestVectorScan(t *testing.T) {
	t.Run("扫描 nil", func(t *testing.T) {
		var v Vector
		err := v.Scan(nil)
		if err != nil {
			t.Fatalf("Scan(nil) 失败: %v", err)
		}
		if len(v) != 0 {
			t.Errorf("期望空向量, 实际 %v", v)
		}
	})

	t.Run("扫描 Vector", func(t *testing.T) {
		var v Vector
		err := v.Scan(Vector{1.0, 2.0, 3.0})
		if err != nil {
			t.Fatalf("Scan(Vector) 失败: %v", err)
		}
		if len(v) != 3 || v[0] != 1.0 {
			t.Errorf("期望 [1,2,3], 实际 %v", v)
		}
	})

	t.Run("扫描 *Vector", func(t *testing.T) {
		var v Vector
		src := Vector{1.0, 2.0, 3.0}
		err := v.Scan(&src)
		if err != nil {
			t.Fatalf("Scan(*Vector) 失败: %v", err)
		}
		if len(v) != 3 {
			t.Errorf("期望 3 维, 实际 %d 维", len(v))
		}
	})

	t.Run("扫描 JSON 字符串", func(t *testing.T) {
		var v Vector
		err := v.Scan("[1.5, 2.5, 3.5]")
		if err != nil {
			t.Fatalf("Scan(string) 失败: %v", err)
		}
		if len(v) != 3 || v[0] != 1.5 {
			t.Errorf("期望 [1.5,2.5,3.5], 实际 %v", v)
		}
	})

	t.Run("扫描 []byte", func(t *testing.T) {
		var v Vector
		err := v.Scan([]byte("[1, 2, 3]"))
		if err != nil {
			t.Fatalf("Scan([]byte) 失败: %v", err)
		}
		if len(v) != 3 {
			t.Errorf("期望 3 维, 实际 %d 维", len(v))
		}
	})

	t.Run("扫描 []float64", func(t *testing.T) {
		var v Vector
		err := v.Scan([]float64{1.0, 2.0, 3.0})
		if err != nil {
			t.Fatalf("Scan([]float64) 失败: %v", err)
		}
		if len(v) != 3 {
			t.Errorf("期望 3 维, 实际 %d 维", len(v))
		}
	})

	t.Run("扫描 []interface{}", func(t *testing.T) {
		var v Vector
		err := v.Scan([]interface{}{1.0, 2.0, 3.0})
		if err != nil {
			t.Fatalf("Scan([]interface{}) 失败: %v", err)
		}
		if len(v) != 3 {
			t.Errorf("期望 3 维, 实际 %d 维", len(v))
		}
	})

	t.Run("扫描 PostgreSQL 向量格式", func(t *testing.T) {
		var v Vector
		// PostgreSQL pgvector 返回格式
		err := v.Scan("[1,2,3]")
		if err != nil {
			t.Fatalf("Scan(pg format) 失败: %v", err)
		}
		if len(v) != 3 {
			t.Errorf("期望 3 维, 实际 %d 维", len(v))
		}
	})

	t.Run("扫描无效值", func(t *testing.T) {
		var v Vector
		err := v.Scan("invalid")
		if err == nil {
			t.Error("期望错误, 实际 nil")
		}
	})
}

func TestVectorJSON(t *testing.T) {
	t.Run("JSON 序列化", func(t *testing.T) {
		v := Vector{1.0, 2.0, 3.0}
		data, err := json.Marshal(v)
		if err != nil {
			t.Fatalf("Marshal 失败: %v", err)
		}
		if string(data) != "[1,2,3]" {
			t.Errorf("期望 [1,2,3], 实际 %s", string(data))
		}
	})

	t.Run("JSON 反序列化", func(t *testing.T) {
		var v Vector
		err := json.Unmarshal([]byte("[1.5, 2.5, 3.5]"), &v)
		if err != nil {
			t.Fatalf("Unmarshal 失败: %v", err)
		}
		if len(v) != 3 || v[0] != 1.5 {
			t.Errorf("期望 [1.5,2.5,3.5], 实际 %v", v)
		}
	})
}

func TestVectorDistances(t *testing.T) {
	t.Run("欧几里得距离", func(t *testing.T) {
		v1 := Vector{0, 0, 0}
		v2 := Vector{3, 4, 0}

		dist, err := v1.EuclideanDistance(v2)
		if err != nil {
			t.Fatalf("EuclideanDistance 失败: %v", err)
		}
		if dist != 5.0 {
			t.Errorf("期望 5.0, 实际 %f", dist)
		}
	})

	t.Run("欧几里得距离 - 维度不匹配", func(t *testing.T) {
		v1 := Vector{0, 0}
		v2 := Vector{1, 1, 1}

		_, err := v1.EuclideanDistance(v2)
		if err == nil {
			t.Error("期望错误, 实际 nil")
		}
	})

	t.Run("余弦相似度", func(t *testing.T) {
		v1 := Vector{1, 0}
		v2 := Vector{0, 1}

		sim, err := v1.CosineSimilarity(v2)
		if err != nil {
			t.Fatalf("CosineSimilarity 失败: %v", err)
		}
		if sim != 0.0 {
			t.Errorf("期望 0.0, 实际 %f", sim)
		}
	})

	t.Run("余弦相似度 - 相同向量", func(t *testing.T) {
		v1 := Vector{1, 2, 3}
		v2 := Vector{1, 2, 3}

		sim, err := v1.CosineSimilarity(v2)
		if err != nil {
			t.Fatalf("CosineSimilarity 失败: %v", err)
		}
		if sim < 0.9999 || sim > 1.0001 {
			t.Errorf("期望 1.0, 实际 %f", sim)
		}
	})

	t.Run("内积", func(t *testing.T) {
		v1 := Vector{1, 2, 3}
		v2 := Vector{4, 5, 6}

		dot, err := v1.DotProduct(v2)
		if err != nil {
			t.Fatalf("DotProduct 失败: %v", err)
		}
		// 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
		if dot != 32.0 {
			t.Errorf("期望 32.0, 实际 %f", dot)
		}
	})

	t.Run("L2 范数", func(t *testing.T) {
		v := Vector{3, 4}
		norm := v.L2Norm()
		if norm != 5.0 {
			t.Errorf("期望 5.0, 实际 %f", norm)
		}
	})

	t.Run("归一化", func(t *testing.T) {
		v := Vector{3, 4}
		normalized := v.Normalize()

		if len(normalized) != 2 {
			t.Fatalf("期望 2 维, 实际 %d 维", len(normalized))
		}

		// 归一化后 L2 范数应该是 1
		norm := normalized.L2Norm()
		if norm < 0.9999 || norm > 1.0001 {
			t.Errorf("归一化后范数应该是 1, 实际 %f", norm)
		}
	})
}
