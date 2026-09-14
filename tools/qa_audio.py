from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('''window.audioStarts=0;
      const start=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(...args){window.audioStarts++;return start.apply(this,args)};''')
    page.goto('http://127.0.0.1:4173',wait_until='networkidle')
    page.locator('[data-act="start"]').click()
    page.wait_for_function('window.audioStarts>0')
    page.locator('[data-answer="keep"]').click();page.locator('[data-answer="keep"]').click()
    page.locator('.sound-settings summary').click()
    page.locator('[data-soundvolume]').fill('22')
    page.locator('[data-soundmute]').click()
    assert page.evaluate('JSON.parse(localStorage.getItem("opcg-audio")).muted')
    page.reload(wait_until='networkidle')
    page.locator('[data-resume]').click()
    page.locator('[data-gamecommand="endTurn"]').click()
    assert page.evaluate('window.audioStarts')==0
    page.locator('.sound-settings summary').click()
    assert page.locator('[data-soundvolume]').input_value()=='22'
    assert page.locator('[data-soundmute]').get_attribute('aria-pressed')=='true'
    page.locator('[data-soundmute]').click()
    page.wait_for_function('window.audioStarts>0')
    result=page.evaluate('''async()=>{
      const {GameSound}=await import('/sound.mjs');const s=new GameSound();s.unlock();
      const buffers=await Promise.all(['start','attack','damage','draw','deploy','discard','don','counter'].map(n=>s.buffer(n)));
      const durations=buffers.map(b=>b?.duration);await s.context.close();return durations;
    }''')
    assert all(v and 0<v<2 for v in result),result
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    assert not errors,errors
    print('Audio passed: start playback, eight sound mappings decode, mute persists and suppresses playback, volume persists, unmute plays, mobile layout fits.')
    browser.close()
