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
    const query = searchParams.get('q') || '';

    if (!query) {
      return NextResponse.json([]);
    }

    const matches: any[] = [];
    const maxResults = 100;

    // Helper to traverse and find matching files recursively
    function traverse(currentDir: string) {
      if (matches.length >= maxResults) return;

      const files = fs.readdirSync(currentDir);
      for (const fileName of files) {
        if (matches.length >= maxResults) break;

        if (fileName === '.git' || fileName === 'node_modules' || fileName === '.next' || fileName === 'dist') {
          continue;
        }

        const fullPath = path.join(currentDir, fileName);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            traverse(fullPath);
          } else {
            if (fileName.toLowerCase().includes(query.toLowerCase())) {
              matches.push({
                name: fileName,
                path: fullPath,
                relativePath: path.relative(workspaceRoot, fullPath),
                size: stat.size,
              });
            }
          }
        } catch {
          // Ignore unreadable items
        }
      }
    }

    traverse(workspaceRoot);
    return NextResponse.json(matches);
  } catch (error: any) {
    console.error('Error searching files:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
