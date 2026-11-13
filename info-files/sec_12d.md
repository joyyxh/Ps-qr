### 12D. O12 hosted staging: cost and setup report (2026-11-04)

*Report only (2026-11-04 no. 9). Creating a project, adding credentials, running SQL or tests, applying migrations and deploying are NOT approved. Each needs its own approval (O11, O12, O13).*

**Prices.** From the Supabase pricing page, retrieved 2026-11-04. USD, before tax. Supabase applies tax by billing address. Check again at project creation.
- **Free:** $0 a month. Limit of 2 active projects. A free project pauses after 1 week of inactivity. 500 MB database, 1 GB file storage, 50,000 monthly active users, 1-day log retention. Basic MFA is included.
- **Pro:** from $25 a month, first project included. Additional projects from $10 a month. Includes $10 a month of compute credit, enough for one Micro instance. The spend cap is on by default. Projects on Pro are not paused for inactivity. Daily backups are kept for 7 days.
- **Compute:** Micro $10 a month (shared CPU, 1 GB RAM; 60 direct and 200 pooled connections). Small $15 a month (2 GB RAM).
- **Branching:** $0.01344 per branch per hour on Pro (about $9.81 for a 730-hour month). Not assessed further: how a branch is seeded, and whether it holds production data, is not verified.

**Not verified.** The organisation's current plan, the production project's compute size and the number of projects in use. Claude has not checked them. The owner should confirm them in the dashboard. Until then the figures above cannot be applied to this organisation.

**Options**

| Option | Approximate cost | Points to confirm |
|---|---|---|
| A. A free-plan project, if the organisation can add one within its 2-project limit | $0 | Pauses after 1 week of inactivity, so tests need it unpaused; 1-day log retention; no point-in-time recovery |
| B. An additional Micro project on Pro | About $10 a month more, unless the $10 credit is unused | Organisation is on Pro; production compute size; spend cap stays on |

Claude does not recommend a plan until the organisation's current plan is known.

**Setup requirements (to confirm before approval)**
1. A separate project. The live production project must not be used or reused.
2. Synthetic data only. No production data, customer files, secrets or service-role keys.
3. The spend cap stays on. Set the budget before creation.
4. SQL and tests run only against the staging project (`CLAUDE.md`). A localhost name does not prove a test database.
5. Migration 0011 needs pre-staging review (O2) before any staging run. Applying 0010 to a staging copy needs its own approval (§15.3, 7B).
6. Any test account, including an admin account for the O11 `aal2` check, needs explicit approval (§15.2). Basic MFA (TOTP) is included on every plan.
7. Credentials are not stored in the repository, `web/`, `mobile/` or any committed file (`CLAUDE.md`).
8. The owner decides the organisation, plan, project name, region, budget and who holds access.

**Not approved by this report:** project creation, credentials, SQL execution, test runs, migration application, deployment, commit and push.
