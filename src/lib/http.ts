// Defensive client-side response parsing (item 9). The crash
//   "unexpected token 'r', \"request en\"... is not valid JSON"
// is a non-JSON body (the platform's plain-text "Request Entity Too Large" on an oversized upload,
// or any error page) being blindly JSON.parse'd. parseJsonSafe NEVER throws: it reads the body once,
// tries JSON, and otherwise returns a clean, human error keyed off the status.

export interface JsonResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

function humanStatus(status: number): string {
  switch (status) {
    case 401:
      return "Please sign in and try again.";
    case 402:
      return "You do not have enough credits for this.";
    case 403:
      return "You do not have access to that.";
    case 404:
      return "We could not find that.";
    case 413:
      return "That file is too large to upload. Please use a smaller image.";
    case 429:
      return "Too many requests just now. Please wait a moment and retry.";
    case 503:
      return "That service is temporarily unavailable. Please try again shortly.";
    default:
      return status >= 500
        ? "Something went wrong on our side. Please try again."
        : "The request could not be completed.";
  }
}

export async function parseJsonSafe<T = unknown>(res: Response): Promise<JsonResult<T>> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    return { ok: false, status: res.status, error: humanStatus(res.status) };
  }
  let data: unknown;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON body (a platform error page / plain text). Surface a clean message, never the raw
      // parse error.
      return { ok: false, status: res.status, error: humanStatus(res.status) };
    }
  }
  if (!res.ok) {
    const d = data as { error?: string; message?: string } | undefined;
    return { ok: false, status: res.status, error: d?.error || d?.message || humanStatus(res.status), data: data as T };
  }
  return { ok: true, status: res.status, data: data as T };
}
