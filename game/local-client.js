(function () {
  'use strict';
  var key = 'com.nuclearunicorn.kittengame.savedata';
  var revision = null, chain = Promise.resolve(), suspended = false, conflict = false, gameRef;
  var api = window.localGame = { ready: false };
  var initialError = '';
  var intervalKey = 'cat-nation.local.autosave-seconds', saveInterval = 15, saveTimer;
  var saveIntervals = [{ seconds: 5, label: '5 秒' }, { seconds: 15, label: '15 秒' }, { seconds: 30, label: '30 秒' }, { seconds: 60, label: '1 分钟' }, { seconds: 120, label: '2 分钟' }, { seconds: 300, label: '5 分钟' }, { seconds: 600, label: '10 分钟' }];
  try {
    var storedInterval = Number(localStorage.getItem(intervalKey));
    if (saveIntervals.some(function (item) { return item.seconds === storedInterval; })) saveInterval = storedInterval;
  } catch (_) {}

  function intervalLabel() { return saveIntervals.find(function (item) { return item.seconds === saveInterval; }).label; }
  function scheduleAutosave() {
    clearInterval(saveTimer);
    if (!gameRef) return;
    saveTimer = setInterval(function () {
      if (!suspended && !conflict && !gameRef.currentSaveIsBroken && !gameRef.previewMode) gameRef.save();
    }, saveInterval * 1000);
  }
  api.getSaveInterval = function () { return saveInterval; };
  api.setSaveInterval = function (seconds) {
    seconds = Number(seconds);
    if (!saveIntervals.some(function (item) { return item.seconds === seconds; })) throw new Error('请选择有效的自动存档间隔。');
    localStorage.setItem(intervalKey, String(seconds));
    saveInterval = seconds;
    scheduleAutosave();
    document.querySelectorAll('[data-save-interval]').forEach(function (select) { select.value = String(saveInterval); });
    var target = document.getElementById('local-status');
    if (target && !target.classList.contains('error')) status('自动存档：每 ' + intervalLabel() + ' · 从现在重新计时');
  };
  api.bindSaveInterval = function (select) {
    saveIntervals.forEach(function (item) { select.add(new Option(item.label, String(item.seconds))); });
    select.value = String(saveInterval);
    select.addEventListener('change', function () {
      try { api.setSaveInterval(select.value); }
      catch (error) { select.value = String(saveInterval); status('设置未保存：' + error.message, true); }
    });
  };

  // Load disk state before the original game reads browser storage.
  try {
    var request = new XMLHttpRequest();
    request.open('GET', '/api/state', false);
    request.send();
    if (request.status !== 200) throw new Error('无法读取磁盘存档。为避免覆盖旧进度，游戏已停止加载。请查看 data/backups 和本地使用说明。');
    var state = JSON.parse(request.responseText);
    revision = state.revision;
    if (state.save) localStorage.setItem(key, JSON.stringify(state.save));
    else if (state.revision !== null) localStorage.removeItem(key);
    if (!localStorage.getItem('com.nuclearunicorn.kittengame.language')) {
      localStorage.setItem('com.nuclearunicorn.kittengame.language', 'zh');
    }
    api.ready = true;
  } catch (error) { initialError = error.message; }

  function status(text, error) {
    var target = document.getElementById('local-status');
    if (target) { target.textContent = text; target.classList.toggle('error', !!error); }
  }

  async function call(url, body) {
    var response = await fetch(url, body === undefined ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: false
    });
    var data = await response.json();
    if (!response.ok) {
      if (response.status === 409) {
        conflict = true;
        if (gameRef) gameRef.isPaused = true;
      }
      throw new Error(data.error || '无法连接本地服务。');
    }
    return data;
  }

  function write(save, kind) {
    if (conflict) return Promise.reject(new Error('存档已被其他窗口修改，请先刷新。'));
    var pending = chain.then(async function () {
      if (conflict) throw new Error('存档已被其他窗口修改，请先刷新。');
      status('正在写入磁盘…');
      var result = await call('/api/save', { save: save, revision: revision, kind: kind });
      revision = result.revision;
      status('已保存到磁盘 · ' + new Date(result.savedAt).toLocaleTimeString('zh-CN'));
      return result;
    });
    chain = pending.catch(function (error) { status('保存失败：' + error.message, true); });
    return pending;
  }

  function serialize() {
    if (!gameRef || gameRef.currentSaveIsBroken || gameRef.previewMode) throw new Error('游戏尚未就绪或存档加载失败，已阻止保存。');
    var wasSuspended = suspended;
    suspended = true;
    try { return gameRef.save(); } finally { suspended = wasSuspended; }
  }
  api.canWrite = function () { return api.ready && !conflict && !!gameRef && !gameRef.currentSaveIsBroken; };
  api.save = function (kind) { return write(serialize(), kind || 'manual'); };

  function download(save, name) {
    var url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }));
    var link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function ask(message) {
    return new Promise(function (resolve) {
      var dialog = document.getElementById('local-confirm');
      document.getElementById('local-confirm-message').textContent = message;
      function finish(answer) { dialog.close(); resolve(answer); }
      document.getElementById('local-confirm-yes').onclick = function () { finish(true); };
      document.getElementById('local-confirm-no').onclick = function () { finish(false); };
      dialog.oncancel = function (event) { event.preventDefault(); finish(false); };
      dialog.showModal();
    });
  }

  async function replace(save, kind) {
    var wasPaused = gameRef.isPaused;
    suspended = true;
    gameRef.isPaused = true;
    try { await chain; await write(save, kind); location.reload(); }
    catch (error) { status(error.message, true); suspended = false; gameRef.isPaused = conflict || wasPaused; throw error; }
  }

  api.prepare = function () {
    classes.game.Server.prototype.syncUserProfile = function () {};
    classes.game.Server.prototype.fetchBcoinPrice = function (handler) {
      if (handler) handler(this.bcoinPrice);
      return $.Deferred().resolve().promise();
    };
    classes.game.Server.prototype._xhr = function () { return $.Deferred().reject({ status: 503 }).promise(); };
  };

  api.attach = function (game) {
    gameRef = game;
    game.opts.disableTelemetry = true;
    // Use one wall-clock autosave timer, including while the game is paused.
    game.autosaveFrequency = game.ticksBeforeSave = Infinity;
    var originalSave = game.save;
    game.save = function () {
      var data = originalSave.apply(this, arguments);
      if (!suspended && !this.currentSaveIsBroken && !this.previewMode) write(data, 'auto').catch(function () {});
      return data;
    };
    game._wipe = function () { replace(null, 'new').catch(function (error) { alert(error.message); }); };
    game.resetAutomatic = function () {
      game.timer.scheduleEvent(async function () {
        suspended = true;
        game.isPaused = true;
        try {
          await chain;
          await write(serialize(), 'manual');
          var resetSave = game._resetInternal();
          await write(resetSave, 'reset');
          location.reload();
        } catch (error) { status('转生保存失败：' + error.message + '。请从最近的手动备份恢复。', true); alert(error.message); }
      });
    };
    game._loadSaveJson = function (text, callback) {
      try {
        var parsed = JSON.parse(text.trim()[0] === '{' ? text : game.decompressLZData(text));
        replace(parsed, 'import').catch(callback);
      } catch (error) { callback(error); }
    };
    status('本地存档已就绪 · 每 ' + intervalLabel() + '自动保存');
    scheduleAutosave();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && !suspended && !conflict && !game.currentSaveIsBroken) game.save();
    });
    window.addEventListener('beforeunload', function (event) {
      if (suspended) return;
      // Page exit is a best-effort flush; periodic saves are the durable baseline.
      try {
        var save = serialize();
        fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ save: save, revision: revision, kind: 'auto' }), keepalive: true }).catch(function () {});
      } catch (_) {}
    });
    if (!game.currentSaveIsBroken) game.save();
  };

  document.addEventListener('DOMContentLoaded', function () {
    var dock = document.createElement('aside');
    dock.id = 'local-dock';
    dock.innerHTML = '<div class="local-summary"><strong>猫国 · 本地版</strong><span id="local-status" role="status" aria-live="polite">正在加载…</span><button id="local-manage">存档管理</button></div>' +
      '<dialog id="local-dialog"><div class="local-heading"><h2>本地存档</h2><button id="local-close" aria-label="关闭存档管理">✕</button></div>' +
      '<p>进度写入 <code>data/latest.json</code>，每分钟保留一个自动快照（最近 240 份）。手动备份和恢复前的快照长期保留。</p>' +
      '<div class="local-autosave"><label for="local-save-interval">自动存档间隔</label><select id="local-save-interval" data-save-interval></select><span>立即生效，并记住本浏览器的选择。</span></div>' +
      '<div class="local-actions"><button id="local-save" class="primary">立即保存并备份</button><button id="local-export">导出存档文件</button><button id="local-import">导入存档文件</button></div>' +
      '<input type="file" id="local-file" accept=".json,.txt,.save" hidden>' +
      '<label for="local-text">也可以粘贴原版导出的存档文字</label><textarea id="local-text" rows="3" placeholder="粘贴 JSON 或原版压缩存档"></textarea><button id="local-import-text">导入这段存档</button>' +
      '<div class="local-heading"><h3>历史备份</h3><button id="local-refresh">刷新列表</button></div><div id="local-backups"></div>' +
      '<p class="local-note">只需运行 start.cmd，无须联网。关闭游戏前可点击“立即保存并备份”。跨设备搬家时复制整个项目，或使用导出文件。</p></dialog>' +
      '<dialog id="local-confirm" aria-labelledby="local-confirm-title"><h3 id="local-confirm-title">确认替换进度</h3><p id="local-confirm-message"></p><div class="local-actions"><button id="local-confirm-no" autofocus>取消</button><button id="local-confirm-yes">确认并保留旧备份</button></div></dialog>';
    document.body.appendChild(dock);
    api.bindSaveInterval(document.getElementById('local-save-interval'));
    var dialog = document.getElementById('local-dialog');
    function bind(id, action) {
      document.getElementById(id).addEventListener('click', async function () {
        try { await action(); } catch (error) { status(error.message, true); alert(error.message); }
      });
    }
    async function list() {
      var records = await call('/api/backups');
      var container = document.getElementById('local-backups'); container.replaceChildren();
      if (!records.length) { container.textContent = '还没有历史备份。'; return; }
      records.forEach(function (record) {
        var row = document.createElement('div'); row.className = 'local-backup';
        var label = document.createElement('span');
        var pieces = record.name.split('_');
        var kinds = { auto: '自动', manual: '手动', import: '导入', restore: '恢复', new: '新游戏', reset: '转生' };
        var timestamp = pieces[0].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
        label.textContent = new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + ' · ' + (kinds[pieces[1]] || '操作前');
        var button = document.createElement('button'); button.textContent = '恢复';
        button.addEventListener('click', async function () {
          try {
            if (!await ask('恢复此备份？当前磁盘进度会先自动备份。')) return;
            var result = await call('/api/backup/' + encodeURIComponent(record.name));
            await replace(result.save, 'restore');
          } catch (error) { alert(error.message); }
        });
        row.append(label, button); container.appendChild(row);
      });
    }
    async function importText(text) {
      if (!gameRef) throw new Error('请等待游戏加载完成。');
      var raw = text.trim();
      var parsed;
      try { parsed = JSON.parse(raw); }
      catch (_) { parsed = JSON.parse(gameRef.decompressLZData(raw.replace(/\s/g, ''))); }
      if (parsed && parsed.save && parsed.revision) parsed = parsed.save;
      if (!parsed || !Array.isArray(parsed.resources) || !parsed.calendar || !parsed.game || !parsed.buildings) throw new Error('文件内容不是有效的猫国存档。');
      if (!await ask('导入存档并替换当前进度？当前磁盘进度会先自动备份。')) return;
      await replace(parsed, 'import');
    }
    bind('local-manage', async function () { dialog.showModal(); await list(); });
    bind('local-close', function () { dialog.close(); });
    bind('local-save', async function () { await write(serialize(), 'manual'); await list(); });
    bind('local-export', function () { download(serialize(), 'kittens-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'); });
    bind('local-import', function () { document.getElementById('local-file').click(); });
    bind('local-import-text', function () { return importText(document.getElementById('local-text').value); });
    bind('local-refresh', list);
    document.getElementById('local-file').addEventListener('change', async function (event) {
      try { if (event.target.files[0]) await importText(await event.target.files[0].text()); }
      catch (error) { alert('导入失败：' + error.message); }
      event.target.value = '';
    });
    if (initialError) { status(initialError, true); alert(initialError); }
  });
}());
