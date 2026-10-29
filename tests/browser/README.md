# Mocked browser checks

These checks use Python's built-in unittest runner, the environment's existing
Playwright installation, and Chromium. They add no frontend dependencies. Start
the normal Vite server with the development VITE_* configuration, then run:

```sh
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
# In another terminal, from the repository root:
python tests/browser/auth_resources.py
python tests/browser/regression.py
python -m unittest discover -s tests/browser -p 'test_*.py' -v
```

`PORTAL_TEST_URL` overrides the default local server address. `CHROMIUM_PATH`
overrides `/usr/bin/chromium`. The tests read the public Vite configuration to
match intercepted requests. Authentication and all remote API/storage requests
use fixtures, not live AWS credentials or data. Unexpected remote requests fail.

The existing resource and regression scenarios were adapted for the intentional
modal/toast changes. `expected_requests.json` records the 46 API/storage requests
from the passing pre-UX regression run, including fake multipart fields; it
contains no production endpoints or credentials. Regression checks compare this
trace while testing upload, downloads, sharing, revoke, expiry/limits, language
switching, and Cognito callback/logout behavior. Old full-DOM equality and native
browser-dialog assertions are replaced by focused checks for the new UI.

The focused UX suite checks destructive-action cancel/confirm, Escape, focus
containment/restoration, pending/disabled states, duplicate submissions, toast
variants, live regions, dismissal timers, hover/focus pauses, form errors, and
mobile layout. Set `PORTAL_SCREENSHOTS` to an output directory for the optional
mobile dialog screenshot.
