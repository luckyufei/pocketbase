/**
 * API utility functions
 */

/**
 * Get the API example URL from the base URL
 * Normalizes the URL by removing trailing slashes
 */
export function getApiExampleUrl(baseUrl: string): string {
  // Remove trailing slashes and ensure we have a proper URL
  const normalizedUrl = baseUrl?.replace(/\/+$/, '') || window.location.origin
  return normalizedUrl
}
