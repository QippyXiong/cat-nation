(function (root) {
  'use strict';
  var names = { grass: '草地', forest: '林地', mountain: '山地', water: '水域', mist: '迷雾' };
  var buildings = {
    camp: { name: '第一簇营火', type: '聚落中心', description: '木柴噼啪作响，小猫们围坐在这里，商量谷地的第一间小屋。' },
    hut: { name: '猫咪小屋', type: '居住区', description: '红瓦屋顶下藏着柔软的草垫。窗边的灯亮了，远行的小猫也有了归处。' },
    field: { name: '猫薄荷田', type: '农耕地块', description: '猫薄荷与谷物沿着田垄生长。木栅栏外，一只好奇的小猫正在打盹。' },
    library: { name: '星灯图书馆', type: '知识区', description: '书架、地图和一盏蓝色星灯。猫咪们在这里记录季节，猜想森林之外的世界。' },
    lumber: { name: '林间伐木站', type: '林业地块', description: '木料整齐地堆在林缘。留下一些新苗，这片森林就能陪伴营地很久。' },
    quarry: { name: '灰岩采石场', type: '矿业地块', description: '山脚下露出浅灰色岩层，矿工的小推车停在石块旁边。' },
    ruins: { name: '苔石遗迹', type: '探索地点', description: '青苔覆盖着古老石柱，石缝里泛着微光。这里曾经属于怎样的文明？' }
  };
  function position(q, r) { return { x: 300 + 48 * (q + r / 2), y: 207 + 42 * r }; }
  function hash(q, r, seed) { var n = Math.sin(q * 127.1 + r * 311.7 + (seed || 0) * 74.7) * 43758.5453; return n - Math.floor(n); }
  function createWorld() {
    var cells = [];
    for (var r = -4; r <= 4; r++) {
      for (var q = Math.max(-4, -r - 4); q <= Math.min(4, -r + 4); q++) {
        var type = 'grass';
        if ((q >= 2 && r <= 1) || (q === 1 && r === -2) || (q === 1 && r === 2)) type = 'water';
        else if ((q <= -2 && r <= 0) || (q === 0 && r === -3)) type = 'mountain';
        else if ((q <= -2 && r >= 1) || (q >= -1 && q <= 1 && r >= 3) || (q === 1 && r === -3)) type = 'forest';
        if ((r === -4 && q >= 1) || (r === 4 && q <= -2)) type = 'mist';
        cells.push({ q: q, r: r, terrain: type, building: null });
      }
    }
    var preset = [[0,0,'camp'],[-1,0,'hut'],[0,1,'hut'],[1,0,'hut'],[0,-1,'library'],[-1,1,'field'],[-1,2,'field'],[-2,2,'lumber'],[-2,0,'quarry'],[-1,-2,'ruins']];
    preset.forEach(function (p) { var tile = cells.find(function (c) { return c.q === p[0] && c.r === p[1]; }); tile.building = p[2]; });
    return cells;
  }
  function tileAt(cells, x, y) {
    return cells.find(function (tile) {
      var p = position(tile.q, tile.r), dx = Math.abs(x - p.x), dy = Math.abs(y - p.y);
      return dx <= 24 && dy <= 28 && (dy <= 14 || dx <= (28 - dy) * 24 / 14);
    }) || null;
  }
  function createCamera(cells, elevation, azimuth) {
    elevation = Math.max(30, Math.min(90, Number.isFinite(elevation) ? elevation : 45));
    azimuth = Math.max(-180, Math.min(180, Number.isFinite(azimuth) ? azimuth : -20));
    var angle = azimuth * Math.PI / 180, pitch = Math.sin(elevation * Math.PI / 180);
    var cos = Math.cos(angle), sin = Math.sin(angle), maxX = 0, maxY = 0;
    var corners = [[0,-28],[24,-14],[24,14],[0,28],[-24,14],[-24,-14]];
    cells.forEach(function (tile) {
      var p = position(tile.q, tile.r);
      corners.forEach(function (corner) {
        var dx = p.x + corner[0] - 300, dy = p.y + corner[1] - 207;
        maxX = Math.max(maxX, Math.abs(cos * dx - sin * dy));
        maxY = Math.max(maxY, Math.abs((sin * dx + cos * dy) * pitch));
      });
    });
    var scale = Math.min(1.18, 266 / (maxX || 1), 150 / (maxY || 1));
    var a = cos * scale, b = sin * pitch * scale, c = -sin * scale, d = cos * pitch * scale;
    return { elevation: elevation, azimuth: azimuth, scale: scale, a: a, b: b, c: c, d: d, e: 300 - a * 300 - c * 207, f: 225 - b * 300 - d * 207 };
  }
  function project(camera, x, y) { return { x: camera.a * x + camera.c * y + camera.e, y: camera.b * x + camera.d * y + camera.f }; }
  function unproject(camera, x, y) {
    var dx = x - camera.e, dy = y - camera.f, det = camera.a * camera.d - camera.b * camera.c;
    return { x: (camera.d * dx - camera.c * dy) / det, y: (-camera.b * dx + camera.a * dy) / det };
  }
  function canBuild(tile) { return !!tile && tile.terrain === 'grass' && !tile.building; }
  function place(tile, building) {
    if (!canBuild(tile) || !['field', 'hut', 'library'].includes(building)) return false;
    tile.building = building;
    return true;
  }
  var api = { names: names, buildings: buildings, position: position, hash: hash, createWorld: createWorld, tileAt: tileAt, canBuild: canBuild, place: place, createCamera: createCamera, project: project, unproject: unproject };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HexWorld = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
