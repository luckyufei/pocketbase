/**
 * Trace 插件完整单测
 * 对照 Go 版 plugins/trace/ 的测试覆盖
 *
 * 覆盖：defaultConfig、MustRegister、NoopTracer、MemoryTracer、
 *       RingBuffer、DyeStore、过滤器系统（5种）、shouldTrace 逻辑
 */
import { describe, test, expect, beforeEach } from "bun:test";

import {
  MustRegister,
  defaultConfig,
  NoopTracer,
  MemoryTracer,
  RingBuffer,
  MemoryDyeStore,
  ErrorOnly,
  SlowRequest,
  PathPrefix,
  PathExclude,
  SampleRate,
  DyedUserFilter_,
  shouldTrace,
  type TraceConfig,
  type Span,
  type FilterContext,
} from "./register";

// ═════════════════════════════════════════════════════════════════════════════
// defaultConfig
// ═════════════════════════════════════════════════════════════════════════════

describe("defaultConfig", () => {
  test("返回默认值", () => {
    const cfg = defaultConfig();
    expect(cfg.mode).toBe("off");
    expect(cfg.sampleRate).toBe(0.1);
    expect(cfg.bufferSize).toBe(10000);
    expect(cfg.flushInterval).toBe(1);
    expect(cfg.batchSize).toBe(100);
    expect(cfg.retentionDays).toBe(7);
    expect(cfg.filters).toEqual([]);
    expect(cfg.dyeMaxUsers).toBe(100);
    expect(cfg.dyeDefaultTTL).toBe(86400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MustRegister 条件分支
// ═════════════════════════════════════════════════════════════════════════════

describe("MustRegister", () => {
  test("mode=off → NoopTracer", () => {
    const t = MustRegister(null, { mode: "off" });
    expect(t).toBeInstanceOf(NoopTracer);
    expect(t.isEnabled()).toBe(false);
  });

  test("mode=conditional → MemoryTracer", () => {
    const t = MustRegister(null, { mode: "conditional" });
    expect(t).toBeInstanceOf(MemoryTracer);
    expect(t.isEnabled()).toBe(true);
  });

  test("mode=full → MemoryTracer", () => {
    const t = MustRegister(null, { mode: "full" });
    expect(t).toBeInstanceOf(MemoryTracer);
  });

  test("无参数 → NoopTracer（默认 mode=off）", () => {
    expect(MustRegister(null)).toBeInstanceOf(NoopTracer);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// NoopTracer
// ═════════════════════════════════════════════════════════════════════════════

describe("NoopTracer", () => {
  let noop: NoopTracer;

  beforeEach(() => {
    noop = new NoopTracer();
  });

  test("isEnabled = false", () => {
    expect(noop.isEnabled()).toBe(false);
  });

  test("startSpan 返回可链式调用的 builder", () => {
    const b = noop.startSpan("test");
    const r = b.setAttribute("k", "v").setStatus("ok").setKind("server");
    expect(r).toBe(b); // 链式返回 this
    b.end(); // 不抛错
  });

  test("recordSpan/flush/dyeUser/undyeUser 均为空操作", async () => {
    noop.recordSpan({} as Span);
    await noop.flush();
    noop.dyeUser("u1", 3600);
    noop.undyeUser("u1");
    expect(noop.isDyed("u1")).toBe(false);
    expect(noop.listDyedUsers()).toEqual([]);
    expect(noop.bufferLen()).toBe(0);
    expect(noop.droppedCount()).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MemoryTracer — Span 采集
// ═════════════════════════════════════════════════════════════════════════════

describe("MemoryTracer — Span 采集", () => {
  let tracer: MemoryTracer;

  beforeEach(() => {
    tracer = new MemoryTracer({ mode: "full", bufferSize: 100, batchSize: 10 });
  });

  test("isEnabled = true", () => {
    expect(tracer.isEnabled()).toBe(true);
  });

  test("startSpan + end → bufferLen 增加", () => {
    expect(tracer.bufferLen()).toBe(0);
    tracer.startSpan("op").end();
    expect(tracer.bufferLen()).toBe(1);
  });

  test("SpanBuilder 链式 API 可连续调用", () => {
    tracer
      .startSpan("api.request")
      .setAttribute("http.method", "GET")
      .setAttribute("http.url", "/api/health")
      .setStatus("ok")
      .setKind("server")
      .end();
    expect(tracer.bufferLen()).toBe(1);
  });

  test("recordSpan 直接写入缓冲区", () => {
    const span: Span = {
      id: "s1", traceId: "t1", spanId: "sp1", parentId: "",
      name: "direct", kind: "internal", startTime: Date.now(),
      duration: 100, status: "ok", attributes: {},
    };
    tracer.recordSpan(span);
    expect(tracer.bufferLen()).toBe(1);
  });

  test("flush 清空缓冲区", async () => {
    for (let i = 0; i < 5; i++) tracer.startSpan(`op${i}`).end();
    expect(tracer.bufferLen()).toBe(5);
    await tracer.flush();
    expect(tracer.bufferLen()).toBe(0);
  });

  test("flush 后可继续记录", async () => {
    tracer.startSpan("before").end();
    await tracer.flush();
    tracer.startSpan("after").end();
    expect(tracer.bufferLen()).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MemoryTracer — 染色用户
// ═════════════════════════════════════════════════════════════════════════════

describe("MemoryTracer — 染色用户", () => {
  let tracer: MemoryTracer;

  beforeEach(() => {
    tracer = new MemoryTracer({ mode: "full", dyeMaxUsers: 3, dyeDefaultTTL: 86400 });
  });

  test("dyeUser + isDyed", () => {
    tracer.dyeUser("u1", 3600);
    expect(tracer.isDyed("u1")).toBe(true);
    expect(tracer.isDyed("u2")).toBe(false);
  });

  test("undyeUser 移除染色", () => {
    tracer.dyeUser("u1", 3600);
    tracer.undyeUser("u1");
    expect(tracer.isDyed("u1")).toBe(false);
  });

  test("listDyedUsers 返回所有有效染色用户", () => {
    tracer.dyeUser("u1", 3600);
    tracer.dyeUser("u2", 3600, "debug");
    const users = tracer.listDyedUsers();
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.userId).sort()).toEqual(["u1", "u2"]);
  });

  test("染色携带 reason 字段", () => {
    tracer.dyeUser("u1", 3600, "issue #123");
    const users = tracer.listDyedUsers();
    expect(users[0].reason).toBe("issue #123");
  });

  test("染色 TTL 过期后 isDyed 返回 false", async () => {
    tracer.dyeUser("u1", 1); // 1 秒
    expect(tracer.isDyed("u1")).toBe(true);
    await Bun.sleep(1100);
    expect(tracer.isDyed("u1")).toBe(false);
  });

  test("listDyedUsers 过滤已过期用户", async () => {
    tracer.dyeUser("u1", 1);     // 1 秒
    tracer.dyeUser("u2", 3600);  // 1 小时
    await Bun.sleep(1100);
    const users = tracer.listDyedUsers();
    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe("u2");
  });

  test("dyeMaxUsers 超出限制时新增被忽略", () => {
    tracer.dyeUser("u1", 3600);
    tracer.dyeUser("u2", 3600);
    tracer.dyeUser("u3", 3600);
    tracer.dyeUser("u4", 3600); // 超过 max=3
    expect(tracer.listDyedUsers()).toHaveLength(3);
    expect(tracer.isDyed("u4")).toBe(false);
  });

  test("已有用户更新不受 dyeMaxUsers 限制", () => {
    tracer.dyeUser("u1", 3600);
    tracer.dyeUser("u2", 3600);
    tracer.dyeUser("u3", 3600);
    tracer.dyeUser("u1", 7200); // 更新已有，不受限
    expect(tracer.isDyed("u1")).toBe(true);
    expect(tracer.listDyedUsers()).toHaveLength(3);
  });

  test("DyedUser 对象字段完整", () => {
    tracer.dyeUser("u1", 3600, "test-reason");
    const u = tracer.listDyedUsers()[0];
    expect(u.userId).toBe("u1");
    expect(u.expiresAt).toBeGreaterThan(Date.now());
    expect(u.reason).toBe("test-reason");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RingBuffer
// ═════════════════════════════════════════════════════════════════════════════

describe("RingBuffer", () => {
  const makeSpan = (name: string): Span => ({
    id: crypto.randomUUID(), traceId: "t1", spanId: "s1", parentId: "",
    name, kind: "internal", startTime: Date.now(), duration: 1,
    status: "ok", attributes: {},
  });

  test("push + len", () => {
    const buf = new RingBuffer(10);
    expect(buf.len()).toBe(0);
    buf.push(makeSpan("a"));
    expect(buf.len()).toBe(1);
  });

  test("flush 按 FIFO 顺序返回", () => {
    const buf = new RingBuffer(10);
    buf.push(makeSpan("a"));
    buf.push(makeSpan("b"));
    buf.push(makeSpan("c"));
    const result = buf.flush(2);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("a");
    expect(result[1].name).toBe("b");
    expect(buf.len()).toBe(1);
  });

  test("flush 全量", () => {
    const buf = new RingBuffer(5);
    for (let i = 0; i < 5; i++) buf.push(makeSpan(`op${i}`));
    const r = buf.flush(100);
    expect(r).toHaveLength(5);
    expect(buf.len()).toBe(0);
  });

  test("溢出时丢弃最旧数据，记录 droppedCount", () => {
    const buf = new RingBuffer(3);
    buf.push(makeSpan("a")); // 位置 0
    buf.push(makeSpan("b")); // 位置 1
    buf.push(makeSpan("c")); // 位置 2 满
    buf.push(makeSpan("d")); // 覆盖 a，dropped+1
    expect(buf.len()).toBe(3);
    expect(buf.droppedCount()).toBe(1);
    const items = buf.flush(3);
    expect(items.map((s) => s.name)).toEqual(["b", "c", "d"]);
  });

  test("clear 清空所有数据", () => {
    const buf = new RingBuffer(5);
    buf.push(makeSpan("a"));
    buf.push(makeSpan("b"));
    buf.clear();
    expect(buf.len()).toBe(0);
    expect(buf.flush(10)).toHaveLength(0);
  });

  test("flush 空缓冲区返回空数组", () => {
    const buf = new RingBuffer(5);
    expect(buf.flush(10)).toEqual([]);
  });

  test("cap 返回容量", () => {
    const buf = new RingBuffer(42);
    expect(buf.cap()).toBe(42);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MemoryDyeStore
// ═════════════════════════════════════════════════════════════════════════════

describe("MemoryDyeStore", () => {
  let store: MemoryDyeStore;

  beforeEach(() => {
    store = new MemoryDyeStore(5, 3600);
  });

  test("add + isDyed", () => {
    store.add("u1", 3600_000);
    expect(store.isDyed("u1")).toBe(true);
  });

  test("remove 后 isDyed = false", () => {
    store.add("u1", 3600_000);
    store.remove("u1");
    expect(store.isDyed("u1")).toBe(false);
  });

  test("get 返回副本", () => {
    store.add("u1", 3600_000, "admin", "debug");
    const u = store.get("u1");
    expect(u).not.toBeNull();
    expect(u!.userId).toBe("u1");
    expect(u!.addedBy).toBe("admin");
    expect(u!.reason).toBe("debug");
  });

  test("list 返回所有有效用户", () => {
    store.add("u1", 3600_000);
    store.add("u2", 3600_000);
    expect(store.list()).toHaveLength(2);
  });

  test("updateTTL 更新过期时间", () => {
    store.add("u1", 3600_000);
    const before = store.get("u1")!.expiresAt;
    store.updateTTL("u1", 7200_000);
    const after = store.get("u1")!.expiresAt;
    expect(after).toBeGreaterThan(before);
  });

  test("count 返回正确数量", () => {
    expect(store.count()).toBe(0);
    store.add("u1", 3600_000);
    store.add("u2", 3600_000);
    expect(store.count()).toBe(2);
  });

  test("超出 maxUsers 限制时新增被忽略", () => {
    for (let i = 0; i < 5; i++) store.add(`u${i}`, 3600_000);
    store.add("u99", 3600_000);
    expect(store.isDyed("u99")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 过滤器系统
// ═════════════════════════════════════════════════════════════════════════════

const makeCtx = (overrides: Partial<FilterContext> = {}): FilterContext => ({
  path: "/api/records", method: "GET", ...overrides,
});

describe("ErrorOnly 过滤器", () => {
  const f = ErrorOnly();

  test("name = error_only, phase = post", () => {
    expect(f.name()).toBe("error_only");
    expect(f.phase()).toBe("post");
  });

  test("statusCode >= 400 → 追踪", () => {
    expect(f.shouldTrace(makeCtx({ statusCode: 400 }))).toBe(true);
    expect(f.shouldTrace(makeCtx({ statusCode: 500 }))).toBe(true);
    expect(f.shouldTrace(makeCtx({ statusCode: 404 }))).toBe(true);
  });

  test("statusCode < 400 → 不追踪", () => {
    expect(f.shouldTrace(makeCtx({ statusCode: 200 }))).toBe(false);
    expect(f.shouldTrace(makeCtx({ statusCode: 301 }))).toBe(false);
  });

  test("无 statusCode → 不追踪", () => {
    expect(f.shouldTrace(makeCtx())).toBe(false);
  });
});

describe("SlowRequest 过滤器", () => {
  const f = SlowRequest(500); // 500ms 阈值

  test("name = slow_request, phase = post", () => {
    expect(f.name()).toBe("slow_request");
    expect(f.phase()).toBe("post");
  });

  test("durationMs >= threshold → 追踪", () => {
    expect(f.shouldTrace(makeCtx({ durationMs: 500 }))).toBe(true);
    expect(f.shouldTrace(makeCtx({ durationMs: 1000 }))).toBe(true);
  });

  test("durationMs < threshold → 不追踪", () => {
    expect(f.shouldTrace(makeCtx({ durationMs: 499 }))).toBe(false);
    expect(f.shouldTrace(makeCtx({ durationMs: 0 }))).toBe(false);
  });

  test("无 durationMs → 不追踪", () => {
    expect(f.shouldTrace(makeCtx())).toBe(false);
  });
});

describe("PathPrefix 过滤器", () => {
  const f = PathPrefix("/api/admin", "/internal");

  test("name = path_prefix, phase = pre", () => {
    expect(f.name()).toBe("path_prefix");
    expect(f.phase()).toBe("pre");
  });

  test("路径匹配前缀 → 追踪", () => {
    expect(f.shouldTrace(makeCtx({ path: "/api/admin/users" }))).toBe(true);
    expect(f.shouldTrace(makeCtx({ path: "/internal/metrics" }))).toBe(true);
  });

  test("路径不匹配 → 不追踪", () => {
    expect(f.shouldTrace(makeCtx({ path: "/api/records" }))).toBe(false);
    expect(f.shouldTrace(makeCtx({ path: "/public" }))).toBe(false);
  });
});

describe("PathExclude 过滤器", () => {
  const f = PathExclude("/health", "/metrics");

  test("name = path_exclude, phase = pre", () => {
    expect(f.name()).toBe("path_exclude");
    expect(f.phase()).toBe("pre");
  });

  test("路径不匹配排除规则 → 允许追踪", () => {
    expect(f.shouldTrace(makeCtx({ path: "/api/records" }))).toBe(true);
  });

  test("路径匹配排除规则 → 不追踪", () => {
    expect(f.shouldTrace(makeCtx({ path: "/health" }))).toBe(false);
    expect(f.shouldTrace(makeCtx({ path: "/metrics" }))).toBe(false);
    expect(f.shouldTrace(makeCtx({ path: "/health/live" }))).toBe(false);
  });
});

describe("SampleRate 过滤器", () => {
  test("name = sample_rate, phase = pre", () => {
    const f = SampleRate(0.5);
    expect(f.name()).toBe("sample_rate");
    expect(f.phase()).toBe("pre");
  });

  test("rate=1.0 → 始终追踪", () => {
    const f = SampleRate(1.0);
    for (let i = 0; i < 10; i++) {
      expect(f.shouldTrace(makeCtx())).toBe(true);
    }
  });

  test("rate=0.0 → 从不追踪", () => {
    const f = SampleRate(0.0);
    for (let i = 0; i < 10; i++) {
      expect(f.shouldTrace(makeCtx())).toBe(false);
    }
  });

  test("rate 被规范化到 [0, 1]", () => {
    const f1 = SampleRate(2.0); // 规范化为 1
    const f2 = SampleRate(-0.5); // 规范化为 0
    expect(f1.shouldTrace(makeCtx())).toBe(true);
    expect(f2.shouldTrace(makeCtx())).toBe(false);
  });
});

describe("DyedUserFilter", () => {
  test("name = dyed_user, phase = pre", () => {
    const store = new MemoryDyeStore();
    const f = DyedUserFilter_(store);
    expect(f.name()).toBe("dyed_user");
    expect(f.phase()).toBe("pre");
  });

  test("染色用户 → 追踪", () => {
    const store = new MemoryDyeStore();
    store.add("u1", 3600_000);
    const f = DyedUserFilter_(store);
    expect(f.shouldTrace(makeCtx({ userId: "u1" }))).toBe(true);
  });

  test("非染色用户 → 不追踪", () => {
    const store = new MemoryDyeStore();
    const f = DyedUserFilter_(store);
    expect(f.shouldTrace(makeCtx({ userId: "u2" }))).toBe(false);
  });

  test("无 userId → 不追踪", () => {
    const store = new MemoryDyeStore();
    store.add("u1", 3600_000);
    const f = DyedUserFilter_(store);
    expect(f.shouldTrace(makeCtx())).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// shouldTrace 过滤链逻辑
// ═════════════════════════════════════════════════════════════════════════════

describe("shouldTrace 逻辑", () => {
  test("mode=off → 始终 false", () => {
    expect(shouldTrace("off", [ErrorOnly()], makeCtx({ statusCode: 500 }))).toBe(false);
  });

  test("mode=full → 始终 true", () => {
    expect(shouldTrace("full", [], makeCtx())).toBe(true);
  });

  test("conditional + ErrorOnly：无 postCtx → false", () => {
    expect(shouldTrace("conditional", [ErrorOnly()], makeCtx({ statusCode: 200 }))).toBe(false);
  });

  test("conditional + ErrorOnly：postCtx 5xx → true", () => {
    const preCtx = makeCtx();
    const postCtx = makeCtx({ statusCode: 500 });
    expect(shouldTrace("conditional", [ErrorOnly()], preCtx, postCtx)).toBe(true);
  });

  test("conditional + PathPrefix：pre 阶段匹配 → true（无需 postCtx）", () => {
    const f = PathPrefix("/api/admin");
    expect(shouldTrace("conditional", [f], makeCtx({ path: "/api/admin/users" }))).toBe(true);
  });

  test("conditional + PathExclude：path 被排除 → false", () => {
    const f = PathExclude("/health");
    expect(shouldTrace("conditional", [f], makeCtx({ path: "/health" }))).toBe(false);
  });

  test("conditional 无过滤器 → false", () => {
    expect(shouldTrace("conditional", [], makeCtx())).toBe(false);
  });

  test("MemoryTracer.shouldTrace 方法集成", () => {
    const tracer = new MemoryTracer({
      mode: "conditional",
      filters: [ErrorOnly()],
    });
    const pre = makeCtx();
    const post = makeCtx({ statusCode: 404 });
    expect(tracer.shouldTrace(pre, post)).toBe(true);
    expect(tracer.shouldTrace(pre)).toBe(false);
  });
});
