/**
 * PocketBase Serverless SDK
 * 
 * 提供 pb 全局对象，用于访问 PocketBase 功能
 */

const bridge = globalThis.__bridge || {
    OP_FETCH: 1,
    OP_DB_QUERY: 2,
    OP_KV_GET: 3,
    OP_KV_SET: 4,
    OP_SECRET_GET: 5,
    OP_JOB_ENQUEUE: 6,
    OP_FILE_READ: 7,
    OP_FILE_SAVE: 8,
    OP_VECTOR_SEARCH: 9,
    OP_TX_BEGIN: 10,
    OP_TX_COMMIT: 11,
    OP_TX_ROLLBACK: 12,
    OP_UTILS: 13,
    hostCall: (op, data) => data,
    hostCallAsync: async (op, data) => data,
};

/**
 * Collection 服务
 */
class CollectionService {
    constructor(name, txId = null) {
        this.name = name;
        this.txId = txId;
    }

    async getOne(id) {
        return bridge.hostCallAsync(bridge.OP_DB_QUERY, {
            op: 'one',
            col: this.name,
            id,
            txId: this.txId,
        });
    }

    async getList(page = 1, perPage = 20, options = {}) {
        return bridge.hostCallAsync(bridge.OP_DB_QUERY, {
            op: 'list',
            col: this.name,
            page,
            perPage,
            ...options,
            txId: this.txId,
        });
    }

    async create(data) {
        return bridge.hostCallAsync(bridge.OP_DB_QUERY, {
            op: 'create',
            col: this.name,
            data,
            txId: this.txId,
        });
    }

    async update(id, data) {
        return bridge.hostCallAsync(bridge.OP_DB_QUERY, {
            op: 'update',
            col: this.name,
            id,
            data,
            txId: this.txId,
        });
    }

    async delete(id) {
        return bridge.hostCallAsync(bridge.OP_DB_QUERY, {
            op: 'delete',
            col: this.name,
            id,
            txId: this.txId,
        });
    }

    async vectorSearch(options) {
        return bridge.hostCallAsync(bridge.OP_VECTOR_SEARCH, {
            col: this.name,
            ...options,
            txId: this.txId,
        });
    }
}

/**
 * KV 服务
 */
const kvService = {
    async get(key) {
        return bridge.hostCallAsync(bridge.OP_KV_GET, { key });
    },

    async set(key, value, options = {}) {
        return bridge.hostCallAsync(bridge.OP_KV_SET, { key, value, ...options });
    },

    async delete(key) {
        return bridge.hostCallAsync(bridge.OP_KV_SET, { key, value: null, delete: true });
    },
};

/**
 * Files 服务
 */
const filesService = {
    async read(collection, recordId, filename) {
        return bridge.hostCallAsync(bridge.OP_FILE_READ, { collection, recordId, filename });
    },

    async save(collection, recordId, file) {
        return bridge.hostCallAsync(bridge.OP_FILE_SAVE, { collection, recordId, ...file });
    },
};

/**
 * Secrets 服务
 */
const secretsService = {
    get(key) {
        return bridge.hostCall(bridge.OP_SECRET_GET, { key });
    },
};

/**
 * Jobs 服务
 */
const jobsService = {
    async enqueue(topic, payload) {
        return bridge.hostCallAsync(bridge.OP_JOB_ENQUEUE, { topic, payload });
    },
};

/**
 * Utils 服务
 */
const utilsService = {
    uuid() {
        return bridge.hostCall(bridge.OP_UTILS, { func: 'uuid' });
    },

    hash(input) {
        return bridge.hostCall(bridge.OP_UTILS, { func: 'hash', input });
    },

    randomString(length) {
        return bridge.hostCall(bridge.OP_UTILS, { func: 'randomString', len: length });
    },
};

/**
 * 事务上下文
 */
class TransactionContext {
    constructor(txId) {
        this.txId = txId;
    }

    collection(name) {
        return new CollectionService(name, this.txId);
    }
}

/**
 * Hook 注册表
 */
const hookRegistry = {
    beforeCreate: {},
    afterCreate: {},
    beforeUpdate: {},
    afterUpdate: {},
    beforeDelete: {},
    afterDelete: {},
};

/**
 * Cron 注册表
 */
const cronRegistry = {};

/**
 * PocketBase SDK
 */
const pb = {
    collection(name) {
        return new CollectionService(name);
    },

    kv: kvService,
    files: filesService,
    secrets: secretsService,
    jobs: jobsService,
    utils: utilsService,

    async tx(fn) {
        const txId = await bridge.hostCallAsync(bridge.OP_TX_BEGIN, {});
        const ctx = new TransactionContext(txId);
        
        try {
            const result = await fn(ctx);
            await bridge.hostCallAsync(bridge.OP_TX_COMMIT, { txId });
            return result;
        } catch (e) {
            await bridge.hostCallAsync(bridge.OP_TX_ROLLBACK, { txId });
            throw e;
        }
    },

    // Hook 注册
    onRecordBeforeCreate(collection, handler) {
        hookRegistry.beforeCreate[collection] = handler;
    },

    onRecordAfterCreate(collection, handler) {
        hookRegistry.afterCreate[collection] = handler;
    },

    onRecordBeforeUpdate(collection, handler) {
        hookRegistry.beforeUpdate[collection] = handler;
    },

    onRecordAfterUpdate(collection, handler) {
        hookRegistry.afterUpdate[collection] = handler;
    },

    onRecordBeforeDelete(collection, handler) {
        hookRegistry.beforeDelete[collection] = handler;
    },

    onRecordAfterDelete(collection, handler) {
        hookRegistry.afterDelete[collection] = handler;
    },

    // Cron 注册
    cron(name, schedule, handler) {
        cronRegistry[name] = { schedule, handler };
    },

    // 内部方法：获取 Hook
    __getHook(type, collection) {
        return hookRegistry[type]?.[collection];
    },

    // 内部方法：获取 Cron
    __getCron(name) {
        return cronRegistry[name];
    },
};

// 导出到全局
globalThis.pb = pb;
