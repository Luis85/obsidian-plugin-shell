"""Capture clean synthetic-demo previews; same documented rendering/storage harness as tests."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, hashlib, os
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'jev-studio.html').read_text()
STORAGE="""() => {const data={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>delete data[k]}})}"""
files=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1512,'height':982})
    page.evaluate(STORAGE)
    page.set_content(HTML)
    page.wait_for_timeout(250)
    for name in ['preview-compose.png']:
        page.screenshot(path=str(ROOT/'evidence'/name),full_page=True);files.append(name)
    page.locator('.workspace-tabs').get_by_role('button',name='Test bench',exact=True).click()
    page.get_by_role('button',name='Replay fixture',exact=True).click()
    page.wait_for_timeout(4600)
    name='preview-testbench.png';page.screenshot(path=str(ROOT/'evidence'/name),full_page=True);files.append(name)
    page.locator('.workspace-tabs').get_by_role('button',name='Compose',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(150)
    name='preview-mobile.png';page.screenshot(path=str(ROOT/'evidence'/name),full_page=True);files.append(name)
    browser.close()
(ROOT/'evidence/previews.json').write_text(json.dumps({'artifactSha256':hashlib.sha256(HTML.encode()).hexdigest(),'renderMode':'exact bytes via set_content; in-memory Storage harness; synthetic demo only','screenshots':files},indent=2)+'\n')
print('Captured clean synthetic-demo previews.')
