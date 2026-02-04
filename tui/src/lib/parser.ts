/**
 * Command Parser
 * 
 * Parses OmniBar input into structured command objects
 * Handles: /command @resource args
 */

/**
 * Parsed resource reference (@collection or @collection:id)
 */
export interface ParsedResource {
  collection: string;
  id?: string;
}

/**
 * Parsed command result
 */
export interface ParsedCommand {
  command: string;
  resource?: ParsedResource;
  args: Record<string, string>;
  raw: string;
}

/**
 * Parse a resource reference (@collection or @collection:id)
 */
export function parseResource(input: string): ParsedResource | undefined {
  if (!input || !input.startsWith("@")) {
    return undefined;
  }

  const withoutAt = input.slice(1);
  if (!withoutAt) {
    return undefined;
  }

  const colonIndex = withoutAt.indexOf(":");
  if (colonIndex === -1) {
    return { collection: withoutAt };
  }

  const collection = withoutAt.slice(0, colonIndex);
  const id = withoutAt.slice(colonIndex + 1);

  if (!collection) {
    return undefined;
  }

  return { collection, id: id || undefined };
}

/**
 * Parse argument string into key-value pairs
 * Supports: key="value" key='value' key=value
 */
export function parseArgs(input: string): Record<string, string> {
  const args: Record<string, string> = {};
  if (!input.trim()) return args;

  // Match key=value or key="value" or key='value'
  const regex = /(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    args[key] = value;
  }

  return args;
}

/**
 * Parse a complete command string
 * Format: /command @resource key=value key="value"
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { command: "", args: {}, raw: input };
  }

  // Split by whitespace, but respect quoted strings
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = "";
      current += char;
    } else if (char === " " && !inQuote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) {
    tokens.push(current);
  }

  // First token is the command
  const command = tokens[0]?.startsWith("/") ? tokens[0] : "";

  // Find resource (@collection or @collection:id)
  let resource: ParsedResource | undefined;
  const resourceToken = tokens.find((t) => t.startsWith("@"));
  if (resourceToken) {
    resource = parseResource(resourceToken);
  }

  // Parse remaining arguments
  const argsTokens = tokens.filter(
    (t) => !t.startsWith("/") && !t.startsWith("@") && t.includes("=")
  );
  const args = parseArgs(argsTokens.join(" "));

  return {
    command,
    resource,
    args,
    raw: input,
  };
}

/**
 * Check if input is a partial command (starts with /)
 */
export function isPartialCommand(input: string): boolean {
  return input.trimStart().startsWith("/");
}

/**
 * Check if input contains a resource reference
 */
export function hasResource(input: string): boolean {
  return input.includes("@");
}

/**
 * Extract the partial resource from input (for autocomplete)
 */
export function getPartialResource(input: string): string {
  const match = input.match(/@(\w*)$/);
  return match ? match[1] : "";
}
