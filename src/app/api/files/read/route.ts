import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validatePath, isSensitiveFile } from '@/lib/security';
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

export async function GET(req: NextRequest) {
  try {
    const workspaceRoot = await getWorkspaceRoot();
    if (!workspaceRoot) {
      return NextResponse.json({ error: 'No active workspace selected' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get('path');
    
    if (!targetPath) {
      return NextResponse.json({ error: 'File path parameter is required' }, { status: 400 });
    }

    // Validate path security bounds
    const absolutePath = validatePath(workspaceRoot, targetPath);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Target path is not a file' }, { status: 400 });
    }

    // Check size limit to protect M1 8GB RAM memory bounds
    const sizeMB = stat.size / (1024 * 1024);
    if (sizeMB > 5) {
      return NextResponse.json({
        error: `File is too large (${sizeMB.toFixed(1)} MB). V Code restricts editing files > 5MB to preserve performance.`,
      }, { status: 400 });
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');

    // Audit log this operation
    await prisma.auditLog.create({
      data: {
        actionType: 'file_read',
        target: targetPath,
        status: 'executed',
      },
    });

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('Error reading file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
