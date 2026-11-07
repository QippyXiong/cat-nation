(function(root,factory){var api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CatTechTree=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var labels={done:'已研究',ready:'可研究',waiting:'积累资源',locked:'未开放',special:'特殊内容'};
  var types={tech:'后续科技',buildings:'建筑',stages:'建筑阶段',jobs:'职业',upgrades:'工坊升级',crafts:'合成配方',policies:'政策',tabs:'功能面板',zebraUpgrades:'斑马升级',planet:'行星',spaceMission:'太空任务',spaceBuilding:'太空建筑',chronoforge:'时间锻造',voidSpace:'虚空空间',challenges:'挑战'};
  var tabs={time:'时间',queue:'建造队列',stats:'统计',space:'太空'};
  var seeds={calendar:['起源','calendar'],agriculture:['农耕','leaf'],mining:['采掘','industry'],animal:['文明','book'],writing:['知识','book'],philosophy:['信仰','star'],navigation:['探索','compass'],physics:['科学','atom'],archeology:['生命','leaf'],industrialization:['工业','industry'],rocketry:['星海','rocket'],nuclearFission:['高等科学','atom'],chronophysics:['时空','time'],cryptotheology:['奥秘','star']};
  function text(value){return String(value||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');}
  function special(game,t){return t.name==='brewery'?'已停用的旧科技，不属于正常发展路线。':t.name==='artificialGravity'&&!game.getFeatureFlag('SPACE_EXPL')?'当前版本未启用太空探索扩展；人工重力不属于必经路线。':'';}
  function relatives(graph,id,key){var found=new Set();function visit(name){graph.byId[name][key].forEach(function(next){if(!found.has(next)){found.add(next);visit(next);}});}visit(id);return found;}
  function graph(game){
    var nodes=game.science.techs.map(function(t,i){return {id:t.name,meta:t,index:i,parents:[],children:[],note:special(game,t),depth:0,x:0,y:0};}),byId={};
    nodes.forEach(function(n){byId[n.id]=n;});
    var edges=[];nodes.forEach(function(n){((n.meta.unlocks||{}).tech||[]).forEach(function(id){if(byId[id]){n.children.push(id);byId[id].parents.push(n.id);edges.push({from:n.id,to:id});}});});
    var seen=new Set();function depth(n,visiting){if(seen.has(n.id))return n.depth;if(visiting.has(n.id))throw new Error('科技依赖中存在循环：'+n.id);visiting.add(n.id);n.depth=n.parents.reduce(function(d,id){return Math.max(d,depth(byId[id],visiting)+1);},0);visiting.delete(n.id);seen.add(n.id);return n.depth;}
    nodes.forEach(function(n){depth(n,new Set());});
    var rows=[];nodes.filter(function(n){return !n.note||n.parents.length;}).forEach(function(n){(rows[n.depth]||(rows[n.depth]=[])).push(n);});
    rows.forEach(function(row){row.forEach(function(n,i){n.x=i*222;});});
    function align(row,key){
      var desired=row.map(function(n){var links=n[key];return {n:n,x:links.length?links.reduce(function(sum,id){return sum+byId[id].x;},0)/links.length:n.x};}).sort(function(a,b){return a.x-b.x||a.n.index-b.n.index;});
      var last=-Infinity,total=0;desired.forEach(function(d){d.n.x=Math.max(last+222,d.x);last=d.n.x;total+=d.n.x-d.x;});desired.forEach(function(d){d.n.x-=total/desired.length;});
    }
    for(var pass=0;pass<5;pass++){rows.forEach(function(row){align(row,'parents');});rows.slice().reverse().forEach(function(row){align(row,'children');});}
    var min=Math.min.apply(null,nodes.map(function(n){return n.x;}));
    nodes.forEach(function(n){n.x=n.x-min+70;n.y=n.depth*178+70;var branch=n;while(!seeds[branch.id]&&branch.parents.length)branch=byId[branch.parents[0]];n.branch=seeds[branch.id]||['特殊内容','star'];});
    var bottom=rows.length*178+115;
    nodes.filter(function(n){return n.note&&!n.parents.length;}).forEach(function(n,i){n.x=70+i*222;n.y=bottom;n.branch=['特殊内容','star'];});
    return {nodes:nodes,byId:byId,edges:edges,width:Math.max.apply(null,nodes.map(function(n){return n.x;}))+260,height:Math.max.apply(null,nodes.map(function(n){return n.y;}))+190};
  }
  function info(game,bridge,n){
    var t=n.meta,prices=game.science.getPrices(t).map(function(p){var r=game.resPool.get(p.name);return {name:p.name,title:text(r.title||p.name),val:p.val,stock:r.value,missing:Math.max(0,p.val-r.value),capacity:r.maxValue>0&&r.maxValue+1e-8<p.val};});
    var state=t.researched?'done':n.note&&!t.unlocked?'special':!t.unlocked?'locked':prices.some(function(p){return p.missing>1e-8;})?'waiting':'ready';
    if(state==='ready'){var pair=bridge.research('tech',n.id);if(!pair.model.enabled||pair.model.visible===false)state='locked';}
    return {state:state,label:labels[state],prices:prices,canResearch:state==='ready'};
  }
  function content(game,meta){
    function groups(data){return Object.keys(data||{}).map(function(type){return {type:type,title:types[type]||type,items:data[type].map(function(id){var m=game.getUnlockByName(id,type),stage=type==='stages'&&m&&m.stages[id.stage];return {id:typeof id==='string'?id:id.bld,title:text(type==='tabs'&&tabs[id]||stage&&stage.label||m&&(m.label||m.title||m.tabName||m.name)||id),description:text(stage&&stage.description||m&&m.description)};})};});}
    return {description:text(meta.description),effect:text(meta.effectDesc),flavor:text(meta.flavor),unlocks:groups(meta.unlocks),updates:groups(meta.upgrades),effects:Object.keys(meta.effects||{}).map(function(key){var d=game.getEffectDisplayParams(key,meta.effects[key],true);return d?d.displayEffectName+' '+d.displayEffectValue:key+' '+meta.effects[key];})};
  }
  var icons={calendar:'M7 5v5M17 5v5M4 8h16v13H4zM4 12h16M8 15h2M14 15h2M8 18h2',leaf:'M12 22V5M12 12C3 12 4 5 4 5s8 0 8 7Zm0 5c9 0 8-7 8-7s-8 0-8 7Z',industry:'M3 21V10l6 4V9l6 4V4h4l2 17ZM6 18h1M11 18h1M16 18h1',book:'M12 7v15M12 8C8 4 3 5 3 5v14s5-1 9 3c4-4 9-3 9-3V5s-5-1-9 3Z',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',compass:'m12 3 8 9-8 9-8-9Zm0 4-3 8 6-6-3-2Z',atom:'M14 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0ZM22 12c0 3-20 3-20 0s20-3 20 0ZM7 3c3-2 13 16 10 18S4 5 7 3Zm10 0c3 2-7 20-10 18S14 1 17 3Z',rocket:'M9 15c-1-6 2-11 10-12 1 8-2 13-8 14Zm1 2-4 4v-5l-3-2 5-2M14 8h2M12 19l-1 3M5 18l-3 4',time:'M5 3h14M5 21h14M7 3c0 7 2 7 5 9-3 2-5 2-5 9m10-18c0 7-2 7-5 9 3 2 5 2 5 9M9 18h6'};
  function create(options){
    var game=options.game,bridge=options.bridge,$=function(id){return document.getElementById(id);},dialog=$('tech-tree-dialog'),viewport=$('tech-viewport'),world=$('tech-world'),selected=null,g,buttons={},lines=[],data={},scale=1,tx=0,ty=0,drag=null,moved=false,detailKey='',returnFocus;
    function el(tag,cls,value){var e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;}
    function svg(tag,attrs){var e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.keys(attrs||{}).forEach(function(k){e.setAttribute(k,attrs[k]);});return e;}
    function transform(){world.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';$('tech-zoom-value').textContent=Math.round(scale*100)+'%';}
    function zoom(value,x,y){var next=Math.max(.03,Math.min(1.5,value));x=x===undefined?viewport.clientWidth/2:x;y=y===undefined?viewport.clientHeight/2:y;tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;transform();}
    function center(id){var n=g.byId[id];if(!n)return;tx=viewport.clientWidth/2-(n.x+90)*scale;ty=Math.min(160,viewport.clientHeight/3)-(n.y+50)*scale;transform();}
    function pick(id,move){if(!g.byId[id])return;selected=id;detailKey='';$('tech-detail').scrollTop=0;update();if(move)center(id);}
    function jump(id){pick(id,true);}
    function build(){
      g=graph(game);world.replaceChildren();buttons={};lines=[];
      world.style.width=g.width+'px';world.style.height=g.height+'px';
      var wires=svg('svg',{width:g.width,height:g.height,'aria-hidden':'true',class:'tech-wires'});world.append(wires);
      g.edges.forEach(function(edge){var a=g.byId[edge.from],b=g.byId[edge.to],x=a.x+90,y=a.y+116,x2=b.x+90,y2=b.y,mid=(y+y2)/2,p=svg('path',{d:'M '+x+' '+y+' V '+mid+' H '+x2+' V '+(y2-5)}),arrow=svg('path',{d:'m '+(x2-4)+' '+(y2-10)+' 4 5 4-5'});wires.append(p,arrow);lines.push({edge:edge,path:p,arrow:arrow});});
      g.nodes.forEach(function(n){
        var b=el('button','tech-node');b.type='button';b.dataset.tech=n.id;b.style.left=n.x+'px';b.style.top=n.y+'px';
        var emblem=el('span','tech-emblem'),image=svg('svg',{viewBox:'0 0 24 26','aria-hidden':'true'});image.append(svg('path',{d:icons[n.branch[1]]}));emblem.append(image);
        b.append(el('span','tech-node-branch',n.branch[0]),emblem,el('strong','tech-node-title',text(n.meta.label)),el('span','tech-node-status'),el('span','tech-node-price'));
        b.onclick=function(){if(!moved)pick(n.id,false);};b.onfocus=function(){if(!drag&&dialog.open){var rect=b.getBoundingClientRect(),v=viewport.getBoundingClientRect();if(rect.left<v.left||rect.right>v.right||rect.top<v.top||rect.bottom>v.bottom)center(n.id);}};
        buttons[n.id]=b;world.append(b);
      });
      var note=el('div','tech-special-heading','特殊与停用内容 · 保留资料，不计入正常路线');note.style.top=(g.height-210)+'px';world.append(note);
    }
    function links(container,ids,empty){container.replaceChildren();if(!ids.length){container.append(el('span','tech-muted',empty));return;}ids.forEach(function(id){var b=el('button','tech-chip',text(g.byId[id].meta.label));b.type='button';b.onclick=function(){jump(id);};container.append(b);});}
    function renderDetail(){
      var n=g.byId[selected],d=data[selected],c=content(game,n.meta);
      var key=JSON.stringify([selected,c]);
      if(key!==detailKey){
        detailKey=key;$('tech-detail-title').textContent=text(n.meta.label);$('tech-detail-id').textContent=n.id;$('tech-detail-desc').textContent=c.description;$('tech-detail-effect').textContent=[c.effect].concat(c.effects).filter(Boolean).join('\n')||'效果见下方开放内容。';$('tech-detail-flavor').textContent=c.flavor;$('tech-detail-flavor').hidden=!c.flavor;
        $('tech-detail-note').textContent=n.note||(!n.parents.length?'初始科技入口：先建图书馆、安排学者获取科学。':'箭头表示直接开放关系；研究前置后仍需支付当前费用。');
        links($('tech-parents'),n.parents,'初始入口 / 特殊内容');links($('tech-children'),n.children,'没有直接后续科技');
        var path=Array.from(relatives(g,selected,'parents')).sort(function(a,b){return g.byId[a].depth-g.byId[b].depth||g.byId[a].index-g.byId[b].index;});links($('tech-ancestors'),path,'已到路线起点');
        var unlocks=$('tech-unlocks');unlocks.replaceChildren();
        function show(groups,verb){groups.forEach(function(group){var section=el('section','tech-unlock-group');section.append(el('h4',null,verb+' · '+group.title+' ('+group.items.length+')'));group.items.forEach(function(item){if(group.type==='tech'){var b=el('button','tech-chip',item.title);b.onclick=function(){jump(item.id);};section.append(b);}else{var entry=el('details','tech-unlock-item');entry.append(el('summary',null,item.title),el('p',null,item.description||'研究后开放，实际使用条件以对应系统为准。'));section.append(entry);}});unlocks.append(section);});}
        show(c.unlocks,'开放');show(c.updates,'更新效果');if(!c.unlocks.length&&!c.updates.length)unlocks.append(el('p','tech-muted','无额外开放条目，参见科技效果。'));
      }
      $('tech-detail-state').textContent=d.label;$('tech-detail-state').dataset.state=d.state;
      var cost=$('tech-costs');cost.replaceChildren();d.prices.forEach(function(p){var row=el('div','tech-cost-row'+(p.missing>1e-8?' lacking':''));row.append(el('span',null,p.title),el('strong',null,options.number(p.stock)+' / '+options.number(p.val)),el('small',null,p.capacity?'容量不足，先扩充储量':p.missing>1e-8?'还缺 '+options.number(p.missing):'已备齐'));cost.append(row);});
      $('tech-research').disabled=!d.canResearch||!options.canWrite();$('tech-research').textContent=d.state==='done'?'已研究完成':'研究 · '+text(n.meta.label);
      $('tech-reason').textContent=!options.canWrite()?'当前存档不可修改，请检查存档状态。':d.state==='special'?n.note:d.state==='locked'?'先完成前置科技或对应解锁条件。':d.state==='waiting'?'继续积累标红资源；容量不足时先升级仓储或科学设施。':d.state==='done'?'研究已生效，开放内容与原版共用。':'资源齐备，点击研究立即生效。';
      $('tech-track').disabled=!!n.note||n.meta.researched||!options.canWrite();$('tech-track').textContent=bridge.map.goal===selected?'正在追踪此目标':'设为发展目标';
    }
    function update(){
      if(!dialog.open||!g)return;
      var ancestors=relatives(g,selected,'parents'),descendants=relatives(g,selected,'children'),query=$('tech-search').value.trim().toLowerCase(),filter=$('tech-state-filter').value,route=$('tech-route-only').checked,matches=0,done=0,ready=0;
      g.nodes.forEach(function(n){var d=data[n.id]=info(game,bridge,n),b=buttons[n.id],onRoute=n.id===selected||ancestors.has(n.id)||descendants.has(n.id),match=(!query||(text(n.meta.label)+' '+n.id+' '+text(n.meta.description)).toLowerCase().includes(query))&&(filter==='all'||filter===d.state||(filter==='open'&&(d.state==='ready'||d.state==='waiting')))&&(!route||onRoute);if(match)matches++;if(d.state==='done')done++;if(d.state==='ready')ready++;
        b.dataset.state=d.state;b.classList.toggle('selected',n.id===selected);b.classList.toggle('on-route',ancestors.has(n.id));b.classList.toggle('dimmed',!match);b.setAttribute('aria-pressed',String(n.id===selected));b.setAttribute('aria-label',text(n.meta.label)+'，'+d.label);b.querySelector('.tech-node-status').textContent=d.label;b.querySelector('.tech-node-price').textContent=d.prices.map(function(p){return p.title+' '+options.number(p.val);}).join(' · ');b.title=text(n.meta.label)+'\n'+d.label+'\n'+text(n.meta.description);
      });
      lines.forEach(function(line){var highlighted=ancestors.has(line.edge.from)&&(ancestors.has(line.edge.to)||line.edge.to===selected),completed=g.byId[line.edge.from].meta.researched;[line.path,line.arrow].forEach(function(p){p.classList.toggle('route',highlighted);p.classList.toggle('completed',completed);});});
      $('tech-tree-summary').textContent=done+' / '+g.nodes.length+' 已研究 · '+ready+' 项可研究';$('tech-match-count').textContent=matches+' 项匹配';
      renderDetail();
    }
    function search(){
      update();var query=$('tech-search').value.trim().toLowerCase(),results=$('tech-search-results');results.replaceChildren();results.hidden=!query;
      if(!query)return;var found=g.nodes.filter(function(n){return (text(n.meta.label)+' '+n.id+' '+text(n.meta.description)).toLowerCase().includes(query);});
      found.slice(0,8).forEach(function(n){var b=el('button','tech-chip',text(n.meta.label));b.onclick=function(){$('tech-search').value='';jump(n.id);results.hidden=true;};results.append(b);});if(!found.length)results.append(el('span','tech-muted','没有匹配的科技'));if(found.length>8)results.append(el('span','tech-muted','另有 '+(found.length-8)+' 项，请继续输入'));
    }
    $('tech-close').onclick=function(){dialog.close();};dialog.addEventListener('close',function(){document.body.classList.remove('tech-tree-open');if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});});
    $('tech-search').oninput=search;$('tech-search').onkeydown=function(e){if(e.key==='Enter'){var query=this.value.trim().toLowerCase(),found=g.nodes.find(function(n){return (text(n.meta.label)+' '+n.id).toLowerCase().includes(query);});if(found&&query)jump(found.id);}};
    $('tech-state-filter').onchange=update;$('tech-route-only').onchange=update;
    $('tech-zoom-in').onclick=function(){zoom(scale*1.2);};$('tech-zoom-out').onclick=function(){zoom(scale/1.2);};$('tech-zoom-reset').onclick=function(){zoom(1);center(selected);};
    $('tech-overview').onclick=function(){scale=Math.max(.03,Math.min(1,(viewport.clientWidth-50)/g.width,(viewport.clientHeight-50)/g.height));tx=(viewport.clientWidth-g.width*scale)/2;ty=(viewport.clientHeight-g.height*scale)/2;transform();};
    $('tech-locate').onclick=function(){var id=bridge.map.goal&&g.byId[bridge.map.goal]?bridge.map.goal:options.recommended();if(!g.byId[id])id='calendar';zoom(.85);jump(id);};
    $('tech-research').onclick=async function(){var id=selected;this.disabled=true;try{await options.research(id);}catch(error){$('tech-reason').textContent=error.message;}finally{update();}};
    $('tech-track').onclick=function(){if(options.canWrite()&&!g.byId[selected].note&&!g.byId[selected].meta.researched){bridge.guard();bridge.map.goal=selected;options.changed();update();}};
    viewport.addEventListener('wheel',function(e){e.preventDefault();var rect=viewport.getBoundingClientRect();zoom(scale*Math.exp(-e.deltaY*.0015),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
    viewport.addEventListener('pointerdown',function(e){if(e.button!==0||e.target.closest('button'))return;e.preventDefault();viewport.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY,tx:tx,ty:ty};moved=false;viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging');});
    viewport.addEventListener('pointermove',function(e){if(!drag||e.pointerId!==drag.id)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;tx=drag.tx+dx;ty=drag.ty+dy;transform();});
    function stop(){drag=null;viewport.classList.remove('dragging');moved=false;}viewport.addEventListener('pointerup',stop);viewport.addEventListener('pointercancel',stop);viewport.addEventListener('lostpointercapture',stop);
    viewport.addEventListener('keydown',function(e){if(e.target!==viewport)return;var arrows={ArrowLeft:[90,0],ArrowRight:[-90,0],ArrowUp:[0,90],ArrowDown:[0,-90]},delta=arrows[e.key];if(delta){e.preventDefault();tx+=delta[0];ty+=delta[1];transform();}else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(scale*1.2);}else if(e.key==='-'){e.preventDefault();zoom(scale/1.2);}});
    new ResizeObserver(function(){if(dialog.open)center(selected);}).observe(viewport);
    return {update:update,open:function(id){returnFocus=document.activeElement;build();selected=g.byId[id]?id:selected&&g.byId[selected]?selected:'calendar';detailKey='';if(!dialog.open)dialog.showModal();document.body.classList.add('tech-tree-open');scale=.85;update();center(selected);viewport.focus({preventScroll:true});}};
  }
  return {graph:graph,info:info,content:content,relatives:relatives,create:create};
}));
