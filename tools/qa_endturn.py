from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:4173',wait_until='networkidle')
    page.evaluate('''async()=>{
      const {Engine}=await import('/engine.mjs');
      const [cards,rules,decks]=await Promise.all(['cards','rules','decks'].map(async n=>(await fetch('/data/'+n+'.json')).json()));
      const e=new Engine(cards,rules,{seed:42});e.start(['ST01','ST02'].map(n=>decks.find(d=>d.name.startsWith(n))));
      e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});
      const c=e.card('OP06-006',0,'field');c.joined=-1;e.s.players[0].turns=2;e.dispatch({type:'attach',uid:c.uid});
      for(let i=0;i<2;i++){c.rested=false;e.dispatch({type:'attack',uid:c.uid,target:e.list(1,'leader')[0].uid});e.dispatch({type:'choose',value:'finish'});if(e.s.prompt?.type==='lifeTrigger')e.dispatch({type:'choose',value:'no'});}
      e.card('OP06-006',0,'field');e.dispatch({type:'endTurn'});
      localStorage.setItem('opcg-game',JSON.stringify({s:e.s,seed:e.seed,serial:e.serial}));
    }''')
    page.reload(wait_until='networkidle');page.locator('[data-resume]').click()
    assert '顺序' in page.locator('.operation-guide').inner_text()
    page.locator('[data-answer="1"]').click()
    for _ in range(2):
        assert page.locator('[data-confirmtargets]').is_disabled()
        page.locator('.self .characters .table-card').first.click()
        page.locator('[data-confirmtargets]').click()
    saved=page.evaluate('JSON.parse(localStorage.getItem("opcg-game"))')
    assert saved['s']['active']==1
    assert not saved['s']['endings']
    assert not errors,errors
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    print('Mobile delayed effects: saved order prompt resumes, both required effects resolve, then next player starts; no browser errors.')
    browser.close()
