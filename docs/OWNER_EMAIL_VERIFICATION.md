# Owner email verification: how it works and what to check in Supabase

Status: the code path is traced and tested with mocked Supabase responses. Actual email
delivery has **not** been tested from this repository. The sandbox used for these tests
cannot reach `supabase.co`, so the hosted Auth settings below were not read or changed.
Nothing here is a claim that a verification email arrives.

## The code path (web/src/auth.js and web/src/owner.js)

| Step | Owner action | Request to Supabase Auth | Success | Failure handled |
|---|---|---|---|---|
| Register | Enters email and password, taps Create account | `POST /auth/v1/signup` with `email`, `password`, `redirect_to` | Reply has no session; the code screen opens | A session in the reply (confirmation off) is refused with `confirmation_disabled` |
| Enter code | Types the 6–10 digit code from the email | `POST /auth/v1/verify` with `type: signup`, `email`, `token` | Pending signup held in memory; owner chooses a password | Wrong or expired code shows a message from `otpErrorMessage` |
| Resend | Taps Send a new code (after the timer) | `POST /auth/v1/resend` with `type: signup`, `email` | New code screen message | HTTP 429 shows "A code was sent a moment ago" |
| Sign in before verifying | Signs in with the password | `POST /auth/v1/token?grant_type=password` | Session stored | `email_not_confirmed` starts the resend-and-verify path |

Passwords are saved only after the code is verified (`completeSignup`). No session is stored
between sign-up and verification.

## Redirect address

`web/config.js` sets `authRedirectUrl` (and `publicBaseUrl`) to
`https://joyyxh.github.io/Ps-qr/`. The Android build replaces both with
`PRINTNEST_PUBLIC_URL` (see `mobile/scripts/copy-web.mjs`). The APK workflow defaults to
`https://joyyxh.github.io/Ps-qr/` when the repository variable is not set.

Supabase only follows a `redirect_to` that is on its allow-list. Any other value falls back to
the project's Site URL.

## Checklist for the Supabase dashboard (owner to complete, no secrets in this repository)

Open the project in the Supabase dashboard (Authentication section). Record each answer with the
date and who checked it. Do not paste keys, SMTP passwords or tokens into the repository or
into chat.

1. **Confirm email is on.** Authentication → Sign In / Providers → Email → "Confirm email"
   is enabled. If it is off, sign-up returns a session and the app refuses it with
   `confirmation_disabled`.
2. **Site URL.** Authentication → URL Configuration → Site URL is the deployed web app
   (`https://joyyxh.github.io/Ps-qr/` unless the deployment changed).
3. **Redirect URLs.** The allow-list includes `https://joyyxh.github.io/Ps-qr/` and any
   other deployed address in `PRINTNEST_PUBLIC_URL`.
4. **Confirmation email template contains the code.** Authentication → Email Templates →
   "Confirm signup" must include `{{ .Token }}`. The app asks for the six-to-ten digit code;
   a template that only has the link leaves the owner with no code to type.
5. **Sender.** Check whether the project uses the built-in sender or custom SMTP. The built-in
   sender is rate-limited and is intended for testing; a shop-facing launch needs custom SMTP
   with a sender address and domain authentication (SPF, DKIM) that the owner controls.
   Record which one is in use. Do not record the SMTP password.
6. **Rate limits.** Note the current limits for sign-up and for resend. The app shows the
   429 message when a resend is too soon.
7. **Test with a real inbox (owner step).** Register with a mailbox the owner controls,
   confirm the code arrives, enter it, set a password, sign in. Also try an unverified account
   to see the resend path. Record the time, the sender, and whether the email landed in spam.

## Read-only check on 2026-11-18

Checked with the Supabase and Resend connectors. Counts only: no addresses were read or copied.

- Supabase project `printnest` has 9 accounts: 3 confirmed and 6 not confirmed.
- Supabase recorded a confirmation send for 7 of the 9 accounts. The latest was on 2026-11-17 at
  20:13 UTC. Supabase records that it tried to send. It does not record that the email arrived, or
  which sender it used.
- The Resend connector lists no sending domains and no sent emails. So the verification email does
  not go through that Resend account. Check the sender Supabase uses: the built-in sender, or the
  SMTP settings in the dashboard.
- The Supabase connector could not read the Auth logs (its query returned "table does not exist").
  Read them in the dashboard instead: Logs, then Auth. Look for email or SMTP errors around the
  times above.

Status: Supabase tries to send the code, but delivery to a real inbox is still unconfirmed. The
owner steps below are the next checks.

1. Logs, then Auth: note any email or SMTP error.
2. Authentication, then Emails, then SMTP settings: note whether the built-in sender or custom SMTP
   is used. The built-in sender is rate-limited and meant for testing.
3. Confirm the "Confirm signup" template contains `{{ .Token }}`.
4. Register with an owner-controlled mailbox and record whether the code arrives, and how long it takes.

## Not verified here

- Whether the hosted project has "Confirm email" on, what the redirect allow-list contains,
  what the email template says, and which sender is used. These need the dashboard check above.
- Whether an email reaches a real inbox. Only the owner's real test (step 7) can show this.
- Whether the built-in sender limits affect shops at launch.
