// Package loader 提供 Serverless 函数加载功能
package loader

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// SourceMap 表示 Source Map 数据结构
type SourceMap struct {
	// Version Source Map 版本（必须为 3）
	Version int `json:"version"`

	// File 生成的文件名
	File string `json:"file,omitempty"`

	// SourceRoot 源文件根路径
	SourceRoot string `json:"sourceRoot,omitempty"`

	// Sources 源文件列表
	Sources []string `json:"sources"`

	// SourcesContent 源文件内容
	SourcesContent []string `json:"sourcesContent,omitempty"`

	// Names 符号名称列表
	Names []string `json:"names,omitempty"`

	// Mappings VLQ 编码的映射数据
	Mappings string `json:"mappings"`
}

// MappedPosition 表示映射后的位置
type MappedPosition struct {
	// Source 源文件名
	Source string

	// Line 行号（0-indexed）
	Line int

	// Column 列号（0-indexed）
	Column int

	// Name 符号名称
	Name string
}

// SourceMapParser 是 Source Map 解析器
type SourceMapParser struct{}

// NewSourceMapParser 创建新的 Source Map 解析器
func NewSourceMapParser() *SourceMapParser {
	return &SourceMapParser{}
}

// Parse 解析 Source Map JSON
func (p *SourceMapParser) Parse(data string) (*SourceMap, error) {
	if data == "" {
		return nil, errors.New("空的 Source Map 数据")
	}

	var sm SourceMap
	if err := json.Unmarshal([]byte(data), &sm); err != nil {
		return nil, fmt.Errorf("解析 Source Map 失败: %w", err)
	}

	if sm.Version != 3 {
		return nil, fmt.Errorf("不支持的 Source Map 版本: %d", sm.Version)
	}

	return &sm, nil
}

// SourceMapMapper 是位置映射器
type SourceMapMapper struct {
	sourceMap *SourceMap
	segments  [][]mappingSegment
}

type mappingSegment struct {
	generatedColumn int
	sourceIndex     int
	sourceLine      int
	sourceColumn    int
	nameIndex       int
	hasName         bool
}

// NewSourceMapMapper 创建新的位置映射器
func NewSourceMapMapper() *SourceMapMapper {
	return &SourceMapMapper{}
}

// Load 加载 Source Map
func (m *SourceMapMapper) Load(sm *SourceMap) error {
	m.sourceMap = sm
	m.segments = m.parseMappings(sm.Mappings)
	return nil
}

// parseMappings 解析 VLQ 编码的映射
func (m *SourceMapMapper) parseMappings(mappings string) [][]mappingSegment {
	lines := strings.Split(mappings, ";")
	result := make([][]mappingSegment, len(lines))

	decoder := NewVLQDecoder()

	// 状态变量（跨段累积）
	sourceIndex := 0
	sourceLine := 0
	sourceColumn := 0
	nameIndex := 0

	for lineIdx, line := range lines {
		if line == "" {
			result[lineIdx] = []mappingSegment{}
			continue
		}

		segments := strings.Split(line, ",")
		lineSegments := make([]mappingSegment, 0, len(segments))
		generatedColumn := 0

		for _, seg := range segments {
			if seg == "" {
				continue
			}

			values := make([]int, 0, 5)
			remaining := seg

			for remaining != "" {
				val, consumed, err := decoder.Decode(remaining)
				if err != nil {
					break
				}
				values = append(values, val)
				remaining = remaining[consumed:]
			}

			if len(values) == 0 {
				continue
			}

			segment := mappingSegment{}

			// 第一个值：生成的列号（相对于上一个段）
			generatedColumn += values[0]
			segment.generatedColumn = generatedColumn

			if len(values) >= 4 {
				// 第二个值：源文件索引
				sourceIndex += values[1]
				segment.sourceIndex = sourceIndex

				// 第三个值：源文件行号
				sourceLine += values[2]
				segment.sourceLine = sourceLine

				// 第四个值：源文件列号
				sourceColumn += values[3]
				segment.sourceColumn = sourceColumn
			}

			if len(values) >= 5 {
				// 第五个值：名称索引
				nameIndex += values[4]
				segment.nameIndex = nameIndex
				segment.hasName = true
			}

			lineSegments = append(lineSegments, segment)
		}

		result[lineIdx] = lineSegments
	}

	return result
}

// MapPosition 映射位置
func (m *SourceMapMapper) MapPosition(line, column int) *MappedPosition {
	if m.sourceMap == nil || len(m.segments) == 0 {
		return nil
	}

	// 调整为 0-indexed
	lineIdx := line - 1
	if lineIdx < 0 || lineIdx >= len(m.segments) {
		return nil
	}

	lineSegments := m.segments[lineIdx]
	if len(lineSegments) == 0 {
		return nil
	}

	// 找到最近的段
	var bestSegment *mappingSegment
	for i := range lineSegments {
		seg := &lineSegments[i]
		if seg.generatedColumn <= column {
			bestSegment = seg
		} else {
			break
		}
	}

	if bestSegment == nil {
		bestSegment = &lineSegments[0]
	}

	pos := &MappedPosition{
		Line:   bestSegment.sourceLine,
		Column: bestSegment.sourceColumn,
	}

	if bestSegment.sourceIndex >= 0 && bestSegment.sourceIndex < len(m.sourceMap.Sources) {
		pos.Source = m.sourceMap.Sources[bestSegment.sourceIndex]
	}

	if bestSegment.hasName && bestSegment.nameIndex >= 0 && bestSegment.nameIndex < len(m.sourceMap.Names) {
		pos.Name = m.sourceMap.Names[bestSegment.nameIndex]
	}

	return pos
}

// MapStackTrace 映射错误堆栈
func (m *SourceMapMapper) MapStackTrace(stackTrace string) string {
	// 匹配堆栈行：at functionName (file:line:column)
	re := regexp.MustCompile(`at\s+(\S+)\s+\(([^:]+):(\d+):(\d+)\)`)

	return re.ReplaceAllStringFunc(stackTrace, func(match string) string {
		matches := re.FindStringSubmatch(match)
		if len(matches) < 5 {
			return match
		}

		funcName := matches[1]
		// file := matches[2]
		var line, column int
		fmt.Sscanf(matches[3], "%d", &line)
		fmt.Sscanf(matches[4], "%d", &column)

		pos := m.MapPosition(line, column)
		if pos == nil {
			return match
		}

		name := funcName
		if pos.Name != "" {
			name = pos.Name
		}

		return fmt.Sprintf("at %s (%s:%d:%d)", name, pos.Source, pos.Line+1, pos.Column+1)
	})
}

// SourceMapGenerator 是 Source Map 生成器
type SourceMapGenerator struct {
	file           string
	sources        []string
	sourcesContent []string
	names          []string
	mappings       []mapping
}

type mapping struct {
	generatedLine   int
	generatedColumn int
	sourceIndex     int
	sourceLine      int
	sourceColumn    int
	nameIndex       int
	hasName         bool
}

// NewSourceMapGenerator 创建新的 Source Map 生成器
func NewSourceMapGenerator(file string) *SourceMapGenerator {
	return &SourceMapGenerator{
		file:           file,
		sources:        []string{},
		sourcesContent: []string{},
		names:          []string{},
		mappings:       []mapping{},
	}
}

// AddSource 添加源文件
func (g *SourceMapGenerator) AddSource(name, content string) int {
	g.sources = append(g.sources, name)
	g.sourcesContent = append(g.sourcesContent, content)
	return len(g.sources) - 1
}

// AddName 添加名称
func (g *SourceMapGenerator) AddName(name string) int {
	g.names = append(g.names, name)
	return len(g.names) - 1
}

// AddMapping 添加映射
func (g *SourceMapGenerator) AddMapping(generatedLine, generatedColumn, sourceIndex, sourceLine, sourceColumn int) {
	g.mappings = append(g.mappings, mapping{
		generatedLine:   generatedLine,
		generatedColumn: generatedColumn,
		sourceIndex:     sourceIndex,
		sourceLine:      sourceLine,
		sourceColumn:    sourceColumn,
	})
}

// AddMappingWithName 添加带名称的映射
func (g *SourceMapGenerator) AddMappingWithName(generatedLine, generatedColumn, sourceIndex, sourceLine, sourceColumn, nameIndex int) {
	g.mappings = append(g.mappings, mapping{
		generatedLine:   generatedLine,
		generatedColumn: generatedColumn,
		sourceIndex:     sourceIndex,
		sourceLine:      sourceLine,
		sourceColumn:    sourceColumn,
		nameIndex:       nameIndex,
		hasName:         true,
	})
}

// Generate 生成 Source Map
func (g *SourceMapGenerator) Generate() *SourceMap {
	return &SourceMap{
		Version:        3,
		File:           g.file,
		Sources:        g.sources,
		SourcesContent: g.sourcesContent,
		Names:          g.names,
		Mappings:       g.encodeMappings(),
	}
}

// encodeMappings 编码映射为 VLQ 字符串
func (g *SourceMapGenerator) encodeMappings() string {
	if len(g.mappings) == 0 {
		return ""
	}

	encoder := NewVLQEncoder()

	// 按行分组
	lineGroups := make(map[int][]mapping)
	maxLine := 0
	for _, m := range g.mappings {
		lineGroups[m.generatedLine] = append(lineGroups[m.generatedLine], m)
		if m.generatedLine > maxLine {
			maxLine = m.generatedLine
		}
	}

	var result []string

	// 状态变量
	prevSourceIndex := 0
	prevSourceLine := 0
	prevSourceColumn := 0
	prevNameIndex := 0

	for line := 1; line <= maxLine; line++ {
		mappings := lineGroups[line]
		if len(mappings) == 0 {
			result = append(result, "")
			continue
		}

		var segments []string
		prevGeneratedColumn := 0

		for _, m := range mappings {
			var segment string

			// 生成列（相对）
			segment += encoder.Encode(m.generatedColumn - prevGeneratedColumn)
			prevGeneratedColumn = m.generatedColumn

			// 源文件索引（相对）
			segment += encoder.Encode(m.sourceIndex - prevSourceIndex)
			prevSourceIndex = m.sourceIndex

			// 源行（相对）
			segment += encoder.Encode(m.sourceLine - prevSourceLine)
			prevSourceLine = m.sourceLine

			// 源列（相对）
			segment += encoder.Encode(m.sourceColumn - prevSourceColumn)
			prevSourceColumn = m.sourceColumn

			// 名称索引（可选）
			if m.hasName {
				segment += encoder.Encode(m.nameIndex - prevNameIndex)
				prevNameIndex = m.nameIndex
			}

			segments = append(segments, segment)
		}

		result = append(result, strings.Join(segments, ","))
	}

	return strings.Join(result, ";")
}

// ToJSON 生成 JSON 字符串
func (g *SourceMapGenerator) ToJSON() string {
	sm := g.Generate()
	data, _ := json.MarshalIndent(sm, "", "  ")
	return string(data)
}

// VLQEncoder 是 VLQ 编码器
type VLQEncoder struct{}

// Base64 字符集
const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

// NewVLQEncoder 创建新的 VLQ 编码器
func NewVLQEncoder() *VLQEncoder {
	return &VLQEncoder{}
}

// Encode 编码整数为 VLQ
func (e *VLQEncoder) Encode(value int) string {
	// 处理符号
	var vlq int
	if value < 0 {
		vlq = ((-value) << 1) | 1
	} else {
		vlq = value << 1
	}

	var result string

	for {
		digit := vlq & 0x1F // 取低 5 位
		vlq >>= 5

		if vlq > 0 {
			digit |= 0x20 // 设置继续位
		}

		result += string(base64Chars[digit])

		if vlq == 0 {
			break
		}
	}

	return result
}

// VLQDecoder 是 VLQ 解码器
type VLQDecoder struct {
	charToValue map[byte]int
}

// NewVLQDecoder 创建新的 VLQ 解码器
func NewVLQDecoder() *VLQDecoder {
	charToValue := make(map[byte]int)
	for i, c := range base64Chars {
		charToValue[byte(c)] = i
	}
	return &VLQDecoder{charToValue: charToValue}
}

// Decode 解码 VLQ 字符串，返回值和消耗的字符数
func (d *VLQDecoder) Decode(input string) (int, int, error) {
	if input == "" {
		return 0, 0, errors.New("空输入")
	}

	var result int
	shift := 0
	consumed := 0

	for i := 0; i < len(input); i++ {
		value, ok := d.charToValue[input[i]]
		if !ok {
			return 0, 0, fmt.Errorf("无效的 Base64 字符: %c", input[i])
		}

		consumed++

		// 取低 5 位
		digit := value & 0x1F
		result |= digit << shift
		shift += 5

		// 检查继续位
		if (value & 0x20) == 0 {
			break
		}
	}

	// 处理符号
	if result&1 == 1 {
		result = -(result >> 1)
	} else {
		result = result >> 1
	}

	return result, consumed, nil
}
