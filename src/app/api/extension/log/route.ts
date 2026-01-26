import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { extensionUsers, requestLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';

// POST log a request from the extension
export async function POST(request: NextRequest) {
  try {
    // Check Content-Type header
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    // Read raw body for debugging
    let rawBody = await request.text();
    
    // Trim whitespace that might cause parsing issues
    rawBody = rawBody.trim();
    
    // Parse JSON with better error handling
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw body:', rawBody);
      console.error('Body length:', rawBody.length);
      console.error('Body preview (first 200 chars):', rawBody.substring(0, 200));
      console.error('Body preview (last 100 chars):', rawBody.substring(Math.max(0, rawBody.length - 100)));
      
      // Check if there might be multiple JSON objects
      if (rawBody.includes('}{') || rawBody.match(/\}\s*\{/)) {
        return NextResponse.json(
          { 
            error: 'Invalid JSON: Multiple JSON objects detected. Send only one JSON object per request.',
            details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        },
        { status: 400 }
      );
    }

    const { visitorId, domain, requestType } = body;

    // Validate required fields
    if (!visitorId || !domain || !requestType) {
      return NextResponse.json(
        { error: 'visitorId, domain, and requestType are required' },
        { status: 400 }
      );
    }

    // Validate requestType
    if (requestType !== 'ad' && requestType !== 'notification') {
      return NextResponse.json(
        { error: 'requestType must be either "ad" or "notification"' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Upsert extension user: create if new, update if exists
    const existingUser = await db
      .select()
      .from(extensionUsers)
      .where(eq(extensionUsers.visitorId, visitorId))
      .limit(1);

    if (existingUser.length > 0) {
      // Update existing user
      const currentTotal = existingUser[0].totalRequests;
      await db
        .update(extensionUsers)
        .set({
          lastSeenAt: now,
          totalRequests: currentTotal + 1,
          updatedAt: now,
        })
        .where(eq(extensionUsers.visitorId, visitorId));
    } else {
      // Create new user
      await db.insert(extensionUsers).values({
        visitorId,
        firstSeenAt: now,
        lastSeenAt: now,
        totalRequests: 1,
      });
    }

    // Insert request log
    const [newLog] = await db
      .insert(requestLogs)
      .values({
        visitorId,
        domain,
        requestType,
      })
      .returning();

    return NextResponse.json({ success: true, log: newLog }, { status: 201 });
  } catch (error) {
    console.error('Error logging request:', error);
    return NextResponse.json({ error: 'Failed to log request' }, { status: 500 });
  }
}
