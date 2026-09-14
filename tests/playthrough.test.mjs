import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Engine} from '../dist/engine.mjs';
const read=f=>JSON.parse(readFileSync(new URL('../dist/data/'+f,import.meta.url),'utf8'));
const cards=read('cards.json'),rules=read('rules.json'),decks=read('decks.json');
const starter=n=>decks.find(d=>d.name.startsWith(n));
function run(seed,one,two){const e=new Engine(cards,rules,{seed});e.start([starter(one),starter(two)]);let commands=0,offered=new Set(),played=false;
 for(;commands<800&&e.s.winner===null;commands++){
  const p=e.s.prompt;
  if(p){
   const cmd={type:'choose'};
   if(p.type==='mulligan')cmd.value='keep';
   else if(p.type==='optional'||p.type==='confirmEffect')cmd.value='yes';
   else if(p.type==='lifeTrigger')cmd.value='no';
   else if(p.type==='counter')cmd.value='finish';
   else if(p.type==='peek')cmd.value='confirm';
   else if(p.type==='replacement')cmd.value='no';
   else if(p.type==='choice')cmd.value='0';
   else if(p.candidates)cmd.uids=p.type==='block'?[]:p.candidates.slice(0,p.max);
   else assert.fail('unknown prompt '+p.type);
   try{e.dispatch(cmd)}catch(err){throw Error(`${one}/${two}, seed ${seed}, turn ${e.s.turn}, prompt ${p.type}, card ${p.card||p.task?.uid}: ${err.message}`)}
   continue;
  }
  const o=e.s.active,leader=e.list(o,'leader')[0];
  const hand=e.list(o,'hand').filter(c=>e.def(c).type!=='事件'&&e.cost(c)<=e.readyDon(o).length&&e.list(o,'field').length<5);
  if(hand.length&&!played){played=true;e.dispatch({type:'play',uid:hand[0].uid});continue;}
  if(e.readyDon(o).length){e.dispatch({type:'attach',uid:leader.uid,count:e.readyDon(o).length});continue;}
  const attacker=e.board(o).find(c=>e.canAttack(c,e.list(1-o,'leader')[0]));
  if(attacker){e.dispatch({type:'attack',uid:attacker.uid,target:e.list(1-o,'leader')[0].uid});continue;}
  e.dispatch({type:'endTurn'});played=false;
 }
 assert.notEqual(e.s.winner,null,`no winner in ${commands} commands`);e.assertState();return commands;
}
for(const [a,b]of [['ST01','ST02'],['ST03','ST04'],['ST06','ST01'],['ST05','ST07']])test(`complete auto-settled ${a}/${b} games across 12 shuffles`,()=>{for(let seed=1;seed<=12;seed++)run(seed,a,b)});
