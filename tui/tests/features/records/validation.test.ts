/**
 * Field Validation Tests (Task 5.1-5.4)
 *
 * TDD: 红灯 → 绿灯
 */

import { describe, test, expect } from "bun:test";
import {
  validateForm,
  validateRequired,
  validateEmail,
  validateUrl,
  validateNumberRange,
  validateTextLength,
  aggregateErrors,
  type FieldSchema,
  type FormData,
} from "../../../src/features/records/lib/fieldValidation.js";

describe("Field Validation (Task 5.1)", () => {
  describe("validateRequired", () => {
    test("validates required fields - passes with value", () => {
      const result = validateRequired("Hello", true);
      expect(result.valid).toBe(true);
    });

    test("validates required fields - fails when empty", () => {
      const result = validateRequired("", true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    test("validates required fields - fails when null", () => {
      const result = validateRequired(null, true);
      expect(result.valid).toBe(false);
    });

    test("validates required fields - passes when not required", () => {
      const result = validateRequired("", false);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateEmail", () => {
    test("validates email format - valid email", () => {
      const result = validateEmail("user@example.com");
      expect(result.valid).toBe(true);
    });

    test("validates email format - invalid email", () => {
      const result = validateEmail("not-an-email");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("email");
    });

    test("validates email format - empty is valid", () => {
      const result = validateEmail("");
      expect(result.valid).toBe(true);
    });
  });

  describe("validateUrl", () => {
    test("validates URL format - valid URL", () => {
      const result = validateUrl("https://example.com/path?query=1");
      expect(result.valid).toBe(true);
    });

    test("validates URL format - invalid URL", () => {
      const result = validateUrl("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("URL");
    });

    test("validates URL format - empty is valid", () => {
      const result = validateUrl("");
      expect(result.valid).toBe(true);
    });
  });

  describe("validateNumberRange", () => {
    test("validates number range - within range", () => {
      const result = validateNumberRange(50, { min: 0, max: 100 });
      expect(result.valid).toBe(true);
    });

    test("validates number range - below min", () => {
      const result = validateNumberRange(-5, { min: 0, max: 100 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least");
    });

    test("validates number range - above max", () => {
      const result = validateNumberRange(150, { min: 0, max: 100 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at most");
    });

    test("validates number range - at boundaries", () => {
      expect(validateNumberRange(0, { min: 0, max: 100 }).valid).toBe(true);
      expect(validateNumberRange(100, { min: 0, max: 100 }).valid).toBe(true);
    });
  });

  describe("validateTextLength", () => {
    test("validates text length - within limits", () => {
      const result = validateTextLength("Hello", { minLength: 1, maxLength: 100 });
      expect(result.valid).toBe(true);
    });

    test("validates text length - too short", () => {
      const result = validateTextLength("Hi", { minLength: 5, maxLength: 100 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least");
    });

    test("validates text length - too long", () => {
      const result = validateTextLength("Hello World!", { minLength: 1, maxLength: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at most");
    });
  });

  describe("aggregateErrors", () => {
    test("aggregates multiple errors", () => {
      const errors = aggregateErrors([
        { field: "title", error: "Required" },
        { field: "email", error: "Invalid format" },
        { field: "age", error: "Must be positive" },
      ]);

      expect(errors.title).toBe("Required");
      expect(errors.email).toBe("Invalid format");
      expect(errors.age).toBe("Must be positive");
      expect(Object.keys(errors)).toHaveLength(3);
    });

    test("handles empty errors array", () => {
      const errors = aggregateErrors([]);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test("last error wins for same field", () => {
      const errors = aggregateErrors([
        { field: "title", error: "First error" },
        { field: "title", error: "Second error" },
      ]);

      expect(errors.title).toBe("Second error");
    });
  });
});

describe("Form Validation (Task 5.1)", () => {
  const schema: FieldSchema[] = [
    { name: "title", type: "text", required: true },
    { name: "email", type: "email", required: false },
    { name: "age", type: "number", required: false, min: 0, max: 150 },
    { name: "website", type: "url", required: false },
  ];

  test("validates complete form - all valid", () => {
    const data: FormData = {
      title: "Hello",
      email: "test@example.com",
      age: 25,
      website: "https://example.com",
    };

    const result = validateForm(schema, data);

    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  test("validates complete form - multiple errors", () => {
    const data: FormData = {
      title: "", // required
      email: "invalid-email", // invalid format
      age: 200, // out of range
      website: "not-a-url", // invalid format
    };

    const result = validateForm(schema, data);

    expect(result.valid).toBe(false);
    expect(result.errors.title).toBeDefined();
    expect(result.errors.email).toBeDefined();
    expect(result.errors.age).toBeDefined();
    expect(result.errors.website).toBeDefined();
  });

  test("validates complete form - partial data", () => {
    const data: FormData = {
      title: "Valid Title",
      // other fields not provided
    };

    const result = validateForm(schema, data);

    expect(result.valid).toBe(true);
  });

  test("returns all errors, not just first", () => {
    const data: FormData = {
      title: "",
      email: "bad",
      age: -10,
    };

    const result = validateForm(schema, data);

    expect(Object.keys(result.errors).length).toBeGreaterThan(1);
  });
});

describe("Dirty Detection (Task 5.3)", () => {
  const { computeIsDirty } = require("../../../src/features/records/store/formStateAtom.js");

  test("not dirty on initial load (create mode)", () => {
    const isDirty = computeIsDirty(null, {});
    expect(isDirty).toBe(false);
  });

  test("dirty after field change (create mode)", () => {
    const isDirty = computeIsDirty(null, { title: "New Value" });
    expect(isDirty).toBe(true);
  });

  test("not dirty on initial load (edit mode)", () => {
    const original = { title: "Original" };
    const current = { title: "Original" };
    const isDirty = computeIsDirty(original, current);
    expect(isDirty).toBe(false);
  });

  test("dirty after field change (edit mode)", () => {
    const original = { title: "Original" };
    const current = { title: "Changed" };
    const isDirty = computeIsDirty(original, current);
    expect(isDirty).toBe(true);
  });

  test("not dirty if reverted to original", () => {
    const original = { title: "Original", count: 5 };
    const current = { title: "Original", count: 5 };
    const isDirty = computeIsDirty(original, current);
    expect(isDirty).toBe(false);
  });

  test("dirty with nested object changes", () => {
    const original = { meta: { key: "value" } };
    const current = { meta: { key: "changed" } };
    const isDirty = computeIsDirty(original, current);
    expect(isDirty).toBe(true);
  });
});

describe("Exit Confirmation (Task 5.4)", () => {
  const { shouldConfirmExit } = require("../../../src/features/records/lib/exitConfirmation.js");

  test("exits directly if not dirty", () => {
    const result = shouldConfirmExit(false);
    expect(result).toBe(false);
  });

  test("shows confirm if dirty", () => {
    const result = shouldConfirmExit(true);
    expect(result).toBe(true);
  });
});
