/**
 * Field Input Component (Task 3.2)
 *
 * A generic field input component that renders the appropriate
 * input control based on field type.
 *
 * Supports: text, number, bool, select, date, json, relation, email, url
 */

import React, { useState, useCallback } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { SchemaField } from "../store/formStateAtom.js";
import {
  parseFieldValue,
  formatFieldValue,
  getFieldPlaceholder,
} from "../lib/fieldTypes.js";

export interface FieldInputProps {
  /** Field schema definition */
  field: SchemaField & {
    options?: {
      values?: string[];
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
    };
  };
  /** Current value */
  value: unknown;
  /** Called when value changes */
  onChange: (value: unknown) => void;
  /** Whether this field is focused */
  isFocused: boolean;
  /** Error message for this field */
  error?: string;
}

/**
 * Text/Editor Field Input
 */
function TextFieldInput({
  value,
  onChange,
  isFocused,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  isFocused: boolean;
  placeholder: string;
}): React.ReactElement {
  return (
    <Box>
      <Text>[</Text>
      <TextInput
        value={value}
        onChange={onChange}
        focus={isFocused}
        placeholder={placeholder}
      />
      <Text>]</Text>
    </Box>
  );
}

/**
 * Bool Field Input (checkbox style)
 */
function BoolFieldInput({
  value,
  onChange,
  isFocused,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  isFocused: boolean;
}): React.ReactElement {
  const handleToggle = useCallback(() => {
    onChange(!value);
  }, [value, onChange]);

  // Space key toggles in parent component
  return (
    <Box>
      <Text color={isFocused ? "cyan" : undefined}>
        [{value ? "x" : " "}] {value ? "true" : "false"}
      </Text>
      {isFocused && (
        <Text color="gray"> (Space to toggle)</Text>
      )}
    </Box>
  );
}

/**
 * Select Field Input
 */
function SelectFieldInput({
  value,
  options,
  onChange,
  isFocused,
}: {
  value: string | string[];
  options: string[];
  onChange: (value: string | string[]) => void;
  isFocused: boolean;
}): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentValue = Array.isArray(value) ? value : [value].filter(Boolean);

  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const isSelected = currentValue.includes(option);
        const isHighlighted = isFocused && index === selectedIndex;
        
        return (
          <Box key={option}>
            <Text
              color={isHighlighted ? "cyan" : undefined}
              inverse={isHighlighted}
            >
              [{isSelected ? "x" : " "}] {option}
            </Text>
          </Box>
        );
      })}
      {isFocused && (
        <Text color="gray">↑↓ navigate, Space select</Text>
      )}
    </Box>
  );
}

/**
 * Number Field Input
 */
function NumberFieldInput({
  value,
  onChange,
  isFocused,
  placeholder,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  isFocused: boolean;
  placeholder: string;
  min?: number;
  max?: number;
}): React.ReactElement {
  const handleChange = useCallback(
    (newValue: string) => {
      // Allow empty, minus sign, or valid number
      if (newValue === "" || newValue === "-" || !isNaN(Number(newValue))) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  return (
    <Box>
      <Text>[</Text>
      <TextInput
        value={value}
        onChange={handleChange}
        focus={isFocused}
        placeholder={placeholder}
      />
      <Text>]</Text>
      {min !== undefined && max !== undefined && (
        <Text color="gray"> ({min}-{max})</Text>
      )}
    </Box>
  );
}

/**
 * Main Field Input Component
 */
export function FieldInput({
  field,
  value,
  onChange,
  isFocused,
  error,
}: FieldInputProps): React.ReactElement {
  const displayValue = formatFieldValue(field.type, value);
  const placeholder = getFieldPlaceholder(field.type);

  // Handle value change with parsing
  const handleChange = useCallback(
    (newValue: string | boolean) => {
      if (typeof newValue === "boolean") {
        onChange(newValue);
      } else {
        const parsed = parseFieldValue(field.type, newValue);
        onChange(parsed);
      }
    },
    [field.type, onChange]
  );

  return (
    <Box flexDirection="column">
      {/* Field Label */}
      <Box>
        <Text color={error ? "red" : isFocused ? "cyan" : "white"}>
          {field.name}
          {field.required && <Text color="red">*</Text>}
        </Text>
        <Text color="gray"> ({field.type})</Text>
      </Box>

      {/* Field Input */}
      <Box marginLeft={2}>
        {field.type === "bool" ? (
          <BoolFieldInput
            value={Boolean(value)}
            onChange={(v) => handleChange(v)}
            isFocused={isFocused}
          />
        ) : field.type === "select" && field.options?.values ? (
          <SelectFieldInput
            value={value as string | string[]}
            options={field.options.values}
            onChange={onChange}
            isFocused={isFocused}
          />
        ) : field.type === "number" ? (
          <NumberFieldInput
            value={displayValue}
            onChange={handleChange}
            isFocused={isFocused}
            placeholder={placeholder}
            min={field.options?.min}
            max={field.options?.max}
          />
        ) : (
          <TextFieldInput
            value={displayValue}
            onChange={handleChange}
            isFocused={isFocused}
            placeholder={placeholder}
          />
        )}
      </Box>

      {/* Error Message */}
      {error && (
        <Box marginLeft={2}>
          <Text color="red">⚠ {error}</Text>
        </Box>
      )}
    </Box>
  );
}
