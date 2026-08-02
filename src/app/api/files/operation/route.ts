import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validatePath } from '@/lib/security';
import fs from 'fs';
import path from 'path';

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

    const body = await req.json();
    const { action, path: targetPath, newPath: targetNewPath, content = '' } = body;

    if (!targetPath) {
      return NextResponse.json({ error: 'Source path parameter is required' }, { status: 400 });
    }

    // Validate main path bounds
    const absolutePath = validatePath(workspaceRoot, targetPath);

    switch (action) {
      case 'create_file': {
        // Ensure parent directories exist
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        if (fs.existsSync(absolutePath)) {
          return NextResponse.json({ error: 'File already exists' }, { status: 400 });
        }

        fs.writeFileSync(absolutePath, content, 'utf-8');
        await prisma.auditLog.create({
          data: { actionType: 'file_create', target: targetPath, status: 'executed' },
        });
        break;
      }

      case 'create_folder': {
        if (fs.existsSync(absolutePath)) {
          return NextResponse.json({ error: 'Folder already exists' }, { status: 400 });
        }

        fs.mkdirSync(absolutePath, { recursive: true });
        await prisma.auditLog.create({
          data: { actionType: 'folder_create', target: targetPath, status: 'executed' },
        });
        break;
      }

      case 'rename': {
        if (!targetNewPath) {
          return NextResponse.json({ error: 'Destination path parameter is required' }, { status: 400 });
        }
        const absoluteNewPath = validatePath(workspaceRoot, targetNewPath);

        if (!fs.existsSync(absolutePath)) {
          return NextResponse.json({ error: 'Source path does not exist' }, { status: 404 });
        }
        if (fs.existsSync(absoluteNewPath)) {
          return NextResponse.json({ error: 'Destination path already exists' }, { status: 400 });
        }

        // Ensure parent directories for new path exist
        const dir = path.dirname(absoluteNewPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.renameSync(absolutePath, absoluteNewPath);
        await prisma.auditLog.create({
          data: { actionType: 'file_rename', target: `${targetPath} -> ${targetNewPath}`, status: 'executed' },
        });
        break;
      }

      case 'delete': {
        if (!fs.existsSync(absolutePath)) {
          return NextResponse.json({ error: 'Path does not exist' }, { status: 404 });
        }

        const stat = fs.statSync(absolutePath);
        if (stat.isDirectory()) {
          fs.rmSync(absolutePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(absolutePath);
        }

        await prisma.auditLog.create({
          data: { actionType: 'file_delete', target: targetPath, status: 'executed' },
        });
        break;
      }

      default:
        return NextResponse.json({ error: `Invalid action type: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error executing file operations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
