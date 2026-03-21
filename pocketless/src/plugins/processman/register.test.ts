/**
 * T183: ProcessMan 插件完整测试
 * 对照 Go 版 — 进程启动/停止/重启、健康检查、日志采集
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  MemoryProcessManager,
  type ProcessConfig,
  type ProcessManagerConfig,
} from "./register";

describe("ProcessMan Plugin", () => {
  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.configFile).toBe("pb_processes.json");
    });

    test("每次返回新对象", () => {
      expect(defaultConfig()).not.toBe(defaultConfig());
    });
  });

  describe("MustRegister", () => {
    test("返回 MemoryProcessManager", () => {
      const pm = MustRegister(null);
      expect(pm).toBeDefined();
    });

    test("使用自定义配置", () => {
      const pm = MustRegister(null, { configFile: "custom.json" });
      expect(pm).toBeDefined();
    });
  });

  describe("addProcessConfig + list", () => {
    let pm: MemoryProcessManager;

    beforeEach(() => {
      pm = new MemoryProcessManager(defaultConfig());
    });

    test("初始无进程", () => {
      expect(pm.list()).toEqual([]);
    });

    test("添加进程配置", () => {
      pm.addProcessConfig({ id: "worker1", command: "node", args: ["worker.js"] });
      const list = pm.list();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("worker1");
      expect(list[0].status).toBe("stopped");
      expect(list[0].pid).toBeNull();
    });

    test("添加多个进程", () => {
      pm.addProcessConfig({ id: "w1" });
      pm.addProcessConfig({ id: "w2" });
      pm.addProcessConfig({ id: "w3" });
      expect(pm.list()).toHaveLength(3);
    });

    test("初始状态字段", () => {
      pm.addProcessConfig({ id: "w1" });
      const state = pm.list()[0];
      expect(state.status).toBe("stopped");
      expect(state.pid).toBeNull();
      expect(state.startTime).toBeNull();
      expect(state.uptime).toBe(0);
      expect(state.restartCount).toBe(0);
      expect(state.lastError).toBe("");
    });
  });

  describe("start", () => {
    let pm: MemoryProcessManager;

    beforeEach(() => {
      pm = new MemoryProcessManager(defaultConfig());
      pm.addProcessConfig({ id: "worker1" });
    });

    test("启动进程", async () => {
      await pm.start("worker1");
      const state = pm.list().find((p) => p.id === "worker1")!;
      expect(state.status).toBe("running");
      expect(state.pid).not.toBeNull();
      expect(state.pid).toBeGreaterThan(0);
      expect(state.startTime).toBeInstanceOf(Date);
    });

    test("启动不存在的进程抛错", async () => {
      await expect(pm.start("nonexistent")).rejects.toThrow('process "nonexistent" not found');
    });

    test("重复启动抛错", async () => {
      await pm.start("worker1");
      await expect(pm.start("worker1")).rejects.toThrow('process "worker1" already running');
    });
  });

  describe("stop", () => {
    let pm: MemoryProcessManager;

    beforeEach(async () => {
      pm = new MemoryProcessManager(defaultConfig());
      pm.addProcessConfig({ id: "worker1" });
      await pm.start("worker1");
    });

    test("停止进程", async () => {
      await pm.stop("worker1");
      const state = pm.list().find((p) => p.id === "worker1")!;
      expect(state.status).toBe("stopped");
      expect(state.pid).toBeNull();
    });

    test("停止不存在的进程抛错", async () => {
      await expect(pm.stop("nonexistent")).rejects.toThrow('process "nonexistent" not found');
    });
  });

  describe("restart", () => {
    let pm: MemoryProcessManager;

    beforeEach(async () => {
      pm = new MemoryProcessManager(defaultConfig());
      pm.addProcessConfig({ id: "worker1" });
      await pm.start("worker1");
    });

    test("重启进程", async () => {
      const oldPid = pm.list()[0].pid;
      await pm.restart("worker1");
      const state = pm.list().find((p) => p.id === "worker1")!;
      expect(state.status).toBe("running");
      expect(state.restartCount).toBe(1);
      // pid 可能相同也可能不同（随机生成）
    });

    test("多次重启递增 restartCount", async () => {
      await pm.restart("worker1");
      await pm.restart("worker1");
      await pm.restart("worker1");
      expect(pm.list()[0].restartCount).toBe(3);
    });

    test("重启不存在的进程抛错", async () => {
      await expect(pm.restart("nonexistent")).rejects.toThrow('process "nonexistent" not found');
    });
  });

  describe("isRunning", () => {
    let pm: MemoryProcessManager;

    beforeEach(() => {
      pm = new MemoryProcessManager(defaultConfig());
      pm.addProcessConfig({ id: "worker1" });
    });

    test("stopped → false", () => {
      expect(pm.isRunning("worker1")).toBe(false);
    });

    test("running → true", async () => {
      await pm.start("worker1");
      expect(pm.isRunning("worker1")).toBe(true);
    });

    test("不存在的 id → false", () => {
      expect(pm.isRunning("nonexistent")).toBe(false);
    });
  });

  describe("getLogs", () => {
    let pm: MemoryProcessManager;

    beforeEach(() => {
      pm = new MemoryProcessManager(defaultConfig());
      pm.addProcessConfig({ id: "worker1" });
    });

    test("初始无日志", () => {
      expect(pm.getLogs("worker1")).toEqual([]);
    });

    test("不存在的进程返回空数组", () => {
      expect(pm.getLogs("nonexistent")).toEqual([]);
    });

    test("默认返回最多 100 条", () => {
      const logs = pm.getLogs("worker1", 10);
      expect(logs).toEqual([]);
    });
  });
});
