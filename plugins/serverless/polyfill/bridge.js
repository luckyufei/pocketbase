/**
 * PocketBase Serverless 内部桥接层
 * 
 * 此文件在 QuickJS 启动时预加载，提供 JS 与 Go Host Functions 之间的桥接
 */

// 操作码定义
const OP_FETCH = 1;
const OP_DB_QUERY = 2;
const OP_KV_GET = 3;
const OP_KV_SET = 4;
const OP_SECRET_GET = 5;
const OP_JOB_ENQUEUE = 6;
const OP_FILE_READ = 7;
const OP_FILE_SAVE = 8;
const OP_VECTOR_SEARCH = 9;
const OP_TX_BEGIN = 10;
const OP_TX_COMMIT = 11;
const OP_TX_ROLLBACK = 12;
const OP_UTILS = 13;

// 内存操作 Helper（由 WASM 导出）
const __alloc = globalThis.__host_alloc || ((size) => 0x3000);
const __free = globalThis.__host_free || (() => {});
const __host_request = globalThis.__host_request || (() => 0);
const __host_log = globalThis.__host_log || (() => {});

// 内存读写 Helper
function writeString(ptr, str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const mem = new Uint8Array(globalThis.__wasm_memory?.buffer || new ArrayBuffer(1024 * 1024));
    mem.set(bytes, ptr);
    return bytes.length;
}

function readString(ptr, len) {
    const mem = new Uint8Array(globalThis.__wasm_memory?.buffer || new ArrayBuffer(1024 * 1024));
    const bytes = mem.slice(ptr, ptr + len);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}

/**
 * 调用 Host Function
 * @param {number} op 操作码
 * @param {object} data 请求数据
 * @returns {any} 响应数据
 */
function hostCall(op, data) {
    const json = JSON.stringify(data);
    const ptr = __alloc(json.length);
    writeString(ptr, json);
    
    const resPtr = __host_request(op, ptr, json.length);
    
    // 读取响应（假设响应长度存储在固定位置）
    const resLen = globalThis.__response_len || 1024;
    const resJson = readString(resPtr, resLen);
    
    __free(ptr);
    
    try {
        const res = JSON.parse(resJson);
        if (res.error) {
            throw new Error(res.error);
        }
        return res.data;
    } catch (e) {
        // 解析失败，返回原始字符串
        return resJson;
    }
}

/**
 * 异步 Host Call（返回 Promise）
 */
async function hostCallAsync(op, data) {
    return new Promise((resolve, reject) => {
        try {
            const result = hostCall(op, data);
            resolve(result);
        } catch (e) {
            reject(e);
        }
    });
}

// 导出给 SDK 使用
globalThis.__bridge = {
    OP_FETCH,
    OP_DB_QUERY,
    OP_KV_GET,
    OP_KV_SET,
    OP_SECRET_GET,
    OP_JOB_ENQUEUE,
    OP_FILE_READ,
    OP_FILE_SAVE,
    OP_VECTOR_SEARCH,
    OP_TX_BEGIN,
    OP_TX_COMMIT,
    OP_TX_ROLLBACK,
    OP_UTILS,
    hostCall,
    hostCallAsync,
};
