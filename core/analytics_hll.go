package core

import (
	"github.com/axiomhq/hyperloglog"
)

// HLL 封装 HyperLogLog 操作，用于 UV 去重统计。
// HyperLogLog 是一种概率性数据结构，可以在极小的内存占用下
// 估算集合的基数（不重复元素数量），误差率约 2%。
type HLL struct {
	sketch *hyperloglog.Sketch
}

// NewHLL 创建一个新的 HLL 实例。
func NewHLL() *HLL {
	return &HLL{
		sketch: hyperloglog.New(),
	}
}

// NewHLLFromBytes 从字节数组恢复 HLL 实例。
func NewHLLFromBytes(data []byte) (*HLL, error) {
	if len(data) == 0 {
		return NewHLL(), nil
	}

	sketch := hyperloglog.New()
	if err := sketch.UnmarshalBinary(data); err != nil {
		return nil, err
	}

	return &HLL{sketch: sketch}, nil
}

// Add 添加一个元素到 HLL。
// 通常使用 SessionID 或 UserID 作为元素。
func (h *HLL) Add(element string) {
	if h.sketch == nil {
		h.sketch = hyperloglog.New()
	}
	h.sketch.Insert([]byte(element))
}

// AddBytes 添加字节数组元素到 HLL。
func (h *HLL) AddBytes(element []byte) {
	if h.sketch == nil {
		h.sketch = hyperloglog.New()
	}
	h.sketch.Insert(element)
}

// Count 返回估算的不重复元素数量。
func (h *HLL) Count() uint64 {
	if h.sketch == nil {
		return 0
	}
	return h.sketch.Estimate()
}

// Merge 合并另一个 HLL 到当前实例。
// 合并后的 HLL 包含两个 HLL 的所有元素。
func (h *HLL) Merge(other *HLL) error {
	if other == nil || other.sketch == nil {
		return nil
	}
	if h.sketch == nil {
		h.sketch = hyperloglog.New()
	}
	return h.sketch.Merge(other.sketch)
}

// MergeBytes 从字节数组合并 HLL。
func (h *HLL) MergeBytes(data []byte) error {
	if len(data) == 0 {
		return nil
	}

	other, err := NewHLLFromBytes(data)
	if err != nil {
		return err
	}

	return h.Merge(other)
}

// Bytes 将 HLL 序列化为字节数组，用于持久化存储。
func (h *HLL) Bytes() ([]byte, error) {
	if h.sketch == nil {
		return nil, nil
	}
	return h.sketch.MarshalBinary()
}

// Clone 创建 HLL 的深拷贝。
func (h *HLL) Clone() (*HLL, error) {
	data, err := h.Bytes()
	if err != nil {
		return nil, err
	}
	return NewHLLFromBytes(data)
}

// Reset 重置 HLL 到初始状态。
func (h *HLL) Reset() {
	h.sketch = hyperloglog.New()
}

// MergeHLLBytes 合并多个 HLL 字节数组，返回合并后的字节数组。
// 这是一个便捷函数，用于跨天 UV 合并。
func MergeHLLBytes(sketches ...[]byte) ([]byte, uint64, error) {
	merged := NewHLL()

	for _, data := range sketches {
		if err := merged.MergeBytes(data); err != nil {
			return nil, 0, err
		}
	}

	bytes, err := merged.Bytes()
	if err != nil {
		return nil, 0, err
	}

	return bytes, merged.Count(), nil
}
