(function (root, factory) {
  var api = factory(root.HexWorld || (typeof require === 'function' ? require('../hex-demo/world.js') : null), root.CatMapConfig || (typeof require === 'function' ? require('./config.js') : null));
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatMapState = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (W, config) {
  'use strict';
  var districts = {
    agriculture: { name:'农业区', sprite:'field', terrain:['grass'], ids:['field','pasture','aqueduct'], preferred:[0,1] },
    housing: { name:'居住区', sprite:'hut', terrain:['grass'], ids:['hut','logHouse','mansion'], preferred:[-1,0] },
    science: { name:'学术区', sprite:'library', terrain:['grass'], ids:['library','academy','observatory','biolab','aiCore'], preferred:[0,-1] },
    forestry: { name:'林业区', sprite:'lumber', terrain:['forest'], ids:['lumberMill'], preferred:[-2,2] },
    mining: { name:'矿业区', sprite:'quarry', terrain:['mountain'], ids:['mine','quarry'], preferred:[-2,0] },
    storage: { name:'仓储区', sprite:'storage', terrain:['grass'], ids:['barn','warehouse'], preferred:[-1,1] },
    industry: { name:'工业区', sprite:'industry', terrain:['grass','mountain'], ids:['workshop','smelter','calciner','steamworks','factory','accelerator','oilWell'], preferred:[-1,-1] },
    religion: { name:'宗教区', sprite:'temple', terrain:['grass'], ids:['temple','chapel','ziggurat','unicornPasture'], preferred:[1,1] },
    culture: { name:'文化区', sprite:'culture', terrain:['grass'], ids:['amphitheatre','brewery'], preferred:[0,2] },
    trade: { name:'贸易区', sprite:'trade', terrain:['grass'], ids:['tradepost','mint'], preferred:[1,0] },
    port: { name:'沿岸区', sprite:'port', terrain:['grass','water'], ids:['harbor'], preferred:[2,-1] },
    energy: { name:'能源区', sprite:'energy', terrain:['grass','mountain'], ids:['magneto','reactor'], preferred:[1,-1] },
    time: { name:'时间区', sprite:'time', terrain:['grass'], ids:['chronosphere','stasisPod'], preferred:[-1,2] },
    civic: { name:'综合区', sprite:'civic', terrain:['grass'], ids:[], preferred:[0,-2] }
  };
  function distance(a,b) { b=b||{q:0,r:0};return Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r)); }
  function key(tile) { return tile.q+','+tile.r; }
  function groupFor(building) {
    if ((building.name==='pasture'||building.name==='aqueduct')&&building.stage===1) return 'energy';
    return Object.keys(districts).find(function(id){return districts[id].ids.includes(building.name);})||'civic';
  }
  function amount(lots) { return (lots||[]).reduce(function(sum,lot){return sum+lot.count;},0); }
  function count(tile,id) { return id?amount(tile.lots[id]):Object.keys(tile.lots).reduce(function(sum,name){return sum+amount(tile.lots[name]);},0); }
  function cleanLots(lots) {
    return (Array.isArray(lots)?lots:[]).filter(function(lot){return lot&&Number.isSafeInteger(lot.count)&&lot.count>0;}).map(function(lot){
      return {count:lot.count,stage:Number.isInteger(lot.stage)?lot.stage:0,prices:Array.isArray(lot.prices)?lot.prices.filter(function(p){return p&&typeof p.name==='string'&&Number.isFinite(p.val)&&p.val>=0;}).map(function(p){return {name:p.name,val:p.val};}):null};
    });
  }
  function MapState(saved) { this.load(saved); }
  MapState.prototype.load=function(saved) {
    this.cells=W.createWorld().map(function(tile){tile.baseTerrain=tile.terrain==='mist'?(tile.r<0?'forest':'grass'):tile.terrain;tile.building=null;tile.district=null;tile.lots={};tile.count=0;tile.owned=distance(tile)<=1;tile.explored=distance(tile)<=2;return tile;});
    this.camera={elevation:45,azimuth:-20,zoom:1,panX:0,panY:0};this.goal=null;this.groups={};this.reserve={};
    this.migrating=!(saved&&saved.version===2);
    if(saved&&(saved.version===1||saved.version===2)&&Array.isArray(saved.tiles)) {
      saved.tiles.forEach(function(record){var tile=this.at(record.q,record.r);if(!tile)return;tile.owned=record.owned===true;tile.explored=record.explored===true||tile.owned;if(districts[record.district]&&this.suitable(tile,record.district)){tile.district=record.district;tile.owned=tile.explored=true;}
        if(saved.version===2&&record.lots&&tile.district)Object.keys(record.lots).forEach(function(id){tile.lots[id]=cleanLots(record.lots[id]);});
      },this);
      if(saved.version===2&&saved.reserve)Object.keys(saved.reserve).forEach(function(id){this.reserve[id]=cleanLots(saved.reserve[id]);},this);
      var camera=saved.camera||{};
      ['elevation','azimuth','zoom','panX','panY'].forEach(function(k){if(Number.isFinite(camera[k]))this.camera[k]=camera[k];},this);
      this.camera.elevation=Math.max(30,Math.min(90,this.camera.elevation));this.camera.azimuth=Math.max(-180,Math.min(180,this.camera.azimuth));this.camera.zoom=Math.max(.6,Math.min(1.8,this.camera.zoom));
      this.camera.panX=Math.max(-400,Math.min(400,this.camera.panX));this.camera.panY=Math.max(-300,Math.min(300,this.camera.panY));
      this.goal=typeof saved.goal==='string'?saved.goal:null;
    }
    this.at(0,0).district='home';this.at(0,0).owned=this.at(0,0).explored=true;this.at(0,0).lots={};
    if(!saved||![1,2].includes(saved.version)){this.at(0,1).district='agriculture';this.at(-1,0).district='housing';this.at(0,-1).district='science';}
    this.cells.filter(function(t){return t.owned;}).forEach(function(t){this.connect(t);},this);
    this.refresh();
  };
  MapState.prototype.at=function(q,r){return this.cells.find(function(t){return t.q===q&&t.r===r;})||null;};
  MapState.prototype.neighbors=function(tile){return this.cells.filter(function(t){return distance(tile,t)===1;});};
  MapState.prototype.suitable=function(tile,id){var d=districts[id];return !!tile&&!!d&&!(tile.q===0&&tile.r===0)&&d.terrain.includes(tile.baseTerrain)&&(id!=='port'||this.neighbors(tile).some(function(n){return (tile.baseTerrain==='water')!==(n.baseTerrain==='water');}));};
  MapState.prototype.capacity=function(tile){var n=config.districtCapacities[tile.district]??config.defaultTileCapacity;return Number.isSafeInteger(n)&&n>0?n:10;};
  MapState.prototype.count=function(tile,id){return tile?count(tile,id):0;};
  MapState.prototype.free=function(tile){return tile&&districts[tile.district]?Math.max(0,this.capacity(tile)-count(tile)):0;};
  MapState.prototype.reserveCount=function(id){return amount(this.reserve[id]);};
  MapState.prototype.connect=function(tile){var current=tile;while(distance(current)>0){current.owned=current.explored=true;current=this.neighbors(current).find(function(n){return distance(n)<distance(current);});}};
  MapState.prototype.refresh=function(){
    this.cells.forEach(function(tile){if(tile.owned)this.neighbors(tile).forEach(function(n){n.explored=true;});},this);
    this.cells.forEach(function(tile){
      tile.terrain=tile.explored?tile.baseTerrain:'mist';tile.frontier=!tile.owned&&this.neighbors(tile).some(function(n){return n.owned;});
      tile.count=count(tile);
      tile.limit=districts[tile.district]?this.capacity(tile):0;
      tile.building=tile.district==='home'?'camp':tile.district&&tile.count>0?districts[tile.district].sprite:null;
      tile.label=tile.district==='home'?'聚落中心':tile.district?districts[tile.district].name:'';
    },this);
  };
  MapState.prototype.claim=function(tile){if(!tile||!tile.frontier)return false;tile.owned=tile.explored=true;this.refresh();return true;};
  MapState.prototype.assign=function(tile,id){if(!tile||!tile.owned||!this.suitable(tile,id)||count(tile)>0&&tile.district!==id)return false;tile.district=id;this.refresh();return true;};
  MapState.prototype.clear=function(tile){if(!tile||tile.district==='home'||count(tile)>0)return false;tile.district=null;this.refresh();return true;};
  MapState.prototype.add=function(tile,id,n,prices,stage){
    var store=tile?tile.lots:this.reserve;if(tile&&this.free(tile)<n)return false;
    (store[id]||(store[id]=[])).push({count:n,prices:prices?prices.map(function(p){return {name:p.name,val:p.val};}):null,stage:stage||0});this.refresh();return true;
  };
  MapState.prototype.peek=function(tile,id){var lots=(tile?tile.lots:this.reserve)[id]||[];return lots[lots.length-1]||null;};
  MapState.prototype.remove=function(tile,id,n){var lots=(tile?tile.lots:this.reserve)[id]||[],left=n;while(left>0&&lots.length){var lot=lots[lots.length-1],take=Math.min(left,lot.count);lot.count-=take;left-=take;if(!lot.count)lots.pop();}this.refresh();return n-left;};
  MapState.prototype.place=function(tile,id,n){
    if(!tile||!tile.owned||this.groups[id]&&this.groups[id].district!==tile.district)return 0;
    var left=Math.min(n||1,this.free(tile),this.reserveCount(id)),placed=0;
    while(left>0){var lot=this.peek(null,id);if(!lot)break;var take=Math.min(left,lot.count);this.add(tile,id,take,lot.prices,lot.stage);this.remove(null,id,take);left-=take;placed+=take;}return placed;
  };
  MapState.prototype.reconcile=function(buildings,workers){
    this.groups={};
    buildings.forEach(function(b){this.groups[b.name]={count:b.val||0,on:b.on||0,district:groupFor(b),stage:b.stage||0};},this);
    var self=this;
    [this.reserve].concat(this.cells.map(function(t){return t.lots;})).forEach(function(store){Object.keys(store).forEach(function(id){if(!self.groups[id]){delete store[id];return;}store[id]=store[id].filter(function(lot){return lot.stage===self.groups[id].stage;});});});
    this.cells.forEach(function(tile){Object.keys(tile.lots).forEach(function(id){if(!tile.lots[id].length)return;var group=this.groups[id];if(group.district!==tile.district){this.reserve[id]=(this.reserve[id]||[]).concat(tile.lots[id]);tile.lots[id]=[];}},this);
      var overflow=Math.max(0,count(tile)-this.capacity(tile));
      Object.keys(tile.lots).reverse().forEach(function(id){while(overflow>0&&this.peek(tile,id)){var lot=this.peek(tile,id),take=Math.min(overflow,lot.count);this.add(null,id,take,lot.prices,lot.stage);this.remove(tile,id,take);overflow-=take;}},this);
    },this);
    buildings.forEach(function(b){
      var id=b.name,total=this.reserveCount(id)+this.cells.reduce(function(sum,t){return sum+count(t,id);},0),delta=(b.val||0)-total;
      if(delta<0){var remaining=-delta;remaining-=this.remove(null,id,remaining);this.cells.slice().reverse().forEach(function(tile){if(remaining>0)remaining-=this.remove(tile,id,remaining);},this);}
      if(delta>0)this.add(null,id,delta,null,b.stage);
    },this);
    if(this.migrating){
      Object.keys(districts).forEach(function(district){var ids=buildings.filter(function(b){return groupFor(b)===district&&b.val>0;}).map(function(b){return b.name;});if(!ids.length)return;
        var tiles=this.cells.filter(function(t){return t.district===district;});
        var pref=districts[district].preferred,candidates=this.cells.filter(function(t){return !t.district&&this.suitable(t,district);},this).sort(function(a,b){return distance(a,{q:pref[0],r:pref[1]})-distance(b,{q:pref[0],r:pref[1]});});
        ids.forEach(function(id){while(this.reserveCount(id)>0){var tile=tiles.find(function(t){return this.free(t)>0;},this);if(!tile){tile=candidates.shift();if(!tile)break;this.connect(tile);tile.owned=tile.explored=true;tile.district=district;tiles.push(tile);}this.place(tile,id,this.free(tile));}},this);
      },this);this.migrating=false;
    }
    this.workers=workers||0;this.refresh();
  };
  MapState.prototype.arrange=function(){this.cells.forEach(function(tile){if(!districts[tile.district])return;Object.keys(this.groups).forEach(function(id){if(this.groups[id].district===tile.district)this.place(tile,id,this.free(tile));},this);},this);this.refresh();};
  MapState.prototype.roads=function(){var edges={},result=[];this.cells.filter(function(t){return t.district&&t.district!=='home';}).forEach(function(tile){var current=tile;while(distance(current)>0){var next=this.neighbors(current).find(function(n){return n.owned&&distance(n)<distance(current);});if(!next)break;var id=[key(current),key(next)].sort().join(':');if(!edges[id]&&current.baseTerrain!=='water'&&next.baseTerrain!=='water'){edges[id]=true;result.push([[current.q,current.r],[next.q,next.r]]);}current=next;}},this);return result;};
  MapState.prototype.serialize=function(){return {version:2,tiles:this.cells.map(function(t){return {q:t.q,r:t.r,owned:t.owned,explored:t.explored,district:t.district,lots:JSON.parse(JSON.stringify(t.lots))};}),reserve:JSON.parse(JSON.stringify(this.reserve)),camera:Object.assign({},this.camera),goal:this.goal};};
  return {MapState:MapState,districts:districts,groupFor:groupFor,distance:distance,config:config};
}));
