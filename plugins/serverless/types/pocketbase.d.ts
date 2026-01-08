// PocketBase Serverless TypeScript 类型定义
// 自动生成 - 请勿手动修改

declare global {
    /** PocketBase 全局实例 */
    const pb: PocketBase;
}

/** PocketBase 主接口 */
interface PocketBase {
    /** 获取集合服务 */
    collection(name: string): CollectionService;
    
    /** KV 存储服务 */
    kv: KVService;
    
    /** 文件服务 */
    files: FileService;
    
    /** 密钥服务 */
    secrets: SecretService;
    
    /** 任务队列服务 */
    jobs: JobService;
    
    /** 工具函数 */
    utils: UtilService;
    
    /** 在事务中执行 */
    tx<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;
    
    // Hooks
    /** 记录创建前钩子 */
    onRecordBeforeCreate(collection: string, handler: HookHandler): void;
    /** 记录创建后钩子 */
    onRecordAfterCreate(collection: string, handler: HookHandler): void;
    /** 记录更新前钩子 */
    onRecordBeforeUpdate(collection: string, handler: HookHandler): void;
    /** 记录更新后钩子 */
    onRecordAfterUpdate(collection: string, handler: HookHandler): void;
    /** 记录删除前钩子 */
    onRecordBeforeDelete(collection: string, handler: HookHandler): void;
    /** 记录删除后钩子 */
    onRecordAfterDelete(collection: string, handler: HookHandler): void;
    
    /** Cron 定时任务 */
    cron(name: string, schedule: string, handler: () => Promise<void>): void;
}

/** 集合服务接口 */
interface CollectionService {
    /** 获取单条记录 */
    getOne(id: string): Promise<Record>;
    
    /** 获取记录列表 */
    getList(page?: number, perPage?: number, options?: ListOptions): Promise<ListResult>;
    
    /** 创建记录 */
    create(data: object): Promise<Record>;
    
    /** 更新记录 */
    update(id: string, data: object): Promise<Record>;
    
    /** 删除记录 */
    delete(id: string): Promise<void>;
    
    /** 向量搜索 */
    vectorSearch(opts: VectorSearchOptions): Promise<Record[]>;
}

/** 向量搜索选项 */
interface VectorSearchOptions {
    /** 查询向量 */
    vector: number[];
    /** 向量字段名 */
    field: string;
    /** 过滤条件 */
    filter?: string;
    /** 返回数量 */
    top?: number;
}

/** KV 存储服务接口 */
interface KVService {
    /** 获取值 */
    get(key: string): Promise<any>;
    /** 设置值 */
    set(key: string, value: any, opts?: { ttl?: number }): Promise<void>;
    /** 删除键 */
    delete(key: string): Promise<void>;
}

/** 文件服务接口 */
interface FileService {
    /** 读取文件 */
    read(collection: string, record: string, filename: string): Promise<ArrayBuffer>;
    /** 保存文件 */
    save(collection: string, record: string, file: { filename: string; data: ArrayBuffer }): Promise<void>;
}

/** 密钥服务接口 */
interface SecretService {
    /** 获取密钥 */
    get(name: string): string | null;
}

/** 任务队列服务接口 */
interface JobService {
    /** 入队任务 */
    enqueue(topic: string, payload: any): Promise<string>;
}

/** 工具函数接口 */
interface UtilService {
    /** 生成 UUID v7 */
    uuid(): string;
    /** 计算哈希 */
    hash(input: string): string;
    /** 生成随机字符串 */
    randomString(length: number): string;
}

/** 事务上下文 */
interface TransactionContext {
    /** 获取集合服务（事务内） */
    collection(name: string): CollectionService;
}

/** 记录事件 */
interface RecordEvent {
    /** 记录对象 */
    record: Record;
    /** 认证用户 */
    auth?: Record;
}

/** 钩子处理函数类型 */
type HookHandler = (e: RecordEvent) => Promise<void>;

/** 记录接口 */
interface Record {
    /** 记录 ID */
    id: string;
    /** 创建时间 */
    created: string;
    /** 更新时间 */
    updated: string;
    /** 动态字段 */
    [key: string]: any;
    /** 获取字段值 */
    get(field: string): any;
    /** 设置字段值 */
    set(field: string, value: any): void;
}

/** 列表查询选项 */
interface ListOptions {
    /** 过滤条件 */
    filter?: string;
    /** 排序 */
    sort?: string;
    /** 展开关联 */
    expand?: string;
}

/** 列表查询结果 */
interface ListResult {
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    perPage: number;
    /** 总记录数 */
    totalItems: number;
    /** 总页数 */
    totalPages: number;
    /** 记录列表 */
    items: Record[];
}

export {};
