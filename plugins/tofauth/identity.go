package tofauth

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3"
)

// Identity 表示 TOF 身份信息
type Identity struct {
	LoginName  string  `json:"loginname"`
	StaffId    int     `json:"staffid"`
	Expiration string  `json:"expiration"`
	Ticket     *string `json:"ticket"`
}

// GetTofIdentity 验证 TOF 身份并返回身份信息
// 参数:
//   - token: 太湖应用 Token
//   - taiId: x-tai-identity header 值（JWE 加密的身份信息）
//   - timestamp: 时间戳
//   - signature: 网关签名
//   - seq: x-rio-seq header 值
//   - safeMode: 是否启用安全模式
//   - checkTimestamp: 是否检查时间戳过期
//
// 返回身份信息或错误
func GetTofIdentity(token, taiId, timestamp, signature, seq string, safeMode, checkTimestamp bool) (Identity, error) {
	key := []byte(token)

	headers := map[string]string{
		"x-tai-identity": taiId,
		"timestamp":      timestamp,
		"signature":      signature,
		"x-rio-seq":      seq,
		// 兼容模式下响应头会带上 staffid、staffname，验签时需传入
		"staffid":    "",
		"staffname":  "",
		"x-ext-data": "",
	}

	// 校验网关签名
	if ok, err := checkSignature(token, headers, safeMode, checkTimestamp); !ok {
		return Identity{}, err
	}

	// 获取身份信息
	identity, err := getIdentity(key, headers, safeMode)
	if err != nil {
		return Identity{}, err
	}

	return identity, nil
}

// GetTofIdentityFromHeaders 从 HTTP headers 中获取 TOF 身份信息
// 这是一个便捷方法，用于从请求 headers 中提取所需参数并验证身份
func GetTofIdentityFromHeaders(token string, headers map[string]string, safeMode, checkTimestamp bool) (Identity, error) {
	return GetTofIdentity(
		token,
		headers["x-tai-identity"],
		headers["timestamp"],
		headers["signature"],
		headers["x-rio-seq"],
		safeMode,
		checkTimestamp,
	)
}

// SignatureMismatchError 签名不匹配错误，包含调试信息
type SignatureMismatchError struct {
	ReceivedSignature string
	ExpectedSignature string
	TimestampStr      string
	SafeMode          bool
	ExtHeaders        []string
}

func (e *SignatureMismatchError) Error() string {
	return fmt.Sprintf("invalid signature: received=%s, expected=%s, timestamp=%s, safeMode=%v, extHeaders=%v",
		e.ReceivedSignature, e.ExpectedSignature, e.TimestampStr, e.SafeMode, e.ExtHeaders)
}

// checkSignature 校验网关签名
func checkSignature(key string, headers map[string]string, safeMode, checkTimestamp bool) (bool, error) {
	timestampStr := headers["timestamp"]
	signature := headers["signature"]

	var extHeaders []string
	if safeMode {
		extHeaders = []string{headers["x-rio-seq"], "", "", ""}
	} else {
		extHeaders = []string{headers["x-rio-seq"], headers["staffid"], headers["staffname"], headers["x-ext-data"]}
	}

	timestamp, err := strconv.Atoi(timestampStr)
	if err != nil {
		return false, fmt.Errorf("invalid timestamp: %v", err)
	}

	// 检查时间戳是否过期（180秒）
	if checkTimestamp && time.Now().Unix()-int64(timestamp) > 180 {
		return false, fmt.Errorf("timestamp expired: timestamp=%d, now=%d, diff=%d seconds",
			timestamp, time.Now().Unix(), time.Now().Unix()-int64(timestamp))
	}

	// 计算签名
	str := fmt.Sprintf("%s%s%s%s", timestampStr, key, strings.Join(extHeaders, ","), timestampStr)
	localSignature := fmt.Sprintf("%x", sha256.Sum256([]byte(str)))

	if !strings.EqualFold(signature, localSignature) {
		return false, &SignatureMismatchError{
			ReceivedSignature: signature,
			ExpectedSignature: localSignature,
			TimestampStr:      timestampStr,
			SafeMode:          safeMode,
			ExtHeaders:        extHeaders,
		}
	}

	return true, nil
}

// getIdentity 获取身份信息
func getIdentity(key []byte, headers map[string]string, safeMode bool) (Identity, error) {
	// 尝试从 JWE 加密的身份信息中获取
	identity, err := decodeJWE(headers["x-tai-identity"], key)
	if err != nil {
		// 如果是安全模式，不尝试明文获取
		if safeMode {
			return Identity{}, fmt.Errorf("failed to decode JWE identity: %v", err)
		}
		// 非安全模式下尝试获取明文身份信息（兼容模式）
		identity, err = getPlainIdentity(headers)
	}
	return identity, err
}

// decodeJWE 解密 JWE 格式的身份信息
func decodeJWE(jweToken string, key []byte) (Identity, error) {
	var identity Identity

	// 解析 JWE
	encrypted, err := jose.ParseEncrypted(jweToken)
	if err != nil {
		return identity, fmt.Errorf("failed to parse JWE: %v", err)
	}

	// 解密
	decrypted, err := encrypted.Decrypt(key)
	if err != nil {
		return identity, fmt.Errorf("failed to decrypt JWE: %v", err)
	}

	// 解析 JSON
	if err = json.Unmarshal(decrypted, &identity); err != nil {
		return identity, fmt.Errorf("failed to unmarshal identity: %v", err)
	}

	// 校验 token 是否过期
	if identity.Expiration != "" {
		expTime, err := time.Parse(time.RFC3339, identity.Expiration)
		if err != nil {
			return identity, fmt.Errorf("failed to parse expiration time: %v", err)
		}
		// 增加 3 分钟缓冲，避免服务器时间差异
		if expTime.Before(time.Now().Add(-3 * time.Minute)) {
			return identity, errors.New("token expired")
		}
	}

	return identity, nil
}

// getPlainIdentity 从 headers 中获取明文身份信息（兼容模式）
func getPlainIdentity(headers map[string]string) (Identity, error) {
	if headers["staffid"] == "" || headers["staffname"] == "" {
		return Identity{}, errors.New("staffid or staffname is empty")
	}

	staffId, err := strconv.Atoi(headers["staffid"])
	if err != nil {
		return Identity{}, errors.New("invalid staffid")
	}

	return Identity{
		LoginName: headers["staffname"],
		StaffId:   staffId,
	}, nil
}
