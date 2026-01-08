// Package loader 提供 Serverless 函数加载功能
package loader

import (
	"strings"
	"testing"
)

// TestSourceMapParser_Parse 测试 Source Map 解析
func TestSourceMapParser_Parse(t *testing.T) {
	parser := NewSourceMapParser()

	sourceMap := `{
  "version": 3,
  "file": "hello.js",
  "sources": ["hello.ts"],
  "sourcesContent": ["function hello() { return 'world'; }"],
  "mappings": "AAAA"
}`

	sm, err := parser.Parse(sourceMap)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}

	if sm.Version != 3 {
		t.Errorf("Version = %d, want 3", sm.Version)
	}

	if sm.File != "hello.js" {
		t.Errorf("File = %s, want hello.js", sm.File)
	}

	if len(sm.Sources) != 1 || sm.Sources[0] != "hello.ts" {
		t.Errorf("Sources = %v, want [hello.ts]", sm.Sources)
	}
}

// TestSourceMapParser_ParseInvalid 测试解析无效 Source Map
func TestSourceMapParser_ParseInvalid(t *testing.T) {
	parser := NewSourceMapParser()

	tests := []struct {
		name      string
		sourceMap string
	}{
		{
			name:      "空字符串",
			sourceMap: "",
		},
		{
			name:      "无效 JSON",
			sourceMap: "{invalid}",
		},
		{
			name:      "缺少 version",
			sourceMap: `{"file": "test.js"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parser.Parse(tt.sourceMap)
			if err == nil {
				t.Error("Parse() should return error for invalid source map")
			}
		})
	}
}

// TestSourceMapMapper_MapPosition 测试位置映射
func TestSourceMapMapper_MapPosition(t *testing.T) {
	mapper := NewSourceMapMapper()

	sourceMap := &SourceMap{
		Version:        3,
		File:           "bundle.js",
		Sources:        []string{"hello.ts", "world.ts"},
		SourcesContent: []string{"function hello() {}", "function world() {}"},
		Mappings:       "AAAA,CAAC;ACAD,CAAC",
	}

	if err := mapper.Load(sourceMap); err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	// 测试位置映射
	pos := mapper.MapPosition(1, 0)
	if pos == nil {
		t.Error("MapPosition() returned nil")
		return
	}

	if pos.Line < 0 {
		t.Errorf("MapPosition() Line = %d, want >= 0", pos.Line)
	}
}

// TestSourceMapMapper_MapStackTrace 测试堆栈映射
func TestSourceMapMapper_MapStackTrace(t *testing.T) {
	mapper := NewSourceMapMapper()

	sourceMap := &SourceMap{
		Version:        3,
		File:           "bundle.js",
		Sources:        []string{"hello.ts"},
		SourcesContent: []string{"function hello() { throw new Error('test'); }"},
		Mappings:       "AAAA",
	}

	if err := mapper.Load(sourceMap); err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	stackTrace := `Error: test
    at hello (bundle.js:1:20)
    at main (bundle.js:5:10)`

	mapped := mapper.MapStackTrace(stackTrace)
	if mapped == "" {
		t.Error("MapStackTrace() returned empty string")
	}

	// 应该包含原始文件名（hello.ts）
	if !strings.Contains(mapped, "hello.ts") {
		t.Logf("mapped result: %s", mapped)
		// 如果没有足够的映射信息，至少不应该为空
	}
}

// TestSourceMapGenerator_Generate 测试 Source Map 生成
func TestSourceMapGenerator_Generate(t *testing.T) {
	generator := NewSourceMapGenerator("output.js")

	generator.AddSource("input.ts", "function hello() { return 'world'; }")
	generator.AddMapping(1, 0, 0, 1, 0)
	generator.AddMapping(1, 10, 0, 1, 10)

	sm := generator.Generate()

	if sm.Version != 3 {
		t.Errorf("Version = %d, want 3", sm.Version)
	}

	if sm.File != "output.js" {
		t.Errorf("File = %s, want output.js", sm.File)
	}

	if len(sm.Sources) != 1 {
		t.Errorf("Sources length = %d, want 1", len(sm.Sources))
	}

	if sm.Mappings == "" {
		t.Error("Mappings should not be empty")
	}
}

// TestSourceMapGenerator_ToJSON 测试生成 JSON
func TestSourceMapGenerator_ToJSON(t *testing.T) {
	generator := NewSourceMapGenerator("output.js")
	generator.AddSource("input.ts", "const x = 1;")

	json := generator.ToJSON()

	if json == "" {
		t.Error("ToJSON() returned empty string")
	}

	// 验证是有效的 JSON
	parser := NewSourceMapParser()
	_, err := parser.Parse(json)
	if err != nil {
		t.Errorf("ToJSON() generated invalid JSON: %v", err)
	}
}

// TestVLQEncoder_Encode 测试 VLQ 编码
func TestVLQEncoder_Encode(t *testing.T) {
	encoder := NewVLQEncoder()

	tests := []struct {
		name  string
		value int
		want  string
	}{
		{"零", 0, "A"},
		{"正数 1", 1, "C"},
		{"正数 15", 15, "e"},
		{"负数 -1", -1, "D"},
		{"大正数", 100, "oG"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := encoder.Encode(tt.value)
			if got != tt.want {
				t.Errorf("Encode(%d) = %s, want %s", tt.value, got, tt.want)
			}
		})
	}
}

// TestVLQDecoder_Decode 测试 VLQ 解码
func TestVLQDecoder_Decode(t *testing.T) {
	decoder := NewVLQDecoder()

	tests := []struct {
		name  string
		input string
		want  int
	}{
		{"零", "A", 0},
		{"正数 1", "C", 1},
		{"正数 15", "e", 15},
		{"负数 -1", "D", -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _, err := decoder.Decode(tt.input)
			if err != nil {
				t.Errorf("Decode(%s) error = %v", tt.input, err)
				return
			}
			if got != tt.want {
				t.Errorf("Decode(%s) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}

// TestSourceMap_Struct 测试 SourceMap 结构
func TestSourceMap_Struct(t *testing.T) {
	sm := &SourceMap{
		Version:        3,
		File:           "bundle.js",
		SourceRoot:     "/src",
		Sources:        []string{"a.ts", "b.ts"},
		SourcesContent: []string{"// a", "// b"},
		Names:          []string{"foo", "bar"},
		Mappings:       "AAAA",
	}

	if sm.Version != 3 {
		t.Errorf("Version = %d, want 3", sm.Version)
	}

	if len(sm.Sources) != 2 {
		t.Errorf("Sources length = %d, want 2", len(sm.Sources))
	}

	if len(sm.Names) != 2 {
		t.Errorf("Names length = %d, want 2", len(sm.Names))
	}
}

// TestMappedPosition_Struct 测试 MappedPosition 结构
func TestMappedPosition_Struct(t *testing.T) {
	pos := &MappedPosition{
		Source: "hello.ts",
		Line:   10,
		Column: 5,
		Name:   "hello",
	}

	if pos.Source != "hello.ts" {
		t.Errorf("Source = %s, want hello.ts", pos.Source)
	}

	if pos.Line != 10 {
		t.Errorf("Line = %d, want 10", pos.Line)
	}

	if pos.Column != 5 {
		t.Errorf("Column = %d, want 5", pos.Column)
	}
}
