/**
 * CLI Tests - TDD Red/Green
 */

import { describe, test, expect } from "bun:test";
import { parseArgs, type CLIOptions } from "../src/cli.js";

describe("CLI", () => {
  describe("parseArgs", () => {
    test("should use default URL when no args provided", () => {
      const result = parseArgs(["node", "pbtui"]);
      expect(result.url).toBe("http://127.0.0.1:8090");
    });

    test("should parse --url argument", () => {
      const result = parseArgs(["node", "pbtui", "--url", "http://localhost:3000"]);
      expect(result.url).toBe("http://localhost:3000");
    });

    test("should parse -u short argument", () => {
      const result = parseArgs(["node", "pbtui", "-u", "http://example.com:8090"]);
      expect(result.url).toBe("http://example.com:8090");
    });

    test("should parse --token argument", () => {
      const result = parseArgs(["node", "pbtui", "--token", "test_token_123"]);
      expect(result.token).toBe("test_token_123");
    });

    test("should parse -t short argument", () => {
      const result = parseArgs(["node", "pbtui", "-t", "short_token"]);
      expect(result.token).toBe("short_token");
    });

    test("should parse both url and token", () => {
      const result = parseArgs([
        "node", "pbtui",
        "--url", "http://prod.example.com:8090",
        "--token", "prod_token"
      ]);
      expect(result.url).toBe("http://prod.example.com:8090");
      expect(result.token).toBe("prod_token");
    });

    test("should return undefined token when not provided", () => {
      const result = parseArgs(["node", "pbtui"]);
      expect(result.token).toBeUndefined();
    });
  });
});
