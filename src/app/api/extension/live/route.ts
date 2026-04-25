import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { resolveEndUserFromExtensionRequest } from '@/lib/enduser-auth';
import {
  buildCampaignUpdateForExtension,
  buildCampaignUsedDomainsFromDB,
  buildExtensionLiveInit,
  buildExtensionLiveRedirectsForEndUser,
} from '@/lib/extension-live-init';
import {
  createRedisClient,
  REALTIME_CHANNEL,
  REALTIME_LIVE_LEASE_HEARTBEAT_MS,
  refreshLiveConnectionLease,
  registerLiveConnectionLease,
  removeLiveConnectionLease,
} from '@/lib/redis';
import { sseCommentLine, sseEvent } from '@/lib/sse';
import { logger } from '@/lib/logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function waitForDisconnect(req: NextRequest, streamSignal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    if (req.signal.aborted || streamSignal.aborted) {
      done();
      return;
    }
    req.signal.addEventListener('abort', done, { once: true });
    streamSignal.addEventListener('abort', done, { once: true });
  });
}

/**
 * GET /api/extension/live — SSE stream (`init` + realtime updates).
 *
 * Input: `Authorization: Bearer <token>` **or** query `?token=<same>` (for EventSource). No body.
 *
 * Output: `200` `text/event-stream` — first event is `init` `{ identifier, domains, redirects }`
 * (only the extension `identifier` from the user row; full profile via `GET /api/extension/auth/me`).
 *         `401` JSON `{ error: "Unauthorized" }`.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveEndUserFromExtensionRequest(request);
  if (!resolved) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { endUser } = resolved;
  const endUserId = endUser.id;

  const streamLifecycle = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      type RedisClientNonNull = NonNullable<Awaited<ReturnType<typeof createRedisClient>>>;
      const redisMain: RedisClientNonNull | null = await createRedisClient();
      let subscriber: Awaited<ReturnType<RedisClientNonNull['duplicate']>> | null = null;
      let finished = false;
      let leaseId: string | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

      const cleanup = async () => {
        if (finished) return;
        finished = true;
        if (heartbeatTimer != null) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        try {
          if (subscriber) {
            await subscriber.unsubscribe(REALTIME_CHANNEL);
            await subscriber.destroy();
          }
        } catch {
          /* ignore */
        } finally {
          subscriber = null;
        }
        try {
          if (redisMain) {
            await redisMain.destroy();
          }
        } catch {
          /* ignore */
        }
        if (leaseId != null) {
          try {
            await removeLiveConnectionLease(leaseId);
          } catch {
            /* ignore */
          }
          leaseId = null;
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
        logger.debug('[api/extension/live] closed', { endUserId });
      };

      // Safe enqueue: any failure aborts the stream so the `finally` runs cleanup.
      const safeEnqueue = (chunk: Uint8Array | string): boolean => {
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          streamLifecycle.abort();
          return false;
        }
      };

      try {
        logger.debug('[api/extension/live] open', { endUserId });
        const init = await buildExtensionLiveInit(endUser);
        if (!safeEnqueue(sseEvent('init', JSON.stringify(init)))) return;
        leaseId = randomUUID();
        await registerLiveConnectionLease(leaseId);

        const sseCommentPing = sseCommentLine('ping');
        heartbeatTimer = setInterval(() => {
          if (!safeEnqueue(sseCommentPing)) {
            if (heartbeatTimer != null) {
              clearInterval(heartbeatTimer);
              heartbeatTimer = null;
            }
            return;
          }
          if (leaseId != null) {
            void refreshLiveConnectionLease(leaseId);
          }
        }, REALTIME_LIVE_LEASE_HEARTBEAT_MS);

        if (!redisMain) {
          // Redis not configured — init-only mode; wait for client disconnect.
          await waitForDisconnect(request, streamLifecycle.signal);
          return;
        }

        subscriber = redisMain.duplicate();
        // Propagate subscriber errors to the stream lifecycle instead of swallowing them.
        subscriber.on('error', (err) => {
          logger.error('[api/extension/live] subscriber error', err, { endUserId });
          streamLifecycle.abort();
        });
        await subscriber.connect();

        await subscriber.subscribe(REALTIME_CHANNEL, (message: string) => {
          void (async () => {
            let parsed: { type?: string; campaignId?: string };
            try {
              parsed = JSON.parse(message) as { type?: string; campaignId?: string };
            } catch (err) {
              logger.warn('[api/extension/live] malformed pubsub message', {
                endUserId,
                error: err instanceof Error ? err.message : String(err),
              });
              return;
            }
            if (!parsed.type) return;

            try {
              switch (parsed.type) {
                case 'campaign_updated': {
                  const upd = await buildCampaignUpdateForExtension(endUser);
                  safeEnqueue(sseEvent('campaign_updated', JSON.stringify(upd)));
                  return;
                }
                case 'platforms_updated': {
                  const domains = await buildCampaignUsedDomainsFromDB();
                  safeEnqueue(sseEvent('platforms_updated', JSON.stringify({ domains })));
                  return;
                }
                case 'redirects_updated': {
                  const redirects = await buildExtensionLiveRedirectsForEndUser(endUser);
                  safeEnqueue(
                    sseEvent(
                      'redirects_updated',
                      JSON.stringify({ type: parsed.type, redirects })
                    )
                  );
                  return;
                }
                default:
                  return;
              }
            } catch (err) {
              logger.error('[api/extension/live] update handler failed', err, {
                endUserId,
                messageType: parsed.type,
              });
            }
          })();
        });

        await waitForDisconnect(request, streamLifecycle.signal);
      } catch (err) {
        logger.error('[api/extension/live] stream error', err, { endUserId });
      } finally {
        await cleanup();
      }
    },
    cancel() {
      streamLifecycle.abort();
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
