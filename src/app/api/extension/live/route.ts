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
 * Output: `200` `text/event-stream` — first event is `init` (`{ user, domains, redirects }`).
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
      };

      try {
        const init = await buildExtensionLiveInit(endUser);
        controller.enqueue(sseEvent('init', JSON.stringify(init)));
        leaseId = randomUUID();
        await registerLiveConnectionLease(leaseId);
        const sseCommentPing = sseCommentLine('ping');
        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(sseCommentPing);
          } catch {
            if (heartbeatTimer != null) {
              clearInterval(heartbeatTimer);
              heartbeatTimer = null;
            }
            streamLifecycle.abort();
            return;
          }
          if (leaseId != null) {
            void refreshLiveConnectionLease(leaseId);
          }
        }, REALTIME_LIVE_LEASE_HEARTBEAT_MS);

        if (!redisMain) {
          await waitForDisconnect(request, streamLifecycle.signal);
          return;
        }

        subscriber = redisMain.duplicate();
        subscriber.on('error', () => {});
        await subscriber.connect();

        await subscriber.subscribe(REALTIME_CHANNEL, (message: string) => {
          void (async () => {
            try {
              const parsed = JSON.parse(message) as {
                type?: string;
                campaignId?: string;
              };
              if (!parsed.type) return;

              if (parsed.type === 'campaign_updated' && typeof parsed.campaignId === 'string') {
                const upd = await buildCampaignUpdateForExtension(endUser);
                try {
                  controller.enqueue(sseEvent('campaign_updated', JSON.stringify(upd)));
                } catch {
                  /* stream closed */
                }
                return;
              }

              if (parsed.type === 'platforms_updated') {
                // Emit campaign-referenced domains only (same derivation as init).
                const domains = await buildCampaignUsedDomainsFromDB();
                try {
                  controller.enqueue(sseEvent('platforms_updated', JSON.stringify({ domains })));
                } catch {
                  /* stream closed */
                }
                return;
              }

              if (parsed.type === 'redirects_updated') {
                try {
                  const redirects = await buildExtensionLiveRedirectsForEndUser(endUser);
                  controller.enqueue(
                    sseEvent(
                      'redirects_updated',
                      JSON.stringify({ type: parsed.type, redirects })
                    )
                  );
                } catch {
                  /* stream closed */
                }
                return;
              }

              if (parsed.type === 'ads_updated' || parsed.type === 'notifications_updated') {
                try {
                  controller.enqueue(sseEvent(parsed.type, JSON.stringify({ type: parsed.type })));
                } catch {
                  /* stream closed */
                }
              }
            } catch {
              /* malformed Redis payload or DB error */
            }
          })();
        });

        await waitForDisconnect(request, streamLifecycle.signal);
      } catch (err) {
        console.error('[api/extension/live]', err);
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
