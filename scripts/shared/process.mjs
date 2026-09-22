import { spawn } from 'node:child_process';
export function runNode(path, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path, ...args], { cwd: process.cwd(), stdio: 'inherit', ...options });
    const stop = () => { child.kill('SIGTERM'); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    child.once('error', reject);
    child.once('exit', code => {
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
      if (code === 0) resolve(); else reject(new Error(`Command failed (${code ?? 'signal'}): ${path}`));
    });
  });
}
