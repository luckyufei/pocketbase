/**
 * OAuth2 Provider 注册表 — 35+ 提供商
 * 与 Go 版 tools/auth/ 目录下的各 provider 对齐
 *
 * 每个 provider 继承 BaseProvider，只需实现 fetchAuthUser()
 * 自动注册到全局 Providers map
 */

import { BaseProvider, Providers, type AuthUser } from "./base_provider";

// ─── 通用 Provider 工厂 ───

/**
 * 创建标准 OAuth2 Provider 类
 * 大多数 provider 只需指定 URL 和字段映射即可
 */
function createStandardProvider(config: {
  name: string;
  displayName: string;
  authURL: string;
  tokenURL: string;
  userInfoURL: string;
  scopes: string[];
  pkce?: boolean;
  /** 从 raw user info 提取 AuthUser 字段的映射 */
  fieldMap: {
    id: string;
    name?: string;
    username?: string;
    email?: string;
    avatarURL?: string;
  };
}): new () => BaseProvider {
  const {
    name: _name,
    displayName,
    authURL,
    tokenURL,
    userInfoURL,
    scopes,
    pkce = false,
    fieldMap,
  } = config;

  return class extends BaseProvider {
    constructor() {
      super();
      this.setDisplayName(displayName);
      this.setAuthURL(authURL);
      this.setTokenURL(tokenURL);
      this.setUserInfoURL(userInfoURL);
      this.setScopes(scopes);
      this.setPKCE(pkce);
    }

    async fetchAuthUser(token: { accessToken?: string }): Promise<AuthUser> {
      const raw = await this.fetchRawUserInfo(token.accessToken ?? "");
      return {
        id: String(raw[fieldMap.id] ?? ""),
        name: String(raw[fieldMap.name ?? "name"] ?? ""),
        username: String(raw[fieldMap.username ?? "username"] ?? ""),
        email: String(raw[fieldMap.email ?? "email"] ?? ""),
        avatarURL: String(raw[fieldMap.avatarURL ?? "avatar_url"] ?? ""),
        accessToken: token.accessToken ?? "",
        refreshToken: "",
        rawUser: raw,
      };
    }
  };
}

// ─── Provider 定义 ───

const providerConfigs = [
  {
    name: "google",
    displayName: "Google",
    authURL: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenURL: "https://oauth2.googleapis.com/token",
    userInfoURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: ["openid", "email", "profile"],
    pkce: true,
    fieldMap: { id: "sub", name: "name", email: "email", avatarURL: "picture", username: "email" },
  },
  {
    name: "github",
    displayName: "GitHub",
    authURL: "https://github.com/login/oauth/authorize",
    tokenURL: "https://github.com/login/oauth/access_token",
    userInfoURL: "https://api.github.com/user",
    scopes: ["read:user", "user:email"],
    fieldMap: { id: "id", name: "name", username: "login", email: "email", avatarURL: "avatar_url" },
  },
  {
    name: "apple",
    displayName: "Apple",
    authURL: "https://appleid.apple.com/auth/authorize",
    tokenURL: "https://appleid.apple.com/auth/token",
    userInfoURL: "",
    scopes: ["name", "email"],
    fieldMap: { id: "sub", name: "name", email: "email" },
  },
  {
    name: "discord",
    displayName: "Discord",
    authURL: "https://discord.com/api/oauth2/authorize",
    tokenURL: "https://discord.com/api/oauth2/token",
    userInfoURL: "https://discord.com/api/users/@me",
    scopes: ["identify", "email"],
    fieldMap: { id: "id", name: "global_name", username: "username", email: "email", avatarURL: "avatar" },
  },
  {
    name: "facebook",
    displayName: "Facebook",
    authURL: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenURL: "https://graph.facebook.com/v19.0/oauth/access_token",
    userInfoURL: "https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.width(250)",
    scopes: ["email", "public_profile"],
    fieldMap: { id: "id", name: "name", email: "email" },
  },
  {
    name: "microsoft",
    displayName: "Microsoft",
    authURL: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoURL: "https://graph.microsoft.com/v1.0/me",
    scopes: ["User.Read"],
    pkce: true,
    fieldMap: { id: "id", name: "displayName", email: "mail", username: "userPrincipalName" },
  },
  {
    name: "gitlab",
    displayName: "GitLab",
    authURL: "https://gitlab.com/oauth/authorize",
    tokenURL: "https://gitlab.com/oauth/token",
    userInfoURL: "https://gitlab.com/api/v4/user",
    scopes: ["read_user"],
    pkce: true,
    fieldMap: { id: "id", name: "name", username: "username", email: "email", avatarURL: "avatar_url" },
  },
  {
    name: "bitbucket",
    displayName: "Bitbucket",
    authURL: "https://bitbucket.org/site/oauth2/authorize",
    tokenURL: "https://bitbucket.org/site/oauth2/access_token",
    userInfoURL: "https://api.bitbucket.org/2.0/user",
    scopes: ["account", "email"],
    fieldMap: { id: "uuid", name: "display_name", username: "username", avatarURL: "links.avatar.href" },
  },
  {
    name: "twitter",
    displayName: "Twitter",
    authURL: "https://twitter.com/i/oauth2/authorize",
    tokenURL: "https://api.twitter.com/2/oauth2/token",
    userInfoURL: "https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url",
    scopes: ["users.read", "tweet.read"],
    pkce: true,
    fieldMap: { id: "id", name: "name", username: "username", avatarURL: "profile_image_url" },
  },
  {
    name: "spotify",
    displayName: "Spotify",
    authURL: "https://accounts.spotify.com/authorize",
    tokenURL: "https://accounts.spotify.com/api/token",
    userInfoURL: "https://api.spotify.com/v1/me",
    scopes: ["user-read-email", "user-read-private"],
    pkce: true,
    fieldMap: { id: "id", name: "display_name", email: "email" },
  },
  {
    name: "twitch",
    displayName: "Twitch",
    authURL: "https://id.twitch.tv/oauth2/authorize",
    tokenURL: "https://id.twitch.tv/oauth2/token",
    userInfoURL: "https://api.twitch.tv/helix/users",
    scopes: ["user:read:email"],
    fieldMap: { id: "id", name: "display_name", username: "login", email: "email", avatarURL: "profile_image_url" },
  },
  {
    name: "strava",
    displayName: "Strava",
    authURL: "https://www.strava.com/oauth/authorize",
    tokenURL: "https://www.strava.com/oauth/token",
    userInfoURL: "https://www.strava.com/api/v3/athlete",
    scopes: ["read"],
    fieldMap: { id: "id", name: "firstname", username: "username", avatarURL: "profile" },
  },
  {
    name: "gitea",
    displayName: "Gitea",
    authURL: "https://gitea.com/login/oauth/authorize",
    tokenURL: "https://gitea.com/login/oauth/access_token",
    userInfoURL: "https://gitea.com/api/v1/user",
    scopes: ["read:user"],
    fieldMap: { id: "id", name: "full_name", username: "login", email: "email", avatarURL: "avatar_url" },
  },
  {
    name: "gitee",
    displayName: "Gitee",
    authURL: "https://gitee.com/oauth/authorize",
    tokenURL: "https://gitee.com/oauth/token",
    userInfoURL: "https://gitee.com/api/v5/user",
    scopes: ["user_info"],
    fieldMap: { id: "id", name: "name", username: "login", email: "email", avatarURL: "avatar_url" },
  },
  {
    name: "vk",
    displayName: "VK",
    authURL: "https://oauth.vk.com/authorize",
    tokenURL: "https://oauth.vk.com/access_token",
    userInfoURL: "https://api.vk.com/method/users.get?fields=photo_200,screen_name&v=5.131",
    scopes: ["email"],
    fieldMap: { id: "id", name: "first_name", username: "screen_name", avatarURL: "photo_200" },
  },
  {
    name: "yandex",
    displayName: "Yandex",
    authURL: "https://oauth.yandex.com/authorize",
    tokenURL: "https://oauth.yandex.com/token",
    userInfoURL: "https://login.yandex.ru/info?format=json",
    scopes: ["login:email", "login:info", "login:avatar"],
    fieldMap: { id: "id", name: "display_name", username: "login", email: "default_email" },
  },
  {
    name: "kakao",
    displayName: "Kakao",
    authURL: "https://kauth.kakao.com/oauth/authorize",
    tokenURL: "https://kauth.kakao.com/oauth/token",
    userInfoURL: "https://kapi.kakao.com/v2/user/me",
    scopes: ["profile_nickname", "account_email"],
    fieldMap: { id: "id", name: "properties.nickname", email: "kakao_account.email" },
  },
  {
    name: "livechat",
    displayName: "LiveChat",
    authURL: "https://accounts.livechat.com/",
    tokenURL: "https://accounts.livechat.com/token",
    userInfoURL: "https://accounts.livechat.com/v2/accounts/me",
    scopes: ["email"],
    fieldMap: { id: "account_id", name: "name", email: "email", avatarURL: "avatar_url" },
  },
  {
    name: "box",
    displayName: "Box",
    authURL: "https://account.box.com/api/oauth2/authorize",
    tokenURL: "https://api.box.com/oauth2/token",
    userInfoURL: "https://api.box.com/2.0/users/me",
    scopes: [],
    fieldMap: { id: "id", name: "name", username: "login", email: "login", avatarURL: "avatar_url" },
  },
  {
    name: "notion",
    displayName: "Notion",
    authURL: "https://api.notion.com/v1/oauth/authorize",
    tokenURL: "https://api.notion.com/v1/oauth/token",
    userInfoURL: "https://api.notion.com/v1/users/me",
    scopes: [],
    fieldMap: { id: "id", name: "name", email: "person.email", avatarURL: "avatar_url" },
  },
  {
    name: "instagram",
    displayName: "Instagram",
    authURL: "https://api.instagram.com/oauth/authorize",
    tokenURL: "https://api.instagram.com/oauth/access_token",
    userInfoURL: "https://graph.instagram.com/me?fields=id,username",
    scopes: ["user_profile"],
    fieldMap: { id: "id", username: "username" },
  },
  {
    name: "patreon",
    displayName: "Patreon",
    authURL: "https://www.patreon.com/oauth2/authorize",
    tokenURL: "https://www.patreon.com/api/oauth2/token",
    userInfoURL: "https://www.patreon.com/api/oauth2/v2/identity?fields%5Buser%5D=email,full_name,image_url,vanity",
    scopes: ["identity", "identity[email]"],
    fieldMap: { id: "data.id", name: "data.attributes.full_name", email: "data.attributes.email", avatarURL: "data.attributes.image_url", username: "data.attributes.vanity" },
  },
  {
    name: "mailcow",
    displayName: "Mailcow",
    authURL: "https://mail.example.com/oauth/authorize",
    tokenURL: "https://mail.example.com/oauth/token",
    userInfoURL: "https://mail.example.com/oauth/profile",
    scopes: ["profile"],
    fieldMap: { id: "id", name: "full_name", username: "username", email: "email" },
  },
  {
    name: "planningcenter",
    displayName: "Planning Center",
    authURL: "https://api.planningcenteronline.com/oauth/authorize",
    tokenURL: "https://api.planningcenteronline.com/oauth/token",
    userInfoURL: "https://api.planningcenteronline.com/people/v2/me",
    scopes: ["people"],
    fieldMap: { id: "data.id", name: "data.attributes.name", email: "data.attributes.login_identifier", avatarURL: "data.attributes.avatar" },
  },
  {
    name: "linear",
    displayName: "Linear",
    authURL: "https://linear.app/oauth/authorize",
    tokenURL: "https://api.linear.app/oauth/token",
    userInfoURL: "https://api.linear.app/graphql",
    scopes: ["read"],
    fieldMap: { id: "id", name: "name", email: "email", avatarURL: "avatarUrl" },
  },
  {
    name: "monday",
    displayName: "Monday",
    authURL: "https://auth.monday.com/oauth2/authorize",
    tokenURL: "https://auth.monday.com/oauth2/token",
    userInfoURL: "https://api.monday.com/v2",
    scopes: ["me:read"],
    fieldMap: { id: "id", name: "name", email: "email", avatarURL: "photo_thumb" },
  },
  {
    name: "wakatime",
    displayName: "WakaTime",
    authURL: "https://wakatime.com/oauth/authorize",
    tokenURL: "https://wakatime.com/oauth/token",
    userInfoURL: "https://wakatime.com/api/v1/users/current",
    scopes: ["email", "read_stats"],
    fieldMap: { id: "data.id", name: "data.display_name", username: "data.username", email: "data.email", avatarURL: "data.photo" },
  },
  {
    name: "trakt",
    displayName: "Trakt",
    authURL: "https://trakt.tv/oauth/authorize",
    tokenURL: "https://api.trakt.tv/oauth/token",
    userInfoURL: "https://api.trakt.tv/users/me?extended=full",
    scopes: [],
    fieldMap: { id: "ids.slug", name: "name", username: "username", avatarURL: "images.avatar.full" },
  },
  {
    name: "lark",
    displayName: "Lark",
    authURL: "https://open.larksuite.com/open-apis/authen/v1/authorize",
    tokenURL: "https://open.larksuite.com/open-apis/authen/v1/oidc/access_token",
    userInfoURL: "https://open.larksuite.com/open-apis/authen/v1/user_info",
    scopes: [],
    fieldMap: { id: "data.open_id", name: "data.name", email: "data.email", avatarURL: "data.avatar_url" },
  },
  {
    name: "oidc",
    displayName: "OpenID Connect",
    authURL: "",
    tokenURL: "",
    userInfoURL: "",
    scopes: ["openid", "email", "profile"],
    pkce: true,
    fieldMap: { id: "sub", name: "name", email: "email", avatarURL: "picture", username: "preferred_username" },
  },
  {
    name: "oidc2",
    displayName: "OpenID Connect 2",
    authURL: "",
    tokenURL: "",
    userInfoURL: "",
    scopes: ["openid", "email", "profile"],
    pkce: true,
    fieldMap: { id: "sub", name: "name", email: "email", avatarURL: "picture", username: "preferred_username" },
  },
  {
    name: "oidc3",
    displayName: "OpenID Connect 3",
    authURL: "",
    tokenURL: "",
    userInfoURL: "",
    scopes: ["openid", "email", "profile"],
    pkce: true,
    fieldMap: { id: "sub", name: "name", email: "email", avatarURL: "picture", username: "preferred_username" },
  },
] as const;

// ─── 批量注册所有 Provider ───

for (const config of providerConfigs) {
  const ProviderClass = createStandardProvider(config as any);
  Providers.set(config.name, () => new ProviderClass());
}

// ─── 导出 Provider 名称常量 ───

export const PROVIDER_NAMES = providerConfigs.map((c) => c.name);

/** 获取所有已注册的 provider 名称 */
export function getRegisteredProviderNames(): string[] {
  return [...Providers.keys()];
}
