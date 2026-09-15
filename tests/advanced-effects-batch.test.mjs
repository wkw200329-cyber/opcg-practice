import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
const cards=read('cards'),rules=read('rules'),decks=read('decks');
function game(){const e=new Engine(cards,rules,{seed:42});e.start(['ST01','ST02'].map(n=>decks.find(d=>d.name.startsWith(n))));e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});e.s.players[0].turns=2;e.s.players[1].turns=2;return e;}
test('attack lock directs every attack to the rested named source and lifts when it is active or gone',()=>{
 const e=game(),attacker=e.card('ST01-003',0,'field'),leader=e.list(1,'leader')[0],other=e.card('ST02-003',1,'field'),lock=e.card('P-067',1,'field');
 attacker.joined=-1;lock.rested=true;assert.match(e.attackReason(attacker,leader),/必须攻击/);assert.match(e.attackReason(attacker,other),/必须攻击/);assert.equal(e.attackReason(attacker,lock),'');
 lock.rested=false;assert.equal(e.attackReason(attacker,leader),'');lock.rested=true;e.move(lock,'trash');assert.equal(e.attackReason(attacker,leader),'');
});
test('multiple attack locks allow either named source and never permit a leader target',()=>{
 const e=game(),attacker=e.card('ST01-003',0,'field'),leader=e.list(1,'leader')[0],a=e.card('P-067',1,'field'),b=e.card('P-067',1,'field');
 attacker.joined=-1;a.rested=b.rested=true;assert.match(e.attackReason(attacker,leader),/必须攻击/);assert.equal(e.attackReason(attacker,a),'');assert.equal(e.attackReason(attacker,b),'');
});
test('field effect-KO immunity lasts through the opponent end, blocks only opposing effects, and permits combat and own KO',()=>{
 const e=game(),source=e.list(0,'leader')[0],ally=e.card('ST01-003',0,'field'),enemy=e.card('ST02-003',1,'field');
 e.applyEffects({AllCharsEffectImmune:true},source,[],{});assert.equal(e.flags(ally).ImmuneToOpponentNoncombat,true);
 e.remove(ally,'trash',false,enemy);e.pump();assert.equal(ally.zone,'field');
 e.remove(ally,'trash',false,source);e.pump();assert.equal(ally.zone,'trash');
 const combat=e.card('ST01-003',0,'field');e.remove(combat,'trash',true,enemy);e.pump();assert.equal(combat.zone,'trash');
 const later=e.card('ST01-003',0,'field');assert.equal(e.flags(later).ImmuneToOpponentNoncombat,undefined);const protectedCard=e.card('ST01-003',0,'field');e.applyEffects({AllCharsEffectImmune:true},source,[],{});e.s.active=0;e.task({kind:'finishTurn'});assert.equal(e.flags(protectedCard).ImmuneToOpponentNoncombat,true);e.task({kind:'finishTurn'});assert.equal(e.flags(protectedCard).ImmuneToOpponentNoncombat,undefined);
});
test('a chosen event main action is queued without charging its printed cost and excludes cards without main actions',()=>{
 const e=game(),source=e.list(0,'leader')[0],event=e.card('ST01-016',0,'hand'),counter=e.card('ST01-015',0,'hand');
 e.rules={...e.rules,[event.id]:{...e.rule(event),actionV3s:[{proc:{ActivateMain:true},steps:[{effect:{DrawCards:1}}]}]},[counter.id]:{...e.rule(counter),actionV3s:[{proc:{Counter:true},steps:[{effect:{BuffCombatPower:2000}}]}]}};
 assert.equal(e.matches(event,{HandCard:true,FriendlyOnly:true,OnlyTypes:['Event'],HasActivateMain:true},source,{}),true);assert.equal(e.matches(counter,{HandCard:true,FriendlyOnly:true,OnlyTypes:['Event'],HasActivateMain:true},source,{}),false);
 const before=e.list(0,'hand').length;e.applyEffects({ActivateMainOfCard:true},source,[event],{});e.pump();assert.equal(e.list(0,'hand').length,before+1);assert.equal(event.zone,'hand');
});
test('activating an event found in trash uses its main steps without moving or paying it first',()=>{
 const e=game(),source=e.list(0,'leader')[0],event=e.card('ST01-016',0,'trash');
 e.rules={...e.rules,[event.id]:{...e.rule(event),actionV3s:[{proc:{ActivateMain:true},steps:[{effect:{DrawCards:1}}]}]}};const before=e.list(0,'hand').length;
 e.applyEffects({ActivateMainOfCard:true},source,[event],{});e.pump();assert.equal(event.zone,'trash');assert.equal(e.list(0,'hand').length,before+1);
});
