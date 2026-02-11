/**
 * OAuth2 Provider 基类 — 与 Go 版 tools/auth/base_provider.go + auth.go 对齐
 *
 * 每个具体 provider 只需继承 BaseProvider 并实现 fetchAuthUser()
 */

import { createHash } from "node:crypto";

// ─── 类型定义 ───

/** 标准化的 OAuth2 用户信息（与 Go 版 AuthUser 对齐） */
export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarURL: string;
  accessToken: string;
  refreshToken: string;
  expiry?: Date;
  rawUser: Record<string, unknown>;
}

/** Provider 接口（与 Go 版 Provider interface 对齐） */
export interface Provider {
  getClientId(): string;
  setClientId(id: string): void;
  getClientSecret(): string;
  setClientSecret(secret: string): void;
  getRedirectURL(): string;
  setRedirectURL(url: string): void;
  getDisplayName(): string;
  setDisplayName(name: string): void;
  getAuthURL(): string;
  setAuthURL(url: string): void;
  getTokenURL(): string;
  setTokenURL(url: string): void;
  getUserInfoURL(): string;
  setUserInfoURL(url: string): void;
  getScopes(): string[];
  setScopes(scopes: string[]): void;
  getPKCE(): boolean;
  setPKCE(enabled: boolean): void;
  getExtra(): Record<string, string>;
  setExtra(extra: Record<string, string>): void;
  buildAuthURL(state: string, codeVerifier?: string): string;
  fetchAuthUser(token: unknown): Promise<AuthUser>;
}

// ─── 全局 Provider 注册表（与 Go 版 Providers map 对齐） ───

export const Providers = new Map<string, () => Provider>();

// ─── PKCE 辅助 ───

/** 生成 S256 code_challenge */
function s256Challenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64url");
}

// ─── BaseProvider 抽象类 ───

export abstract class BaseProvider implements Provider {
  private _clientId: string = "";
  private _clientSecret: string = "";
  private _redirectURL: string = "";
  private _displayName: string = "";
  private _authURL: string = "";
  private _tokenURL: string = "";
  private _userInfoURL: string = "";
  private _scopes: string[] = [];
  private _pkce: boolean = false;
  private _extra: Record<string, string> = {};

  // ─── Getters/Setters ───

  getClientId(): string { return this._clientId; }
  setClientId(id: string): void { this._clientId = id; }

  getClientSecret(): string { return this._clientSecret; }
  setClientSecret(secret: string): void { this._clientSecret = secret; }

  getRedirectURL(): string { return this._redirectURL; }
  setRedirectURL(url: string): void { this._redirectURL = url; }

  getDisplayName(): string { return this._displayName; }
  setDisplayName(name: string): void { this._displayName = name; }

  getAuthURL(): string { return this._authURL; }
  setAuthURL(url: string): void { this._authURL = url; }

  getTokenURL(): string { return this._tokenURL; }
  setTokenURL(url: string): void { this._tokenURL = url; }

  getUserInfoURL(): string { return this._userInfoURL; }
  setUserInfoURL(url: string): void { this._userInfoURL = url; }

  getScopes(): string[] { return [...this._scopes]; }
  setScopes(scopes: string[]): void { this._scopes = [...scopes]; }

  getPKCE(): boolean { return this._pkce; }
  setPKCE(enabled: boolean): void { this._pkce = enabled; }

  getExtra(): Record<string, string> { return { ...this._extra }; }
  setExtra(extra: Record<string, string>): void { this._extra = { ...extra }; }

  // ─── buildAuthURL ───

  buildAuthURL(state: string, codeVerifier?: string): string {
    const url = new URL(this._authURL);
    const params = url.searchParams;

    params.set("client_id", this._clientId);
    params.set("redirect_uri", this._redirectURL);
    params.set("response_type", "code");
    params.set("state", state);

    if (this._scopes.length > 0) {
      params.set("scope", this._scopes.join(" "));
    }

    // PKCE S256
    if (this._pkce && codeVerifier) {
      params.set("code_challenge", s256Challenge(codeVerifier));
      params.set("code_challenge_method", "S256");
    }

    // Extra params
    for (const [key, value] of Object.entries(this._extra)) {
      params.set(key, value);
    }

    return url.toString();
  }

  // ─── 抽象方法：每个 provider 必须实现 ───

  abstract fetchAuthUser(token: unknown): Promise<AuthUser>;

  // ─── fetchRawUserInfo（通用实现） ───

  async fetchRawUserInfo(accessToken: string): Promise<Record<string, unknown>> {
    const res = await fetch(this._userInfoURL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch user info: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }
}
