// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase/tools/security"
)

// UtilService 工具服务
type UtilService struct{}

// NewUtilService 创建工具服务
func NewUtilService() *UtilService {
	return &UtilService{}
}

// UUID 生成 UUID v7
func (us *UtilService) UUID() string {
	// UUID v7 格式: 时间戳 + 随机数
	// 格式: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
	now := time.Now().UnixMilli()

	// 前 48 位是时间戳
	uuid := make([]byte, 16)
	uuid[0] = byte(now >> 40)
	uuid[1] = byte(now >> 32)
	uuid[2] = byte(now >> 24)
	uuid[3] = byte(now >> 16)
	uuid[4] = byte(now >> 8)
	uuid[5] = byte(now)

	// 随机填充剩余部分
	random := security.RandomString(20)
	for i := 6; i < 16; i++ {
		uuid[i] = random[i-6]
	}

	// 设置版本 (7) 和变体
	uuid[6] = (uuid[6] & 0x0f) | 0x70 // 版本 7
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // 变体

	return fmt.Sprintf("%x-%x-%x-%x-%x",
		uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16])
}

// Hash 计算 SHA256 哈希
func (us *UtilService) Hash(input string) string {
	hash := sha256.Sum256([]byte(input))
	return hex.EncodeToString(hash[:])
}

// RandomString 生成随机字符串
func (us *UtilService) RandomString(length int) string {
	if length <= 0 {
		return ""
	}
	return security.RandomString(length)
}

// Base64Encode Base64 编码
func (us *UtilService) Base64Encode(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// Base64Decode Base64 解码
func (us *UtilService) Base64Decode(encoded string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(encoded)
}

// JSONStringify JSON 序列化
func (us *UtilService) JSONStringify(data interface{}) (string, error) {
	bytes, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// JSONParse JSON 解析
func (us *UtilService) JSONParse(jsonStr string) (interface{}, error) {
	var result interface{}
	err := json.Unmarshal([]byte(jsonStr), &result)
	return result, err
}

// HostFunctions 工具方法扩展

var utilService = NewUtilService()

// UtilUUID 生成 UUID
func (hf *HostFunctions) UtilUUID() string {
	return utilService.UUID()
}

// UtilHash 计算哈希
func (hf *HostFunctions) UtilHash(input string) string {
	return utilService.Hash(input)
}

// UtilRandomString 生成随机字符串
func (hf *HostFunctions) UtilRandomString(length int) string {
	return utilService.RandomString(length)
}

// T089: 复用 plugins/jsvm/ 已有的 Go bindings

// MD5 计算 MD5 哈希
func (us *UtilService) MD5(input string) string {
	hash := md5.Sum([]byte(input))
	return hex.EncodeToString(hash[:])
}

// SHA256 计算 SHA256 哈希（别名方法）
func (us *UtilService) SHA256(input string) string {
	hash := sha256.Sum256([]byte(input))
	return hex.EncodeToString(hash[:])
}

// SHA512 计算 SHA512 哈希
func (us *UtilService) SHA512(input string) string {
	hash := sha512.Sum512([]byte(input))
	return hex.EncodeToString(hash[:])
}

// HS256 计算 HMAC-SHA256
func (us *UtilService) HS256(data, key string) string {
	h := hmac.New(sha256.New, []byte(key))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// HS512 计算 HMAC-SHA512
func (us *UtilService) HS512(data, key string) string {
	h := hmac.New(sha512.New, []byte(key))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// Equal 安全比较两个字符串（防止时序攻击）
func (us *UtilService) Equal(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// RandomStringWithAlphabet 使用自定义字符集生成随机字符串
func (us *UtilService) RandomStringWithAlphabet(length int, alphabet string) string {
	if length <= 0 || len(alphabet) == 0 {
		return ""
	}
	return security.RandomStringWithAlphabet(length, alphabet)
}

// PseudorandomString 生成伪随机字符串（更快但安全性较低）
func (us *UtilService) PseudorandomString(length int) string {
	if length <= 0 {
		return ""
	}
	return security.PseudorandomString(length)
}

// PseudorandomStringWithAlphabet 使用自定义字符集生成伪随机字符串
func (us *UtilService) PseudorandomStringWithAlphabet(length int, alphabet string) string {
	if length <= 0 || len(alphabet) == 0 {
		return ""
	}
	return security.PseudorandomStringWithAlphabet(length, alphabet)
}

// RandomStringByRegex 根据正则表达式生成随机字符串
func (us *UtilService) RandomStringByRegex(pattern string) (string, error) {
	return security.RandomStringByRegex(pattern)
}

// Encrypt AES-GCM 加密
func (us *UtilService) Encrypt(data []byte, key string) (string, error) {
	result, err := security.Encrypt(data, key)
	if err != nil {
		return "", err
	}
	return result, nil
}

// Decrypt AES-GCM 解密
func (us *UtilService) Decrypt(ciphertext, key string) ([]byte, error) {
	return security.Decrypt(ciphertext, key)
}

// CreateJWT 创建 JWT token
func (us *UtilService) CreateJWT(payload map[string]interface{}, secret string, expiresIn int64) (string, error) {
	return security.NewJWT(payload, secret, time.Duration(expiresIn)*time.Second)
}

// ParseJWT 解析并验证 JWT token
func (us *UtilService) ParseJWT(token, secret string) (map[string]interface{}, error) {
	claims, err := security.ParseJWT(token, secret)
	if err != nil {
		return nil, err
	}
	return claims, nil
}

// ParseUnverifiedJWT 解析 JWT token（不验证签名）
func (us *UtilService) ParseUnverifiedJWT(token string) (map[string]interface{}, error) {
	return security.ParseUnverifiedJWT(token)
}
