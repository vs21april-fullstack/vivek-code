import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    let conversations;

    if (query) {
      conversations = await prisma.conversation.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            {
              messages: {
                some: {
                  content: { contains: query },
                },
              },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      conversations = await prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
      });
    }

    return NextResponse.json(conversations);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    const conv = await prisma.conversation.create({
      data: { title: title || 'New Conversation' },
    });
    return NextResponse.json(conv);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.conversation.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing conversations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
