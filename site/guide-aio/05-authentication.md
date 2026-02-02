# 身份验证

## Token 设计

```go
// Token 类型
const (
    TokenTypeAuth         = "auth"
    TokenTypeFile         = "file"
    TokenTypeVerification = "verification"
    TokenTypePasswordReset = "passwordReset"
)

// Token Secret = record.TokenKey() + collection.AuthToken.Secret
// 每个用户独立 TokenKey，修改密码后自动失效所有 Token
```

## 认证方式

### 密码认证

```javascript
const authData = await pb.collection('users').authWithPassword('email', 'password');
console.log(authData.token);
console.log(authData.record);
```

### OTP 认证

```javascript
// 请求 OTP
const result = await pb.collection('users').requestOTP('email');

// 验证 OTP
const authData = await pb.collection('users').authWithOTP(result.otpId, 'OTP_CODE');
```

### OAuth2 认证

```javascript
const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
```

### TOF 认证（腾讯内部）

TOF (Tencent Open Framework) 是腾讯内部的统一身份认证网关。

#### 服务端配置

```go
import "github.com/pocketbase/pocketbase/plugins/tofauth"

// 注册 TOF 插件
tofauth.MustRegister(app, tofauth.Config{
    SafeMode:       tofauth.Bool(true),  // 推荐生产环境启用
    CheckTimestamp: tofauth.Bool(true),  // 检查时间戳过期
})
```

环境变量配置：
- `TOF_APP_KEY` - 太湖应用 Key
- `TOF_APP_TOKEN` - 太湖应用 Token（必需）
- `TOF_DEV_MOCK_USER` - 开发模式模拟用户名（可选）

#### 客户端使用

```javascript
// TOF 认证（需要 TOF 网关传递的 headers）
const authData = await pb.collection('users').authWithTof({
    taiIdentity: 'x-tai-identity-value',
    timestamp: 'timestamp-value',
    signature: 'signature-value',
    seq: 'x-rio-seq-value',
});

console.log(authData.token);
console.log(authData.record);
console.log(authData.meta.tofIdentity); // TOF 身份信息
```

#### API 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/collections/{collection}/auth-with-tof` | GET | TOF 认证 |
| `/api/tof/logout?url={redirect_url}` | GET | TOF 登出 |
| `/api/tof/redirect?url={redirect_url}` | GET | TOF 重定向验证 |
| `/api/tof/status` | GET | TOF 配置状态（需超管权限） |

### MFA 二次验证

```javascript
try {
    await pb.collection('users').authWithPassword('email', 'password');
} catch (err) {
    const mfaId = err.response?.mfaId;
    if (mfaId) {
        const result = await pb.collection('users').requestOTP('email');
        await pb.collection('users').authWithOTP(result.otpId, 'CODE', { mfaId });
    }
}
```

## Go 端认证

```go
// 验证 Token
record, _ := app.FindAuthRecordByToken(token, core.TokenTypeAuth)

// 创建 Token
token, _ := record.NewAuthToken()

// 验证密码
if record.ValidatePassword(password) {
    // 密码正确
}

// 设置密码
record.SetPassword(newPassword)
app.Save(record)
```

## Auth Collection 特殊字段

| 字段 | 描述 |
|------|------|
| `email` | 邮箱地址 |
| `emailVisibility` | 邮箱是否可见 |
| `verified` | 是否已验证 |
| `password` | 密码（加密存储） |
| `tokenKey` | Token 密钥 |
