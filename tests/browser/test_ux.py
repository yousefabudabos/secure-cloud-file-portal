"""Focused UX checks using the existing mocked backend; no AWS writes."""
import os
import re
import unittest
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from regression import API, AUTH, Checks, ORIGIN


class UXTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox'],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.checks = Checks(self.browser, ORIGIN)
        self.page = self.checks.page
        self.page.goto(ORIGIN, wait_until='networkidle')
        self.page.evaluate('state=>window.__setTestAuth(state)', AUTH)
        expect(self.page.locator('#my-files strong.bidi-safe')).to_have_text('report.txt')
        self.checks.settle()

    def tearDown(self):
        errors = self.checks.errors + self.checks.dialogs
        self.checks.context.close()
        self.assertEqual(errors, [], 'Unexpected JavaScript exception or native dialog')

    def trigger(self, action):
        section, label = ('#my-files', 'حذف') if action == 'delete' else ('#external-shares', 'إلغاء الرابط')
        return self.page.locator(section).get_by_role('button', name=label, exact=True)

    def check_confirmation(self, action):
        trigger = self.trigger(action)
        initial_calls = list(self.checks.calls)
        trigger.focus()
        self.page.keyboard.press('Enter')
        dialog = self.page.get_by_role('alertdialog')
        expect(dialog).to_be_visible()
        self.assertEqual(dialog.get_attribute('dir'), 'rtl')
        self.assertTrue(dialog.get_attribute('aria-labelledby'))
        self.assertTrue(dialog.get_attribute('aria-describedby'))
        cancel = dialog.get_by_role('button', name='إلغاء', exact=True)
        confirm = dialog.get_by_role('button', name='حذف الملف' if action == 'delete' else 'إلغاء الرابط', exact=True)
        expect(cancel).to_be_focused()
        # Pressing Enter again cancels; opening the dialog never defaults to destruction.
        self.page.keyboard.press('Enter')
        expect(dialog).to_have_count(0)
        expect(trigger).to_be_focused()
        self.assertEqual(self.checks.calls, initial_calls)
        trigger.click()
        self.page.keyboard.press('Shift+Tab')
        expect(confirm).to_be_focused()
        self.page.keyboard.press('Tab')
        expect(cancel).to_be_focused()
        self.page.keyboard.press('Escape')
        expect(dialog).to_have_count(0)
        expect(trigger).to_be_focused()
        trigger.click()
        cancel.click()
        expect(dialog).to_have_count(0)
        self.assertEqual(self.checks.calls, initial_calls)

        # Hold the request to inspect pending controls and duplicate-submit protection.
        pending = []
        def hold(route):
            if route.request.method == 'DELETE':
                pending.append(route)
            else:
                route.fallback()
        endpoint = '/files' if action == 'delete' else '/external-shares'
        self.checks.context.route(re.compile(re.escape(API + endpoint) + '$'), hold)
        trigger.click()
        confirm.click()
        expect(dialog).to_have_attribute('aria-busy', 'true')
        expect(cancel).to_be_disabled()
        expect(dialog.get_by_role('button', name='جارٍ التنفيذ…', exact=True)).to_be_disabled()
        self.page.keyboard.press('Escape')
        expect(dialog).to_be_visible()
        # A second synthetic click must also be rejected by the immediate submission guard.
        dialog.locator('.btn-danger').dispatch_event('click')
        self.page.wait_for_timeout(100)
        self.assertEqual(len(pending), 1)
        self.checks.context.unroute(re.compile(re.escape(API + endpoint) + '$'), hold)
        self.checks.route(pending[0])
        expect(dialog).to_have_count(0)
        message = 'File deleted successfully.' if action == 'delete' else 'External sharing link revoked successfully.'
        expect(self.checks.toast(message)).to_be_visible()
        self.assertEqual(len([call for call in self.checks.calls if call[:2] == ('DELETE', endpoint)]), 1)
        target = self.page.locator('#my-files h2' if action == 'delete' else '#external-shares h2')
        expect(target).to_be_focused()

    def test_delete_cancel_escape_focus_and_single_confirm(self):
        self.check_confirmation('delete')

    def test_revoke_cancel_escape_focus_and_single_confirm(self):
        self.check_confirmation('revoke')

    def test_success_toast_auto_dismisses(self):
        self.page.clock.install()
        self.trigger('delete').click()
        self.page.get_by_role('alertdialog').get_by_role('button', name='حذف الملف', exact=True).click()
        toast = self.page.locator('.toast--success')
        expect(toast).to_be_visible()
        expect(self.page.locator('[aria-live=polite]')).to_contain_text('File deleted successfully.')
        self.assertEqual(toast.get_attribute('dir'), 'rtl')
        self.page.mouse.move(0, 0)
        self.page.clock.fast_forward(5100)
        expect(toast).to_have_count(0)

    def test_error_toast_pauses_for_hover_and_focus_and_closes_manually(self):
        self.checks.download_mode = 'error'
        self.page.clock.install()
        self.page.locator('#my-files').get_by_role('button', name='تنزيل', exact=True).click()
        toast = self.page.locator('.toast--error')
        expect(toast).to_be_visible()
        expect(self.page.locator('[aria-live=assertive]')).to_contain_text('Download failed.')
        toast.hover()
        self.page.clock.fast_forward(9000)
        expect(toast).to_be_visible()
        close = toast.get_by_role('button', name='إغلاق الإشعار', exact=True)
        close.focus()
        self.page.mouse.move(0, 0)
        self.page.clock.fast_forward(9000)
        expect(toast).to_be_visible()
        close.click()
        expect(toast).to_have_count(0)

    def test_error_toast_auto_dismisses_after_reading_delay(self):
        self.checks.download_mode = 'error'
        self.page.clock.install()
        self.page.locator('#my-files').get_by_role('button', name='تنزيل', exact=True).click()
        toast = self.page.locator('.toast--error')
        expect(toast).to_be_visible()
        self.page.mouse.move(0, 0)
        self.page.clock.fast_forward(7900)
        expect(toast).to_be_visible()
        self.page.clock.fast_forward(300)
        expect(toast).to_have_count(0)

    def test_info_toast_and_inline_validation(self):
        self.checks.internal_mode = 'already'
        self.page.locator('#my-files').get_by_role('button', name='مشاركة داخليًا', exact=True).click()
        form = self.page.get_by_role('dialog')
        form.get_by_role('button', name='مشاركة الملف', exact=True).click()
        expect(form.get_by_role('alert')).to_contain_text('أدخل البريد الإلكتروني')
        self.assertEqual(self.page.locator('.toast').count(), 0)
        expect(form.locator('input')).to_have_attribute('aria-invalid', 'true')
        form.locator('input').fill('employee@example.test')
        form.get_by_role('button', name='مشاركة الملف', exact=True).click()
        expect(self.page.locator('.toast--info')).to_contain_text('الملف مشارك مسبقًا')
        self.page.locator('.toast--info .toast-close').click()
        expect(self.page.locator('.toast')).to_have_count(0)

    def test_mobile_toast_bounds_controls_and_dialog_layer(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.checks.download_mode = 'error'
        download = self.page.locator('#my-files').get_by_role('button', name='تنزيل', exact=True)
        for _ in range(4):
            download.click()
            self.checks.settle()
        self.assertEqual(self.page.locator('.toast').count(), 3)
        viewport = self.page.locator('.toast-viewport')
        bounds = viewport.bounding_box()
        self.assertGreaterEqual(bounds['x'], 0)
        self.assertLessEqual(bounds['x'] + bounds['width'], 390)
        self.assertLessEqual(bounds['height'], 844 * 0.30 + 1)
        self.assertLessEqual(bounds['y'] + bounds['height'], 844)
        self.assertGreater(self.page.locator('.app-shell').evaluate('el=>parseFloat(getComputedStyle(el).paddingBottom)'), 0)
        # Reserved scroll space makes even the last action reachable above the toasts.
        revoke = self.trigger('revoke')
        revoke.evaluate("el=>el.scrollIntoView({block:'center',behavior:'instant'})")
        self.assertLess(revoke.bounding_box()['y'] + revoke.bounding_box()['height'], bounds['y'])
        revoke.click()
        dialog = self.page.get_by_role('alertdialog')
        expect(dialog).to_be_visible()
        button = dialog.get_by_role('button', name='إلغاء', exact=True)
        self.assertTrue(button.evaluate('(el)=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'))
        artifacts = os.environ.get('PORTAL_SCREENSHOTS')
        if artifacts:
            Path(artifacts).mkdir(parents=True, exist_ok=True)
            self.page.screenshot(path=str(Path(artifacts) / 'mobile-confirm.png'))
        button.click()


if __name__ == '__main__':
    unittest.main(verbosity=2)
