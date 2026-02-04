/**
 * Field Validation (Task 5.1)
 *
 * Comprehensive validation functions for form fields
 */

import { validateFieldValue, type FieldType } from "./fieldTypes.js";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Field schema for validation
 */
export interface FieldSchema {
  name: string;
  type: FieldType | string;
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  options?: string[];
}

/**
 * Form data type
 */
export type FormData = Record<string, unknown>;

/**
 * Form validation result
 */
export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Field error for aggregation
 */
export interface FieldError {
  field: string;
  error: string;
}

/**
 * Validate required field
 */
export function validateRequired(
  value: unknown,
  required: boolean
): ValidationResult {
  if (!required) {
    return { valid: true };
  }

  if (value === null || value === undefined || value === "") {
    return { valid: false, error: "This field is required" };
  }

  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(value: unknown): ValidationResult {
  if (value === null || value === undefined || value === "") {
    return { valid: true };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(value))) {
    return { valid: false, error: "Must be a valid email address" };
  }

  return { valid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(value: unknown): ValidationResult {
  if (value === null || value === undefined || value === "") {
    return { valid: true };
  }

  try {
    new URL(String(value));
    return { valid: true };
  } catch {
    return { valid: false, error: "Must be a valid URL" };
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  options: { min?: number; max?: number }
): ValidationResult {
  if (options.min !== undefined && value < options.min) {
    return { valid: false, error: `Must be at least ${options.min}` };
  }

  if (options.max !== undefined && value > options.max) {
    return { valid: false, error: `Must be at most ${options.max}` };
  }

  return { valid: true };
}

/**
 * Validate text length
 */
export function validateTextLength(
  value: string,
  options: { minLength?: number; maxLength?: number }
): ValidationResult {
  if (options.minLength !== undefined && value.length < options.minLength) {
    return { valid: false, error: `Must be at least ${options.minLength} characters` };
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    return { valid: false, error: `Must be at most ${options.maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Aggregate field errors into a record
 */
export function aggregateErrors(
  errors: FieldError[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const { field, error } of errors) {
    result[field] = error;
  }

  return result;
}

/**
 * Validate a single field
 */
function validateSingleField(
  schema: FieldSchema,
  value: unknown
): ValidationResult {
  // Check required
  const requiredResult = validateRequired(value, schema.required ?? false);
  if (!requiredResult.valid) {
    return requiredResult;
  }

  // Skip further validation if empty and not required
  if (value === null || value === undefined || value === "") {
    return { valid: true };
  }

  // Type-specific validation
  switch (schema.type) {
    case "email":
      return validateEmail(value);

    case "url":
      return validateUrl(value);

    case "number": {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(num)) {
        return { valid: false, error: "Must be a valid number" };
      }
      return validateNumberRange(num, { min: schema.min, max: schema.max });
    }

    case "text":
    case "editor": {
      if (schema.minLength !== undefined || schema.maxLength !== undefined) {
        return validateTextLength(String(value), {
          minLength: schema.minLength,
          maxLength: schema.maxLength,
        });
      }
      return { valid: true };
    }

    case "select": {
      if (schema.options && schema.options.length > 0) {
        const val = String(value);
        if (!schema.options.includes(val)) {
          return {
            valid: false,
            error: `Must be one of: ${schema.options.join(", ")}`,
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
 * Validate entire form
 */
export function validateForm(
  schema: FieldSchema[],
  data: FormData
): FormValidationResult {
  const errors: FieldError[] = [];

  for (const field of schema) {
    const value = data[field.name];
    const result = validateSingleField(field, value);

    if (!result.valid && result.error) {
      errors.push({ field: field.name, error: result.error });
    }
  }

  return {
    valid: errors.length === 0,
    errors: aggregateErrors(errors),
  };
}
