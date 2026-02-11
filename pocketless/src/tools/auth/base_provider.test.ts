/**
 * OAuth2 BaseProvider 测试 — 对照 Go 版 tools/auth/base_provider_test.go
 * TDD RED phase
 */

import { describe, test, expect } from "bun:test";
import {
  BaseProvider,
  type AuthUser,
  type Provider,
  Providers,
} from "./base_provider";

// ─── 测试用 concrete provider ───

class TestProvider extends BaseProvider {
  constructor() {
    super();
    this.setDisplayName("Test");
    this.setAuthURL("https://test.example.com/auth");
    this.setTokenURL("https://test.example.com/token");
    this.setUserInfoURL("https://test.example.com/userinfo");
  }

  async fetchAuthUser(_token: unknown): Promise<AuthUser> {
    return {
      id: "test123",
      name: "Test User",
      username: "testuser",
      email: "test@example.com",
      avatarURL: "",
      accessToken: "access_token",
      refreshToken: "",
      rawUser: {},
    };
  }
}

// ─── Getter/Setter 测试 ───

describe("BaseProvider getters/setters", () => {
  test("clientId", () => {
    const p = new TestProvider();
    expect(p.getClientId()).toBe("");
    p.setClientId("my_client_id");
    expect(p.getClientId()).toBe("my_client_id");
  });

  test("clientSecret", () => {
    const p = new TestProvider();
    expect(p.getClientSecret()).toBe("");
    p.setClientSecret("my_secret");
    expect(p.getClientSecret()).toBe("my_secret");
  });

  test("redirectURL", () => {
    const p = new TestProvider();
    expect(p.getRedirectURL()).toBe("");
    p.setRedirectURL("https://example.com/callback");
    expect(p.getRedirectURL()).toBe("https://example.com/callback");
  });

  test("displayName", () => {
    const p = new TestProvider();
    expect(p.getDisplayName()).toBe("Test");
    p.setDisplayName("Custom Name");
    expect(p.getDisplayName()).toBe("Custom Name");
  });

  test("authURL", () => {
    const p = new TestProvider();
    expect(p.getAuthURL()).toBe("https://test.example.com/auth");
    p.setAuthURL("https://custom.example.com/auth");
    expect(p.getAuthURL()).toBe("https://custom.example.com/auth");
  });

  test("tokenURL", () => {
    const p = new TestProvider();
    expect(p.getTokenURL()).toBe("https://test.example.com/token");
    p.setTokenURL("https://custom.example.com/token");
    expect(p.getTokenURL()).toBe("https://custom.example.com/token");
  });

  test("userInfoURL", () => {
    const p = new TestProvider();
    expect(p.getUserInfoURL()).toBe("https://test.example.com/userinfo");
    p.setUserInfoURL("https://custom.example.com/userinfo");
    expect(p.getUserInfoURL()).toBe("https://custom.example.com/userinfo");
  });

  test("scopes", () => {
    const p = new TestProvider();
    expect(p.getScopes()).toEqual([]);
    p.setScopes(["email", "profile"]);
    expect(p.getScopes()).toEqual(["email", "profile"]);
  });

  test("pkce", () => {
    const p = new TestProvider();
    expect(p.getPKCE()).toBe(false);
    p.setPKCE(true);
    expect(p.getPKCE()).toBe(true);
  });

  test("extra", () => {
    const p = new TestProvider();
    expect(p.getExtra()).toEqual({});
    p.setExtra({ param1: "value1" });
    expect(p.getExtra()).toEqual({ param1: "value1" });
  });
});

// ─── buildAuthURL 测试 ───

describe("BaseProvider.buildAuthURL", () => {
  test("should produce valid authorization URL", () => {
    const p = new TestProvider();
    p.setClientId("test_client");
    p.setRedirectURL("https://example.com/callback");
    p.setScopes(["email", "profile"]);

    const url = p.buildAuthURL("test_state", "test_verifier");
    expect(url).toContain("https://test.example.com/auth");
    expect(url).toContain("client_id=test_client");
    expect(url).toContain("state=test_state");
    expect(url).toContain("response_type=code");
  });

  test("should include redirect_uri", () => {
    const p = new TestProvider();
    p.setClientId("test_client");
    p.setRedirectURL("https://example.com/callback");

    const url = p.buildAuthURL("state123");
    expect(url).toContain("redirect_uri=");
  });

  test("should include scope", () => {
    const p = new TestProvider();
    p.setClientId("test_client");
    p.setScopes(["email", "profile"]);
    p.setRedirectURL("https://example.com/callback");

    const url = p.buildAuthURL("state123");
    expect(url).toContain("scope=");
  });

  test("PKCE enabled should include code_challenge", () => {
    const p = new TestProvider();
    p.setClientId("test_client");
    p.setRedirectURL("https://example.com/callback");
    p.setPKCE(true);

    const url = p.buildAuthURL("state123", "test_verifier");
    expect(url).toContain("code_challenge");
    expect(url).toContain("code_challenge_method=S256");
  });
});

// ─── fetchAuthUser 测试 ───

describe("TestProvider.fetchAuthUser", () => {
  test("should return AuthUser", async () => {
    const p = new TestProvider();
    const user = await p.fetchAuthUser({});
    expect(user.id).toBe("test123");
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("test@example.com");
  });
});

// ─── Provider 注册表测试 ───

describe("Providers registry", () => {
  test("registry is a Map", () => {
    expect(Providers).toBeInstanceOf(Map);
  });

  test("can register and retrieve provider factory", () => {
    Providers.set("test", () => new TestProvider());
    const factory = Providers.get("test");
    expect(factory).toBeDefined();

    const provider = factory!();
    expect(provider.getDisplayName()).toBe("Test");
  });

  test("unknown provider returns undefined", () => {
    expect(Providers.get("nonexistent")).toBeUndefined();
  });
});
