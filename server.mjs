import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const limit = 20 * 1024 * 1024;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.gif': 'image/gif', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };

function validate(save) {
  if (!save || typeof save !== 'object' || !Array.isArray(save.resources) || !save.calendar || !save.game || !save.buildings) {
    throw Object.assign(new Error('不是有效的猫国存档，请选择原版导出的存档。'), { status: 400 });
  }
  if (save.resources.some(r => !r || typeof r.name !== 'string' || typeof r.value !== 'number' || !Number.isFinite(r.value))) {
    throw Object.assign(new Error('存档资源数据不完整。'), { status: 400 });
  }
  return save;
}

function atomicWrite(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  const fd = fs.openSync(temporary, 'wx');
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}

export function createGameServer({ dataDir = path.join(root, 'data'), gameDir = path.join(root, 'game') } = {}) {
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  const latest = path.join(dataDir, 'latest.json');
  const snapshotDir = path.join(dataDir, 'backups');
  let lastAutomatic = 0;
  function current() {
    if (!fs.existsSync(latest)) return { revision: null, save: null };
    try {
      const record = JSON.parse(fs.readFileSync(latest, 'utf8'));
      if (record.save !== null) validate(record.save);
      if (typeof record.revision !== 'string') throw new Error('存档版本标记无效。');
      return record;
    } catch (cause) { throw Object.assign(new Error('当前存档文件损坏或无法读取，请保留文件并从 data/backups 恢复。', { cause }), { status: 500 }); }
  }
  function backup(record, kind) {
    if (!record.save) return;
    const name = new Date().toISOString().replace(/[:.]/g, '-') + '_' + kind + '_' + randomUUID().slice(0, 8) + '.json';
    atomicWrite(path.join(snapshotDir, name), record);
    // Keep recent automatic snapshots; manual and pre-restore snapshots are retained.
    const automatic = fs.readdirSync(snapshotDir).filter(n => n.includes('_auto_')).sort().reverse();
    for (const name of automatic.slice(240)) fs.unlinkSync(path.join(snapshotDir, name));
  }
  function commit(save, expectedRevision, kind = 'auto') {
    if (kind !== 'new' || save !== null) validate(save);
    const previous = current();
    if (expectedRevision !== previous.revision) throw Object.assign(new Error('另一个窗口已更新存档。请刷新此页面后继续，磁盘存档没有被覆盖。'), { status: 409 });
    if (kind !== 'auto') backup(previous, 'before-' + kind);
    const record = { revision: randomUUID(), savedAt: new Date().toISOString(), save };
    if (kind !== 'auto' || Date.now() - lastAutomatic >= 60000) {
      backup(record, kind);
      lastAutomatic = Date.now();
    }
    atomicWrite(latest, record);
    return { revision: record.revision, savedAt: record.savedAt };
  }
  const server = http.createServer(async (req, res) => {
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const port = server.address().port;
      const origin = `http://127.0.0.1:${port}`;
      if (req.headers.host !== `127.0.0.1:${port}`) return json(403, { error: '请使用 127.0.0.1 本地地址。' });
      if (req.headers.origin && req.headers.origin !== origin) return json(403, { error: '请求来源不匹配。' });
      res.setHeader('Content-Security-Policy', "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; form-action 'self'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && url.pathname === '/api/health') return json(200, { app: 'cat-nation-local', version: 1 });
      if (req.method === 'GET' && url.pathname === '/api/state') return json(200, current());
      if (req.method === 'GET' && url.pathname === '/api/backups') {
        const records = fs.readdirSync(snapshotDir).filter(n => /^[\w.-]+\.json$/.test(n)).sort().reverse();
        return json(200, records.map(name => ({ name, bytes: fs.statSync(path.join(snapshotDir, name)).size })));
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/backup/')) {
        const name = decodeURIComponent(url.pathname.slice('/api/backup/'.length));
        if (!/^[\w.-]+\.json$/.test(name)) return json(400, { error: '无效的备份名称。' });
        const record = JSON.parse(fs.readFileSync(path.join(snapshotDir, name), 'utf8'));
        validate(record.save);
        return json(200, record);
      }
      if (req.method === 'POST' && url.pathname === '/api/save') {
        if (req.headers['content-type'] !== 'application/json') return json(415, { error: '需要 JSON 格式。' });
        let size = 0, chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > limit) { json(413, { error: '存档超过 20 MB。' }); return; }
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!['auto', 'manual', 'import', 'restore', 'new', 'reset'].includes(body.kind)) return json(400, { error: '无效的保存类型。' });
        return json(200, commit(body.save, body.revision, body.kind));
      }
      if (url.pathname.startsWith('/api/')) return json(404, { error: '接口不存在。' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: '方法不支持。' });
      let relative = decodeURIComponent(url.pathname);
      if (relative === '/') relative = '/index.html';
      if (relative.split(/[\\/]/).some(p => p.startsWith('.'))) return json(403, { error: '禁止访问。' });
      const file = path.resolve(gameDir, '.' + relative);
      if (!file.startsWith(path.resolve(gameDir) + path.sep) || !fs.statSync(file).isFile()) return json(404, { error: '文件不存在。' });
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : error instanceof SyntaxError && req.method === 'POST' ? 400 : 500);
      json(status, { error: status === 500 ? '读取或写入磁盘存档失败。请保留 data 文件夹，检查磁盘权限和备份。' : error.message });
      if (status === 500) console.error(error);
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createGameServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '端口 8765 已被使用。若游戏已启动，请打开 http://127.0.0.1:8765/' : error); process.exitCode = 1; });
  server.listen(8765, '127.0.0.1', () => console.log('猫国建设者本地版：http://127.0.0.1:8765/\n存档目录：' + path.join(root, 'data') + '\n关闭此窗口会停止服务。'));
}
