/**
 * MigrateCmd 插件 — 迁移 CLI 集成
 * 对照 Go 版 plugins/migratecmd/
 *
 * 功能: migrate 命令、自动迁移检测、迁移模板生成
 */

export type TemplateLang = "ts" | "js";

export interface MigrateCmdConfig {
  dir: string;
  automigrate: boolean;
  templateLang: TemplateLang;
}

export function defaultConfig(): MigrateCmdConfig {
  return {
    dir: "pb_migrations",
    automigrate: true,
    templateLang: "ts",
  };
}

export interface MigrateCmdPlugin {
  getConfig(): MigrateCmdConfig;
  isAutoMigrateEnabled(): boolean;
}

class MigrateCmdPluginImpl implements MigrateCmdPlugin {
  private config: MigrateCmdConfig;

  constructor(config: MigrateCmdConfig) {
    this.config = config;
  }

  getConfig(): MigrateCmdConfig {
    return { ...this.config };
  }

  isAutoMigrateEnabled(): boolean {
    return this.config.automigrate;
  }
}

export function MustRegister(
  _app: unknown,
  _rootCmd: unknown,
  config: MigrateCmdConfig = defaultConfig(),
): MigrateCmdPlugin {
  return new MigrateCmdPluginImpl(config);
}
