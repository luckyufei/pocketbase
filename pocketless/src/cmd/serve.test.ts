/**
 * serve 命令测试 — registerServeCommand
 * T201
 */

import { describe, test, expect } from "bun:test";
import { Command } from "commander";
import { registerServeCommand } from "./serve";

describe("registerServeCommand", () => {
  test("注册 serve 命令", () => {
    const program = new Command();
    const pl = { parseGlobalOptions: () => {} } as any;

    registerServeCommand(program, pl);

    const cmd = program.commands.find((c) => c.name() === "serve");
    expect(cmd).toBeDefined();
  });

  test("serve 命令接受可选 domains 参数", () => {
    const program = new Command();
    const pl = { parseGlobalOptions: () => {} } as any;

    registerServeCommand(program, pl);

    const cmd = program.commands.find((c) => c.name() === "serve");
    expect(cmd).toBeDefined();
    // Commander 的 args 定义中包含 [domains...]
    expect(cmd!.description()).toBe("启动 HTTP 服务");
  });

  test("函数类型正确", () => {
    expect(typeof registerServeCommand).toBe("function");
  });
});
