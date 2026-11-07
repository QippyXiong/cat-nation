const Tree = require('../map/tech-tree');
const Bridge = require('../map/bridge');

test('complete technology graph follows native unlocks, prices and research without changing progress during inspection', () => {
  global.gamePage = global.game = new com.nuclearunicorn.game.ui.GamePage();
  game.setUI(new classes.ui.UISystem('gameContainerId'));
  game.resetState();
  LCstorage.removeItem('com.nuclearunicorn.kittengame.savedata');
  const bridge = new Bridge(game, { classes, com });
  const graph = Tree.graph(game);
  expect(graph.nodes.map(n => n.id)).toEqual(game.science.techs.map(t => t.name));
  const edges = game.science.techs.flatMap(t => ((t.unlocks || {}).tech || []).map(id => ({ from: t.name, to: id })));
  expect(graph.edges).toEqual(edges);
  expect(graph.byId.brewery.note).toBeTruthy();
  expect(graph.byId.artificialGravity.parents).toEqual(game.getFeatureFlag('SPACE_EXPL') ? ['dimensionalPhysics'] : []);
  const featureFlag = game.getFeatureFlag;
  game.getFeatureFlag = () => false;
  expect(Tree.graph(game).byId.artificialGravity.note).toBeTruthy();
  game.getFeatureFlag = featureFlag;
  expect(graph.byId.calendar.parents).toEqual([]);
  expect(graph.byId.electronics.parents).toEqual(['mechanization']);
  expect(Tree.relatives(graph, 'electronics', 'parents').has('calendar')).toBe(true);
  expect(Tree.relatives(graph, 'calendar', 'children').has('paradoxalKnowledge')).toBe(true);
  for (const edge of graph.edges) expect(graph.byId[edge.to].y).toBeGreaterThan(graph.byId[edge.from].y + 116);
  for (const a of graph.nodes) {
    for (const b of graph.nodes) {
      if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(180);
    }
    const content = Tree.content(game, a.meta);
    expect(content.description).toBeTruthy();
    expect(content.unlocks.reduce((sum, group) => sum + group.items.length, 0)).toBe(Object.values(a.meta.unlocks || {}).flat().length);
    expect(content.updates.reduce((sum, group) => sum + group.items.length, 0)).toBe(Object.values(a.meta.upgrades || {}).flat().length);
    content.unlocks.forEach(group => group.items.forEach(item => {
      expect(item.title).toBeTruthy();
      expect(item.title).not.toBe('[object Object]');
      expect(item.title).not.toBe('dummy tab');
    }));
  }
  const solar = Tree.content(game, game.science.get('ecology')).unlocks.find(group => group.type === 'stages').items[0];
  expect(solar.title).toBe(game.bld.get('pasture').stages[1].label);
  expect(game.science.techs.every(t => !t.researched)).toBe(true);
  expect(game.resPool.get('science').value).toBe(0);
  expect(Tree.info(game, bridge, graph.byId.calendar).state).toBe('waiting');
  expect(Tree.info(game, bridge, graph.byId.agriculture).state).toBe('locked');
  expect(Tree.info(game, bridge, graph.byId.brewery).canResearch).toBe(false);
  expect(() => bridge.buy('tech', 'agriculture')).toThrow();
  game.resPool.get('science').value = 130;
  expect(Tree.info(game, bridge, graph.byId.calendar).canResearch).toBe(true);
  bridge.buy('tech', 'calendar');
  expect(game.science.get('calendar').researched).toBe(true);
  expect(game.resPool.get('science').value).toBe(100);
  expect(Tree.info(game, bridge, graph.byId.calendar).state).toBe('done');
  expect(Tree.info(game, bridge, graph.byId.agriculture).canResearch).toBe(true);
  bridge.buy('tech', 'agriculture');
  expect(game.science.get('mining').unlocked).toBe(true);
  expect(game.science.get('archery').unlocked).toBe(true);
  expect(game.village.getJob('farmer').unlocked).toBe(true);
  expect(game.resPool.get('science').value).toBe(0);
  game.resPool.update();
  const theology = Tree.info(game, bridge, graph.byId.theology);
  expect(theology.prices.map(p => ({ name: p.name, val: p.val }))).toEqual(game.science.getPrices(game.science.get('theology')));
  expect(theology.prices.find(p => p.name === 'science').capacity).toBe(true);
  expect(theology.prices.find(p => p.name === 'manuscript').missing).toBe(35);
  const save = game.save();
  game.science.get('agriculture').researched = false;
  game.load();
  expect(Tree.info(game, bridge, graph.byId.agriculture).state).toBe('done');
  expect(save.science.techs.find(t => t.name === 'agriculture').researched).toBe(true);
});
