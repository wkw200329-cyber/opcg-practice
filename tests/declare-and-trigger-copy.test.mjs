import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
const cards=read('cards'),rules=read('rules'),decks=read('decks');
function game(){const e=new Engine(cards,rules,{seed:42});e.start(['ST01','ST02'].map(n=>decks.find(d=>d.name.startsWith(n))));e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});return e;}
test('declared cost prompts for a bounded number and is retained for the following reveal test',()=>{
 const e=game(),source=e.list(0,'leader')[0],top=e.list(0,'deck')[1];e.db={...e.db,[top.id]:{...e.def(top),cost:6}};
 const action={proc:{ActivateMain:true},steps:[{effect:{DeclareCost:true}},{effect:{DrawCards:1}}]};e.s.queue.push({kind:'effect',uid:source.uid,action,step:0,group:0,targets:[],previous:[],context:{}});e.pump();assert.equal(e.s.prompt.type,'declareCost');
 assert.throws(()=>e.dispatch({type:'choose',value:'11'}),/0–10/);e.dispatch({type:'choose',value:'6'});assert.equal(e.list(0,'hand').length,6);assert.equal(e.conditions({TopDeckMatchesSavedCost:true},source,{revealed:{from:'deck',uids:[top.uid]},declaredCost:6}),true);
});
test('declared cost mismatch skips a required step and invalid values do not alter state',()=>{
 const e=game(),source=e.list(0,'leader')[0],top=e.list(1,'deck')[0];e.db={...e.db,[top.id]:{...e.def(top),cost:2}};
 const action={proc:{ActivateMain:true},steps:[{effect:{DeclareCost:true}},{details:{Required:true,TopDeckMatchesSavedCost:true},effect:{DrawCards:1}}]};e.s.queue.push({kind:'effect',uid:source.uid,action,step:0,group:0,targets:[],previous:[],context:{revealed:{uids:[top.uid]}}});e.pump();const before=JSON.stringify(e.s);assert.throws(()=>e.dispatch({type:'choose',value:'-1'}),/0–10/);assert.equal(JSON.stringify(e.s),before);e.dispatch({type:'choose',value:'3'});assert.equal(e.list(0,'hand').length,5);
});
test('trigger copy guard requires a currently usable on-play action',()=>{
 const e=game(),source=e.card('ST01-003',0,'field'),other=e.card('ST01-006',0,'field');
 e.rules={...e.rules,[source.id]:{...e.rule(source),actionV3s:[{proc:{OnPlay:true},steps:[{effect:{DrawCards:1}}]},{proc:{Trigger:true},steps:[{effect:{TrashSelf:true}},{details:{Required:true,CanUseOnPlays:true},effect:{DrawCards:1}}]}]}};
 const trigger=e.actions(source)[1];const before=e.list(0,'hand').length;e.s.queue.push({kind:'effect',uid:source.uid,action:trigger,step:0,group:0,targets:[],previous:[],context:{trigger:true}});e.pump();assert.equal(e.list(0,'hand').length,before+1);
 e.rules[source.id]={...e.rule(source),actionV3s:[{proc:{OnPlay:true,HandXOrMore:99},steps:[{effect:{DrawCards:1}}]},trigger]};e.move(source,'reveal');e.s.queue.push({kind:'effect',uid:source.uid,action:trigger,step:0,group:0,targets:[],previous:[],context:{trigger:true}});e.pump();assert.equal(e.list(0,'hand').length,before+1);assert.equal(other.zone,'field');
});
