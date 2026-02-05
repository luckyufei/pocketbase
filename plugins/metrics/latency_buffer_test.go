package metrics_test

import (
	"sync"
	"testing"

	"github.com/pocketbase/pocketbase/plugins/metrics"
)

// ============================================================================
// LatencyBuffer Tests
// ============================================================================

func TestNewLatencyBuffer(t *testing.T) {
	t.Parallel()

	buf := metrics.NewLatencyBuffer(100)
	if buf == nil {
		t.Fatal("Expected non-nil LatencyBuffer")
	}

	// P95 of empty buffer should be 0
	if p95 := buf.P95(); p95 != 0 {
		t.Fatalf("Expected P95 of empty buffer to be 0, got %v", p95)
	}
}

func TestLatencyBufferAdd(t *testing.T) {
	t.Parallel()

	buf := metrics.NewLatencyBuffer(10)

	// Add single value
	buf.Add(100.0)
	if p95 := buf.P95(); p95 != 100.0 {
		t.Fatalf("Expected P95 to be 100.0, got %v", p95)
	}

	// Add more values
	for i := 1; i <= 9; i++ {
		buf.Add(float64(i * 10))
	}

	// With values 10, 20, 30, ..., 100, P95 should be 100
	p95 := buf.P95()
	if p95 != 100.0 {
		t.Fatalf("Expected P95 to be 100.0, got %v", p95)
	}
}

func TestLatencyBufferP95Calculation(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		values   []float64
		expected float64
	}{
		{
			name:     "single value",
			values:   []float64{50.0},
			expected: 50.0,
		},
		{
			name:     "two values",
			values:   []float64{10.0, 20.0},
			expected: 20.0,
		},
		{
			name:     "100 sequential values",
			values:   makeSequence(1, 100),
			expected: 95.0,
		},
		{
			name:     "20 values",
			values:   makeSequence(1, 20),
			expected: 19.0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			buf := metrics.NewLatencyBuffer(len(tc.values))
			for _, v := range tc.values {
				buf.Add(v)
			}

			p95 := buf.P95()
			if p95 != tc.expected {
				t.Fatalf("Expected P95 to be %v, got %v", tc.expected, p95)
			}
		})
	}
}

func TestLatencyBufferRingBehavior(t *testing.T) {
	t.Parallel()

	// Buffer size 5, add 10 values
	buf := metrics.NewLatencyBuffer(5)

	// Add 1-10, buffer should only contain 6-10
	for i := 1; i <= 10; i++ {
		buf.Add(float64(i))
	}

	// P95 of [6,7,8,9,10] should be 10
	p95 := buf.P95()
	if p95 != 10.0 {
		t.Fatalf("Expected P95 to be 10.0 after ring wrap, got %v", p95)
	}
}

func TestLatencyBufferReset(t *testing.T) {
	t.Parallel()

	buf := metrics.NewLatencyBuffer(10)
	buf.Add(100.0)
	buf.Add(200.0)

	buf.Reset()

	if p95 := buf.P95(); p95 != 0 {
		t.Fatalf("Expected P95 after reset to be 0, got %v", p95)
	}
}

func TestLatencyBufferConcurrency(t *testing.T) {
	t.Parallel()

	buf := metrics.NewLatencyBuffer(1000)
	var wg sync.WaitGroup

	// Concurrent writes
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(base int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				buf.Add(float64(base*100 + j))
			}
		}(i)
	}

	// Concurrent reads
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				_ = buf.P95()
			}
		}()
	}

	wg.Wait()

	// Should not panic and P95 should be reasonable
	p95 := buf.P95()
	if p95 < 0 || p95 > 1000 {
		t.Fatalf("P95 out of expected range: %v", p95)
	}
}

func TestLatencyBufferCount(t *testing.T) {
	t.Parallel()

	buf := metrics.NewLatencyBuffer(10)

	if buf.Count() != 0 {
		t.Fatalf("Expected count 0, got %d", buf.Count())
	}

	buf.Add(1.0)
	buf.Add(2.0)
	buf.Add(3.0)

	if buf.Count() != 3 {
		t.Fatalf("Expected count 3, got %d", buf.Count())
	}

	// Fill beyond capacity
	for i := 0; i < 20; i++ {
		buf.Add(float64(i))
	}

	// Should be capped at buffer size
	if buf.Count() != 10 {
		t.Fatalf("Expected count 10, got %d", buf.Count())
	}
}

// ============================================================================
// P95 Edge Cases Tests
// ============================================================================

func TestLatencyBufferP95EdgeCases(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		size     int
		values   []float64
		expected float64
	}{
		{
			name:     "very small buffer - 1 element",
			size:     1,
			values:   []float64{42.0},
			expected: 42.0,
		},
		{
			name:     "buffer size 2 with 2 values",
			size:     2,
			values:   []float64{10.0, 20.0},
			expected: 20.0,
		},
		{
			name:     "buffer size 3 with 3 values",
			size:     3,
			values:   []float64{10.0, 20.0, 30.0},
			expected: 30.0,
		},
		{
			name:     "large buffer partially filled",
			size:     100,
			values:   []float64{5.0, 10.0, 15.0},
			expected: 15.0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			buf := metrics.NewLatencyBuffer(tc.size)
			for _, v := range tc.values {
				buf.Add(v)
			}

			p95 := buf.P95()
			if p95 != tc.expected {
				t.Fatalf("Expected P95 to be %v, got %v", tc.expected, p95)
			}
		})
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

func makeSequence(start, end int) []float64 {
	result := make([]float64, end-start+1)
	for i := start; i <= end; i++ {
		result[i-start] = float64(i)
	}
	return result
}
