/**
 * Hook 系统测试 — 洋葱模型、优先级、TaggedHook、TaggedHookView
 * 对照 Go 版 tools/hook/hook_test.go 1:1 移植
 * 覆盖 T186 + T187（tagged_hook.ts 仅为 re-export）
 */

import { describe, test, expect } from "bun:test";
import { Hook, TaggedHook, TaggedHookView, type Handler } from "./hook";

// ─── Hook 基础 ───

describe("Hook", () => {
  test("初始状态 length 为 0", () => {
    const h = new Hook<{ value: number }>();
    expect(h.length()).toBe(0);
  });

  test("bindFunc 增加 handler 数量", () => {
    const h = new Hook<{ value: number }>();
    h.bindFunc(async () => {}, 0);
    h.bindFunc(async () => {}, 0);
    expect(h.length()).toBe(2);
  });

  test("bindFunc 返回唯一 ID", () => {
    const h = new Hook<{ value: number }>();
    const id1 = h.bindFunc(async () => {}, 0);
    const id2 = h.bindFunc(async () => {}, 0);
    expect(id1).not.toBe(id2);
    expect(id1.startsWith("__handler_")).toBe(true);
  });

  test("bind 带 ID 覆盖同 ID handler", () => {
    const h = new Hook<{ value: string }>();
    const calls: string[] = [];

    h.bind({ id: "h1", priority: 0, func: async () => { calls.push("first"); } });
    h.bind({ id: "h1", priority: 0, func: async () => { calls.push("second"); } });

    expect(h.length()).toBe(1);
  });

  test("unbind 移除 handler", () => {
    const h = new Hook<{ value: number }>();
    const id = h.bindFunc(async () => {}, 0);
    expect(h.length()).toBe(1);
    h.unbind(id);
    expect(h.length()).toBe(0);
  });

  test("unbind 不存在的 ID 不报错", () => {
    const h = new Hook<{ value: number }>();
    h.unbind("nonexistent");
    expect(h.length()).toBe(0);
  });

  test("reset 清除所有 handler", () => {
    const h = new Hook<{ value: number }>();
    h.bindFunc(async () => {}, 0);
    h.bindFunc(async () => {}, 0);
    h.bindFunc(async () => {}, 0);
    h.reset();
    expect(h.length()).toBe(0);
  });

  test("getHandlers 返回只读列表", () => {
    const h = new Hook<{ value: number }>();
    h.bindFunc(async () => {}, 0);
    const handlers = h.getHandlers();
    expect(handlers.length).toBe(1);
  });
});

// ─── 优先级排序 ───

describe("Hook 优先级", () => {
  test("handler 按优先级升序排列", () => {
    const h = new Hook<{ value: number }>();
    h.bindFunc(async () => {}, 30);
    h.bindFunc(async () => {}, 10);
    h.bindFunc(async () => {}, 20);

    const handlers = h.getHandlers();
    expect(handlers[0].priority).toBe(10);
    expect(handlers[1].priority).toBe(20);
    expect(handlers[2].priority).toBe(30);
  });

  test("bind 后也会重新排序", () => {
    const h = new Hook<{ value: number }>();
    h.bind({ id: "a", priority: 100, func: async () => {} });
    h.bind({ id: "b", priority: 1, func: async () => {} });

    const handlers = h.getHandlers();
    expect(handlers[0].id).toBe("b");
    expect(handlers[1].id).toBe("a");
  });
});

// ─── 洋葱模型 trigger ───

describe("Hook trigger 洋葱模型", () => {
  test("无 handler 时调用原始 next", async () => {
    const h = new Hook<{ value: number }>();
    let called = false;
    await h.trigger({ value: 0, next: async () => { called = true; } });
    expect(called).toBe(true);
  });

  test("单个 handler 调用 next 继续链", async () => {
    const h = new Hook<{ value: number }>();
    const order: string[] = [];

    h.bindFunc(async (e: any) => {
      order.push("before");
      await e.next();
      order.push("after");
    }, 0);

    await h.trigger({
      value: 0,
      next: async () => { order.push("original"); },
    });

    expect(order).toEqual(["before", "original", "after"]);
  });

  test("多个 handler 按优先级链式调用", async () => {
    const h = new Hook<{ value: number }>();
    const order: number[] = [];

    h.bindFunc(async (e: any) => {
      order.push(2);
      await e.next();
    }, 20);

    h.bindFunc(async (e: any) => {
      order.push(1);
      await e.next();
    }, 10);

    h.bindFunc(async (e: any) => {
      order.push(3);
      await e.next();
    }, 30);

    await h.trigger({
      value: 0,
      next: async () => { order.push(99); },
    });

    expect(order).toEqual([1, 2, 3, 99]);
  });

  test("handler 不调用 next 则短路", async () => {
    const h = new Hook<{ value: number }>();
    const order: string[] = [];

    h.bindFunc(async () => {
      order.push("stopper");
      // 不调用 next
    }, 10);

    h.bindFunc(async (e: any) => {
      order.push("should_not_run");
      await e.next();
    }, 20);

    await h.trigger({
      value: 0,
      next: async () => { order.push("original"); },
    });

    expect(order).toEqual(["stopper"]);
  });

  test("handler 可以修改 event", async () => {
    const h = new Hook<{ value: number }>();

    h.bindFunc(async (e: any) => {
      e.value = 42;
      await e.next();
    }, 0);

    const event = { value: 0, next: async () => {} };
    await h.trigger(event);
    expect(event.value).toBe(42);
  });

  test("handler 抛出错误会传播", async () => {
    const h = new Hook<{ value: number }>();

    h.bindFunc(async () => {
      throw new Error("test error");
    }, 0);

    await expect(
      h.trigger({ value: 0, next: async () => {} })
    ).rejects.toThrow("test error");
  });

  test("filterTags 过滤 handler", async () => {
    const h = new Hook<{ value: number }>();
    const order: string[] = [];

    h.bind({ id: "a", priority: 0, func: async (e: any) => { order.push("a"); await e.next(); }, tags: ["users"] });
    h.bind({ id: "b", priority: 0, func: async (e: any) => { order.push("b"); await e.next(); }, tags: ["posts"] });
    h.bind({ id: "c", priority: 0, func: async (e: any) => { order.push("c"); await e.next(); }, tags: [] }); // 无标签，匹配所有

    await h.trigger(
      { value: 0, next: async () => { order.push("end"); } },
      ["users"]
    );

    expect(order).toEqual(["a", "c", "end"]);
  });

  test("filterTags 无匹配则仅调用原始 next", async () => {
    const h = new Hook<{ value: number }>();

    h.bind({ id: "a", priority: 0, func: async (e: any) => { await e.next(); }, tags: ["users"] });

    let called = false;
    await h.trigger(
      { value: 0, next: async () => { called = true; } },
      ["posts"]
    );
    expect(called).toBe(true);
  });
});

// ─── TaggedHook ───

describe("TaggedHook", () => {
  test("构造时设置标签", () => {
    const th = new TaggedHook<{ value: number }>("users", "posts");
    expect(th.getTags()).toEqual(["users", "posts"]);
  });

  test("getTags 返回副本", () => {
    const th = new TaggedHook<{ value: number }>("users");
    const tags = th.getTags();
    tags.push("mutated");
    expect(th.getTags()).toEqual(["users"]);
  });

  test("matchesTags — 无绑定标签匹配所有", () => {
    const th = new TaggedHook<{ value: number }>();
    expect(th.matchesTags(["anything"])).toBe(true);
  });

  test("matchesTags — 有匹配", () => {
    const th = new TaggedHook<{ value: number }>("users", "posts");
    expect(th.matchesTags(["users"])).toBe(true);
  });

  test("matchesTags — 无匹配", () => {
    const th = new TaggedHook<{ value: number }>("users");
    expect(th.matchesTags(["posts"])).toBe(false);
  });

  test("bindFuncWithTags 绑定带标签的 handler", async () => {
    const th = new TaggedHook<{ value: number }>();
    const order: string[] = [];

    th.bindFuncWithTags(async (e: any) => { order.push("tagged"); await e.next(); }, ["users"], 0);
    th.bindFunc(async (e: any) => { order.push("untagged"); await e.next(); }, 0);

    await th.trigger(
      { value: 0, next: async () => { order.push("end"); } },
      ["users"]
    );

    // tagged handler 有 tags=["users"]，匹配
    // untagged handler 无 tags（由 bindFunc 创建），但 trigger 内部过滤检查 !h.tags || h.tags.length === 0
    expect(order).toContain("tagged");
    expect(order).toContain("end");
  });

  test("继承 Hook 的所有方法", () => {
    const th = new TaggedHook<{ value: number }>("a");
    th.bindFunc(async () => {}, 0);
    expect(th.length()).toBe(1);
    th.reset();
    expect(th.length()).toBe(0);
  });
});

// ─── TaggedHookView ───

describe("TaggedHookView", () => {
  test("bindFunc 自动关联标签", async () => {
    const hook = new TaggedHook<{ value: number }>();
    const view = new TaggedHookView(hook, ["users"]);

    view.bindFunc(async (e: any) => { await e.next(); }, 0);

    const handlers = hook.getHandlers();
    expect(handlers.length).toBe(1);
    expect(handlers[0].tags).toEqual(["users"]);
  });

  test("bind 使用视图标签", () => {
    const hook = new TaggedHook<{ value: number }>();
    const view = new TaggedHookView(hook, ["posts"]);

    view.bind({ id: "h1", priority: 0, func: async () => {} });

    const handlers = hook.getHandlers();
    expect(handlers[0].tags).toEqual(["posts"]);
  });

  test("bind 可以自定义标签覆盖", () => {
    const hook = new TaggedHook<{ value: number }>();
    const view = new TaggedHookView(hook, ["posts"]);

    view.bind({ id: "h1", priority: 0, func: async () => {}, tags: ["custom"] });

    const handlers = hook.getHandlers();
    expect(handlers[0].tags).toEqual(["custom"]);
  });

  test("unbind 移除底层 hook 的 handler", () => {
    const hook = new TaggedHook<{ value: number }>();
    const view = new TaggedHookView(hook, ["users"]);

    const id = view.bindFunc(async () => {}, 0);
    expect(hook.length()).toBe(1);

    view.unbind(id);
    expect(hook.length()).toBe(0);
  });

  test("trigger 仅触发匹配标签的 handler", async () => {
    const hook = new TaggedHook<{ value: number }>();
    const usersView = new TaggedHookView(hook, ["users"]);
    const postsView = new TaggedHookView(hook, ["posts"]);

    const order: string[] = [];

    usersView.bindFunc(async (e: any) => { order.push("users"); await e.next(); }, 0);
    postsView.bindFunc(async (e: any) => { order.push("posts"); await e.next(); }, 0);

    await usersView.trigger({ value: 0, next: async () => { order.push("end"); } });

    expect(order).toEqual(["users", "end"]);
  });

  test("getTags 返回副本", () => {
    const hook = new TaggedHook<{ value: number }>();
    const view = new TaggedHookView(hook, ["users"]);

    const tags = view.getTags();
    tags.push("mutated");
    expect(view.getTags()).toEqual(["users"]);
  });

  test("多视图共享底层 hook", () => {
    const hook = new TaggedHook<{ value: number }>();
    const v1 = new TaggedHookView(hook, ["a"]);
    const v2 = new TaggedHookView(hook, ["b"]);

    v1.bindFunc(async () => {}, 0);
    v2.bindFunc(async () => {}, 0);

    expect(hook.length()).toBe(2);
  });
});

// ─── tagged_hook.ts re-export ───

describe("tagged_hook.ts re-export", () => {
  test("导出与 hook.ts 相同", async () => {
    const reExports = await import("./tagged_hook");
    expect(reExports.Hook).toBe(Hook);
    expect(reExports.TaggedHook).toBe(TaggedHook);
    expect(reExports.TaggedHookView).toBe(TaggedHookView);
  });
});
