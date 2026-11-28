# Moving a legacy owner to a username (B4)

Status: implemented and tested; **not applied to staging or production**. Needs migration 0024 and the `owner-auth`
function version that has the `/claim` route.

## What it does

Production has three owners who signed in with an email address (two of them never set a password). The new app only
signs in with a username. A **claim** converts the *same* auth user in place: the user id does not change, so the shop,
memberships, services, orders, files and events stay attached. Nothing is deleted or recreated.

## Who can claim

A legacy owner is an auth user with a real (non-`@accounts.qrquick.invalid`) email, an owner membership, no username
and no `owner_flow = username-v1`. `public.owner_is_legacy(uuid)` is the single definition.

List them (operator, SQL editor, read-only):

```sql
select u.id, u.email, u.last_sign_in_at, (u.encrypted_password is not null) as has_password,
       s.slug as shop
from auth.users u
join public.shop_memberships m on m.user_id = u.id and m.role = 'owner'
join public.shops s on s.id = m.shop_id
where public.owner_is_legacy(u.id)
order by u.email;
```

## Steps for each owner

1. **Verify the person.** Contact them on a channel you already trust for that shop (the phone number on the shop, not
   the email in the claim). Ask for something only the shop owner knows (for example the last order's tracking code).
2. **Issue the code** in the SQL editor. It prints once and is valid 72 hours; only its bcrypt hash is stored:
   ```sql
   select public.owner_issue_claim_code('<auth user id>');            -- default 72 hours
   select public.owner_issue_claim_code('<auth user id>', 24);        -- or a shorter life, 1 to 168 hours
   ```
   Issuing again replaces any unused code.
3. **Send the code** by a different channel from the one used to verify (for example read it over the phone).
4. The owner opens the app, taps *Already have a shop with an email sign-in? Move it to a username*, and enters the old
   email, the claim code, a new username and password, and accepts the Terms and Privacy Policy.
5. The app shows ten new recovery codes once. The old email and password stop working.

## What the server checks, in order

Rate limit (per address and per email) → username rules → password rules → Terms/Privacy versions → breached-password
check (fails closed) → email + code (one generic refusal for wrong email, wrong code, expired code, used code, and an
account that was already moved) → username free → code consumed → database side in one transaction → auth user updated
through the admin API → identity row synced → signed in.

If the auth update fails, `owner_claim_undo` removes the username, acceptances and recovery codes and the code is
re-opened; the legacy account is unchanged. All of this is covered by unit tests (11) and the SQL suite `stage10`
(70 checks).

## Rehearsal evidence

`supabase/deploy/full_chain/rehearse_chain.sh` builds a production-shaped copy (three legacy owners, two without a
password, shops, services, orders, files), applies 0010 and 0015 to 0025 in order, claims one owner, and shows that the
other eight data tables compare equal by row digest, the user ids are identical, and the other two owners stay legacy.

## Undoing a claim

Not automatic. A converted account has a new address and password. Restore from the backup taken before the claim, or
re-issue the owner access by hand with the admin API (set the old email, set `owner_flow` back, delete the username row).

## Open decision for the owner

Whether legacy owners must claim before the new app ships (they cannot sign in to the new app with an email) or the old
app version stays available to them for a period. Either way the **email provider stays enabled**, because the username
accounts depend on it.

## The two owners without a password (checked read-only on production, 2026-11-27)

Owner A (1 shop, 1 order) and owner B (2 shop memberships, 5 orders) have no password, have never signed in, and their
email address was never confirmed. Owner C (1 shop, 1 order) has a password and last signed in on 2026-11-21.

What this changes:
- The email address on file is **not proof of identity** for A and B: nobody has ever received a message at it. The claim
  code is therefore the only proof, and the proof it carries is whatever you verify out of band in step 1.
- Do not issue a code until you have confirmed the person by a channel you already trust for that shop (the shop's phone,
  an order you can match). If you cannot confirm them, do not issue a code. The account stays as it is.
- The claim asks for the old email and the code. If the owner does not remember which address was used, read it to them
  over the same trusted channel; do not send it with the code.
- Order of work: C first (has a password and recent activity, so they can confirm easily), then A, then B.
- After each claim: compare the shop and order counts with the numbers above, and confirm the user id is unchanged.
  Expected: A 1 shop / 1 order, B 2 shops / 5 orders, C 1 shop / 1 order.

Do not issue a code to any of the six accounts that own no shop. They are listed in `DECISIONS.md`, item 7.
