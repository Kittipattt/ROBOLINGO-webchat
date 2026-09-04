/**
 * API Client Layer
 * Handles HTTP requests with cache-busting headers and standardized error handling.
 */

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiClient<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { params, headers, ...restOptions } = options;

  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  // Cache buster to prevent intermediate caching
  url.searchParams.set('_t', Date.now().toString());

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...headers,
    },
    ...restOptions,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorMessage = errJson.error;
      }
    } catch {
      // Ignore if response body is not JSON
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}
