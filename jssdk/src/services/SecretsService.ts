import { BaseService } from "@/services/BaseService";
import { CommonOptions } from "@/tools/options";

/**
 * Secret 完整模型（包含解密后的值）
 */
export interface Secret {
    /** Secret 键名 */
    key: string;
    /** Secret 解密后的值 */
    value: string;
    /** 环境标识（global/dev/prod 等） */
    env: string;
    /** 描述信息 */
    description?: string;
    /** 创建时间 */
    created: string;
    /** 更新时间 */
    updated: string;
}

/**
 * Secret 信息模型（列表返回，值被掩码）
 */
export interface SecretInfo {
    /** Secret 键名 */
    key: string;
    /** 掩码后的值（如 sk-abc***） */
    masked_value: string;
    /** 环境标识 */
    env: string;
    /** 描述信息 */
    description?: string;
    /** 创建时间 */
    created: string;
    /** 更新时间 */
    updated: string;
}

/**
 * 创建 Secret 的参数
 */
export interface SecretCreateParams {
    /** Secret 键名（必填） */
    key: string;
    /** Secret 值（必填） */
    value: string;
    /** 环境标识（可选，默认 global） */
    env?: string;
    /** 描述信息（可选） */
    description?: string;
}

/**
 * 更新 Secret 的参数
 */
export interface SecretUpdateParams {
    /** 新的 Secret 值（必填） */
    value: string;
    /** 新的描述信息（可选） */
    description?: string;
}

/**
 * SecretsService 提供 Secrets API 的客户端封装
 *
 * 用于管理加密存储的敏感数据（API 密钥、令牌等）
 *
 * 注意：所有操作都需要 Superuser 权限
 */
export class SecretsService extends BaseService {
    /**
     * 创建一个新的 Secret
     *
     * @param params 创建参数
     * @param options 请求选项
     * @throws {ClientResponseError} 401 未认证 / 403 非 Superuser / 503 功能未启用
     */
    async create(params: SecretCreateParams, options?: CommonOptions): Promise<Secret> {
        const body: Record<string, any> = {
            key: params.key,
            value: params.value,
        };

        if (params.env) {
            body.env = params.env;
        }

        if (params.description) {
            body.description = params.description;
        }

        const sendOptions = Object.assign(
            {
                method: "POST",
                body,
            },
            options,
        );

        return this.client.send("/api/secrets", sendOptions);
    }

    /**
     * 获取指定 key 的 Secret（解密后的值）
     *
     * @param key Secret 键名
     * @param options 请求选项
     * @throws {ClientResponseError} 401/403/404/503
     */
    async get(key: string, options?: CommonOptions): Promise<Secret> {
        const sendOptions = Object.assign(
            {
                method: "GET",
            },
            options,
        );

        return this.client.send(`/api/secrets/${encodeURIComponent(key)}`, sendOptions);
    }

    /**
     * 获取指定 key 的 Secret 值，不存在时返回默认值
     *
     * @param key Secret 键名
     * @param defaultValue 默认值
     * @param options 请求选项
     */
    async getWithDefault(
        key: string,
        defaultValue: string,
        options?: CommonOptions,
    ): Promise<string> {
        try {
            const secret = await this.get(key, options);
            return secret.value;
        } catch (err: any) {
            // 404 时返回默认值
            if (err.status === 404) {
                return defaultValue;
            }
            throw err;
        }
    }

    /**
     * 列出所有 Secrets（值被掩码）
     *
     * @param options 请求选项
     * @throws {ClientResponseError} 401/403/503
     */
    async list(options?: CommonOptions): Promise<SecretInfo[]> {
        const sendOptions = Object.assign(
            {
                method: "GET",
            },
            options,
        );

        return this.client.send("/api/secrets", sendOptions);
    }

    /**
     * 更新指定 key 的 Secret
     *
     * @param key Secret 键名
     * @param params 更新参数
     * @param options 请求选项
     * @throws {ClientResponseError} 401/403/404/503
     */
    async update(
        key: string,
        params: SecretUpdateParams,
        options?: CommonOptions,
    ): Promise<Secret> {
        const body: Record<string, any> = {
            value: params.value,
        };

        if (params.description !== undefined) {
            body.description = params.description;
        }

        const sendOptions = Object.assign(
            {
                method: "PUT",
                body,
            },
            options,
        );

        return this.client.send(`/api/secrets/${encodeURIComponent(key)}`, sendOptions);
    }

    /**
     * 删除指定 key 的 Secret
     *
     * @param key Secret 键名
     * @param options 请求选项
     * @throws {ClientResponseError} 401/403/503
     */
    async delete(key: string, options?: CommonOptions): Promise<boolean> {
        const sendOptions = Object.assign(
            {
                method: "DELETE",
            },
            options,
        );

        return this.client
            .send(`/api/secrets/${encodeURIComponent(key)}`, sendOptions)
            .then(() => true);
    }

    /**
     * 检查指定 key 的 Secret 是否存在
     *
     * @param key Secret 键名
     * @param options 请求选项
     */
    async exists(key: string, options?: CommonOptions): Promise<boolean> {
        try {
            await this.get(key, options);
            return true;
        } catch (err: any) {
            if (err.status === 404) {
                return false;
            }
            throw err;
        }
    }
}
