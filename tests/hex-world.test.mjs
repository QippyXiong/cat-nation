import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../game/hex-demo/world.js');

test('hex selection and placement preserve the original terrain and reject occupied or unsuitable tiles', () => {
  const cells = W.createWorld();
  assert.equal(cells.length, 61);
  assert.equal(new Set(cells.map(c => `${c.q},${c.r}`)).size, 61);
  for (const tile of cells) {
    const p = W.position(tile.q, tile.r);
    assert.equal(W.tileAt(cells, p.x, p.y), tile);
    assert.ok(Math.abs(tile.q + tile.r) <= 4);
  }
  assert.equal(W.tileAt(cells, 0, 0), null);
  const tile = cells.find(c => c.q === 1 && c.r === 1);
  assert.equal(W.place(tile, 'field'), true);
  assert.equal(tile.building, 'field');
  assert.equal(tile.terrain, 'grass');
  assert.equal(W.place(tile, 'hut'), false);
  for (const terrain of ['water', 'mountain', 'forest', 'mist']) {
    assert.equal(W.place(cells.find(c => c.terrain === terrain && !c.building), 'hut'), false);
  }
  const empty = cells.find(c => c.terrain === 'grass' && !c.building);
  assert.equal(W.place(empty, 'unknown'), false);
  assert.equal(W.place(null, 'field'), false);
  assert.equal(W.createWorld().find(c => c.q === 1 && c.r === 1).building, null);
});

test('rotated and tilted cameras keep terrain in frame and preserve screen picking at pixel precision', () => {
  const cells = W.createWorld();
  const corners = [[0,-28],[24,-14],[24,14],[0,28],[-24,14],[-24,-14]];
  for (const elevation of [30,35,45,60,90]) {
    for (const azimuth of [-180,-120,-60,-20,0,30,90,180]) {
      const camera = W.createCamera(cells,elevation,azimuth);
      for (const tile of cells) {
        const center = W.position(tile.q,tile.r);
        const projected = W.project(camera,center.x,center.y);
        const picked = W.unproject(camera,Math.round(projected.x),Math.round(projected.y));
        assert.equal(W.tileAt(cells,picked.x,picked.y),tile,`${elevation}/${azimuth}: ${tile.q},${tile.r}`);
        for (const [dx,dy] of corners) {
          const p = W.project(camera,center.x+dx,center.y+dy);
          assert.ok(p.x>=33&&p.x<=567&&p.y>=74&&p.y<=376);
        }
      }
    }
  }
  const ground = W.position(1,1);
  const camera = W.createCamera(cells,35,90);
  const view = W.project(camera,ground.x,ground.y);
  const hit = W.unproject(camera,view.x,view.y);
  assert.equal(W.place(W.tileAt(cells,hit.x,hit.y),'library'),true);
});
