(function () {
  'use strict';
  function createHexView(options) {
  options = options || {};
  var W = window.HexWorld, canvas = document.getElementById('map'), ctx = canvas.getContext('2d');
  var portrait = document.getElementById('portrait'), pc = portrait.getContext('2d');
  var cells = options.cells || W.createWorld(), selected = cells.find(function (c) { return c.q === 0 && c.r === 0; });
  var hovered = null, season = 'spring', grid = true, cats = true;
  var settings = options.camera || {elevation:45,azimuth:-20,zoom:1,panX:0,panY:0};
  var zoom = settings.zoom || 1, panX = settings.panX || 0, panY = settings.panY || 0;
  var camera = W.createCamera(cells, settings.elevation, settings.azimuth), groundDirty = true;
  var land = document.createElement('canvas'), edge = document.createElement('canvas');
  land.width = edge.width = 600; land.height = edge.height = 420;
  var lc = land.getContext('2d'), ec = edge.getContext('2d');
  var motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var palettes = {
    spring: { grass:'#8ca467', light:'#a8b775', dark:'#6a874f', edge:'#4b6746', forest:'#547d50', leaf:'#547f47', leafLight:'#88a85d', water:'#477e83', wave:'#76b1af', dirt:'#b9a270', mountain:'#929a83', snow:'#d4d5b4', title:'春 · 万物生长' },
    summer: { grass:'#769451', light:'#93a655', dark:'#597940', edge:'#3c5f3c', forest:'#3e6c43', leaf:'#386c3d', leafLight:'#67944c', water:'#397887', wave:'#70acb4', dirt:'#bba174', mountain:'#90947e', snow:'#d0d1b4', title:'夏 · 林深蝉鸣' },
    autumn: { grass:'#9b975a', light:'#b1a266', dark:'#827945', edge:'#625e3d', forest:'#847744', leaf:'#a56e3f', leafLight:'#d29a51', water:'#527c81', wave:'#8aafb1', dirt:'#baa077', mountain:'#9c9482', snow:'#d1cab0', title:'秋 · 丰收来信' },
    winter: { grass:'#bdc9b5', light:'#d2dbca', dark:'#97ae9c', edge:'#718f83', forest:'#8baba0', leaf:'#5f8579', leafLight:'#a8c2b0', water:'#678f9b', wave:'#a4c7ce', dirt:'#a4aa91', mountain:'#a5b4ae', snow:'#e2e8d9', title:'冬 · 初雪归巢' }
  };
  function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); }
  function line(c, x0, y0, x1, y1, color, size) {
    x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1);
    var dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1, err=dx+dy;
    for (;;) { rect(c,x0,y0,size||1,size||1,color); if(x0===x1&&y0===y1)break; var e=2*err; if(e>=dy){err+=dy;x0+=sx;} if(e<=dx){err+=dx;y0+=sy;} }
  }
  function hex(c, x, y, color, inset) {
    var scale = inset || 0;
    for (var dy=-28+scale;dy<=28-scale;dy++) {
      var width=Math.abs(dy)<=14?24:Math.floor((28-Math.abs(dy))*24/14);
      width=Math.max(0,width-scale); rect(c,x-width,y+dy,width*2+1,1,color);
    }
  }
  function outline(c, x, y, color) {
    var p=[[0,-28],[24,-14],[24,14],[0,28],[-24,14],[-24,-14],[0,-28]];
    for(var i=0;i<6;i++)line(c,x+p[i][0],y+p[i][1],x+p[i+1][0],y+p[i+1][1],color);
  }
  function shadow(c,x,y,w) { rect(c,x-w/2,y,w,3,'#263c324d'); rect(c,x-w/2+2,y-1,w-4,5,'#263c3233'); }
  function tree(c,x,y,seed,p) {
    shadow(c,x,y,16); rect(c,x-2,y-11,4,12,'#5a5134'); rect(c,x+1,y-8,1,8,'#9a8051');
    var tiers=[[1,6],[-4,10],[-10,12],[-16,8],[-21,4]];
    tiers.forEach(function(t){rect(c,x-t[1],y+t[0]-5,t[1]*2+1,5,'#325740');rect(c,x-t[1]+1,y+t[0]-7,t[1]*2-2,4,p.leaf);rect(c,x-t[1]+2,y+t[0]-7,t[1]-1,2,p.leafLight);});
    if(season==='winter'){rect(c,x-5,y-19,10,2,p.snow);rect(c,x-8,y-12,8,2,p.snow);rect(c,x+2,y-7,8,2,p.snow);}
    if(seed>0.6&&season==='spring'){rect(c,x-5,y-12,2,2,'#dfbf9b');rect(c,x+4,y-5,2,2,'#dfbf9b');}
  }
  function rock(c,x,y,size,p) {
    shadow(c,x,y,size+3); rect(c,x-size/2,y-size+2,size,size-1,'#616f64');rect(c,x-size/2+2,y-size,size-3,size-3,p.mountain);rect(c,x-size/2+3,y-size,size-5,2,p.snow);rect(c,x+1,y-size+3,size/2-2,size-5,'#798578');
  }
  function mountain(c,x,y,p) {
    shadow(c,x,y+8,30);
    for(var i=0;i<25;i++){var half=Math.floor(i*.68);rect(c,x-half,y-24+i,half*2+1,1,i<6?p.snow:p.mountain);rect(c,x+1,y-24+i,half,1,i<6?'#bcc6b3':'#6e8175');}
    line(c,x-16,y+1,x-5,y-13,'#aeb8a0',2);rock(c,x+12,y+8,10,p);
  }
  function roof(c,x,y,width,color,light) {
    for(var row=0;row<11;row++){var half=Math.round((width/2)*(row/10));rect(c,x-half,y+row,half*2+1,1,'#4b4534');if(row>1)rect(c,x-half+2,y+row,Math.max(1,half*2-3),1,row%3===0?light:color);}
    rect(c,x-width/2-1,y+10,width+3,2,'#594735');
  }
  function hut(c,x,y,blue,t) {
    shadow(c,x,y+10,29);rect(c,x-11,y-5,23,17,'#6a6645');rect(c,x-10,y-5,20,15,'#d7c58e');rect(c,x-10,y+4,20,2,'#b6a474');rect(c,x-8,y-2,5,5,'#635c43');rect(c,x-7,y-1,3,3,'#f5cf7a');rect(c,x+2,y+3,5,9,'#706248');rect(c,x+3,y+4,3,7,'#4b5140');
    roof(c,x,y-18,30,blue?'#517f8f':'#a96147',blue?'#91b4b4':'#d58a5a');
    rect(c,x+6,y-19,4,8,'#8a8569');rect(c,x+5,y-20,6,2,'#c3b494');
    if(t!==undefined){var rise=Math.floor((t/450)%8);rect(c,x+7+Math.floor(Math.sin(t/900)*2),y-23-rise,3,3,'#c7cfad55');}
    if(season==='winter'){rect(c,x-9,y-12,9,2,'#e3e4cf');rect(c,x+1,y-10,10,2,'#dce1ce');}
    rect(c,x-14,y+10,6,3,'#777c50');rect(c,x-13,y+8,4,3,'#9fa759');
  }
  function field(c,x,y,p) {
    shadow(c,x,y+13,34);rect(c,x-17,y-12,34,28,'#756b40');rect(c,x-15,y-10,30,24,'#a48c4e');
    for(var i=0;i<5;i++){var xx=x-12+i*6;rect(c,xx,y-8,2,22,'#766c3e');for(var j=0;j<4;j++){var yy=y-6+j*5;rect(c,xx+1,yy,1,4,season==='winter'?'#9baf98':'#89914a');rect(c,xx,yy-1,4,2,season==='winter'?p.snow:'#e4bf66');rect(c,xx+2,yy-3,2,3,season==='winter'?'#c7d4bd':'#d8ab53');}}
    [-17,17].forEach(function(xx){rect(c,x+xx,y-12,2,29,'#887551');for(var j=0;j<4;j++)rect(c,x+xx-1,y-11+j*9,4,4,'#bfad75');});
    rect(c,x-18,y+12,37,2,'#d0b77a');rect(c,x-18,y-10,37,2,'#d0b77a');
    if(season==='winter')rect(c,x-14,y+14,28,2,p.snow);
  }
  function camp(c,x,y,t) {
    shadow(c,x,y+11,27);[[0,-2],[-7,1],[7,1],[-10,6],[10,6],[-6,11],[6,11]].forEach(function(p){rect(c,x+p[0]-2,y+p[1],5,3,'#b6b497');rect(c,x+p[0]-2,y+p[1]+2,5,2,'#78836e');});
    line(c,x-6,y+6,x+7,y+10,'#594d35',3);line(c,x-6,y+10,x+6,y+6,'#a17c45',2);
    var flick=motion&&Math.floor(t/230)%2;rect(c,x-3,y-4,7,11,'#d48043');rect(c,x-1,y-9-flick,4,12,'#edb451');rect(c,x,y-4,3,8,'#f8d67f');rect(c,x-2,y+1,6,6,'#ffdf8d');
    rect(c,x+17,y-24,2,31,'#b8a56d');rect(c,x+19,y-23,12,9,'#709886');rect(c,x+20,y-22,10,7,'#8fb19a');
    rect(c,x+23,y-18,4,2,'#ece3ba');rect(c,x+22,y-21,2,2,'#ece3ba');rect(c,x+26,y-21,2,2,'#ece3ba');
    rect(c,x-21,y+5,7,4,'#ac9765');rect(c,x-23,y+1,11,4,'#c3ad79');
  }
  function ruins(c,x,y,p) {
    shadow(c,x,y+10,31);rect(c,x-15,y+7,32,5,'#6e8170');rect(c,x-12,y+5,26,3,'#b4b99a');
    [[-10,-12,19],[9,-9,16]].forEach(function(a){rect(c,x+a[0]-3,y+a[1],6,a[2],'#7c9181');rect(c,x+a[0]-2,y+a[1],3,a[2],'#b5c2a8');rect(c,x+a[0]-5,y+a[1]-2,10,3,'#c1c9aa');});
    rect(c,x-12,y-15,24,4,'#9bab8f');rect(c,x-10,y-16,18,2,'#d1d2ae');rect(c,x-2,y-7,5,9,'#4d7470');rect(c,x-1,y-6,3,6,'#90c8b4');rect(c,x-13,y+4,7,2,p.leaf);
  }
  function sprite(c,tile,x,y,t,p) {
    var kind=tile.building;
    if(kind==='hut'&&tile.count>=10){c.save();c.translate(x-11,y-7);c.scale(.65,.65);hut(c,0,0,false);c.restore();}
    if(kind==='hut'||kind==='library') { hut(c,x,y,kind==='library',t);if(kind==='library'){rect(c,x-5,y+9,10,3,'#b6a477');rect(c,x-4,y+10,3,1,'#f1dca5');rect(c,x+1,y+10,3,1,'#f1dca5');rect(c,x-1,y+9,1,3,'#625d47');} }
    if(kind==='field')field(c,x,y,p);
    if(kind==='camp')camp(c,x,y,t);
    if(kind==='ruins')ruins(c,x,y,p);
    if(kind==='lumber'){hut(c,x+3,y-2,false);for(var k=0;k<3;k++){rect(c,x-16,y+5+k*3,14,3,'#8d7044');rect(c,x-16,y+5+k*3,3,3,'#c9a771');}rect(c,x+13,y+8,4,6,'#c5b68b');}
    if(kind==='quarry'){rock(c,x-6,y-3,17,p);rock(c,x+9,y+5,12,p);rect(c,x-11,y+9,20,4,'#827952');rect(c,x-9,y+13,3,3,'#384b3b');rect(c,x+4,y+13,3,3,'#384b3b');line(c,x-13,y+4,x+7,y-3,'#b9aa7c',1);}
    if(['storage','industry','temple','culture','trade','energy','time','civic','port'].includes(kind)){
      if(kind==='time'){ruins(c,x,y,p);rect(c,x-2,y-3,5,9,'#cda9e4');return;}
      if(kind==='port'){rect(c,x-18,y+5,36,6,'#8a7955');for(var j=0;j<8;j++)rect(c,x-17+j*4,y+4,3,8,'#c6ac74');hut(c,x-3,y-4,true);rect(c,x+13,y+13,14,3,'#b4a073');rect(c,x+16,y+8,8,5,'#778a83');return;}
      hut(c,x,y,kind==='temple'||kind==='culture');
      if(kind==='storage'){rect(c,x-7,y+6,6,5,'#a58d58');rect(c,x+1,y+8,7,4,'#bfa36b');}
      if(kind==='industry'){rect(c,x+8,y-24,5,25,'#707a72');rect(c,x+7,y-25,7,3,'#a1ac99');rect(c,x+10,y-30-(Math.floor(t/500)%5),4,4,'#acb3a166');}
      if(kind==='temple'){rect(c,x-1,y-27,3,15,'#c5c6a2');rect(c,x-4,y-29,9,3,'#d8c780');rect(c,x-1,y-32,3,8,'#e3d69a');}
      if(kind==='trade'){for(var stripe=0;stripe<5;stripe++)rect(c,x-13+stripe*5,y-4,5,6,stripe%2?'#e8cc89':'#9d6756');}
      if(kind==='energy'){rect(c,x+12,y-26,2,32,'#c4c5a3');line(c,x+6,y-25,x+19,y-15,'#d6d7af',2);line(c,x+8,y-14,x+17,y-27,'#d6d7af',2);}
    }
  }
  function ground(c,tile,x,y,p) {
    var type=tile.terrain, seed=W.hash(tile.q,tile.r,1);
    var color=type==='water'?p.water:type==='forest'?p.forest:type==='mountain'?p.mountain:type==='mist'?'#344d43':p.grass;
    hex(c,x,y+5,type==='water'?'#2d545b':'#3a513a');
    hex(c,x,y,color);outline(c,x,y,type==='mist'?'#3c584a':p.edge);
    if(type==='mist'){for(var k=0;k<6;k++){var a=W.hash(tile.q,tile.r,k+10), b=W.hash(tile.q,tile.r,k+30);rect(c,x-12+a*20,y-11+b*18,8,2,'#496354');}return;}
    for(var j=0;j<20;j++){
      var xx=Math.floor(W.hash(tile.q,tile.r,j+2)*36)-18, yy=Math.floor(W.hash(tile.q,tile.r,j+25)*30)-15;
      if(type==='water'){if(j<5)rect(c,x+xx,y+yy,4+Math.floor(seed*4),1,p.wave);}
      else{rect(c,x+xx,y+yy,2,j%3===0?2:1,j%3===0?p.dark:p.light);if(j%7===0&&type==='grass'&&season==='spring'){rect(c,x+xx,y+yy-2,1,2,'#dcd297');}}
    }
    if(grid)outline(c,x,y,type==='water'?'#5d9190':p.edge);
    else outline(c,x,y,color);
    line(c,x-22,y-14,x,y-27,type==='water'?'#6c9c99':p.light);
  }
  function nature(c,tile,x,y,p) {
    if(tile.terrain==='forest'){
      tree(c,x-10,y+2,W.hash(tile.q,tile.r),p);tree(c,x+9,y+9,0.1,p);if(!tile.building)tree(c,x+3,y-8,0.8,p);
    }
    if(tile.terrain==='mountain'&&tile.building!=='quarry')mountain(c,x,y+3,p);
    if(tile.terrain==='grass'&&!tile.building&&W.hash(tile.q,tile.r,14)>.45){rect(c,x+8,y+7,6,4,p.dark);rect(c,x+7,y+5,8,3,p.light);rect(c,x+10,y+3,3,3,p.light);}
  }
  function road(c,a,b,p){var aa=W.position(a[0],a[1]),bb=W.position(b[0],b[1]);line(c,aa.x-2,aa.y+5,bb.x-2,bb.y+5,p.dark,5);line(c,aa.x-1,aa.y+5,bb.x-1,bb.y+5,p.dirt,3);}
  function cat(c,x,y,color,flip,t){
    x=Math.round(x);y=Math.round(y);var bob=motion?Math.floor(t/250)%2:0;
    shadow(c,x+1,y+8,10);rect(c,x-3,y,7,6,color);rect(c,x-3,y-3,2,4,color);rect(c,x+2,y-3,2,4,color);rect(c,x-2,y-2,1,1,'#d3a092');rect(c,x+2,y-2,1,1,'#d3a092');rect(c,x-2,y+2,1,1,'#344638');rect(c,x+2,y+2,1,1,'#344638');rect(c,x,y+4,1,1,'#a97662');rect(c,x-2,y+6,5,3,color);rect(c,x-2,y+9,2,1+bob,'#aa9e78');rect(c,x+1,y+9,2,2-bob,'#aa9e78');rect(c,x+(flip?-5:4),y+5,2,4,color);
  }
  function prepareGround(p) {
    lc.clearRect(0,0,600,420);
    cells.forEach(function(tile){var v=W.position(tile.q,tile.r);ground(lc,tile,v.x,v.y,p);if(tile.terrain==='grass')nature(lc,tile,v.x,v.y,p);});
    (options.roads ? options.roads() : [[[-1,0],[0,0]],[[0,0],[0,-1]],[[0,0],[1,0]],[[0,0],[0,1]],[[-1,0],[-1,1]],[[-1,1],[-1,2]],[[-1,1],[-2,2]]]).forEach(function(pair){road(lc,pair[0],pair[1],p);});
    if(!options.live){var bridge=W.position(2,-1);rect(lc,bridge.x-21,bridge.y-3,43,10,'#605d43');for(var plank=0;plank<10;plank++)rect(lc,bridge.x-20+plank*4,bridge.y-5,3,13,'#b9a16b');rect(lc,bridge.x-23,bridge.y-5,47,2,'#d0bc84');}
    cells.forEach(function(tile){if(tile.building==='field'){var v=W.position(tile.q,tile.r);field(lc,v.x,v.y,p);}});
    if(options.live)cells.forEach(function(tile){var v=W.position(tile.q,tile.r);if(tile.owned)outline(lc,v.x,v.y,'#9bae73');if(tile.frontier){rect(lc,v.x-2,v.y+16,5,1,'#bfc38e');rect(lc,v.x,v.y+14,1,5,'#bfc38e');}if(tile.district&&!tile.building){rect(lc,v.x-8,v.y-6,16,12,'#617957');rect(lc,v.x-6,v.y-4,12,8,'#8eaa71');}});
    ec.clearRect(0,0,600,420);ec.drawImage(land,0,0);ec.globalCompositeOperation='source-in';rect(ec,0,0,600,420,'#344936');ec.globalCompositeOperation='source-over';
    groundDirty=false;
  }
  function cameraTransform(offset) { ctx.setTransform(camera.a,camera.b,camera.c,camera.d,camera.e,camera.f+(offset||0)); }
  function draw(time){
    var p=palettes[season];ctx.imageSmoothingEnabled=false;ctx.setTransform(1,0,0,1,0,0);rect(ctx,0,0,600,420,'#1b3029');
    for(var i=0;i<90;i++){var bx=W.hash(i,9,2)*600,by=W.hash(i,4,8)*420;rect(ctx,bx,by,1,1,'#385142');}
    if(groundDirty)prepareGround(p);
    for(var depth=8;depth>=2;depth-=2){cameraTransform(depth);ctx.drawImage(edge,0,0);}
    cameraTransform();ctx.drawImage(land,0,0);
    if(hovered&&hovered!==selected){var h=W.position(hovered.q,hovered.r);outline(ctx,h.x,h.y,'#d1d59b');}
    var s=W.position(selected.q,selected.r);outline(ctx,s.x,s.y,'#f2d28c');outline(ctx,s.x,s.y-1,'#e5b96c');rect(ctx,s.x-2,s.y+25,5,3,'#f0cf80');
    ctx.setTransform(1,0,0,1,0,0);
    var objects=[];
    function add(x,y,paint){var point=W.project(camera,x,y);objects.push({x:point.x,y:point.y,paint:paint});}
    cells.forEach(function(tile){
      var v=W.position(tile.q,tile.r);
      if(tile.terrain==='forest'){
        add(v.x-10,v.y+2,function(){tree(ctx,0,0,W.hash(tile.q,tile.r),p);});
        add(v.x+9,v.y+9,function(){tree(ctx,0,0,0.1,p);});
        if(!tile.building)add(v.x+3,v.y-8,function(){tree(ctx,0,0,0.8,p);});
      }
      if(tile.terrain==='mountain'&&tile.building!=='quarry')add(v.x,v.y+11,function(){mountain(ctx,0,-8,p);});
      if(tile.building&&tile.building!=='field')add(v.x,v.y+10,function(){sprite(ctx,tile,0,-10,time,p);});
    });
    var visibleCats=options.live?Math.max(0,Math.min(4,Math.floor(options.catCount()))):4;
    if(cats && visibleCats>0){
      var phase=motion?time/3300:0;
      add(286+Math.sin(phase)*18,230+Math.cos(phase)*4,function(){cat(ctx,0,-9,'#e6d2a0',false,time);});
      if(visibleCats>1)add(253+Math.sin(phase*.75)*13,278,function(){cat(ctx,0,-9,'#b5bec0',true,time+400);});
      if(visibleCats>2)add(332,225+Math.sin(phase*.65)*11,function(){cat(ctx,0,-9,'#e9e0bd',false,time+800);});
      if(visibleCats>3)add(274+Math.sin(phase*.8)*8,172,function(){cat(ctx,0,-9,'#b7a27f',true,time+200);});
    }
    objects.sort(function(a,b){return a.y-b.y||a.x-b.x;});
    objects.forEach(function(object){ctx.save();ctx.translate(Math.round(object.x),Math.round(object.y));ctx.scale(camera.scale,camera.scale);object.paint();ctx.restore();});
    if(options.live)cells.forEach(function(tile){if(!tile.district||tile.count<1)return;var v=W.position(tile.q,tile.r),point=W.project(camera,v.x,v.y+22),text=String(tile.count)+(tile.limit?'/'+tile.limit:'');ctx.font='9px monospace';var width=ctx.measureText(text).width;rect(ctx,point.x-width/2-3,point.y-3,Math.ceil(width)+6,12,'#203c2de6');ctx.fillStyle='#e9d59c';ctx.fillText(text,Math.round(point.x-width/2),Math.round(point.y+6));});
    if(season==='winter'&&motion){for(var snow=0;snow<18;snow++){var sx=(W.hash(snow,4)*600+time/150)%600,sy=(W.hash(snow,7)*420+time/90)%420;rect(ctx,sx,sy,1,1,'#d4dfcb88');}}
  }
  function updateInspector(){
    if(options.onSelect){
      options.onSelect(selected);pc.clearRect(0,0,120,90);pc.imageSmoothingEnabled=false;ground(pc,selected,60,48,palettes[season]);nature(pc,selected,60,48,palettes[season]);if(selected.building)sprite(pc,selected,60,48,0,palettes[season]);draw(performance.now());return;
    }
    var terrain=selected.terrain, info=W.buildings[selected.building];
    var stories={grass:'柔软的草地上散落着野花。这里可以安置新的田地、小屋或图书馆。',forest:'松树在风中轻轻摇晃。这里适合设想未来的林业与采集区域。',mountain:'岩石与薄薄的草甸交错，山脚藏着营地需要的矿物。',water:'水面闪着细碎的光。可以设想未来的渔场、码头与沿岸聚落。',mist:'雾气遮住了远处的土地。这里用来展示将来的探索边界。'};
    var uses={grass:'农耕 / 居住 / 科研',forest:'林业与采集',mountain:'矿业与采石',water:'渔业与港口',mist:'等待探索'};
    document.getElementById('coordinates').textContent='Q '+selected.q+' · R '+selected.r;
    document.getElementById('tile-type').textContent=info?info.type:W.names[terrain]+'地块';
    document.getElementById('tile-title').textContent=info?info.name:({grass:'一片新的土地',forest:'低语松林',mountain:'灰岩山麓',water:'青镜湖畔',mist:'未写完的远方'})[terrain];
    document.getElementById('tile-description').textContent=info?info.description:stories[terrain];
    document.getElementById('tile-status').textContent=info?'已有建筑':terrain==='mist'?'尚未探索':terrain==='grass'?'可以试放建筑':'自然地形';
    document.getElementById('tile-use').textContent=info?info.type:uses[terrain];
    var available=W.canBuild(selected);
    document.querySelectorAll('[data-build]').forEach(function(button){button.disabled=!available;});
    document.getElementById('build-help').textContent=available?'这块草地可以试放建筑。选择下方任一建筑即可。':info?'这里已经有建筑。用方向键或点击选择空闲草地。':'此处保留自然地形，请选择空闲草地试放建筑。';
    document.getElementById('building-count').innerHTML=cells.filter(function(c){return c.building;}).length+' <small>处</small>';
    document.getElementById('season-label').textContent=palettes[season].title;
    pc.clearRect(0,0,120,90);pc.imageSmoothingEnabled=false;ground(pc,selected,60,48,palettes[season]);nature(pc,selected,60,48,palettes[season]);if(info)sprite(pc,selected,60,48,0,palettes[season]);
    document.getElementById('announcement').textContent='已选择 '+(info?info.name:W.names[terrain])+'，坐标 '+selected.q+'，'+selected.r;
    draw(performance.now());
  }
  function pointer(event){var box=canvas.getBoundingClientRect();var point=W.unproject(camera,(event.clientX-box.left)*600/box.width,(event.clientY-box.top)*420/box.height);return W.tileAt(cells,point.x,point.y);}
  var drag=null,skipClick=false;
  canvas.addEventListener('click',function(event){if(skipClick){skipClick=false;return;}var tile=pointer(event);if(tile){selected=tile;updateInspector();}});
  canvas.addEventListener('pointermove',function(event){hovered=pointer(event);document.getElementById('map-hint').textContent=hovered?(hovered.label||W.buildings[hovered.building]?.name||W.names[hovered.terrain])+(options.live&&hovered.limit?' '+hovered.count+'/'+hovered.limit:'')+' · Q '+hovered.q+' / R '+hovered.r:'选择一块土地，看看这里的故事';if(!motion)draw(0);});
  canvas.addEventListener('pointerleave',function(){hovered=null;document.getElementById('map-hint').textContent='选择一块土地，看看这里的故事';if(!motion)draw(0);});
  canvas.addEventListener('keydown',function(event){var moves={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},move=moves[event.key];if(!move)return;event.preventDefault();var base=W.position(selected.q,selected.r),origin=W.project(camera,base.x,base.y),best=null,score=0.15;cells.forEach(function(tile){var dq=tile.q-selected.q,dr=tile.r-selected.r;if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))!==1)return;var p=W.position(tile.q,tile.r),point=W.project(camera,p.x,p.y),dx=point.x-origin.x,dy=point.y-origin.y,value=(dx*move[0]+dy*move[1])/Math.hypot(dx,dy);if(value>score){score=value;best=tile;}});if(best){selected=best;updateInspector();}});
  document.querySelectorAll('[data-season]').forEach(function(button){button.addEventListener('click',function(){season=button.dataset.season;groundDirty=true;document.querySelectorAll('[data-season]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});updateInspector();});});
  document.querySelectorAll('[data-build]').forEach(function(button){button.addEventListener('click',function(){if(W.place(selected,button.dataset.build)){groundDirty=true;updateInspector();document.getElementById('announcement').textContent='已安置'+W.buildings[button.dataset.build].name;}});});
  document.getElementById('show-grid').addEventListener('change',function(event){grid=event.target.checked;groundDirty=true;draw(performance.now());});
  document.getElementById('show-cats').addEventListener('change',function(event){cats=event.target.checked;draw(performance.now());});
  if(!options.live)document.getElementById('reset').addEventListener('click',function(){cells=W.createWorld();selected=cells.find(function(c){return c.q===0&&c.r===0;});hovered=null;groundDirty=true;updateInspector();});
  function changeCamera(elevation,azimuth){
    camera=W.createCamera(cells,elevation,azimuth);camera.a*=zoom;camera.b*=zoom;camera.c*=zoom;camera.d*=zoom;camera.e=300-camera.a*300-camera.c*207+panX;camera.f=225-camera.b*300-camera.d*207+panY;camera.scale*=zoom;hovered=null;
    document.getElementById('camera-elevation').value=camera.elevation;document.getElementById('camera-azimuth').value=camera.azimuth;
    document.getElementById('elevation-value').textContent=camera.elevation+'°';document.getElementById('azimuth-value').textContent=camera.azimuth+'°';
    document.getElementById('camera-elevation').setAttribute('aria-valuetext',camera.elevation+'度，90度为垂直俯视');document.getElementById('camera-azimuth').setAttribute('aria-valuetext',camera.azimuth+'度');
    var presets={oblique:[45,-20],isometric:[35,30],top:[90,0]};
    document.querySelectorAll('[data-view]').forEach(function(button){var preset=presets[button.dataset.view];button.setAttribute('aria-pressed',String(camera.elevation===preset[0]&&camera.azimuth===preset[1]));});
    var angle=camera.azimuth*Math.PI/180;document.querySelector('.compass').style.transform='rotate('+Math.atan2(Math.sin(angle),Math.cos(angle)*Math.sin(camera.elevation*Math.PI/180))*180/Math.PI+'deg)';
    var zoomControl=document.getElementById('camera-zoom');if(zoomControl){zoomControl.value=Math.round(zoom*100);document.getElementById('zoom-value').textContent=Math.round(zoom*100)+'%';}
    if(options.onCamera)options.onCamera({elevation:camera.elevation,azimuth:camera.azimuth,zoom:zoom,panX:panX,panY:panY});
    draw(performance.now());
  }
  document.getElementById('camera-elevation').addEventListener('input',function(event){changeCamera(Number(event.target.value),camera.azimuth);});
  document.getElementById('camera-azimuth').addEventListener('input',function(event){changeCamera(camera.elevation,Number(event.target.value));});
  document.querySelectorAll('[data-view]').forEach(function(button){button.addEventListener('click',function(){var preset={oblique:[45,-20],isometric:[35,30],top:[90,0]}[button.dataset.view];changeCamera(preset[0],preset[1]);});});
  if(options.live){
    document.getElementById('camera-zoom').addEventListener('input',function(event){zoom=Number(event.target.value)/100;changeCamera(camera.elevation,camera.azimuth);});
    document.getElementById('camera-home').addEventListener('click',function(){zoom=1;panX=panY=0;changeCamera(camera.elevation,camera.azimuth);});
    canvas.addEventListener('wheel',function(event){event.preventDefault();zoom=Math.max(.6,Math.min(1.8,zoom+(event.deltaY<0?.1:-.1)));changeCamera(camera.elevation,camera.azimuth);},{passive:false});
    canvas.addEventListener('pointerdown',function(event){if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,panX:panX,panY:panY};skipClick=false;canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointermove',function(event){if(!drag)return;var dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)<5&&!skipClick)return;skipClick=true;var box=canvas.getBoundingClientRect();panX=Math.max(-400,Math.min(400,drag.panX+dx*600/box.width));panY=Math.max(-300,Math.min(300,drag.panY+dy*420/box.height));changeCamera(camera.elevation,camera.azimuth);});
    canvas.addEventListener('pointerup',function(){drag=null;});canvas.addEventListener('pointercancel',function(){drag=null;skipClick=false;});
  }
  document.getElementById('tile-count').innerHTML=cells.length+' <small>地块</small>';
  updateInspector();
  changeCamera(settings.elevation,settings.azimuth);
  var last=0;
  if(motion)requestAnimationFrame(function frame(time){if(time-last>100){draw(time);last=time;}requestAnimationFrame(frame);});
  return {
    select:function(q,r){var tile=cells.find(function(t){return t.q===q&&t.r===r;});if(tile){selected=tile;updateInspector();}},
    selected:function(){return selected;},
    refresh:function(data){if(data.cells){var q=selected.q,r=selected.r;cells=data.cells;selected=cells.find(function(t){return t.q===q&&t.r===r;})||cells.find(function(t){return t.q===0&&t.r===0;});}if(data.season)season=data.season;groundDirty=true;if(data.camera){zoom=data.camera.zoom||1;panX=data.camera.panX||0;panY=data.camera.panY||0;changeCamera(data.camera.elevation,data.camera.azimuth);}updateInspector();}
  };
  }
  window.createHexView=createHexView;
  if(document.getElementById('map'))createHexView();
}());
