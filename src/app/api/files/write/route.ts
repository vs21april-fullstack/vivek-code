import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validatePath } from '@/lib/security';
import fs from 'fs';

async function getWorkspaceRoot() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'defaultWorkspace' } });
    if (setting) {
      return JSON.parse(setting.value);
    }
  } catch {}
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const workspaceRoot = await getWorkspaceRoot();
    if (!workspaceRoot) {
      return NextResponse.json({ error: 'No active workspace selected' }, { status: 400 });
    }

    const { path: targetPath, content } = await req.json();

    if (!targetPath) {
      return NextResponse.json({ error: 'File path parameter is required' }, { status: 400 });
    }

    // Validate path security bounds
    const absolutePath = validatePath(workspaceRoot, targetPath);

    // Save to disk
    fs.writeFileSync(absolutePath, content ?? '', 'utf-8');

    // Audit log this operation
    await prisma.auditLog.create({
      data: {
        actionType: 'file_write',
        target: targetPath,
        status: 'executed',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error writing file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
