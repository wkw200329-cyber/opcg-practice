// Explicit implementation registry: unhandled rules must never silently resolve.
import {extraConditionNames} from './conditions.mjs';
import {replacementKeys} from './replacements.mjs';
export const implemented={
 proc:new Set(`Description OncePerTurn Passive ActivateMain OnPlay Trigger Counter OnAttack OnAttackLeader OnBlock OnKO OnKOEffectOnly OnOpponentAttack MyDonIsReturned StartOfTurn StartOfMainPhase EndOfTurn CardDrawn DonX YourTurn OpponentTurn Active Rested AvailableDon CharactersOrMore CharactersOrLess OppCharactersOrMore OppCharactersOrLess HandXOrLess HandXOrMore HandEmpty DonXOrMore DonXOrLess OppDonXOrMore OppDonXOrLess LessOrEqDon LessDon LifeXOrLess LifeXOrMore OppLifeXOrLess OppLifeXOrMore CombinedLifeXOrLess LessLife LessOrEqLife ZeroLife LifeIsZero FirstTurnOnly SelfRestedDon OppRestedDon TrashXOrMore TrashEventsXOrMore LeaderColorCountOrMore LeaderColorCountOrLess LeaderCategoryRequired LeaderNameRequired LeaderNameIncludes LeaderStrikeTypeRequired FieldIsOnlyCategory FacedownLife FaceupLife AnyFaceupLife SelfAttachedDon SelfRestedCharacters SelfRestedCards LeaderActive OnBoard HasPreviousTargets NoPreviousTargets`.split(' ')),
 details:new Set(`Required NoCancel FullTargetsRequired EndAfterStep`.split(' ')),
 target:new Set(`AutoSelf AutoCopyPreviousTargets AutoAllMatchingTargets OnlySelf NotSelf FriendlyOnly EnemyOnly ActiveOnly RestedOnly FaceUp DeployedCharacter Leader HandCard TrashCard StageCard DeckCard LifeCard TopDeckCard DonAreaCard AttachedDon OnlyTypes OnlyColors OnlyCategories OnlyNames NotNames OnlyStrikeTypes CostOrLess CostOrMore OriginalCostOrLess OriginalCostOrMore CostZero PowerXOrLess PowerXOrMore OriginalPowerXOrLess OriginalPowerXOrMore PowerZero HasNoCounter HasBlocker NotBlocker HasTrigger HasNoEffects NoUsingPreviousTargets TargetCount`.split(' ')),
 effect:new Set(`DonTap RestSelf TrashSelf DonMinus DrawCards GainActiveDon GainRestedDon MillDeck Heal TakeTopLife TakeBottomLife TrashTopLife TrashBottomLife DeploySelf StartTopDeck StartTopDeckOpp StartTopDeckFromTrash StartTopDeckFromHand StartTopDeckFromLife BuffPower BuffPowerToOppEnd BuffPowerToOwnersEnd BuffPowerToOwnersStart BuffCombatPower SetBasePower ChangeCost ChangeCostToOppEnd GainRush GainRushCharacters GainBlocker GainDoubleAttack GainBanish GainUnblockable GainCanAttackActive CantAttack CantRest GainImmune LoseBlocker Activate Rest Freeze FlipLifeDown AttachRestedDon AttachActiveDon KOCard TrashCard SendToHand SendToDeckBottom SendToDeckTop SendToTopLife SendToBottomLife DeployCharacter TopDeckToDeckBottom TopDeckToDeckTop TrashTopDeck CleanUpTopDeck ShuffleDeck WinTheGame LoseTheGame ForceOpponent Choices DeploysRested ForcedFaceUp PassivePowerChange FieldPowerBuff FieldPowerDebuff PassiveCostChange HandCostChange Rush RushCharacters Blocker DoubleAttack Banish Unblockable CanAttackActive PassiveCantAttack ImmuneToBattle ImmuneToNoncombat NoLog RevealCard RevealTopDeckToOpponent DrawIsHidden AddToLifeIsHidden`.split(' '))
};
implemented.proc.add('AfterBattleCharacter');
implemented.effect.add('BlockerMustBeXOrLess');
implemented.target.add('RequirePreviousTargets');
['TopDeckCountOrMore','OppHandXOrMore','LifeLess','LifeLessOrEqual','CostZeroExists','AllyNameNotInPlay','NameInYourDeploy'].forEach(k=>implemented.proc.add(k));
['ConfirmAction','SearchingDeck'].forEach(k=>implemented.details.add(k));
['TrashOppLife','OppTakeLife','FlipTopLifeUp','FlipTopLifeDown','StartTopDeckFromDeck','StartTopDeckFromOppTrash','StartTopDeckFromLifeAll','StartTopDeckFromOppLifeAll'].forEach(k=>implemented.effect.add(k));
implemented.effect.add('WinsByDeckout');
extraConditionNames.forEach(k=>implemented.proc.add(k));
['Silence','SilenceToOwnersEnd','GainBlockerToOppEnd','SetBasePowerToOppEnd'].forEach(k=>implemented.effect.add(k));
replacementKeys.forEach(k=>implemented.proc.add(k));
implemented.effect.add('ImmuneToRemoval');
['PeekSelfLife','PeekOppLife','LeaveLifeInPosition','SendTopLifeToBot','SendOppTopLifeToBot'].forEach(k=>implemented.effect.add(k));
implemented.proc.add('BattlingStrikeType');
export function meaningful(k,v){if(v===false||v===0||v===null||v===''||v===undefined)return false;if(Array.isArray(v))return v.length>0;if(typeof v==='object'&&'eCategory'in v&&!v.iCount)return false;return true;}
export function unsupported(rule){const missing=new Set();if(rule.cardActions?.length)missing.add('旧版效果格式');for(const a of rule.actionV3s||[]){for(const[k,v]of Object.entries(a.proc||{}))if(meaningful(k,v)&&!implemented.proc.has(k))missing.add('条件:'+k);for(const s of a.steps||[]){for(const[k,v]of Object.entries(s.details||{}))if(meaningful(k,v)&&!implemented.details.has(k)&&!implemented.proc.has(k))missing.add('步骤条件:'+k);for(const t of [...(s.target||[]),...(s.targetOverrides||[])])for(const[k,v]of Object.entries(t))if(meaningful(k,v)&&!implemented.target.has(k))missing.add('目标:'+k);for(const[k,v]of Object.entries(s.effect||{}))if(meaningful(k,v)&&!implemented.effect.has(k))missing.add('效果:'+k);}}
 return [...missing];}

['NameOverrides','ColoredEventOverrides','StrikeTypeOverrides','NoDuplicateNames'].forEach(k=>implemented.target.add(k));
['AllyFieldCostChange','OpponentFieldCostChange','ImmuneToStrikes','ImmuneToLeaderStrikes','OppTrashRandom'].forEach(k=>implemented.effect.add(k));
['AnyCharacterKOd','OpponentActivatesBlocker'].forEach(k=>implemented.proc.add(k));

implemented.proc.add('OrDonIsZero');implemented.details.add('OppPowerXOrMore');

implemented.proc.add('QueuedEndOfTurn');['QueueUpEndOfTurnAction','DonMinusToOppCount'].forEach(k=>implemented.effect.add(k));

['TopDeckToLife','TopDeckToOppLife','TrashAllFaceUpLife'].forEach(k=>implemented.effect.add(k));
['TransferDon','TurnEndActivateDon','MatchOpponentPowerUntilTurnEnd','DealDamage'].forEach(k=>implemented.effect.add(k));
implemented.target.add('SecondCostOrLess');
implemented.target.add('OverrideUITargetCount');
implemented.target.add('CostOppLifeOrLess');
implemented.target.add('CostDonOrLess');
implemented.target.add('GivenDon');
['BuffCombatXPerPrevTargets','BuffXPerPrevTargets','FieldBasePowerChange'].forEach(k=>implemented.effect.add(k));
['PowerXOrMore','OppCharPowerXOrMore','OppNo2CharsBaseXOrMore','SelfNo2CharsPowXOrMore','SelfRestedCharacterCategory'].forEach(k=>implemented.proc.add(k));
['OnRest','AnotherCharacterOfCategory'].forEach(k=>implemented.proc.add(k));
implemented.effect.add('OptionalReturnDon');
implemented.proc.add('LeaderPowerZero');
['Passive1KPerXTrash','Passive1KPerXEventTrash','Passive1KPerXRestedDon','Passive2CostPerXTrash','SetPowerToZero','SetBasePowerToZero'].forEach(k=>implemented.effect.add(k));
['BecomeDefenderCharacter','FieldDoubleAttack'].forEach(k=>implemented.effect.add(k));
implemented.effect.add('NoTakeLifeToTurnStart');
implemented.effect.add('CantActivateDonToTurnEnd');
implemented.effect.add('OtherCharsImmuneToNoncombatKO');
['CostCombinedLifeOrLess','CostOppDonOrLess'].forEach(k=>implemented.target.add(k));
implemented.effect.add('TrashLifeTo');
implemented.effect.add('CantPlayAnyCharactersToField');
['ImmuneToRest','GainCombatImmuneToStart'].forEach(k=>implemented.effect.add(k));
['SwapBasePower','SwapBasePowerWithLeader'].forEach(k=>implemented.effect.add(k));
implemented.target.add('TargetCountHandOverflow');
['SaveTargetCount','SaveHandSize','DrawSavedCount'].forEach(k=>implemented.effect.add(k));
['PassiveBasePowerMatchLeader','MatchLeaderToBasePowerUntilTurnEnd'].forEach(k=>implemented.effect.add(k));

implemented.effect.add('CantPlayOriginalCostOrMore');
