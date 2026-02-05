package core

import (
	"context"
	"database/sql/driver"

	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/spf13/cast"
)

func init() {
	Fields[FieldTypeSecret] = func() Field {
		return &SecretField{}
	}
}

// FieldTypeSecret 表示 secret 类型字段
const FieldTypeSecret = "secret"

// SecretFieldDefaultMaxSize 默认最大值大小（4KB）
const SecretFieldDefaultMaxSize = 4096

var (
	_ Field             = (*SecretField)(nil)
	_ GetterFinder      = (*SecretField)(nil)
	_ SetterFinder      = (*SecretField)(nil)
	_ DriverValuer      = (*SecretField)(nil)
	_ RecordInterceptor = (*SecretField)(nil)
)

// SecretField 定义 "secret" 类型字段，用于存储 AES-256-GCM 加密的敏感数据
// （如 API Keys、Access Tokens 等）
//
// 与 PasswordField 不同，SecretField 使用可逆加密，可以读回明文。
//
// 使用示例:
//
//	// 设置 secret 值（自动加密）
//	record.Set("api_key", "sk-xxx")
//
//	// 获取解密后的值
//	apiKey := record.GetString("api_key")  // "sk-xxx"
//
//	// 获取原始 SecretFieldValue 结构体
//	raw := record.GetRaw("api_key").(*SecretFieldValue)
type SecretField struct {
	// Name (required) 是字段的唯一名称
	Name string `form:"name" json:"name"`

	// Id 是字段的唯一稳定标识符
	// 添加到 Collection FieldsList 时会自动从 name 生成
	Id string `form:"id" json:"id"`

	// System 表示是否为系统字段，系统字段不能被重命名或删除
	System bool `form:"system" json:"system"`

	// Hidden 表示是否在 API 响应中隐藏该字段（默认 true）
	Hidden bool `form:"hidden" json:"hidden"`

	// Presentable 提示 Dashboard UI 在关联预览标签中显示该字段值
	Presentable bool `form:"presentable" json:"presentable"`

	// Required 表示该字段是否必填
	Required bool `form:"required" json:"required"`

	// MaxSize 指定明文最大大小（字节），默认 4KB
	// 如果为 0，则使用 SecretFieldDefaultMaxSize
	MaxSize int `form:"maxSize" json:"maxSize"`
}

// SecretFieldValue 存储 secret 字段的加解密状态
type SecretFieldValue struct {
	// Plain 明文值（设置时使用）
	Plain string

	// Encrypted 密文值（数据库存储/读取后）
	Encrypted string

	// LastError 加解密过程中的错误
	LastError error
}

// Type 实现 [Field.Type] 接口方法
func (f *SecretField) Type() string {
	return FieldTypeSecret
}

// GetId 实现 [Field.GetId] 接口方法
func (f *SecretField) GetId() string {
	return f.Id
}

// SetId 实现 [Field.SetId] 接口方法
func (f *SecretField) SetId(id string) {
	f.Id = id
}

// GetName 实现 [Field.GetName] 接口方法
func (f *SecretField) GetName() string {
	return f.Name
}

// SetName 实现 [Field.SetName] 接口方法
func (f *SecretField) SetName(name string) {
	f.Name = name
}

// GetSystem 实现 [Field.GetSystem] 接口方法
func (f *SecretField) GetSystem() bool {
	return f.System
}

// SetSystem 实现 [Field.SetSystem] 接口方法
func (f *SecretField) SetSystem(system bool) {
	f.System = system
}

// GetHidden 实现 [Field.GetHidden] 接口方法
func (f *SecretField) GetHidden() bool {
	return f.Hidden
}

// SetHidden 实现 [Field.SetHidden] 接口方法
func (f *SecretField) SetHidden(hidden bool) {
	f.Hidden = hidden
}

// ColumnType 实现 [Field.ColumnType] 接口方法
func (f *SecretField) ColumnType(app App) string {
	return "TEXT DEFAULT '' NOT NULL"
}

// PrepareValue 实现 [Field.PrepareValue] 接口方法
// 从数据库读取时将密文包装为 SecretFieldValue
func (f *SecretField) PrepareValue(record *Record, raw any) (any, error) {
	encrypted := cast.ToString(raw)
	return &SecretFieldValue{
		Encrypted: encrypted,
	}, nil
}

// DriverValue 实现 [DriverValuer] 接口
// 返回加密后的密文字符串用于数据库存储
func (f *SecretField) DriverValue(record *Record) (driver.Value, error) {
	sv := f.getSecretValue(record)
	if sv.LastError != nil {
		return nil, sv.LastError
	}
	return sv.Encrypted, nil
}

// ValidateValue 实现 [Field.ValidateValue] 接口方法
func (f *SecretField) ValidateValue(ctx context.Context, app App, record *Record) error {
	sv := f.getSecretValue(record)

	// 检查加密错误
	if sv.LastError != nil {
		return sv.LastError
	}

	// 检查 Required 约束
	if f.Required {
		if sv.Plain == "" && sv.Encrypted == "" {
			return validation.ErrRequired
		}
	}

	// 检查大小限制（只检查明文，因为密文大小由明文决定）
	maxSize := f.MaxSize
	if maxSize <= 0 {
		maxSize = SecretFieldDefaultMaxSize
	}
	if len(sv.Plain) > maxSize {
		return validation.NewError("validation_max_size", "Value exceeds maximum size limit")
	}

	return nil
}

// ValidateSettings 实现 [Field.ValidateSettings] 接口方法
func (f *SecretField) ValidateSettings(ctx context.Context, app App, collection *Collection) error {
	// 先验证基本字段设置
	if err := validation.ValidateStruct(f,
		validation.Field(&f.Id, validation.By(DefaultFieldIdValidationRule)),
		validation.Field(&f.Name, validation.By(DefaultFieldNameValidationRule)),
		validation.Field(&f.MaxSize,
			validation.Min(0),
			validation.Max(SecretFieldDefaultMaxSize),
		),
	); err != nil {
		return err
	}

	// 检查 CryptoProvider 是否启用（需要 PB_MASTER_KEY）
	if !app.Crypto().IsEnabled() {
		return validation.NewError("validation_crypto_disabled",
			"Secret field requires PB_MASTER_KEY to be configured")
	}

	return nil
}

// Intercept 实现 [RecordInterceptor] 接口
// 在创建/更新之前进行加密，在成功后清除明文
func (f *SecretField) Intercept(
	ctx context.Context,
	app App,
	record *Record,
	actionName string,
	actionFunc func() error,
) error {
	switch actionName {
	case InterceptorActionCreateExecute, InterceptorActionUpdateExecute:
		// 在执行数据库操作之前加密
		sv := f.getSecretValue(record)
		if sv.Plain != "" && sv.Encrypted == "" {
			// 需要加密 - 使用 CryptoProvider (Layer 1)
			crypto := app.Crypto()
			if !crypto.IsEnabled() {
				sv.LastError = ErrCryptoNotEnabled
				return ErrCryptoNotEnabled
			}
			encrypted, err := crypto.Encrypt(sv.Plain)
			if err != nil {
				sv.LastError = err
				return err
			}
			sv.Encrypted = encrypted
		}
	case InterceptorActionAfterCreate, InterceptorActionAfterUpdate:
		// 成功后清除明文
		sv := f.getSecretValue(record)
		sv.Plain = ""
	}

	return actionFunc()
}

// FindGetter 实现 [GetterFinder] 接口
// 返回解密后的明文值
func (f *SecretField) FindGetter(key string) GetterFunc {
	if key != f.Name {
		return nil
	}

	return func(record *Record) any {
		sv := f.getSecretValue(record)

		// 如果有明文，直接返回（刚设置还未保存的情况）
		if sv.Plain != "" {
			return sv.Plain
		}

		// 如果有密文，尝试解密 - 使用全局 CryptoProvider (Layer 1)
		if sv.Encrypted != "" {
			crypto := GetGlobalCrypto()
			if crypto.IsEnabled() {
				plain, err := crypto.Decrypt(sv.Encrypted)
				if err == nil {
					return plain
				}
				// 解密失败（可能是 key 变更），返回空字符串
			}
		}

		return ""
	}
}

// FindSetter 实现 [SetterFinder] 接口
// 设置明文值，加密将在 Intercept 中完成
func (f *SecretField) FindSetter(key string) SetterFunc {
	if key != f.Name {
		return nil
	}

	return func(record *Record, raw any) {
		plain := cast.ToString(raw)
		sv := &SecretFieldValue{Plain: plain}
		// 不在这里加密，加密将在 Intercept 中完成
		record.SetRaw(f.Name, sv)
	}
}

// getSecretValue 从 record 获取 SecretFieldValue
func (f *SecretField) getSecretValue(record *Record) *SecretFieldValue {
	raw := record.GetRaw(f.Name)

	if sv, ok := raw.(*SecretFieldValue); ok {
		return sv
	}

	return &SecretFieldValue{}
}
