/**
 * Read the first complete SSE frame from GET /api/extension/live (Bearer or ?token=).
 * Does not keep the connection open after the first event.
 */

function parseFirstSseBlock(buffer: string): { eventName: string; data: string } {
  const firstBlock = buffer.split('\n\n')[0] ?? '';
  let eventName = 'message';
  let data = '';
  for (const line of firstBlock.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data = line.slice(5).trim();
    }
  }
  return { eventName, data };
}

async function readFirstSseFrameFromStream(res: Response): Promise<{ eventName: string; data: string }> {
  const reader = res.body?.getReader();
  if (!reader) {
    return { eventName: '', data: '' };
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (!buffer.includes('\n\n')) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }

  return parseFirstSseBlock(buffer);
}

export type ExtensionLiveSseHttpMeta = {
  ok: boolean;
  status: number;
  contentType: string;
  connectionHeader: string | null;
  cacheControl: string | null;
  /** True when server advertises a long-lived stream (`keep-alive`). */
  connectionKeepAlive: boolean;
  eventName: string;
  data: string;
};

/**
 * First SSE event from `/api/extension/live` plus HTTP metadata so you can verify
 * the connection (status, `text/event-stream`, cache/connection headers).
 */
export async function fetchExtensionLiveSseInitWithHttpMeta(
  baseUrl: string,
  token: string,
  extraHeaders?: Record<string, string>
): Promise<ExtensionLiveSseHttpMeta> {
  const url = new URL(`${baseUrl}/api/extension/live`);
  url.searchParams.set('token', token);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'text/event-stream', ...extraHeaders },
  });

  const contentType = res.headers.get('content-type') ?? '';
  const connectionHeader = res.headers.get('connection');
  const cacheControl = res.headers.get('cache-control');
  const ch = (connectionHeader ?? '').toLowerCase();
  const connectionKeepAlive =
    res.ok && (ch === '' || ch.includes('keep-alive')) && !ch.includes('close');

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      contentType,
      connectionHeader,
      cacheControl,
      connectionKeepAlive: false,
      eventName: '',
      data: '',
    };
  }

  const { eventName, data } = await readFirstSseFrameFromStream(res);

  return {
    ok: true,
    status: res.status,
    contentType,
    connectionHeader,
    cacheControl,
    connectionKeepAlive,
    eventName,
    data,
  };
}

/**
 * Read the first complete SSE frame (legacy helper used by other integration tests).
 */
export async function fetchExtensionLiveFirstSseEvent(
  baseUrl: string,
  token: string,
  extraHeaders?: Record<string, string>
): Promise<{ ok: boolean; status: number; eventName: string; data: string }> {
  const url = new URL(`${baseUrl}/api/extension/live`);
  url.searchParams.set('token', token);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'text/event-stream', ...extraHeaders },
  });

  if (!res.ok) {
    return { ok: false, status: res.status, eventName: '', data: '' };
  }

  const { eventName, data } = await readFirstSseFrameFromStream(res);
  return { ok: true, status: res.status, eventName, data };
}