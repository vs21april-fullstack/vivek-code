import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    const { command } = await req.json();

    if (!command || !command.trim()) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    // Security check: Block sudo or destructive patterns
    const lowerCmd = command.toLowerCase();
    if (lowerCmd.includes('sudo') || lowerCmd.includes('rm -rf /') || lowerCmd.includes('force-push')) {
      return NextResponse.json({
        error: 'Security Guard: Sudo or destructive commands are blocked from execution.',
      }, { status: 403 });
    }

    // Run command in workspace CWD
    let stdout = '';
    let stderr = '';
    let status = 'executed';

    try {
      const result = await execAsync(command, { cwd: workspaceRoot });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execErr: any) {
      status = 'failed';
      stdout = execErr.stdout || '';
      stderr = execErr.stderr || execErr.message || 'Execution error';
    }

    // Log this command in AuditLog SQLite
    await prisma.auditLog.create({
      data: {
        actionType: 'terminal_exec',
        target: command,
        status,
      },
    });

    return NextResponse.json({
      stdout,
      stderr,
      success: status === 'executed',
    });
  } catch (error: any) {
    console.error('Terminal runner API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
