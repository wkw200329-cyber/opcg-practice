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

test('ST02-003 Urouge gains power only with attached DON and three friendly characters',()=>{
  const e=game(),urouge=e.card('ST02-003',1,'field');
  e.card('ST02-004',1,'field');e.card('ST02-006',1,'field');
  const don=e.list(1,'donReserve')[0];e.move(don,'don');don.attached=urouge.uid;
  e.s.active=1;
  assert.equal(e.power(urouge),6000);
  e.move(e.list(1,'field').find(c=>c!==urouge),'trash');
  assert.equal(e.power(urouge),4000);
});

test('ST02-005 Killer KOs only a rested opposing character costing three or less on play',()=>{
  const e=game(),killer=e.card('ST02-005',1,'hand'),small=e.card('ST01-003',0,'field'),large=e.card('ST02-014',0,'field');
  small.rested=true;large.rested=true;e.s.active=1;e.s.players[1].turns=2;
  for(const don of e.list(1,'donReserve').slice(0,3))e.move(don,'don');
  e.dispatch({type:'play',uid:killer.uid});
  assert.deepEqual(e.s.prompt.candidates,[small.uid]);
  e.dispatch({type:'choose',uids:[small.uid]});
  assert.equal(small.zone,'trash');assert.equal(large.zone,'field');
});

test('ST02-007 Bonney rests itself and one DON, takes one Supernovas card from the top five, then bottoms the rest',()=>{
  const e=game(),bonney=e.card('ST02-007',1,'field'),supernova=e.card('ST02-003',1,'deck');
  e.move(supernova,'deck');e.s.active=1;e.s.players[1].turns=2;
  const don=e.list(1,'donReserve')[0];e.move(don,'don');
  e.dispatch({type:'activate',uid:bonney.uid,index:0});
  assert.equal(bonney.rested,true);assert.equal(don.rested,true);assert.ok(e.s.prompt.candidates.includes(supernova.uid));
  e.dispatch({type:'choose',uids:[supernova.uid]});
  if(e.s.prompt?.type==='order')e.dispatch({type:'choose',uids:e.s.prompt.candidates});
  assert.equal(supernova.zone,'hand');
});

test('ST02-008 Apoo rests one active opposing DON when it attacks with DON attached',()=>{
  const e=game(),apoo=e.card('ST02-008',1,'field'),target=e.list(0,'leader')[0];
  apoo.joined=e.s.turn-1;e.s.active=1;e.s.players[1].turns=2;
  const mine=e.list(1,'donReserve')[0],enemy=e.list(0,'donReserve')[0];e.move(mine,'don');mine.attached=apoo.uid;e.move(enemy,'don');
  e.dispatch({type:'attack',uid:apoo.uid,target:target.uid});
  assert.ok(e.s.prompt.candidates.includes(enemy.uid));
  e.dispatch({type:'choose',uids:[enemy.uid]});
  assert.equal(enemy.rested,true);
});

test('ST02-009 Law reactivates one rested friendly Supernovas or Heart Pirates character costing five or less',()=>{
  const e=game(),law=e.card('ST02-009',1,'hand'),eligible=e.card('ST02-003',1,'field'),tooLarge=e.card('ST02-013',1,'field');
  eligible.rested=true;tooLarge.rested=true;e.s.active=1;e.s.players[1].turns=2;
  for(const don of e.list(1,'donReserve').slice(0,5))e.move(don,'don');
  e.dispatch({type:'play',uid:law.uid});
  assert.deepEqual(e.s.prompt.candidates,[eligible.uid]);
  e.dispatch({type:'choose',uids:[eligible.uid]});
  assert.equal(eligible.rested,false);assert.equal(tooLarge.rested,true);
});

test('ST02-017 Straw Sword rests one active opposing character and pays exactly two DON',()=>{
  const e=game(),sword=e.card('ST02-017',1,'hand'),enemy=e.card('ST01-003',0,'field');
  e.s.active=1;e.s.players[1].turns=2;for(const don of e.list(1,'donReserve').slice(0,2))e.move(don,'don');
  e.dispatch({type:'play',uid:sword.uid});
  assert.deepEqual(e.s.prompt.candidates,[enemy.uid]);
  e.dispatch({type:'choose',uids:[enemy.uid]});
  assert.equal(sword.zone,'trash');assert.equal(enemy.rested,true);assert.equal(e.restDon(1).length,2);
});
