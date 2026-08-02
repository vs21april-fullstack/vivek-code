import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

// Check if a file extension is likely binary
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.ttf', '.eot',
  '.mp4', '.mp3', '.wav', '.webm', '.map', '.db', '.sqlite'
]);

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
    const maxMatches = 50;

    function traverse(currentDir: string) {
      if (matches.length >= maxMatches) return;

      const files = fs.readdirSync(currentDir);
      for (const fileName of files) {
        if (matches.length >= maxMatches) break;

        if (fileName === '.git' || fileName === 'node_modules' || fileName === '.next' || fileName === 'dist') {
          continue;
        }

        const fullPath = path.join(currentDir, fileName);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            traverse(fullPath);
          } else {
            const ext = path.extname(fileName).toLowerCase();
            if (BINARY_EXTENSIONS.has(ext) || stat.size > 1024 * 500) {
              // Skip binary and files > 500KB to optimize M1 search
              continue;
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.toLowerCase().includes(query.toLowerCase())) {
              const lines = content.split('\n');
              lines.forEach((lineText, index) => {
                if (matches.length >= maxMatches) return;
                
                if (lineText.toLowerCase().includes(query.toLowerCase())) {
                  matches.push({
                    fileName,
                    relativePath: path.relative(workspaceRoot, fullPath),
                    path: fullPath,
                    lineNumber: index + 1,
                    lineContent: lineText.trim(),
                  });
                }
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
    console.error('Error grepping files:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
