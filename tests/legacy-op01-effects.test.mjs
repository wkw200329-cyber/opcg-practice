import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';

const read=file=>JSON.parse(readFileSync(new URL(`../dist/data/${file}`,import.meta.url),'utf8'));
const cards=read('cards.json'),rules=read('rules.json'),decks=read('decks.json');
const starter=name=>decks.find(deck=>deck.name.startsWith(name));
const game=()=>{const e=new Engine(cards,rules,{seed:29});e.start([starter('ST01'),starter('ST02')]);e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});return e;};
const give=(e,id,zone='field',owner=0)=>e.card(id,owner,zone);
const attach=(e,c)=>{const d=e.don(c.owner)[0];d.attached=c.uid;return d;};

test('OP01-060 exposes the top card, deploys only an eligible Warlord rested, then bottoms the remainder',()=>{
  const e=game(),c=give(e,'OP01-060');
  const a=e.actions(c)[0];
  assert.deepEqual(a.steps.map(s=>s.effect),[{DonTap:1},{StartTopDeck:1},{DeployCharacter:true,DeploysRested:true},{TopDeckToDeckBottom:true}]);
  assert.equal(a.steps[2].target[0].TopDeckCard,true);
  assert.equal(a.steps[2].target[0].CostOrLess,4);
  assert.deepEqual(a.steps[2].target[0].OnlyCategories,['SevenWarlords']);
});

test('OP01-063 requires an Event in the opposing hand before its life-bottom action is available',()=>{
  const e=game(),c=give(e,'OP01-063'),action=e.actions(c)[0];
  attach(e,c);
  for(const x of e.list(1,'hand').slice())e.move(x,'trash');
  assert.equal(e.conditions(action.proc,c),false);
  give(e,'ST01-016','hand',1);
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(action.steps[1].effect.SendOppTopLifeToBot,true);
});

test('OP01-067 gives banish and reduces only blue Event cards in hand while DON is attached',()=>{
  const e=game(),c=give(e,'OP01-067'),blueEvent=give(e,'OP01-088','hand'),redCharacter=give(e,'ST01-003','hand');
  const base=e.def(blueEvent).cost;
  assert.equal(e.flags(c).Banish,true);
  assert.equal(e.cost(blueEvent),base);
  attach(e,c);
  assert.equal(e.cost(blueEvent),base-1);
  assert.equal(e.cost(redCharacter),e.def(redCharacter).cost);
});

test('OP01-072 gains 1000 power for every card in its controller hand during that controller turn',()=>{
  const e=game(),c=give(e,'OP01-072');
  attach(e,c);
  const hand=e.list(0,'hand').length;
  assert.equal(e.power(c),e.def(c).power+1000+hand*1000);
  e.s.active=1;
  assert.equal(e.power(c),e.def(c).power);
});

test('OP01-024 attaches up to two rested DON and gains Strike immunity only with two attached DON',()=>{
  const e=game(),c=give(e,'OP01-024');
  e.card('DON',0,'don').rested=true;
  e.card('DON',0,'don').rested=true;
  e.applyEffects({AttachRestedDon:2},c,[c],{});
  assert.equal(e.attached(c).length,2);
  assert.deepEqual(e.flags(c).ImmuneToStrikes,['Strike']);
  delete e.attached(c)[0].attached;
  assert.equal(e.flags(c).ImmuneToStrikes,undefined);
});

test('OP01-112 returns one DON and lets its character attack active targets for the turn',()=>{
  const e=game(),c=give(e,'OP01-112');
  const action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.DonMinus,1);
  assert.equal(action.steps[1].effect.GainCanAttackActive,true);
});

test('OP01-083 counts every two Events in trash for its attached-DON power bonus',()=>{
  const e=game(),c=give(e,'OP01-083');
  e.list(0,'leader')[0].id='OP01-062'; // Crocodile is a Baroque Works leader.
  attach(e,c);
  e.card('OP01-088',0,'trash');
  e.card('OP01-088',0,'trash');
  assert.equal(e.power(c),e.def(c).power+1000+1000);
});

test('OP01-091 applies its 10-DON debuff only to opposing characters on its controller turn',()=>{
  const e=game(),c=give(e,'OP01-091'),enemy=e.card('ST02-003',1,'field');
  for(let i=e.don(0).length;i<10;i++)e.card('DON',0,'don');
  assert.equal(e.power(enemy),e.def(enemy).power-1000);
  e.s.active=1;
  assert.equal(e.power(enemy),e.def(enemy).power);
});

test('OP01-094 selects every other character for its six-DON on-play KO',()=>{
  const e=game(),c=give(e,'OP01-094'),ally=e.card('ST01-003',0,'field'),enemy=e.card('ST02-003',1,'field');
  e.list(0,'leader')[0].id='ST04-001';
  const target=e.actions(c)[0].steps[0].target[0];
  assert.equal(target.AutoAllMatchingTargets,true);
  assert.equal(e.matchesGroup(ally,{target:[target]},0,c,{}),true);
  assert.equal(e.matchesGroup(enemy,{target:[target]},0,c,{}),true);
  assert.equal(e.matchesGroup(c,{target:[target]},0,c,{}),false);
});

test('OP01-120 has permanent Rush through its passive action',()=>{
  const e=game(),c=give(e,'OP01-120');
  assert.equal(e.flags(c).Rush,true);
});

test('OP02-051 draws only up to three cards in hand before offering a blue Impel Down character',()=>{
  const e=game(),c=give(e,'OP02-051'),candidate=e.card('OP02-050',0,'hand');
  while(e.list(0,'hand').length>2)e.move(e.list(0,'hand')[0],'trash');
  const action=e.actions(c)[0];
  assert.equal(e.conditions(action.proc,c),true);
  e.applyEffects(action.steps[0].effect,c,[],{});
  assert.equal(e.list(0,'hand').length,3);
  assert.equal(e.matchesGroup(candidate,action.steps[1],0,c,{}),true);
});

test('OP02-102 protects itself from effects and gains combat power when a zero-cost card exists',()=>{
  const e=game(),c=give(e,'OP02-102');
  assert.equal(e.flags(c).ImmuneToNoncombat,true);
  const zero=e.card('ST01-003',0,'field');
  e.mod(zero,'cost',-e.def(zero).cost);
  assert.equal(e.conditions(e.actions(c)[1].proc,c),true);
});

test('OP02-120 gives every friendly character 1000 power through the opponent turn start',()=>{
  const e=game(),c=give(e,'OP02-120'),ally=e.card('ST02-003',0,'field'),action=e.actions(c)[0];
  e.applyEffects(action.steps[0].effect,c,[ally],{});
  assert.equal(e.power(ally),e.def(ally).power+1000);
});

test('OP03-004 cannot attack leaders but receives Rush while it has attached DON',()=>{
  const e=game(),c=give(e,'OP03-004'),leader=e.list(1,'leader')[0];
  e.s.players[0].turns=2;
  assert.match(e.attackReason(c,leader),/不能攻击领袖/);
  attach(e,c);
  assert.equal(e.flags(c).Rush,true);
});

test('OP03-005 queues its own trash at the end of the turn after gaining power',()=>{
  const e=game(),c=give(e,'OP03-005'),actions=e.actions(c);
  assert.equal(actions[0].steps[0].effect.QueueUpEndOfTurnAction,1);
  assert.equal(actions[1].proc.QueuedEndOfTurn,true);
  assert.equal(actions[1].steps[0].effect.TrashSelf,true);
});
