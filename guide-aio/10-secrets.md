# Secrets Manager

## 概述

AES-256-GCM 加密的密钥管理，支持多环境配置。

## 启用方式

```bash
# 设置 32 字节 Master Key
export PB_MASTER_KEY="your-32-byte-master-key-here!!"
```

## 接口定义

```go
type SecretsStore interface {
    Set(key, value string, opts ...SecretOption) error
    Get(key string) (string, error)
    GetWithDefault(key, defaultValue string) string
    GetForEnv(key, env string) (string, error)  // 带 fallback 到 global
    Delete(key string) error
    Exists(key string) (bool, error)
    List() ([]SecretInfo, error)
    IsEnabled() bool
}

// 选项
func WithEnv(env string) SecretOption
func WithDescription(desc string) SecretOption

// 常量
const (
    SecretMaxKeyLength   = 256
    SecretMaxValueSize   = 4 * 1024  // 4KB
    SecretDefaultEnv     = "global"
)
```

## 使用示例

```go
secrets := app.Secrets()

if secrets.IsEnabled() {
    // 设置
    secrets.Set("OPENAI_API_KEY", "sk-xxx", 
        WithEnv("production"),
        WithDescription("OpenAI API Key"))
    
    // 获取
    apiKey, _ := secrets.Get("OPENAI_API_KEY")
    
    // 带默认值
    key := secrets.GetWithDefault("MISSING_KEY", "default-value")
    
    // 按环境获取（带 fallback）
    key, _ := secrets.GetForEnv("API_KEY", "production")
    
    // 列出所有
    list, _ := secrets.List()
    for _, info := range list {
        fmt.Println(info.Key, info.Env, info.Description)
    }
}
```

## API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/secrets` | 列出所有（掩码显示） |
| POST | `/api/secrets` | 创建 |
| GET | `/api/secrets/{key}` | 获取（解密值） |
| PUT | `/api/secrets/{key}` | 更新 |
| DELETE | `/api/secrets/{key}` | 删除 |

## 多环境配置

```go
// 设置不同环境的密钥
secrets.Set("DB_PASSWORD", "dev-pass", WithEnv("development"))
secrets.Set("DB_PASSWORD", "prod-pass", WithEnv("production"))
secrets.Set("DB_PASSWORD", "default-pass")  // global

// 获取时自动 fallback
// 如果 production 不存在，会 fallback 到 global
pass, _ := secrets.GetForEnv("DB_PASSWORD", "production")
```
