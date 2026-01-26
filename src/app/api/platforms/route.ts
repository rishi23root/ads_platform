import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
        domain,
        isActive: isActive ?? true,
      })
      .returning();

    return NextResponse.json(newPlatform, { status: 201 });
  } catch (error) {
    console.error('Error creating platform:', error);
    return NextResponse.json({ error: 'Failed to create platform' }, { status: 500 });
  }
}
