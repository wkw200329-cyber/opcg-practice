from pathlib import Path
import UnityPy, json, collections
root=Path(r'E:\游戏\Builds_Windows\OPTCGSim_Data')
out=Path('tools/cache');out.mkdir(parents=True,exist_ok=True)
env=UnityPy.load(str(root/'resources.assets'))
counts=collections.Counter(o.type.name for o in env.objects)
print(counts)
for o in env.objects:
    if o.type.name=='TextAsset':
        t=o.read(); name=t.m_Name
        data=t.m_Script
        if isinstance(data,str): data=data.encode('utf-8',errors='surrogateescape')
        dest=out/(name.replace('/','_')+'.txt'); dest.write_bytes(data)
        print('TEXT',name,len(data),repr(data[:100]))
    elif o.type.name=='MonoBehaviour':
        try:
            t=o.read_typetree()
            if len(str(t))>1000:
                (out/('mono_'+str(o.path_id)+'.json')).write_text(json.dumps(t,ensure_ascii=False,default=str),encoding='utf-8')
                print('MONO',o.path_id,str(t)[:200])
        except Exception: pass
