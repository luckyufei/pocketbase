/**
 * Advanced Fields Tests (Task 4.1-4.4)
 *
 * TDD: 红灯 → 绿灯
 */

import { describe, test, expect } from "bun:test";
import {
  parseFieldValue,
  formatFieldValue,
  validateFieldValue,
  getFieldDefaultValue,
  type FieldType,
} from "../../../src/features/records/lib/fieldTypes.js";

describe("Field Types (Task 4.1-4.4)", () => {
  describe("Text Field", () => {
    test("parses text value", () => {
      const result = parseFieldValue("text", "Hello World");
      expect(result).toBe("Hello World");
    });

    test("formats text value", () => {
      const result = formatFieldValue("text", "Hello");
      expect(result).toBe("Hello");
    });

    test("handles empty text", () => {
      const result = parseFieldValue("text", "");
      expect(result).toBe("");
    });

    test("default value is empty string", () => {
      const result = getFieldDefaultValue("text");
      expect(result).toBe("");
    });
  });

  describe("Number Field", () => {
    test("parses number value", () => {
      const result = parseFieldValue("number", "42");
      expect(result).toBe(42);
    });

    test("parses decimal number", () => {
      const result = parseFieldValue("number", "3.14");
      expect(result).toBe(3.14);
    });

    test("validates numeric input", () => {
      const result = validateFieldValue("number", "123");
      expect(result.valid).toBe(true);
    });

    test("rejects non-numeric input", () => {
      const result = validateFieldValue("number", "not a number");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("number");
    });

    test("parses negative numbers", () => {
      const result = parseFieldValue("number", "-10");
      expect(result).toBe(-10);
    });

    test("default value is 0", () => {
      const result = getFieldDefaultValue("number");
      expect(result).toBe(0);
    });
  });

  describe("Bool Field", () => {
    test("parses true value", () => {
      const result = parseFieldValue("bool", "true");
      expect(result).toBe(true);
    });

    test("parses false value", () => {
      const result = parseFieldValue("bool", "false");
      expect(result).toBe(false);
    });

    test("toggles boolean value", () => {
      const toggled = !parseFieldValue("bool", "true");
      expect(toggled).toBe(false);
    });

    test("default value is false", () => {
      const result = getFieldDefaultValue("bool");
      expect(result).toBe(false);
    });
  });

  describe("Select Field", () => {
    test("parses single select value", () => {
      const result = parseFieldValue("select", "option1");
      expect(result).toBe("option1");
    });

    test("parses multi-select value as array", () => {
      const result = parseFieldValue("select", ["opt1", "opt2"]);
      expect(result).toEqual(["opt1", "opt2"]);
    });

    test("validates against options", () => {
      const options = ["a", "b", "c"];
      const result = validateFieldValue("select", "b", { options });
      expect(result.valid).toBe(true);
    });

    test("rejects invalid option", () => {
      const options = ["a", "b", "c"];
      const result = validateFieldValue("select", "d", { options });
      expect(result.valid).toBe(false);
    });

    test("default value is null", () => {
      const result = getFieldDefaultValue("select");
      expect(result).toBeNull();
    });
  });

  describe("Date Field", () => {
    test("accepts ISO date format", () => {
      const result = parseFieldValue("date", "2024-01-15");
      expect(result).toBe("2024-01-15");
    });

    test("accepts datetime format", () => {
      const result = parseFieldValue("date", "2024-01-15T10:30:00Z");
      expect(result).toBe("2024-01-15T10:30:00Z");
    });

    test("validates date format", () => {
      const result = validateFieldValue("date", "2024-01-15");
      expect(result.valid).toBe(true);
    });

    test("rejects invalid date format", () => {
      const result = validateFieldValue("date", "not-a-date");
      expect(result.valid).toBe(false);
    });

    test("formats date for display", () => {
      const result = formatFieldValue("date", "2024-01-15T10:30:00Z");
      expect(typeof result).toBe("string");
    });

    test("default value is empty string", () => {
      const result = getFieldDefaultValue("date");
      expect(result).toBe("");
    });
  });

  describe("JSON Field", () => {
    test("parses valid JSON string", () => {
      const result = parseFieldValue("json", '{"key": "value"}');
      expect(result).toEqual({ key: "value" });
    });

    test("validates JSON syntax", () => {
      const result = validateFieldValue("json", '{"valid": true}');
      expect(result.valid).toBe(true);
    });

    test("shows syntax error for invalid JSON", () => {
      const result = validateFieldValue("json", '{invalid}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("JSON");
    });

    test("parses JSON arrays", () => {
      const result = parseFieldValue("json", '[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    test("handles already parsed objects", () => {
      const obj = { key: "value" };
      const result = parseFieldValue("json", obj);
      expect(result).toEqual(obj);
    });

    test("default value is null", () => {
      const result = getFieldDefaultValue("json");
      expect(result).toBeNull();
    });
  });

  describe("Relation Field", () => {
    test("parses relation ID", () => {
      const result = parseFieldValue("relation", "abc123");
      expect(result).toBe("abc123");
    });

    test("parses multiple relation IDs", () => {
      const result = parseFieldValue("relation", ["id1", "id2"]);
      expect(result).toEqual(["id1", "id2"]);
    });

    test("formats single relation", () => {
      const result = formatFieldValue("relation", "abc123");
      expect(result).toBe("abc123");
    });

    test("formats multiple relations", () => {
      const result = formatFieldValue("relation", ["id1", "id2"]);
      expect(result).toBe("id1, id2");
    });

    test("default value is null", () => {
      const result = getFieldDefaultValue("relation");
      expect(result).toBeNull();
    });
  });

  describe("Email Field", () => {
    test("parses email value", () => {
      const result = parseFieldValue("email", "test@example.com");
      expect(result).toBe("test@example.com");
    });

    test("validates valid email", () => {
      const result = validateFieldValue("email", "user@domain.com");
      expect(result.valid).toBe(true);
    });

    test("rejects invalid email", () => {
      const result = validateFieldValue("email", "not-an-email");
      expect(result.valid).toBe(false);
    });

    test("default value is empty string", () => {
      const result = getFieldDefaultValue("email");
      expect(result).toBe("");
    });
  });

  describe("URL Field", () => {
    test("parses URL value", () => {
      const result = parseFieldValue("url", "https://example.com");
      expect(result).toBe("https://example.com");
    });

    test("validates valid URL", () => {
      const result = validateFieldValue("url", "https://example.com/path");
      expect(result.valid).toBe(true);
    });

    test("rejects invalid URL", () => {
      const result = validateFieldValue("url", "not-a-url");
      expect(result.valid).toBe(false);
    });

    test("default value is empty string", () => {
      const result = getFieldDefaultValue("url");
      expect(result).toBe("");
    });
  });
});
