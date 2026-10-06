#!/usr/bin/env python3
"""CASE 404 — headless browser smoke test + screenshots (Playwright).
Walks: boot -> menu -> new game -> CASE 000 full flow (tutorial) -> case select,
then into CASE 001 opening + phone + board + evidence. Collects console errors."""
import asyncio, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SHOTS = os.path.join(ROOT, 'docs', 'screenshots')
os.makedirs(SHOTS, exist_ok=True)
URL = 'http://localhost:8099/index.html'
VIEW = {'width': 390, 'height': 844}
MIDX, TAPY = VIEW['width'] / 2, VIEW['height'] * 0.72

errors = []

async def tap_generic(page, n=1, delay=0.12):
    for _ in range(n):
        await page.touchscreen.tap(MIDX, TAPY)
        await page.wait_for_timeout(int(delay * 1000))

async def drain_inspect(page, max_taps=14):
    """Tap an inspect panel until it closes."""
    for _ in range(max_taps):
        loc = page.locator('.inspect-panel')
        if await loc.count() == 0:
            break
        try:
            await loc.first.tap(timeout=1200)
        except Exception:
            break
        await page.wait_for_timeout(140)
    await page.wait_for_timeout(520)  # fade + removal

async def drain_narrative(page, max_taps=40, settle=0.3):
    """Advance narrative lines while a narr-box is on screen (tap the box itself)."""
    for i in range(max_taps):
        box = page.locator('.narr-box')
        if await box.count() == 0:
            break
        try:
            await box.last.tap(timeout=1200)
        except Exception:
            break
        await page.wait_for_timeout(int(settle * 1000))
    await page.wait_for_timeout(450)

async def drain_dialogue(page, max_taps=16):
    """Tap the dialogue body until options appear or dialogue closes."""
    for _ in range(max_taps):
        opts = page.locator('.dlg-opt')
        if await opts.count() > 0:
            break
        body = page.locator('.dlg-body')
        if await body.count() == 0:
            break
        try:
            await body.first.tap(timeout=1200)
        except Exception:
            break
        await page.wait_for_timeout(300)
    await page.wait_for_timeout(350)

async def drain_court(page, max_taps=60):
    """Advance courtroom 'line' segments via CONTINUE buttons."""
    for _ in range(max_taps):
        cont = page.locator('.court-cont')
        if await cont.count() == 0:
            break
        try:
            await cont.first.tap(timeout=1200)
        except Exception:
            break
        await page.wait_for_timeout(200)
    await page.wait_for_timeout(400)

async def shot(page, name):
    await page.screenshot(path=os.path.join(SHOTS, name))
    print('shot:', name)

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport=VIEW, is_mobile=True, has_touch=True)
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(str(e)))

        await page.goto(URL)
        await page.wait_for_timeout(1200)
        assert await page.locator('.boot-404').count() > 0, 'boot screen missing'
        await shot(page, '01-boot.png')

        await page.locator('#bootScreen').tap()
        await page.wait_for_timeout(800)
        assert await page.locator('.menu-screen').count() > 0, 'menu missing'
        await shot(page, '02-main-menu.png')

        await page.locator('.menu-btn[data-nav="new"]').tap()
        await page.wait_for_timeout(400)
        await page.locator('#ngYes').tap()
        await page.wait_for_timeout(800)
        assert await page.locator('.brief-screen').count() > 0, 'case brief missing'
        await shot(page, '03-case-brief.png')
        await page.locator('.brief-start').tap()
        await page.wait_for_timeout(700)

        # CASE 000 intro narrative
        await drain_narrative(page, max_taps=30)
        assert await page.locator('.hub-screen').count() > 0, 'hub missing'
        await shot(page, '04-investigation-hub.png')

        # east lounge -> inspect all hotspots
        await page.locator('.hub-opt', has_text='East Lounge').tap()
        await page.wait_for_timeout(600)
        await shot(page, '05-location-inspect.png')
        for i in range(6):
            await page.locator('.loc-hotspot').nth(i).tap()
            await page.wait_for_timeout(350)
            await drain_inspect(page)
        await page.locator('.loc-leave').tap()
        await page.wait_for_timeout(600)

        # gym office -> ledger
        await page.locator('.hub-opt', has_text='Gym Office').tap()
        await page.wait_for_timeout(600)
        await page.locator('.loc-hotspot').nth(0).tap()
        await page.wait_for_timeout(350)
        await drain_inspect(page)
        await page.locator('.loc-leave').tap()
        await page.wait_for_timeout(600)

        # talk to Daniel -> get his claim -> leave
        await page.locator('.hub-opt', has_text='Daniel Fox').tap()
        await page.wait_for_timeout(600)
        opt = page.locator('.dlg-opt', has_text='Where were you this evening?')
        await opt.wait_for(timeout=8000)
        assert await opt.count() > 0, 'daniel options missing'
        await opt.tap()
        await page.wait_for_timeout(400)
        # his claim plays -> tap body to continue -> back to topic list
        await drain_dialogue(page)
        end = page.locator('.dlg-opt', has_text='Fine. Routine')
        await end.wait_for(timeout=8000)
        await end.tap()
        await page.wait_for_timeout(600)
        await shot(page, '06-dialogue.png')

        # proceed to confrontation
        proceed = page.locator('.hub-proceed')
        assert await proceed.is_enabled(), 'proceed not enabled (evidence flow broken)'
        await proceed.tap()
        await page.wait_for_timeout(700)
        await shot(page, '07-contradiction.png')

        # present e_sheet
        item = page.locator('.ps-item', has_text='Gym Attendance Sheet')
        assert await item.count() > 0, 'present sheet missing'
        await item.tap()
        await page.wait_for_timeout(2700)  # stamp animation
        await drain_narrative(page, max_taps=20, settle=0.25)

        # present e_print
        item2 = page.locator('.ps-item', has_text='Muddy Boot Print')
        assert await item2.count() > 0, 'second present sheet missing'
        await item2.tap()
        await page.wait_for_timeout(2700)  # stamp animation
        await drain_narrative(page, max_taps=20, settle=0.25)

        # decision
        if await page.locator('.screen.decision').count() == 0:
            print('DIAG screens:', await page.evaluate("[...document.querySelectorAll('#stage .screen')].map(s=>s.className)"))
            print('DIAG overlay:', await page.evaluate("document.getElementById('overlay').innerHTML.slice(0,120)"))
            print('DIAG narr:', await page.evaluate("[...document.querySelectorAll('.narr-box')].map(b=>b.querySelector('.narr-text')?.textContent?.slice(0,60))"))
            await shot(page, 'DEBUG-decision-missing.png')
        assert await page.locator('.screen.decision').count() > 0, 'decision missing'
        await shot(page, '08-decision.png')
        await page.locator('.decision-opt', has_text='Daniel Fox').first.tap()
        await page.wait_for_timeout(700)
        await drain_narrative(page, max_taps=30, settle=0.3)
        await page.wait_for_timeout(2300)

        if await page.locator('.complete-screen').count() == 0:
            print('DIAG2 screens:', await page.evaluate("[...document.querySelectorAll('#stage .screen')].map(s=>s.className)"))
            print('DIAG2 narr:', await page.evaluate("[...document.querySelectorAll('.narr-box')].map(b=>b.querySelector('.narr-text')?.textContent?.slice(0,60))"))
            await shot(page, 'DEBUG-complete-missing.png')
        assert await page.locator('.complete-screen').count() > 0, 'case complete screen missing'
        await shot(page, '09-case-complete.png')
        saved = await page.evaluate("localStorage.getItem('case404_save_auto')")
        assert saved and '"unlocked":1' in saved.replace(' ', ''), 'autosave missing unlock:1'

        # ccNext flows straight into the next playable case brief (CASE 001)
        await page.locator('#ccNext').tap()
        await page.wait_for_timeout(900)
        assert await page.locator('.brief-screen').count() > 0, 'case 001 brief missing'
        assert 'CASE 001' in await page.locator('.brief-code').text_content(), 'wrong case brief'
        await shot(page, '10-case-complete-next.png')
        await page.locator('.brief-start').tap()
        await page.wait_for_timeout(600)
        await drain_narrative(page, max_taps=30)
        assert await page.locator('.hub-screen').count() > 0, 'case 001 hub missing'
        await shot(page, '11-case001-hub.png')

        # annex: front desk -> kessler pass; server -> ERROR 404
        await page.locator('.hub-opt', has_text='County Records Annex').tap()
        await page.wait_for_timeout(600)
        await page.locator('.loc-hotspot').nth(0).tap()
        await page.wait_for_timeout(350)
        await drain_inspect(page)
        await page.locator('.loc-hotspot').nth(3).tap()  # server cabinet
        await page.wait_for_timeout(350)
        await drain_inspect(page)
        await page.locator('.loc-leave').tap()
        await page.wait_for_timeout(600)

        # phone
        await page.locator('#tbPhone').tap()
        await page.wait_for_timeout(600)
        await shot(page, '12-phone.png')
        await page.locator('.ph-app', has_text='Messages').tap()
        await page.wait_for_timeout(400)
        thread = page.locator('.ph-thread', has_text='EMMA REED')
        if await thread.count():
            await thread.tap()
            await page.wait_for_timeout(400)
            await shot(page, '13-phone-messages.png')
            # in a thread with actions there is a CLOSE PHONE button; otherwise home toggles
            done = page.locator('.ph-done')
            if await done.count():
                await done.tap()
            else:
                await page.locator('.phone-home').tap()
                await page.wait_for_timeout(250)
                await page.locator('.phone-home').tap()
        else:
            await page.locator('.phone-home').tap()
            await page.wait_for_timeout(250)
            await page.locator('.phone-home').tap()
        await page.wait_for_timeout(500)

        # board
        await page.locator('#tbBoard').tap()
        await page.wait_for_timeout(700)
        await shot(page, '14-board.png')
        await page.locator('.board-close').tap()
        await page.wait_for_timeout(500)

        # evidence archive
        await page.locator('#tbEvidence').tap()
        await page.wait_for_timeout(600)
        await shot(page, '15-evidence-archive.png')
        await page.locator('.ov-close').first.tap()
        await page.wait_for_timeout(400)

        # case select via pause menu (shows CASE 001 current + 002+ sealed)
        await page.locator('#tbMenu').tap()
        await page.wait_for_timeout(400)
        await page.locator('button[data-a="select"]').tap()
        await page.wait_for_timeout(600)
        await shot(page, '16-case-select.png')
        await page.locator('.ov-close.back').tap()
        await page.wait_for_timeout(400)

        # reload -> Continue should resume CASE 001 hub (save system)
        await page.reload()
        await page.wait_for_timeout(1200)
        await page.locator('#bootScreen').tap()
        await page.wait_for_timeout(800)
        await page.locator('.menu-btn[data-nav="resume"]').tap()
        await page.wait_for_timeout(1200)
        # resuming mid-case should land on the annex location phase (last saved phase)
        ok = await page.locator('.loc-screen, .hub-screen').count() > 0
        assert ok, 'continue/resume did not restore the case'
        await shot(page, '17-resume.png')

        await browser.close()

    print('\nCONSOLE ERRORS:', len(errors))
    for e in errors[:12]:
        print('  !', e)
    if errors:
        sys.exit(1)
    print('SMOKE TEST PASSED')

asyncio.run(main())
