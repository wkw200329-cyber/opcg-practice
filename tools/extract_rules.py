"""Decode serialized rule graphs using field order recovered from the supplied assembly."""
from pathlib import Path
import re,struct,json,collections
import UnityPy
SRC=Path('tools/cache/decompiled'); OUT=Path('dist/data');schemas={};enums={}
for p in SRC.glob('*.cs'):
    s=p.read_text(encoding='utf-8-sig')
    if re.search(r'public enum '+p.stem+r'\b',s):
        vals={};v=0
        for name,explicit in re.findall(r'^\s*([A-Za-z_]\w*)(?:\s*=\s*(-?\d+))?\s*,?\s*$',s,re.M):
            if name in ['using','public']:continue
            if explicit:v=int(explicit)
            vals[v]=name;v+=1
        enums[p.stem]=vals
    else:
        schemas[p.stem]=re.findall(r'^\s*public\s+([\w<> ,]+)\s+(\w+)\s*;',s,re.M)
class Reader:
    def __init__(self,b):self.b=b;self.p=28
    def align(self):self.p=(self.p+3)&~3
    def i(self):v=struct.unpack_from('<i',self.b,self.p)[0];self.p+=4;return v
    def read(self,t,depth=0):
        assert depth<30,(t,self.p)
        if t in ['int','uint']:return self.i()
        if t=='GrantedAction':
            v=struct.unpack_from('<q',self.b,self.p)[0];self.p+=8;return None if v==-2 else {'reference':v}
        if t=='bool':v=self.b[self.p]!=0;self.p+=1;self.align();return v
        if t=='float':v=struct.unpack_from('<f',self.b,self.p)[0];self.p+=4;return v
        if t=='string':
            n=self.i();assert 0<=n<100000,(t,n,self.p);v=self.b[self.p:self.p+n].decode('utf8');self.p+=n;self.align();return v
        if t.startswith('List<'):
            n=self.i();assert 0<=n<10000,(t,n,self.p);return [self.read(t[5:-1],depth+1) for _ in range(n)]
        if t in enums:
            v=self.i();return enums[t].get(v,v)
        if t in schemas:
            return {name:self.read(typ,depth+1) for typ,name in schemas[t]}
        raise ValueError((t,self.p))
def compact(x):
    if isinstance(x,dict):return {k:compact(v) for k,v in x.items() if v not in [False,0,'',None,[]]}
    if isinstance(x,list):return [compact(v) for v in x]
    return x
env=UnityPy.load(r'E:\游戏\Builds_Windows\OPTCGSim_Data\resources.assets');out={};fail=[]
for o in env.objects:
    if o.type.name!='MonoBehaviour':continue
    r=Reader(o.get_raw_data())
    try:name=r.read('string')
    except Exception:continue
    if not re.fullmatch(r'(?:OP|EB|ST|PRB|P)\d*-\d{3}',name):continue
    try:
        c=r.read('CardDefinition');assert c['cardID']==name
        assert len(r.b)-r.p>=20,(name,r.p,len(r.b))
        out[name]=compact(c)
    except Exception as e:fail.append((name,str(e)))
(OUT/'rules.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
Path('tools/cache/rule-schemas.json').write_text(json.dumps({'schemas':schemas,'enums':enums},ensure_ascii=False),encoding='utf8')
counts={}
for group in ['proc','details','target','effect']:
    ctr=collections.Counter()
    for c in out.values():
        for a in c.get('actionV3s',[]):
            parts=[a.get('proc',{})] if group=='proc' else [s.get(group,{}) for s in a.get('steps',[])]
            for p in parts:
                if isinstance(p,list):
                    for item in p:ctr.update(item.keys())
                else:ctr.update(p.keys())
    counts[group]=dict(ctr.most_common())
Path('tools/cache/rule-coverage-source.json').write_text(json.dumps(counts,ensure_ascii=False,indent=2),encoding='utf8')
print('decoded',len(out),'failures',fail[:12]);print('v3 cards',sum(bool(c.get('actionV3s')) for c in out.values()),'legacy cards',sum(bool(c.get('cardActions')) for c in out.values()))
print('ST01-001',json.dumps(out.get('ST01-001'),ensure_ascii=False))
