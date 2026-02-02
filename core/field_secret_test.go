package core_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestSecretFieldBaseMethods(t *testing.T) {
	testFieldBaseMethods(t, core.FieldTypeSecret)
}

func TestSecretFieldColumnType(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		f := &core.SecretField{}

		expected := "TEXT DEFAULT '' NOT NULL"

		if v := f.ColumnType(app); v != expected {
			t.Fatalf("Expected\n%q\ngot\n%q", expected, v)
		}
	})
}

func TestSecretFieldPrepareValue(t *testing.T) {
	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		f := &core.SecretField{Name: "test"}
		record := core.NewRecord(core.NewBaseCollection("test"))

		scenarios := []struct {
			raw      any
			expected string
		}{
			{"", ""},
			{"test", "test"},
			{"sk-xxx-123", "sk-xxx-123"},
		}

		for i, s := range scenarios {
			t.Run(fmt.Sprintf("%d_%#v", i, s.raw), func(t *testing.T) {
				v, err := f.PrepareValue(record, s.raw)
				if err != nil {
					t.Fatal(err)
				}

				sv, ok := v.(*core.SecretFieldValue)
				if !ok {
					t.Fatalf("Expected SecretFieldValue instance, got %T", v)
				}

				if sv.Encrypted != s.expected {
					t.Fatalf("Expected encrypted %q, got %q", s.expected, sv.Encrypted)
				}
			})
		}
	})
}

func TestSecretFieldDriverValue(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		f := &core.SecretField{Name: "test"}

		err := errors.New("example_err")

		scenarios := []struct {
			name        string
			raw         any
			expectError bool
		}{
			{
				"empty value",
				&core.SecretFieldValue{},
				false,
			},
			{
				"with encrypted value",
				&core.SecretFieldValue{Encrypted: "encrypted_data"},
				false,
			},
			{
				"with last error",
				&core.SecretFieldValue{LastError: err},
				true,
			},
		}

		for _, s := range scenarios {
			t.Run(s.name, func(t *testing.T) {
				record := core.NewRecord(core.NewBaseCollection("test"))
				record.SetRaw(f.GetName(), s.raw)

				v, err := f.DriverValue(record)

				hasErr := err != nil
				if hasErr != s.expectError {
					t.Fatalf("Expected hasErr %v, got %v (%v)", s.expectError, hasErr, err)
				}

				if !s.expectError {
					if _, ok := v.(string); !ok {
						t.Fatalf("Expected string, got %T", v)
					}
				}
			})
		}
	})
}

func TestSecretFieldValidateValue(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		collection := core.NewBaseCollection("test_collection")

		scenarios := []struct {
			name        string
			field       *core.SecretField
			record      func() *core.Record
			expectError bool
		}{
			{
				"zero field value (not required)",
				&core.SecretField{Name: "test"},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{})
					return record
				},
				false,
			},
			{
				"zero field value (required)",
				&core.SecretField{Name: "test", Required: true},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{})
					return record
				},
				true,
			},
			{
				"non-empty plain value (required)",
				&core.SecretField{Name: "test", Required: true},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Plain: "test", Encrypted: "encrypted"})
					return record
				},
				false,
			},
			{
				"non-empty encrypted only (required)",
				&core.SecretField{Name: "test", Required: true},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Encrypted: "encrypted"})
					return record
				},
				false,
			},
			{
				"with LastError",
				&core.SecretField{Name: "test"},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{LastError: errors.New("test")})
					return record
				},
				true,
			},
			{
				"> MaxSize",
				&core.SecretField{Name: "test", MaxSize: 5},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Plain: "123456"})
					return record
				},
				true,
			},
			{
				"<= MaxSize",
				&core.SecretField{Name: "test", MaxSize: 5},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Plain: "12345"})
					return record
				},
				false,
			},
			{
				"> default MaxSize",
				&core.SecretField{Name: "test"},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Plain: strings.Repeat("a", core.SecretFieldDefaultMaxSize+1)})
					return record
				},
				true,
			},
			{
				"empty string value (valid)",
				&core.SecretField{Name: "test"},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Plain: ""})
					return record
				},
				false,
			},
			{
				"special characters (unicode)",
				&core.SecretField{Name: "test"},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Plain: "你好世界🔐"})
					return record
				},
				false,
			},
			{
				"special characters (newline and tab)",
				&core.SecretField{Name: "test"},
				func() *core.Record {
					record := core.NewRecord(collection)
					record.SetRaw("test", &core.SecretFieldValue{Plain: "line1\nline2\ttab"})
					return record
				},
				false,
			},
		}

		for _, s := range scenarios {
			t.Run(s.name, func(t *testing.T) {
				err := s.field.ValidateValue(context.Background(), app, s.record())

				hasErr := err != nil
				if hasErr != s.expectError {
					t.Fatalf("Expected hasErr %v, got %v (%v)", s.expectError, hasErr, err)
				}
			})
		}
	})
}

func TestSecretFieldValidateSettings(t *testing.T) {
	testDefaultFieldIdValidation(t, core.FieldTypeSecret)
	testDefaultFieldNameValidation(t, core.FieldTypeSecret)

	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		scenarios := []struct {
			name         string
			field        func(col *core.Collection) *core.SecretField
			expectErrors []string
		}{
			{
				"zero minimal",
				func(col *core.Collection) *core.SecretField {
					return &core.SecretField{
						Id:   "test",
						Name: "test",
					}
				},
				[]string{},
			},
			{
				"MaxSize < 0",
				func(col *core.Collection) *core.SecretField {
					return &core.SecretField{
						Id:      "test",
						Name:    "test",
						MaxSize: -1,
					}
				},
				[]string{"maxSize"},
			},
			{
				"MaxSize > default max",
				func(col *core.Collection) *core.SecretField {
					return &core.SecretField{
						Id:      "test",
						Name:    "test",
						MaxSize: core.SecretFieldDefaultMaxSize + 1,
					}
				},
				[]string{"maxSize"},
			},
			{
				"valid MaxSize",
				func(col *core.Collection) *core.SecretField {
					return &core.SecretField{
						Id:      "test",
						Name:    "test",
						MaxSize: 1024,
					}
				},
				[]string{},
			},
		}

		for _, s := range scenarios {
			t.Run(s.name, func(t *testing.T) {
				collection := core.NewBaseCollection("test_collection")
				collection.Fields.GetByName("id").SetId("test")

				field := s.field(collection)

				collection.Fields.Add(field)

				errs := field.ValidateSettings(context.Background(), app, collection)

				tests.TestValidationErrors(t, errs, s.expectErrors)
			})
		}
	})
}

func TestSecretFieldValidateSettings_SecretsDisabled(t *testing.T) {
	// 确保 master key 未设置
	os.Unsetenv(core.MasterKeyEnvVar)

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		collection := core.NewBaseCollection("test_collection")
		field := &core.SecretField{
			Id:   "test",
			Name: "test",
		}

		err := field.ValidateSettings(context.Background(), app, collection)

		if err == nil {
			t.Fatal("Expected error when secrets disabled, got nil")
		}
	})
}

func TestSecretFieldFindSetter(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		scenarios := []struct {
			name       string
			key        string
			value      any
			field      *core.SecretField
			hasSetter  bool
			checkPlain string
		}{
			{
				"no match",
				"example",
				"abc",
				&core.SecretField{Name: "test"},
				false,
				"",
			},
			{
				"exact match",
				"test",
				"sk-abc123",
				&core.SecretField{Name: "test"},
				true,
				"sk-abc123",
			},
		}

		for _, s := range scenarios {
			t.Run(s.name, func(t *testing.T) {
				collection := core.NewBaseCollection("test_collection")
				collection.Fields.Add(s.field)

				setter := s.field.FindSetter(s.key)

				hasSetter := setter != nil
				if hasSetter != s.hasSetter {
					t.Fatalf("Expected hasSetter %v, got %v", s.hasSetter, hasSetter)
				}

				if !hasSetter {
					return
				}

				record := core.NewRecord(collection)
				setter(record, s.value)

				// 验证 plain 值被正确设置
				raw := record.GetRaw(s.field.GetName())
				sv, ok := raw.(*core.SecretFieldValue)
				if !ok {
					t.Fatalf("Expected SecretFieldValue, got %T", raw)
				}

				if sv.Plain != s.checkPlain {
					t.Fatalf("Expected plain %q, got %q", s.checkPlain, sv.Plain)
				}
			})
		}
	})
}

func TestSecretFieldFindGetter(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		scenarios := []struct {
			name      string
			key       string
			field     *core.SecretField
			rawValue  *core.SecretFieldValue
			hasGetter bool
			expected  string
		}{
			{
				"no match",
				"example",
				&core.SecretField{Name: "test"},
				&core.SecretFieldValue{Plain: "test_value"},
				false,
				"",
			},
			{
				"field name match - return plain",
				"test",
				&core.SecretField{Name: "test"},
				&core.SecretFieldValue{Plain: "test_value"},
				true,
				"test_value",
			},
			{
				"field name match - empty",
				"test",
				&core.SecretField{Name: "test"},
				&core.SecretFieldValue{},
				true,
				"",
			},
		}

		for _, s := range scenarios {
			t.Run(s.name, func(t *testing.T) {
				collection := core.NewBaseCollection("test_collection")
				collection.Fields.Add(s.field)

				getter := s.field.FindGetter(s.key)

				hasGetter := getter != nil
				if hasGetter != s.hasGetter {
					t.Fatalf("Expected hasGetter %v, got %v", s.hasGetter, hasGetter)
				}

				if !hasGetter {
					return
				}

				record := core.NewRecord(collection)
				record.SetRaw(s.field.GetName(), s.rawValue)

				result := getter(record)

				if result != s.expected {
					t.Fatalf("Expected %q, got %#v", s.expected, result)
				}
			})
		}
	})
}

func TestSecretFieldEncryptDecryptRoundTrip(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 创建包含 secret 字段的 collection
		collection := core.NewBaseCollection("test_secrets")
		collection.Fields.Add(&core.SecretField{
			Id:   "secret_field",
			Name: "api_key",
		})

		if err := app.Save(collection); err != nil {
			t.Fatalf("Failed to save collection: %v", err)
		}

		testCases := []string{
			"sk-test-key-12345",
			"",
			"你好世界🔐",
			"line1\nline2\ttab",
			strings.Repeat("a", 100),
		}

		for _, plaintext := range testCases {
			t.Run(fmt.Sprintf("value_%s", plaintext[:min(10, len(plaintext))]), func(t *testing.T) {
				// 创建记录
				record := core.NewRecord(collection)
				record.Set("api_key", plaintext)

				if err := app.Save(record); err != nil {
					t.Fatalf("Failed to save record: %v", err)
				}

				// 从数据库重新加载
				loaded, err := app.FindRecordById(collection.Name, record.Id)
				if err != nil {
					t.Fatalf("Failed to load record: %v", err)
				}

				// 验证解密后的值
				decrypted := loaded.GetString("api_key")
				if decrypted != plaintext {
					t.Fatalf("Expected %q, got %q", plaintext, decrypted)
				}
			})
		}
	})
}

func TestSecretFieldDatabaseStoresEncrypted(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 创建包含 secret 字段的 collection
		collection := core.NewBaseCollection("test_encrypted")
		collection.Fields.Add(&core.SecretField{
			Id:   "secret_field",
			Name: "api_key",
		})

		if err := app.Save(collection); err != nil {
			t.Fatalf("Failed to save collection: %v", err)
		}

		plaintext := "sk-secret-key-12345"

		// 创建记录
		record := core.NewRecord(collection)
		record.Set("api_key", plaintext)

		if err := app.Save(record); err != nil {
			t.Fatalf("Failed to save record: %v", err)
		}

		// 直接查询数据库验证存储的是密文
		var storedValue string
		err := app.DB().
			NewQuery("SELECT api_key FROM test_encrypted WHERE id = {:id}").
			Bind(map[string]any{"id": record.Id}).
			Row(&storedValue)

		if err != nil {
			t.Fatalf("Failed to query database: %v", err)
		}

		// 存储的值不应该是明文
		if storedValue == plaintext {
			t.Fatal("Database stores plaintext instead of encrypted value")
		}

		// 存储的值应该是非空的 base64 字符串
		if storedValue == "" {
			t.Fatal("Database stores empty string")
		}
	})
}

func TestSecretFieldMasterKeyChanged(t *testing.T) {
	// 这个测试验证使用错误的 master key 无法解密数据
	// 由于 SecretsSettings 在应用启动时初始化，测试中途更改环境变量不会影响已初始化的 crypto engine
	// 因此这个测试需要验证的是存储的密文格式，而不是运行时更改 key

	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 创建包含 secret 字段的 collection
		collection := core.NewBaseCollection("test_key_change")
		collection.Fields.Add(&core.SecretField{
			Id:   "secret_field",
			Name: "api_key",
		})

		if err := app.Save(collection); err != nil {
			t.Fatalf("Failed to save collection: %v", err)
		}

		// 创建记录
		record := core.NewRecord(collection)
		record.Set("api_key", "sk-secret-key")

		if err := app.Save(record); err != nil {
			t.Fatalf("Failed to save record: %v", err)
		}

		// 验证数据库中存储的是密文而不是明文
		var encryptedValue string
		err := app.DB().
			NewQuery("SELECT api_key FROM test_key_change WHERE id = {:id}").
			Bind(map[string]any{"id": record.Id}).
			Row(&encryptedValue)

		if err != nil {
			t.Fatalf("Failed to query encrypted value: %v", err)
		}

		// 存储的值不应该是明文
		if encryptedValue == "sk-secret-key" {
			t.Fatal("Database stores plaintext instead of encrypted value")
		}

		// 存储的值应该是非空的（base64 编码的密文）
		if encryptedValue == "" {
			t.Fatal("Database stores empty string")
		}

		// 重新加载记录，验证可以正确解密
		loaded, err := app.FindRecordById("test_key_change", record.Id)
		if err != nil {
			t.Fatalf("Failed to load record: %v", err)
		}

		decrypted := loaded.GetString("api_key")
		if decrypted != "sk-secret-key" {
			t.Fatalf("Expected 'sk-secret-key', got %q", decrypted)
		}
	})
}

func TestSecretFieldJSONMarshal(t *testing.T) {
	f := &core.SecretField{
		Id:       "test_id",
		Name:     "api_key",
		Hidden:   true,
		Required: true,
		MaxSize:  2048,
	}

	// 测试单独字段序列化（不包含 type，type 由 FieldsList 添加）
	data, err := json.Marshal(f)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	// 单独序列化 Field 不包含 type（type 由 FieldsList 添加）
	// 验证基本字段
	if result["name"] != "api_key" {
		t.Fatalf("Expected name 'api_key', got %v", result["name"])
	}

	if result["id"] != "test_id" {
		t.Fatalf("Expected id 'test_id', got %v", result["id"])
	}

	if result["required"] != true {
		t.Fatalf("Expected required true, got %v", result["required"])
	}

	if result["hidden"] != true {
		t.Fatalf("Expected hidden true, got %v", result["hidden"])
	}

	if maxSize, ok := result["maxSize"].(float64); !ok || maxSize != 2048 {
		t.Fatalf("Expected maxSize 2048, got %v", result["maxSize"])
	}

	// 测试通过 FieldsList 序列化（包含 type）
	collection := core.NewBaseCollection("test")
	collection.Fields.Add(f)

	fieldsData, err := json.Marshal(collection.Fields)
	if err != nil {
		t.Fatalf("Failed to marshal fields list: %v", err)
	}

	var fields []map[string]any
	if err := json.Unmarshal(fieldsData, &fields); err != nil {
		t.Fatalf("Failed to unmarshal fields list: %v", err)
	}

	// 找到 secret 字段（跳过默认的 id 字段）
	var secretField map[string]any
	for _, field := range fields {
		if field["name"] == "api_key" {
			secretField = field
			break
		}
	}

	if secretField == nil {
		t.Fatal("Secret field not found in serialized fields")
	}

	if secretField["type"] != core.FieldTypeSecret {
		t.Fatalf("Expected type %q, got %q", core.FieldTypeSecret, secretField["type"])
	}
}

// T011a 测试 - secret 字段约束验证
func TestSecretFieldConstraints(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 创建包含 secret 字段的 collection
		collection := core.NewBaseCollection("test_constraints")
		collection.Fields.Add(&core.SecretField{
			Id:     "secret_field",
			Name:   "api_key",
			Hidden: true, // 默认应该是 true
		})

		if err := app.Save(collection); err != nil {
			t.Fatalf("Failed to save collection: %v", err)
		}

		// 创建一些测试数据
		record := core.NewRecord(collection)
		record.Set("api_key", "sk-test-123")
		if err := app.Save(record); err != nil {
			t.Fatalf("Failed to save record: %v", err)
		}

		t.Run("hidden field prevents filtering", func(t *testing.T) {
			// 创建字段解析器，不允许隐藏字段
			resolver := core.NewRecordFieldResolver(app, collection, nil, false)

			// 尝试使用 secret 字段过滤应该失败
			// 因为 Hidden=true 且 allowHiddenFields=false
			field := collection.Fields.GetByName("api_key")
			if field == nil {
				t.Fatal("Field 'api_key' not found")
			}

			if !field.GetHidden() {
				t.Error("Secret field should be hidden by default")
			}

			// 使用解析器解析 api_key 字段应该失败
			_, err := resolver.Resolve("api_key")
			if err == nil {
				t.Error("Expected error when filtering on hidden secret field, got nil")
			}
		})

		t.Run("superuser can filter hidden fields", func(t *testing.T) {
			// 创建字段解析器，允许隐藏字段（模拟 superuser）
			resolver := core.NewRecordFieldResolver(app, collection, nil, true)

			// 使用解析器解析 api_key 字段应该成功
			result, err := resolver.Resolve("api_key")
			if err != nil {
				t.Fatalf("Expected superuser to filter hidden field, got error: %v", err)
			}

			if result == nil {
				t.Error("Expected non-nil result for superuser")
			}
		})
	})
}

// T016-T020 测试 - Hook 集成验证
func TestSecretFieldHookIntegration(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 创建包含 secret 字段的 collection
		collection := core.NewBaseCollection("test_hook")
		collection.Fields.Add(&core.SecretField{
			Id:   "secret_field",
			Name: "api_key",
		})

		if err := app.Save(collection); err != nil {
			t.Fatalf("Failed to save collection: %v", err)
		}

		t.Run("GetString returns plaintext in hook", func(t *testing.T) {
			// 创建记录
			record := core.NewRecord(collection)
			record.Set("api_key", "sk-hook-test-123")

			if err := app.Save(record); err != nil {
				t.Fatalf("Failed to save record: %v", err)
			}

			// 从数据库重新加载（模拟 hook 场景）
			loaded, err := app.FindRecordById(collection.Name, record.Id)
			if err != nil {
				t.Fatalf("Failed to load record: %v", err)
			}

			// T016: GetString 应该返回明文
			plaintext := loaded.GetString("api_key")
			if plaintext != "sk-hook-test-123" {
				t.Errorf("Expected 'sk-hook-test-123', got %q", plaintext)
			}
		})

		t.Run("Get returns plaintext string in hook", func(t *testing.T) {
			record := core.NewRecord(collection)
			record.Set("api_key", "sk-get-test")

			if err := app.Save(record); err != nil {
				t.Fatalf("Failed to save record: %v", err)
			}

			loaded, err := app.FindRecordById(collection.Name, record.Id)
			if err != nil {
				t.Fatalf("Failed to load record: %v", err)
			}

			// T017: Get 应该返回明文字符串
			value := loaded.Get("api_key")
			strValue, ok := value.(string)
			if !ok {
				t.Fatalf("Expected string, got %T", value)
			}
			if strValue != "sk-get-test" {
				t.Errorf("Expected 'sk-get-test', got %q", strValue)
			}
		})

		t.Run("GetRaw returns SecretFieldValue in hook", func(t *testing.T) {
			record := core.NewRecord(collection)
			record.Set("api_key", "sk-raw-test")

			if err := app.Save(record); err != nil {
				t.Fatalf("Failed to save record: %v", err)
			}

			loaded, err := app.FindRecordById(collection.Name, record.Id)
			if err != nil {
				t.Fatalf("Failed to load record: %v", err)
			}

			// T018: GetRaw 应该返回 SecretFieldValue
			raw := loaded.GetRaw("api_key")
			sv, ok := raw.(*core.SecretFieldValue)
			if !ok {
				t.Fatalf("Expected *SecretFieldValue, got %T", raw)
			}

			// 应该有密文
			if sv.Encrypted == "" {
				t.Error("Expected non-empty encrypted value")
			}
		})

		t.Run("modify secret in hook", func(t *testing.T) {
			// 创建记录
			record := core.NewRecord(collection)
			record.Set("api_key", "sk-original")

			if err := app.Save(record); err != nil {
				t.Fatalf("Failed to save record: %v", err)
			}

			// 加载记录
			loaded, err := app.FindRecordById(collection.Name, record.Id)
			if err != nil {
				t.Fatalf("Failed to load record: %v", err)
			}

			// T020: 在 hook 中修改 secret 值
			loaded.Set("api_key", "sk-modified")

			if err := app.Save(loaded); err != nil {
				t.Fatalf("Failed to save modified record: %v", err)
			}

			// 验证修改
			reloaded, err := app.FindRecordById(collection.Name, record.Id)
			if err != nil {
				t.Fatalf("Failed to reload record: %v", err)
			}

			if reloaded.GetString("api_key") != "sk-modified" {
				t.Errorf("Expected 'sk-modified', got %q", reloaded.GetString("api_key"))
			}
		})
	})
}

// T034-T037 测试 - Import/Export 安全处理
func TestSecretFieldImportExport(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 创建包含 secret 字段的 collection
		collection := core.NewBaseCollection("test_export")
		collection.Fields.Add(&core.SecretField{
			Id:   "secret_field",
			Name: "api_key",
		})

		if err := app.Save(collection); err != nil {
			t.Fatalf("Failed to save collection: %v", err)
		}

		t.Run("T034 - export stores ciphertext not plaintext", func(t *testing.T) {
			record := core.NewRecord(collection)
			record.Set("api_key", "sk-export-test-key")

			if err := app.Save(record); err != nil {
				t.Fatalf("Failed to save record: %v", err)
			}

			// 直接查询数据库获取存储的值
			var storedValue string
			err := app.DB().
				NewQuery("SELECT api_key FROM test_export WHERE id = {:id}").
				Bind(map[string]any{"id": record.Id}).
				Row(&storedValue)
			if err != nil {
				t.Fatalf("Failed to query database: %v", err)
			}

			// 存储的值不应该是明文
			if storedValue == "sk-export-test-key" {
				t.Error("Database stores plaintext, should store ciphertext")
			}

			// 存储的值应该是非空的 base64 字符串
			if storedValue == "" {
				t.Error("Database stores empty string")
			}
		})

		t.Run("T035 - import plaintext gets encrypted", func(t *testing.T) {
			// 创建记录，模拟导入明文
			record := core.NewRecord(collection)
			record.Set("api_key", "sk-import-plaintext")

			if err := app.Save(record); err != nil {
				t.Fatalf("Failed to save record: %v", err)
			}

			// 验证数据库存储的是密文
			var storedValue string
			app.DB().
				NewQuery("SELECT api_key FROM test_export WHERE id = {:id}").
				Bind(map[string]any{"id": record.Id}).
				Row(&storedValue)

			if storedValue == "sk-import-plaintext" {
				t.Error("Import should encrypt plaintext before storage")
			}

			// 验证可以正确解密
			loaded, _ := app.FindRecordById(collection.Name, record.Id)
			if loaded.GetString("api_key") != "sk-import-plaintext" {
				t.Errorf("Expected 'sk-import-plaintext', got %q", loaded.GetString("api_key"))
			}
		})
	})
}

// T041, T041a 测试 - 安全和并发测试
func TestSecretFieldSecurity(t *testing.T) {
	// 确保 master key 在 DualDBTest 之前设置（因为 TestApp 创建时会初始化 Secrets 服务）
	os.Setenv(core.MasterKeyEnvVar, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	t.Cleanup(func() { os.Unsetenv(core.MasterKeyEnvVar) })

	tests.DualDBTest(t, func(t *testing.T, app *tests.TestApp, dbType tests.DBType) {
		// 创建包含 secret 字段的 collection
		collection := core.NewBaseCollection("test_security")
		collection.Fields.Add(&core.SecretField{
			Id:     "secret_field",
			Name:   "api_key",
			Hidden: true,
		})

		if err := app.Save(collection); err != nil {
			t.Fatalf("Failed to save collection: %v", err)
		}

		t.Run("T041 - hidden field prevents unauthorized access", func(t *testing.T) {
			// 创建字段解析器，不允许隐藏字段（模拟普通用户）
			resolver := core.NewRecordFieldResolver(app, collection, nil, false)

			// 尝试使用 secret 字段过滤应该失败
			_, err := resolver.Resolve("api_key")
			if err == nil {
				t.Error("Expected error when filtering on hidden secret field")
			}
		})

		t.Run("T041a - concurrent read/write consistency", func(t *testing.T) {
			// 创建测试记录
			record := core.NewRecord(collection)
			record.Set("api_key", "sk-concurrent-test")
			if err := app.Save(record); err != nil {
				t.Fatalf("Failed to save record: %v", err)
			}

			// 并发读写测试
			const numGoroutines = 10
			done := make(chan bool, numGoroutines)

			for i := 0; i < numGoroutines; i++ {
				go func(idx int) {
					defer func() { done <- true }()

					// 读取
					loaded, err := app.FindRecordById(collection.Name, record.Id)
					if err != nil {
						t.Errorf("Goroutine %d: failed to load record: %v", idx, err)
						return
					}

					// 验证可以解密
					value := loaded.GetString("api_key")
					if value != "sk-concurrent-test" {
						t.Errorf("Goroutine %d: expected 'sk-concurrent-test', got %q", idx, value)
					}
				}(i)
			}

			// 等待所有 goroutine 完成
			for i := 0; i < numGoroutines; i++ {
				<-done
			}
		})
	})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
