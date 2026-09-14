from pathlib import Path
p=Path('dist/app.js');s=p.read_text(encoding='utf8')
s=s.replace("page==='setup'?setup():page==='catalog'?catalog():help()","page==='table'&&engine?.s?table(engine,view,selected,attackFrom):page==='setup'?setup():page==='catalog'?catalog():help()")
s=s.replace("else if(b.dataset.act==='start')toast('正在准备练习桌');","else if(b.dataset.act==='start')startGame();")
s=s.replace("function help(){return", "function help(){return")
start=s.index("document.addEventListener('submit'")
end=s.index('async function init()',start)
s=s[:start]+'''document.addEventListener('submit',e=>{
 if(e.target.id!=='deckform')return;e.preventDefault();const f=new FormData(e.target),text=String(f.get('text')),entries={};
 try{for(const line of text.split(/\\r?\\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('//'))){const m=line.match(/^(\\d+)\\s*x?\\s*((?:OP|EB|ST|PRB|P)\\d*-\\d{3})(?:\\s.*)?$/i);if(!m)throw Error('无法识别这一行：'+line);const id=m[2].toUpperCase();entries[id]=(entries[id]||0)+Number(m[1]);}
 const d={name:String(f.get('name')).trim(),cards:entries};const errors=engine.validateDeck(d);if(errors.length)throw Error(errors.join('；'));decks.push(d);const saved=JSON.parse(localStorage.getItem('opcg-decks')||'[]');saved.push(d);localStorage.setItem('opcg-decks',JSON.stringify(saved));chosen[0]=decks.length-1;modal.close();page='setup';render();toast('卡组已保存到当前设备');}catch(err){toast(err.message)}
});
function startGame(){try{let first=$('#first').value;engine.start(chosen.map(i=>decks[i]),first==='random'?Math.floor(Math.random()*2):+first);view=engine.s.prompt?.owner??engine.s.active;page='table';selected=[];attackFrom=null;render();persist();}catch(e){toast(e.message)}}
function persist(){try{if(engine.s)localStorage.setItem('opcg-game',JSON.stringify({s:engine.s,seed:engine.seed,serial:engine.serial}))}catch(e){toast('本机存储空间不足，当前对局暂未保存')}}
function gameCommand(c){try{if(c.type==='undo')engine.undo();else engine.dispatch(c);selected=[];attackFrom=null;view=engine.s.prompt?.owner??engine.s.active;modal.close();persist();render();}catch(e){toast(e.message)}}
function boardClick(uid){const c=engine.s.cards[uid],p=engine.s.prompt;
 if(attackFrom){if(engine.canAttack(engine.s.cards[attackFrom],c)){gameCommand({type:'attack',uid:attackFrom,target:uid});return}toast('这个目标当前不能被攻击');return}
 if(p?.candidates?.includes(uid)){selected=selected.includes(uid)?selected.filter(x=>x!==uid):selected.length<p.max?[...selected,uid]:p.max===1?[uid]:selected;render();return}
 const d=engine.def(c),owner=engine.s.active;let buttons='';
 if(!p&&c.owner===owner){if(c.zone==='hand')buttons+=`<button class="primary" data-playuid="${uid}">使用卡牌 · ${engine.cost(c)} DON!!</button>`;if(['leader','field'].includes(c.zone)){buttons+=`<button data-attachuid="${uid}" ${!engine.readyDon(owner).length?'disabled':''}>附加 1 DON!!</button>`;if(engine.board(1-owner).some(t=>engine.canAttack(c,t)))buttons+=`<button data-attackuid="${uid}">选择攻击目标</button>`;}if(['leader','field','stage'].includes(c.zone))engine.actions(c).forEach((a,i)=>{if(a.proc.ActivateMain)buttons+=`<button data-activateuid="${uid}" data-index="${i}">发动效果 ${i+1}${a.proc.OncePerTurn?' · 每回合一次':''}</button>`});}
 if(p?.type==='counter'&&c.owner===p.owner&&c.zone==='hand'&&(engine.counter(c)>0||engine.actions(c).some(a=>a.proc.Counter)))buttons+=`<button class="primary" data-counteruid="${uid}">使用反击${engine.counter(c)?' +'+engine.counter(c):''}</button>`;
 showCard(c.id);modal.querySelector('.detail').insertAdjacentHTML('beforeend',`<div class="card-command actions">${buttons}</div>`);
}
document.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;
 if(b.dataset.board)boardClick(b.dataset.board);
 else if(b.hasAttribute('data-answer'))gameCommand({type:'choose',value:b.dataset.answer});
 else if(b.hasAttribute('data-confirmtargets'))gameCommand({type:'choose',uids:selected});
 else if(b.dataset.gamecommand)gameCommand({type:b.dataset.gamecommand});
 else if(b.dataset.playuid)gameCommand({type:'play',uid:b.dataset.playuid});
 else if(b.dataset.attachuid)gameCommand({type:'attach',uid:b.dataset.attachuid});
 else if(b.dataset.activateuid)gameCommand({type:'activate',uid:b.dataset.activateuid,index:+b.dataset.index});
 else if(b.dataset.counteruid)gameCommand({type:'choose',uid:b.dataset.counteruid});
 else if(b.dataset.attackuid){attackFrom=b.dataset.attackuid;modal.close();render()}
 else if(b.hasAttribute('data-cancelattack')){attackFrom=null;render()}
 else if(b.hasAttribute('data-swap')){view=1-view;render()}
 else if(b.dataset.detailuid)showCard(engine.s.cards[b.dataset.detailuid].id);
 else if(b.hasAttribute('data-log'))dialog('对局记录',engine.s.log.slice().reverse().map(x=>`<p><small>回合 ${x.turn}</small> ${esc(x.text)}</p>`).join(''));
 else if(b.dataset.zone){const [o,z]=b.dataset.zone.split(':');dialog(`${engine.label(+o)} · 弃牌区`,`<div class="card-grid">${engine.list(+o,z).map(c=>cardButton(db[c.id])).join('')}</div>`)}
 else if(b.hasAttribute('data-resume')){page='table';view=engine.s.prompt?.owner??engine.s.active;render()}
});
''' + s[end:]
s=s.replace("decks=decks.filter(d=>leader(d));", "decks=decks.filter(d=>leader(d));const rules=await(await fetch('./data/rules.json')).json();engine=new Engine(cards,rules);try{decks.push(...JSON.parse(localStorage.getItem('opcg-decks')||'[]'));const saved=JSON.parse(localStorage.getItem('opcg-game')||'null');if(saved?.s?.version===1){engine.s=saved.s;engine.seed=saved.seed;engine.serial=saved.serial;engine.assertState();}}catch(e){console.warn('存档不可用',e);engine.s=null;}")
s=s.replace('<div class="setup-foot"><div class="row">','<div class="setup-foot">${engine?.s?\'<button data-resume>继续上次练习</button>\':\'\'}<div class="row">')
p.write_text(s,encoding='utf8')
