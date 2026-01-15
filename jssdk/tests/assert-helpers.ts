/**
 * Chai-style assertion helpers for bun:test
 * 提供与 vitest/chai 兼容的断言方法
 */
import nodeAssert from "node:assert";

// 扩展 assert 对象
export const assert = {
    // 基础断言
    equal: nodeAssert.strictEqual,
    deepEqual: nodeAssert.deepStrictEqual,
    notEqual: nodeAssert.notStrictEqual,
    ok: nodeAssert.ok,
    fail: nodeAssert.fail,

    // Boolean 断言
    isTrue(value: unknown, message?: string) {
        nodeAssert.strictEqual(value, true, message);
    },
    isFalse(value: unknown, message?: string) {
        nodeAssert.strictEqual(value, false, message);
    },

    // Type 断言
    isNull(value: unknown, message?: string) {
        nodeAssert.strictEqual(value, null, message);
    },
    isNotNull(value: unknown, message?: string) {
        nodeAssert.notStrictEqual(value, null, message);
    },
    isUndefined(value: unknown, message?: string) {
        nodeAssert.strictEqual(value, undefined, message);
    },
    isNotUndefined(value: unknown, message?: string) {
        nodeAssert.notStrictEqual(value, undefined, message);
    },
    isNumber(value: unknown, message?: string) {
        nodeAssert.strictEqual(typeof value, "number", message);
    },
    isString(value: unknown, message?: string) {
        nodeAssert.strictEqual(typeof value, "string", message);
    },
    isObject(value: unknown, message?: string) {
        nodeAssert.strictEqual(typeof value, "object", message);
    },
    isFunction(value: unknown, message?: string) {
        nodeAssert.strictEqual(typeof value, "function", message);
    },

    // Instance 断言
    instanceOf(value: unknown, constructor: Function, message?: string) {
        nodeAssert.ok(
            value instanceof constructor,
            message || `Expected ${value} to be instance of ${constructor.name}`,
        );
    },

    // Collection 断言
    isEmpty(value: string | unknown[], message?: string) {
        if (typeof value === "string") {
            nodeAssert.strictEqual(value.length, 0, message);
        } else if (Array.isArray(value)) {
            nodeAssert.strictEqual(value.length, 0, message);
        } else {
            nodeAssert.fail(message || "Expected value to be string or array");
        }
    },
    isNotEmpty(value: string | unknown[], message?: string) {
        if (typeof value === "string") {
            nodeAssert.ok(value.length > 0, message || "Expected non-empty string");
        } else if (Array.isArray(value)) {
            nodeAssert.ok(value.length > 0, message || "Expected non-empty array");
        } else {
            nodeAssert.ok(value != null, message || "Expected non-empty value");
        }
    },

    // 包含断言
    include(haystack: string | unknown[], needle: unknown, message?: string) {
        if (typeof haystack === "string") {
            nodeAssert.ok(haystack.includes(needle as string), message);
        } else if (Array.isArray(haystack)) {
            nodeAssert.ok(haystack.includes(needle), message);
        }
    },

    // throws 断言
    throws: nodeAssert.throws,
    doesNotThrow: nodeAssert.doesNotThrow,

    // rejects 断言
    rejects: nodeAssert.rejects,
};

export default assert;
