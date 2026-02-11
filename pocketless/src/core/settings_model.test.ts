/**
 * settings_model.test.ts — T103 Settings model
 * 对照 Go 版 core/settings_model_test.go
 */
import { describe, test, expect } from "bun:test";
import {
  Settings,
  newDefaultSettings,
  type SMTPConfig,
  type S3Config,
  type MetaConfig,
  type LogsConfig,
  type BackupsConfig,
  type BatchConfig,
  type RateLimitsConfig,
  type TrustedProxyConfig,
  type AnalyticsSettingsConfig,
  PARAMS_TABLE,
  PARAMS_KEY_SETTINGS,
} from "./settings_model";

describe("Settings 常量", () => {
  test("表名和键名", () => {
    expect(PARAMS_TABLE).toBe("_params");
    expect(PARAMS_KEY_SETTINGS).toBe("settings");
  });
});

describe("newDefaultSettings", () => {
  test("返回带默认值的 Settings 实例", () => {
    const s = newDefaultSettings();
    expect(s).toBeInstanceOf(Settings);
    expect(s.isNew).toBe(true);

    // Meta 默认值
    expect(s.meta.appName).toBe("Acme");
    expect(s.meta.appURL).toBe("http://localhost:8090");
    expect(s.meta.senderName).toBe("Support");
    expect(s.meta.senderAddress).toBe("support@example.com");
    expect(s.meta.hideControls).toBe(false);

    // Logs 默认值
    expect(s.logs.maxDays).toBe(5);
    expect(s.logs.logIP).toBe(true);

    // SMTP 默认值
    expect(s.smtp.enabled).toBe(false);
    expect(s.smtp.host).toBe("smtp.example.com");
    expect(s.smtp.port).toBe(587);

    // Backups 默认值
    expect(s.backups.cronMaxKeep).toBe(3);

    // Batch 默认值
    expect(s.batch.enabled).toBe(false);
    expect(s.batch.maxRequests).toBe(50);
    expect(s.batch.timeout).toBe(3);

    // Analytics 默认值
    expect(s.analytics.enabled).toBe(true);
    expect(s.analytics.retention).toBe(90);

    // RateLimits 默认值
    expect(s.rateLimits.enabled).toBe(false);
    expect(s.rateLimits.rules.length).toBe(4);
  });
});

describe("Settings Model 接口", () => {
  test("tableName", () => {
    const s = newDefaultSettings();
    expect(s.tableName()).toBe("_params");
  });

  test("pk 和 lastSavedPK 返回 settings", () => {
    const s = newDefaultSettings();
    expect(s.pk()).toBe("settings");
    expect(s.lastSavedPK()).toBe("settings");
  });

  test("isNew / markAsNew / markAsNotNew", () => {
    const s = newDefaultSettings();
    expect(s.isNew).toBe(true);

    s.markAsNotNew();
    expect(s.isNew).toBe(false);

    s.markAsNew();
    expect(s.isNew).toBe(true);
  });

  test("postScan 标记为非 new", () => {
    const s = newDefaultSettings();
    expect(s.isNew).toBe(true);

    s.postScan();
    expect(s.isNew).toBe(false);
  });
});

describe("Settings 序列化", () => {
  test("toJSON 输出与 Go 版格式一致", () => {
    const s = newDefaultSettings();
    const json = s.toJSON();

    // 应包含所有顶级配置
    expect(json).toHaveProperty("smtp");
    expect(json).toHaveProperty("backups");
    expect(json).toHaveProperty("s3");
    expect(json).toHaveProperty("meta");
    expect(json).toHaveProperty("rateLimits");
    expect(json).toHaveProperty("trustedProxy");
    expect(json).toHaveProperty("batch");
    expect(json).toHaveProperty("logs");
    expect(json).toHaveProperty("analytics");
  });

  test("toJSON 掩码敏感字段", () => {
    const s = newDefaultSettings();
    s.smtp.password = "secret123";
    s.s3.secret = "s3secret";
    s.backups.s3.secret = "backupS3secret";

    const json = s.toJSON();
    expect(json.smtp.password).toBe("");
    expect(json.s3.secret).toBe("");
    expect(json.backups.s3.secret).toBe("");
  });

  test("toJSON 空密码不影响", () => {
    const s = newDefaultSettings();
    const json = s.toJSON();
    expect(json.smtp.password).toBe("");
    expect(json.s3.secret).toBe("");
  });

  test("toString 返回 JSON 字符串", () => {
    const s = newDefaultSettings();
    const str = s.toString();
    const parsed = JSON.parse(str);
    expect(parsed.meta.appName).toBe("Acme");
  });
});

describe("Settings merge & clone", () => {
  test("merge 合并另一个 Settings", () => {
    const s1 = newDefaultSettings();
    const s2 = newDefaultSettings();
    s2.meta.appName = "TestApp";
    s2.smtp.port = 465;

    s1.merge(s2);

    expect(s1.meta.appName).toBe("TestApp");
    expect(s1.smtp.port).toBe(465);
    // 其他未修改的保持默认
    expect(s1.meta.appURL).toBe("http://localhost:8090");
  });

  test("clone 深拷贝", () => {
    const s = newDefaultSettings();
    s.meta.appName = "Original";

    const cloned = s.clone();
    expect(cloned.meta.appName).toBe("Original");

    // 修改原始不影响克隆
    s.meta.appName = "Changed";
    expect(cloned.meta.appName).toBe("Original");
  });
});

describe("Settings DBExport", () => {
  test("新 Settings 包含 created 字段", () => {
    const s = newDefaultSettings();
    const exported = s.dbExport();

    expect(exported.id).toBe("settings");
    expect(exported.created).toBeDefined();
    expect(exported.updated).toBeDefined();
    expect(exported.value).toBeDefined();

    // value 应该是 JSON 字符串
    const parsed = JSON.parse(exported.value as string);
    expect(parsed.meta.appName).toBe("Acme");
  });

  test("非 new Settings 不含 created 字段", () => {
    const s = newDefaultSettings();
    s.markAsNotNew();
    const exported = s.dbExport();

    expect(exported.id).toBe("settings");
    expect(exported.created).toBeUndefined();
    expect(exported.updated).toBeDefined();
  });

  test("带加密键的 DBExport", () => {
    const s = newDefaultSettings();
    const key = "abcdabcdabcdabcdabcdabcdabcdabcd"; // 32 字节
    const exported = s.dbExport(key);

    // 加密后的 value 应该是 base64 字符串，而非 JSON
    expect(typeof exported.value).toBe("string");
    // 不应该能直接 JSON.parse
    expect(() => JSON.parse(exported.value as string)).toThrow();
  });
});

describe("Settings loadFromParam", () => {
  test("从纯文本 value 加载", () => {
    const s = newDefaultSettings();
    const json = JSON.stringify({
      smtp: { enabled: true, host: "mail.test.com", port: 465, username: "", password: "", authMethod: "", tls: false, localName: "" },
      backups: { cron: "", cronMaxKeep: 5, s3: { enabled: false, bucket: "", region: "", endpoint: "", accessKey: "", secret: "", forcePathStyle: false } },
      s3: { enabled: false, bucket: "", region: "", endpoint: "", accessKey: "", secret: "", forcePathStyle: false },
      meta: { appName: "Loaded", appURL: "http://example.com", senderName: "Test", senderAddress: "test@test.com", hideControls: false },
      rateLimits: { enabled: false, rules: [] },
      trustedProxy: { headers: [], useLeftmostIP: false },
      batch: { enabled: false, maxRequests: 10, timeout: 5, maxBodySize: 0 },
      logs: { maxDays: 10, minLevel: 0, logIP: false, logAuthId: false },
      analytics: { enabled: false, retention: 30, s3Bucket: "" },
    });

    s.loadFromParam(json);
    expect(s.meta.appName).toBe("Loaded");
    expect(s.smtp.enabled).toBe(true);
    expect(s.smtp.host).toBe("mail.test.com");
    expect(s.logs.maxDays).toBe(10);
  });

  test("从加密 value 加载", () => {
    // 先加密一个 Settings
    const original = newDefaultSettings();
    original.meta.appName = "Encrypted";
    const key = "abcdabcdabcdabcdabcdabcdabcdabcd";
    const exported = original.dbExport(key);

    // 用新 Settings 加载
    const loaded = newDefaultSettings();
    loaded.loadFromParam(exported.value as string, key);
    expect(loaded.meta.appName).toBe("Encrypted");
  });
});

describe("RateLimitRule 默认规则", () => {
  test("默认 4 条规则", () => {
    const s = newDefaultSettings();
    const rules = s.rateLimits.rules;

    expect(rules.length).toBe(4);
    expect(rules[0].label).toBe("*:auth");
    expect(rules[0].maxRequests).toBe(2);
    expect(rules[0].duration).toBe(3);

    expect(rules[1].label).toBe("*:create");
    expect(rules[1].maxRequests).toBe(20);
    expect(rules[1].duration).toBe(5);

    expect(rules[2].label).toBe("/api/batch");
    expect(rules[2].maxRequests).toBe(3);
    expect(rules[2].duration).toBe(1);

    expect(rules[3].label).toBe("/api/");
    expect(rules[3].maxRequests).toBe(300);
    expect(rules[3].duration).toBe(10);
  });
});
