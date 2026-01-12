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
