import { NextRequest, NextResponse } from 'next/server';
import { OllamaProvider } from '@/lib/ai/ollama';
import { prisma } from '@/lib/db';

async function getOllamaEndpoint() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'ollamaEndpoint' } });
    if (setting) {
      return JSON.parse(setting.value);
    }
  } catch {}
  return 'http://127.0.0.1:11434';
}

export async function GET() {
  try {
    const endpoint = await getOllamaEndpoint();
    const ollama = new OllamaProvider(endpoint);
    
    const connection = await ollama.checkConnection();
    if (!connection.isConnected) {
      return NextResponse.json({
        isConnected: false,
        error: connection.error || 'Ollama is offline.',
        models: [],
      });
    }

    const models = await ollama.listModels();
    return NextResponse.json({
      isConnected: true,
      models,
    });
  } catch (error: any) {
    return NextResponse.json({
      isConnected: false,
      error: error.message || 'Error communicating with Ollama.',
      models: [],
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { modelName } = await req.json();
    if (!modelName) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    const endpoint = await getOllamaEndpoint();
    const ollama = new OllamaProvider(endpoint);
    await ollama.deleteModel(modelName);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting model:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST endpoint pulls a model and streams progress via Server-Sent Events (SSE)
export async function POST(req: NextRequest) {
  try {
    const { modelName } = await req.json();
    if (!modelName) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    const endpoint = await getOllamaEndpoint();
    const ollama = new OllamaProvider(endpoint);

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'Starting pull...', completed: 0, total: 100 })}\n\n`));
          
          await ollama.pullModel(modelName, (status, completed, total) => {
            const data = JSON.stringify({ status, completed, total });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'success', completed: 100, total: 100 })}\n\n`));
          controller.close();
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message || 'Pull failed' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error initiating model pull:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
