## What this changes

- Owners register with email and password, then enter the 6-digit code that Supabase emails to them. The account opens after the owner saves the password they chose.
- Later sign-ins use email and password only. No code step.
- Forgot password and the reset link are unchanged.
- Customers still have no accounts.

## Scope

Six `web/` files only, one commit (`8e29762`) on top of `4d97e40`:

- `web/package.json`
- `web/src/auth.js`
- `web/src/logic.js`
- `web/src/owner.js`
- `web/tests/auth.test.js`
- `web/tests/owner-registration.test.js` (new)

Not included: Stage 3 orders, printing, pricing, paper size, database migrations, the `agent/` files, and commit `37e4623`.

## Checks

- `npm test` in `web/`: 147 pass, 0 fail.

## Supabase settings this relies on

- Confirm email is on.
- Confirm signup template contains `{{ .Token }}`.
- Reset password template contains `{{ .ConfirmationURL }}`.
- Site URL and redirect URL: `https://joyyxh.github.io/Ps-qr/`.

## Known residual risk (accepted, not resolved)

If someone registers an owner's address first, with their own password, that first password keeps working until the owner completes registration or resets their password. The attacker cannot sign in before a code is accepted, and a password reset closes the window. This is documented, not fixed.

## Not yet verified

- Live Supabase behaviour for this exact code. Live tests run after merge.
- Whether a password reset revokes sessions issued before the reset.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
