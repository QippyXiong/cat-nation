import { spawn } from 'node:child_process';
const url = 'http://127.0.0.1:8765/';
const open = () => spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true, stdio: 'ignore' });
async function health() {
  try { return (await (await fetch(url + 'api/health', { signal: AbortSignal.timeout(700) })).json()).app === 'cat-nation-local'; }
  catch { return false; }
}
if (await health()) {
  open();
} else {
  const { createGameServer } = await import('./server.mjs');
  const server = createGameServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 8765 is occupied by another app.' : error); process.exitCode = 1; });
  server.listen(8765, '127.0.0.1', () => {
    console.log('Cat Nation Local: ' + url + '\nSaves: data/latest.json + data/backups\nKeep this window open while playing. Close it to stop.');
    open();
  });
}
