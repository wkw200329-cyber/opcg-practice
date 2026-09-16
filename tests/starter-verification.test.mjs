import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';

const read=file=>JSON.parse(readFileSync(new URL(`../dist/data/${file}`,import.meta.url),'utf8'));
const cards=read('cards.json'),rules=read('rules.json'),decks=read('decks.json');
const starter=name=>decks.find(deck=>deck.name.startsWith(name));
const game=()=>{const e=new Engine(cards,rules,{seed:71});e.start([starter('ST01'),starter('ST02')]);e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});return e;};

test('ST01-007 Nami attaches exactly one rested DON to a chosen friendly leader or character',()=>{
  const e=game(),nami=e.card('ST01-007',0,'field'),leader=e.list(0,'leader')[0],don=e.don(0)[0];don.rested=true;
  e.dispatch({type:'activate',uid:nami.uid,index:0});
  assert.equal(e.s.prompt.type,'targets');
  e.dispatch({type:'choose',uids:[leader.uid]});
  assert.equal(don.attached,leader.uid);
  assert.equal(don.rested,true);
  assert.equal(nami.used[0],e.s.turn);
});

test('ST02-001 Kid requires one hand discard and three DON before it reactivates itself',()=>{
  const e=game(),leader=e.list(1,'leader')[0],discard=e.list(1,'hand')[0];
  e.s.active=1;e.s.players[1].turns=2;leader.rested=true;
  for(const d of e.list(1,'donReserve').slice(0,3))e.move(d,'don');
  e.dispatch({type:'activate',uid:leader.uid,index:0});
  assert.equal(e.s.prompt.type,'targets');
  e.dispatch({type:'choose',uids:[discard.uid]});
  assert.equal(discard.zone,'trash');
  assert.equal(leader.rested,false);
  assert.equal(e.restDon(1).length,3);
});
