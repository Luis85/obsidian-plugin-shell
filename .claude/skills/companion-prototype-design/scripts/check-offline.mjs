import { args, need, readText, readBytes, sha256, isMain, cli } from './lib/io.mjs';
import { checkHtml } from './lib/offline.mjs';
if (isMain(import.meta.url)) cli(() => {
  const options = args(process.argv.slice(2), ['--html'], ['--help']);
  if (options.help) return console.log('Usage: node check-offline.mjs --html <prototype.html>');
  const file = need(options, 'html');
  const issues = checkHtml(readText(file));
  console.log(JSON.stringify({ status: issues.length ? 'failed' : 'passed-static-only',
    sha256: sha256(readBytes(file)), issues,
    limitations: ['Conservative static check only. Run exact-artifact browser journeys with network blocked.'] }, null, 2));
  if (issues.length) process.exitCode = 1;
});
