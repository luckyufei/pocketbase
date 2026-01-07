package types

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Vector 定义用于存储向量嵌入的类型。
//
// 向量以 float64 切片形式存储，支持任意维度。
// 常见维度：
//   - OpenAI text-embedding-ada-002: 1536
//   - OpenAI text-embedding-3-small: 1536
//   - OpenAI text-embedding-3-large: 3072
//   - Cohere embed-english-v3.0: 1024
//   - Sentence Transformers: 384-768
//
// 在 PostgreSQL 中使用 pgvector 扩展存储。
type Vector []float64

// String 返回向量的字符串表示。
func (v Vector) String() string {
	if len(v) == 0 {
		return "[]"
	}

	var sb strings.Builder
	sb.WriteByte('[')
	for i, val := range v {
		if i > 0 {
			sb.WriteByte(',')
		}
		// 使用 -1 精度以避免不必要的小数位
		sb.WriteString(strconv.FormatFloat(val, 'f', -1, 64))
	}
	sb.WriteByte(']')
	return sb.String()
}

// Dimension 返回向量的维度。
func (v Vector) Dimension() int {
	return len(v)
}

// IsZero 检查向量是否为空或全零。
func (v Vector) IsZero() bool {
	if len(v) == 0 {
		return true
	}
	for _, val := range v {
		if val != 0 {
			return false
		}
	}
	return true
}

// ToPgVector 返回 PostgreSQL pgvector 格式的字符串。
// 格式: [1,2,3]
func (v Vector) ToPgVector() string {
	return v.String()
}

// Value 实现 [driver.Valuer] 接口。
func (v Vector) Value() (driver.Value, error) {
	if len(v) == 0 {
		return "[]", nil
	}
	return v.String(), nil
}

// Scan 实现 [sql.Scanner] 接口，用于从数据库扫描值。
//
// 支持的输入类型：
//   - nil: 返回空向量
//   - Vector / *Vector: 直接复制
//   - []float64: 直接转换
//   - []interface{}: 转换每个元素
//   - string / []byte: JSON 解析
//   - JSONRaw: JSON 解析
func (v *Vector) Scan(value any) error {
	switch val := value.(type) {
	case nil:
		*v = Vector{}
		return nil
	case Vector:
		*v = make(Vector, len(val))
		copy(*v, val)
		return nil
	case *Vector:
		if val == nil {
			*v = Vector{}
			return nil
		}
		*v = make(Vector, len(*val))
		copy(*v, *val)
		return nil
	case []float64:
		*v = make(Vector, len(val))
		copy(*v, val)
		return nil
	case []interface{}:
		result := make(Vector, len(val))
		for i, item := range val {
			switch n := item.(type) {
			case float64:
				result[i] = n
			case float32:
				result[i] = float64(n)
			case int:
				result[i] = float64(n)
			case int64:
				result[i] = float64(n)
			case json.Number:
				f, err := n.Float64()
				if err != nil {
					return fmt.Errorf("[Vector] 无法转换 json.Number: %w", err)
				}
				result[i] = f
			default:
				return fmt.Errorf("[Vector] 不支持的数组元素类型: %T", item)
			}
		}
		*v = result
		return nil
	case JSONRaw:
		if len(val) == 0 {
			*v = Vector{}
			return nil
		}
		return json.Unmarshal(val, v)
	case []byte:
		if len(val) == 0 {
			*v = Vector{}
			return nil
		}
		return json.Unmarshal(val, v)
	case string:
		if len(val) == 0 {
			*v = Vector{}
			return nil
		}
		return json.Unmarshal([]byte(val), v)
	default:
		// 尝试 JSON 序列化后解析
		data, err := json.Marshal(val)
		if err != nil {
			return fmt.Errorf("[Vector] 无法序列化值: %w", err)
		}
		return json.Unmarshal(data, v)
	}
}

// ============================================================================
// 向量运算
// ============================================================================

// EuclideanDistance 计算与另一个向量的欧几里得距离 (L2 距离)。
// 对应 PostgreSQL pgvector 的 <-> 操作符。
func (v Vector) EuclideanDistance(other Vector) (float64, error) {
	if len(v) != len(other) {
		return 0, fmt.Errorf("向量维度不匹配: %d vs %d", len(v), len(other))
	}

	var sum float64
	for i := range v {
		diff := v[i] - other[i]
		sum += diff * diff
	}
	return math.Sqrt(sum), nil
}

// CosineSimilarity 计算与另一个向量的余弦相似度。
// 返回值范围 [-1, 1]，1 表示完全相同，-1 表示完全相反，0 表示正交。
func (v Vector) CosineSimilarity(other Vector) (float64, error) {
	if len(v) != len(other) {
		return 0, fmt.Errorf("向量维度不匹配: %d vs %d", len(v), len(other))
	}

	var dot, normV, normOther float64
	for i := range v {
		dot += v[i] * other[i]
		normV += v[i] * v[i]
		normOther += other[i] * other[i]
	}

	normV = math.Sqrt(normV)
	normOther = math.Sqrt(normOther)

	if normV == 0 || normOther == 0 {
		return 0, nil
	}

	return dot / (normV * normOther), nil
}

// CosineDistance 计算与另一个向量的余弦距离。
// 对应 PostgreSQL pgvector 的 <=> 操作符。
// 返回值范围 [0, 2]，0 表示完全相同。
func (v Vector) CosineDistance(other Vector) (float64, error) {
	sim, err := v.CosineSimilarity(other)
	if err != nil {
		return 0, err
	}
	return 1 - sim, nil
}

// DotProduct 计算与另一个向量的内积 (点积)。
// 对应 PostgreSQL pgvector 的 <#> 操作符 (负内积)。
func (v Vector) DotProduct(other Vector) (float64, error) {
	if len(v) != len(other) {
		return 0, fmt.Errorf("向量维度不匹配: %d vs %d", len(v), len(other))
	}

	var sum float64
	for i := range v {
		sum += v[i] * other[i]
	}
	return sum, nil
}

// NegativeInnerProduct 计算负内积。
// 对应 PostgreSQL pgvector 的 <#> 操作符。
func (v Vector) NegativeInnerProduct(other Vector) (float64, error) {
	dot, err := v.DotProduct(other)
	if err != nil {
		return 0, err
	}
	return -dot, nil
}

// L2Norm 计算向量的 L2 范数 (欧几里得范数)。
func (v Vector) L2Norm() float64 {
	var sum float64
	for _, val := range v {
		sum += val * val
	}
	return math.Sqrt(sum)
}

// Normalize 返回归一化后的向量 (单位向量)。
func (v Vector) Normalize() Vector {
	norm := v.L2Norm()
	if norm == 0 {
		return make(Vector, len(v))
	}

	result := make(Vector, len(v))
	for i, val := range v {
		result[i] = val / norm
	}
	return result
}
