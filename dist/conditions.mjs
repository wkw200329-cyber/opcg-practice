// Conditions mirrored from the source game's CanUseV3Action / CanUseV3ActionStep.
const overlap=(a=[],b=[])=>a.some(x=>b.includes(x));
export const extraConditionNames=`AllyCostOrMore AllyCostCount AllyBaseCostOrMore AllyTotalCostOrMore CostXOrMoreExists CostXOrLessExists SelfCostXOrMoreNotExists CostZeroOrXOrMoreExists OppCostZeroOrXOrMoreExists CharacterCostXOrMore MyCostXOrMore DonXLessThanOpp EitherDonXOrMore EitherPlayerZeroLife HandDiffXOrMore CategoryInPlayRequired CategoryInPlayCount TopDeckHasCategory TopDeckHasType TopDeckCostOrMore TopDeckCostOrLess TopDeckMatchesSavedCost AllyNameInPlay AllyNameInPlayCount NameNotInAnyDeploy LeaderHasColors CombinedLifeXOrMore OppRestedCharacters OppRestedCards LessThanXAvailableDon SelfLeaderAttachedDon OppAttachedDon TrashEventsXOrLess AnyFacedownLife FacedownBotLife FaceupBotLife FieldIsFullAndUnique FieldIsOnlyCounterless NamesInYourTrash NameOwned NameIsRested PreviousTargetNowInLife PreviousTargetNowInHand PreviousTargetNowInDeck PreviousTargetNowInTrash`.split(' ');
extraConditionNames.push(...'SelfNoCharBaseXOrMore NoBaseXOrMore OppAnyBaseXOrMore Opp2CharsBaseXOrMore OppCharBaseXOrMore SelfAnyBaseXOrMore TwoCharacterBasePowerX TwoCharacterBasePowerXOrMore CharacterBasePowerXOrMore AnyPowerXOrMore SelfCharacterCategory OverrideLeaderCategoryName'.split(' '));
export function extraCondition(k,v,p,e,c,ctx){
 const o=c.owner,own=e.s.players[o],opp=e.s.players[1-o],field=e.list(o,'field'),enemy=e.list(1-o,'field'),all=[...field,...enemy],leader=e.list(o,'leader')[0],revealed=(ctx.revealed?.uids||[]).map(u=>e.s.cards[u]).filter(x=>x.zone===ctx.revealed?.from);
 const named=(x,names)=>overlap([e.rule(x).characterName,...e.rule(x).extraNames||[]],Array.isArray(names)?names:[names]);
 switch(k){
 case 'SelfNoCharBaseXOrMore':return !field.some(x=>(e.def(x).power||0)>=v);
 case 'NoBaseXOrMore':return !all.some(x=>(e.def(x).power||0)>=v);
 case 'OppAnyBaseXOrMore':return [...enemy,...e.list(1-o,'leader')].some(x=>(e.def(x).power||0)>=v);
 case 'Opp2CharsBaseXOrMore':return enemy.filter(x=>(e.def(x).power||0)>=v).length>=2;
 case 'OppCharBaseXOrMore':return enemy.some(x=>(e.def(x).power||0)>=v);
 case 'SelfAnyBaseXOrMore':case 'CharacterBasePowerXOrMore':return field.some(x=>(e.def(x).power||0)>=v);
 case 'TwoCharacterBasePowerX':return field.filter(x=>(e.def(x).power||0)===v).length>=2;
 case 'TwoCharacterBasePowerXOrMore':return field.filter(x=>(e.def(x).power||0)>=v).length>=2;
 case 'AnyPowerXOrMore':return all.some(x=>e.power(x)>=v);
 case 'SelfCharacterCategory':return !v.iCount||field.filter(x=>overlap(e.rule(x).cardCategories,[v.eCategory])).length>=v.iCount;
 case 'OverrideLeaderCategoryName':return true; // Alternative to LeaderCategoryRequired, checked together in Engine.

 case 'AllyCostOrMore':return field.filter(x=>e.cost(x)>=v).length>=Math.max(1,p.AllyCostCount||0);
 case 'AllyBaseCostOrMore':return field.filter(x=>(e.def(x).cost||0)>=v).length>=Math.max(1,p.AllyCostCount||0);
 case 'AllyCostCount':case 'CategoryInPlayCount':case 'AllyNameInPlayCount':return true; // consumed by their paired threshold/list
 case 'AllyTotalCostOrMore':return field.reduce((n,x)=>n+e.cost(x),0)>=v;
 case 'CostXOrMoreExists':case 'CharacterCostXOrMore':return all.some(x=>e.cost(x)>=v);
 case 'CostXOrLessExists':return all.some(x=>e.cost(x)<=v);
 case 'SelfCostXOrMoreNotExists':return !field.some(x=>e.cost(x)>=v);
 case 'CostZeroOrXOrMoreExists':return all.some(x=>e.cost(x)===0||e.cost(x)>=v);
 case 'OppCostZeroOrXOrMoreExists':return all.some(x=>e.cost(x)===0)||enemy.some(x=>e.cost(x)>=v);
 case 'MyCostXOrMore':return e.cost(c)>=v;
 case 'DonXLessThanOpp':return own.don.length+v<=opp.don.length;
 case 'EitherDonXOrMore':return own.don.length>=v||opp.don.length>=v;
 case 'EitherPlayerZeroLife':return !own.life.length||!opp.life.length;
 case 'HandDiffXOrMore':return own.hand.length+v<=opp.hand.length;
 case 'CategoryInPlayRequired':return field.filter(x=>overlap(e.rule(x).cardCategories,v)).length>=Math.max(1,p.CategoryInPlayCount||0);
 case 'TopDeckHasCategory':return revealed.some(x=>overlap(e.rule(x).cardCategories,v));
 case 'TopDeckHasType':return revealed.some(x=>v.includes(e.rule(x).cardType));
 case 'TopDeckCostOrMore':return revealed.some(x=>e.cost(x)>=v);
 case 'TopDeckCostOrLess':return revealed.some(x=>e.cost(x)<=v);
 case 'TopDeckMatchesSavedCost':return revealed.some(x=>e.cost(x)===ctx.savedCount);
 case 'AllyNameInPlay':return field.filter(x=>named(x,v)).length>=Math.max(1,p.AllyNameInPlayCount||0);
 case 'NameNotInAnyDeploy':return !all.some(x=>named(x,v));
 case 'LeaderHasColors':return overlap(e.rule(leader).cardColors,v);
 case 'CombinedLifeXOrMore':return own.life.length+opp.life.length>=v;
 case 'OppRestedCharacters':return enemy.filter(x=>x.rested).length>=v;
 case 'OppRestedCards':return e.board(1-o).filter(x=>x.rested).length>=v;
 case 'LessThanXAvailableDon':return e.readyDon(o).length<v;
 case 'SelfLeaderAttachedDon':return e.attached(leader).length>=v;
 case 'OppAttachedDon':return e.don(1-o).filter(x=>x.attached).length>=v;
 case 'TrashEventsXOrLess':return e.list(o,'trash').filter(x=>e.rule(x).cardType==='Event').length<=v;
 case 'AnyFacedownLife':return e.list(o,'life').some(x=>!x.faceUp);
 case 'FacedownBotLife':return own.life.length>=v&&e.list(o,'life').slice(-v).every(x=>!x.faceUp);
 case 'FaceupBotLife':return own.life.length>=v&&e.list(o,'life').slice(-v).every(x=>x.faceUp);
 case 'FieldIsFullAndUnique':return field.length===5&&new Set(field.map(x=>e.rule(x).characterName)).size===5;
 case 'FieldIsOnlyCounterless':return field.every(x=>!e.def(x).counter);
 case 'NamesInYourTrash':return v.every(n=>e.list(o,'trash').some(x=>named(x,[n])));
 case 'NameOwned':return v.every(n=>e.board(o).some(x=>named(x,[n])));
 case 'NameIsRested':return v.every(n=>e.board(o).some(x=>x.rested&&named(x,[n])));
 default:if(k.startsWith('PreviousTargetNowIn')){const z=k.slice(19).toLowerCase();return !ctx.previous?.length||e.s.cards[ctx.previous[0]]?.zone===z;}return true;
 }
}
