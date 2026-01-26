import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { platforms } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET single platform
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [platform] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.id, id))
      .limit(1);

    if (!platform) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json(platform);
  } catch (error) {
    console.error('Error fetching platform:', error);
    return NextResponse.json({ error: 'Failed to fetch platform' }, { status: 500 });
  }
}

// PUT update platform
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, domain, isActive } = body;

    if (!name || !domain) {
      return NextResponse.json(
        { error: 'Name and domain are required' },
        { status: 400 }
      );
    }

    // Check if name already exists for another platform
    const existingPlatform = await db
      .select()
      .from(platforms)
      .where(and(eq(platforms.name, name), ne(platforms.id, id)))
      .limit(1);

    if (existingPlatform.length > 0) {
      return NextResponse.json(
        { error: 'A platform with this name already exists' },
        { status: 409 }
      );
    }

    const [updatedPlatform] = await db
      .update(platforms)
      .set({
        name,
        domain,
        isActive: isActive ?? true,
        updatedAt: new Date(),
      })
      .where(eq(platforms.id, id))
      .returning();

    if (!updatedPlatform) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json(updatedPlatform);
  } catch (error) {
    console.error('Error updating platform:', error);
    return NextResponse.json({ error: 'Failed to update platform' }, { status: 500 });
  }
}

// DELETE platform
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const [deletedPlatform] = await db
      .delete(platforms)
      .where(eq(platforms.id, id))
      .returning();

    if (!deletedPlatform) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting platform:', error);
    return NextResponse.json({ error: 'Failed to delete platform' }, { status: 500 });
  }
}
