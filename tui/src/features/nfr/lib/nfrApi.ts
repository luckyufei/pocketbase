/**
 * Non-Functional Requirements API
 * 
 * Performance, compatibility, and quality utilities
 * Corresponds to EPIC-12: 非功能性验收
 */

// Performance thresholds (in milliseconds)
export const PERF_THRESHOLDS = {
  firstRender: 500,      // NFR-001: First render < 500ms
  omnibarResponse: 50,   // SC-002: OmniBar response < 50ms
  commandExecution: 100, // NFR-002: Command execution < 100ms
  collectionsLoad: 1000, // SC-003: Collections load < 1s
  recordsRender: 500,    // SC-004: Records render < 500ms
  logsStream: 100,       // SC-005: Logs stream delay < 100ms
  memoryUsage: 100,      // NFR-003: Memory < 100MB
} as const;

// Types
export interface PerformanceResult {
  durationMs: number;
  passed: boolean;
  threshold: number;
}

export interface MemoryUsageResult {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMemoryMB: number;
  passed: boolean;
  threshold: number;
}

export interface CompatibilityResult {
  terminal: string;
  isSupported: boolean;
  supports256Colors: boolean;
  supportsUnicode: boolean;
  supportsTrueColor: boolean;
  meetsMinSize: boolean;
  width: number;
  height: number;
}

/**
 * Measure render/execution time
 */
export async function measureRenderTime<T>(
  fn: () => Promise<T>,
  threshold: number = PERF_THRESHOLDS.firstRender
): Promise<PerformanceResult> {
  const start = performance.now();
  
  await fn();
  
  const durationMs = performance.now() - start;
  
  return {
    durationMs,
    passed: durationMs <= threshold,
    threshold,
  };
}

/**
 * Measure command response time
 */
export async function measureCommandResponse<T>(
  fn: () => Promise<T>,
  threshold: number = PERF_THRESHOLDS.commandExecution
): Promise<PerformanceResult> {
  return measureRenderTime(fn, threshold);
}

/**
 * Check memory usage
 */
export function checkMemoryUsage(
  threshold: number = PERF_THRESHOLDS.memoryUsage
): MemoryUsageResult {
  // Use Bun's memory info if available, otherwise estimate
  const memInfo = process.memoryUsage();
  
  const heapUsedMB = memInfo.heapUsed / (1024 * 1024);
  const heapTotalMB = memInfo.heapTotal / (1024 * 1024);
  const rssMemoryMB = memInfo.rss / (1024 * 1024);
  
  return {
    heapUsedMB,
    heapTotalMB,
    rssMemoryMB,
    passed: heapUsedMB <= threshold,
    threshold,
  };
}

/**
 * Check terminal compatibility
 */
export function checkTerminalCompatibility(
  env: Record<string, string | undefined>
): CompatibilityResult {
  // Detect terminal type
  const terminal = detectTerminal(env);
  
  // Check color support
  const term = env.TERM || "";
  const supports256Colors = term.includes("256color") || term.includes("xterm");
  const supportsTrueColor = !!(env.COLORTERM === "truecolor" || env.COLORTERM === "24bit");
  
  // Unicode support (assume yes for modern terminals)
  const supportsUnicode = isModernTerminal(terminal);
  
  // Check terminal size
  const width = parseInt(env.COLUMNS || "80", 10);
  const height = parseInt(env.LINES || "24", 10);
  const meetsMinSize = width >= 80 && height >= 24;
  
  return {
    terminal,
    isSupported: isSupportedTerminal(terminal),
    supports256Colors,
    supportsUnicode,
    supportsTrueColor,
    meetsMinSize,
    width,
    height,
  };
}

/**
 * Detect terminal type from environment
 */
function detectTerminal(env: Record<string, string | undefined>): string {
  if (env.TERM_PROGRAM === "iTerm.app") return "iTerm2";
  if (env.WT_SESSION) return "Windows Terminal";
  if (env.GNOME_TERMINAL_SERVICE) return "GNOME Terminal";
  if (env.TERM_PROGRAM === "Apple_Terminal") return "Terminal.app";
  if (env.TERM_PROGRAM === "vscode") return "VS Code Terminal";
  if (env.TERM_PROGRAM === "Hyper") return "Hyper";
  if (env.TERM_PROGRAM === "WezTerm") return "WezTerm";
  if (env.KONSOLE_VERSION) return "Konsole";
  if (env.TERM === "linux") return "Linux Console";
  if (env.TERM?.includes("xterm")) return "XTerm Compatible";
  
  return "Unknown";
}

/**
 * Check if terminal is supported
 */
function isSupportedTerminal(terminal: string): boolean {
  const supportedTerminals = [
    "iTerm2",
    "Windows Terminal",
    "GNOME Terminal",
    "Terminal.app",
    "VS Code Terminal",
    "Hyper",
    "WezTerm",
    "Konsole",
    "XTerm Compatible",
  ];
  
  return supportedTerminals.includes(terminal);
}

/**
 * Check if terminal is modern (supports Unicode)
 */
function isModernTerminal(terminal: string): boolean {
  const modernTerminals = [
    "iTerm2",
    "Windows Terminal",
    "GNOME Terminal",
    "Terminal.app",
    "VS Code Terminal",
    "Hyper",
    "WezTerm",
    "Konsole",
  ];
  
  return modernTerminals.includes(terminal);
}
