/**
 * CRUD Commands Tests (Task 1.2)
 *
 * TDD: 红灯 → 绿灯
 */

import { describe, test, expect } from "bun:test";
import { getCommand, COMMANDS } from "../../../src/lib/commands.js";

describe("CRUD Commands", () => {
  test("getCommand returns /create command", () => {
    const cmd = getCommand("/create");
    
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe("/create");
    expect(cmd?.description).toContain("Create");
  });

  test("/create has collection resource argument", () => {
    const cmd = getCommand("/create");
    
    expect(cmd?.args).toBeDefined();
    expect(cmd?.args?.length).toBeGreaterThan(0);
    
    const collectionArg = cmd?.args?.find(a => a.name === "collection");
    expect(collectionArg).toBeDefined();
    expect(collectionArg?.type).toBe("resource");
    expect(collectionArg?.required).toBe(true);
  });

  test("getCommand returns /edit command", () => {
    const cmd = getCommand("/edit");
    
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe("/edit");
    expect(cmd?.description).toContain("Edit");
  });

  test("/edit has resource argument with collection:id format", () => {
    const cmd = getCommand("/edit");
    
    expect(cmd?.args).toBeDefined();
    const resourceArg = cmd?.args?.find(a => a.name === "resource");
    expect(resourceArg).toBeDefined();
    expect(resourceArg?.type).toBe("resource");
    expect(resourceArg?.required).toBe(true);
    expect(resourceArg?.description).toContain("@collection:id");
  });

  test("getCommand returns /delete command", () => {
    const cmd = getCommand("/delete");
    
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe("/delete");
    expect(cmd?.description).toContain("Delete");
  });

  test("/delete has -f flag argument", () => {
    const cmd = getCommand("/delete");
    
    expect(cmd?.args).toBeDefined();
    const forceArg = cmd?.args?.find(a => a.name === "-f" || a.name === "force");
    expect(forceArg).toBeDefined();
    expect(forceArg?.type).toBe("boolean");
    expect(forceArg?.required).toBe(false);
  });

  test("/delete has resource argument", () => {
    const cmd = getCommand("/delete");
    
    const resourceArg = cmd?.args?.find(a => a.name === "resource");
    expect(resourceArg).toBeDefined();
    expect(resourceArg?.type).toBe("resource");
    expect(resourceArg?.required).toBe(true);
  });

  test("COMMANDS array includes CRUD commands", () => {
    const commandNames = COMMANDS.map(c => c.name);
    
    expect(commandNames).toContain("/create");
    expect(commandNames).toContain("/edit");
    expect(commandNames).toContain("/delete");
  });

  test("/create has examples", () => {
    const cmd = getCommand("/create");
    
    expect(cmd?.examples).toBeDefined();
    expect(cmd?.examples?.length).toBeGreaterThan(0);
    expect(cmd?.examples?.some(e => e.includes("@"))).toBe(true);
  });

  test("/edit has examples", () => {
    const cmd = getCommand("/edit");
    
    expect(cmd?.examples).toBeDefined();
    expect(cmd?.examples?.length).toBeGreaterThan(0);
    expect(cmd?.examples?.some(e => e.includes(":"))).toBe(true);
  });

  test("/delete has examples including -f flag", () => {
    const cmd = getCommand("/delete");
    
    expect(cmd?.examples).toBeDefined();
    expect(cmd?.examples?.some(e => e.includes("-f"))).toBe(true);
  });
});
