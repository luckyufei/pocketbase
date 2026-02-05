/**
 * OAuth2 Providers 配置
 * OAuth2 提供商列表和工具函数
 * 
 * Phase 0.13: 补充缺失的 OAuth2 提供商，与 UI (Svelte) 版本保持一致
 */

export interface OAuth2Provider {
  name: string
  displayName: string
  icon?: string
  logo?: string  // SVG 文件名
  authUrl?: string
  tokenUrl?: string
  userApiUrl?: string
  scopes?: string[]
  pkce?: boolean
  optionsComponent?: string
}

export interface ProviderConfig {
  clientId?: string
  clientSecret?: string
  authUrl?: string
  tokenUrl?: string
  userApiUrl?: string
  displayName?: string
  enabled?: boolean
}

/**
 * 支持的 OAuth2 提供商列表
 * 与 UI (Svelte) 版本保持一致
 */
export const OAUTH2_PROVIDERS: OAuth2Provider[] = [
  // 主流提供商
  {
    name: 'apple',
    displayName: 'Apple',
    icon: 'apple',
    logo: 'apple.svg',
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    scopes: ['name', 'email'],
    pkce: true,
    optionsComponent: 'AppleOptions',
  },
  {
    name: 'google',
    displayName: 'Google',
    icon: 'google',
    logo: 'google.svg',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userApiUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
    pkce: true,
  },
  {
    name: 'microsoft',
    displayName: 'Microsoft',
    icon: 'microsoft',
    logo: 'microsoft.svg',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userApiUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    pkce: true,
    optionsComponent: 'MicrosoftOptions',
  },
  {
    name: 'yandex',
    displayName: 'Yandex',
    icon: 'yandex',
    logo: 'yandex.svg',
    authUrl: 'https://oauth.yandex.com/authorize',
    tokenUrl: 'https://oauth.yandex.com/token',
    userApiUrl: 'https://login.yandex.ru/info',
    scopes: ['login:email', 'login:info'],
  },
  {
    name: 'facebook',
    displayName: 'Facebook',
    icon: 'facebook',
    logo: 'facebook.svg',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userApiUrl: 'https://graph.facebook.com/v18.0/me',
    scopes: ['email', 'public_profile'],
  },
  {
    name: 'instagram2',
    displayName: 'Instagram',
    icon: 'instagram',
    logo: 'instagram.svg',
  },
  // 开发者平台
  {
    name: 'github',
    displayName: 'GitHub',
    icon: 'github',
    logo: 'github.svg',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userApiUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
  },
  {
    name: 'gitlab',
    displayName: 'GitLab',
    icon: 'gitlab',
    logo: 'gitlab.svg',
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    userApiUrl: 'https://gitlab.com/api/v4/user',
    scopes: ['read_user'],
    optionsComponent: 'SelfHostedOptions',
  },
  {
    name: 'bitbucket',
    displayName: 'Bitbucket',
    icon: 'bitbucket',
    logo: 'bitbucket.svg',
    authUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    userApiUrl: 'https://api.bitbucket.org/2.0/user',
    scopes: ['account', 'email'],
  },
  {
    name: 'gitee',
    displayName: 'Gitee',
    icon: 'gitee',
    logo: 'gitee.svg',
  },
  {
    name: 'gitea',
    displayName: 'Gitea',
    icon: 'gitea',
    logo: 'gitea.svg',
    optionsComponent: 'SelfHostedOptions',
  },
  // 社交平台
  {
    name: 'discord',
    displayName: 'Discord',
    icon: 'discord',
    logo: 'discord.svg',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userApiUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
  },
  {
    name: 'twitter',
    displayName: 'X/Twitter',
    icon: 'twitter',
    logo: 'twitter.svg',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userApiUrl: 'https://api.twitter.com/2/users/me',
    scopes: ['users.read', 'tweet.read'],
    pkce: true,
  },
  {
    name: 'kakao',
    displayName: 'Kakao',
    icon: 'kakao',
    logo: 'kakao.svg',
    authUrl: 'https://kauth.kakao.com/oauth/authorize',
    tokenUrl: 'https://kauth.kakao.com/oauth/token',
    userApiUrl: 'https://kapi.kakao.com/v2/user/me',
    scopes: ['profile_nickname', 'account_email'],
  },
  {
    name: 'vk',
    displayName: 'VK',
    icon: 'vk',
    logo: 'vk.svg',
    authUrl: 'https://oauth.vk.com/authorize',
    tokenUrl: 'https://oauth.vk.com/access_token',
    userApiUrl: 'https://api.vk.com/method/users.get',
    scopes: ['email'],
  },
  // 生产力工具
  {
    name: 'linear',
    displayName: 'Linear',
    icon: 'linear',
    logo: 'linear.svg',
  },
  {
    name: 'notion',
    displayName: 'Notion',
    icon: 'notion',
    logo: 'notion.svg',
  },
  {
    name: 'monday',
    displayName: 'monday.com',
    icon: 'monday',
    logo: 'monday.svg',
  },
  {
    name: 'lark',
    displayName: 'Lark/飞书',
    icon: 'lark',
    logo: 'lark.svg',
    authUrl: 'https://open.feishu.cn/open-apis/authen/v1/authorize',
    tokenUrl: 'https://open.feishu.cn/open-apis/authen/v1/access_token',
    userApiUrl: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
    optionsComponent: 'LarkOptions',
  },
  {
    name: 'box',
    displayName: 'Box',
    icon: 'box',
    logo: 'box.svg',
  },
  // 媒体/娱乐
  {
    name: 'spotify',
    displayName: 'Spotify',
    icon: 'spotify',
    logo: 'spotify.svg',
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    userApiUrl: 'https://api.spotify.com/v1/me',
    scopes: ['user-read-email', 'user-read-private'],
    pkce: true,
  },
  {
    name: 'trakt',
    displayName: 'Trakt',
    icon: 'trakt',
    logo: 'trakt.svg',
  },
  {
    name: 'twitch',
    displayName: 'Twitch',
    icon: 'twitch',
    logo: 'twitch.svg',
    authUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    userApiUrl: 'https://api.twitch.tv/helix/users',
    scopes: ['user:read:email'],
  },
  {
    name: 'patreon',
    displayName: 'Patreon (v2)',
    icon: 'patreon',
    logo: 'patreon.svg',
    authUrl: 'https://www.patreon.com/oauth2/authorize',
    tokenUrl: 'https://www.patreon.com/api/oauth2/token',
    userApiUrl: 'https://www.patreon.com/api/oauth2/v2/identity',
    scopes: ['identity', 'identity[email]'],
  },
  {
    name: 'strava',
    displayName: 'Strava',
    icon: 'strava',
    logo: 'strava.svg',
    authUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    userApiUrl: 'https://www.strava.com/api/v3/athlete',
    scopes: ['read', 'profile:read_all'],
  },
  {
    name: 'wakatime',
    displayName: 'WakaTime',
    icon: 'wakatime',
    logo: 'wakatime.svg',
  },
  // 其他服务
  {
    name: 'livechat',
    displayName: 'LiveChat',
    icon: 'livechat',
    logo: 'livechat.svg',
    authUrl: 'https://accounts.livechat.com/',
    tokenUrl: 'https://accounts.livechat.com/token',
    userApiUrl: 'https://accounts.livechat.com/v2/accounts/me',
  },
  {
    name: 'mailcow',
    displayName: 'mailcow',
    icon: 'mailcow',
    logo: 'mailcow.svg',
    optionsComponent: 'SelfHostedOptions',
  },
  {
    name: 'planningcenter',
    displayName: 'Planning Center',
    icon: 'planningcenter',
    logo: 'planningcenter.svg',
  },
  // OpenID Connect
  {
    name: 'oidc',
    displayName: 'OpenID Connect',
    icon: 'openid',
    logo: 'oidc.svg',
    optionsComponent: 'OIDCOptions',
  },
  {
    name: 'oidc2',
    displayName: '(2) OpenID Connect',
    icon: 'openid',
    logo: 'oidc.svg',
    optionsComponent: 'OIDCOptions',
  },
  {
    name: 'oidc3',
    displayName: '(3) OpenID Connect',
    icon: 'openid',
    logo: 'oidc.svg',
    optionsComponent: 'OIDCOptions',
  },
]

/**
 * 根据名称获取提供商
 */
export function getProviderByName(name: string): OAuth2Provider | undefined {
  return OAUTH2_PROVIDERS.find((p) => p.name === name)
}

/**
 * 获取提供商显示名称
 */
export function getProviderDisplayName(name: string): string {
  const provider = getProviderByName(name)
  return provider?.displayName || name
}

/**
 * 获取提供商图标
 */
export function getProviderIcon(name: string): string {
  const provider = getProviderByName(name)
  return provider?.icon || 'key'
}

/**
 * 生成 OAuth2 授权 URL
 */
export function getProviderAuthUrl(
  providerName: string,
  options: {
    clientId: string
    redirectUri: string
    state?: string
    codeChallenge?: string
    codeChallengeMethod?: string
    scopes?: string[]
  }
): string {
  const provider = getProviderByName(providerName)
  if (!provider?.authUrl) {
    throw new Error(`Provider ${providerName} does not have an auth URL`)
  }

  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: (options.scopes || provider.scopes || []).join(' '),
  })

  if (options.state) {
    params.set('state', options.state)
  }

  if (provider.pkce && options.codeChallenge) {
    params.set('code_challenge', options.codeChallenge)
    params.set('code_challenge_method', options.codeChallengeMethod || 'S256')
  }

  return `${provider.authUrl}?${params.toString()}`
}

/**
 * 检查提供商是否已配置
 */
export function isProviderConfigured(config: ProviderConfig | undefined | null): boolean {
  return !!(config?.clientId && config.clientId.trim() !== '')
}

/**
 * 获取提供商配置的默认值
 */
export function getProviderDefaults(providerName: string): Partial<ProviderConfig> {
  const provider = getProviderByName(providerName)
  if (!provider) return {}

  return {
    authUrl: provider.authUrl,
    tokenUrl: provider.tokenUrl,
    userApiUrl: provider.userApiUrl,
    displayName: provider.displayName,
  }
}

/**
 * 验证提供商配置
 */
export function validateProviderConfig(providerName: string, config: ProviderConfig): string[] {
  const errors: string[] = []

  if (!config.clientId?.trim()) {
    errors.push('Client ID is required')
  }

  // Apple 不需要 client secret（使用 JWT）
  if (providerName !== 'apple' && !config.clientSecret?.trim()) {
    errors.push('Client Secret is required')
  }

  // OIDC 需要额外的 URL 配置
  if (providerName.startsWith('oidc')) {
    if (!config.authUrl?.trim()) {
      errors.push('Auth URL is required for OIDC providers')
    }
    if (!config.tokenUrl?.trim()) {
      errors.push('Token URL is required for OIDC providers')
    }
  }

  return errors
}
