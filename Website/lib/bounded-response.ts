export class ResponseTooLargeError extends Error {
  constructor(
    readonly endpoint: string,
    readonly maximumBytes: number,
    readonly bytesRead: number
  ) {
    super(`${endpoint} response exceeded its ${maximumBytes}-byte limit.`);
    this.name = "ResponseTooLargeError";
  }
}

/** Read a response incrementally and cancel as soon as its decoded body is too large. */
export async function readLimitedResponseText(
  response: Response,
  maximumBytes: number,
  endpoint: string
): Promise<{ text: string; bytesRead: number }> {
  const contentLength = response.headers.get("content-length")?.trim();
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseTooLargeError(endpoint, maximumBytes, 0);
  }

  const body = response.body;
  if (!body) return { text: "", bytesRead: 0 };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const text: string[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ResponseTooLargeError(endpoint, maximumBytes, bytesRead);
      }
      text.push(decoder.decode(value, { stream: true }));
    }
    text.push(decoder.decode());
    return { text: text.join(""), bytesRead };
  } catch (error) {
    if (!(error instanceof ResponseTooLargeError)) await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
