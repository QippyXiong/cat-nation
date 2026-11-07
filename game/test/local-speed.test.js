const fs = require('fs');
const vm = require('vm');

function speedGame(speed) {
  global.gamePage = global.game = new com.nuclearunicorn.game.ui.GamePage();
  game.setUI(new classes.ui.UISystem('gameContainerId'));
  game.resetState();
  LCstorage.removeItem('com.nuclearunicorn.kittengame.savedata');
  game.opts.enableRedshift = false;
  game.bld.get('field').val = game.bld.get('field').on = 1;
  game.updateCaches();
  const scope = {
    localStorage: LCstorage,
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} },
    XMLHttpRequest: class {
      open() {}
      send() { this.status = 200; this.responseText = '{"revision":null,"save":null}'; }
    },
    setInterval: () => 1, clearInterval() {}, addEventListener() {},
    fetch: async () => ({ ok: true, json: async () => ({ revision: 'test', savedAt: new Date().toISOString() }) })
  };
  scope.window = scope;
  vm.runInNewContext(fs.readFileSync(require.resolve('../local-client.js'), 'utf8'), scope);
  scope.localGame.attach(game);
  scope.localGame.setGameSpeed(speed);
  return game;
}

test('speed scales real calendar and resource simulation while retaining native offline units and pause semantics', () => {
  const normal = speedGame(1);
  for (let pulse = 0; pulse < 10; pulse++) normal.tick();
  const days = normal.calendar.day, food = normal.resPool.get('catnip').value;
  expect(food).toBeGreaterThan(0);
  for (const speed of [3, 5, 10, 20]) {
    const accelerated = speedGame(speed);
    for (let pulse = 0; pulse < 10; pulse++) accelerated.tick();
    expect(accelerated.ticks).toBe(10 * speed);
    expect(accelerated.calendar.day).toBeCloseTo(days * speed);
    expect(accelerated.resPool.get('catnip').value).toBeCloseTo(food * speed);
    expect(accelerated.ticksPerSecond).toBe(5);
    expect(accelerated.getTicksPerSecondUI()).toBe(5 * speed);
    const pausedDay = accelerated.calendar.day, pausedFood = accelerated.resPool.get('catnip').value;
    accelerated.isPaused = true;
    accelerated.tick();
    expect(accelerated.calendar.day).toBe(pausedDay);
    expect(accelerated.resPool.get('catnip').value).toBe(pausedFood);
    accelerated.isPaused = false;
    accelerated.timer.scheduleEvent(() => { accelerated.isPaused = true; });
    accelerated.tick();
    expect(accelerated.calendar.day).toBe(pausedDay);
    accelerated.science.get('calendar').researched = true;
    accelerated.time.gainTemporalFlux(Date.now() - 60000);
    expect(accelerated.resPool.get('temporalFlux').value).toBe(5);
  }
});
