import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';

function normalizeDomain(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) return trimmed;
  
  try {
    // If it looks like a URL, extract hostname
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname;
  } catch {
    // If not a valid URL, assume it's already a domain
    return trimmed;
  }
}

// GET all platforms
export async function GET() {
  try {
    const allPlatforms = await db.select().from(platforms).orderBy(platforms.createdAt);
    return NextResponse.json(allPlatforms);
  } catch (error) {
    console.error('Error fetching platforms:', error);
    return NextResponse.json({ error: 'Failed to fetch platforms' }, { status: 500 });
  }
}

// POST create new platform
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, domain, isActive } = body;

    if (!name || !domain) {
      return NextResponse.json(
        { error: 'Name and domain are required' },
        { status: 400 }
      );
    }

    // Normalize domain (extract hostname from URL if needed)
    const normalizedDomain = normalizeDomain(domain);

    // Check if name already exists
    const existingPlatform = await db
      .select()
      .from(platforms)
      .where(eq(platforms.name, name))
      .limit(1);

    if (existingPlatform.length > 0) {
      return NextResponse.json(
        { error: 'A platform with this name already exists' },
        { status: 409 }
      );
    }

    const [newPlatform] = await db
      .insert(platforms)
      .values({
        name,
        domain: normalizedDomain,
        isActive: isActive ?? true,
      })
      .returning();

    return NextResponse.json(newPlatform, { status: 201 });
  } catch (error) {
    console.error('Error creating platform:', error);
    return NextResponse.json({ error: 'Failed to create platform' }, { status: 500 });
  }
}
