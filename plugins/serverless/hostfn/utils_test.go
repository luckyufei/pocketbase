// Package hostfn 提供 Serverless 运行时的 Host Functions
package hostfn

import (
	"regexp"
	"testing"
)

// Phase 14: US12 Utility Functions 测试

func TestUtilService(t *testing.T) {
	t.Run("生成 UUID", func(t *testing.T) {
		utils := NewUtilService()

		uuid := utils.UUID()
		if uuid == "" {
			t.Error("UUID() 返回空字符串")
		}

		// UUID v7 格式验证
		uuidPattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
		if !uuidPattern.MatchString(uuid) {
			t.Errorf("UUID() = %s, 不符合 UUID v7 格式", uuid)
		}
	})

	t.Run("UUID 唯一性", func(t *testing.T) {
		utils := NewUtilService()

		uuids := make(map[string]bool)
		for i := 0; i < 1000; i++ {
			uuid := utils.UUID()
			if uuids[uuid] {
				t.Errorf("UUID() 生成了重复的 UUID: %s", uuid)
			}
			uuids[uuid] = true
		}
	})

	t.Run("Hash 计算", func(t *testing.T) {
		utils := NewUtilService()

		hash := utils.Hash("hello")
		if hash == "" {
			t.Error("Hash() 返回空字符串")
		}

		// SHA256 输出 64 个十六进制字符
		if len(hash) != 64 {
			t.Errorf("Hash() 长度 = %d, want 64", len(hash))
		}
	})

	t.Run("Hash 一致性", func(t *testing.T) {
		utils := NewUtilService()

		hash1 := utils.Hash("test")
		hash2 := utils.Hash("test")

		if hash1 != hash2 {
			t.Errorf("Hash() 对相同输入返回不同结果: %s vs %s", hash1, hash2)
		}
	})

	t.Run("Hash 不同输入", func(t *testing.T) {
		utils := NewUtilService()

		hash1 := utils.Hash("hello")
		hash2 := utils.Hash("world")

		if hash1 == hash2 {
			t.Error("Hash() 对不同输入返回相同结果")
		}
	})

	t.Run("随机字符串", func(t *testing.T) {
		utils := NewUtilService()

		str := utils.RandomString(16)
		if len(str) != 16 {
			t.Errorf("RandomString(16) 长度 = %d, want 16", len(str))
		}
	})

	t.Run("随机字符串唯一性", func(t *testing.T) {
		utils := NewUtilService()

		strings := make(map[string]bool)
		for i := 0; i < 100; i++ {
			str := utils.RandomString(32)
			if strings[str] {
				t.Errorf("RandomString() 生成了重复的字符串: %s", str)
			}
			strings[str] = true
		}
	})

	t.Run("随机字符串长度", func(t *testing.T) {
		utils := NewUtilService()

		lengths := []int{8, 16, 32, 64, 128}
		for _, length := range lengths {
			str := utils.RandomString(length)
			if len(str) != length {
				t.Errorf("RandomString(%d) 长度 = %d", length, len(str))
			}
		}
	})

	t.Run("零长度随机字符串", func(t *testing.T) {
		utils := NewUtilService()

		str := utils.RandomString(0)
		if str != "" {
			t.Errorf("RandomString(0) = %s, want empty", str)
		}
	})
}

func TestUtilServiceHostFunction(t *testing.T) {
	t.Run("Host Function 调用", func(t *testing.T) {
		hf := NewHostFunctions(nil)

		uuid := hf.UtilUUID()
		if uuid == "" {
			t.Error("UtilUUID() 返回空字符串")
		}

		hash := hf.UtilHash("test")
		if hash == "" {
			t.Error("UtilHash() 返回空字符串")
		}

		str := hf.UtilRandomString(16)
		if len(str) != 16 {
			t.Errorf("UtilRandomString(16) 长度 = %d, want 16", len(str))
		}
	})
}

func TestBase64(t *testing.T) {
	t.Run("Base64 编码", func(t *testing.T) {
		utils := NewUtilService()

		encoded := utils.Base64Encode([]byte("Hello, World!"))
		if encoded != "SGVsbG8sIFdvcmxkIQ==" {
			t.Errorf("Base64Encode() = %s, want SGVsbG8sIFdvcmxkIQ==", encoded)
		}
	})

	t.Run("Base64 解码", func(t *testing.T) {
		utils := NewUtilService()

		decoded, err := utils.Base64Decode("SGVsbG8sIFdvcmxkIQ==")
		if err != nil {
			t.Fatalf("Base64Decode() error = %v", err)
		}

		if string(decoded) != "Hello, World!" {
			t.Errorf("Base64Decode() = %s, want Hello, World!", string(decoded))
		}
	})

	t.Run("Base64 无效输入", func(t *testing.T) {
		utils := NewUtilService()

		_, err := utils.Base64Decode("invalid!!!")
		if err == nil {
			t.Error("Base64Decode() 应该返回错误")
		}
	})
}

func TestJSONUtils(t *testing.T) {
	t.Run("JSON 序列化", func(t *testing.T) {
		utils := NewUtilService()

		data := map[string]interface{}{
			"name": "test",
			"age":  30,
		}

		json, err := utils.JSONStringify(data)
		if err != nil {
			t.Fatalf("JSONStringify() error = %v", err)
		}

		if json == "" {
			t.Error("JSONStringify() 返回空字符串")
		}
	})

	t.Run("JSON 解析", func(t *testing.T) {
		utils := NewUtilService()

		result, err := utils.JSONParse(`{"name":"test","age":30}`)
		if err != nil {
			t.Fatalf("JSONParse() error = %v", err)
		}

		data, ok := result.(map[string]interface{})
		if !ok {
			t.Fatal("JSONParse() 返回类型错误")
		}

		if data["name"] != "test" {
			t.Errorf("name = %v, want test", data["name"])
		}
	})
}

// T089: 复用 plugins/jsvm/ 已有的 Go bindings 测试
func TestSecurityBindings(t *testing.T) {
	t.Run("MD5 哈希", func(t *testing.T) {
		utils := NewUtilService()

		hash := utils.MD5("hello")
		// MD5 输出 32 个十六进制字符
		if len(hash) != 32 {
			t.Errorf("MD5() 长度 = %d, want 32", len(hash))
		}

		// 已知值验证
		expected := "5d41402abc4b2a76b9719d911017c592"
		if hash != expected {
			t.Errorf("MD5('hello') = %s, want %s", hash, expected)
		}
	})

	t.Run("SHA256 哈希 (复用 security 包)", func(t *testing.T) {
		utils := NewUtilService()

		hash := utils.SHA256("hello")
		if len(hash) != 64 {
			t.Errorf("SHA256() 长度 = %d, want 64", len(hash))
		}

		// 已知值验证
		expected := "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
		if hash != expected {
			t.Errorf("SHA256('hello') = %s, want %s", hash, expected)
		}
	})

	t.Run("SHA512 哈希", func(t *testing.T) {
		utils := NewUtilService()

		hash := utils.SHA512("hello")
		// SHA512 输出 128 个十六进制字符
		if len(hash) != 128 {
			t.Errorf("SHA512() 长度 = %d, want 128", len(hash))
		}
	})

	t.Run("HMAC-SHA256", func(t *testing.T) {
		utils := NewUtilService()

		hash := utils.HS256("hello", "secret")
		if hash == "" {
			t.Error("HS256() 返回空字符串")
		}
		if len(hash) != 64 {
			t.Errorf("HS256() 长度 = %d, want 64", len(hash))
		}
	})

	t.Run("HMAC-SHA512", func(t *testing.T) {
		utils := NewUtilService()

		hash := utils.HS512("hello", "secret")
		if hash == "" {
			t.Error("HS512() 返回空字符串")
		}
		if len(hash) != 128 {
			t.Errorf("HS512() 长度 = %d, want 128", len(hash))
		}
	})

	t.Run("安全比较", func(t *testing.T) {
		utils := NewUtilService()

		if !utils.Equal("abc", "abc") {
			t.Error("Equal('abc', 'abc') 应该返回 true")
		}

		if utils.Equal("abc", "def") {
			t.Error("Equal('abc', 'def') 应该返回 false")
		}
	})

	t.Run("自定义字符集随机字符串", func(t *testing.T) {
		utils := NewUtilService()

		str := utils.RandomStringWithAlphabet(16, "abc")
		if len(str) != 16 {
			t.Errorf("RandomStringWithAlphabet(16, 'abc') 长度 = %d, want 16", len(str))
		}

		// 验证只包含指定字符
		for _, c := range str {
			if c != 'a' && c != 'b' && c != 'c' {
				t.Errorf("RandomStringWithAlphabet() 包含非法字符: %c", c)
			}
		}
	})

	t.Run("伪随机字符串", func(t *testing.T) {
		utils := NewUtilService()

		str := utils.PseudorandomString(16)
		if len(str) != 16 {
			t.Errorf("PseudorandomString(16) 长度 = %d, want 16", len(str))
		}
	})
}

func TestEncryptDecrypt(t *testing.T) {
	t.Run("AES 加密解密", func(t *testing.T) {
		utils := NewUtilService()

		plaintext := "Hello, World!"
		key := "12345678901234567890123456789012" // 32 字节密钥

		encrypted, err := utils.Encrypt([]byte(plaintext), key)
		if err != nil {
			t.Fatalf("Encrypt() error = %v", err)
		}

		if encrypted == "" {
			t.Error("Encrypt() 返回空字符串")
		}

		decrypted, err := utils.Decrypt(encrypted, key)
		if err != nil {
			t.Fatalf("Decrypt() error = %v", err)
		}

		if string(decrypted) != plaintext {
			t.Errorf("Decrypt() = %s, want %s", string(decrypted), plaintext)
		}
	})

	t.Run("解密错误密钥", func(t *testing.T) {
		utils := NewUtilService()

		plaintext := "Hello, World!"
		key1 := "12345678901234567890123456789012"
		key2 := "abcdefghijklmnopqrstuvwxyz123456"

		encrypted, _ := utils.Encrypt([]byte(plaintext), key1)

		_, err := utils.Decrypt(encrypted, key2)
		if err == nil {
			t.Error("Decrypt() 使用错误密钥应该返回错误")
		}
	})
}

func TestJWTBindings(t *testing.T) {
	t.Run("创建和解析 JWT", func(t *testing.T) {
		utils := NewUtilService()

		secret := "my-secret-key-for-jwt-testing-32"
		payload := map[string]interface{}{
			"user_id": "123",
			"role":    "admin",
		}

		token, err := utils.CreateJWT(payload, secret, 3600)
		if err != nil {
			t.Fatalf("CreateJWT() error = %v", err)
		}

		if token == "" {
			t.Error("CreateJWT() 返回空字符串")
		}

		// 解析 JWT
		claims, err := utils.ParseJWT(token, secret)
		if err != nil {
			t.Fatalf("ParseJWT() error = %v", err)
		}

		if claims["user_id"] != "123" {
			t.Errorf("claims['user_id'] = %v, want '123'", claims["user_id"])
		}
	})

	t.Run("解析未验证的 JWT", func(t *testing.T) {
		utils := NewUtilService()

		secret := "my-secret-key-for-jwt-testing-32"
		payload := map[string]interface{}{
			"user_id": "456",
		}

		token, _ := utils.CreateJWT(payload, secret, 3600)

		// 使用错误密钥解析（未验证）
		claims, err := utils.ParseUnverifiedJWT(token)
		if err != nil {
			t.Fatalf("ParseUnverifiedJWT() error = %v", err)
		}

		if claims["user_id"] != "456" {
			t.Errorf("claims['user_id'] = %v, want '456'", claims["user_id"])
		}
	})

	t.Run("验证 JWT 签名失败", func(t *testing.T) {
		utils := NewUtilService()

		secret1 := "my-secret-key-for-jwt-testing-32"
		secret2 := "wrong-secret-key-for-jwt-testing"
		payload := map[string]interface{}{
			"user_id": "789",
		}

		token, _ := utils.CreateJWT(payload, secret1, 3600)

		_, err := utils.ParseJWT(token, secret2)
		if err == nil {
			t.Error("ParseJWT() 使用错误密钥应该返回错误")
		}
	})
}

// TestAdditionalSecurityBindings 测试 T089 新增的 security bindings
func TestAdditionalSecurityBindings(t *testing.T) {
	t.Run("PseudorandomStringWithAlphabet", func(t *testing.T) {
		utils := NewUtilService()

		result := utils.PseudorandomStringWithAlphabet(10, "abc")
		if len(result) != 10 {
			t.Errorf("PseudorandomStringWithAlphabet() length = %d, want 10", len(result))
		}

		// 验证只包含指定字符
		for _, c := range result {
			if c != 'a' && c != 'b' && c != 'c' {
				t.Errorf("PseudorandomStringWithAlphabet() 包含非法字符: %c", c)
			}
		}
	})

	t.Run("PseudorandomStringWithAlphabet 边界情况", func(t *testing.T) {
		utils := NewUtilService()

		// 长度为 0
		result := utils.PseudorandomStringWithAlphabet(0, "abc")
		if result != "" {
			t.Errorf("PseudorandomStringWithAlphabet(0, ...) = %s, want empty", result)
		}

		// 空字符集
		result = utils.PseudorandomStringWithAlphabet(10, "")
		if result != "" {
			t.Errorf("PseudorandomStringWithAlphabet(..., \"\") = %s, want empty", result)
		}

		// 负数长度
		result = utils.PseudorandomStringWithAlphabet(-1, "abc")
		if result != "" {
			t.Errorf("PseudorandomStringWithAlphabet(-1, ...) = %s, want empty", result)
		}
	})

	t.Run("RandomStringByRegex 成功", func(t *testing.T) {
		utils := NewUtilService()

		// 简单模式
		result, err := utils.RandomStringByRegex("[a-z]{5}")
		if err != nil {
			t.Fatalf("RandomStringByRegex() error = %v", err)
		}

		if len(result) != 5 {
			t.Errorf("RandomStringByRegex() length = %d, want 5", len(result))
		}

		// 验证只包含小写字母
		for _, c := range result {
			if c < 'a' || c > 'z' {
				t.Errorf("RandomStringByRegex() 包含非法字符: %c", c)
			}
		}
	})

	t.Run("RandomStringByRegex 数字模式", func(t *testing.T) {
		utils := NewUtilService()

		result, err := utils.RandomStringByRegex("[0-9]{8}")
		if err != nil {
			t.Fatalf("RandomStringByRegex() error = %v", err)
		}

		if len(result) != 8 {
			t.Errorf("RandomStringByRegex() length = %d, want 8", len(result))
		}

		// 验证只包含数字
		for _, c := range result {
			if c < '0' || c > '9' {
				t.Errorf("RandomStringByRegex() 包含非法字符: %c", c)
			}
		}
	})

	t.Run("RandomStringByRegex 混合模式", func(t *testing.T) {
		utils := NewUtilService()

		result, err := utils.RandomStringByRegex("[A-Za-z0-9]{10}")
		if err != nil {
			t.Fatalf("RandomStringByRegex() error = %v", err)
		}

		if len(result) != 10 {
			t.Errorf("RandomStringByRegex() length = %d, want 10", len(result))
		}
	})
}
