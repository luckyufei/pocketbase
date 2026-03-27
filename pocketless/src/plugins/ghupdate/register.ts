/**
 * GHUpdate 插件 — GitHub 自更新
 * 对照 Go 版 plugins/ghupdate/
 *
 * 功能: 检查 GitHub 最新版本、版本比较、资源查找
 * 注: 实际下载/替换二进制文件属于操作系统 I/O，在 pocketless 中仅保留查询/比较逻辑
 */

export interface GHUpdateConfig {
  owner: string;
  repo: string;
  archiveExecutable?: string;
}

export function defaultConfig(): GHUpdateConfig {
  return {
    owner: "pocketbase",
    repo: "pocketbase",
    archiveExecutable: "pocketbase",
  };
}

/**
 * 从环境变量覆盖配置（不修改原对象）
 * PB_GHUPDATE_OWNER               — GitHub 仓库 owner
 * PB_GHUPDATE_REPO                — GitHub 仓库名
 * PB_GHUPDATE_ARCHIVE_EXECUTABLE  — 压缩包内可执行文件名
 */
export function applyEnvOverrides(config: GHUpdateConfig): GHUpdateConfig {
  const result = { ...config };

  const owner = process.env.PB_GHUPDATE_OWNER;
  if (owner !== undefined) result.owner = owner;

  const repo = process.env.PB_GHUPDATE_REPO;
  if (repo !== undefined) result.repo = repo;

  const archiveExecutable = process.env.PB_GHUPDATE_ARCHIVE_EXECUTABLE;
  if (archiveExecutable !== undefined) result.archiveExecutable = archiveExecutable;

  return result;
}

// ---------- Release 相关类型 ----------

export interface Release {
  name: string;
  tag: string;
  published: string;
  url: string;
  body: string;
  assets: ReleaseAsset[];
}

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  id: number;
  size: number;
}

// ---------- Plugin 接口 ----------

export interface GHUpdatePlugin {
  getConfig(): GHUpdateConfig;
  /** 从 GitHub API 获取最新 Release（网络失败返回 null）*/
  fetchLatestRelease(): Promise<Release | null>;
  /**
   * 比较两个版本号
   * - 返回 -1: current < latest（有新版本）
   * - 返回  0: current === latest（已是最新）
   * - 返回  1: current > latest（比远端更新）
   */
  compareVersions(current: string, latest: string): number;
  /**
   * 是否有可用更新（current < latest）
   */
  isUpdateAvailable(current: string, latest: string): boolean;
  /**
   * 在 Release 的资源列表中按名称模式查找第一个匹配项
   * pattern 支持 * 通配符（如 "*linux_amd64*"）
   */
  findAsset(release: Release, pattern: string): ReleaseAsset | null;
}

// ---------- 内存实现 ----------

class GHUpdatePluginImpl implements GHUpdatePlugin {
  private config: GHUpdateConfig;

  constructor(config: GHUpdateConfig) {
    this.config = config;
  }

  getConfig(): GHUpdateConfig {
    return { ...this.config };
  }

  async fetchLatestRelease(): Promise<Release | null> {
    try {
      const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/releases/latest`;
      const res = await fetch(url, {
        headers: { "Accept": "application/vnd.github.v3+json" },
      });
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
      return {
        name: (data.name as string) ?? "",
        tag: (data.tag_name as string) ?? "",
        published: (data.published_at as string) ?? "",
        url: (data.html_url as string) ?? "",
        body: (data.body as string) ?? "",
        assets: ((data.assets as unknown[]) ?? []).map((a: unknown) => {
          const asset = a as Record<string, unknown>;
          return {
            name: (asset.name as string) ?? "",
            downloadUrl: (asset.browser_download_url as string) ?? "",
            id: (asset.id as number) ?? 0,
            size: (asset.size as number) ?? 0,
          };
        }),
      };
    } catch {
      return null;
    }
  }

  compareVersions(current: string, latest: string): number {
    const normalize = (v: string) =>
      v
        .replace(/^v/, "")
        .split(".")
        .map(Number);
    const a = normalize(current);
    const b = normalize(latest);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      if (ai < bi) return -1;
      if (ai > bi) return 1;
    }
    return 0;
  }

  isUpdateAvailable(current: string, latest: string): boolean {
    return this.compareVersions(current, latest) === -1;
  }

  findAsset(release: Release, pattern: string): ReleaseAsset | null {
    // 将通配符模式转为正则（* → .*）
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // 转义正则特殊字符（* 除外）
      .replace(/\*/g, ".*");
    const regex = new RegExp(regexStr, "i");
    return release.assets.find((a) => regex.test(a.name)) ?? null;
  }
}

// ---------- 注册函数 ----------

export function MustRegister(
  _app: unknown,
  _rootCmd: unknown,
  config: GHUpdateConfig = defaultConfig(),
): GHUpdatePlugin {
  return new GHUpdatePluginImpl(config);
}
