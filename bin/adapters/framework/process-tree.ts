import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
/** Targets only the child process group/tree we created, never a remembered PID from disk. */
export function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const taskkill = spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
    taskkill.once('error', () => child.kill(signal));
    taskkill.once('close', status => { if (status !== 0) child.kill(signal); });
  } else {
    try { process.kill(-child.pid, signal); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) child.kill(signal); }
  }
}
