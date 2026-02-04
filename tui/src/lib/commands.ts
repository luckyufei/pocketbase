/**
 * Commands Registry
 * 
 * Defines all available TUI commands
 * Corresponds to Spec Section 14 (Internal Commands)
 */

/**
 * Command argument definition
 */
export interface CommandArg {
  name: string;
  type: "resource" | "string" | "number" | "boolean";
  required: boolean;
  description: string;
}

/**
 * Command definition
 */
export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  args?: CommandArg[];
  examples?: string[];
}

/**
 * All available commands
 */
export const COMMANDS: Command[] = [
  {
    name: "/cols",
    description: "List all collections",
    examples: ["/cols"],
  },
  {
    name: "/view",
    description: "View records in a collection",
    args: [
      {
        name: "collection",
        type: "resource",
        required: true,
        description: "Collection name (use @collection)",
      },
      {
        name: "filter",
        type: "string",
        required: false,
        description: "Filter expression (e.g., filter=\"verified=true\")",
      },
      {
        name: "sort",
        type: "string",
        required: false,
        description: "Sort field (e.g., sort=\"created\")",
      },
      {
        name: "page",
        type: "number",
        required: false,
        description: "Page number (default: 1)",
      },
      {
        name: "perPage",
        type: "number",
        required: false,
        description: "Items per page (default: 20)",
      },
    ],
    examples: [
      "/view @users",
      "/view @posts filter=\"published=true\"",
      "/view @users sort=\"created\" page=2",
    ],
  },
  {
    name: "/get",
    description: "Get a single record by ID",
    args: [
      {
        name: "resource",
        type: "resource",
        required: true,
        description: "Collection:ID (use @collection:id)",
      },
    ],
    examples: ["/get @users:abc123"],
  },
  {
    name: "/schema",
    description: "View collection schema and fields",
    args: [
      {
        name: "collection",
        type: "resource",
        required: true,
        description: "Collection name (use @collection)",
      },
    ],
    examples: ["/schema @users"],
  },
  {
    name: "/logs",
    description: "View log stream",
    args: [
      {
        name: "level",
        type: "string",
        required: false,
        description: "Filter by level (error, warn, info)",
      },
    ],
    examples: ["/logs", "/logs level=error"],
  },
  {
    name: "/monitor",
    description: "View system monitoring dashboard",
    examples: ["/monitor"],
  },
  {
    name: "/health",
    description: "Check server health status",
    examples: ["/health"],
  },
  {
    name: "/clear",
    description: "Clear the screen",
    examples: ["/clear"],
  },
  {
    name: "/help",
    description: "Show help for commands",
    args: [
      {
        name: "command",
        type: "string",
        required: false,
        description: "Specific command to get help for",
      },
    ],
    examples: ["/help", "/help view"],
  },
  {
    name: "/quit",
    description: "Exit the TUI",
    aliases: ["/q"],
    examples: ["/quit", "/q"],
  },
  {
    name: "/create",
    description: "Create a new record in a collection",
    args: [
      {
        name: "collection",
        type: "resource",
        required: true,
        description: "Collection name (use @collection)",
      },
    ],
    examples: ["/create @posts", "/create @users"],
  },
  {
    name: "/edit",
    description: "Edit an existing record",
    args: [
      {
        name: "resource",
        type: "resource",
        required: true,
        description: "Collection:ID (use @collection:id)",
      },
    ],
    examples: ["/edit @posts:abc123", "/edit @users:xyz789"],
  },
  {
    name: "/delete",
    description: "Delete a record from a collection",
    args: [
      {
        name: "resource",
        type: "resource",
        required: true,
        description: "Collection:ID (use @collection:id)",
      },
      {
        name: "-f",
        type: "boolean",
        required: false,
        description: "Force delete without confirmation",
      },
    ],
    examples: [
      "/delete @posts:abc123",
      "/delete @posts:abc123 -f",
      "/delete @users:xyz789",
    ],
  },
];

/**
 * Get a command by name or alias
 */
export function getCommand(input: string): Command | undefined {
  const normalized = input.toLowerCase();
  
  return COMMANDS.find(
    (cmd) =>
      cmd.name.toLowerCase() === normalized ||
      cmd.aliases?.some((alias) => alias.toLowerCase() === normalized)
  );
}

/**
 * Find commands that match a prefix
 */
export function findCommands(prefix: string): Command[] {
  const normalized = prefix.toLowerCase();
  
  return COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().startsWith(normalized) ||
      cmd.aliases?.some((alias) => alias.toLowerCase().startsWith(normalized))
  );
}

/**
 * Get command suggestions for autocomplete
 */
export function getCommandSuggestions(input: string): string[] {
  if (!input.startsWith("/")) return [];
  
  return findCommands(input).map((cmd) => cmd.name);
}
