// Deterministic rules state machine. All UI actions use dispatch(); no arbitrary card moves.
import {unsupported} from './coverage.mjs';
import {extraCondition,extraConditionNames} from './conditions.mjs';
import {enqueueRemoval,runRemoval,finishReplacement} from './replacements.mjs';
export class RuleError extends Error {}
class GameFinished extends Error {}
export const clone=x=>structuredClone(x);
const assert=(v,m)=>{if(!v)throw new RuleError(m)};
const overlaps=(a=[],b=[])=>a.some(x=>b.includes(x));
export class Engine {
  constructor(catalog,rules,{seed=Date.now()}={}){this.db=Object.fromEntries(catalog.map(c=>[c.id,c]));this.rules=rules;this.seed=seed>>>0;this.s=null;this.history=[];this.serial=0;}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
  card(id,owner,zone){const c={uid:`c${++this.serial}`,id,owner,zone,rested:false,faceUp:false,joined:-1,mods:[],used:{}};this.s.cards[c.uid]=c;this.s.players[owner][zone].push(c.uid);return c;}
  def(c){return this.db[typeof c==='string'?this.s.cards[c]?.id:c.id]||{};}
  rule(c){return this.rules[c.id]||{};}
  list(owner,zone){return this.s.players[owner][zone].map(u=>this.s.cards[u]);}
  board(owner){return ['leader','field','stage'].flatMap(z=>this.list(owner,z));}
  don(owner){return this.list(owner,'don');}
  attached(c){return this.don(c.owner).filter(d=>d.attached===c.uid);}
  readyDon(owner){return this.don(owner).filter(d=>!d.rested&&!d.attached);}
  restDon(owner){return this.don(owner).filter(d=>d.rested&&!d.attached);}
  log(text){this.s.log.push({turn:this.s.turn,text});if(this.s.log.length>300)this.s.log.shift();}
  name(c){return this.def(c).name||this.def(c).nameEn||c.id;}
  label(owner){return owner===0?'P1':'P2';}
  validateDeck(deck){
    const errors=[],entries=Object.entries(deck.cards||{}),leaders=entries.filter(([id])=>this.db[id]?.type==='领袖');
    if(leaders.length!==1||leaders[0]?.[1]!==1)errors.push('必须选择 1 张领袖');
    const lc=this.db[leaders[0]?.[0]];let total=0;
    for(const [id,n]of entries){const c=this.db[id];if(!c){errors.push(`未找到卡牌 ${id}`);continue}const limit=['OP01-075','OP08-072','OP16-042'].includes(id)?50:4;if(!Number.isInteger(n)||n<1||n>limit)errors.push(`${id} 的数量应为 1–${limit}`);if(c.type==='领袖')continue;total+=n;if(lc&&!c.colors.every(x=>lc.colors.includes(x)))errors.push(`${id} 的颜色与领袖不符`);}
    if(total!==50)errors.push(`主卡组需要 50 张，当前 ${total} 张`);return [...new Set(errors)];
  }
  start(decks,first=0){
    assert(first===0||first===1,'先攻方无效');decks.forEach((d,i)=>{assert(!this.validateDeck(d).length,`${this.label(i)}：${this.validateDeck(d).join('；')}`);const pending=Object.keys(d.cards).filter(id=>unsupported(this.rules[id]||{}).length);assert(!pending.length,`${this.label(i)} 的 ${pending.slice(0,5).join('、')} 特殊效果尚未迁移，暂时不能自动对战`)});
    this.s={version:1,turn:0,active:first,first,phase:'mulligan',cards:{},players:[],queue:[],prompt:null,battle:null,winner:null,log:[],events:[],endings:[],donActivations:[]};this.history=[];this.serial=0;
    for(let i=0;i<2;i++)this.s.players.push({name:decks[i].name,turns:0,leader:[],field:[],stage:[],hand:[],deck:[],life:[],trash:[],reveal:[],don:[],donReserve:[],removed:[]});
    decks.forEach((d,i)=>{for(const[id,n]of Object.entries(d.cards)){for(let k=0;k<n;k++)this.card(id,i,this.db[id].type==='领袖'?'leader':'deck')}this.shuffle(this.s.players[i].deck);for(let k=0;k<10;k++)this.card('DON',i,'donReserve');this.draw(i,5,false)});
    this.s.queue=[{kind:'mulligan',owner:first},{kind:'mulligan',owner:1-first},{kind:'setupLife'},{kind:'beginTurn'}];this.pump();return this.s;
  }
  move(c,zone,{bottom=false,rested=false,faceUp=false}={}){
    const p=this.s.players[c.owner],from=c.zone;if(from===zone&&zone!=='deck'&&zone!=='life')return;
    if(['field','leader','stage'].includes(from)&&from!==zone){c.incarnation=(c.incarnation||0)+1;for(const d of this.attached(c)){delete d.attached;d.rested=true}c.mods=[];c.used={};}
    const idx=p[from].indexOf(c.uid);assert(idx>=0,'卡牌区域状态不一致');p[from].splice(idx,1);bottom?p[zone].push(c.uid):p[zone].unshift(c.uid);c.zone=zone;c.rested=rested;c.faceUp=faceUp;
    if(zone==='field'||zone==='stage')c.joined=this.s.turn;
    if(from==='deck'&&zone!=='deck'&&this.s.phase!=='mulligan'&&!p.deck.length&&this.s.winner===null){this.win(this.flags(this.list(c.owner,'leader')[0]).WinsByDeckout?c.owner:1-c.owner,'牌库已空');throw new GameFinished();}
  }
  draw(owner,n=1,events=true){for(let k=0;k<n;k++){const c=this.list(owner,'deck')[0];if(!c){this.win(1-owner,'对方牌库已空');break}this.move(c,'hand');if(events)this.emit('CardDrawn',c,{owner});}if(n)this.log(`${this.label(owner)} 抽 ${n} 张牌`);}
  win(owner,why){this.s.winner=owner;this.s.phase='finished';this.s.prompt=null;this.s.queue=[];this.log(`${this.label(owner)} 获胜：${why}`);}
  dispatch(command){assert(this.s,'请先开始对局');const before=clone(this.s),seed=this.seed;try{assert(this.s.winner===null,'本局已结束');this.command(command);this.pump();this.assertState();this.history.push({s:before,seed});if(this.history.length>80)this.history.shift();return this.s}catch(e){if(e instanceof GameFinished){this.history.push({s:before,seed});this.assertState();return this.s}this.s=before;this.seed=seed;throw e}}
  undo(){const h=this.history.pop();assert(h,'没有可撤销的操作');this.s=h.s;this.seed=h.seed;return this.s;}
  assertState(){const seen=new Set();for(const p of this.s.players)for(const z of ['leader','field','stage','hand','deck','life','trash','reveal','don','donReserve','removed'])for(const u of p[z]){assert(!seen.has(u),'卡牌重复');seen.add(u);assert(this.s.cards[u].zone===z,'卡牌区域不一致')}assert(seen.size===Object.keys(this.s.cards).length,'卡牌遗失');for(let o=0;o<2;o++){assert(this.s.players[o].field.length<=5,'角色区超过五张');assert(this.s.players[o].stage.length<=1,'舞台区超过一张');assert(this.s.players[o].don.length+this.s.players[o].donReserve.length===10,'DON!! 数量异常');for(const d of this.don(o))if(d.attached)assert(['leader','field'].includes(this.s.cards[d.attached]?.zone),'DON!! 附加目标无效');}}
  command(cmd){
    const p=this.s.prompt;
    if(cmd.type==='concede'){this.win(1-cmd.owner,'对方认输');return}
    if(p){assert(cmd.type==='choose','请先完成当前选择');this.choose(cmd);return}
    assert(this.s.phase==='main','当前不是主要阶段');const owner=this.s.active,c=this.s.cards[cmd.uid];
    if(cmd.type==='endTurn'){this.emit('EndOfTurn',null,{owner});this.s.queue.push({kind:'delayedEndTurn',owner},{kind:'finishTurn'});return}
    assert(c&&c.owner===owner,'请选择当前回合一方的卡牌');
    if(cmd.type==='play'){
      assert(c.zone==='hand','只能从手牌使用');const d=this.def(c);
      if(d.type==='事件'){const idx=this.actions(c).findIndex(a=>a.proc.ActivateMain);assert(idx>=0,'这张事件不能在主要阶段使用');this.beginAction(c,idx);return}
      assert(['角色','舞台'].includes(d.type),'不能登场');const cost=this.cost(c);assert(this.readyDon(owner).length>=cost,'可用 DON!! 不足');
      assert(this.canDeploy(c),'本回合效果限制此角色登场');if(d.type==='角色'&&this.list(owner,'field').length===5){this.ask({type:'replace',owner,candidates:this.s.players[owner].field.slice(),min:1,max:1,card:c.uid,title:'角色区已满，选择一张角色丢弃'});return}
      this.pay(owner,cost);if(d.type==='舞台')for(const old of this.list(owner,'stage'))this.move(old,'trash');this.deploy(c);return;
    }
    if(cmd.type==='attach'){
      assert(['leader','field'].includes(c.zone),'只能附加到领袖或角色');const n=cmd.count??1;assert(Number.isInteger(n)&&n>0,'附加数量无效');assert(this.readyDon(owner).length>=n,'可用 DON!! 不足');this.readyDon(owner).slice(0,n).forEach(d=>d.attached=c.uid);this.log(`向 ${this.name(c)} 附加 ${n} 张 DON!!`);return;
    }
    if(cmd.type==='activate'){assert(['leader','field','stage'].includes(c.zone),'卡牌不在场上');const a=this.actions(c)[cmd.index];assert(a?.proc.ActivateMain,'不是主要阶段效果');this.beginAction(c,cmd.index);return}
    if(cmd.type==='attack'){
      const target=this.s.cards[cmd.target];assert(this.canAttack(c,target),'当前无法攻击这个目标');c.rested=true;this.s.battle={attacker:c.uid,target:target.uid,originalTarget:target.uid,defender:target.owner,counter:0,blocked:false};this.log(`${this.name(c)} 攻击 ${this.name(target)}`);this.emit('OnRest',c,{owner});this.emit('OnAttack',c,{owner});if(target.zone==='leader')this.emit('OnAttackLeader',c,{owner});this.emit('OnOpponentAttack',c,{owner:target.owner,attacker:c.uid});this.s.queue.push({kind:'block'});return;
    }
    throw new RuleError('不支持的操作');
  }
  ask(prompt){this.s.prompt=prompt;}
  choose(cmd){
    const p=this.s.prompt;assert(cmd.owner===undefined||cmd.owner===p.owner,'当前选择属于另一方');const picks=cmd.uids||[];assert(new Set(picks).size===picks.length,'不能重复选择同一张牌');
    if(cmd.value==='cancelEffect'){assert(p.cancelAllowed,'当前步骤不能取消');this.s.prompt=null;return;}
    if(p.candidates){assert(picks.every(u=>p.candidates.includes(u)),'所选目标不合法');assert(picks.length>=p.min&&picks.length<=p.max,'选择数量不符合要求');}
    this.s.prompt=null;
    if(p.type==='endOrder'){const i=Number(cmd.value);assert(Number.isInteger(i)&&i>=0&&i<p.entries.length,'请选择一个待结算效果');this.resolveEnding(p.entries[i]);return}
    if(p.type==='mulligan'){assert(['keep','redraw'].includes(cmd.value),'请选择保留或重抽');if(cmd.value==='redraw'){for(const c of this.list(p.owner,'hand'))this.move(c,'deck');this.shuffle(this.s.players[p.owner].deck);this.draw(p.owner,5,false)}return}
    if(p.type==='replace'){this.move(this.s.cards[picks[0]],'trash');const c=this.s.cards[p.card];this.pay(c.owner,this.cost(c));this.deploy(c);return}
    if(p.type==='effectDeployReplace'){this.move(this.s.cards[picks[0]],'trash');this.deploy(this.s.cards[p.card],p.rested);return}
    if(p.type==='optional'){assert(['yes','no'].includes(cmd.value),'请选择发动或跳过');if(cmd.value==='yes')this.beginAction(this.s.cards[p.card],p.index,p.context,true);return}
    if(p.type==='replacement'){assert(['yes','no'].includes(cmd.value),'请选择发动或放弃替代效果');if(cmd.value==='yes')this.beginAction(this.s.cards[p.card],p.index,{replacement:p.job},true);return}
    if(p.type==='targets'){const t=p.task;for(let i=0;i<picks.length;i++)assert(this.targetAllowed(p,picks[i],picks.slice(0,i)),'不能重复选择同名卡，或所选卡牌不符合效果条件');t.targets[p.group]=picks;t.group=p.group+1;this.s.queue.unshift(t);return}
    if(p.type==='choice'){const i=Number(cmd.value);assert(Number.isInteger(i)&&i>=0&&i<p.choices.length,'效果选项无效');p.task.step=p.choices[i].JumpToStep??0;p.task.targets=[];p.task.group=0;delete p.task.prepared;delete p.task.confirmed;delete p.task.order;this.s.queue.unshift(p.task);return}
    if(p.type==='confirmEffect'){assert(['yes','no'].includes(cmd.value),'请选择确认或取消');assert(cmd.value!=='no'||!p.noCancel,'这个步骤不能取消');if(cmd.value==='yes'){p.task.confirmed=true;this.s.queue.unshift(p.task)}return}
    if(p.type==='order'){p.task.order=picks;this.s.queue.unshift(p.task);return}
    if(p.type==='peek'){assert(cmd.value==='confirm','请确认查看');p.task.peekConfirmed=true;this.s.queue.unshift(p.task);return}
    if(p.type==='block'){if(picks.length){const c=this.s.cards[picks[0]];assert(!c.rested&&this.flags(c).Blocker,'角色不能阻挡');c.rested=true;this.s.battle.target=c.uid;this.s.battle.blocked=true;this.log(`${this.name(c)} 发动阻挡`);this.emit('OnRest',c,{owner:c.owner});this.emit('OnBlock',c,{owner:c.owner});this.emit('OpponentActivatesBlocker',c,{owner:1-c.owner,blocker:c.uid})}this.s.queue.push({kind:'counter'});return}
    if(p.type==='counter'){
      if(cmd.value==='finish'){this.s.queue.push({kind:'combat'});return}
      const c=this.s.cards[cmd.uid];assert(c&&c.owner===p.owner&&c.zone==='hand','反击卡必须来自防守方手牌');
      if(this.def(c).type==='事件'){const idx=this.actions(c).findIndex(a=>a.proc.Counter);assert(idx>=0,'这张事件没有反击效果');this.beginAction(c,idx,{battle:true});}
      else{const n=this.counter(c);assert(n>0,'这张牌没有反击值');this.move(c,'trash');this.s.battle.counter+=n;this.log(`${this.name(c)} 反击 +${n}`)}this.s.queue.push({kind:'counter'});return;
    }
    if(p.type==='lifeTrigger'){
      assert(['yes','no'].includes(cmd.value),'请选择发动或加入手牌');const c=this.s.cards[p.card];if(cmd.value==='yes'){this.move(c,'reveal');this.beginAction(c,p.index,{trigger:true},true);this.s.queue.push({kind:'triggerCleanup',uid:c.uid})}else this.move(c,'hand');return;
    }
    throw new RuleError('未知选择类型');
  }
  pay(owner,n){assert(this.readyDon(owner).length>=n,'可用 DON!! 不足');this.readyDon(owner).slice(0,n).forEach(d=>d.rested=true);}
  canDeploy(c){return this.def(c).type!=='角色'||(!this.s.noPlayCharacters?.[c.owner]&&(this.def(c).cost||0)<(this.s.noPlayOriginalCost?.[c.owner]??Infinity));}
  deploy(c,rested=false){if(!this.canDeploy(c)){this.log(`${this.name(c)}：受本回合效果限制，无法登场`);return}const z=this.def(c).type==='舞台'?'stage':'field';if(z==='field'&&this.list(c.owner,z).length>=5&&c.zone!=='field'){this.s.interruptions??=[];this.s.interruptions.push({kind:'effectDeployment',uid:c.uid,rested});return}if(z==='stage')for(const x of this.list(c.owner,z))this.move(x,'trash');this.move(c,z,{rested});this.log(`${this.label(c.owner)} 登场 ${this.name(c)}`);this.emit('OnPlay',c,{owner:c.owner});}
  attackReason(c,t){
    if(!c||!t)return '请选择攻击者和目标';
    if(c.owner!==this.s.active)return '现在不是这方的回合';
    if(t.owner===c.owner)return '不能攻击己方卡牌';
    if(!['leader','field'].includes(c.zone)||!['leader','field'].includes(t.zone))return '只能用场上的领袖或角色攻击对方领袖或角色';
    const f=this.flags(c);
    if(c.rested)return '这张卡已横置，不能再次攻击';
    if(this.s.players[c.owner].turns<=1)return '双方各自的第一个回合不能攻击';
    if(f.CantAttack||f.PassiveCantAttack)return '这张卡受效果限制，不能攻击';
    if(c.zone==='field'&&c.joined>=this.s.turn&&!f.Rush&&!(f.RushCharacters&&t.zone==='field'))return f.RushCharacters?'登场回合的速攻仅能攻击角色':'刚登场的角色本回合不能攻击（需要速攻）';
    const forced=[];for(const x of this.board(1-c.owner))for(const z of this.passive(x))if(z.effect.OpponentCanOnlyAttackMyName&&!forced.some(y=>y.uid===z.source.uid))forced.push(z.source);if(forced.length&&!forced.some(x=>x.uid===t.uid))return `必须攻击 ${forced.map(x=>this.name(x)).join(' 或 ')}`;
    if(t.zone==='field'&&!t.rested&&!f.CanAttackActive)return '对方角色未横置，不能选择为攻击目标';
    return '';
  }
  battleImmune(defender,attacker){const f=this.flags(defender),strike=this.rule(attacker).strikeType;return !!(f.ImmuneToBattle||(attacker.zone==='leader'?f.ImmuneToLeaderStrikes:f.ImmuneToStrikes)?.includes(strike));}
  canAttack(c,t){return !this.attackReason(c,t);}
  activationReason(c,index){
    const a=this.actions(c)[index];if(!a?.proc.ActivateMain)return '这张卡没有主要阶段效果';
    if(!this.conditions(a.proc,c))return '未满足卡牌中文效果中的发动条件';
    if(a.proc.OncePerTurn&&c.used[index]===this.s.turn)return '这个效果本回合已经使用';
    const cost=a.steps?.[0]?.effect||{};
    if(this.readyDon(c.owner).length<(cost.DonTap||0))return `需要横置 ${cost.DonTap} 张 DON!!，当前只有 ${this.readyDon(c.owner).length} 张可用`;
    if(this.don(c.owner).length<(cost.DonMinus||0))return `需要返还 ${cost.DonMinus} 张 DON!!，场上只有 ${this.don(c.owner).length} 张`;
    return '';
  }
  actions(c){if(c.mods?.some(m=>m.key==='flag'&&m.value==='Silence'))return [];return this.rule(c).actionV3s||[];}
  beginAction(c,index,context={},triggered=false){
    const a=this.actions(c)[index];assert(a,'卡牌效果不存在');assert(this.conditions(a.proc,c,context),'未满足发动条件');assert(!a.proc.OncePerTurn||c.used[index]!==this.s.turn,'该效果本回合已使用');
    const costStep=a.steps?.[0];if(costStep?.effect?.DonTap)assert(this.readyDon(c.owner).length>=costStep.effect.DonTap,'可用 DON!! 不足');
    if(costStep?.effect?.DonMinus)assert(this.don(c.owner).length>=costStep.effect.DonMinus,'DON!! 不足以支付返还费用');
    this.log(`${this.name(c)} 发动效果`);this.s.queue.unshift({kind:'effect',uid:c.uid,index,step:0,group:0,targets:[],previous:[],context});
  }
  emit(event,subject,context={}){
    const owner=context.owner??subject?.owner;
    const direct=['OnPlay','OnAttack','OnAttackLeader','OnBlock','OnKO','OnKOEffectOnly','OnRest','AfterBattleCharacter'];
    const sources=direct.includes(event)?(subject?[subject]:[]):[...this.board(owner??0),...this.board(1-(owner??0))];
    for(const c of sources)this.actions(c).forEach((a,index)=>{if(a.proc[event]&&(direct.includes(event)||event==='AnyCharacterKOd'||c.owner===owner)&&this.conditions(a.proc,c,context)&&(!a.proc.OncePerTurn||c.used[index]!==this.s.turn))this.s.events.push({kind:'offer',uid:c.uid,index,context});});
  }
  pump(){let n=0;while(!this.s.prompt&&(this.s.queue.length||this.s.events.length||this.s.interruptions?.length)&&this.s.winner===null){assert(++n<1000,'效果循环超过安全上限');if(this.s.interruptions?.length){this.s.queue.unshift(...this.s.interruptions);this.s.interruptions=[];}else if(this.s.events.length&&!['effect','effectDeployment'].includes(this.s.queue[0]?.kind)){this.s.queue.unshift(...this.s.events);this.s.events=[];}const t=this.s.queue.shift();this.task(t)}}
  resolveEnding(entry){this.s.endings=this.s.endings.filter(x=>x.id!==entry.id);this.s.queue.unshift({kind:'effect',uid:entry.uid,index:entry.index,action:entry.action,step:0,group:0,targets:[],previous:[],context:{delayed:true,incarnation:entry.incarnation}},{kind:'delayedEndTurn',owner:entry.owner});this.log(`${this.label(entry.owner)} 结算 ${this.name(this.s.cards[entry.uid])} 的回合结束效果`);}
  task(t){
    if(t.kind==='delayedEndTurn'){const activations=(this.s.donActivations||[]).filter(x=>x.owner===t.owner&&x.turn<=this.s.turn);if(activations.length){this.s.donActivations=this.s.donActivations.filter(x=>!activations.includes(x));const n=activations.reduce((sum,x)=>sum+x.count,0),ds=this.restDon(t.owner).slice(0,n);for(const d of ds)d.rested=false;this.log(`${this.label(t.owner)} 在回合结束时激活 ${ds.length} 张 DON!!`);}const entries=(this.s.endings||[]).filter(x=>x.owner===t.owner&&x.turn<=this.s.turn);if(entries.length>1){this.ask({type:'endOrder',owner:t.owner,entries,title:'有多个延迟效果，请选择先结算哪一个'});return}if(entries.length)this.resolveEnding(entries[0]);return}
    if(t.kind==='effectDeployment'){const c=this.s.cards[t.uid];if(!this.canDeploy(c))return;if(this.list(c.owner,'field').length>=5){this.ask({type:'effectDeployReplace',owner:c.owner,card:c.uid,rested:t.rested,candidates:this.s.players[c.owner].field.slice(),min:1,max:1,title:'效果登场：角色区已满，选择一张角色丢弃'});return}this.deploy(c,t.rested);return}
    if(t.kind==='removal'){runRemoval(this,t);return}
    if(t.kind==='mulligan'){this.ask({type:'mulligan',owner:t.owner,title:'选择保留起手，或将全部手牌洗回后重抽一次'});return}
    if(t.kind==='setupLife'){for(let o=0;o<2;o++){const n=this.def(this.list(o,'leader')[0]).life;for(let i=0;i<n;i++)this.move(this.list(o,'deck')[0],'life',{bottom:true})}return}
    if(t.kind==='beginTurn'){
      const o=this.s.active,p=this.s.players[o];this.s.turn++;p.turns++;this.s.phase='main';
      for(const c of this.board(o)){if(!c.freeze)c.rested=false;delete c.freeze;for(const d of this.attached(c))delete d.attached;c.mods=c.mods.filter(m=>!(m.until==='ownerStart'&&m.owner===o));}if(this.s.noTakeLife)delete this.s.noTakeLife[o];
      this.don(o).forEach(d=>d.rested=false);if(this.s.turn!==1)this.draw(o,1);const n=Math.min(this.s.turn===1?1:2,p.donReserve.length);for(let k=0;k<n;k++)this.move(this.list(o,'donReserve')[0],'don');this.log(`${this.label(o)} 的第 ${p.turns} 回合，获得 ${n} 张 DON!!`);this.emit('StartOfTurn',null,{owner:o});this.emit('StartOfMainPhase',null,{owner:o});return;
    }
    if(t.kind==='finishTurn'){const o=this.s.active;for(const c of Object.values(this.s.cards))c.mods=c.mods.filter(m=>m.until==='ownerStart'||m.until==='ownerEnd'&&m.owner!==o||m.until==='oppEnd'&&m.owner===o);if(this.s.noActivateDon)delete this.s.noActivateDon[o];this.s.noPlayCharacters={};this.s.noPlayOriginalCost={};this.s.active=1-o;this.s.queue.push({kind:'beginTurn'});return}
    if(t.kind==='offer'){const c=this.s.cards[t.uid],a=this.actions(c)[t.index],cost=a?.steps[0]?.effect||{};if(a&&this.conditions(a.proc,c,t.context)&&(!a.proc.OncePerTurn||c.used[t.index]!==this.s.turn)&&this.readyDon(c.owner).length>=(cost.DonTap||0)&&this.don(c.owner).length>=(cost.DonMinus||0))this.beginAction(c,t.index,t.context,true);return}
    if(t.kind==='effect'){this.effectStep(t);return}
    if(t.kind==='block'){
      const b=this.s.battle;if(!b)return;const a=this.s.cards[b.attacker],o=b.defender;
      const flags=this.flags(a),candidates=flags.Unblockable?[]:this.list(o,'field').filter(c=>!c.rested&&this.flags(c).Blocker&&(!flags.BlockerMustBeXOrLess||this.power(c)<=flags.BlockerMustBeXOrLess)).map(c=>c.uid);
      if(candidates.length)this.ask({type:'block',owner:o,candidates,min:0,max:1,title:'选择阻挡角色，或不阻挡'});else this.s.queue.push({kind:'counter'});return;
    }
    if(t.kind==='counter'){const b=this.s.battle;if(!b)return;if(!['field','leader'].includes(this.s.cards[b.target]?.zone)||!['field','leader'].includes(this.s.cards[b.attacker]?.zone)){this.s.battle=null;return}this.ask({type:'counter',owner:b.defender,title:'防守方可以使用反击，或结束反击并结算战斗'});return}
    if(t.kind==='combat'){
      const b=this.s.battle,a=this.s.cards[b.attacker],d=this.s.cards[b.target],ap=this.power(a),dp=this.power(d)+b.counter;
      this.log(`战斗结算：${ap} 对 ${dp}`);
      if(ap>=dp){if(d.zone==='leader'){if(!this.list(d.owner,'life').length){this.win(a.owner,'对方生命为零时受到攻击');return}const n=this.flags(a).DoubleAttack?2:1;for(let i=0;i<n;i++)this.s.queue.push({kind:'damage',owner:d.owner,banish:!!this.flags(a).Banish})}else if(!this.battleImmune(d,a))this.remove(d,'trash',true)}
      this.s.queue.push({kind:'battleEnd'});return;
    }
    if(t.kind==='damage'){
      if(this.s.noTakeLife?.[t.owner]){this.log(`${this.label(t.owner)} 免除一次生命伤害`);return;}
      const c=this.list(t.owner,'life')[0];if(!c)return;
      if(t.banish){this.move(c,'trash');return}const index=this.actions(c).findIndex(a=>a.proc.Trigger);
      if(index>=0)this.ask({type:'lifeTrigger',owner:t.owner,card:c.uid,index,title:'生命牌有触发效果：发动，或加入手牌'});else this.move(c,'hand');return;
    }
    if(t.kind==='triggerCleanup'){const c=this.s.cards[t.uid];if(c.zone==='reveal')this.move(c,'trash');return}
    if(t.kind==='battleEnd'){const b=this.s.battle;if(b&&this.def(this.s.cards[b.target]).type==='角色')this.emit('AfterBattleCharacter',this.s.cards[b.attacker],{owner:this.s.cards[b.attacker].owner});for(const c of Object.values(this.s.cards))c.mods=c.mods.filter(m=>m.until!=='battle');this.s.battle=null;return}
    throw new RuleError(`未实现流程：${t.kind}`);
  }
  remove(c,destination,combat=false,source=null,group=null){enqueueRemoval(this,c,destination,{source,combat,bottom:destination==='deck',type:'KO',group});}
  conditions(p,c,context={}){
    const o=c.owner,own=this.s.players[o],opp=this.s.players[1-o],leader=this.list(o,'leader')[0],count=z=>own[z].length,enemy=z=>opp[z].length;
    for(const[k,v]of Object.entries(p)){
      if(!v)continue;
      if(p.OrDonIsZero&&!count('don')&&['SelfRestedDon','OppRestedDon','AvailableDon','DonXOrMore','DonXOrLess','DonXLessThanOpp','OppDonXOrMore','EitherDonXOrMore'].includes(k))continue;
      if(k==='OppPowerXOrMore'&&!this.list(1-o,'field').some(x=>this.power(x)>=v))return false;
      const checks={DonX:()=>this.attached(c).length>=v,YourTurn:()=>this.s.active===o,OpponentTurn:()=>this.s.active!==o,Active:()=>!c.rested,Rested:()=>c.rested,PowerXOrMore:()=>this.power(c)>=v,OppCharPowerXOrMore:()=>this.list(1-o,'field').some(x=>this.power(x)>=v),OppNo2CharsBaseXOrMore:()=>this.list(1-o,'field').filter(x=>(this.def(x).power||0)>=v).length<2,SelfNo2CharsPowXOrMore:()=>this.list(o,'field').filter(x=>this.power(x)>=v).length<2,AvailableDon:()=>this.readyDon(o).length>=v,CharactersOrMore:()=>count('field')>=v,CharactersOrLess:()=>count('field')<=v,OppCharactersOrMore:()=>enemy('field')>=v,OppCharactersOrLess:()=>enemy('field')<=v,HandXOrLess:()=>count('hand')<=v,HandXOrMore:()=>count('hand')>=v,HandEmpty:()=>!count('hand'),DonXOrMore:()=>count('don')>=v,DonXOrLess:()=>count('don')<=v,OppDonXOrMore:()=>enemy('don')>=v,OppDonXOrLess:()=>enemy('don')<=v,LessOrEqDon:()=>count('don')<=enemy('don'),LessDon:()=>count('don')<enemy('don'),LifeXOrLess:()=>count('life')<=v,LifeXOrMore:()=>count('life')>=v,OppLifeXOrLess:()=>enemy('life')<=v,OppLifeXOrMore:()=>enemy('life')>=v,CombinedLifeXOrLess:()=>count('life')+enemy('life')<=v,LessLife:()=>count('life')<enemy('life'),LessOrEqLife:()=>count('life')<=enemy('life'),ZeroLife:()=>!count('life'),LifeIsZero:()=>!count('life'),FirstTurnOnly:()=>own.turns===1,SelfRestedDon:()=>this.restDon(o).length>=v,OppRestedDon:()=>this.restDon(1-o).length>=v,TrashXOrMore:()=>count('trash')>=v,TrashEventsXOrMore:()=>this.list(o,'trash').filter(x=>this.def(x).type==='事件').length>=v,LeaderColorCountOrMore:()=>this.def(leader).colors.length>=v,LeaderColorCountOrLess:()=>this.def(leader).colors.length<=v,LeaderCategoryRequired:()=>overlaps(this.rule(leader).cardCategories,v)||(p.OverrideLeaderCategoryName||[]).some(n=>[this.rule(leader).characterName,...this.rule(leader).extraNames||[]].includes(n)),LeaderNameRequired:()=>v.includes(this.rule(leader).characterName),LeaderNameIncludes:()=>v.some(x=>this.rule(leader).characterName.includes(x)),LeaderStrikeTypeRequired:()=>v.includes(this.rule(leader).strikeType),FieldIsOnlyCategory:()=>this.list(o,'field').every(x=>overlaps(this.rule(x).cardCategories,v)),FacedownLife:()=>this.list(o,'life').filter(x=>!x.faceUp).length>=v,FaceupLife:()=>this.list(o,'life').filter(x=>x.faceUp).length>=v,AnyFaceupLife:()=>this.list(o,'life').some(x=>x.faceUp),SelfAttachedDon:()=>this.board(o).reduce((n,x)=>n+this.attached(x).length,0)>=v,SelfRestedCharacters:()=>this.list(o,'field').filter(x=>x.rested).length>=v,SelfRestedCards:()=>this.board(o).filter(x=>x.rested).length>=v,LeaderActive:()=>!leader.rested,OnBoard:()=>['leader','field','stage'].includes(c.zone),HasPreviousTargets:()=>!!context.previous?.length,NoPreviousTargets:()=>!context.previous?.length};
      Object.assign(checks,{TopDeckCountOrMore:()=>context.revealed?.uids.filter(u=>this.s.cards[u]?.zone===context.revealed.from).length>=v,OppHandXOrMore:()=>enemy('hand')>=v,LifeLess:()=>count('life')<enemy('life'),LifeLessOrEqual:()=>count('life')<=enemy('life'),CostZeroExists:()=>[...this.list(o,'field'),...this.list(1-o,'field')].some(x=>this.cost(x)===0),AllyNameNotInPlay:()=>!this.list(o,'field').some(x=>x.uid!==c.uid&&v.includes(this.rule(x).characterName)),NameInYourDeploy:()=>this.list(o,'field').some(x=>(Array.isArray(v)?v:[v]).includes(this.rule(x).characterName)),AnotherCharacterOfCategory:()=>this.list(o,'field').some(x=>x.uid!==c.uid&&overlaps(this.rule(x).cardCategories,v)),LeaderPowerZero:()=>this.power(leader)===0,FacedownLife:()=>this.list(o,'life').slice(0,v).length===v&&this.list(o,'life').slice(0,v).every(x=>!x.faceUp),FaceupLife:()=>this.list(o,'life').slice(0,v).length===v&&this.list(o,'life').slice(0,v).every(x=>x.faceUp)});
      if(checks[k]&&!checks[k]())return false;
      if(k==='BattlingStrikeType'){const b=this.s.battle;if(!b||![b.attacker,b.target].includes(c.uid)||!v.includes(this.rule(this.s.cards[b.attacker===c.uid?b.target:b.attacker]).strikeType))return false;}
      if(extraConditionNames.includes(k)&&!extraCondition(k,v,p,this,c,context))return false;
      if(v&&typeof v==='object'&&!Array.isArray(v)&&v.iCount){const list=this.list(o,'field'),matches=list.filter(x=>overlaps(this.rule(x).cardCategories,[v.eCategory])&&(k.includes('Rested')?x.rested:true));if(k.includes('Category')&&matches.length<v.iCount)return false;}
    }return true;
  }
  targetAllowed(p,uid,selected=[]){if(p.type!=='targets')return p.candidates?.includes(uid);const task=p.task,source=this.s.cards[task.uid],step=(task.action||this.actions(source)[task.index]).steps[task.step];return this.matchesGroup(this.s.cards[uid],step,p.group,source,{...task,selected});}
  matchesGroup(c,step,group,source,ctx){return [step.target[group],...(step.targetOverrides||[])].some(target=>this.matches(c,target,source,ctx));}
  matches(c,t,source,ctx={}){
    const r=this.rule(c),d=this.def(c),o=source.owner;
    if((t.AutoSelf||t.OnlySelf)&&ctx.context?.delayed&&(source.incarnation||0)!==ctx.context.incarnation)return false;
    if(t.AutoSelf&&c.uid!==source.uid||t.OnlySelf&&c.uid!==source.uid||t.NotSelf&&c.uid===source.uid||t.RequirePreviousTargets&&!ctx.previous?.includes(c.uid))return false;
    if(t.FriendlyOnly&&c.owner!==o||t.EnemyOnly&&c.owner===o||t.ActiveOnly&&c.rested||t.RestedOnly&&!c.rested||t.FaceUp&&!c.faceUp)return false;
    const zones={DeployedCharacter:'field',Leader:'leader',HandCard:'hand',TrashCard:'trash',StageCard:'stage',DeckCard:'deck',LifeCard:'life',TopDeckCard:'reveal',DonAreaCard:'don'};
    const allowed=Object.entries(zones).filter(([k])=>t[k]&&k!=='TopDeckCard'&&k!=='DonAreaCard').map(([,z])=>z),isDonTarget=c.zone==='don'&&(t.AttachedDon&&c.attached||t.DonAreaCard&&!c.attached);
    if((allowed.length||t.TopDeckCard||t.AttachedDon||t.DonAreaCard)&&!allowed.includes(c.zone)&&!isDonTarget&&!(t.TopDeckCard&&ctx.revealed?.uids.includes(c.uid)&&c.zone===ctx.revealed.from))return false;
    if(t.NoUsingPreviousTargets&&ctx.previous?.includes(c.uid))return false;
    if(t.CostOrLess&&this.cost(c)>t.CostOrLess||t.CostOppLifeOrLess&&this.cost(c)>this.list(1-o,'life').length||t.CostCombinedLifeOrLess&&this.cost(c)>this.list(o,'life').length+this.list(1-o,'life').length||t.CostDonOrLess&&this.cost(c)>this.don(o).length||t.CostOppDonOrLess&&this.cost(c)>this.don(1-o).length||t.GivenDon&&this.attached(c).length<t.GivenDon||t.NotNames?.includes(r.characterName))return false;
    const selected=(ctx.selected||[]).filter(u=>u!==c.uid).map(u=>this.s.cards[u]);
    if(t.CombinedCostXOrLess!==undefined&&this.cost(c)+selected.reduce((n,x)=>n+this.cost(x),0)>t.CombinedCostXOrLess)return false;
    if(t.CombinedPowerXOrLess!==undefined&&this.power(c)+selected.reduce((n,x)=>n+this.power(x),0)>t.CombinedPowerXOrLess)return false;
    const secondReference=t.SecondCostOrLessCheckPrevTarget?ctx.previous?.[0]:ctx.selected?.[0];if(t.SecondCostOrLess&&secondReference&&this.cost(c)>t.SecondCostOrLess)return false;
    if(t.NoDuplicateNames){const names=[...(ctx.previousNames||[]),...[...(ctx.previous||[]),...(ctx.selected||[])].map(u=>this.rule(this.s.cards[u]).characterName)];if(names.includes(r.characterName))return false;}
    if(t.NameOverrides?.includes(r.characterName)||t.ColoredEventOverrides&&r.cardType==='Event'&&overlaps(r.cardColors,t.ColoredEventOverrides)||t.StrikeTypeOverrides?.includes(r.strikeType))return true;
    if(t.OnlyTypes&&!t.OnlyTypes.includes(r.cardType)||t.OnlyColors&&!overlaps(r.cardColors,t.OnlyColors)||t.OnlyCategories&&!overlaps(r.cardCategories,t.OnlyCategories)||t.OnlyNames&&!t.OnlyNames.includes(r.characterName)||t.NotNames?.includes(r.characterName)||t.OnlyStrikeTypes&&!t.OnlyStrikeTypes.includes(r.strikeType))return false;
    if(t.CostOrLess&&this.cost(c)>t.CostOrLess||t.CostOrMore&&this.cost(c)<t.CostOrMore||t.OriginalCostOrLess&&(d.cost||0)>t.OriginalCostOrLess||t.OriginalCostOrMore&&(d.cost||0)<t.OriginalCostOrMore||t.CostZero&&this.cost(c)!==0)return false;
    if(t.PowerXOrLess&&this.power(c)>t.PowerXOrLess||t.PowerXOrMore&&this.power(c)<t.PowerXOrMore||t.OriginalPowerXOrLess&&(d.power||0)>t.OriginalPowerXOrLess||t.OriginalPowerXOrMore&&(d.power||0)<t.OriginalPowerXOrMore||t.PowerZero&&this.power(c)!==0)return false;
    if(t.BasePowerZero&&(d.power||0)!==0||t.CostEqualGivenDon&&this.cost(c)!==this.attached(c).length)return false;
    if(t.HasNoOnPlay&&this.actions(c).some(a=>a.proc.OnPlay)||t.HasNoOnAttack&&this.actions(c).some(a=>a.proc.OnAttack||a.proc.OnAttackLeader)||t.HasActivateMain&&!this.actions(c).some(a=>a.proc.ActivateMain))return false;
    if(t.HasNoCounter&&this.counter(c)>0||t.HasBlocker&&!this.flags(c).Blocker||t.NotBlocker&&this.flags(c).Blocker||t.HasTrigger&&!this.actions(c).some(a=>a.proc.Trigger)||t.HasNoEffects&&this.actions(c).length)return false;
    if(t.NoUsingPreviousTargets&&ctx.previous?.includes(c.uid))return false;return true;
  }
  passive(c,wanted=null){const out=[];for(const source of [...this.board(0),...this.board(1)])for(const a of this.actions(source))if(a.proc.Passive&&(!wanted||a.steps?.some(s=>wanted.some(k=>s.effect?.[k])))&&this.conditions(a.proc,source))for(const step of a.steps||[]){const ef=step.effect||{};if(wanted&&!wanted.some(k=>ef[k]))continue;if(!this.conditions(step.details||{},source))continue;const field=Object.keys(ef).some(k=>k.startsWith('Field')||k.startsWith('Ally')||k.startsWith('Opponent')||k.startsWith('OtherChars'));if(field){if(ef.AllyFieldCostChange&&(c.zone!=='field'||c.owner!==source.owner)||ef.OpponentFieldCostChange&&(c.zone!=='field'||c.owner===source.owner))continue;if(step.target?.length?step.target.some(t=>this.matchesPassive(c,t,source)):(ef.OpponentFieldCostChange?c.owner!==source.owner:c.owner===source.owner))out.push({source,effect:ef})}else if(source.uid===c.uid)out.push({source,effect:ef})}return out;}
  matchesPassive(c,t,source){const r=this.rule(c);return (!t.FriendlyOnly||c.owner===source.owner)&&(!t.EnemyOnly||c.owner!==source.owner)&&(!t.NotSelf||c.uid!==source.uid)&&(!t.OnlyTypes||t.OnlyTypes.includes(r.cardType))&&(!t.OnlyColors||overlaps(r.cardColors,t.OnlyColors))&&(!t.OnlyStrikeTypes||t.OnlyStrikeTypes.includes(r.strikeType))&&(!t.OnlyCategories||overlaps(r.cardCategories,t.OnlyCategories))&&(!t.OnlyNames||t.OnlyNames.includes(r.characterName))&&(!t.DeployedCharacter&&!t.Leader||t.DeployedCharacter&&c.zone==='field'||t.Leader&&c.zone==='leader');}
  basePower(c){let n=this.def(c).power||0;for(const m of c.mods||[])if(m.key==='basePower')n=m.value;return n;}
  power(c){let n=this.basePower(c);for(const m of c.mods||[])if(m.key==='power')n+=m.value;if(this.s.active===c.owner)n+=1000*this.attached(c).length;for(const {effect:e}of this.passive(c)){if(e.FieldBasePowerChange!==undefined)n=e.FieldBasePowerChange;if(e.PassiveBasePowerMatchLeader)n=this.basePower(this.list(c.owner,'leader')[0]);n+=(e.PassivePowerChange||0)+(e.FieldPowerBuff||0)-(e.FieldPowerDebuff||0);if(e.Passive1KPerXTrash)n+=Math.floor(this.list(c.owner,'trash').length/e.Passive1KPerXTrash)*1000;if(e.Passive1KPerXEventTrash)n+=Math.floor(this.list(c.owner,'trash').filter(x=>this.def(x).type==='事件').length/e.Passive1KPerXEventTrash)*1000;if(e.Passive1KPerXRestedDon)n+=Math.floor(this.restDon(c.owner).length/e.Passive1KPerXRestedDon)*1000;}for(const m of c.mods||[])if(m.key==='powerSet')n=m.value;return Math.max(0,n);}
  cost(c){let n=this.def(c).cost||0;for(const m of c.mods||[])if(m.key==='cost')n+=m.value;for(const {effect:e}of this.passive(c,['PassiveCostChange','AllyFieldCostChange','OpponentFieldCostChange','Passive2CostPerXTrash'])){n+=(e.PassiveCostChange||0)+(e.AllyFieldCostChange||0)+(e.OpponentFieldCostChange||0);if(e.Passive2CostPerXTrash)n-=Math.floor(this.list(c.owner,'trash').length/e.Passive2CostPerXTrash)*2;}if(c.zone==='hand')for(const a of this.actions(c)){const e=a.steps?.[0]?.effect||{};if(a.proc.Passive&&this.conditions(a.proc,c)&&this.conditions(a.steps[0].details||{},c)){n+=e.HandCostChange||0;if(e.Passive2CostPerXTrash)n-=Math.floor(this.list(c.owner,'trash').length/e.Passive2CostPerXTrash)*2;}}return Math.max(0,n);}
  counter(c){return this.def(c).counter||0;}
  flags(c){let f={};for(const {effect}of this.passive(c))Object.assign(f,effect);for(const m of c.mods||[])if(m.key==='flag')f[m.value]=true;if(f.FieldDoubleAttack)f.DoubleAttack=true;if(f.OtherCharsImmuneToNoncombatKO)f.ImmuneToNoncombat=true;if(f.LoseBlocker)f.Blocker=false;return f;}
  mod(c,key,value,until='turn'){c.mods.push({key,value,until,owner:c.owner});}
  effectStep(t){
    const c=this.s.cards[t.uid],a=t.action||this.actions(c)[t.index],step=a?.steps[t.step];if(!step){if(t.searched)this.shuffle(this.s.players[c.owner].deck);finishReplacement(this,t);return;}
    if(step.details?.SearchingDeck)t.searched=true;
    if(!this.conditions(step.details||{},c,{...t.context,previous:t.previous,revealed:t.revealed})){if(!step.details?.Required){t.step++;t.targets=[];t.group=0;this.s.queue.unshift(t)}return}
    const e={...step.effect};if(e.DonMinusToOppCount)e.DonMinus=Math.max(0,this.don(c.owner).length-this.don(1-c.owner).length);const browseZone=!!(e.StartTopDeckFromTrash||e.StartTopDeckFromOppTrash||e.StartTopDeckFromHand||e.StartTopDeckFromDeck||e.StartTopDeckFromLifeAll||e.StartTopDeckFromOppLifeAll);
    if((e.PeekSelfLife||e.PeekOppLife)&&!t.peekConfirmed){const peek=this.list(e.PeekOppLife?1-c.owner:c.owner,'life')[0];if(peek){this.ask({type:'peek',owner:c.owner,peek:peek.uid,task:t,title:'查看最上方的生命牌（查看不会改变正反面状态）'});return}}
    if(e.DonTap&&this.readyDon(c.owner).length<e.DonTap||e.RestSelf&&this.flags(c).CantRest){if(!step.details?.Required){t.step++;t.targets=[];t.group=0;delete t.prepared;this.s.queue.unshift(t)}return}
    if(step.details?.ConfirmAction&&!t.confirmed){this.ask({type:'confirmEffect',owner:c.owner,task:t,noCancel:!!step.details.NoCancel,title:`是否执行 ${this.name(c)} 的这个效果步骤？`});return}
    if(!t.prepared){
      const o=e.ForceOpponent?1-c.owner:c.owner,enemy=e.StartTopDeckOpp||e.StartTopDeckFromOppTrash||e.StartTopDeckFromOppLifeAll,owner=enemy?1-o:o;
      const from=e.StartTopDeckFromTrash||e.StartTopDeckFromOppTrash?'trash':e.StartTopDeckFromHand?'hand':e.StartTopDeckFromLife||e.StartTopDeckFromLifeAll||e.StartTopDeckFromOppLifeAll?'life':'deck';
      if(e.StartTopDeck||e.StartTopDeckOpp||e.StartTopDeckFromTrash||e.StartTopDeckFromOppTrash||e.StartTopDeckFromHand||e.StartTopDeckFromDeck||e.StartTopDeckFromLifeAll||e.StartTopDeckFromOppLifeAll){let xs=this.list(owner,from);if(e.StartTopDeck||e.StartTopDeckOpp)xs=xs.slice(0,e.StartTopDeck||e.StartTopDeckOpp);if(browseZone&&step.target?.length)xs=xs.filter(x=>step.target.some((filter,i)=>this.matchesGroup(x,step,i,c,t)));t.revealed={owner,from,uids:xs.map(x=>x.uid)};}
      t.prepared=true;
    }
    if((e.TopDeckToDeckBottom||e.TopDeckToDeckTop||e.TopDeckToLife||e.TopDeckToOppLife)&&!t.order){const remaining=(t.revealed?.uids||[]).filter(u=>this.s.cards[u].zone===t.revealed.from);if(remaining.length>1){const life=e.TopDeckToLife||e.TopDeckToOppLife;this.ask({type:'order',owner:c.owner,candidates:remaining,min:remaining.length,max:remaining.length,task:t,destination:life?'生命区':'牌库',title:life?'按从上到下的顺序点击生命牌，确认排列':'按从上到下的顺序点击剩余卡牌，确认放回牌库'});return}t.order=remaining;}
    if(e.Choices?.length&&!t.choiceDone){this.ask({type:'choice',owner:e.ForceOpponent?1-c.owner:c.owner,choices:e.Choices,task:t,title:'选择一种效果'});return}
    const ts=browseZone?[]:step.target||[];
    while(t.group<ts.length){const target=ts[t.group];let candidates=Object.values(this.s.cards).filter(x=>this.matchesGroup(x,step,t.group,c,t));if(target.AutoSelf)candidates=candidates.filter(x=>x.uid===c.uid);if(target.AutoCopyPreviousTargets)candidates=t.previous.map(u=>this.s.cards[u]);
      if(e.DeployCharacter)candidates=candidates.filter(x=>this.canDeploy(x));
      if(target.AutoSelf||target.AutoCopyPreviousTargets||target.AutoAllMatchingTargets){t.targets[t.group]=candidates.map(x=>x.uid);t.group++;continue}
      const requiredCount=e.DonMinusToOppCount?e.DonMinus:e.DonMinus||target.OverrideUITargetCount||target.TargetCount||(target.TargetCountHandOverflow?Math.max(0,this.list(c.owner,'hand').length-target.TargetCountHandOverflow):1);if(requiredCount===0){t.targets[t.group]=[];t.group++;continue}
      let max=Math.min(requiredCount,candidates.length),min=step.details?.FullTargetsRequired?.includes(t.group)?requiredCount:0;
      if(target.NoDuplicateNames)max=Math.min(max,new Set(candidates.map(x=>this.rule(x).characterName)).size);if(max<min)return;if(!candidates.length){t.targets[t.group]=[];t.group++;continue}
      this.ask({type:'targets',owner:e.ForceOpponent?1-c.owner:c.owner,candidates:candidates.map(x=>x.uid),min,max,group:t.group,task:t,cancelAllowed:!step.details?.NoCancel&&!(t.group>0&&step.details?.FullTargetsRequired?.includes(t.group)),title:`${this.name(c)}：选择${min?min:'最多 '+max}张目标`});return;
    }
    if(e.BuffCombatXPerPrevTargets)e.BuffCombatPower=e.BuffCombatXPerPrevTargets*(t.previous?.length||0);
    if(e.BuffXPerPrevTargets)e.BuffPower=e.BuffXPerPrevTargets*(t.previous?.length||0);
    if(a.proc.OncePerTurn)c.used[t.index]=this.s.turn;
    this.applyEffects(e,c,t.targets.flat().map(u=>this.s.cards[u]),t);if(a.steps[t.step+1]?.target?.some(x=>x.NoDuplicateNames))t.previousNames=[...new Set([...(t.previousNames||[]),...t.targets.flat().map(u=>this.rule(this.s.cards[u]).characterName)])];t.previous=t.targets.flat();t.step++;t.group=0;t.targets=[];delete t.choiceDone;delete t.confirmed;delete t.prepared;delete t.order;delete t.peekConfirmed;if(!step.details?.EndAfterStep)this.s.queue.unshift(t);else finishReplacement(this,t);
  }
  applyEffects(e,c,targets,t){
    const o=e.ForceOpponent?1-c.owner:c.owner;
    if(e.QueueUpEndOfTurnAction&&c.owner===this.s.active){const index=e.QueueUpEndOfTurnAction,action=this.actions(c)[index];assert(action?.proc.QueuedEndOfTurn,'延迟效果索引无效');this.s.endings??=[];this.s.endings.push({id:`ending-${++this.serial}`,owner:c.owner,turn:this.s.turn,uid:c.uid,index,action:clone(action),incarnation:c.incarnation||0});this.log(`${this.name(c)}：已登记本回合结束时结算的效果`);}
    if(e.DonTap)this.pay(o,e.DonTap);
    if(e.SaveTargetCount)t.savedTargetCount=targets.length;
    if(e.SaveHandSize)t.savedHandSize=this.list(o,'hand').length;
    if(e.DrawSavedCount)this.draw(o,t.savedTargetCount??t.savedHandSize??0);
    if(e.RestSelf){assert(!c.rested,'该卡已横置');c.rested=true;this.emit('OnRest',c,{owner:c.owner})}
    if(e.TrashSelf)this.move(c,'trash');
    if(e.DonMinus){assert(this.don(o).length>=e.DonMinus,'DON!! 不足以支付费用');let ds=targets.filter(x=>x.zone==='don'&&x.owner===o);if(!ds.length)ds=[...this.restDon(o),...this.readyDon(o),...this.don(o).filter(x=>x.attached)];assert(ds.length>=e.DonMinus,'请选择足够的DON!!');for(const d of ds.slice(0,e.DonMinus)){delete d.attached;this.move(d,'donReserve')}this.emit('MyDonIsReturned',c,{owner:o});}
    if(e.OptionalReturnDon){const ds=targets.filter(x=>x.zone==='don'&&x.owner===o);for(const d of ds){delete d.attached;this.move(d,'donReserve')}if(ds.length)this.emit('MyDonIsReturned',c,{owner:o});}
    if(e.DrawCards)this.draw(o,e.DrawCards);
    if(e.AllCharsEffectImmune)for(const x of this.list(o,'field'))this.mod(x,'flag','ImmuneToOpponentNoncombat','oppEnd');
    if(e.ActivateMainOfCard)for(const x of targets){const i=this.actions(x).findIndex(a=>a.proc.ActivateMain);if(i>=0)this.s.queue.unshift({kind:'effect',uid:x.uid,index:i,step:0,group:0,targets:[],previous:[],context:{copied:true}});}
    if(e.TurnEndActivateDon){this.s.donActivations??=[];this.s.donActivations.push({owner:o,turn:this.s.turn,count:e.TurnEndActivateDon});this.log(`${this.name(c)}：将在回合结束时激活 ${e.TurnEndActivateDon} 张 DON!!`);}
    if(e.DealDamage)this.s.queue.push({kind:'damage',owner:1-o});
    if(e.NoTakeLifeToTurnStart){this.s.noTakeLife??={};this.s.noTakeLife[o]=true;}
    if(e.CantActivateDonToTurnEnd){this.s.noActivateDon??={};this.s.noActivateDon[o]=true;}if(e.CantPlayAnyCharactersToField){this.s.noPlayCharacters??={};this.s.noPlayCharacters[o]=true;}
    if(e.CantPlayOriginalCostOrMore){this.s.noPlayOriginalCost??={};this.s.noPlayOriginalCost[o]=Math.min(this.s.noPlayOriginalCost[o]??Infinity,e.CantPlayOriginalCostOrMore);}
    if(e.OppTrashRandom){const xs=this.shuffle(this.list(1-o,'hand').slice()).slice(0,e.OppTrashRandom);for(const x of xs)this.move(x,'trash');this.log(`${this.label(1-o)} 随机丢弃 ${xs.length} 张手牌`);}
    if(e.GainActiveDon||e.GainRestedDon){const n=e.GainActiveDon||e.GainRestedDon;for(const d of this.list(o,'donReserve').slice(0,n))this.move(d,'don',{rested:!!e.GainRestedDon});}
    if(e.MillDeck)for(const x of this.list(o,'deck').slice(0,e.MillDeck))this.move(x,'trash');
    if(e.Heal)for(const x of this.list(o,'deck').slice(0,e.Heal))this.move(x,'life',{faceUp:!!e.ForcedFaceUp});
    if(e.TakeTopLife||e.TakeBottomLife){const ls=this.list(o,'life');if(e.TakeBottomLife)ls.reverse();for(const x of ls.slice(0,e.TakeTopLife||e.TakeBottomLife))this.move(x,'hand');}
    if(e.TrashTopLife||e.TrashBottomLife){const ls=this.list(o,'life');if(e.TrashBottomLife)ls.reverse();for(const x of ls.slice(0,e.TrashTopLife||e.TrashBottomLife))this.move(x,'trash');}
    if(e.TrashLifeTo!==undefined)while(this.list(o,'life').length>e.TrashLifeTo)this.move(this.list(o,'life')[0],'trash');
    if(e.DeploySelf)this.deploy(c,!!e.DeploysRested);
    if(e.TrashAllFaceUpLife)for(const x of this.list(o,'life').filter(x=>x.faceUp))this.move(x,'trash');
    if(e.TopDeckToLife||e.TopDeckToOppLife){const lifeOwner=e.TopDeckToOppLife?1-o:o;for(const u of [...(t.order||t.revealed?.uids||[])].reverse()){const x=this.s.cards[u];if(x.zone==='life'&&x.owner===lifeOwner)this.move(x,'life',{faceUp:x.faceUp});}this.log(`${this.label(lifeOwner)} 重新排列生命牌`);}
    if(e.TrashOppLife)for(const x of this.list(1-o,'life').slice(0,e.TrashOppLife))this.move(x,'trash');
    if(e.OppTakeLife)for(const x of this.list(1-o,'life').slice(0,e.OppTakeLife))this.move(x,'hand');
    if(e.FlipTopLifeUp&&this.list(o,'life')[0])this.list(o,'life')[0].faceUp=true;
    if(e.FlipTopLifeDown&&this.list(o,'life')[0])this.list(o,'life')[0].faceUp=false;
    if(e.SendTopLifeToBot&&this.list(o,'life')[0]){const top=this.list(o,'life')[0];this.move(top,'life',{bottom:true,faceUp:top.faceUp});}
    if(e.SendOppTopLifeToBot&&this.list(1-o,'life')[0]){const top=this.list(1-o,'life')[0];this.move(top,'life',{bottom:true,faceUp:top.faceUp});}
    const removalGroup=`effect-removal-${++this.serial}`;
    if(e.TransferDon){const donor=targets.find(x=>x.zone==='don'&&x.owner===o&&x.attached),recipient=targets.find(x=>x.owner===o&&['leader','field'].includes(x.zone));if(donor&&recipient){donor.attached=recipient.uid;this.log(`${this.name(c)}：转移 1 张 DON!!`);}}
    if(e.MatchOpponentPowerUntilTurnEnd&&targets[0])this.mod(c,'basePower',this.power(targets[0]),'ownerEnd');
    if(e.MatchLeaderToBasePowerUntilTurnEnd)for(const x of targets)this.mod(x,'basePower',this.basePower(this.list(c.owner,'leader')[0]));
    if(e.SwapBasePower&&targets.length>=2){const [a,b]=targets,[ap,bp]=[this.basePower(a),this.basePower(b)];this.mod(a,'basePower',bp);this.mod(b,'basePower',ap);}
    if(e.SwapBasePowerWithLeader&&targets[0]){const leader=this.list(c.owner,'leader')[0],x=targets[0],[lp,xp]=[this.basePower(leader),this.basePower(x)];this.mod(leader,'basePower',xp);this.mod(x,'basePower',lp);}
    for(const x of targets){
      for(const[k,until]of [['BuffPower','turn'],['BuffPowerToOppEnd','oppEnd'],['BuffPowerToOwnersEnd','ownerEnd'],['BuffPowerToOwnersStart','ownerStart'],['BuffCombatPower','battle']])if(e[k])this.mod(x,'power',e[k],until);
      if(e.SetBasePower)this.mod(x,'basePower',e.SetBasePower);if(e.SetPowerToZero)this.mod(x,'powerSet',0);if(e.SetBasePowerToZero)this.mod(x,'basePower',0);if(e.ChangeCost)this.mod(x,'cost',e.ChangeCost);if(e.ChangeCostToOppEnd)this.mod(x,'cost',e.ChangeCostToOppEnd,'oppEnd');
      if(e.SetBasePowerToOppEnd)this.mod(x,'basePower',e.SetBasePowerToOppEnd,'oppEnd');
      if(e.Silence)this.mod(x,'flag','Silence');if(e.SilenceToOwnersEnd)this.mod(x,'flag','Silence','ownerEnd');if(e.GainBlockerToOppEnd)this.mod(x,'flag','Blocker','oppEnd');
      for(const[k,flag]of Object.entries({GainRush:'Rush',GainRushCharacters:'RushCharacters',GainBlocker:'Blocker',GainDoubleAttack:'DoubleAttack',GainBanish:'Banish',GainUnblockable:'Unblockable',GainCanAttackActive:'CanAttackActive',CantAttack:'CantAttack',CantRest:'CantRest',GainImmune:'ImmuneToNoncombat',LoseBlocker:'LoseBlocker'}))if(e[k])this.mod(x,'flag',flag);
      if(e.GainCombatImmuneToStart)this.mod(x,'flag','ImmuneToBattle','ownerStart');if(e.Activate&&!(x.zone==='don'&&this.s.noActivateDon?.[x.owner]&&this.def(c).type==='角色'))x.rested=false;if(e.Rest&&!x.rested&&!this.flags(x).ImmuneToRest){x.rested=true;this.emit('OnRest',x,{owner:x.owner})}if(e.Freeze)x.freeze=true;if(e.FlipLifeDown)x.faceUp=false;
      if(e.BecomeDefenderCharacter&&this.s.battle&&['leader','field'].includes(x.zone)){this.s.battle.target=x.uid;this.s.battle.blocked=true;this.log(`${this.name(x)} 成为攻击目标`);}
      if(e.AttachRestedDon||e.AttachActiveDon){const ds=e.AttachRestedDon?this.restDon(o):this.readyDon(o);if(ds[0])ds[0].attached=x.uid;}
      const group=removalGroup,options={source:c,group};
      if(e.KOCard)this.remove(x,'trash',false,c,group);if(e.TrashCard)enqueueRemoval(this,x,'trash',{...options,type:'Trash'});if(e.SendToHand)enqueueRemoval(this,x,'hand',{...options,type:'Bounce'});if(e.SendToDeckBottom)enqueueRemoval(this,x,'deck',{...options,type:'DeckBottom',bottom:true});if(e.SendToDeckTop)enqueueRemoval(this,x,'deck',{...options,type:'DeckTop'});if(e.SendToTopLife)enqueueRemoval(this,x,'life',{...options,type:'TopLife',faceUp:!!e.ForcedFaceUp});if(e.SendToBottomLife)enqueueRemoval(this,x,'life',{...options,type:'BottomLife',bottom:true,faceUp:!!e.ForcedFaceUp});if(e.DeployCharacter)this.deploy(x,!!e.DeploysRested);
    }
    if(e.TopDeckToDeckBottom||e.TopDeckToDeckTop||e.TrashTopDeck){let xs=(t.order||t.revealed?.uids||[]).map(u=>this.s.cards[u]).filter(x=>x.zone===t.revealed?.from);if(e.TopDeckToDeckTop)xs.reverse();for(const x of xs)this.move(x,e.TrashTopDeck?'trash':'deck',{bottom:!!e.TopDeckToDeckBottom});}
    if(e.ShuffleDeck)this.shuffle(this.s.players[o].deck);if(e.WinTheGame)this.win(o,'卡牌效果');if(e.LoseTheGame)this.win(1-o,'卡牌效果');
  }
}
