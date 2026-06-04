import { AppError } from './errors';

// HttpError wraps a non-2xx HTTP response into a throwable error.
// It carries the HTTP status code so callers can branch on it (e.g. 403 vs 429).
export class HttpError extends AppError {
  constructor(status: number, statusText: string) {
    super(`HTTP ${status} ${statusText}`, status);
  }
}

// fetchJson makes a single HTTP GET (or any method via init) and returns the parsed JSON body.
// If the response status is not 2xx, it throws HttpError instead of returning garbage data.
// The generic <T> lets callers say exactly what type they expect back (e.g. CanvasCourse[]).
export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  // response.ok is true only for status codes 200-299
  if (!response.ok) {
    throw new HttpError(response.status, response.statusText);
  }
  return response.json() as Promise<T>;
}

// parseNextLink reads the Canvas 'Link' pagination header and extracts the 'next' URL.
// Canvas uses the format: Link: <https://...?page=2>; rel="next", <https://...?page=1>; rel="prev"
// Returns the next URL string if present, or null if this is the last page.
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  // Split header into individual rel parts separated by commas
  for (const part of linkHeader.split(',')) {
    const [urlPart, relPart] = part.split(';');
    // Check if this rel is "next"
    if (relPart?.trim() === 'rel="next"') {
      // Extract the URL from angle brackets: <https://...>
      const match = /<([^>]+)>/.exec(urlPart.trim());
      if (match) return match[1];
    }
  }
  return null;
}

// fetchAllPages follows Canvas pagination automatically.
// It starts at the given URL, fetches each page, and continues until there is no 'next' link.
// Returns all items from all pages combined into one array.
// Used instead of fetchJson when Canvas could return more than one page of results.
export async function fetchAllPages<T>(
  url: string,
  init?: RequestInit,
): Promise<T[]> {
  const results: T[] = [];
  // nextUrl starts as the first URL; becomes null when there are no more pages
  let nextUrl: string | null = url;
  while (nextUrl) {
    const response = await fetch(nextUrl, init);
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText);
    }
    // Each page returns an array — spread it into the accumulated results
    const page = (await response.json()) as T[];
    results.push(...page);
    // Read the Link header to find the next page URL
    nextUrl = parseNextLink(response.headers.get('Link'));
  }
  return results;
}
