"""Existing browser scenarios adapted for modal/toast UX; all remote calls mocked."""
import json
import os
import re
import sys
import urllib.request
from email.parser import BytesParser
from email.policy import default
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ORIGIN=os.environ.get('PORTAL_TEST_URL','http://127.0.0.1:5173')
source=urllib.request.urlopen(ORIGIN+'/src/App.tsx').read().decode()
configuration=json.loads(re.search(r'import.meta.env = (\{.*?\});',source).group(1))
API=configuration['VITE_API_URL'].rstrip('/')
APP_URL=configuration.get('VITE_APP_URL', ORIGIN).rstrip('/')
KEY='private/fixture/12345678-1234-1234-1234-123456789012-report.txt'
SHARED_KEY='private/other/shared.txt'
TOKEN='fixture-access-token'
AUTH={'isAuthenticated':True,'isLoading':False,'user':{'access_token':TOKEN,'profile':{'email':'fixture@example.test'}}}
STORAGE='https://portal-storage.example.test'

class Checks:
    def __init__(self,browser,origin):
        self.browser=browser; self.origin=origin
        self.calls=[]; self.snapshots={}; self.dialogs=[]; self.errors=[]
        self.internal_mode='success'; self.external_mode='success'; self.download_mode='success'; self.revoke_mode='success'; self.clipboard_fail=False
        self.files=[{'key':KEY,'size':2048,'lastModified':'2026-10-29T00:00:00Z'}]
        self.shares=[{'shareId':'internal-1','objectKey':SHARED_KEY,'fileName':'shared.txt','ownerSub':'fixture-owner','createdAt':'2026-10-28T00:00:00Z'}]
        self.external=[{'shareId':'external-'+status,'objectKey':KEY,'fileName':status+'.txt','recipientEmail':'recipient@example.test' if status=='active' else '', 'createdAt':'2026-10-28T00:00:00Z','expiresAt':1793318400,'downloadCount':2,'maxDownloads':5,'status':status} for status in ['active','revoked','expired','limit_reached']]
        self.context=self.browser.new_context(locale='en-US',timezone_id='UTC',accept_downloads=True,viewport={'width':1440,'height':1100},reduced_motion='reduce')
        source=urllib.request.urlopen(origin+'/src/App.tsx').read().decode()
        react_path=re.search(r'from "([^"]*/react\.js[^\"]*)"',source).group(1)
        stub='''import React from REACT_PATH;
let state={isAuthenticated:false,isLoading:false,user:null};
const listeners=new Set();
const actions={signinRedirect:async()=>{window.__signins=(window.__signins||0)+1},removeUser:async()=>{window.__removed=(window.__removed||0)+1;await window.__recordRemoved()}};
window.__setTestAuth=next=>{state={...next,...actions};listeners.forEach(fn=>fn())};
export function useAuth(){return React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state)}
export function AuthProvider({children,...props}){window.__provider=props;return children}
'''.replace('REACT_PATH',json.dumps(react_path))
        self.context.add_init_script('''window.__copies=[];window.__denyClipboard=false;
Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text)=>{if(window.__denyClipboard)throw new Error('fixture denied');window.__copies.push(text)}}});''')
        self.removed=False
        self.context.expose_function('__recordRemoved',self.record_removed)
        self.context.set_default_timeout(10000)
        self.context.route('**/react-oidc-context.js*',lambda r:r.fulfill(status=200,content_type='application/javascript',body=stub))
        self.context.route(re.compile(r'https://.*'),self.route)
        self.page=self.context.new_page()
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.on('dialog',self.dialog)
        self.confirm=True
    def record_removed(self):self.removed=True
    def dialog(self,d):
        self.dialogs.append((d.type,d.message))
        if d.type=='alert' or self.confirm:d.accept()
        else:d.dismiss()
    def route(self,r):
        q=r.request; path=urlparse(q.url).path
        if q.url.startswith(STORAGE+'/download'):
            r.fulfill(status=200,headers={'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="fixture.txt"'},body='fixture download')
            return
        if q.url==STORAGE+'/upload':
            assert q.method=='POST'
            assert 'authorization' not in q.headers
            msg=BytesParser(policy=default).parsebytes(('Content-Type: '+q.headers['content-type']+'\r\n\r\n').encode()+q.post_data_buffer)
            parts=[(part.get_param('name',header='content-disposition'),part.get_filename(),part.get_payload(decode=True).decode()) for part in msg.iter_parts()]
            assert parts==[('key',None,'fixture-upload.txt'),('policy',None,'fixture-policy'),('x-amz-algorithm',None,'AWS4-HMAC-SHA256'),('file','upload.txt','fixture upload')],parts
            self.calls.append(('POST','storage-upload',parts))
            r.fulfill(status=204,body='')
            return
        if q.url.startswith(API+'/'):
            body=q.post_data_json if q.method!='GET' else None
            self.calls.append((q.method,path,body))
            if path=='/external-download':
                assert 'authorization' not in q.headers
                assert body=={'token':'hash-token'} or body=={'token':'query-token'}
            else:
                assert q.headers.get('authorization')=='Bearer '+TOKEN
            if body is not None: assert q.headers.get('content-type')=='application/json'
            status=200
            if q.method=='GET':
                assert 'content-type' not in q.headers
                if path=='/files':data={'files':self.files}
                elif path=='/shares':data={'shares':self.shares}
                elif path=='/external-shares':data={'shares':self.external}
                else:raise AssertionError(('Unexpected GET',path))
            elif path=='/uploads':
                assert body['fileName']=='upload.txt' and body['contentType'] in ['text/plain','application/octet-stream'],body
                data={'upload':{'url':STORAGE+'/upload','fields':{'key':'fixture-upload.txt','policy':'fixture-policy','x-amz-algorithm':'AWS4-HMAC-SHA256'}},'key':'fixture-upload.txt','expiresIn':300,'maxFileSize':104857600}
            elif path=='/downloads':
                assert body in [{'key':KEY},{'key':SHARED_KEY}],body
                if self.download_mode!='success':
                    r.fulfill(status=500,content_type='text/plain',body='not json')
                    return
                data={'downloadUrl':STORAGE+'/download'}
            elif path=='/shares':
                assert q.method=='POST' and body=={'key':KEY,'recipientEmail':'employee@example.test'},body
                if self.internal_mode=='error':status=400;data={'message':'fixture sharing denied'}
                else:data={'alreadyShared':self.internal_mode=='already'}
            elif path=='/external-shares' and q.method=='POST':
                assert body['key']==KEY and body['recipientEmail'] in ['outside@example.test','']
                assert body['expiresInHours'] in [24,72] and body['maxDownloads'] in [3,5]
                if self.external_mode=='error':status=400;data={'message':'fixture external denied'}
                else:
                    data={'shareId':'generated-share','token':'fixture token/+','expiresAt':1793318400,'expiresInHours':body['expiresInHours'],'maxDownloads':body['maxDownloads']}
                    self.external.append({'shareId':'generated-share','objectKey':KEY,'fileName':'report.txt','recipientEmail':body['recipientEmail'],'createdAt':'2026-10-29T00:00:00Z','expiresAt':1793318400,'downloadCount':0,'maxDownloads':body['maxDownloads'],'status':'active'})
            elif path=='/external-shares' and q.method=='DELETE':
                assert body['shareId'] in ['generated-share','external-active']
                if self.revoke_mode=='error':status=400;data={'message':'fixture revoke denied'}
                else:
                    for item in self.external:
                        if item['shareId']==body['shareId']:item['status']='revoked'
                    data={}
            elif path=='/files' and q.method=='DELETE':
                assert body=={'key':KEY}
                self.files=[]
                # Preserve the contract that success can have an empty body.
                r.fulfill(status=204,body='')
                return
            elif path=='/external-download':
                if self.download_mode=='success':data={'downloadUrl':STORAGE+'/download','downloadCount':2,'maxDownloads':3}
                else:status=400;data={'message':self.download_mode} if self.download_mode!='no-message' else {}
            else:raise AssertionError((q.method,path,body))
            r.fulfill(status=status,content_type='application/json',body=json.dumps(data))
            return
        if '.auth.' in urlparse(q.url).netloc and path=='/logout':
            assert self.removed
            self.logout=q.url
            r.fulfill(status=200,content_type='text/html',body='<p>Mock sign out</p>')
            return
        raise AssertionError('Unexpected external request: '+q.url)
    def snap(self,name):
        self.page.wait_for_load_state('networkidle')
        self.snapshots[name]=self.page.locator('#root').inner_html()
        self.page.locator('.toast-close').evaluate_all('(buttons)=>buttons.forEach(button=>button.click())')
    def settle(self):
        self.page.wait_for_timeout(100)
        self.page.wait_for_load_state('networkidle')
    def toast(self,message):
        return self.page.locator('.toast-viewport').get_by_text(message,exact=True)
    def confirm_action(self,trigger,label,accept=True):
        trigger.click()
        dialog=self.page.get_by_role('alertdialog')
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role('button',name='إلغاء',exact=True)).to_be_focused()
        dialog.get_by_role('button',name=label if accept else 'إلغاء',exact=True).click()
        expect(dialog).to_have_count(0)
    def run(self):
        p=self.page
        p.goto(self.origin,wait_until='networkidle')
        self.snap('login')
        # The sign-in method is invoked exactly as before.
        p.evaluate('window.__setTestAuth({isAuthenticated:false,isLoading:false,user:null})')
        p.get_by_role('button',name='تسجيل الدخول بحساب الشركة').click()
        assert p.evaluate('window.__signins')==1
        assert not self.calls
        p.evaluate('window.__setTestAuth({isAuthenticated:false,isLoading:true,user:null})')
        expect(p.locator('.loader')).to_be_visible();self.snap('auth-loading')
        p.evaluate('window.__setTestAuth({isAuthenticated:false,isLoading:false,user:null,error:{message:"fixture authentication error"}})')
        expect(p.get_by_text('fixture authentication error',exact=True)).to_be_visible();self.snap('auth-error')
        p.evaluate('state=>window.__setTestAuth(state)',AUTH)
        expect(p.locator('#my-files strong.bidi-safe').get_by_text('report.txt',exact=True)).to_be_visible()
        self.snap('dashboard')
        assert len(self.calls)==3,self.calls
        assert p.locator('.portal').get_attribute('dir')=='rtl'
        assert p.locator('#external-shares .status-active').inner_text()=='نشط'
        assert p.locator('#external-shares .status-revoked').inner_text()=='ملغي'
        assert p.locator('#external-shares .status-expired').inner_text()=='منتهي'
        assert p.locator('#external-shares .status-limit_reached').inner_text()=='وصل حد التنزيلات'
        assert p.locator('#external-shares button:visible').count()==1
        self.provider=p.evaluate('({authority,client_id,redirect_uri,response_type,scope})=>({authority,client_id,redirect_uri,response_type,scope})',p.evaluate('window.__provider'))
        p.evaluate("history.replaceState({},'', '/?code=fixture#state');window.__provider.onSigninCallback()")
        assert p.url==self.origin+'/'
        p.locator('#my-files').get_by_role('button',name='تنزيل',exact=True).click();self.settle()
        p.locator('#shared-with-me').get_by_role('button',name='تنزيل',exact=True).click();self.settle()
        assert self.calls[-2:]==[('POST','/downloads',{'key':KEY}),('POST','/downloads',{'key':SHARED_KEY})]
        self.download_mode='error'
        p.locator('#my-files').get_by_role('button',name='تنزيل',exact=True).click()
        expect(self.toast('Download failed.')).to_be_visible()
        self.download_mode='success'
        # Upload: input selection, multipart field order, fallback content type, refresh.
        p.locator('input[type=file]').set_input_files({'name':'upload.txt','mimeType':'','buffer':b'fixture upload'})
        self.snap('selected-file')
        p.get_by_role('button',name='رفع الملف',exact=True).click()
        expect(self.toast('File uploaded successfully.')).to_be_visible();self.snap('upload-success')
        assert self.calls[-3][0:2]==('POST','/uploads') and self.calls[-2][1]=='storage-upload' and self.calls[-1][0:2]==('GET','/files')
        assert p.locator('.selected-file').count()==0
        count=len(self.calls)
        p.evaluate('''()=>{const f=new File(['x'],'too-large.txt');Object.defineProperty(f,'size',{value:104857601});const d=new DataTransfer();d.items.add(f);const i=document.querySelector('input[type=file]');i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}))}''')
        p.get_by_role('button',name='رفع الملف',exact=True).click()
        expect(p.get_by_text('File exceeds the 100 MB limit.',exact=True)).to_be_visible()
        assert len(self.calls)==count
        p.evaluate('''()=>{const d=new DataTransfer();d.items.add(new File(['fixture upload'],'upload.txt'));document.querySelector('.upload-dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d}))}''')
        expect(p.locator('.selected-file strong')).to_have_text('upload.txt')
        p.get_by_role('button',name='رفع الملف',exact=True).click()
        expect(p.locator('.selected-file')).to_have_count(0)
        self.settle()
        assert [body for method,path,body in self.calls if path=='/uploads'][-1]=={'fileName':'upload.txt','contentType':'application/octet-stream'}
        # Internal sharing: validation, server error, normalized recipient, already-shared.
        p.locator('#my-files').get_by_role('button',name='مشاركة داخليًا',exact=True).click();self.snap('internal-modal')
        modal=p.get_by_role('dialog')
        modal.get_by_role('button',name='مشاركة الملف',exact=True).click()
        expect(modal.get_by_text('أدخل البريد الإلكتروني للموظف المستلم.',exact=True)).to_be_visible()
        modal.locator('input').fill('employee@localhost')
        modal.get_by_role('button',name='مشاركة الملف',exact=True).click()
        expect(modal.get_by_text('يرجى إدخال بريد إلكتروني صحيح.',exact=True)).to_be_visible()
        modal.locator('input').fill('EMPLOYEE@EXAMPLE.TEST')
        self.internal_mode='error'
        modal.get_by_role('button',name='مشاركة الملف',exact=True).click()
        expect(modal.get_by_text('fixture sharing denied',exact=True)).to_be_visible();self.snap('internal-server-error')
        self.internal_mode='already'
        modal.get_by_role('button',name='مشاركة الملف',exact=True).click()
        expect(self.toast('الملف مشارك مسبقًا مع employee@example.test.')).to_be_visible()
        p.locator('#my-files').get_by_role('button',name='مشاركة داخليًا',exact=True).click()
        expect(p.locator('#internal-recipient-email')).to_have_value('')
        self.internal_mode='success'
        p.locator('#internal-recipient-email').fill('EMPLOYEE@EXAMPLE.TEST')
        p.get_by_role('dialog').get_by_role('button',name='مشاركة الملف',exact=True).click()
        expect(self.toast('تمت مشاركة الملف بنجاح مع employee@example.test.')).to_be_visible();self.snap('internal-success')
        # External sharing: defaults, every option, numeric limits/expiry, backend errors.
        p.locator('#my-files').get_by_role('button',name='مشاركة خارجية',exact=True).click();self.snap('external-modal')
        expect(p.locator('#external-expiration')).to_have_value('24')
        expect(p.locator('#external-download-limit')).to_have_value('5')
        assert p.locator('#external-expiration option').evaluate_all('(xs)=>xs.map(x=>x.value)')==['1','6','24','72','168']
        assert p.locator('#external-download-limit option').evaluate_all('(xs)=>xs.map(x=>x.value)')==['1','3','5','10','20']
        p.locator('#external-recipient-email').fill('OUTSIDE@EXAMPLE.TEST')
        p.locator('#external-expiration').select_option('72')
        p.locator('#external-download-limit').select_option('3')
        self.external_mode='error'
        p.get_by_role('dialog').get_by_role('button',name='إنشاء الرابط الآمن',exact=True).click()
        expect(p.get_by_role('dialog').get_by_text('fixture external denied',exact=True)).to_be_visible();self.snap('external-server-error')
        self.external_mode='success'
        p.get_by_role('dialog').get_by_role('button',name='إنشاء الرابط الآمن',exact=True).click()
        expect(p.get_by_label('External sharing link',exact=True)).to_be_visible();self.snap('external-created')
        assert self.calls[-2:]==[('POST','/external-shares',{'key':KEY,'recipientEmail':'outside@example.test','expiresInHours':72,'maxDownloads':3}),('GET','/external-shares',None)]
        link=APP_URL+'/#external=fixture%20token%2F%2B'
        expect(p.get_by_label('External sharing link',exact=True)).to_have_value(link)
        assert p.evaluate('window.__copies.at(-1)')==link
        p.get_by_role('button',name='نسخ الرابط',exact=True).click()
        assert p.evaluate('window.__copies.length')==2
        self.confirm=False
        count=len(self.calls)
        self.confirm_action(p.get_by_role('button',name='إلغاء مشاركة الرابط',exact=True),'إلغاء الرابط',False)
        assert len(self.calls)==count
        self.confirm=True
        self.confirm_action(p.get_by_role('button',name='إلغاء مشاركة الرابط',exact=True),'إلغاء الرابط')
        expect(p.get_by_label('External sharing link',exact=True)).to_have_count(0)
        expect(self.toast('External sharing link revoked successfully.')).to_be_visible();self.snap('generated-revoked')
        self.revoke_mode='error'
        self.confirm_action(p.locator('#external-shares').get_by_role('button',name='إلغاء الرابط',exact=True),'إلغاء الرابط')
        expect(self.toast('fixture revoke denied')).to_be_visible()
        self.revoke_mode='success'
        self.confirm_action(p.locator('#external-shares').get_by_role('button',name='إلغاء الرابط',exact=True),'إلغاء الرابط')
        expect(p.locator('#external-shares .status-active')).to_have_count(0)
        # Optional external recipient and denied clipboard preserve successful creation.
        p.locator('#my-files').get_by_role('button',name='مشاركة خارجية',exact=True).click()
        expect(p.locator('#external-recipient-email')).to_have_value('')
        expect(p.locator('#external-expiration')).to_have_value('24')
        expect(p.locator('#external-download-limit')).to_have_value('5')
        p.evaluate('window.__denyClipboard=true')
        p.get_by_role('dialog').get_by_role('button',name='إنشاء الرابط الآمن',exact=True).click()
        expect(self.toast('تم إنشاء رابط المشاركة الخارجية بنجاح.')).to_be_visible();self.snap('clipboard-denied')
        # Modal cancellation and backdrop closure use the original elements.
        p.locator('#my-files').get_by_role('button',name='مشاركة داخليًا',exact=True).click()
        p.get_by_role('dialog').get_by_role('button',name='إغلاق',exact=True).click()
        expect(p.get_by_role('dialog')).to_have_count(0)
        p.locator('#my-files').get_by_role('button',name='مشاركة خارجية',exact=True).click()
        p.locator('.modal-backdrop').click(position={'x':2,'y':2})
        expect(p.get_by_role('dialog')).to_have_count(0)
        # Modal delete cancellation and success without a JSON body.
        self.confirm=False
        count=len(self.calls)
        self.confirm_action(p.locator('#my-files').get_by_role('button',name='حذف',exact=True),'حذف الملف',False)
        assert len(self.calls)==count
        self.confirm=True
        self.confirm_action(p.locator('#my-files').get_by_role('button',name='حذف',exact=True),'حذف الملف')
        expect(self.toast('File deleted successfully.')).to_be_visible()
        expect(p.locator('#my-files').get_by_text('لا توجد ملفات حتى الآن',exact=True)).to_be_visible();self.snap('delete-success')
        # Preserve logout URL construction and removeUser before redirect.
        p.evaluate("window.scrollTo({top:0,behavior:'instant'})")
        p.get_by_role('button',name='تسجيل الخروج',exact=True).click(no_wait_after=True)
        p.wait_for_url('**/logout?**')
        self.settle()
        assert 'logout_uri=' in self.logout and 'client_id=' in self.logout
        # External recipient: no Cognito sign-in or bearer headers, hash precedence.
        p.goto(self.origin+'/?external=query-token#external=hash-token',wait_until='networkidle')
        self.snap('public-english')
        expect(p.get_by_role('heading',name='Secure file download',exact=True)).to_be_visible()
        self.download_mode='success'
        p.get_by_role('button',name='Download file',exact=True).click()
        expect(self.toast('Download started. 2 of 3 allowed downloads used.')).to_be_visible();self.snap('public-success-en')
        p.get_by_role('button',name='العربية',exact=True).click()
        assert p.locator('.public-page').get_attribute('dir')=='rtl'
        p.reload(wait_until='networkidle')
        expect(p.get_by_role('heading',name='تنزيل ملف آمن',exact=True)).to_be_visible();self.snap('public-arabic')
        p.get_by_role('button',name='تنزيل الملف',exact=True).click()
        expect(self.toast('بدأ التنزيل. تم استخدام 2 من أصل 3 مرات تنزيل مسموح بها.')).to_be_visible();self.snap('public-success-ar')
        translations={
            'Invalid sharing link':'رابط المشاركة غير صالح.',
            'This sharing link has been revoked':'تم إلغاء رابط المشاركة.',
            'This sharing link has expired':'انتهت صلاحية رابط المشاركة.',
            'Download limit reached':'تم الوصول إلى الحد الأقصى للتنزيلات.',
            'Sharing link is no longer available':'رابط المشاركة لم يعد متاحًا.',
            'Unable to download shared file.':'تعذر تنزيل الملف المشترك.',
            'fixture unknown failure':'تعذر تنزيل الملف المشترك.',
            'no-message':'تعذر تنزيل الملف المشترك.',
        }
        for i,(error,translated) in enumerate(translations.items()):
            self.download_mode=error
            p.get_by_role('button',name='تنزيل الملف',exact=True).click()
            expect(self.toast(translated)).to_be_visible();self.snap('public-error-ar-'+str(i))
        p.get_by_role('button',name='English',exact=True).click()
        assert p.locator('.public-page').get_attribute('dir')=='ltr'
        for i,error in enumerate(translations):
            self.download_mode=error
            p.get_by_role('button',name='Download file',exact=True).click()
            expect(self.toast(error if error!='no-message' else 'External download failed: 400')).to_be_visible();self.snap('public-error-en-'+str(i))
        p.goto(self.origin+'/?external=query-token',wait_until='networkidle')
        self.download_mode='success'
        p.get_by_role('button',name='Download file',exact=True).click()
        expect(self.toast('Download started. 2 of 3 allowed downloads used.')).to_be_visible()
        assert self.calls[-1]==('POST','/external-download',{'token':'query-token'})
        p.set_viewport_size({'width':390,'height':844});self.snap('public-mobile')
        assert not self.errors,self.errors
        assert not self.dialogs,self.dialogs
        self.context.close()
        return {'snapshots':self.snapshots,'calls':self.calls,'dialogs':self.dialogs,'provider':self.provider,'logout':self.logout}


if __name__ == '__main__':
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        result=Checks(browser,ORIGIN).run()
        expected=json.loads(Path(__file__).with_name('expected_requests.json').read_text())
        assert json.loads(json.dumps(result['calls']))==expected, 'API/storage contracts changed'
        print(f"PASS: {len(result['snapshots'])} browser scenarios; all {len(expected)} baseline API/storage calls match")
        browser.close()
