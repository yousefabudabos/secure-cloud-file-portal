"""Existing auth/resource checks, adapted to the confirmation dialog UX."""
import collections
import json
import re
import urllib.request
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

import os
origin=os.environ.get('PORTAL_TEST_URL','http://127.0.0.1:5173')
source=urllib.request.urlopen(origin+'/src/App.tsx').read().decode()
react_path=re.search(r'from "([^"]*/react\.js[^\"]*)"',source).group(1)
auth_stub='''
import React from REACT_PATH;
let state = window.__initialAuth || {isAuthenticated:false,isLoading:false,user:null};
const listeners = new Set();
window.__setTestAuth = next => {state=next; listeners.forEach(fn=>fn());};
export function useAuth() {
    return React.useSyncExternalStore(fn=>{listeners.add(fn);return ()=>listeners.delete(fn)},()=>state);
}
export function AuthProvider({children}) {return children;}
'''.replace('REACT_PATH',json.dumps(react_path))

def auth(token):
    return {'isAuthenticated':True,'isLoading':False,'user':{'access_token':token,'profile':{'email':'fixture@example.test'}}}

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context()
    context.route('**/react-oidc-context.js*',lambda route:route.fulfill(status=200,content_type='application/javascript',body=auth_stub))
    calls=[]
    fail_shares=False
    def api(route):
        req=route.request
        path=urlparse(req.url).path
        assert path in ['/files','/shares','/external-shares'],path
        assert req.headers.get('authorization') in ['Bearer fixture-token-1','Bearer fixture-token-2','Bearer fixture-token-3']
        calls.append((req.method,path,req.headers.get('authorization')))
        if req.method=='DELETE':
            assert path=='/files'
            assert req.post_data_json=={'key':'onboarding.txt'}
            payload={}
        elif path=='/files':
            payload={'files':[{'key':'onboarding.txt','size':1024,'lastModified':'2026-10-29T00:00:00Z'}]}
        else:
            payload={'shares':[]}
        route.fulfill(status=500 if fail_shares and path=='/shares' else 200,content_type='application/json',body=json.dumps(payload))
    context.route(re.compile(r'https://[^/]+\.execute-api\.[^/]+\.amazonaws\.com/.*'),api)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin,wait_until='networkidle')
    assert page.get_by_role('button',name='تسجيل الدخول بحساب الشركة').is_visible()
    assert not calls
    page.evaluate('state=>window.__setTestAuth(state)',auth(None))
    page.wait_for_timeout(100)
    assert not calls
    page.evaluate('state=>window.__setTestAuth(state)',auth('fixture-token-1'))
    page.locator('#my-files strong.bidi-safe').get_by_text('onboarding.txt',exact=True).wait_for()
    page.wait_for_load_state('networkidle')
    assert collections.Counter((method,path) for method,path,_ in calls)=={('GET','/files'):1,('GET','/shares'):1,('GET','/external-shares'):1},calls
    print('PASS: no requests without authentication/token; authenticated dashboard loads all three unchanged GET endpoints with bearer headers')
    page.evaluate('state=>window.__setTestAuth(state)',auth('fixture-token-1'))
    page.wait_for_timeout(100)
    assert len(calls)==3,calls
    page.evaluate('state=>window.__setTestAuth(state)',auth('fixture-token-2'))
    page.wait_for_load_state('networkidle')
    page.wait_for_function("document.querySelector('#my-files .empty-state') === null")
    page.wait_for_timeout(100)
    assert len(calls)==6,calls
    assert all(token=='Bearer fixture-token-2' for _,_,token in calls[3:])
    print('PASS: same-token context render does not refetch; token change refreshes all three resources with the new token')
    page.on('dialog',lambda dialog:dialog.accept())
    page.locator('#my-files').get_by_role('button',name='حذف',exact=True).click()
    page.get_by_role('alertdialog').get_by_role('button',name='حذف الملف',exact=True).click()
    page.locator('.toast').get_by_text('File deleted successfully.',exact=True).wait_for()
    page.wait_for_load_state('networkidle')
    assert len(calls)==8 and calls[-2][:2]==('DELETE','/files') and calls[-1][:2]==('GET','/files'),calls
    print('PASS: existing delete request body and post-mutation file refresh are preserved')
    fail_shares=True
    page.evaluate('state=>window.__setTestAuth(state)',auth('fixture-token-3'))
    page.locator('#shared-with-me .empty-state').get_by_text('Unable to load shared files.',exact=True).wait_for()
    page.wait_for_load_state('networkidle')
    assert len(calls)==11,calls
    assert page.locator('#my-files strong.bidi-safe').get_by_text('onboarding.txt',exact=True).is_visible()
    assert not errors,errors
    print('PASS: API error handling remains visible while independent resources load; no JavaScript exceptions')
    fail_shares=False
    calls.clear()
    page.close()
    context.add_init_script('window.__initialAuth='+json.dumps(auth('fixture-token-1')))
    page=context.new_page()
    page.goto(origin,wait_until='networkidle')
    page.locator('#my-files strong.bidi-safe').get_by_text('onboarding.txt',exact=True).wait_for()
    assert len(calls)==3,calls
    print('PASS: StrictMode authenticated mount performs exactly one request per resource')
    context.close()
    browser.close()
