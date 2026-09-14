export function operationGuide(e,selected=[]){
 const s=e.s,p=s.prompt,source=s.cards[p?.card||p?.task?.uid];
 const phases={endOrder:'选择回合结束效果的顺序',mulligan:'起手准备',targets:'选择效果目标',order:'排列卡牌',choice:'选择效果分支',confirmEffect:'确认效果费用',lifeTrigger:'生命触发',replacement:'离场替代效果',block:'阻挡阶段',counter:'反击阶段',peek:'查看卡牌',replace:'满场替换',effectDeployReplace:'效果登场 · 满场替换'};
 let detail=p?.title||'点选手牌使用，或点场上卡牌进行操作。';
 if(p?.candidates){const remaining=Math.max(0,p.min-selected.length);detail=p.type==='order'?`依次点击卡牌，编号就是${p.destination||'牌库'}从上到下的顺序。`:`${p.min===p.max?`必须选择 ${p.min} 张`:`可选择 ${p.min}–${p.max} 张`}，已选 ${selected.length} 张。${remaining?`还需选择 ${remaining} 张。`:'可以确认。'}亮框表示合法目标，再点一次可取消选择。`;}
 if(p?.type==='counter')detail='点选当前手牌使用反击；完成后点击“结束反击”。防守力量必须高于攻击力量才能挡下攻击。';
 return {owner:s.winner!==null?s.winner:p?.owner??s.active,phase:s.winner!==null?'本局结束':phases[p?.type]||'主要阶段',source:source?`${source.id} · ${e.name(source)}`:'',detail,uid:source?.uid};
}

export function captureVisuals(e){
 const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 return {cards:Object.fromEntries(Object.values(e.s.cards).map(c=>[c.uid,{zone:c.zone,owner:c.owner,power:['leader','field'].includes(c.zone)?e.power(c):null,rect:rect(document.querySelector(`[data-board="${c.uid}"]`))}])),deck:[0,1].map(o=>rect(document.querySelector(`[data-deck-anchor="${o}"]`))),life:e.s.players.map(p=>p.life.length)};
}

export function animateResult(e,before,command){
 document.querySelectorAll('.game-fx').forEach(el=>el.remove());
 if(!before||command.type==='undo')return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const find=u=>document.querySelector(`[data-board="${u}"]`);
 const burst=(anchor,text,negative=false)=>{if(!anchor)return;const r=anchor.getBoundingClientRect(),tag=document.createElement('div');tag.className='game-fx delta-fx'+(negative?' negative':'');tag.textContent=text;tag.style.left=`${Math.max(8,Math.min(innerWidth-125,r.x))}px`;tag.style.top=`${Math.max(8,r.y)}px`;document.body.append(tag);if(!reduced)tag.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-28px)'}],{duration:1100,fill:'forwards'});setTimeout(()=>tag.remove(),1200);};
 let flights=0;
 for(const c of Object.values(e.s.cards)){
  const old=before.cards[c.uid],el=find(c.uid);if(!old)continue;
  if(old.power!==null&&['field','leader'].includes(c.zone)){const d=e.power(c)-old.power;if(d)burst(el,`力量 ${d>0?'+':''}${d}`,d<0);}
  if(old.zone!==c.zone&&['hand','field','stage'].includes(c.zone)){
   if(el&&!reduced)el.animate([{filter:'brightness(1.8)',transform:'translateY(-9px)'},{filter:'brightness(1)',transform:'translateY(0)'}],{duration:450});
   if(old.zone==='deck'&&c.zone==='hand'&&el&&!reduced&&flights++<3){
    const from=before.deck[c.owner],to=el.getBoundingClientRect();if(!from)continue;
    const ghost=document.createElement('img');ghost.src=e.def(c).image;ghost.alt='';ghost.className='game-fx card-flight';ghost.style.left=to.x+'px';ghost.style.top=to.y+'px';ghost.style.width=to.width+'px';document.body.append(ghost);
    ghost.animate([{transform:`translate(${from.x-to.x}px,${from.y-to.y}px) scale(.35)`,opacity:.4},{transform:'translate(0,0) scale(1)',opacity:1}],{duration:450,easing:'ease-out'}).onfinish=()=>ghost.remove();
   }
  }
 }
 e.s.players.forEach((p,o)=>{const d=p.life.length-before.life[o];if(d)burst(document.querySelector(`[data-life-anchor="${o}"]`),`生命 ${d>0?'+':''}${d}`,d<0);});
 if(command.type==='attack'){
  const a=find(command.uid)?.getBoundingClientRect(),b=find(command.target)?.getBoundingClientRect();if(!a||!b)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('game-fx','attack-fx');svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  svg.innerHTML=`<defs><marker id="attack-tip" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#ffba72"/></marker></defs><line x1="${a.x+a.width/2}" y1="${a.y+a.height/2}" x2="${b.x+b.width/2}" y2="${b.y+b.height/2}" stroke="#ffba72" stroke-width="4" marker-end="url(#attack-tip)"/>`;
  document.body.append(svg);if(!reduced)svg.animate([{opacity:0},{opacity:1,offset:.2},{opacity:0}],{duration:850});setTimeout(()=>svg.remove(),900);
 }
}
