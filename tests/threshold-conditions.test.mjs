import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
const cards=read('cards'),rules=read('rules'),decks=read('decks');
function game(){const e=new Engine(cards,rules,{seed:11});e.start(['ST01','ST02'].map(n=>decks.find(d=>d.name.startsWith(n))));e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});return e;}
test('category, power, cost, board and leader color thresholds inspect the correct side',()=>{
 const e=game(),source=e.list(0,'leader')[0],mine=e.card('ST01-003',0,'field'),enemy=e.card('ST02-003',1,'field');
 e.rules={...e.rules,[mine.id]:{...e.rule(mine),cardCategories:['Crew'],cardColors:['Red']},[source.id]:{...e.rule(source),cardColors:['Red']}};e.db={...e.db,[mine.id]:{...e.def(mine),power:6000,cost:5}};
 assert.equal(e.conditions({CharacterPowerXOrMore:6000},source),true);
 assert.equal(e.conditions({CharacterCategoryXPowerOrMore:{eCategory:'Crew',iCount:6000}},source),true);
 assert.equal(e.conditions({CharacterCategoryXCostOrMore:{eCategory:'Crew',iCount:5}},source),true);
 assert.equal(e.conditions({CostXOrHigherCharacterCategory:{eCategory:'Crew',iCount:5}},source),true);
 assert.equal(e.conditions({OppXMoreOrMoreCharacters:1},source),true);
 assert.equal(e.conditions({BoardLessThanCostX:2},source),true);
 assert.equal(e.conditions({ACOCColorReq:['Red']},source),true);
 assert.equal(e.conditions({OppXMoreOrMoreCharacters:2},source),false);
 assert.equal(enemy.zone,'field');
});
test('discarding a hand card raises the controller-only discard timing',()=>{
 const e=game(),source=e.list(0,'leader')[0],hand=e.list(0,'hand')[0];
 assert.equal(e.conditions({HandSentToTrashMyEffect:true},source,{}),false);
 e.rules={...e.rules,[source.id]:{...e.rule(source),actionV3s:[{proc:{HandSentToTrashMyEffect:true},steps:[]}]}};
 e.applyEffects({TrashCard:true},source,[hand],{targets:[]});
 assert.equal(e.s.events.some(x=>x.context?.handTrashed?.uid===hand.uid),true);
});
test('life moves expose their destination timing and hand visibility can be toggled',()=>{
 const e=game(),source=e.list(0,'leader')[0],life=e.list(0,'life')[0];
 e.rules={...e.rules,[source.id]:{...e.rule(source),actionV3s:[{proc:{LifeSentToHand:true},steps:[]}]}};
 e.move(life,'hand');
 assert.equal(e.s.events.some(x=>x.context?.lifeSent?.destination==='hand'),true);
 e.applyEffects({RevealOppHand:true},source,[],{targets:[]});assert.equal(e.s.revealedHands[1],true);
 e.applyEffects({HideOppHand:true},source,[],{targets:[]});assert.equal(e.s.revealedHands?.[1],undefined);
});
test('effect protection, tenacity and confusion create scoped combat flags',()=>{
 const e=game(),source=e.list(0,'leader')[0],target=e.card('ST01-003',0,'field');
 e.applyEffects({EffectImmune:true,FieldGainsTenacity:true,GainConfusion:true},source,[target],{targets:[]});
 assert.equal(e.flags(target).ImmuneToNoncombat,true);assert.equal(e.flags(target).ImmuneToBattle,true);assert.equal(e.flags(target).CantAttack,true);
});
