import { NextRequest, NextResponse } from 'next/server';
import { OllamaProvider } from '@/lib/ai/ollama';
import { prisma } from '@/lib/db';
import { maskSecrets } from '@/lib/security';
import { ChatMessage } from '@/lib/ai/types';

async function getOllamaEndpoint() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'ollamaEndpoint' } });
    if (setting) {
      return JSON.parse(setting.value);
    }
  } catch {}
  return 'http://127.0.0.1:11434';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      conversationId: reqConvId,
      messages,
      model,
      temperature,
      contextLength,
      maxTokens,
      systemPrompt,
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    if (!model) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    // 1. Get or create conversation in DB
    let conversationId = reqConvId;
    if (!conversationId) {
      const defaultTitle = messages[messages.length - 1].content.slice(0, 40) || 'New Chat';
      const conv = await prisma.conversation.create({
        data: { title: defaultTitle },
      });
      conversationId = conv.id;
    }

    // 2. Save user message to database
    const lastUserMsg = messages[messages.length - 1];
    const maskedUserContent = maskSecrets(lastUserMsg.content);
    await prisma.message.create({
      data: {
        conversationId,
        role: lastUserMsg.role,
        content: maskedUserContent,
      },
    });

    // 3. Prepare client for Ollama
    const endpoint = await getOllamaEndpoint();
    const ollama = new OllamaProvider(endpoint);

    // 4. Clean messages history and mask secrets for prompt transmission
    const formattedMessages: ChatMessage[] = messages.map((m: any) => ({
      role: m.role as any,
      content: maskSecrets(m.content),
    }));

    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send conversationId metadata as the first chunk
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'metadata', conversationId })}\n\n`)
          );

          await ollama.chat(
            formattedMessages,
            {
              model,
              temperature,
              contextLength,
              maxTokens,
              systemPrompt,
            },
            (chunk) => {
              fullResponse += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
              );
            }
          );

          // Save generated assistant response to DB
          await prisma.message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullResponse,
              model,
            },
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', fullResponse })}\n\n`)
          );
          controller.close();
        } catch (err: any) {
          console.error('Streaming error:', err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: err.message || 'Stream processing failed',
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
