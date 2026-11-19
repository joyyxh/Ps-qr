# Owner email verification

Status (2026-11-19): the app's sign-up, code entry, resend and sign-in are fixed and tested. The
verification email still does **not** reach owners who are not on the Supabase team, because of
how the project's email is set up. The app cannot fix that. The dashboard steps below can.

Nothing in this file claims that a verification email arrives. Only the owner's real test
(step 6 below) can show that.

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

## Dashboard steps (owner to do; no secrets in this repository or in chat)

Open the project in the Supabase dashboard. Menu names can change, so use the closest match.

1. **Which sender is active.** Authentication → Emails → SMTP Settings. Write down whether custom
   SMTP is switched on, and if it is, the provider and sender address. Do not write down the password.
   - Off: the built-in sender is in use. It only delivers to team members (step 5a).
   - On: check that provider's delivery log for the owner's test emails.
2. **The code is in the email.** Authentication → Emails → Confirm signup. The template must
   contain `{{ .Token }}`. A template with only the link gives the owner no code to type.
3. **Email confirmation is on.** Authentication → Sign In / Providers → Email → "Confirm email".
4. **Redirect addresses.** Authentication → URL Configuration. Site URL and the redirect list include
   `https://joyyxh.github.io/Ps-qr/` (or the deployed address in `PRINTNEST_PUBLIC_URL`).
5. **Choose a sender** (one of these):
   - **a. Testing today:** add each tester to the Supabase organization team (Organization settings →
     Team). Only team members get built-in email, so this is for testers, not shop owners.
   - **b. Real owners, no domain needed (free):** custom SMTP through a Google account. Host
     `smtp.gmail.com`, port 587. Username: that Gmail address. Password: a Google App Password, which
     needs 2-Step Verification on that account. Enter both in Authentication → Emails → SMTP Settings.
     Emails then come from that Gmail address. Google limits how many emails one account may send per
     day, and Supabase allows 30 per hour with custom SMTP. Check Google's current help if these
     settings differ.
   - **c. Later, with a domain:** custom SMTP from your own domain, with SPF and DKIM set up.
6. **Owner test after the change.** Register with a mailbox that is not on the team. Record the time,
   whether the code arrived, whether it was in spam, and whether it worked.

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
- Team membership. The Supabase tools here do not list organization members.
