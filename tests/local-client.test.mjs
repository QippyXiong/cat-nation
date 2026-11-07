import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../game/local-client.js', import.meta.url), 'utf8');

function client(storage = new Map()) {
  let now = 0, nextId = 1, rejectWrite = false;
  const timers = new Map(), writes = [], events = {};
  const sandbox = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    XMLHttpRequest: class {
      open() {}
      send() { this.status = 200; this.responseText = '{"revision":null,"save":null}'; }
    },
    document: {
      hidden: false,
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener: (name, handler) => { events[name] = handler; }
    },
    setInterval: (fn, delay) => {
      const id = nextId++;
      timers.set(id, { fn, delay, at: now + delay });
      return id;
    },
    clearInterval: id => timers.delete(id),
    addEventListener: () => {},
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      writes.push(body);
      return {
        ok: !rejectWrite, status: rejectWrite ? 409 : 200,
        json: async () => rejectWrite ? { error: '存档冲突' } : { revision: String(writes.length), savedAt: new Date(now).toISOString() }
      };
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const game = {
    opts: {},
    ticks: 0,
    ticksPerSecond: 5,
    tick() { if (!this.isPaused) this.ticks++; },
    getTicksPerSecondUI() { return this.ticksPerSecond; },
    save() { this.ticksBeforeSave = this.autosaveFrequency; return { hexMap: { version: 1 }, progress: now }; }
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return {
    api: sandbox.localGame, game, writes,
    attach: async () => { sandbox.localGame.attach(game); await flush(); },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers.values()].filter(timer => timer.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at;
        next.at += next.delay;
        next.fn();
        await flush();
      }
      now = end;
    },
    background: async () => { sandbox.document.hidden = true; events.visibilitychange(); await flush(); },
    conflict: () => { rejectWrite = true; }
  };
}

test('autosave interval reschedules without duplicate timers, survives reload, and preserves manual saves and conflict protection', async () => {
  const storage = new Map(), current = client(storage);
  assert.equal(current.api.getSaveInterval(), 15);
  await current.attach();
  assert.equal(current.writes.length, 1);
  assert.equal(current.game.ticksBeforeSave, Infinity);
  await current.advance(14999);
  assert.equal(current.writes.length, 1);
  await current.advance(1);
  assert.equal(current.writes.length, 2);
  current.api.setSaveInterval(300);
  await current.advance(80000);
  assert.equal(current.writes.length, 2);
  current.api.setSaveInterval(5);
  await current.advance(4999);
  assert.equal(current.writes.length, 2);
  await current.advance(1);
  assert.equal(current.writes.length, 3);
  assert.equal(current.writes[2].save.hexMap.version, 1);
  current.api.setSaveInterval(30);
  current.game.isPaused = true;
  await current.advance(29999);
  assert.equal(current.writes.length, 3);
  await current.advance(1);
  assert.equal(current.writes.length, 4);
  await current.api.save('manual');
  assert.equal(current.writes.at(-1).kind, 'manual');
  await current.background();
  assert.equal(current.writes.length, 6);
  const reloaded = client(storage);
  assert.equal(reloaded.api.getSaveInterval(), 30);
  assert.throws(() => current.api.setSaveInterval(0));
  assert.equal(current.api.getSaveInterval(), 30);
  current.conflict();
  await current.advance(30000);
  assert.equal(current.api.canWrite(), false);
  await current.advance(60000);
  assert.equal(current.writes.length, 7);
});

test('speed accelerates simulation steps and displayed rates, persists, and does not accelerate disk saves', async () => {
  const storage = new Map(), current = client(storage);
  await current.attach();
  assert.equal(current.api.getGameSpeed(), 1);
  current.game.tick();
  assert.equal(current.game.ticks, 1);
  for (const speed of [2, 3, 5, 10, 20, 1]) {
    current.api.setGameSpeed(speed);
    const before = current.game.ticks;
    current.game.tick();
    assert.equal(current.game.ticks - before, speed);
    assert.equal(current.game.getTicksPerSecondUI(), 5 * speed);
    assert.equal(current.game.ticksPerSecond, 5);
  }
  current.api.setGameSpeed(10);
  current.game.isPaused = true;
  const paused = current.game.ticks;
  current.game.tick();
  assert.equal(current.game.ticks, paused);
  await current.advance(14999);
  assert.equal(current.writes.length, 1);
  await current.advance(1);
  assert.equal(current.writes.length, 2);
  assert.equal(client(storage).api.getGameSpeed(), 10);
  for (const invalid of [0, -1, 4, 100, Infinity, NaN]) assert.throws(() => current.api.setGameSpeed(invalid));
  assert.equal(current.api.getGameSpeed(), 10);
  current.game.isPaused = false;
  current.conflict();
  await current.advance(15000);
  current.game.tick();
  assert.equal(current.game.ticks, paused);
});

test('pausing or beginning a reset inside a speed batch prevents all remaining simulation steps', async () => {
  const current = client();
  let pulses = 0;
  current.game.tick = function () { pulses++; this.isPaused = true; };
  await current.attach();
  current.api.setGameSpeed(20);
  current.game.tick();
  assert.equal(pulses, 1);
});
