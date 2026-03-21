/**
 * OAuth2 Providers 注册测试 — 验证 35+ provider 都已正确注册
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Providers } from "./base_provider";
import { PROVIDER_NAMES, getRegisteredProviderNames } from "./providers";

// 确保 providers 模块被加载（side-effect import）
beforeAll(async () => {
  await import("./providers");
});

describe("OAuth2 Providers", () => {
  test("should have 32+ providers registered", () => {
    expect(Providers.size).toBeGreaterThanOrEqual(32);
  });

  test("PROVIDER_NAMES should match registered count", () => {
    expect(PROVIDER_NAMES.length).toBe(Providers.size);
  });

  test("getRegisteredProviderNames should return all names", () => {
    const names = getRegisteredProviderNames();
    expect(names.length).toBe(Providers.size);
  });

  // 逐个验证核心 providers
  const coreProviders = [
    { name: "google", displayName: "Google" },
    { name: "github", displayName: "GitHub" },
    { name: "apple", displayName: "Apple" },
    { name: "discord", displayName: "Discord" },
    { name: "facebook", displayName: "Facebook" },
    { name: "microsoft", displayName: "Microsoft" },
    { name: "gitlab", displayName: "GitLab" },
    { name: "twitter", displayName: "Twitter" },
    { name: "spotify", displayName: "Spotify" },
    { name: "twitch", displayName: "Twitch" },
  ];

  for (const { name, displayName } of coreProviders) {
    test(`${name} provider should be registered`, () => {
      const factory = Providers.get(name);
      expect(factory).toBeDefined();

      const provider = factory!();
      expect(provider.getDisplayName()).toBe(displayName);
    });
  }

  test("each provider should have proper URLs (except OIDC)", () => {
    for (const [name, factory] of Providers) {
      const provider = factory();

      // OIDC providers have empty URLs (user must configure)
      if (name.startsWith("oidc") || name === "mailcow") continue;

      expect(provider.getAuthURL()).toBeTruthy();
      expect(provider.getTokenURL()).toBeTruthy();
    }
  });

  test("google should have PKCE enabled", () => {
    const google = Providers.get("google")!();
    expect(google.getPKCE()).toBe(true);
  });

  test("github should have PKCE disabled", () => {
    const github = Providers.get("github")!();
    expect(github.getPKCE()).toBe(false);
  });

  test("google should have correct scopes", () => {
    const google = Providers.get("google")!();
    expect(google.getScopes()).toEqual(["openid", "email", "profile"]);
  });

  test("provider instances are independent", () => {
    const p1 = Providers.get("google")!();
    const p2 = Providers.get("google")!();
    p1.setClientId("client1");
    expect(p2.getClientId()).toBe("");
  });

  test("provider can set client credentials", () => {
    const google = Providers.get("google")!();
    google.setClientId("my_google_id");
    google.setClientSecret("my_google_secret");
    google.setRedirectURL("https://example.com/callback");

    expect(google.getClientId()).toBe("my_google_id");
    expect(google.getClientSecret()).toBe("my_google_secret");
    expect(google.getRedirectURL()).toBe("https://example.com/callback");
  });

  test("provider buildAuthURL works", () => {
    const google = Providers.get("google")!();
    google.setClientId("test_client");
    google.setRedirectURL("https://example.com/callback");

    const url = google.buildAuthURL("test_state");
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("client_id=test_client");
    expect(url).toContain("state=test_state");
  });
});
