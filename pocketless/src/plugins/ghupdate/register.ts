/**
 * GHUpdate 插件 — GitHub 自更新
 * 对照 Go 版 plugins/ghupdate/
 *
 * 功能: 检查 GitHub 最新版本、下载/替换二进制文件
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

export interface GHUpdatePlugin {
  getConfig(): GHUpdateConfig;
  fetchLatestRelease(): Promise<Release | null>;
  compareVersions(current: string, latest: string): number; // -1, 0, 1
}

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
        name: data.name as string ?? "",
        tag: data.tag_name as string ?? "",
        published: data.published_at as string ?? "",
        url: data.html_url as string ?? "",
        body: data.body as string ?? "",
        assets: ((data.assets as unknown[]) ?? []).map((a: unknown) => {
          const asset = a as Record<string, unknown>;
          return {
            name: asset.name as string ?? "",
            downloadUrl: asset.browser_download_url as string ?? "",
            id: asset.id as number ?? 0,
            size: asset.size as number ?? 0,
          };
        }),
      };
    } catch {
      return null;
    }
  }

  compareVersions(current: string, latest: string): number {
    const normalize = (v: string) => v.replace(/^v/, "").split(".").map(Number);
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
}

export function MustRegister(
  _app: unknown,
  _rootCmd: unknown,
  config: GHUpdateConfig = defaultConfig(),
): GHUpdatePlugin {
  return new GHUpdatePluginImpl(config);
}
