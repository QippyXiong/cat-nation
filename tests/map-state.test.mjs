import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {MapState,distance}=require('../game/map/state.js');

function verifyTotals(map,buildings){
  for(const b of buildings)assert.equal(map.reserveCount(b.name)+map.cells.reduce((sum,t)=>sum+map.count(t,b.name),0),b.val);
  for(const tile of map.cells.filter(t=>t.district&&t.district!=='home')){
    assert.ok(tile.count<=map.capacity(tile));
    assert.ok(map.suitable(tile,tile.district));
    assert.ok(tile.owned&&tile.explored);
    let p=tile;
    while(distance(p)>0){p=map.neighbors(p).find(n=>n.owned&&distance(n)<distance(p));assert.ok(p);}
  }
}

test('legacy buildings migrate into bounded independent tiles; overflow remains conserved and persisted without moving existing districts',()=>{
  const buildings=[{name:'field',val:10000,on:10000},{name:'hut',val:500,on:500},{name:'mine',val:32,on:32},{name:'lumberMill',val:17,on:17},{name:'library',val:80,on:80},{name:'pasture',stage:1,val:99,on:99},{name:'harbor',val:20,on:20},{name:'unknownFutureBuilding',val:7,on:7}];
  const original=JSON.stringify(buildings),map=new MapState({version:1,tiles:[{q:1,r:1,owned:true,explored:true,district:'agriculture'}],camera:{azimuth:60},goal:'physics'});
  map.reconcile(buildings,10);
  assert.equal(map.at(1,1).district,'agriculture');
  assert.equal(map.at(1,1).count,10);
  assert.ok(map.reserveCount('field')>0);
  assert.equal(map.groups.pasture.district,'energy');
  verifyTotals(map,buildings);
  const snapshot=JSON.parse(JSON.stringify(map.serialize())),restored=new MapState(snapshot);
  restored.reconcile(buildings,10);
  assert.equal(snapshot.version,2);
  assert.deepEqual(restored.serialize(),snapshot);
  const positions=restored.cells.map(t=>[t.q,t.r,t.district]);
  restored.arrange();restored.reconcile(buildings,10);
  assert.deepEqual(restored.cells.map(t=>[t.q,t.r,t.district]),positions);
  verifyTotals(restored,buildings);
  assert.equal(JSON.stringify(buildings),original);
  assert.ok(map.roads().every(([a,b])=>distance({q:a[0],r:a[1]},{q:b[0],r:b[1]})===1));
});

test('a second district starts empty, populated tiles cannot be repurposed, and historical costs survive reload',()=>{
  const map=new MapState(),buildings=[{name:'field',val:1,on:1}];map.reconcile(buildings,0);
  const first=map.at(0,1),second=map.at(1,1);
  assert.equal(map.claim(map.at(4,0)),false);
  assert.equal(map.claim(second),true);
  assert.equal(map.assign(second,'agriculture'),true);
  map.reconcile(buildings,0);
  assert.equal(map.count(first,'field'),1);
  assert.equal(map.count(second,'field'),0);
  assert.equal(map.assign(first,'housing'),false);
  assert.equal(map.clear(first),false);
  assert.equal(map.add(second,'field',10,[{name:'catnip',val:42}],0),true);
  buildings[0].val+=10;map.reconcile(buildings,0);
  assert.equal(map.free(second),0);
  assert.equal(map.add(second,'field',1,[{name:'catnip',val:50}],0),false);
  const restored=new MapState(map.serialize());restored.reconcile(buildings,0);
  assert.equal(restored.count(first,'field'),1);
  assert.equal(restored.count(second,'field'),10);
  assert.deepEqual(restored.peek(second,'field').prices,[{name:'catnip',val:42}]);
  restored.remove(second,'field',1);buildings[0].val--;restored.reconcile(buildings,0);
  assert.equal(restored.count(second,'field'),9);
  assert.equal(restored.count(first,'field'),1);
  verifyTotals(restored,buildings);
});

test('mixed buildings share slots and lowering capacity preserves overflow costs without relocating another district',()=>{
  const map=new MapState(),buildings=[{name:'field',val:0,on:0},{name:'pasture',val:0,on:0,stage:0}];map.reconcile(buildings,0);
  const tile=map.at(0,1);
  map.add(tile,'field',8,[{name:'catnip',val:30}],0);buildings[0].val=8;
  map.add(tile,'pasture',2,[{name:'catnip',val:100},{name:'wood',val:10}],0);buildings[1].val=2;
  map.reconcile(buildings,0);
  assert.equal(tile.count,10);assert.equal(map.free(tile),0);
  assert.equal(map.add(tile,'pasture',1,[],0),false);
  const config=require('../game/map/config.js'),previous=config.districtCapacities.agriculture;
  try {
    config.districtCapacities.agriculture=5;
    map.reconcile(buildings,0);
    assert.equal(tile.count,5);
    assert.equal(map.reserveCount('field')+map.reserveCount('pasture'),5);
    assert.deepEqual(map.peek(null,'pasture').prices,[{name:'catnip',val:100},{name:'wood',val:10}]);
    verifyTotals(map,buildings);
  } finally {config.districtCapacities.agriculture=previous;}
});
