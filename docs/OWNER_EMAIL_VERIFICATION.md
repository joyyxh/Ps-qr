# Owner email verification

Status (2026-11-22): the app's sign-up, code entry, resend and sign-in are fixed and tested. The
verification email still does **not** reach owners who are not on the Supabase team, because the
project's email sender is not set up for real owners. The app cannot fix that. The dashboard steps
below can.

Nothing in this file claims that a verification email arrives. Only the owner's real test (step 9
below) can show that.

## Why owners do not get a code (root cause)

Supabase's documentation for the built-in email service says:

- It is "not meant for production use". It is for testing with the members of the project's team.
- It "will refuse to deliver messages to addresses that are not part of the project's team".
- It is limited to 2 emails per hour.

The Auth logs for the project agree (no email addresses are copied here):

- On 2026-10-25 at 14:29 UTC, the built-in sender (`noreply@mail.app.supabase.io`) logged a
  confirmation email, and that owner confirmed by the link 18 seconds later. Earlier confirmations
  (2026-10-19, 2026-10-21, 2026-10-25) are recorded in the user table; their logs were not examined.
- At 18:32 UTC the same day, the email limit changed from 2 to 30 per hour. Supabase sets 30 per
  hour when custom SMTP is switched on. The logs do not say whether custom SMTP is in use now, so
  check the dashboard (step 1 below).
- Since then, every sign-up returned success and was logged, but none of those owners confirmed,
  and no `mail.send` event was logged for them. In the windows checked (2026-10-25, 2026-11-17,
  2026-11-18 to 19), no owner submitted a code.
- Supabase reports success when it accepts a sign-up, so the failure happens after the app's request.

Most likely cause: the built-in sender refuses owners whose address is not on the team. If custom
SMTP is on, the cause is in that setup (sender, provider, or the template). Step 1 tells which.

## What the app does now (web/src/owner.js, web/src/logic.js, web/src/pending-signup.js)

- A refused address shows: "QRquick cannot send the code to this address yet. Ask QRquick to finish
  the email setup, then try again." (Supabase code `email_address_not_authorized`.)
- A coded email limit shows: "Wait about an hour before asking for another code…"
  (`over_email_send_rate_limit`). A coded request limit shows "Too many requests from this device."
- An address already registered (`email_exists`, `user_already_exists`) and switched-off email
  sign-up (`email_provider_disabled`) each get their own message.
- The code screen keeps the address and the time of the last code for this browser tab, so a
  reload does not lose the place. The password is never stored. Records older than two hours are
  dropped, and a damaged record is removed.
- The code screen says what to do when no email arrives: check spam, press Resend code, and open
  the link on this device if the email has a link instead of a code.
- A successful sign-in clears any registration that was waiting for its code.
- Unchanged and still enforced: a session is never created before the code is accepted, and an
  unverified owner cannot sign in with the password.

## Choose the sender

| Option | Use it for | Limits |
|---|---|---|
| Team members only (built-in sender) | Testers who are members of the Supabase organization team | Not for shop owners. 2 emails per hour. |
| **Your own domain + Resend SMTP (recommended)** | Real owners | You buy the domain. Check Resend's current plan limits before choosing a plan. The sender address must be on your verified domain. |
| A Gmail account with an App Password (stop-gap only) | A short test while the domain is not ready | Sends as a personal Gmail address, which owners will see. Google limits how many emails one account may send per day. It can be blocked or locked by Google. Do not use it for customers. |

The Resend account reached from this environment had **no verified domain** on 2026-11-22. Steps
A to D below are the owner's work.

## Dashboard steps (owner to do; no secrets in this repository or in chat)

Open the project in the Supabase dashboard. Menu names can change, so use the closest match.

### A. Buy the domain and verify it with Resend

1. Buy a domain from any registrar. Choose one that matches the business. The owner decides the
   name.
2. In Resend, open Domains → Add domain, enter the domain, and choose a sending subdomain if Resend
   suggests one. Resend shows the DNS records to add (SPF and DKIM records). **Copy the records from
   the Resend page, not from this file.**
3. Add those records at the DNS host. Wait until Resend shows the domain as **Verified**.

### B. Create a Resend API key

4. In Resend, open API Keys → Create API key. Give it **Sending access** only, and limit it to the
   verified domain if Resend offers that. Copy the key once, and store it in a password manager.

### C. Set Supabase to send through Resend

5. Supabase: Authentication → Emails → SMTP Settings. Turn on custom SMTP and enter:

   | Field | Value |
   |---|---|
   | Sender email | `no-reply@<your verified domain>` |
   | Sender name | `QRquick` |
   | Host | `smtp.resend.com` |
   | Port | `465` (SSL) |
   | Username | `resend` |
   | Password | the Resend API key from step 4 |

   Save. Do not paste the key into chat or into any file in this repository.

6. Supabase: Authentication → Emails → Confirm signup. **The template must contain `{{ .Token }}`**,
   which is the six-digit code the app asks for. A template with only the link gives the owner no
   code to type. Suggested text:

   > Your QRquick code is **{{ .Token }}**. Enter it in the app to finish creating your account.
   > If you did not ask for this, ignore this email.

7. Supabase: Authentication → Rate Limits. The email limit is set per project (30 per hour is the
   default with custom SMTP). Raise it only as far as the Resend plan allows, and check Resend's
   own limits.

### D. Confirm the sign-in settings

8. Supabase: Authentication → Sign In / Providers → Email. Email sign-up is **on**, and "Confirm
   email" is **on**. Do not turn "Confirm email" off to get around a problem. The app depends on it.
   Supabase: Authentication → URL Configuration. The Site URL and the redirect list include
   `https://joyyxh.github.io/Ps-qr/` (or the deployed address in `PRINTNEST_PUBLIC_URL`).

### E. Test with an address that is not on the team

9. Register with a mailbox that is not on the team. Record the time, whether the code arrived,
   whether it was in spam, and whether the code worked. If nothing arrives, check **Resend →
   Emails** (the send status and any bounce) and **Supabase → Logs → Auth** (the `mail.send`
   events). The two logs show different things: Supabase shows when it accepted the send, Resend
   shows what happened after.

## If the test fails

- Resend shows "domain not verified" or the send is rejected: the DNS records in step 2 are not
  complete, or the sender address is not on the verified domain.
- Resend shows the send as delivered but nothing arrives: check spam, then the DMARC and SPF
  settings in Resend's domain page.
- Supabase shows `mail.send` but Resend shows nothing: the SMTP host, port, username or key in
  step 5 is wrong.
- The email has no code: the template in step 6 is missing `{{ .Token }}`.

## Tests (run from web/)

- `npm test`: 238 passing (includes new tests for the messages above and for the pending-registration store).
- Browser checks, mocked Supabase (`run_smokes.sh owner-smoke.cjs owner-shell-smoke.cjs registration-smoke.cjs`):
  owner-smoke 43 of 43, owner-shell-smoke 41 of 41, registration-smoke 13 of 13. These check the screens
  and requests only. They do not show that any email arrives.

## Not verified

- Any real email delivery. The sandbox cannot reach `supabase.co` (its proxy blocks it), and the logs
  show when Supabase accepts a send, not when an inbox receives it.
- The current sender, the template text, the redirect list and "Confirm email". There is no Auth
  settings tool in this environment, so these need the dashboard steps above.
- The Resend domain. No domain was verified in the Resend account reached from this environment on
  2026-11-22.
- Team membership. The Supabase tools here do not list organization members.
