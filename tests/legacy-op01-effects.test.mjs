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

test('OP02-074 gives Blocker only to a friendly Blugori while Saldeath remains in play',()=>{
  const e=game(),source=give(e,'OP02-074'),blugori=e.card('OP02-084',0,'field'),other=e.card('ST02-003',0,'field');
  assert.equal(e.flags(blugori).Blocker,true);
  assert.equal(e.flags(other).Blocker,undefined);
  e.move(source,'trash');
  assert.equal(e.flags(blugori).Blocker,undefined);
});

test('OP03-002 gains Unblockable for its attack only while it has attached DON',()=>{
  const e=game(),c=give(e,'OP03-002'),action=e.actions(c)[0];
  assert.equal(e.conditions(action.proc,c),false);
  attach(e,c);
  assert.equal(e.conditions(action.proc,c),true);
  e.applyEffects(action.steps[0].effect,c,[c],{});
  assert.equal(e.flags(c).Unblockable,true);
});

test('OP03-032 is immune to Slash character attacks through its passive strike filter',()=>{
  const e=game(),c=give(e,'OP03-032'),slash=e.card('ST02-005',1,'field');
  assert.equal(e.flags(c).ImmuneToStrikes.includes('Slash'),true);
  assert.equal(e.battleImmune(c,slash),e.rule(slash).strikeType==='Slash');
});

test('OP03-059 gains Banish for its attack when it returns one DON',()=>{
  const e=game(),c=give(e,'OP03-059'),action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.GainBanish,true);
  e.applyEffects(action.steps[0].effect,c,[c],{});
  assert.equal(e.flags(c).Banish,true);
});

test('OP03-078 reduces only opposing field costs with attached DON and discards two at six opposing hand cards',()=>{
  const e=game(),c=give(e,'OP03-078'),enemy=e.card('ST02-003',1,'field');
  const base=e.def(enemy).cost;
  assert.equal(e.cost(enemy),base);
  attach(e,c);
  assert.equal(e.cost(enemy),Math.max(0,base-3));
  while(e.list(1,'hand').length<6)e.card('ST01-003',1,'hand');
  assert.equal(e.conditions(e.actions(c)[1].proc,c),true);
});

test('OP04-003 targets an opposing character with printed power at most 5000 after KO',()=>{
  const e=game(),c=give(e,'OP04-003'),small=e.card('ST02-003',1,'field'),large=e.card('EB01-002',1,'field'),target=e.actions(c)[0].steps[0];
  assert.equal(e.matchesGroup(small,target,0,c,{}),true);
  assert.equal(e.matchesGroup(large,target,0,c,{}),false);
});

test('OP04-006 lowers its active leader then gives itself power through the owner next turn start',()=>{
  const e=game(),c=give(e,'OP04-006'),leader=e.list(0,'leader')[0],action=e.actions(c)[0];
  e.applyEffects(action.steps[0].effect,c,[leader],{});
  e.applyEffects(action.steps[1].effect,c,[c],{});
  assert.equal(e.power(leader),e.def(leader).power-5000);
  assert.equal(e.power(c),e.def(c).power+2000);
});

test('OP04-012 gives only other Alabasta Kingdom characters 1000 power during its controller turn',()=>{
  const e=game(),c=give(e,'OP04-012'),ally=e.card('OP04-010',0,'field'),other=e.card('ST02-003',0,'field');
  assert.equal(e.power(ally),e.def(ally).power+1000);
  assert.equal(e.power(other),e.def(other).power);
  assert.equal(e.power(c),e.def(c).power);
  e.s.active=1;
  assert.equal(e.power(ally),e.def(ally).power);
});

test('OP04-009 lowers its active leader and queues its own return to hand at end of turn',()=>{
  const e=game(),c=give(e,'OP04-009'),action=e.actions(c);
  assert.equal(action[0].steps[0].effect.QueueUpEndOfTurnAction,1);
  assert.equal(action[1].proc.QueuedEndOfTurn,true);
  assert.equal(action[1].steps[0].effect.SendToHand,true);
});

test('OP03-040 changes deck-out into a win and mills one card on an attached-DON attack',()=>{
  const e=game(),leader=e.list(0,'leader')[0];
  leader.id='OP03-040';
  assert.equal(e.flags(leader).WinsByDeckout,true);
  assert.equal(e.actions(leader)[1].steps[0].effect.MillDeck,1);
});

test('OP01-098 searches the deck only for Artificial Devil Fruit Smile, adds it to hand, then shuffles',()=>{
  const e=game(),c=give(e,'OP01-098'),actions=e.actions(c)[0];
  assert.equal(actions.steps[0].effect.StartTopDeckFromDeck,true);
  assert.deepEqual(actions.steps[0].target[0].OnlyNames,['Artificial Devil Fruit Smile']);
  assert.equal(actions.steps[1].effect.SendToHand,true);
  assert.equal(actions.steps[2].effect.ShuffleDeck,true);
});

test('OP04-083 has Blocker and protects its field after drawing then trashing two hand cards',()=>{
  const e=game(),c=give(e,'OP04-083'),actions=e.actions(c);
  assert.equal(e.flags(c).Blocker,true);
  assert.equal(actions[1].steps[0].effect.AllCharsEffectImmune,true);
  assert.equal(actions[1].steps[1].target[0].TargetCount,2);
});

test('OP04-090 can attack active characters and returns exactly seven trash cards before activating and freezing itself',()=>{
  const e=game(),c=give(e,'OP04-090'),actions=e.actions(c);
  assert.equal(e.flags(c).CanAttackActive,true);
  assert.equal(actions[1].steps[1].target[0].TargetCount,7);
  assert.equal(actions[1].steps[2].effect.Freeze,true);
});

test('OP04-096 and OP04-118 give Rush only to their matching field characters',()=>{
  const e=game(),dressrosaLeader=e.list(0,'leader')[0],source=e.card('OP04-096',0,'field'),dressrosa=e.card('OP04-079',0,'field'),redSource=e.card('OP04-118',0,'field'),red=e.card('ST01-003',0,'field');
  dressrosaLeader.id='OP04-039';
  assert.equal(e.flags(dressrosa).Rush,true);
  assert.equal(e.flags(red).Rush,true);
  e.move(source,'trash');
  assert.equal(e.flags(dressrosa).Rush,undefined);
});

test('OP04-097 puts a matching opposing Animal or SMILE character face up on top of life',()=>{
  const e=game(),c=give(e,'OP04-097'),animal=e.card('ST01-003',1,'field'),target=e.actions(c)[0].steps[0];
  assert.equal(e.matchesGroup(animal,target,0,c,{}),true);
  assert.equal(target.effect.SendToTopLife,true);
  assert.equal(target.effect.ForcedFaceUp,true);
});

test('OP04-115 takes life then gives Double Attack only to a Wano character',()=>{
  const e=game(),c=give(e,'OP04-115'),wano=e.card('OP01-092',0,'field'),action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.TakeTopLife,1);
  assert.equal(e.matchesGroup(wano,action.steps[1],0,c,{}),true);
  assert.equal(action.steps[1].effect.GainDoubleAttack,true);
});

test('OP05-004 deploys only a different Revolutionary Army character with 5000 or less power after reaching 7000',()=>{
  const e=game(),c=give(e,'OP05-004'),candidate=e.card('OP05-006',0,'hand'),action=e.actions(c)[0];
  e.mod(c,'power',e.def(c).power>=7000?0:7000-e.def(c).power);
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(e.matchesGroup(candidate,action.steps[0],0,c,{}),true);
});

test('OP03-047 mills seven only after its attached-DON attack targets a leader, and returns a cost-three-or-less character on play',()=>{
  const e=game(),c=give(e,'OP03-047'),enemy=e.card('ST02-003',1,'field'),actions=e.actions(c);
  assert.equal(actions[0].proc.OnAttackLeader,true);
  assert.equal(actions[0].steps[0].effect.MillDeck,7);
  assert.equal(e.matchesGroup(enemy,actions[1].steps[0],0,c,{}),true);
  assert.equal(actions[1].steps[0].effect.SendToHand,true);
  assert.equal(actions[1].steps[1].effect.MillDeck,2);
});

test('OP03-122 returns a character up to cost six, then draws and discards exactly two cards',()=>{
  const e=game(),c=give(e,'OP03-122'),enemy=e.card('EB01-012',1,'field'),action=e.actions(c)[0];
  assert.equal(e.matchesGroup(enemy,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].effect.SendToHand,true);
  assert.equal(action.steps[1].effect.DrawCards,2);
  assert.equal(action.steps[2].target[0].TargetCount,2);
  assert.equal(action.steps[2].effect.TrashCard,true);
});

test('OP04-079 KOs a friendly Dressrosa character, reduces an opponent cost, then mills two',()=>{
  const e=game(),c=give(e,'OP04-079'),ally=e.card('OP04-080',0,'field'),enemy=e.card('ST02-003',1,'field'),action=e.actions(c)[0];
  assert.equal(e.matchesGroup(ally,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].effect.KOCard,true);
  assert.equal(e.matchesGroup(enemy,action.steps[1],0,c,{}),true);
  assert.equal(action.steps[1].effect.ChangeCost,-4);
  assert.equal(action.steps[2].effect.MillDeck,2);
});

test('OP04-080 grants active-character attack permission to one friendly Dressrosa character',()=>{
  const e=game(),c=give(e,'OP04-080'),ally=e.card('OP04-079',0,'field'),action=e.actions(c)[0];
  assert.equal(e.matchesGroup(ally,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].effect.GainCanAttackActive,true);
});

test('OP02-064 trashes exactly one hand card, bottoms any cost-two-or-less character, then bottoms itself',()=>{
  const e=game(),c=give(e,'OP02-064'),hand=e.list(0,'hand')[0],enemy=e.card('ST02-003',1,'field'),action=e.actions(c)[0];
  attach(e,c);
  assert.equal(action.steps[0].details.FullTargetsRequired[0],0);
  assert.equal(e.matchesGroup(hand,action.steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(enemy,action.steps[1],0,c,{}),true);
  assert.equal(action.steps[1].effect.SendToDeckBottom,true);
  assert.equal(action.steps[2].effect.SendToDeckBottom,true);
});

test('OP04-082 needs Rebecca, KOs one opposing cost-one-or-less character and mills one card',()=>{
  const e=game(),c=give(e,'OP04-082'),small=e.card('EB01-015',1,'field'),large=e.card('ST02-014',1,'field'),action=e.actions(c)[0];
  e.list(0,'leader')[0].id='OP04-039';
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(e.matchesGroup(small,action.steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(large,action.steps[0],0,c,{}),false);
  assert.equal(action.steps[0].effect.KOCard,true);
  assert.equal(action.steps[1].effect.MillDeck,1);
});

test('OP05-020 buffs one field character by 2000, then KOs one opposing character at 2000 power or less',()=>{
  const e=game(),c=give(e,'OP05-020'),ally=e.card('ST01-003',0,'field'),small=e.card('EB01-015',1,'field'),large=e.card('ST02-014',1,'field'),action=e.actions(c)[0];
  assert.equal(e.matchesGroup(ally,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].effect.BuffPower,2000);
  assert.equal(e.matchesGroup(small,action.steps[1],0,c,{}),true);
  assert.equal(e.matchesGroup(large,action.steps[1],0,c,{}),false);
  assert.equal(action.steps[1].effect.KOCard,true);
  assert.equal(e.actions(c)[1].proc.Trigger,true);
});

test('OP05-079 makes the opponent return exactly the available three-or-fewer trash cards to the deck bottom',()=>{
  const e=game(),c=give(e,'OP05-079'),a=e.card('ST02-003',1,'trash'),b=e.card('ST02-004',1,'trash'),d=e.card('ST02-005',1,'trash'),action=e.actions(c)[0];
  assert.equal(action.steps[0].details.FullTargetsRequired[0],0);
  assert.equal(action.steps[0].effect.ForceOpponent,true);
  assert.equal(action.steps[0].effect.SendToDeckBottom,true);
  assert.equal(e.matchesGroup(a,action.steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(b,action.steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(d,action.steps[0],0,c,{}),true);
});

test('OP05-088 rests and pays one DON, returns two trash cards, then retrieves only a black cost-three-to-five character',()=>{
  const e=game(),c=give(e,'OP05-088'),returned=e.card('ST02-003',0,'trash'),candidate=e.card('EB01-043',0,'trash'),wrong=e.card('ST01-003',0,'trash'),action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.DonTap,1);
  assert.equal(action.steps[0].effect.RestSelf,true);
  assert.equal(action.steps[1].details.FullTargetsRequired[0],0);
  assert.equal(e.matchesGroup(returned,action.steps[1],0,c,{}),true);
  assert.equal(e.matchesGroup(candidate,action.steps[2],0,c,{}),true);
  assert.equal(e.matchesGroup(wrong,action.steps[2],0,c,{}),false);
  assert.equal(action.steps[2].effect.SendToHand,true);
});

test('OP03-027 rests an opposing cost-two-or-less character for an East Blue leader, then deploys Butchie only when absent',()=>{
  const e=game(),c=give(e,'OP03-027'),enemy=e.card('EB01-015',1,'field'),butchie=e.card('OP03-034',0,'hand'),action=e.actions(c)[0];
  e.list(0,'leader')[0].id='OP03-021';
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(e.matchesGroup(enemy,action.steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(butchie,action.steps[1],0,c,{}),true);
  e.card('OP03-034',0,'field');
  assert.equal(e.conditions(action.steps[1].details,c),false);
});

test('OP03-039 rests an opposing cost-one-or-less character, buffs one friendly character, and has its separate trigger rest',()=>{
  const e=game(),c=give(e,'OP03-039'),small=e.card('EB01-015',1,'field'),friendly=e.card('ST01-003',0,'field'),larger=e.card('ST02-014',1,'field'),actions=e.actions(c);
  assert.equal(e.matchesGroup(small,actions[0].steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(larger,actions[0].steps[0],0,c,{}),false);
  assert.equal(actions[0].steps[1].effect.BuffPower,1000);
  assert.equal(e.matchesGroup(friendly,actions[0].steps[1],0,c,{}),true);
  assert.equal(actions[1].proc.Trigger,true);
  assert.equal(actions[1].steps[0].target[0].CostOrLess,4);
});

test('OP05-007 selects up to two opposing characters whose combined current power is at most 4000, then KOs them',()=>{
  const e=game(),c=give(e,'OP05-007'),one=e.card('EB01-015',1,'field'),two=e.card('EB01-017',1,'field'),large=e.card('ST02-014',1,'field'),action=e.actions(c)[0];
  const target=action.steps[0].target[0];
  assert.equal(e.matches(one,target,c,{}),true);
  assert.equal(e.matches(two,target,c,{selected:[one.uid]}),true);
  assert.equal(e.matches(large,target,c,{}),false);
  assert.equal(target.CombinedPowerXOrLess,4000);
  assert.equal(action.steps[0].effect.KOCard,true);
});

test('OP04-043 presents a real choice to return an eligible character to hand or to the deck bottom',()=>{
  const e=game(),c=give(e,'OP04-043'),enemy=e.card('EB01-017',1,'field'),action=e.actions(c)[0];
  attach(e,c);
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(action.steps[0].effect.Choices.length,2);
  assert.equal(e.matchesGroup(enemy,action.steps[1],0,c,{}),true);
  assert.equal(action.steps[1].effect.SendToHand,true);
  assert.equal(action.steps[2].effect.SendToDeckBottom,true);
  assert.equal(action.steps[2].details.EndAfterStep,true);
});

test('OP03-123 first selects a cost-eight-or-less character, then chooses its face-up top or bottom life placement',()=>{
  const e=game(),c=give(e,'OP03-123'),enemy=e.card('ST02-014',1,'field'),action=e.actions(c)[0];
  assert.equal(e.matchesGroup(enemy,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[1].effect.Choices.length,2);
  assert.equal(action.steps[2].target[0].AutoCopyPreviousTargets,true);
  assert.equal(action.steps[2].effect.SendToTopLife,true);
  assert.equal(action.steps[3].effect.SendToBottomLife,true);
  assert.equal(action.steps[3].effect.ForcedFaceUp,true);
});

test('OP04-008 needs Vivi and performs its -3000 power change before offering the zero-power KO',()=>{
  const e=game(),c=give(e,'OP04-008'),enemy=e.card('ST02-003',1,'field'),action=e.actions(c)[0];
  e.list(0,'leader')[0].id='OP04-001';
  attach(e,c);
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(e.matchesGroup(enemy,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].effect.BuffPower,-3000);
  e.applyEffects(action.steps[0].effect,c,[enemy],{});
  assert.equal(e.power(enemy),0);
  assert.equal(e.matchesGroup(enemy,action.steps[1],0,c,{}),true);
  assert.equal(action.steps[1].effect.KOCard,true);
});

test('OP06-047 carries its opponent context through hand shuffle and the five-card redraw',()=>{
  const e=game(),c=give(e,'OP06-047'),action=e.actions(c)[0];
  const own=e.list(0,'hand').map(x=>x.uid),opp=e.list(1,'hand').map(x=>x.uid),task={kind:'effect',uid:c.uid,index:0,step:0,group:0,targets:[],previous:[],context:{}};
  e.s.queue.push(task);e.pump();
  assert.deepEqual(e.list(0,'hand').map(x=>x.uid),own);
  assert.equal(e.list(1,'hand').length,5);
  assert.equal(opp.some(uid=>e.s.cards[uid].zone==='deck'),true);
  assert.equal(action.steps[0].effect.ForceOpponent,true);
});

test('OP04-048 returns every card from its controller hand, shuffles, and redraws the same count',()=>{
  const e=game(),c=give(e,'OP04-048'),before=e.list(0,'hand').map(x=>x.uid),action=e.actions(c)[0];
  e.s.queue.push({kind:'effect',uid:c.uid,index:0,step:0,group:0,targets:[],previous:[],context:{}});e.pump();
  assert.equal(action.steps[0].effect.SaveTargetCount,true);
  assert.equal(action.steps[0].effect.SendToDeckTop,true);
  assert.equal(e.list(0,'hand').length,before.length);
  assert.equal(before.some(uid=>e.s.cards[uid].zone==='hand'),false);
  assert.equal(e.list(1,'hand').length,5);
});

test('OP05-043 checks a multicolor leader, adds one of the top three to hand, then offers top or bottom ordering',()=>{
  const e=game(),c=give(e,'OP05-043'),action=e.actions(c)[0];
  e.list(0,'leader')[0].id='OP04-001';
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(action.steps[0].effect.StartTopDeck,3);
  assert.equal(action.steps[1].target[0].TopDeckCard,true);
  assert.equal(action.steps[1].effect.SendToHand,true);
  assert.equal(action.steps[2].effect.Choices.length,2);
  assert.equal(action.steps[3].effect.TopDeckToDeckTop,true);
  assert.equal(action.steps[4].effect.TopDeckToDeckBottom,true);
});

test('OP01-029 gives its counter target 2000 combat power and another 2000 only at two or fewer life',()=>{
  const e=game(),c=give(e,'OP01-029'),leader=e.list(0,'leader')[0],action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.BuffCombatPower,2000);
  assert.equal(e.conditions(action.steps[1].details,c),false);
  while(e.list(0,'life').length>2)e.move(e.list(0,'life')[0],'trash');
  assert.equal(e.conditions(action.steps[1].details,c),true);
  assert.equal(action.steps[1].target[0].AutoCopyPreviousTargets,true);
  assert.equal(e.matchesGroup(leader,action.steps[0],0,c,{}),true);
  assert.equal(e.actions(c)[1].steps[0].effect.BuffPower,1000);
});

test('OP04-095 adds the fifteen-trash counter bonus and its trigger draws two then requires one discard',()=>{
  const e=game(),c=give(e,'OP04-095'),actions=e.actions(c);
  assert.equal(e.conditions(actions[0].steps[1].details,c),false);
  for(let i=0;i<15;i++)e.card('ST01-003',0,'trash');
  assert.equal(e.conditions(actions[0].steps[1].details,c),true);
  assert.equal(actions[0].steps[1].effect.BuffCombatPower,2000);
  assert.equal(actions[1].steps[0].effect.DrawCards,2);
  assert.equal(actions[1].steps[1].details.FullTargetsRequired[0],0);
});

test('OP05-114 checks opposing life for both its counter bonus and its trigger KO cost ceiling',()=>{
  const e=game(),c=give(e,'OP05-114'),enemy=e.card('EB01-015',1,'field'),actions=e.actions(c);
  assert.equal(e.conditions(actions[0].steps[1].details,c),false);
  while(e.list(1,'life').length>2)e.move(e.list(1,'life')[0],'trash');
  assert.equal(e.conditions(actions[0].steps[1].details,c),true);
  assert.equal(e.matchesGroup(enemy,actions[1].steps[0],0,c,{}),true);
  assert.equal(actions[1].steps[0].effect.KOCard,true);
});

test('OP05-080 requires twenty trash cards, returns exactly twenty, shuffles, and gains battle power plus Double Attack',()=>{
  const e=game(),c=give(e,'OP05-080'),action=e.actions(c)[0];
  assert.equal(e.conditions(action.proc,c),false);
  for(let i=0;i<20;i++)e.card('ST01-003',0,'trash');
  assert.equal(e.conditions(action.proc,c),true);
  assert.equal(action.steps[0].target[0].TargetCount,20);
  assert.equal(action.steps[0].effect.SendToDeckTop,true);
  assert.equal(action.steps[1].effect.ShuffleDeck,true);
  assert.equal(action.steps[2].effect.GainDoubleAttack,true);
  assert.equal(action.steps[2].effect.BuffCombatPower,10000);
});

test('OP04-116 gives 6000 combat power, then only at combined life four or less KOs an opposing cost-two-or-less character',()=>{
  const e=game(),c=give(e,'OP04-116'),enemy=e.card('EB01-017',1,'field'),actions=e.actions(c);
  assert.equal(e.conditions(actions[0].steps[1].details,c),false);
  while(e.list(0,'life').length+e.list(1,'life').length>4)e.move(e.list(0,'life')[0]||e.list(1,'life')[0],'trash');
  assert.equal(e.conditions(actions[0].steps[1].details,c),true);
  assert.equal(e.matchesGroup(enemy,actions[0].steps[1],0,c,{}),true);
  assert.equal(actions[0].steps[0].effect.BuffCombatPower,6000);
  assert.equal(actions[1].steps[0].effect.DrawCards,1);
});

test('OP05-115 buffs first, rests a cost-four-or-less opponent only at one life, and its trigger discards two to heal',()=>{
  const e=game(),c=give(e,'OP05-115'),enemy=e.card('ST02-014',1,'field'),actions=e.actions(c);
  assert.equal(actions[0].steps[0].effect.BuffPower,3000);
  assert.equal(e.conditions(actions[0].steps[1].details,c),false);
  while(e.list(0,'life').length>1)e.move(e.list(0,'life')[0],'trash');
  assert.equal(e.conditions(actions[0].steps[1].details,c),true);
  assert.equal(e.matchesGroup(enemy,actions[0].steps[1],0,c,{}),true);
  assert.equal(actions[1].steps[0].target[0].TargetCount,2);
  assert.equal(actions[1].steps[1].effect.Heal,1);
});

test('OP05-094 lowers one opponent cost first, then freezes an opponent that is now cost zero; trigger draws two and discards one',()=>{
  const e=game(),c=give(e,'OP05-094'),enemy=e.card('ST02-003',1,'field'),actions=e.actions(c);
  assert.equal(actions[0].steps[0].effect.ChangeCost,-3);
  e.applyEffects(actions[0].steps[0].effect,c,[enemy],{});
  assert.equal(e.cost(enemy),0);
  assert.equal(e.matchesGroup(enemy,actions[0].steps[1],0,c,{}),true);
  assert.equal(actions[0].steps[1].effect.Freeze,true);
  assert.equal(actions[1].steps[0].effect.DrawCards,2);
  assert.equal(actions[1].steps[1].effect.TrashCard,true);
});

test('OP05-101 gains 1000 at two-or-fewer life and searches top five for Holly before optionally deploying Holly from hand',()=>{
  const e=game(),c=give(e,'OP05-101'),holly=e.card('OP05-110',0,'hand'),actions=e.actions(c);
  assert.equal(e.power(c),e.def(c).power);
  while(e.list(0,'life').length>2)e.move(e.list(0,'life')[0],'trash');
  assert.equal(e.power(c),e.def(c).power+1000);
  assert.equal(actions[1].steps[0].effect.StartTopDeck,5);
  assert.equal(e.matchesGroup(holly,actions[1].steps[3],0,c,{}),true);
  assert.equal(actions[1].steps[3].effect.DeployCharacter,true);
});

test('OP03-018 requires an Event discard before its two power-capped KOs, while its trigger KOs up to 5000',()=>{
  const e=game(),c=give(e,'OP03-018'),event=e.card('ST01-016',0,'hand'),five=e.card('ST02-014',1,'field'),four=e.card('EB01-017',1,'field'),actions=e.actions(c);
  assert.equal(e.matchesGroup(event,actions[0].steps[0],0,c,{}),true);
  assert.equal(actions[0].steps[0].details.FullTargetsRequired[0],0);
  assert.equal(e.matchesGroup(five,actions[0].steps[1],0,c,{}),true);
  assert.equal(e.matchesGroup(four,actions[0].steps[2],0,c,{}),true);
  assert.equal(actions[0].steps[2].target[0].PowerXOrLess,4000);
  assert.equal(actions[1].steps[0].target[0].PowerXOrLess,5000);
});

test('OP04-021 pays two DON only on an opponent attack and then rests one opposing DON',()=>{
  const e=game(),c=give(e,'OP04-021'),enemyDon=e.card('DON',1,'don'),action=e.actions(c)[0];
  assert.equal(action.proc.OnOpponentAttack,true);
  assert.equal(action.steps[0].effect.DonTap,2);
  assert.equal(e.matchesGroup(enemyDon,action.steps[1],0,c,{}),true);
  assert.equal(action.steps[1].effect.Rest,true);
});

test('OP05-002 discards a Revolutionary Army hand card to give 3000 to up to three Revolutionary Army or Trigger characters',()=>{
  const e=game(),c=give(e,'OP05-002'),cost=e.card('OP05-006',0,'hand'),revolutionary=e.card('OP05-006',0,'field'),trigger=e.card('EB01-035',0,'field'),action=e.actions(c)[0];
  assert.equal(e.matchesGroup(cost,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].details.FullTargetsRequired[0],0);
  assert.equal(e.matchesGroup(revolutionary,action.steps[1],0,c,{}),true);
  assert.equal(e.matchesGroup(trigger,action.steps[1],0,c,{}),true);
  assert.equal(action.steps[1].target[0].TargetCount,3);
  assert.equal(action.steps[1].effect.BuffPower,3000);
});

test('OP04-017 reduces an opposing combat target twice only while its leader is active',()=>{
  const e=game(),c=give(e,'OP04-017','hand'),enemy=e.list(1,'leader')[0],action=e.actions(c)[0];
  assert.equal(e.matchesGroup(enemy,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].effect.BuffCombatPower,-2000);
  assert.equal(action.steps[1].details.LeaderActive,true);
  assert.equal(action.steps[1].effect.BuffCombatPower,-1000);
});

test('OP04-112 KOs only up to combined life cost and heals once at one or less own life',()=>{
  const e=game(),c=give(e,'OP04-112'),eligible=e.card('EB01-017',1,'field'),action=e.actions(c)[0];
  assert.equal(e.matchesGroup(eligible,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].target[0].CostCombinedLifeOrLess,true);
  assert.equal(action.steps[1].details.LifeXOrLess,1);
  assert.equal(action.steps[1].effect.Heal,1);
});

test('OP04-100 trigger makes exactly one opposing leader or character unable to attack for the turn',()=>{
  const e=game(),c=give(e,'OP04-100','life'),enemy=e.card('ST02-003',1,'field'),action=e.actions(c)[0];
  assert.equal(action.proc.Trigger,true);
  assert.equal(e.matchesGroup(enemy,action.steps[0],0,c,{}),true);
  assert.equal(action.steps[0].effect.CantAttack,true);
});

test('OP03-028 offers East Blue refresh or the paired rest option on play',()=>{
  const e=game(),c=give(e,'OP03-028'),enemy=e.card('ST02-003',1,'field'),action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.Choices.length,2);
  assert.equal(action.steps[1].target[0].OnlyCategories[0],'EastBlue');
  assert.equal(action.steps[1].effect.Activate,true);
  assert.equal(action.steps[2].target[0].AutoSelf,true);
  assert.equal(e.matchesGroup(enemy,action.steps[3],0,c,{}),true);
});

test('OP03-036 and OP03-037 rest an active East Blue character as their main-action cost',()=>{
  const e=game(),source=e.card('OP03-036',0,'field'),cost=e.card('OP03-028',0,'field'),kuro=e.card('OP03-021',0,'field'),enemy=e.card('EB01-015',1,'field'),first=e.actions(source)[0],second=e.actions(e.card('OP03-037',0,'hand'))[0];
  assert.equal(e.matchesGroup(cost,first.steps[0],0,source,{}),true);
  assert.equal(first.steps[1].target[0].OnlyNames[0],'Kuro');
  assert.equal(e.matchesGroup(kuro,first.steps[1],0,source,{}),true);
  assert.equal(e.matchesGroup(cost,second.steps[0],0,source,{}),true);
  enemy.rested=true;
  assert.equal(e.matchesGroup(enemy,second.steps[1],0,source,{}),true);
  assert.equal(e.actions(e.card('OP03-036',0,'life'))[1].proc.Trigger,true);
  assert.equal(e.actions(e.card('OP03-037',0,'life'))[1].steps[0].effect.DeployCharacter,true);
});

test('OP03-096 chooses either a zero-cost character KO or a cost-three stage KO, and its trigger draws two',()=>{
  const e=game(),c=give(e,'OP03-096','hand'),zero=e.card('ST01-003',1,'field'),stage=e.card('ST14-017',1,'stage'),actions=e.actions(c),main=actions[0];
  zero.mods.push({key:'cost',value:-e.cost(zero),until:'turn',owner:1});
  assert.equal(main.steps[0].effect.Choices.length,2);
  assert.equal(e.matchesGroup(zero,main.steps[1],0,c,{}),true);
  assert.equal(e.matchesGroup(stage,main.steps[2],0,c,{}),true);
  assert.equal(actions[1].steps[0].effect.DrawCards,2);
});

test('OP03-112 reveals four, takes an eligible Big Mom card or Sanji, then bottoms the remainder',()=>{
  const e=game(),c=give(e,'OP03-112'),action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.StartTopDeck,4);
  assert.deepEqual(action.steps[1].target[0].OnlyCategories,['BigMomPirates']);
  assert.equal(action.steps[1].targetOverrides[0].OnlyNames[0],'Sanji');
  assert.equal(action.steps[2].effect.TopDeckToDeckBottom,true);
});

test('OP04-084 deploys only an eligible non-Stussy CP character from its top three, then trashes the rest',()=>{
  const e=game(),c=give(e,'OP04-084'),action=e.actions(c)[0];
  assert.equal(action.steps[0].effect.StartTopDeck,3);
  assert.deepEqual(action.steps[1].target[0].OnlyCategories,['CP9','CP7','CP0','FormerCP9']);
  assert.equal(action.steps[2].effect.TrashTopDeck,true);
});

test('OP04-094 expands from cost four to cost six only after fifteen cards are in its controller trash',()=>{
  const e=game(),c=give(e,'OP04-094','hand'),five=e.card('EB01-002',1,'field'),actions=e.actions(c),main=actions[0];
  assert.equal(e.matchesGroup(five,main.steps[0],0,c,{}),false);
  for(let i=0;i<15;i++)e.card('ST01-003',0,'trash');
  assert.equal(e.matchesGroup(five,main.steps[0],0,c,{}),true);
  assert.equal(actions[1].steps[0].target[0].Leader,true);
  assert.equal(actions[1].steps[1].target[0].CostOrLess,5);
});

test('OP05-096 offers all four main removal destinations, draws for Celestial Dragons, and has a KO-or-bounce trigger',()=>{
  const e=game(),c=give(e,'OP05-096','hand'),actions=e.actions(c),main=actions[0];
  assert.equal(main.steps[0].effect.Choices.length,4);
  assert.equal(main.steps[3].effect.SendToTopLife,true);
  assert.equal(main.steps[4].effect.SendToBottomLife,true);
  assert.deepEqual(main.steps[1].effect.DrawIfAllyCategoryInPlay,['CelestialDragon']);
  assert.equal(actions[1].steps[0].effect.Choices.length,2);
  assert.equal(actions[1].steps[1].target[0].CostOrLess,6);
});

test('OP04-117 offers face-up top or bottom life placement and lets its trigger take only a top or bottom life card',()=>{
  const e=game(),c=give(e,'OP04-117','hand'),enemy=e.card('ST02-003',1,'field'),life=e.list(0,'life'),actions=e.actions(c),main=actions[0];
  assert.equal(main.steps[0].effect.Choices.length,2);
  assert.equal(e.matchesGroup(enemy,main.steps[1],0,c,{}),true);
  assert.equal(main.steps[1].effect.ForcedFaceUp,true);
  assert.equal(e.matchesGroup(life[0],actions[1].steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(life.at(-1),actions[1].steps[0],0,c,{}),true);
  assert.equal(e.matchesGroup(life[1],actions[1].steps[0],0,c,{}),false);
  assert.equal(actions[1].steps[1].effect.SendToTopLife,true);
});

test('OP04-011 reveals one card on attack, buffs only for a 6000-or-more character, then bottoms it',()=>{
  const e=game(),c=give(e,'OP04-011'),action=e.actions(c)[0];
  assert.equal(action.proc.OnAttack,true);
  assert.equal(action.steps[0].effect.StartTopDeck,1);
  assert.equal(action.steps[1].target[0].PowerXOrMore,6000);
  assert.equal(action.steps[1].effect.BuffPower,3000);
  assert.equal(action.steps[2].effect.TopDeckToDeckBottom,true);
});

test('OP01-099 gives battle KO immunity only to other friendly Kurozumi characters',()=>{
  const e=game(),source=give(e,'OP01-099'),ally=e.card('OP01-098',0,'field'),other=e.card('ST01-003',0,'field'),action=e.actions(source)[0];
  assert.equal(e.matchesGroup(ally,action.steps[0],0,source,{}),true);
  assert.equal(e.matchesGroup(source,action.steps[0],0,source,{}),false);
  assert.equal(e.matchesGroup(other,action.steps[0],0,source,{}),false);
  assert.equal(e.flags(ally).ImmuneToBattle,true);
});

test('OP02-027 resists opposing effects only while every own DON is rested',()=>{
  const e=game(),c=give(e,'OP02-027');
  for(const d of e.don(0))d.rested=true;
  assert.equal(e.flags(c).ImmuneToOpponentNoncombat,true);
  e.don(0)[0].rested=false;
  assert.equal(e.flags(c).ImmuneToOpponentNoncombat,undefined);
});

test('OP02-118 requires a hand discard for battle-only KO immunity and its trigger KOs a stage up to cost three',()=>{
  const e=game(),c=give(e,'OP02-118','hand'),cost=e.list(0,'hand')[0],ally=e.card('ST01-003',0,'field'),stage=e.card('ST14-017',1,'stage'),actions=e.actions(c);
  assert.equal(e.matchesGroup(cost,actions[0].steps[0],0,c,{}),true);
  assert.equal(actions[0].steps[1].effect.GainCombatImmune,true);
  e.applyEffects(actions[0].steps[1].effect,c,[ally],{});
  assert.equal(ally.mods.at(-1).until,'battle');
  assert.equal(e.matchesGroup(stage,actions[1].steps[0],0,c,{}),true);
});
