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

export async function GET(req: NextRequest) {
  try {
    const workspaceRoot = await getWorkspaceRoot();
    if (!workspaceRoot) {
      return NextResponse.json({ error: 'No active workspace selected' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const relativeOrAbsoluteTarget = searchParams.get('path') || workspaceRoot;

    // Validate path is within workspace root
    const absolutePath = validatePath(workspaceRoot, relativeOrAbsoluteTarget);

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'Directory does not exist' }, { status: 404 });
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    const files = fs.readdirSync(absolutePath);
    const items = files
      .map((fileName) => {
        // Skip ignored patterns to optimize M1 resources
        if (fileName === '.git' || fileName === 'node_modules' || fileName === '.next' || fileName === 'dist') {
          return null;
        }

        const fullItemPath = path.join(absolutePath, fileName);
        try {
          const itemStat = fs.statSync(fullItemPath);
          return {
            name: fileName,
            path: fullItemPath,
            isDirectory: itemStat.isDirectory(),
            size: itemStat.size,
          };
        } catch {
          // Skip broken symlinks or unreadable files
          return null;
        }
      })
      .filter((item) => item !== null);

    // Sort: folders first, then files alphabetically
    items.sort((a: any, b: any) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Error listing files:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
