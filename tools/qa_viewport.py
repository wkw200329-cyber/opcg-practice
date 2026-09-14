from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch()
    for width,height in [(1908,925),(1440,900),(1095,700),(844,390),(667,375),(390,844)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:4173',wait_until='networkidle')
        page.locator('[data-act="start"]').click()
        if width<height:page.locator('[data-fit]').click()
        assert page.locator('[data-fit]').get_attribute('aria-pressed')=='true'
        def check():
            bounds=page.locator('.fit-canvas').bounding_box()
            assert bounds['y']+bounds['height']<=page.viewport_size['height']+1,bounds
            assert bounds['x']>=0 and bounds['x']+bounds['width']<=page.viewport_size['width']+1,bounds
            assert not page.evaluate('document.documentElement.scrollHeight>innerHeight+1 || document.documentElement.scrollWidth>innerWidth+1')
        check()
        page.locator('[data-answer="keep"]').click();page.locator('[data-answer="keep"]').click()
        page.locator('[data-gamecommand="endTurn"]').click();check()
        page.screenshot(path=f'qa/fit-{width}.png',full_page=True)
        page.locator('.opponent .leader-slot button').click()
        assert page.locator('dialog').is_visible()
        page.locator('[data-act="close"]').click()
        page.locator('[data-fit]').click()
        assert page.locator('[data-fit]').get_attribute('aria-pressed')=='false'
        page.reload(wait_until='networkidle');page.locator('[data-resume]').click()
        assert page.locator('[data-fit]').get_attribute('aria-pressed')=='false'
        page.locator('[data-fit]').click();check()
        page.set_viewport_size({'width':height,'height':width})
        page.wait_for_timeout(100);check()
        assert not errors,errors
        print(f'{width}x{height}: entire table fits, actions and details work, preference persists, rotation refits')
        page.close()
    browser.close()
