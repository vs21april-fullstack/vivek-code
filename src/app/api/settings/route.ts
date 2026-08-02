import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  fontSize: 14,
  autoSave: true,
  defaultWorkspace: '',
  language: 'en',
  ollamaEndpoint: 'http://127.0.0.1:11434',
  defaultModel: '',
  temperature: 0.2,
  contextLength: 8192,
  maxTokens: 2048,
  systemPrompt: 'You are Vivek Code, a production-ready private local AI coding assistant inspired by Claude Code, Cursor, and modern AI-powered development tools.',
  fileReadPermission: 'ask',
  fileWritePermission: 'ask',
  terminalPermission: 'ask',
  packageInstallPermission: 'ask',
  gitPermission: 'ask',
  autoApprovalSettings: false,
};

export async function GET() {
  try {
    const dbSettings = await prisma.setting.findMany();
    const settingsMap = dbSettings.reduce((acc, curr) => {
      try {
        acc[curr.key] = JSON.parse(curr.value);
      } catch {
        acc[curr.key] = curr.value;
      }
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({ ...DEFAULT_SETTINGS, ...settingsMap });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Store keys in Setting DB
    const updates = Object.entries(body).map(([key, value]) => {
      return prisma.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      });
    });

    await prisma.$transaction(updates);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
