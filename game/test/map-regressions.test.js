const Bridge = require('../map/bridge');

function newGame() {
  global.gamePage = global.game = new com.nuclearunicorn.game.ui.GamePage();
  game.setUI(new classes.ui.UISystem('gameContainerId'));
  game.resetState();
  LCstorage.removeItem('com.nuclearunicorn.kittengame.savedata');
  return new Bridge(game, { classes, com });
}

test('a full district does not consume queued construction; adding a district resumes the same order', () => {
  const bridge = newGame(), field = game.bld.get('field');
  field.unlocked = true;
  game.resPool.get('catnip').value = 4000;
  bridge.buy('building', 'field', 10, bridge.map.at(0, 1));
  const stock = game.resPool.get('catnip').value;
  game.time.queue.addToQueue('field', 'buildings', 'field');
  game.time.queue.update();
  expect(game.time.queue.queueLength()).toBe(1);
  expect(field.val).toBe(10);
  expect(game.resPool.get('catnip').value).toBe(stock);
  const second = bridge.map.at(1, 1);
  bridge.map.claim(second);
  bridge.map.assign(second, 'agriculture');
  game.time.queue.update();
  bridge.sync();
  expect(game.time.queue.queueLength()).toBe(0);
  expect(field.val).toBe(11);
  expect(bridge.map.count(second, 'field')).toBe(1);
  expect(bridge.map.peek(second, 'field').prices[0].val).toBeGreaterThan(0);
});

test('reset saves a fresh map rather than carrying old territory, districts, goal, and paid lots into a new run', () => {
  const bridge = newGame();
  game.bld.get('field').unlocked = true;
  game.resPool.get('catnip').value = 1000;
  bridge.buy('building', 'field', 1, bridge.map.at(0, 1));
  bridge.map.claim(bridge.map.at(1, 1));
  bridge.map.assign(bridge.map.at(1, 1), 'housing');
  bridge.map.goal = 'physics';
  game.save();
  const before = JSON.stringify(bridge.map.serialize());
  const reset = game._resetInternal();
  expect(reset.hexMap.tiles.filter(t => t.owned)).toHaveLength(7);
  expect(reset.hexMap.goal).toBe(null);
  expect(reset.hexMap.tiles.every(t => Object.values(t.lots).every(lots => !lots.length))).toBe(true);
  expect(JSON.stringify(bridge.map.serialize())).toBe(before);
  expect(new (require('../map/state').MapState)(game._parseLSSaveData().hexMap).serialize()).toEqual(reset.hexMap);
  game.load();
  expect(game.bld.get('field').val).toBe(0);
  expect(bridge.map.cells.filter(t => t.owned)).toHaveLength(7);
  expect(bridge.map.reserveCount('field')).toBe(0);
});

test('queued buildings wait for their technology rather than bypassing unlock conditions', () => {
  const bridge = newGame(), tile = bridge.map.at(1, 0);
  bridge.map.assign(tile, 'industry');
  game.resPool.get('wood').value = 1000;
  game.resPool.get('minerals').value = 1000;
  game.time.queue.addToQueue('smelter', 'buildings', 'smelter');
  game.time.queue.update();
  expect(game.bld.get('smelter').val).toBe(0);
  expect(game.time.queue.queueLength()).toBe(1);
  expect(game.resPool.get('wood').value).toBe(1000);
  game.bld.get('smelter').unlocked = true;
  game.time.queue.update();
  bridge.sync();
  expect(game.bld.get('smelter').val).toBe(1);
  expect(game.time.queue.queueLength()).toBe(0);
  expect(bridge.map.count(tile, 'smelter')).toBe(1);
});
