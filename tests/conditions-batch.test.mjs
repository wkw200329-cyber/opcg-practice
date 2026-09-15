import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
const cards=read('cards'),rules=read('rules'),decks=read('decks');
function game(){const e=new Engine(cards,rules,{seed:42});e.start(['ST01','ST02'].map(n=>decks.find(d=>d.name.startsWith(n))));e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});return e;}
function body(e,owner,power){const c=e.card('ST01-003',owner,'field');e.db={...e.db,[c.id]:{...e.db[c.id],power}};return c;}
for(const [key,owner,count,includesLeader,absent] of [
 ['SelfNoCharBaseXOrMore',0,1,false,true],['NoBaseXOrMore',1,1,false,true],
 ['OppAnyBaseXOrMore',1,1,true,false],['Opp2CharsBaseXOrMore',1,2,false,false],
 ['OppCharBaseXOrMore',1,1,false,false],['SelfAnyBaseXOrMore',0,1,false,false],
 ['CharacterBasePowerXOrMore',0,1,false,false],['TwoCharacterBasePowerX',0,2,false,false],
 ['TwoCharacterBasePowerXOrMore',0,2,false,false]
])test(key+' observes owner, character count, printed threshold and departure',()=>{
 const e=game(),source=e.list(0,'leader')[0],check=()=>e.conditions({[key]:6000},source);
 assert.equal(check(),absent);const leader=e.list(owner,'leader')[0];e.db={...e.db,[leader.id]:{...e.db[leader.id],power:6000}};
 assert.equal(check(),includesLeader?!absent:absent);e.db[leader.id]={...e.db[leader.id],power:5000};
 const units=Array.from({length:count},()=>body(e,owner,5999));e.mod(units[0],'power',9000);assert.equal(check(),absent);
 e.db[units[0].id]={...e.db[units[0].id],power:6000};assert.equal(check(),!absent);
 e.move(units[0],'trash');assert.equal(check(),absent);
});
test('exact base-power count rejects cards above the specified power',()=>{const e=game(),source=e.list(0,'leader')[0];body(e,0,7000);body(e,0,7000);assert.equal(e.conditions({TwoCharacterBasePowerX:6000},source),false);assert.equal(e.conditions({TwoCharacterBasePowerXOrMore:6000},source),true);});
test('category count ignores hand, opponent and leader and drops when an ally leaves',()=>{
 const e=game(),source=e.list(0,'leader')[0],p={SelfCharacterCategory:{eCategory:'StrawHatCrew',iCount:3}};
 e.card('ST01-006',1,'field');e.card('ST01-006',0,'hand');e.card('ST01-006',0,'field');e.card('ST01-006',0,'field');assert.equal(e.conditions(p,source),false);
 const third=e.card('ST01-006',0,'field');assert.equal(e.conditions(p,source),true);e.move(third,'trash');assert.equal(e.conditions(p,source),false);
 assert.equal(e.conditions({SelfCharacterCategory:{eCategory:'SeaKing'}},source),true);
});
test('leader name alternative does not bypass unrelated conditions',()=>{
 const e=game(),leader=e.list(0,'leader')[0],p={LeaderCategoryRequired:['LandOfWano'],OverrideLeaderCategoryName:['Portgas D. Ace'],HandXOrMore:6};
 e.rules={...e.rules,[leader.id]:{...e.rule(leader),characterName:'Portgas D. Ace'}};
 assert.equal(e.conditions(p,leader),false);e.card('ST01-003',0,'hand');assert.equal(e.conditions(p,leader),true);
 e.rules[leader.id]={...e.rule(leader),characterName:'Other',cardCategories:['LandOfWano']};assert.equal(e.conditions(p,leader),true);
 e.rules[leader.id]={...e.rule(leader),cardCategories:['Navy']};assert.equal(e.conditions(p,leader),false);
});
test('any-power condition counts current character power on either side, not leaders',()=>{
 const e=game(),leader=e.list(0,'leader')[0];e.mod(leader,'power',10000);assert.equal(e.conditions({AnyPowerXOrMore:8000},leader),false);
 const c=body(e,1,7000);assert.equal(e.conditions({AnyPowerXOrMore:8000},leader),false);e.mod(c,'power',1000);assert.equal(e.conditions({AnyPowerXOrMore:8000},leader),true);
});
test('aggregate power rejects an illegal pair atomically and resolves an exact-limit pair',()=>{
 const e=game();for(const d of e.list(0,'donReserve').slice(0,3))e.move(d,'don');
 const event=e.card('OP09-018',0,'hand'),a=body(e,1,3000),b=body(e,1,3000),small=e.card('ST01-006',1,'field');
 e.dispatch({type:'play',uid:event.uid});const before=JSON.stringify(e.s);
 assert.throws(()=>e.dispatch({type:'choose',uids:[a.uid,b.uid]}));assert.equal(JSON.stringify(e.s),before);
 e.dispatch({type:'choose',uids:[a.uid,small.uid]});assert.equal(e.s.cards[a.uid].zone,'trash');assert.equal(e.s.cards[small.uid].zone,'trash');assert.equal(e.s.cards[b.uid].zone,'field');
});
test('aggregate cost uses modified costs and rejects the complete over-budget selection',()=>{
 const e=game(),source=e.card('OP17-119',0,'field'),a=e.card('ST01-009',1,'field'),b=e.card('ST01-009',1,'field'),c=e.card('ST01-003',1,'field');
 e.emit('OnPlay',source,{owner:0});e.pump();assert.equal(e.s.prompt.max,3);
 const before=JSON.stringify(e.s);assert.throws(()=>e.dispatch({type:'choose',uids:[a.uid,b.uid,c.uid]}));assert.equal(JSON.stringify(e.s),before);
 e.mod(e.s.cards[b.uid],'cost',-1);e.dispatch({type:'choose',uids:[a.uid,b.uid,c.uid]});assert.equal(e.list(1,'field').length,0);
});
test('DON lock stops character effects but permits leader and stage effects',()=>{
 const e=game(),source=e.card('EB04-016',0,'field'),leader=e.list(0,'leader')[0],stage=e.card('ST01-017',0,'stage'),don=e.don(0)[0];
 e.applyEffects({CantActivateDonToTurnEnd:true},source,[],{});don.rested=true;e.applyEffects({Activate:true},source,[don],{});assert.equal(don.rested,true);
 e.applyEffects({Activate:true},leader,[don],{});assert.equal(don.rested,false);don.rested=true;e.applyEffects({Activate:true},stage,[don],{});assert.equal(don.rested,false);
});
