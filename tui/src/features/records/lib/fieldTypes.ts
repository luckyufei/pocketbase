/**
 * Field Types (Task 4.1-4.4)
 *
 * Handles parsing, formatting, and validation for different field types
 */

/**
 * Supported field types
 */
export type FieldType =
  | "text"
  | "number"
  | "bool"
  | "select"
  | "date"
  | "json"
  | "relation"
  | "email"
  | "url"
  | "editor"
  | "file";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  pattern?: string;
}

/**
 * Parse a field value from string input
 */
export function parseFieldValue(
  type: FieldType,
  value: unknown
): unknown {
  if (value === null || value === undefined) {
    return getFieldDefaultValue(type);
  }

  switch (type) {
    case "text":
    case "email":
    case "url":
    case "editor":
      return String(value);

    case "number": {
      if (typeof value === "number") return value;
      const num = parseFloat(String(value));
      return isNaN(num) ? 0 : num;
    }

    case "bool": {
      if (typeof value === "boolean") return value;
      const str = String(value).toLowerCase();
      return str === "true" || str === "1" || str === "yes";
    }

    case "select":
      // Can be string or array
      return value;

    case "date":
      return String(value);

    case "json": {
      if (typeof value === "object") return value;
      try {
        return JSON.parse(String(value));
      } catch {
        return null;
      }
    }

    case "relation":
      // Can be string or array
      return value;

    case "file":
      return value;

    default:
      return value;
  }
}

/**
 * Format a field value for display
 */
export function formatFieldValue(
  type: FieldType,
  value: unknown
): string {
  if (value === null || value === undefined) {
    return "";
  }

  switch (type) {
    case "text":
    case "email":
    case "url":
    case "editor":
    case "date":
      return String(value);

    case "number":
      return String(value);

    case "bool":
      return value ? "true" : "false";

    case "select":
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);

    case "json":
      if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
      }
      return String(value);

    case "relation":
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);

    case "file":
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Validate a field value
 */
export function validateFieldValue(
  type: FieldType,
  value: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  // Check required
  if (options.required) {
    if (value === null || value === undefined || value === "") {
      return { valid: false, error: "This field is required" };
    }
  }

  // Skip validation for empty non-required fields
  if (value === null || value === undefined || value === "") {
    return { valid: true };
  }

  switch (type) {
    case "number": {
      const num = parseFloat(String(value));
      if (isNaN(num)) {
        return { valid: false, error: "Must be a valid number" };
      }
      if (options.min !== undefined && num < options.min) {
        return { valid: false, error: `Must be at least ${options.min}` };
      }
      if (options.max !== undefined && num > options.max) {
        return { valid: false, error: `Must be at most ${options.max}` };
      }
      return { valid: true };
    }

    case "email": {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        return { valid: false, error: "Must be a valid email address" };
      }
      return { valid: true };
    }

    case "url": {
      try {
        new URL(String(value));
        return { valid: true };
      } catch {
        return { valid: false, error: "Must be a valid URL" };
      }
    }

    case "date": {
      const dateStr = String(value);
      // Check ISO date format
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
      if (!isoDateRegex.test(dateStr)) {
        return { valid: false, error: "Must be a valid date format" };
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return { valid: false, error: "Must be a valid date" };
      }
      return { valid: true };
    }

    case "json": {
      if (typeof value === "object") {
        return { valid: true };
      }
      try {
        JSON.parse(String(value));
        return { valid: true };
      } catch {
        return { valid: false, error: "Must be valid JSON" };
      }
    }

    case "select": {
      if (options.options && options.options.length > 0) {
        const val = String(value);
        if (!options.options.includes(val)) {
          return {
            valid: false,
            error: `Must be one of: ${options.options.join(", ")}`,
          };
        }
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

/**
 * Get default value for a field type
 */
export function getFieldDefaultValue(type: FieldType): unknown {
  switch (type) {
    case "text":
    case "email":
    case "url":
    case "editor":
    case "date":
      return "";

    case "number":
      return 0;

    case "bool":
      return false;

    case "select":
    case "json":
    case "relation":
    case "file":
      return null;

    default:
      return null;
  }
}
