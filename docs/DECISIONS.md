# Decisions for the owner (recommended default, consequences)

Nothing below has been chosen or applied. Each item says what happens if you accept the default and what changes if you don't.

## 1. Order rate limit (0025)
**Recommended default: 60 orders per hour per connection (as written).**
- Accept: one device or network can create at most 60 orders an hour, so a flood is capped at about 1,440 a day per connection. A single print shop's customers will not come near this.
- Risk of too low: customers behind one shared address (a campus network) are refused with "try again later" during a rush. Risk of too high: less protection.
- The limit does not stop an attacker who uses many addresses. It is a brake, not a wall.
- Changing the number later is a one-line migration. Choose a different number if you expect more than 60 real orders an hour from one network.

## 2. Maximum shops per owner
**Recommended default: 3 per account, enforced in `create_shop`. Not implemented yet.**
- Accept: I add it as migration 0026 once you confirm the number. Existing accounts are untouched (the most any account has today is 2).
- Without a cap, any signed-in account can create unlimited shops. Today that includes the 3 production accounts that have a confirmed email and a password (one of them is owner C) (they can sign in to the auth API directly). The cap limits what a stolen or abusive account can do.
- A cap that is too low blocks a genuine multi-branch owner; they would need an operator to raise it.

## 3. `quote_order` and VOLATILE
**Recommended default: leave it STABLE and unlimited.**
- It only returns prices a visitor can already see (open shops, active services). Nothing is written.
- Rate limiting it requires VOLATILE, which stops PostgREST treating it as a read-only GET and changes how clients call it. That risks the customer order flow for little gain.
- If a flood of quotes ever becomes a cost problem, put a limit in front (the edge or the CDN) rather than in the function.

## 4. Dashboard settings (B1, B3, B8)
Exact steps are in `DASHBOARD_SETTINGS.md`. **Nothing was changed.**
- **Public email sign-up: recommend OFF.** Username accounts are created by the `owner-auth` function through the admin API, which is not blocked by this switch. Consequence: nobody can create an account through the open auth endpoint. Production has 6 accounts with no shop (4 unconfirmed) which look like sign-ups that came through that open endpoint.
- **Email provider: keep ON** (as you instructed). Username accounts use a placeholder address and depend on the provider being enabled.
- **Leaked-password protection: recommend ON if the project is on a plan that has it** (it is a paid-plan feature). `owner-auth` already checks every password against HaveIBeenPwned and fails closed, so on the free plan the username flow is protected anyway; the dashboard switch would additionally cover direct calls to the auth API. Consequence of ON: a password that appears in a breach is refused in both places.

## 5. Legacy owner timing (B4)
**Recommended default: move all three owners to usernames after the production migrations and before the new app is published, one at a time, with a backup first.**
- The two owners with no password have never signed in and their email was never confirmed. The new app has no email sign-in, so until they claim, they cannot use the new app at all.
- Claim codes last 72 hours and are single use, so there is no deadline pressure. A late claim just needs a new code.
- If you would rather publish first, they stay on the old email accounts and are locked out of the new app until claimed. Their shops, orders and files are safe either way.
- Process and the identity check for the two accounts without passwords: `CLAIM_RUNBOOK.md`.

## 6. Approvals needed (nothing proceeds without them)
Staging package (S1 to S6): `STAGING_APPROVAL.md`. Production package: `PRODUCTION_APPROVAL.md`. Migration detail: `MIGRATION_REFERENCE.md`.
Staging comes first and production only after staging passes.

## 7. The other six production accounts
Six accounts own no shop (two confirmed with a password, four unconfirmed). **Recommended default: leave them alone for now**, switch off public sign-up, then ask who they belong to. Deleting auth users is not reversible without a backup, so I will not touch them without your instruction.

## 8. Things only you can supply for a signed release
Android upload keystore and Play account; a Windows code-signing certificate (see `WINDOWS_INSTALLER.md` for what to buy); the real legal text and contact details for Terms and Privacy.
