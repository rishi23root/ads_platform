import 'server-only';

import { randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { and, eq, gt } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers, enduserSessions } from '@/db/schema';
import type { EndUserRow, EnduserSessionRow } from '@/db/schema';

const BCRYPT_ROUNDS = 10;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Session lifetime in days (env override). */
export function enduserSessionExpiresDays(): number {
  return parsePositiveInt(process.env.ENDUSER_SESSION_DAYS, 30);
}

export function hashEnduserPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

export function verifyEnduserPassword(plain: string, passwordHash: string): boolean {
  return bcrypt.compareSync(plain, passwordHash);
}

/** URL-safe random token for Bearer auth. */
export function generateEnduserSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') return null;
  const m = authorizationHeader.match(/^\s*Bearer\s+(\S+)\s*$/i);
  return m?.[1] ?? null;
}

export function getBearerFromRequest(request: NextRequest): string | null {
  return parseBearerToken(request.headers.get('authorization'));
}

export type ResolvedEndUserSession = {
  endUser: EndUserRow;
  session: EnduserSessionRow;
};

export async function resolveEndUserFromToken(
  token: string | null
): Promise<ResolvedEndUserSession | null> {
  if (!token || token.length < 16) return null;
  const now = new Date();
  const rows = await db
    .select({
      endUser: endUsers,
      session: enduserSessions,
    })
    .from(enduserSessions)
    .innerJoin(endUsers, eq(endUsers.id, enduserSessions.endUserId))
    .where(
      and(
        eq(enduserSessions.token, token),
        gt(enduserSessions.expiresAt, now),
        eq(endUsers.banned, false)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { endUser: row.endUser, session: row.session };
}

export async function resolveEndUserFromRequest(
  request: NextRequest
): Promise<ResolvedEndUserSession | null> {
  return resolveEndUserFromToken(getBearerFromRequest(request));
}

/**
 * Bearer from `Authorization` header, or `token` query param (SSE / EventSource cannot set headers).
 */
export function getBearerFromExtensionRequest(request: NextRequest): string | null {
  const fromHeader = getBearerFromRequest(request);
  if (fromHeader) return fromHeader;
  const q = request.nextUrl.searchParams.get('token')?.trim();
  if (q && q.length >= 16) return q;
  return null;
}

export async function resolveEndUserFromExtensionRequest(
  request: NextRequest
): Promise<ResolvedEndUserSession | null> {
  return resolveEndUserFromToken(getBearerFromExtensionRequest(request));
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 255);
  }
  return request.headers.get('x-real-ip')?.trim().slice(0, 255) ?? null;
}

export async function createEnduserSession(params: {
  endUserId: string;
  request: NextRequest;
}): Promise<{ token: string; expiresAt: Date }> {
  const { endUserId, request: req } = params;
  await db.delete(enduserSessions).where(eq(enduserSessions.endUserId, endUserId));
  const token = generateEnduserSessionToken();
  const days = enduserSessionExpiresDays();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  const ua = req.headers.get('user-agent');
  await db.insert(enduserSessions).values({
    endUserId,
    token,
    expiresAt,
    userAgent: ua?.trim() ? ua.trim().slice(0, 2000) : null,
    ipAddress: clientIp(req),
  });
  return { token, expiresAt };
}

export async function deleteEnduserSessionByToken(token: string): Promise<void> {
  await db.delete(enduserSessions).where(eq(enduserSessions.token, token));
}

export function endUserPublicPayload(user: EndUserRow) {
  return {
    id: user.id,
    email: user.email,
    identifier: user.identifier,
    name: user.name,
    plan: user.plan,
    banned: user.banned,
    country: user.country,
    startDate: user.startDate,
    endDate: user.endDate,
  };
}
