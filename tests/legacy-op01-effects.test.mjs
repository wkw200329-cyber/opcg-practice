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
