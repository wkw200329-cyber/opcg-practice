from playwright.sync_api import sync_playwright
from pathlib import Path
import json
Path('qa').mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width,height in [(390,844),(1440,1000)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4173',wait_until='networkidle');page.locator('[data-act="start"]').wait_for()
        page.screenshot(path=f'qa/setup-{width}.png',full_page=True)
        page.locator('[data-act="start"]').click();page.locator('[data-answer="keep"]').wait_for();page.locator('[data-answer="keep"]').click();page.locator('[data-answer="keep"]').click()
        page.locator('.game-board').wait_for();page.screenshot(path=f'qa/table-{width}.png',full_page=True)
        page.locator('[data-gamecommand="endTurn"]').click()
        assert 'P1' in page.locator('.self .side-title strong').inner_text()
        assert 'P2' in page.locator('.opponent .side-title strong').inner_text()
        assert '当前回合' in page.locator('.opponent .side-title strong').inner_text()
        assert 'P2' in page.locator('.hand-area .side-title strong').inner_text()
        assert page.locator('.opponent').bounding_box()['y'] < page.locator('.self').bounding_box()['y']
        assert page.locator('[data-swap]').count()==0
        page.reload(wait_until='networkidle');page.locator('[data-resume]').click()
        assert 'P1' in page.locator('.self .side-title strong').inner_text()
        assert 'P2' in page.locator('.hand-area .side-title strong').inner_text()
        page.locator('[data-gamecommand="endTurn"]').click()
        page.locator('[data-gamecommand="undo"]').click()
        assert 'P1' in page.locator('.self .side-title strong').inner_text()
        assert 'P2' in page.locator('.hand-area .side-title strong').inner_text()
        page.locator('[data-gamecommand="endTurn"]').click()
        page.locator('.self .leader-slot button').click();assert page.locator('dialog').is_visible()
        page.locator('[data-attachuid]').click()
        assert 'DON!! ×1' in page.locator('.self .leader-slot').inner_text()
        page.reload(wait_until='networkidle');page.locator('[data-resume]').click();assert 'DON!! ×1' in page.locator('.self .leader-slot').inner_text()
        overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth')
        assert not overflow,'horizontal overflow'
        assert not errors,errors
        print(json.dumps({'width':width,'errors':errors,'horizontalOverflow':overflow,'flow':'start / keep / turn / undo / attach / save / reload / resume passed'}),flush=True)
        page.close()
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:4173',wait_until='networkidle')
    page.evaluate('''async () => {
      const {Engine}=await import('/engine.mjs');
      const [cards,rules,decks]=await Promise.all(['cards','rules','decks'].map(async n=>(await fetch('/data/'+n+'.json')).json()));
      const e=new Engine(cards,rules,{seed:42});
      e.start(['ST01','ST02'].map(n=>decks.find(d=>d.name.startsWith(n))));
      e.dispatch({type:'choose',value:'keep'});e.dispatch({type:'choose',value:'keep'});
      const l=e.list(0,'leader')[0];l.id='ST04-001';
      for(const d of e.list(0,'donReserve'))e.move(d,'don');
      e.don(0)[0].attached=l.uid;e.don(0)[1].rested=true;
      e.dispatch({type:'activate',uid:l.uid,index:0});
      localStorage.setItem('opcg-game',JSON.stringify({s:e.s,seed:e.seed,serial:e.serial}));
    }''')
    page.reload(wait_until='networkidle');page.locator('[data-resume]').click()
    assert page.locator('.selection-cards .don-card').count()==10
    assert '附加于' in page.locator('.selection-cards').inner_text()
    assert page.locator('[data-confirmtargets]').is_disabled()
    for i in range(7):page.locator('.selection-cards .don-card').nth(i).click()
    assert page.locator('.selection-number').count()==7
    assert not page.locator('[data-confirmtargets]').is_disabled()
    page.screenshot(path='qa/don-selection-390.png',full_page=True)
    page.locator('[data-confirmtargets]').click();page.locator('[data-answer="1"]').click()
    saved=page.evaluate('JSON.parse(localStorage.getItem("opcg-game"))')
    assert len(saved['s']['players'][0]['don'])==3
    assert len(saved['s']['players'][0]['donReserve'])==7
    assert page.locator('.opponent .life-area>strong').inner_text()=='4'
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    assert not errors,errors
    print('Mobile DON selection: 10 visible, seven chosen and returned, life effect resolved; no browser errors.',flush=True)
    browser.close()
