const overlap=(a=[],b=[])=>a.some(x=>b.includes(x));
export const replacementKeys=`PreKO PreKOEffectOnly PreKOCombatOnly PreBounce PreDeckBottom PreSendToBottomLife PreSendToTopLife PreTrash PreAllyKO PreAllyKOEffectOnly PreAllyKOCombatOnly PreAllyBounce PreAllyDeckBottom PreAllySendToBottomLife PreAllySendToTopLife PreAllyTrash PreCharacterKOEffectOnly OnlyOppActions PreAllyNotNamed PreAllyNamed PreAllyColor PreAllyCategory PreAllyStrikeType PreAllyCostOrLower PreAllyOriginalCostOrLower PreAllyOriginalCostOrMore PreAllyOriginalPowerOrLower PreAllyOriginalPowerOrMore PreAllyPowerOrMore PreAllyRested PreAllyNotSelf`.split(' ');
export function replacementMatches(e,source,p,move){
 const c=e.s.cards[move.uid];if(!c||c.zone!=='field'||source.owner!==c.owner)return false;
 if(p.OnlyOppActions&&move.remover===c.owner)return false;
 const type=move.type,combat=move.combat;
 const self=c.uid===source.uid&&(type==='KO'&&(p.PreKO||combat&&p.PreKOCombatOnly||!combat&&p.PreKOEffectOnly)||type==='Bounce'&&p.PreBounce||type==='DeckBottom'&&p.PreDeckBottom||type==='BottomLife'&&p.PreSendToBottomLife||type==='TopLife'&&p.PreSendToTopLife||type==='Trash'&&p.PreTrash);
 if(self)return true;
 const r=e.rule(c),d=e.def(c);
 if(type==='KO'&&!combat&&p.PreCharacterKOEffectOnly?.includes(r.characterName))return true;
 const ally=type==='KO'&&(p.PreAllyKO||combat&&p.PreAllyKOCombatOnly||!combat&&p.PreAllyKOEffectOnly)||type==='Bounce'&&p.PreAllyBounce||type==='DeckBottom'&&p.PreAllyDeckBottom||type==='BottomLife'&&p.PreAllySendToBottomLife||type==='TopLife'&&p.PreAllySendToTopLife||type==='Trash'&&p.PreAllyTrash;
 if(!ally)return false;
 if(p.PreAllyNotSelf&&c.uid===source.uid||p.PreAllyNotNamed?.includes(r.characterName)||p.PreAllyNamed&&!p.PreAllyNamed.includes(r.characterName)||p.PreAllyColor&&!overlap(r.cardColors,p.PreAllyColor)||p.PreAllyCategory&&!overlap(r.cardCategories,p.PreAllyCategory)||p.PreAllyStrikeType&&!p.PreAllyStrikeType.includes(r.strikeType))return false;
 if(p.PreAllyCostOrLower&&e.cost(c)>p.PreAllyCostOrLower||p.PreAllyOriginalCostOrLower&&(d.cost||0)>p.PreAllyOriginalCostOrLower||p.PreAllyOriginalCostOrMore&&(d.cost||0)<p.PreAllyOriginalCostOrMore||p.PreAllyOriginalPowerOrLower&&(d.power||0)>p.PreAllyOriginalPowerOrLower||p.PreAllyOriginalPowerOrMore&&(d.power||0)<p.PreAllyOriginalPowerOrMore||p.PreAllyPowerOrMore&&e.power(c)+(e.s.battle?.target===c.uid?e.s.battle.counter:0)<p.PreAllyPowerOrMore||p.PreAllyRested&&!c.rested)return false;
 return true;
}
export function enqueueRemoval(e,c,destination,{source,combat=false,bottom=false,faceUp=false,type,group}={}){
 if(c.zone!=='field'){e.move(c,destination,{bottom,faceUp});return}
 const f=e.flags(c);if(!combat&&(f.ImmuneToRemoval||f.ImmuneToOpponentNoncombat&&source?.owner!==c.owner)||type==='KO'&&(combat?f.ImmuneToBattle:f.ImmuneToNoncombat||f.ImmuneToOpponentNoncombat&&source?.owner!==c.owner))return;
 e.s.removals??={};e.s.interruptions??=[];const key=group||`removal-${++e.serial}`;
 if(!e.s.removals[key]){e.s.removals[key]={moves:[],seen:[]};e.s.interruptions.push({kind:'removal',id:key});}
 e.s.removals[key].moves.push({uid:c.uid,from:c.zone,destination,remover:source?.owner??(combat?1-c.owner:c.owner),combat,bottom,faceUp,type:type||'KO',canceled:false});
}
export function runRemoval(e,t){
 const job=e.s.removals?.[t.id];if(!job)return;
 for(const source of [...e.board(e.s.active),...e.board(1-e.s.active)])for(const[index,a]of e.actions(source).entries()){
  const key=`${source.uid}:${index}`;if(job.seen.includes(key)||a.proc.OncePerTurn&&source.used[index]===e.s.turn||!e.conditions(a.proc,source))continue;
  if(!job.moves.some(m=>!m.canceled&&replacementMatches(e,source,a.proc,m)))continue;
  job.seen.push(key);e.s.queue.unshift(t);e.ask({type:'replacement',owner:source.owner,card:source.uid,index,job:t.id,title:`${e.name(source)}：是否发动替代效果，防止卡牌离场？`});return;
 }
 for(const m of job.moves){const c=e.s.cards[m.uid];if(m.canceled||c.zone!==m.from)continue;const removal={...m,removed:c.uid,removedOwner:c.owner};e.move(c,m.destination,{bottom:m.bottom,faceUp:m.faceUp});e.emit('CharacterRemoved',c,{removal,removed:c.uid,owner:c.owner});if(m.type==='KO'){e.emit('OnKO',c,{owner:c.owner});e.emit('AnyCharacterKOd',c,{owner:c.owner,removed:c.uid,removal});if(!m.combat)e.emit('OnKOEffectOnly',c,{owner:c.owner,removal});}}
 delete e.s.removals[t.id];
}
export function finishReplacement(e,t){const job=e.s.removals?.[t.context?.replacement];if(!job)return;const c=e.s.cards[t.uid],a=e.rule(c).actionV3s?.[t.index];if(!a)return;for(const m of job.moves)if(replacementMatches(e,c,a.proc,m))m.canceled=true;}
