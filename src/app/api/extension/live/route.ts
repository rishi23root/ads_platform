import { NextRequest } from 'next/server';
import {
  createRedisClient,
  publishConnectionCount,
  REALTIME_CHANNEL,
  REALTIME_COUNT_KEY,
} from '@/lib/redis';

export const maxDuration = 300;

const encoder = new TextEncoder();

function sseEvent(name: string, data: string): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${data}\n\n`);
}

/**
 * GET /api/extension/live
 * SSE stream for real-time notifications and connection count.
 * Optional query: visitorId (for future use).
 * Events: connection_count, notification.
 * Connection may close after platform timeout (~5 min); extension should reconnect.
 */
export async function GET(request: NextRequest) {
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
            await subscriber.unsubscribe(REALTIME_CHANNEL);
            await subscriber.destroy();
          }
          const newCount = Math.max(0, await client.decr(REALTIME_COUNT_KEY));
          await publishConnectionCount(newCount);
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
        subscriber = client.duplicate();
        subscriber.on('error', () => {});
        await subscriber.connect();

        const count = await client.incr(REALTIME_COUNT_KEY);
        controller.enqueue(sseEvent('connection_count', String(count)));
        await publishConnectionCount(count);

        await subscriber.subscribe(REALTIME_CHANNEL, (message: string) => {
          try {
            controller.enqueue(sseEvent('notification', message));
          } catch {
            // stream may be closed
          }
        });

        // Keep stream open until request is aborted (client disconnect or platform timeout)
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
