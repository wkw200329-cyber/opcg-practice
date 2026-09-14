"""Read the supplied Unity card objects; preserve originals; export browser assets."""
from pathlib import Path
import struct,json,re,concurrent.futures
import UnityPy
from PIL import Image
ROOT=Path(r'E:\游戏\Builds_Windows'); OUT=Path('dist'); (OUT/'data').mkdir(parents=True,exist_ok=True); (OUT/'cards').mkdir(exist_ok=True)
class Reader:
    def __init__(self,b): self.b=b; self.p=28
    def i(self): v=struct.unpack_from('<i',self.b,self.p)[0]; self.p+=4; return v
    def s(self): n=self.i(); assert 0<=n<10000; v=self.b[self.p:self.p+n].decode('utf8'); self.p=(self.p+n+3)&~3; return v
    def arr(self): n=self.i(); assert 0<=n<1000; return [self.i() for _ in range(n)]
env=UnityPy.load(str(ROOT/'OPTCGSim_Data/resources.assets')); cards=[]
for o in env.objects:
    if o.type.name!='MonoBehaviour': continue
    r=Reader(o.get_raw_data())
    try:
        name=r.s()
        if not re.fullmatch(r'(?:OP|EB|ST|PRB|P)\d*-\d{3}',name): continue
        cid=r.s()
        if cid!=name: continue
        block=r.i(); typ=r.i(); en=r.s(); strike=r.i(); life=r.i(); power=r.i(); counter=r.i(); cats=r.arr(); cost=r.i(); colors=r.arr()
        assert typ in range(4) and all(c in range(6) for c in colors)
        cards.append(dict(id=cid,nameEn=en,type=['领袖','角色','事件','舞台'][typ],life=life,power=power,counter=counter,cost=cost,colors=[['红','绿','蓝','紫','黑','黄'][c] for c in colors],set=cid.split('-')[0],image=f'cards/{cid}.webp'))
    except (ValueError,AssertionError,struct.error,UnicodeDecodeError): continue
cards=sorted({c['id']:c for c in cards}.values(),key=lambda c:c['id'])
(OUT/'data/base.json').write_text(json.dumps(cards,ensure_ascii=False),encoding='utf8')
images={}
for p in (ROOT/'OPTCGSim_Data/StreamingAssets/Cards').rglob('*'):
    if p.is_file() and '_small' not in p.stem: images[p.stem]=p
def convert(c):
    src=images.get(c['id']); dest=OUT/c['image']
    if not src: return c['id']
    if not dest.exists():
        im=Image.open(src).convert('RGB'); im.thumbnail((560,800)); im.save(dest,'WEBP',quality=85,method=4)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: missing=[x for x in pool.map(convert,cards) if x]
decks=[]
for p in list((ROOT/'Decks').glob('*.deck'))+list(Path('tools/cache').glob('ST*.txt')):
    entries=re.findall(r'(?m)^\s*(\d+)\s*x?\s*((?:OP|EB|ST|PRB|P)\d*-\d{3})',p.read_text(encoding='utf-8-sig'))
    if entries: decks.append({'name':p.stem,'cards':{cid:int(n) for n,cid in entries}})
(OUT/'data/decks.json').write_text(json.dumps(decks,ensure_ascii=False),encoding='utf8')
print(json.dumps({'cards':len(cards),'decks':len(decks),'missingImages':missing,'sets':sorted(set(c['set'] for c in cards))}),flush=True)
