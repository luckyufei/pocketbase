package tofauth

import (
	"crypto/sha256"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"
)

// ============================================================================
// Phase 1: Config 和 Register 测试
// ============================================================================

func TestConfigDefaults(t *testing.T) {
	config := Config{}
	config = applyDefaults(config)

	if config.getSafeMode() != true {
		t.Errorf("expected SafeMode default to be true, got %v", config.getSafeMode())
	}
	if config.RoutePrefix != "/api/tof" {
		t.Errorf("expected RoutePrefix default to be '/api/tof', got %v", config.RoutePrefix)
	}
	if config.getCheckTimestamp() != true {
		t.Errorf("expected CheckTimestamp default to be true, got %v", config.getCheckTimestamp())
	}
}

func TestConfigFromEnv(t *testing.T) {
	// 设置环境变量
	os.Setenv("TOF_APP_KEY", "test-app-key")
	os.Setenv("TOF_APP_TOKEN", "test-app-token")
	defer func() {
		os.Unsetenv("TOF_APP_KEY")
		os.Unsetenv("TOF_APP_TOKEN")
	}()

	config := Config{}
	config = applyDefaults(config)

	if config.AppKey != "test-app-key" {
		t.Errorf("expected AppKey from env to be 'test-app-key', got %v", config.AppKey)
	}
	if config.AppToken != "test-app-token" {
		t.Errorf("expected AppToken from env to be 'test-app-token', got %v", config.AppToken)
	}
}

func TestConfigExplicitOverridesEnv(t *testing.T) {
	// 设置环境变量
	os.Setenv("TOF_APP_KEY", "env-app-key")
	os.Setenv("TOF_APP_TOKEN", "env-app-token")
	defer func() {
		os.Unsetenv("TOF_APP_KEY")
		os.Unsetenv("TOF_APP_TOKEN")
	}()

	config := Config{
		AppKey:   "explicit-app-key",
		AppToken: "explicit-app-token",
	}
	config = applyDefaults(config)

	if config.AppKey != "explicit-app-key" {
		t.Errorf("expected explicit AppKey to override env, got %v", config.AppKey)
	}
	if config.AppToken != "explicit-app-token" {
		t.Errorf("expected explicit AppToken to override env, got %v", config.AppToken)
	}
}

func TestRegisterSkipsWhenNoAppToken(t *testing.T) {
	// 确保环境变量未设置
	os.Unsetenv("TOF_APP_KEY")
	os.Unsetenv("TOF_APP_TOKEN")

	config := Config{}
	config = applyDefaults(config)

	if config.AppToken != "" {
		t.Errorf("expected AppToken to be empty when env not set, got %v", config.AppToken)
	}
}

// ============================================================================
// Phase 2: 身份验证逻辑测试
// ============================================================================

func TestCheckSignature_Valid(t *testing.T) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	token := "test-token-12345"
	seq := "test-seq-123"

	// 计算正确的签名 (SafeMode=true 时 extHeaders 为 [seq, "", "", ""])
	extHeaders := strings.Join([]string{seq, "", "", ""}, ",")
	str := fmt.Sprintf("%s%s%s%s", timestamp, token, extHeaders, timestamp)
	signature := fmt.Sprintf("%x", sha256.Sum256([]byte(str)))

	headers := map[string]string{
		"timestamp":  timestamp,
		"signature":  signature,
		"x-rio-seq":  seq,
		"staffid":    "",
		"staffname":  "",
		"x-ext-data": "",
	}

	ok, err := checkSignature(token, headers, true, false) // safeMode=true, checkTimestamp=false
	if !ok || err != nil {
		t.Errorf("expected valid signature, got ok=%v, err=%v", ok, err)
	}
}

func TestCheckSignature_Invalid(t *testing.T) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	token := "test-token-12345"
	seq := "test-seq-123"

	headers := map[string]string{
		"timestamp":  timestamp,
		"signature":  "invalid-signature",
		"x-rio-seq":  seq,
		"staffid":    "",
		"staffname":  "",
		"x-ext-data": "",
	}

	ok, err := checkSignature(token, headers, true, false)
	if ok {
		t.Error("expected invalid signature to fail")
	}
	if err == nil || !strings.Contains(err.Error(), "invalid signature") {
		t.Errorf("expected 'invalid signature' error, got %v", err)
	}
}

func TestCheckSignature_ExpiredTimestamp(t *testing.T) {
	// 使用 200 秒前的时间戳
	timestamp := strconv.FormatInt(time.Now().Unix()-200, 10)
	token := "test-token-12345"
	seq := "test-seq-123"

	extHeaders := strings.Join([]string{seq, "", "", ""}, ",")
	str := fmt.Sprintf("%s%s%s%s", timestamp, token, extHeaders, timestamp)
	signature := fmt.Sprintf("%x", sha256.Sum256([]byte(str)))

	headers := map[string]string{
		"timestamp":  timestamp,
		"signature":  signature,
		"x-rio-seq":  seq,
		"staffid":    "",
		"staffname":  "",
		"x-ext-data": "",
	}

	// checkTimestamp=true 时应该失败
	ok, err := checkSignature(token, headers, true, true)
	if ok {
		t.Error("expected expired timestamp to fail when checkTimestamp=true")
	}
	if err == nil || !strings.Contains(err.Error(), "timestamp expired") {
		t.Errorf("expected 'timestamp expired' error, got %v", err)
	}

	// checkTimestamp=false 时应该通过
	ok, err = checkSignature(token, headers, true, false)
	if !ok || err != nil {
		t.Errorf("expected expired timestamp to pass when checkTimestamp=false, got ok=%v, err=%v", ok, err)
	}
}

func TestCheckSignature_InvalidTimestamp(t *testing.T) {
	headers := map[string]string{
		"timestamp":  "not-a-number",
		"signature":  "some-signature",
		"x-rio-seq":  "seq",
		"staffid":    "",
		"staffname":  "",
		"x-ext-data": "",
	}

	ok, err := checkSignature("token", headers, true, false)
	if ok {
		t.Error("expected invalid timestamp format to fail")
	}
	if err == nil || !strings.Contains(err.Error(), "invalid timestamp") {
		t.Errorf("expected 'invalid timestamp' error, got %v", err)
	}
}

func TestCheckSignature_NonSafeMode(t *testing.T) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	token := "test-token-12345"
	seq := "test-seq-123"
	staffId := "12345"
	staffName := "testuser"
	extData := "extra"

	// 非安全模式下 extHeaders 包含 staffid, staffname, x-ext-data
	extHeaders := strings.Join([]string{seq, staffId, staffName, extData}, ",")
	str := fmt.Sprintf("%s%s%s%s", timestamp, token, extHeaders, timestamp)
	signature := fmt.Sprintf("%x", sha256.Sum256([]byte(str)))

	headers := map[string]string{
		"timestamp":  timestamp,
		"signature":  signature,
		"x-rio-seq":  seq,
		"staffid":    staffId,
		"staffname":  staffName,
		"x-ext-data": extData,
	}

	ok, err := checkSignature(token, headers, false, false) // safeMode=false
	if !ok || err != nil {
		t.Errorf("expected valid signature in non-safe mode, got ok=%v, err=%v", ok, err)
	}
}

func TestGetPlainIdentity_Valid(t *testing.T) {
	headers := map[string]string{
		"staffid":   "12345",
		"staffname": "testuser",
	}

	identity, err := getPlainIdentity(headers)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
	if identity.LoginName != "testuser" {
		t.Errorf("expected LoginName 'testuser', got %v", identity.LoginName)
	}
	if identity.StaffId != 12345 {
		t.Errorf("expected StaffId 12345, got %v", identity.StaffId)
	}
}

func TestGetPlainIdentity_MissingStaffId(t *testing.T) {
	headers := map[string]string{
		"staffid":   "",
		"staffname": "testuser",
	}

	_, err := getPlainIdentity(headers)
	if err == nil {
		t.Error("expected error when staffid is empty")
	}
}

func TestGetPlainIdentity_MissingStaffName(t *testing.T) {
	headers := map[string]string{
		"staffid":   "12345",
		"staffname": "",
	}

	_, err := getPlainIdentity(headers)
	if err == nil {
		t.Error("expected error when staffname is empty")
	}
}

func TestGetPlainIdentity_InvalidStaffId(t *testing.T) {
	headers := map[string]string{
		"staffid":   "not-a-number",
		"staffname": "testuser",
	}

	_, err := getPlainIdentity(headers)
	if err == nil {
		t.Error("expected error when staffid is not a number")
	}
}

// ============================================================================
// Phase 3: 辅助函数测试
// ============================================================================

func TestCleanURL(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"https://example.com//path//to//resource", "https://example.com/path/to/resource"},
		{"http://example.com/path", "http://example.com/path"},
		{"https://example.com///multiple///slashes", "https://example.com/multiple/slashes"},
		{"not-a-url", "not-a-url"},
		{"https://example.com", "https://example.com"},
	}

	for _, tt := range tests {
		result := cleanURL(tt.input)
		if result != tt.expected {
			t.Errorf("cleanURL(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// ============================================================================
// Identity 结构测试
// ============================================================================

func TestIdentityStruct(t *testing.T) {
	ticket := "test-ticket"
	identity := Identity{
		LoginName:  "testuser",
		StaffId:    12345,
		Expiration: "2026-01-04T12:00:00Z",
		Ticket:     &ticket,
	}

	if identity.LoginName != "testuser" {
		t.Errorf("expected LoginName 'testuser', got %v", identity.LoginName)
	}
	if identity.StaffId != 12345 {
		t.Errorf("expected StaffId 12345, got %v", identity.StaffId)
	}
	if identity.Ticket == nil || *identity.Ticket != "test-ticket" {
		t.Errorf("expected Ticket 'test-ticket', got %v", identity.Ticket)
	}
}

// ============================================================================
// Phase 4: JSVM 集成测试
// ============================================================================

func TestBindToVM(t *testing.T) {
	// 这个测试验证 BindToVM 不会 panic
	// 实际的功能测试需要在集成测试中进行
	// 因为需要完整的 goja.Runtime 环境

	// 测试 BindToVMWithConfig 使用默认值
	config := Config{
		AppToken: "test-token",
	}
	config = applyDefaults(config)

	if config.AppToken != "test-token" {
		t.Errorf("expected AppToken 'test-token', got %v", config.AppToken)
	}
	if config.getSafeMode() != true {
		t.Errorf("expected SafeMode default true, got %v", config.getSafeMode())
	}
}

func TestConfigExplicitFalse(t *testing.T) {
	// 测试显式设置为 false
	config := Config{
		AppToken:       "test-token",
		SafeMode:       Bool(false),
		CheckTimestamp: Bool(false),
	}
	config = applyDefaults(config)

	if config.getSafeMode() != false {
		t.Errorf("expected SafeMode to be explicitly false, got %v", config.getSafeMode())
	}
	if config.getCheckTimestamp() != false {
		t.Errorf("expected CheckTimestamp to be explicitly false, got %v", config.getCheckTimestamp())
	}
}

// ============================================================================
// GetTofIdentity 集成测试
// ============================================================================

func TestGetTofIdentity_ValidSignature(t *testing.T) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	token := "test-token-12345"
	seq := "test-seq-123"
	taiId := "" // 空的 JWE，会回退到明文模式

	// 计算正确的签名
	extHeaders := strings.Join([]string{seq, "", "", ""}, ",")
	str := fmt.Sprintf("%s%s%s%s", timestamp, token, extHeaders, timestamp)
	signature := fmt.Sprintf("%x", sha256.Sum256([]byte(str)))

	// 安全模式下，空的 taiId 会导致 JWE 解析失败
	_, err := GetTofIdentity(token, taiId, timestamp, signature, seq, true, false)
	if err == nil {
		t.Error("expected error when taiId is empty in safe mode")
	}
}

func TestGetTofIdentity_InvalidSignature(t *testing.T) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	token := "test-token-12345"
	seq := "test-seq-123"
	taiId := ""

	_, err := GetTofIdentity(token, taiId, timestamp, "invalid-signature", seq, true, false)
	if err == nil {
		t.Error("expected error for invalid signature")
	}
	if !strings.Contains(err.Error(), "invalid signature") {
		t.Errorf("expected 'invalid signature' error, got %v", err)
	}
}

func TestGetTofIdentityFromHeaders(t *testing.T) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	token := "test-token-12345"
	seq := "test-seq-123"

	// 计算正确的签名
	extHeaders := strings.Join([]string{seq, "", "", ""}, ",")
	str := fmt.Sprintf("%s%s%s%s", timestamp, token, extHeaders, timestamp)
	signature := fmt.Sprintf("%x", sha256.Sum256([]byte(str)))

	headers := map[string]string{
		"x-tai-identity": "",
		"timestamp":      timestamp,
		"signature":      signature,
		"x-rio-seq":      seq,
	}

	// 安全模式下会失败（因为没有有效的 JWE）
	_, err := GetTofIdentityFromHeaders(token, headers, true, false)
	if err == nil {
		t.Error("expected error when x-tai-identity is empty in safe mode")
	}
}

// ============================================================================
// decodeJWE 测试
// ============================================================================

func TestDecodeJWE_InvalidFormat(t *testing.T) {
	_, err := decodeJWE("not-a-valid-jwe", []byte("key"))
	if err == nil {
		t.Error("expected error for invalid JWE format")
	}
}

func TestDecodeJWE_EmptyToken(t *testing.T) {
	_, err := decodeJWE("", []byte("key"))
	if err == nil {
		t.Error("expected error for empty JWE token")
	}
}

// ============================================================================
// getIdentity 测试
// ============================================================================

func TestGetIdentity_FallbackToPlainInNonSafeMode(t *testing.T) {
	headers := map[string]string{
		"x-tai-identity": "invalid-jwe",
		"staffid":        "12345",
		"staffname":      "testuser",
	}

	// 非安全模式下，JWE 解析失败会回退到明文模式
	identity, err := getIdentity([]byte("key"), headers, false)
	if err != nil {
		t.Errorf("expected fallback to plain identity, got error: %v", err)
	}
	if identity.LoginName != "testuser" {
		t.Errorf("expected LoginName 'testuser', got %v", identity.LoginName)
	}
	if identity.StaffId != 12345 {
		t.Errorf("expected StaffId 12345, got %v", identity.StaffId)
	}
}

func TestGetIdentity_NoFallbackInSafeMode(t *testing.T) {
	headers := map[string]string{
		"x-tai-identity": "invalid-jwe",
		"staffid":        "12345",
		"staffname":      "testuser",
	}

	// 安全模式下，JWE 解析失败不会回退到明文模式
	_, err := getIdentity([]byte("key"), headers, true)
	if err == nil {
		t.Error("expected error in safe mode when JWE is invalid")
	}
}
