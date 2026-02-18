import { NextRequest } from 'next/server';
import { verifySession } from '@/lib/dal';
import {
  createRedisClient,
  getConnectionCount,
  REALTIME_COUNT_CHANNEL,
} from '@/lib/redis';

export const maxDuration = 300;

const encoder = new TextEncoder();

function sseEvent(name: string, data: string): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${data}\n\n`);
}

/**
 * GET /api/realtime/stream
 * SSE stream for live connection count. Subscribes to Redis; sends connection_count events.
 * Admin-only (requires valid session). Dashboard uses this instead of polling GET /api/realtime/count.
 *
 * CRITICAL: This endpoint must NEVER call incrConnectionCount/decrConnectionCount. Dashboard
 * connections to this stream must not be counted — only extension users on /api/extension/live
 * increment the Redis count. Counting dashboard sessions here would incorrectly inflate the
 * extension user count.
 */
export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const client = await createRedisClient();
      if (!client) {
        controller.enqueue(sseEvent('connection_count', '0'));
        controller.close();
        return;
      }

      let subscriber: Awaited<ReturnType<typeof client.duplicate>> | null = null;

      const cleanup = async () => {
        try {
          if (subscriber) {
            await subscriber.unsubscribe(REALTIME_COUNT_CHANNEL);
            await subscriber.destroy();
          }
        } catch {
          // ignore
        } finally {
          try {
            await client.destroy();
          } catch {
            // ignore
          }
          try {
            controller.close();
          } catch {
            // ignore
          }
        }
      };

      try {
        const initialCount = await getConnectionCount();
        controller.enqueue(sseEvent('connection_count', String(initialCount)));

        subscriber = client.duplicate();
        subscriber.on('error', () => { });
        await subscriber.connect();

        await subscriber.subscribe(REALTIME_COUNT_CHANNEL, (message: string) => {
          try {
            controller.enqueue(sseEvent('connection_count', message));
          } catch {
            // stream may be closed
          }
        });

        await new Promise<void>((resolve) => {
          request.signal?.addEventListener('abort', () => resolve());
        });
      } catch {
        // connection/subscribe error
      } finally {
        await cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
