/**
 * Edge Cases API
 * 
 * Utilities for handling edge cases
 * Corresponds to EPIC-11: 边界情况处理
 */

import type PocketBase from "pocketbase";

// Constants
export const MIN_TERMINAL_WIDTH = 80;
export const MIN_TERMINAL_HEIGHT = 24;

// Types
export interface EmptyInputResult {
  shouldIgnore: boolean;
  action: string | null;
  trimmedInput: string;
}

export interface NetworkStatus {
  isConnected: boolean;
  error?: string;
  canRetry: boolean;
  retryCount: number;
  message?: string;
}

export interface TerminalSizeResult {
  isAdequate: boolean;
  warning?: string;
  currentWidth: number;
  currentHeight: number;
  requiredWidth: number;
  requiredHeight: number;
}

export interface PaginationInfo {
  totalItems: number;
  pageSize: number;
  totalPages: number;
  currentPage: number;
  startIndex: number;
  endIndex: number;
  progressPercent: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface EscapeOptions {
  preserveAnsi?: boolean;
  preserveNewlines?: boolean;
}

export interface TokenExpiredResult {
  isExpired: boolean;
  shouldClearAuth: boolean;
  message?: string;
  suggestReauth: boolean;
  isNetworkError: boolean;
}

/**
 * Handle empty input
 * T-11.1.1, T-11.1.2
 */
export function handleEmptyInput(input: string): EmptyInputResult {
  const trimmed = input.trim();
  
  const isEmpty = trimmed.length === 0;
  
  return {
    shouldIgnore: isEmpty,
    action: isEmpty ? null : trimmed,
    trimmedInput: trimmed,
  };
}

/**
 * Handle network disconnect
 * T-11.1.3, T-11.1.4
 */
export async function handleNetworkDisconnect(
  pb: PocketBase,
  retryCount: number = 0
): Promise<NetworkStatus> {
  try {
    await pb.health.check();
    
    return {
      isConnected: true,
      canRetry: false,
      retryCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return {
      isConnected: false,
      error: errorMessage,
      canRetry: true,
      retryCount,
      message: "You are offline. Check your network connection and try again.",
    };
  }
}

/**
 * Check terminal size
 * T-11.1.5, T-11.1.6
 */
export function checkTerminalSize(
  width: number,
  height: number
): TerminalSizeResult {
  const widthOk = width >= MIN_TERMINAL_WIDTH;
  const heightOk = height >= MIN_TERMINAL_HEIGHT;
  const isAdequate = widthOk && heightOk;
  
  let warning: string | undefined;
  
  if (!isAdequate) {
    const issues: string[] = [];
    if (!widthOk) {
      issues.push(`width (${width} < ${MIN_TERMINAL_WIDTH})`);
    }
    if (!heightOk) {
      issues.push(`height (${height} < ${MIN_TERMINAL_HEIGHT})`);
    }
    warning = `Terminal size too small: ${issues.join(", ")}. Minimum required: ${MIN_TERMINAL_WIDTH}x${MIN_TERMINAL_HEIGHT}.`;
  }
  
  return {
    isAdequate,
    warning,
    currentWidth: width,
    currentHeight: height,
    requiredWidth: MIN_TERMINAL_WIDTH,
    requiredHeight: MIN_TERMINAL_HEIGHT,
  };
}

/**
 * Handle large dataset pagination
 * T-11.1.7, T-11.1.8
 */
export function handleLargeDataset(
  totalItems: number,
  pageSize: number,
  currentPage: number = 1
): PaginationInfo {
  // Handle empty dataset
  if (totalItems === 0) {
    return {
      totalItems: 0,
      pageSize,
      totalPages: 0,
      currentPage: 0,
      startIndex: 0,
      endIndex: 0,
      progressPercent: 0,
      hasNextPage: false,
      hasPrevPage: false,
    };
  }
  
  const totalPages = Math.ceil(totalItems / pageSize);
  
  // Clamp current page to valid range
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);
  
  // Progress is based on the end of current page
  const progressPercent = Math.round(((endIndex + 1) / totalItems) * 100);
  
  return {
    totalItems,
    pageSize,
    totalPages,
    currentPage: validPage,
    startIndex,
    endIndex,
    progressPercent,
    hasNextPage: validPage < totalPages,
    hasPrevPage: validPage > 1,
  };
}

/**
 * Escape special characters
 * T-11.1.9, T-11.1.10
 */
export function escapeSpecialCharacters(
  input: string,
  options: EscapeOptions = {}
): string {
  const { preserveAnsi = false, preserveNewlines = true } = options;
  
  let result = input;
  
  // Remove null bytes
  result = result.replace(/\x00/g, "");
  
  // Handle ANSI escape sequences
  if (!preserveAnsi) {
    // Remove ANSI escape sequences
    // eslint-disable-next-line no-control-regex
    result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  }
  
  // Handle newlines
  if (!preserveNewlines) {
    result = result.replace(/\n/g, " ");
    result = result.replace(/\r/g, "");
  }
  
  // Escape HTML-like characters (for display safety)
  result = result.replace(/&/g, "&amp;");
  result = result.replace(/</g, "&lt;");
  result = result.replace(/>/g, "&gt;");
  
  return result;
}

/**
 * Handle token expired
 * T-11.1.11, T-11.1.12
 */
export async function handleTokenExpired(
  _pb: PocketBase,
  error: unknown
): Promise<TokenExpiredResult> {
  // Check if it's a network error
  if (error instanceof Error && !("status" in error)) {
    return {
      isExpired: false,
      shouldClearAuth: false,
      isNetworkError: true,
      suggestReauth: false,
    };
  }
  
  // Check for auth-related HTTP status codes
  const status = (error as { status?: number })?.status;
  
  if (status === 401 || status === 403) {
    return {
      isExpired: true,
      shouldClearAuth: true,
      message: "Authentication failed. Your session may have expired.",
      suggestReauth: true,
      isNetworkError: false,
    };
  }
  
  return {
    isExpired: false,
    shouldClearAuth: false,
    isNetworkError: false,
    suggestReauth: false,
  };
}
