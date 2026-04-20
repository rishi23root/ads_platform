const encoder = new TextEncoder();

export function sseEvent(name: string, data: string): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${data}\n\n`);
}

/** Comment line for SSE keep-alive / heartbeat (ignored by EventSource). */
export function sseCommentLine(comment: string): Uint8Array {
  return encoder.encode(`: ${comment}\n\n`);
}
