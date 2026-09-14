"""Cache public official Chinese card descriptions. No image scraping needed."""
from pathlib import Path
import requests,json,time,concurrent.futures,re
BASE='https://webadmin.windoent.com/front/op-public/cardList/cardlist/'
CACHE=Path('tools/cache/chinese');CACHE.mkdir(parents=True,exist_ok=True)
def fetch(url,params=None):
    for attempt in range(4):
        try:
            r=requests.get(url,params=params,timeout=25);r.raise_for_status();j=r.json();assert j.get('code')==0;return j
        except Exception:
            if attempt==3: raise
            time.sleep(2+attempt)
index=CACHE/'index.json'
if not index.exists():
    j=fetch(BASE+'weblist',{'page':1,'limit':200});rows=j['page']['list']; pages=j['page']['totalPage']
    for page in range(2,pages+1):
        rows+=fetch(BASE+'weblist',{'page':page,'limit':200})['page']['list']
    index.write_text(json.dumps(rows,ensure_ascii=False),encoding='utf8')
rows=json.loads(index.read_text(encoding='utf8')); lookup={}
for row in rows:
    cid=row['cardNumber'].split('_')[0]
    if cid not in lookup or row['cardNumber']==cid:lookup[cid]=row
cards=json.loads(Path('dist/data/base.json').read_text(encoding='utf8'))
def one(c):
    p=CACHE/(c['id']+'.json')
    if p.exists():return json.loads(p.read_text(encoding='utf8'))
    row=lookup.get(c['id'])
    if not row:return None
    info=fetch(BASE+'webInfo/'+str(row['id']))['info']
    p.write_text(json.dumps(info,ensure_ascii=False),encoding='utf8');return info
missing=[];out=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for n,(c,info) in enumerate(zip(cards,pool.map(one,cards)),1):
        if info:
            c.update(name=info['cardName'],effect=info.get('cardTextDesc',''),trigger=info.get('cardTrigger',''),features=info.get('cardFeatures',''),zhSource='官方中文卡表',sourceUrl='https://www.onepiece-cardgame.cn/cardlist')
        else:missing.append(c['id'])
        out.append(c)
        if n%100==0: print('Chinese descriptions',n,'/',len(cards),flush=True)
Path('dist/data/cards.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
Path('tools/cache/missing-chinese.json').write_text(json.dumps(missing),encoding='utf8')
print('COMPLETE',len(out),'missing',missing,flush=True)
