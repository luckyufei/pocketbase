package core

import (
	"context"
	"fmt"

	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/pocketbase/pocketbase/core/validators"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	Fields[FieldTypeVector] = func() Field {
		return &VectorField{}
	}
}

const FieldTypeVector = "vector"

// 向量索引类型常量
const (
	VectorIndexHNSW    = "hnsw"    // HNSW 索引 (推荐，更快的查询)
	VectorIndexIVFFlat = "ivfflat" // IVFFlat 索引 (更快的构建)
)

// 向量距离函数常量
const (
	VectorDistanceL2     = "l2"     // 欧几里得距离 (L2)
	VectorDistanceCosine = "cosine" // 余弦距离
	VectorDistanceIP     = "ip"     // 内积 (负内积)
)

// 最大向量维度限制
const MaxVectorDimension = 16000

var (
	_ Field = (*VectorField)(nil)
)

// VectorField 定义 "vector" 类型字段，用于存储向量嵌入。
type VectorField struct {
	Name         string `form:"name" json:"name"`
	Id           string `form:"id" json:"id"`
	System       bool   `form:"system" json:"system"`
	Hidden       bool   `form:"hidden" json:"hidden"`
	Presentable  bool   `form:"presentable" json:"presentable"`
	Dimension    int    `form:"dimension" json:"dimension"`
	Required     bool   `form:"required" json:"required"`
	IndexType    string `form:"indexType" json:"indexType"`
	DistanceFunc string `form:"distanceFunc" json:"distanceFunc"`
}

func (f *VectorField) Type() string                 { return FieldTypeVector }
func (f *VectorField) GetId() string                { return f.Id }
func (f *VectorField) SetId(id string)              { f.Id = id }
func (f *VectorField) GetName() string              { return f.Name }
func (f *VectorField) SetName(name string)          { f.Name = name }
func (f *VectorField) GetSystem() bool              { return f.System }
func (f *VectorField) SetSystem(system bool)        { f.System = system }
func (f *VectorField) GetHidden() bool              { return f.Hidden }
func (f *VectorField) SetHidden(hidden bool)        { f.Hidden = hidden }

func (f *VectorField) ColumnType(app App) string {
	return "JSON DEFAULT '[]' NOT NULL"
}

func (f *VectorField) ColumnTypePostgres() string {
	if f.Dimension > 0 {
		return fmt.Sprintf("vector(%d)", f.Dimension)
	}
	return "vector"
}

func (f *VectorField) PrepareValue(record *Record, raw any) (any, error) {
	vec := types.Vector{}
	err := vec.Scan(raw)
	return vec, err
}

func (f *VectorField) ValidateValue(ctx context.Context, app App, record *Record) error {
	val, ok := record.GetRaw(f.Name).(types.Vector)
	if !ok {
		return validators.ErrUnsupportedValueType
	}

	if val.IsZero() {
		if f.Required {
			return validation.ErrRequired
		}
		return nil
	}

	if f.Dimension > 0 && val.Dimension() != f.Dimension {
		return validation.NewError(
			"validation_vector_dimension_mismatch",
			"向量维度必须是 {{.dimension}}，实际是 {{.actual}}",
		).SetParams(map[string]any{"dimension": f.Dimension, "actual": val.Dimension()})
	}

	return nil
}

func (f *VectorField) ValidateSettings(ctx context.Context, app App, collection *Collection) error {
	return validation.ValidateStruct(f,
		validation.Field(&f.Id, validation.By(DefaultFieldIdValidationRule)),
		validation.Field(&f.Name, validation.By(DefaultFieldNameValidationRule)),
		validation.Field(&f.Dimension, validation.Min(0), validation.Max(MaxVectorDimension)),
		validation.Field(&f.IndexType, validation.In("", VectorIndexHNSW, VectorIndexIVFFlat)),
		validation.Field(&f.DistanceFunc, validation.In("", VectorDistanceL2, VectorDistanceCosine, VectorDistanceIP)),
	)
}

// CreateVectorExtensionSQL 返回创建 pgvector 扩展的 SQL。
func CreateVectorExtensionSQL() string {
	return "CREATE EXTENSION IF NOT EXISTS vector"
}

// CreateIndexSQL 返回创建向量索引的 SQL。
func (f *VectorField) CreateIndexSQL(tableName string) string {
	if f.IndexType == "" {
		return ""
	}

	indexName := fmt.Sprintf("idx_%s_%s_%s", tableName, f.Name, f.IndexType)
	opsClass := f.getOpsClass()

	switch f.IndexType {
	case VectorIndexHNSW:
		return fmt.Sprintf(
			"CREATE INDEX IF NOT EXISTS %s ON %s USING hnsw (%s %s)",
			indexName, tableName, f.Name, opsClass,
		)
	case VectorIndexIVFFlat:
		return fmt.Sprintf(
			"CREATE INDEX IF NOT EXISTS %s ON %s USING ivfflat (%s %s) WITH (lists = 100)",
			indexName, tableName, f.Name, opsClass,
		)
	default:
		return ""
	}
}

func (f *VectorField) DropIndexSQL(tableName string) string {
	if f.IndexType == "" {
		return ""
	}
	indexName := fmt.Sprintf("idx_%s_%s_%s", tableName, f.Name, f.IndexType)
	return fmt.Sprintf("DROP INDEX IF EXISTS %s", indexName)
}

func (f *VectorField) getOpsClass() string {
	switch f.DistanceFunc {
	case VectorDistanceCosine:
		return "vector_cosine_ops"
	case VectorDistanceIP:
		return "vector_ip_ops"
	default:
		return "vector_l2_ops"
	}
}

// VectorDistanceExpr 生成向量距离表达式。
func VectorDistanceExpr(column string, queryVector types.Vector, distanceFunc string) string {
	vecStr := queryVector.ToPgVector()
	switch distanceFunc {
	case VectorDistanceCosine:
		return fmt.Sprintf("%s <=> '%s'", column, vecStr)
	case VectorDistanceIP:
		return fmt.Sprintf("%s <#> '%s'", column, vecStr)
	default:
		return fmt.Sprintf("%s <-> '%s'", column, vecStr)
	}
}
