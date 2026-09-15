import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n+'.json',import.meta.url)));
const cards=read('cards'),rules=read('rules'),decks=read('decks');
function game(){const e=new Engine(cards,rules,{seed:42});e.start(['ST01','ST02'].map(n=>decks.find(d=>d.name.startsWith(n))));e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});e.s.players[0].turns=e.s.players[1].turns=2;return e;}
function rulesFor(e,id,actions){e.rules={...e.rules,[id]:{...e.rule({id}),actionV3s:actions}};}
test('removal conditions preserve owner, category, KO kind, printed power and remover side',()=>{
 const e=game(),watch=e.card('ST01-003',0,'field'),own=e.card('ST01-005',0,'field'),enemy=e.card('ST02-003',1,'field');
 rulesFor(e,watch.id,[{proc:{YourCharacterRemoved:['StrawHatCrew']},steps:[{effect:{DrawCards:1}}]},{proc:{YourCharacterKOd:['StrawHatCrew'],YourCharacterOriginalPowerXOrMoreKOd:4000},steps:[{effect:{GainActiveDon:1}}]},{proc:{YouRemovedCharacter:true},steps:[{effect:{DrawCards:1}}]}]);
 const before=e.list(0,'hand').length;e.remove(own,'trash',false,enemy);e.pump();assert.equal(e.list(0,'hand').length,before+1);assert.equal(e.don(0).length,2);
 const enemy2=e.card('ST02-003',1,'field');e.remove(enemy2,'trash',false,watch);e.pump();assert.equal(e.list(0,'hand').length,before+2);
 const ownLow=e.card('ST01-003',0,'field');e.remove(ownLow,'trash',false,enemy);e.pump();assert.equal(e.don(0).length,2);
});
test('opponent KO trigger ignores friendly KO and owner-specific KO trigger ignores enemy KO',()=>{
 const e=game(),watch=e.card('ST01-003',0,'field'),own=e.card('ST01-003',0,'field'),enemy=e.card('ST02-003',1,'field');
 rulesFor(e,watch.id,[{proc:{OpponentCharacterKOd:true},steps:[{effect:{DrawCards:1}}]}]);const before=e.list(0,'hand').length;
 e.remove(own,'trash',false,watch);e.pump();assert.equal(e.list(0,'hand').length,before);
 e.remove(enemy,'trash',false,watch);e.pump();assert.equal(e.list(0,'hand').length,before+1);
});
test('DON return threshold aggregates the current return transaction only',()=>{
 const e=game(),watch=e.card('ST01-003',0,'field'),source=e.list(0,'leader')[0];
 rulesFor(e,watch.id,[{proc:{XMyDonIsReturned:2},steps:[{effect:{GainActiveDon:1}}]}]);
 e.applyEffects({DonMinus:1},source,[],{});e.pump();assert.equal(e.don(0).length,0);
 for(const d of e.list(0,'donReserve').slice(0,2))e.move(d,'don');e.applyEffects({DonMinus:2},source,[],{});e.pump();assert.equal(e.don(0).length,1);
});
test('event and trigger activation conditions discriminate each player',()=>{
 const e=game(),watch=e.card('ST01-003',0,'field'),ownEvent=e.card('ST01-016',0,'hand'),oppEvent=e.card('ST02-016',1,'hand');
 rulesFor(e,watch.id,[{proc:{OppActivatesEvent:true},steps:[{effect:{DrawCards:1}}]},{proc:{YouActivateEvent:true},steps:[{effect:{GainActiveDon:1}}]},{proc:{OppActivatesTrigger:true},steps:[{effect:{DrawCards:1}}]}]);
 rulesFor(e,ownEvent.id,[{proc:{ActivateMain:true},steps:[{effect:{}}]}]);rulesFor(e,oppEvent.id,[{proc:{ActivateMain:true},steps:[{effect:{}}]}]);
 const before=e.list(0,'hand').length;e.beginAction(ownEvent,0);e.pump();assert.equal(e.don(0).length,2);assert.equal(e.list(0,'hand').length,before);
 e.beginAction(oppEvent,0);e.pump();assert.equal(e.list(0,'hand').length,before+1);
 e.emit('ActivatesTrigger',null,{trigger:{owner:1,uid:'test-trigger'}});e.pump();assert.equal(e.list(0,'hand').length,before+2);
});
test('rested-character timing is only raised for its controller effect',()=>{
 const e=game(),watch=e.card('ST01-003',0,'field'),own=e.card('ST01-006',0,'field'),enemy=e.card('ST02-003',1,'field');
 rulesFor(e,watch.id,[{proc:{YouRestedCharacter:true},steps:[{effect:{DrawCards:1}}]}]);const before=e.list(0,'hand').length;
 e.applyEffects({Rest:true},watch,[own],{});e.pump();assert.equal(e.list(0,'hand').length,before+1);
 e.applyEffects({Rest:true},enemy,[own],{});e.pump();assert.equal(e.list(0,'hand').length,before+1);
});
