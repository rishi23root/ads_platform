import 'server-only';

/**
 * Structured error for extension serve / live flows.
 * Route handlers catch this and return `error.body` with HTTP `error.status`.
 */
export class ExtensionServeError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(body: Record<string, unknown>, status: number) {
    const message =
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : 'Extension serve error';
    super(message);
    this.name = 'ExtensionServeError';
    this.body = body;
    this.status = status;
  }
}
