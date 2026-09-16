import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';

const read=file=>JSON.parse(readFileSync(new URL(`../dist/data/${file}`,import.meta.url),'utf8'));
const cards=read('cards.json'),rules=read('rules.json'),decks=read('decks.json');
const starter=name=>decks.find(deck=>deck.name.startsWith(name));
const game=()=>{const e=new Engine(cards,rules,{seed:41});e.start([starter('ST01'),starter('ST02')]);e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});return e;};

test('the active player chooses the next resolution when two effects trigger at the same timing',()=>{
  const e=game(),attacker=e.card('ST01-003',0,'field'),first=e.card('ST02-003',1,'field'),second=e.card('ST02-005',1,'field');
  const action=id=>({actionV3s:[{proc:{OnOpponentAttack:true,OncePerTurn:true},steps:[{effect:{Choices:[{ButtonText:'first',JumpToStep:1}]}},{effect:{DrawCards:1}}]}]});
  e.rules={...e.rules,[first.id]:action(first.id),[second.id]:action(second.id)};
  e.s.active=0;
  e.emit('OnOpponentAttack',attacker,{owner:1,attacker:attacker.uid});e.pump();
  assert.equal(e.s.prompt.type,'triggerOrder');
  assert.deepEqual(e.s.prompt.entries.map(x=>x.uid),[first.uid,second.uid]);
  e.dispatch({type:'choose',value:'1'});
  assert.equal(e.s.prompt.type,'choice');
  assert.equal(e.s.prompt.task.uid,second.uid);
});

test('after one simultaneous trigger resolves, the remaining trigger still resolves',()=>{
  const e=game(),attacker=e.card('ST01-003',0,'field'),first=e.card('ST02-003',1,'field'),second=e.card('ST02-005',1,'field');
  const action={actionV3s:[{proc:{OnOpponentAttack:true,OncePerTurn:true},steps:[{effect:{DrawCards:1}}]}]};
  e.rules={...e.rules,[first.id]:action,[second.id]:action};
  e.s.active=0;const before=e.list(1,'hand').length;
  e.emit('OnOpponentAttack',attacker,{owner:1,attacker:attacker.uid});e.pump();
  assert.equal(e.s.prompt.type,'triggerOrder');
  e.dispatch({type:'choose',value:'0'});
  assert.equal(e.list(1,'hand').length,before+2);
  assert.equal(first.used[0],e.s.turn);
  assert.equal(second.used[0],e.s.turn);
});
