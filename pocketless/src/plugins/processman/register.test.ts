/**
 * T183: ProcessMan 插件完整测试
 * 对照 Go 版 — 进程启停/重启/crash、日志采集、状态监控、环境变量覆盖
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MustRegister,
  defaultConfig,
  applyEnvOverrides,
  MemoryProcessManager,
  type ProcessConfig,
  type ProcessManagerConfig,
} from "./register";

// ─── 辅助工厂 ──────────────────────────────────────────────────

function makePM(overrides: Partial<ProcessManagerConfig> = {}): MemoryProcessManager {
  return new MemoryProcessManager({ ...defaultConfig(), ...overrides });
}

describe("ProcessMan Plugin", () => {

  // ============================================================
  // defaultConfig
  // ============================================================

  describe("defaultConfig", () => {
    test("返回默认配置", () => {
      const cfg = defaultConfig();
      expect(cfg.configFile).toBe("pb_processes.json");
      expect(cfg.maxLogLines).toBe(1000);
    });

    test("每次返回新对象", () => {
      expect(defaultConfig()).not.toBe(defaultConfig());
    });
  });

  // ============================================================
  // applyEnvOverrides
  // ============================================================

  describe("applyEnvOverrides", () => {
    function clean() {
      delete process.env.PB_PROCESSMAN_CONFIG_FILE;
      delete process.env.PB_PROCESSMAN_MAX_LOG_LINES;
    }

    test("无环境变量时原样返回配置", () => {
      clean();
      const cfg = defaultConfig();
      const result = applyEnvOverrides(cfg);
      expect(result).toEqual(cfg);
      expect(result).not.toBe(cfg);
    });

    test("PB_PROCESSMAN_CONFIG_FILE 覆盖配置文件路径", () => {
      process.env.PB_PROCESSMAN_CONFIG_FILE = "custom_processes.json";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.configFile).toBe("custom_processes.json");
      } finally { clean(); }
    });

    test("PB_PROCESSMAN_MAX_LOG_LINES 覆盖日志上限", () => {
      process.env.PB_PROCESSMAN_MAX_LOG_LINES = "500";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.maxLogLines).toBe(500);
      } finally { clean(); }
    });

    test("无效数字不覆盖", () => {
      process.env.PB_PROCESSMAN_MAX_LOG_LINES = "abc";
      try {
        const result = applyEnvOverrides(defaultConfig());
        expect(result.maxLogLines).toBe(1000); // 保持默认
      } finally { clean(); }
    });

    test("原始配置对象不被修改", () => {
      process.env.PB_PROCESSMAN_CONFIG_FILE = "changed.json";
      try {
        const cfg = defaultConfig();
        applyEnvOverrides(cfg);
        expect(cfg.configFile).toBe("pb_processes.json");
      } finally { clean(); }
    });
  });

  // ============================================================
  // MustRegister
  // ============================================================

  describe("MustRegister", () => {
    test("返回 MemoryProcessManager", () => {
      expect(MustRegister(null)).toBeDefined();
    });

    test("使用自定义配置", () => {
      const pm = MustRegister(null, { configFile: "custom.json" });
      expect(pm).toBeDefined();
    });

    test("无参数不抛错", () => {
      expect(() => MustRegister(null)).not.toThrow();
    });

    test("getConfig 返回配置副本", () => {
      const pm = makePM({ configFile: "test.json" });
      const cfg = pm.getConfig();
      expect(cfg.configFile).toBe("test.json");
    });
  });

  // ============================================================
  // addProcessConfig + list + getProcess
  // ============================================================

  describe("addProcessConfig + list + getProcess", () => {
    let pm: MemoryProcessManager;
    beforeEach(() => { pm = makePM(); });

    test("初始无进程", () => {
      expect(pm.list()).toEqual([]);
    });

    test("添加进程配置", () => {
      pm.addProcessConfig({ id: "w1", command: "node", args: ["worker.js"] });
      expect(pm.list()).toHaveLength(1);
      expect(pm.list()[0].id).toBe("w1");
      expect(pm.list()[0].status).toBe("stopped");
    });

    test("添加多个进程", () => {
      pm.addProcessConfig({ id: "w1" });
      pm.addProcessConfig({ id: "w2" });
      pm.addProcessConfig({ id: "w3" });
      expect(pm.list()).toHaveLength(3);
    });

    test("初始状态字段完整", () => {
      pm.addProcessConfig({ id: "w1" });
      const s = pm.list()[0];
      expect(s.status).toBe("stopped");
      expect(s.pid).toBeNull();
      expect(s.startTime).toBeNull();
      expect(s.uptime).toBe(0);
      expect(s.restartCount).toBe(0);
      expect(s.lastError).toBe("");
    });

    test("重复 addProcessConfig 不重置运行时状态", async () => {
      pm.addProcessConfig({ id: "w1" });
      await pm.start("w1");
      pm.addProcessConfig({ id: "w1", command: "python" }); // 重复添加
      // 进程仍在运行，状态不被重置
      expect(pm.isRunning("w1")).toBe(true);
    });

    test("getProcess 按 id 获取", () => {
      pm.addProcessConfig({ id: "w1" });
      const s = pm.getProcess("w1");
      expect(s).not.toBeNull();
      expect(s!.id).toBe("w1");
    });

    test("getProcess 不存在返回 null", () => {
      expect(pm.getProcess("nonexistent")).toBeNull();
    });

    test("list 返回副本，修改不影响内部", async () => {
      pm.addProcessConfig({ id: "w1" });
      const list = pm.list();
      list[0].status = "crashed" as any;
      expect(pm.getProcess("w1")!.status).toBe("stopped");
    });
  });

  // ============================================================
  // start
  // ============================================================

  describe("start", () => {
    let pm: MemoryProcessManager;
    beforeEach(() => {
      pm = makePM();
      pm.addProcessConfig({ id: "w1" });
    });

    test("启动后状态为 running", async () => {
      await pm.start("w1");
      expect(pm.getProcess("w1")!.status).toBe("running");
    });

    test("启动后分配 pid", async () => {
      await pm.start("w1");
      const pid = pm.getProcess("w1")!.pid;
      expect(pid).not.toBeNull();
      expect(pid!).toBeGreaterThan(0);
    });

    test("启动后设置 startTime", async () => {
      const before = new Date();
      await pm.start("w1");
      const startTime = pm.getProcess("w1")!.startTime;
      expect(startTime).toBeInstanceOf(Date);
      expect(startTime!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    test("启动后 lastError 清空", async () => {
      pm.crash("w1", "some error");
      await pm.restart("w1");
      expect(pm.getProcess("w1")!.lastError).toBe("");
    });

    test("启动不存在的进程抛错", async () => {
      await expect(pm.start("nonexistent")).rejects.toThrow('process "nonexistent" not found');
    });

    test("重复启动抛错", async () => {
      await pm.start("w1");
      await expect(pm.start("w1")).rejects.toThrow('process "w1" already running');
    });

    test("crashed 后可以重新启动", async () => {
      pm.crash("w1", "fatal error");
      await pm.start("w1"); // crashed → running
      expect(pm.isRunning("w1")).toBe(true);
    });
  });

  // ============================================================
  // stop
  // ============================================================

  describe("stop", () => {
    let pm: MemoryProcessManager;
    beforeEach(async () => {
      pm = makePM();
      pm.addProcessConfig({ id: "w1" });
      await pm.start("w1");
    });

    test("停止后状态为 stopped", async () => {
      await pm.stop("w1");
      expect(pm.getProcess("w1")!.status).toBe("stopped");
    });

    test("停止后 pid 为 null", async () => {
      await pm.stop("w1");
      expect(pm.getProcess("w1")!.pid).toBeNull();
    });

    test("停止后 startTime 保留（记录上次启动时间）", async () => {
      const startTime = pm.getProcess("w1")!.startTime;
      await pm.stop("w1");
      expect(pm.getProcess("w1")!.startTime).toEqual(startTime);
    });

    test("停止后 uptime 归零", async () => {
      await pm.stop("w1");
      expect(pm.getProcess("w1")!.uptime).toBe(0);
    });

    test("停止不存在的进程抛错", async () => {
      await expect(pm.stop("nonexistent")).rejects.toThrow('process "nonexistent" not found');
    });

    test("停止已停止的进程不抛错（幂等）", async () => {
      await pm.stop("w1"); // first stop
      await pm.stop("w1"); // second stop — no error
      expect(pm.getProcess("w1")!.status).toBe("stopped");
    });
  });

  // ============================================================
  // restart
  // ============================================================

  describe("restart", () => {
    let pm: MemoryProcessManager;
    beforeEach(async () => {
      pm = makePM();
      pm.addProcessConfig({ id: "w1" });
      await pm.start("w1");
    });

    test("重启后状态为 running", async () => {
      await pm.restart("w1");
      expect(pm.getProcess("w1")!.status).toBe("running");
    });

    test("重启递增 restartCount", async () => {
      await pm.restart("w1");
      expect(pm.getProcess("w1")!.restartCount).toBe(1);
    });

    test("多次重启累加 restartCount", async () => {
      await pm.restart("w1");
      await pm.restart("w1");
      await pm.restart("w1");
      expect(pm.getProcess("w1")!.restartCount).toBe(3);
    });

    test("crashed 状态也可以 restart", async () => {
      pm.crash("w1", "error");
      await pm.restart("w1");
      expect(pm.getProcess("w1")!.status).toBe("running");
    });

    test("stopped 状态可以 restart", async () => {
      await pm.stop("w1");
      await pm.restart("w1");
      expect(pm.getProcess("w1")!.status).toBe("running");
    });

    test("重启不存在的进程抛错", async () => {
      await expect(pm.restart("nonexistent")).rejects.toThrow('process "nonexistent" not found');
    });
  });

  // ============================================================
  // crash
  // ============================================================

  describe("crash", () => {
    let pm: MemoryProcessManager;
    beforeEach(async () => {
      pm = makePM();
      pm.addProcessConfig({ id: "w1" });
      await pm.start("w1");
    });

    test("crash 后状态为 crashed", () => {
      pm.crash("w1", "out of memory");
      expect(pm.getProcess("w1")!.status).toBe("crashed");
    });

    test("crash 后 pid 为 null", () => {
      pm.crash("w1", "segfault");
      expect(pm.getProcess("w1")!.pid).toBeNull();
    });

    test("crash 记录 lastError", () => {
      pm.crash("w1", "timeout exceeded");
      expect(pm.getProcess("w1")!.lastError).toBe("timeout exceeded");
    });

    test("crash 不存在的进程抛错", () => {
      expect(() => pm.crash("nonexistent", "err")).toThrow('process "nonexistent" not found');
    });

    test("isRunning 在 crashed 后返回 false", () => {
      pm.crash("w1", "err");
      expect(pm.isRunning("w1")).toBe(false);
    });
  });

  // ============================================================
  // isRunning
  // ============================================================

  describe("isRunning", () => {
    let pm: MemoryProcessManager;
    beforeEach(() => {
      pm = makePM();
      pm.addProcessConfig({ id: "w1" });
    });

    test("stopped → false", () => { expect(pm.isRunning("w1")).toBe(false); });

    test("running → true", async () => {
      await pm.start("w1");
      expect(pm.isRunning("w1")).toBe(true);
    });

    test("stopped 后 → false", async () => {
      await pm.start("w1");
      await pm.stop("w1");
      expect(pm.isRunning("w1")).toBe(false);
    });

    test("crashed → false", async () => {
      await pm.start("w1");
      pm.crash("w1", "err");
      expect(pm.isRunning("w1")).toBe(false);
    });

    test("不存在的 id → false", () => {
      expect(pm.isRunning("nonexistent")).toBe(false);
    });
  });

  // ============================================================
  // uptime
  // ============================================================

  describe("uptime", () => {
    test("stopped 时 uptime=0", () => {
      const pm = makePM();
      pm.addProcessConfig({ id: "w1" });
      expect(pm.getProcess("w1")!.uptime).toBe(0);
    });

    test("running 时 uptime >= 0", async () => {
      const pm = makePM();
      pm.addProcessConfig({ id: "w1" });
      await pm.start("w1");
      await Bun.sleep(100);
      const s = pm.getProcess("w1")!;
      expect(s.uptime).toBeGreaterThanOrEqual(0);
    });

    test("stop 后 uptime 归零", async () => {
      const pm = makePM();
      pm.addProcessConfig({ id: "w1" });
      await pm.start("w1");
      await pm.stop("w1");
      expect(pm.getProcess("w1")!.uptime).toBe(0);
    });
  });

  // ============================================================
  // getLogs / addLog / clearLogs
  // ============================================================

  describe("getLogs / addLog / clearLogs", () => {
    let pm: MemoryProcessManager;
    beforeEach(() => {
      pm = makePM();
      pm.addProcessConfig({ id: "w1" });
    });

    test("初始无日志", () => {
      expect(pm.getLogs("w1")).toEqual([]);
    });

    test("不存在的进程返回空数组", () => {
      expect(pm.getLogs("nonexistent")).toEqual([]);
    });

    test("addLog 写入日志", () => {
      pm.addLog("w1", "stdout", "hello world");
      const logs = pm.getLogs("w1");
      expect(logs).toHaveLength(1);
      expect(logs[0].content).toBe("hello world");
      expect(logs[0].stream).toBe("stdout");
      expect(logs[0].processId).toBe("w1");
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    test("addLog 支持 stderr", () => {
      pm.addLog("w1", "stderr", "error: segfault");
      const logs = pm.getLogs("w1");
      expect(logs[0].stream).toBe("stderr");
      expect(logs[0].content).toBe("error: segfault");
    });

    test("getLogs limit 截断 — 取最新 N 条", () => {
      for (let i = 0; i < 10; i++) pm.addLog("w1", "stdout", `line ${i}`);
      const logs = pm.getLogs("w1", 3);
      expect(logs).toHaveLength(3);
      expect(logs[2].content).toBe("line 9"); // 最新的 3 条
    });

    test("默认 limit=100", () => {
      for (let i = 0; i < 50; i++) pm.addLog("w1", "stdout", `l${i}`);
      expect(pm.getLogs("w1")).toHaveLength(50);
    });

    test("超出 maxLogLines 时丢弃最旧日志", () => {
      const smallPM = makePM({ maxLogLines: 5 });
      smallPM.addProcessConfig({ id: "w1" });
      for (let i = 0; i < 8; i++) smallPM.addLog("w1", "stdout", `log${i}`);
      const logs = smallPM.getLogs("w1");
      expect(logs).toHaveLength(5);
      expect(logs[0].content).toBe("log3"); // 最旧的 3 条被丢弃
    });

    test("clearLogs 清空日志", () => {
      pm.addLog("w1", "stdout", "msg1");
      pm.addLog("w1", "stdout", "msg2");
      pm.clearLogs("w1");
      expect(pm.getLogs("w1")).toEqual([]);
    });

    test("clearLogs 后可继续写入", () => {
      pm.addLog("w1", "stdout", "old");
      pm.clearLogs("w1");
      pm.addLog("w1", "stdout", "new");
      const logs = pm.getLogs("w1");
      expect(logs).toHaveLength(1);
      expect(logs[0].content).toBe("new");
    });

    test("多进程日志互不干扰", () => {
      pm.addProcessConfig({ id: "w2" });
      pm.addLog("w1", "stdout", "w1 log");
      pm.addLog("w2", "stdout", "w2 log");
      expect(pm.getLogs("w1")[0].content).toBe("w1 log");
      expect(pm.getLogs("w2")[0].content).toBe("w2 log");
    });
  });
});
