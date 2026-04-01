/**
 * Read the first complete SSE frame from GET /api/extension/live (Bearer or ?token=).
 * Does not keep the connection open after the first event.
 */
export async function fetchExtensionLiveFirstSseEvent(
  baseUrl: string,
  token: string
): Promise<{ ok: boolean; status: number; eventName: string; data: string }> {
  const url = new URL(`${baseUrl}/api/extension/live`);
  url.searchParams.set('token', token);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'text/event-stream' },
  });

  if (!res.ok) {
    return { ok: false, status: res.status, eventName: '', data: '' };
  }

  const reader = res.body?.getReader();
  if (!reader) {
    return { ok: false, status: res.status, eventName: '', data: '' };
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

  return { ok: true, status: res.status, eventName, data };
}
