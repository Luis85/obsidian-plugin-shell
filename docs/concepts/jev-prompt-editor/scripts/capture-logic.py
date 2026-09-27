from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
r=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1600,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate("() => {const s={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>s[k]||null,setItem:(k,v)=>s[k]=v}})}")
 page.set_content((r/'jev-studio.html').read_text());page.wait_for_timeout(300)
 page.get_by_label('Open business logic',exact=True).click();page.wait_for_timeout(200)
 page.screenshot(path=str(r/'evidence/logic-flow.png'))
 page.get_by_role('button',name='Simulate flow',exact=True).click();page.screenshot(path=str(r/'evidence/logic-trace.png'))
 for tab,name in [('Business rules','rules'),('Processes','processes'),('Events','events')]:
  page.locator('.logic-tabs').get_by_role('button',name=tab,exact=(tab!='Events')).click();page.wait_for_timeout(100);page.screenshot(path=str(r/f'evidence/logic-{name}.png'))
 page.set_viewport_size({'width':390,'height':844});page.locator('.logic-tabs').get_by_role('button',name='Flows',exact=True).click();page.wait_for_timeout(100);page.screenshot(path=str(r/'evidence/logic-mobile.png'))
 print('errors',errors)
 b.close()
