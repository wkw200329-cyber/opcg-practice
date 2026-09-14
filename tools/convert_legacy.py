"""Translate only legacy rules whose entire structure has an explicit equivalent."""
from pathlib import Path
import json,copy
path=Path('dist/data/rules.json');rules=json.loads(path.read_text(encoding='utf8'))
trigger_map={k:k for k in ['Passive','ActivateMain','OncePerTurn','OnAttack','Counter','Trigger','OnPlay','DonX','OnKO','OnBlock','YourTurn','OpponentTurn','EndOfTurn','LeaderColorCountOrMore']}
trigger_map.update({'RequiresLeaderType':'LeaderCategoryRequired','RequiresLeader':'LeaderNameRequired','OpponentAttack':'OnOpponentAttack','DonCount':'DonXOrMore','LifeLessThan':'LifeXOrLess','HandX':'HandXOrLess','HandXMore':'HandXOrMore','CharacterCount':'CharactersOrMore','CharacterCountOrLess':'CharactersOrLess','LessLifeThanOpponent':'LessLife','LeaderIsActive':'LeaderActive','AfterBattleCharacter':'AfterBattleCharacter'})
simple={k:k for k in ['Rush','Blocker','DoubleAttack','DrawCards','GainActiveDon','GainRestedDon','MillDeck','ImmuneToNoncombat','CanAttackActive']}
simple.update({'NoBlocker':'Unblockable','ImmuneInCombat':'ImmuneToBattle','AddDeckToLife':'Heal','BuffCharacters':'FieldPowerBuff'})
filters={'OnlyCategories':'OnlyCategories','OnlyColors':'OnlyColors','OnlyTypes':'OnlyTypes','OnlyNames':'OnlyNames','NotNames':'NotNames','OnlyRested':'RestedOnly','OnlyActive':'ActiveOnly','OnlyBlockers':'HasBlocker','HasATrigger':'HasTrigger','HasNoEffects':'HasNoEffects','CostOrLess':'CostOrLess','CostOrMore':'CostOrMore','PowerOrLess':'PowerXOrLess'}
def convert(a,card):
    tr=copy.deepcopy(a.get('actionTrigger',{}));ef=copy.deepcopy(a.get('actionEffect',{}));p={};steps=[]
    for k in list(tr):
        if k in trigger_map:p[trigger_map[k]]=tr.pop(k)
    if tr.pop('SelfTap',False):p['Active']=True;steps.append({'effect':{'RestSelf':True}})
    costs={}
    for k in ['DonTap','DonMinus']:
        if k in tr:costs[k]=tr.pop(k)
    if tr.pop('TrashSelf',False):costs['TrashSelf']=True
    if card['cardType']=='Event':
        costs['TrashSelf']=True
        if not p.get('Trigger') and card.get('cardCost',0):costs['DonTap']=max(costs.get('DonTap',0),card['cardCost'])
    if 'DonTap'in costs:p['AvailableDon']=costs['DonTap']
    if costs:steps.append({'details':{'Required':True,'ConfirmAction':card['cardType']!='Event'},'effect':costs})
    if 'TrashX'in tr:
        target={'HandCard':True,'FriendlyOnly':True,'TargetCount':tr.pop('TrashX')}
        for k,n in [('TrashCategories','OnlyCategories'),('TrashTypes','OnlyTypes'),('TrashColors','OnlyColors'),('TrashNames','OnlyNames')]:
            if k in tr:target[n]=tr.pop(k)
        steps.append({'details':{'Required':True,'FullTargetsRequired':[0]},'target':[target],'effect':{'TrashCard':True}})
    if tr:return None
    is_active=any(p.get(k) for k in ['OnAttack','ActivateMain','Counter','Trigger','OnPlay','OnKO','OnBlock','EndOfTurn','OnOpponentAttack','AfterBattleCharacter'])
    if not is_active:p['Passive']=True
    target_filters={n:ef.pop(k) for k,n in filters.items() if k in ef}
    count=1+ef.pop('ExtraTargets',0)
    main={}
    for k,n in simple.items():
        if k in ef:main[n]=ef.pop(k)
    if ef.get('TopDeck') and ef.get('HandTopDeck'):
        steps.append({'effect':{'StartTopDeck':ef.pop('TopDeck')}})
        steps.append({'target':[{'TopDeckCard':True,'FriendlyOnly':True,'TargetCount':ef.pop('HandTopDeck'),**target_filters}],'effect':{'SendToHand':True}})
        steps.append({'effect':{'TopDeckToDeckBottom':True}});target_filters={}
    mappings={
      'KOCostOrLess':('KOCard','CostOrLess','EnemyOnly'),
      'KOPowerOrLess':('KOCard','PowerXOrLess','EnemyOnly'),
      'RestOpponentCharacter':('Rest','CostOrLess','EnemyOnly'),
      'BuffOpponentCharacter':('BuffPower',None,'EnemyOnly'),
      'ChangeOpponentCost':('ChangeCost',None,'EnemyOnly'),
      'ReturnOpponentCharacter':('SendToHand','CostOrLess','EnemyOnly'),
    }
    for k,(effect,threshold,side) in mappings.items():
        if k not in ef:continue
        n=ef.pop(k);target={'DeployedCharacter':True,side:True,'TargetCount':count,**target_filters};effect_value=True
        if threshold:target[threshold]=n
        else:effect_value=n
        steps.append({'target':[target],'effect':{effect:effect_value}});target_filters={}
    for k,n in [('ActivateSelf','Activate'),('BuffSelf','PassivePowerChange' if p.get('Passive') else 'BuffPower'),('TempBuffSelf','BuffPower'),('GainRush','GainRush'),('GainBanish','GainBanish')]:
        if k in ef:
            if p.get('Passive'):n={'GainBanish':'Banish','GainRush':'Rush'}.get(n,n)
            steps.append({'target':[{'AutoSelf':True}],'effect':{n:ef.pop(k)}})
    for k,z,side,effect in [('DeployCharacter','HandCard','FriendlyOnly','DeployCharacter'),('DrawFromTrash','TrashCard','FriendlyOnly','SendToHand'),('ReturnAnyCharacter','DeployedCharacter',None,'SendToHand'),('OpponentCharacterCantAttack','DeployedCharacter','EnemyOnly','CantAttack')]:
        if ef.get(k):
            ef.pop(k);target={z:True,'TargetCount':count,**target_filters}
            if side:target[side]=True
            if k=='DeployCharacter':target['OnlyTypes']=['Character']
            steps.append({'target':[target],'effect':{effect:True}});target_filters={}
    if 'BuffOpponent'in ef:
        steps.append({'target':[{'DeployedCharacter':True,'Leader':True,'EnemyOnly':True,'TargetCount':count,**target_filters}],'effect':{'BuffPower':ef.pop('BuffOpponent')}});target_filters={}
    if 'BuffLeader'in ef or ef.get('GrantLeaderDoubleAttack'):
        effect={}
        if 'BuffLeader'in ef:effect['BuffPower']=ef.pop('BuffLeader')
        if ef.pop('GrantLeaderDoubleAttack',False):effect['GainDoubleAttack']=True
        steps.append({'target':[{'Leader':True,'FriendlyOnly':True,'AutoAllMatchingTargets':True}],'effect':effect})
    if ef.pop('KOCostZero',False):
        steps.append({'target':[{'DeployedCharacter':True,'EnemyOnly':True,'CostZero':True,'TargetCount':count,**target_filters}],'effect':{'KOCard':True}});target_filters={}
    if ef.get('BuffAny') or ef.get('BuffCombat'):
        main['BuffCombatPower' if ef.get('BuffCombat') else 'BuffPower']=ef.pop('BuffCombat',ef.pop('BuffAny',0))
        steps.append({'target':[{'TargetCount':1,'FriendlyOnly':True,'Leader':True,'DeployedCharacter':True,**target_filters}],'effect':main});target_filters={};main={}
    if ef.get('ActivateCharacter'):
        ef.pop('ActivateCharacter');steps.append({'target':[{'TargetCount':1,'FriendlyOnly':True,'DeployedCharacter':True,**target_filters}],'effect':{'Activate':True}});target_filters={}
    if ef.get('Deploy'):
        ef.pop('Deploy');main['DeploySelf']=True
    if main:
        step={'effect':main}
        if 'FieldPowerBuff'in main:step['target']=[{'FriendlyOnly':True,'DeployedCharacter':True,**target_filters}];target_filters={}
        steps.append(step)
    if ef or target_filters:return None
    return {'proc':p,'steps':steps}
count=0
for c in rules.values():
    legacy=c.get('cardActions',[])
    if not legacy:continue
    new=[convert(a,c) for a in legacy]
    if all(a is not None for a in new):
        c['actionV3s']=c.get('actionV3s',[])+new;c['legacyConverted']=True;del c['cardActions'];count+=1
path.write_text(json.dumps(rules,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('Converted legacy cards',count)
