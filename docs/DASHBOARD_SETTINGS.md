# Dashboard settings for B1 and B3 (prepared, **not changed**)

Do these only after the owner approves. They are in the Supabase dashboard of the target project (staging
`nbzojqlqkrydcjtogwrb`, production `qvnwqrevgyootaaunrto`). **Keep the Email provider enabled**: username sign-in
signs in through GoTrue's password grant for the internal address, which needs it.

Wording below is from memory of the current dashboard. Check the label on screen before saving, and stop if it does
not match.

| # | Where | Setting | Set to | Why | Check afterwards |
|---|---|---|---|---|---|
| 1 | Authentication → Sign In / Providers → **Email** | Provider enabled | **On (unchanged)** | Username accounts need it | `owner-auth-live.mjs` sign-in passes |
| 2 | Authentication → Sign In / Providers (user signups) | **Allow new users to sign up** | **Off** | Closes B3: nobody can create an account through the public auth API. The `owner-auth` function creates accounts through the admin API, which this setting does not block | `POST /auth/v1/signup` with the publishable key returns a "signups not allowed" error; `owner-auth` sign-up still returns 201 |
| 3 | Authentication → Sign In / Providers → Email → password settings (some versions: Authentication → Attack Protection) | **Prevent use of leaked passwords** (HaveIBeenPwned) | **On** | Dashboard-level B1 | A password from the breach list is refused on the auth API. **Plan note: this feature is documented as available on paid plans only; on the Free plan the toggle is unavailable and the advisor warning cannot be cleared** |
| 4 | Same screen | Minimum password length | 10 or more | Matches `PASSWORD_MIN` in `owner-rules.js` | n/a |
| 5 | Same screen | Confirm email | Leave as is | Accounts are created already confirmed | n/a |

## Why B1 is safe without row 3

The `owner-auth` function already checks every new or changed password against HaveIBeenPwned with k-anonymity
(only the first five characters of the SHA-1 are sent), and **fails closed** if the service is unreachable
(sign-up pauses; sign-in is unaffected). It runs on sign-up, reset, and claim. Row 3 adds protection for anything that
bypasses the function, and clears the advisor warning.

## What changes for people

Customers: nothing (they never sign up). Shop owners: nothing in the app. Anyone who tries to register through the raw
auth API: refused. The database guard from migration 0022 already refuses non-username accounts at commit, so row 2 is
a second layer, not the only one.

## Verification flows to run after the settings (CI: `Owner auth against staging`)

Sign-up, sign-in, wrong password, recovery-code reset, new recovery codes, sign-out, plus the two breach checks:
21 checks in `web/tests/live/owner-auth-live.mjs`.
