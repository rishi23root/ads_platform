import { NextRequest } from 'next/server';
import { getCanonicalDisplayDomain } from '@/lib/domain-utils';
import { resolveEndUserFromExtensionRequest } from '@/lib/enduser-auth';
import {
  buildCampaignUpdateForExtension,
  buildExtensionLiveInit,
  fetchExtensionPlatformsList,
} from '@/lib/extension-live-init';
import {
  createRedisClient,
  decrConnectionCount,
  incrConnectionCount,
  REALTIME_CHANNEL,
} from '@/lib/redis';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function sseEvent(name: string, data: string): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${data}\n\n`);
}

function waitForAbort(req: NextRequest): Promise<void> {
  return new Promise((resolve) => {
    if (req.signal.aborted) {
      resolve();
      return;
    }
    req.signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

export async function GET(request: NextRequest) {
  const resolved = await resolveEndUserFromExtensionRequest(request);
  if (!resolved) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { endUser } = resolved;
  const endUserIdStr = String(endUser.id);

  await incrConnectionCount();

  const stream = new ReadableStream({
    async start(controller) {
      type RedisClientNonNull = NonNullable<Awaited<ReturnType<typeof createRedisClient>>>;
      const redisMain: RedisClientNonNull | null = await createRedisClient();
      let subscriber: Awaited<ReturnType<RedisClientNonNull['duplicate']>> | null = null;
      let finished = false;

      const cleanup = async () => {
        if (finished) return;
        finished = true;
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
        try {
          await decrConnectionCount();
        } catch {
          /* ignore */
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

        if (!redisMain) {
          await waitForAbort(request);
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
                endUserId?: string;
                count?: number;
              };
              if (!parsed.type) return;

              if (parsed.type === 'frequency_updated') {
                if (parsed.endUserId !== endUserIdStr) return;
                try {
                  controller.enqueue(
                    sseEvent(
                      'frequency_updated',
                      JSON.stringify({
                        campaignId: parsed.campaignId,
                        count: parsed.count ?? 0,
                      })
                    )
                  );
                } catch {
                  /* stream closed */
                }
                return;
              }

              if (parsed.type === 'campaign_updated' && typeof parsed.campaignId === 'string') {
                const upd = await buildCampaignUpdateForExtension(parsed.campaignId);
                try {
                  controller.enqueue(sseEvent('campaign_updated', JSON.stringify(upd)));
                } catch {
                  /* stream closed */
                }
                return;
              }

              if (parsed.type === 'platforms_updated') {
                const pl = await fetchExtensionPlatformsList();
                const domains = pl
                  .map((p) => getCanonicalDisplayDomain(p.domain))
                  .filter((d, i, arr) => arr.indexOf(d) === i);
                try {
                  controller.enqueue(
                    sseEvent('platforms_updated', JSON.stringify({ platforms: pl, domains }))
                  );
                } catch {
                  /* stream closed */
                }
                return;
              }

              if (
                parsed.type === 'redirects_updated' ||
                parsed.type === 'ads_updated' ||
                parsed.type === 'notifications_updated'
              ) {
                try {
                  controller.enqueue(
                    sseEvent(parsed.type, JSON.stringify({ type: parsed.type }))
                  );
                } catch {
                  /* stream closed */
                }
              }
            } catch {
              /* malformed Redis payload or DB error */
            }
          })();
        });

        await waitForAbort(request);
      } catch (err) {
        console.error('[api/extension/live]', err);
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
