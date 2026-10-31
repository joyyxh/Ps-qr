# Stage 7 decisions: draft for owner review

**Status:** DRAFT PROPOSAL. This file is not an approval of any business, legal, tax, pricing, or technical decision.
**Date:** 2026-10-31 (last updated). Final documentation pass 2026-10-30, register and checks 2026-10-31, consistency correction 2026-10-31, four-issue resolution 2026-10-31, owner decisions and correction pass 2026-10-31: corrections are in §13, the decision register in §14, the roadmap in §15 and the exit checklist and verdict in §16. Corrected 2026-10-29 after the read-only audit and a targeted correction pass. Corrections are listed in §13. Admin-grant and manual licence design added 2026-10-29 (§12A). Stage 7 decision record (A–L, M1–M8), state-machine corrections, and R1–R19 findings added 2026-10-29 (§12B). Where §12A and §12B differ, §12B governs.
**Worktree:** `/home/claude/joyyxh/ps-qr-stage7`, branch `stage7-payments`, base `origin/main` at `717717b`
**Committed:** No. Untracked draft.

**Labels used**
- **PENDING OWNER APPROVAL:** every undecided item.
- **Verified:** read on the access date from the cited official or primary page. **Re-fetched** marks a page read again on 2026-10-29 in an earlier revision. Other Verified rows are from Phase 1. The correction pass accessed no external source.
- **Company statement:** a provider's own description of its status or service. Not regulatory text.
- **Secondary:** a third-party or company-blog summary, not checked against the primary text.
- **Assumed:** no source; a working number for the model.
- **Derived:** calculated from Verified or Assumed inputs. The formula is shown.
- **Scenario:** a value shown for both Free and Pro because the email-volume tier (E) is undecided. It is not a choice.
- **Unverified:** not checked. No conclusion is drawn.
- **Provisional:** depends on an Unverified or Assumed input. Do not rely on it.
- **[OWNER TO PROVIDE]:** information not known. Nothing has been assumed.
- **README statement:** a claim made in `README.md` or another repository document. It was not checked against the live project and is not treated as verified.
- **Register status:** §14 gives each numbered item (1–35), each group (A–E) and each open ID exactly one of five statuses: DECIDED, RECOMMENDED, DEFERRED, EXTERNAL BLOCKER, IMPLEMENTATION GATE.

---

## 1. Business facts: not known, not assumed

| Item | Status |
|---|---|
| Business entity type (proprietorship, company, LLP, other) | [OWNER TO PROVIDE] |
| PAN | [OWNER TO PROVIDE] |
| GSTIN | [OWNER TO PROVIDE]. None assumed. |
| Home state of registration | [OWNER TO PROVIDE] |
| Shops outside that state at launch? | [OWNER TO PROVIDE] |
| Existing Stripe India account (active, invited, or none) | [OWNER TO PROVIDE] |
| Bank account in the entity's name | [OWNER TO PROVIDE] |
| Permission to charge customers for licences | [OWNER TO PROVIDE]. **No permission is assumed.** |
| Turnover to date | [OWNER TO PROVIDE] |
| Existing shops that would receive a free period (N, §5B) | [OWNER TO PROVIDE] |

---

## 2. Repository facts

- Migrations `0001` to `0010` contain no plan, billing, licence, or entitlement column. (Searched 2026-10-28 and 2026-10-29 in earlier work. Searched again 2026-10-30: no match for `plan`, `billing`, `licence` or `entitle`.)
- No Stripe or Razorpay code or dependency exists in `web/`, `mobile/`, `agent/`, or `supabase/`. Stripe appears in the worktree only in `README.md`, `CLAUDE.md`, and this draft. Razorpay appears only in this draft (grep, 2026-10-29 and again 2026-10-30).
- **"Stripe is installed" appears in `README.md`.** Lines 22 and 35 read "Stripe is installed but not connected" and "Stripe (installed, not connected)". This is a README statement, not evidence of an installed package. The bare word "installed" also appears in unrelated code and docs: `agent/src/cli.mjs`, `agent/src/printers/linux.mjs`, `agent/src/printers/windows.mjs`, `agent/test/printers.test.mjs`, and `TODO.md` line 38. The tracked-file search was capped at ten lines, so this list is not exhaustive. The Stripe claim rests on `README.md` lines 22 and 35.
- **Resend.** No direct Resend or SMTP API call exists in `web/`, `agent/`, or `supabase/` (grep, 2026-10-29). The "Resend code" button is rendered at `web/src/owner.js` line 327 and bound at line 332. Its countdown runs at lines 337–350. The `resendSignupCode` call sites are `web/src/owner.js` lines 259 and 358 (`onResendCode`, which starts at line 353). `resendSignupCode` is defined in `web/src/auth.js` (lines 207–208) and requests Supabase Auth's `/auth/v1/resend` endpoint (test at `web/tests/owner-registration.test.js` line 344). Re-checked 2026-10-30. Sign-up codes are therefore sent through Supabase Auth. QRquick is not integrated with Resend. Whether Supabase Auth uses custom SMTP, and through which provider, is not shown in the repo. The Supabase dashboard was not checked.
- Next free migration number: `0011`.
- Worktree: `stage7-payments` at `717717b`. Untracked: `CLAUDE.md`, and this file.
- Main checkout: three pre-existing modified files (`agent/README.md`, `agent/src/worker.mjs`, `agent/test/worker.test.mjs`) and stash `b559dce`. Not touched.
- **Stage 6 branch (checked 2026-10-30).** `stage6-simulated-printer` at `885d28b` ("Stage 6: offline simulated printing for the local print agent") exists locally and as `origin/stage6-simulated-printer`. It is not an ancestor of `origin/main` (717717b). The base print agent is already on `origin/main`: `agent/src/worker.mjs`, `supabase/functions/print-agent/index.ts` and `supabase/migrations/0010_print_agents.sql`.
- **`place_order`, two signatures (checked 2026-10-30).** The three-argument version, `place_order(text, jsonb, text)`, is created in 0001 (line 397) and re-created in 0003 (line 186). Its grants are in 0001 (lines 490 and 496) and 0003 (lines 277–278). 0003 grants `execute` to `anon` and `authenticated`. The four-argument version, `place_order(text, jsonb, text, text)`, is created in 0008 (line 55) and 0009 (line 33). It calls the three-argument version (0008 line 75; 0009 line 62). Its grants are in 0008 (lines 114–115) and 0009 (lines 80–81), to `anon` and `authenticated`. No migration drops the three-argument version. **Live state UNVERIFIED.**
- **Cleanup function and schedule (checked 2026-10-30).** `supabase/functions/cleanup-files/index.ts` exists. `.github/workflows/cleanup-files.yml` runs it on cron `30 20 * * *` (UTC), which is 02:00 IST, and needs repository secrets `QRQUICK_CLEANUP_URL` and `CLEANUP_SECRET`. `docs/PRINTING_STATUS.md` line 24 says "Built, not deployed". **Deployment and secrets UNVERIFIED.**
- **Live-state claims in the README (not checked against the live project).** The README says the project is in `ap-south-1` (Mumbai) on the free plan (lines 32–33). It says migrations `0003` and `0006` are applied to the live project (lines 16 and 18), and that migrations `0004` and `0005` are not re-checked there (line 279). It says both edge functions are deployed, with `owner-file-link` having JWT checks on (lines 215–217). It says the consolidated migration "mirrors the migrations applied to the live project" (line 308) without naming 0010. `docs/PRINTING_STATUS.md` line 54 says migration 0010 "is not applied anywhere yet". The live state of 0007 to 0010 is therefore **UNKNOWN**.
- **No `supabase/config.toml` exists** (checked 2026-10-30). Verify-JWT and other function settings are not recorded in the repository.
- **Repository drift (checked 2026-10-30; not fixed here).** README line 22 says Stage 7 is "Not started (Stripe is installed but not connected)". README line 23 says Stage 8 is "Not started" and that uploaded files are kept "until someone removes them by hand", although the cleanup function is already in the repository. README line 21 says Stage 6 is "Not started"; `CLAUDE.md` says the base print agent is on main. Fixing README or `CLAUDE.md` needs approval.

---

## 3. Externally verified facts

| Fact | Source | Type |
|---|---|---|
| Businesses from India cannot sign up on Stripe's website. Accounts are invite-only, with no published criteria or timeline. Active Indian accounts continue. | Stripe support, "Stripe accounts are invite-only in India", https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india | Verified |
| Stripe India: domestic Visa and Mastercard 2%. Domestic debit 0.4%, capped at ₹200 per footnote. No setup or monthly fee. ₹1,000 per dispute received. Refunds do not return processing fees. Page undated. | Stripe, "Pricing & Fees" (India), https://stripe.com/in/pricing | Verified, undated |
| Stripe charges 18% GST on its fees. **No GST on fees for single card transactions up to ₹2,000.** This is a GST rule stated by Stripe. Stripe does not state a separate fee rate for this case. | Stripe support, "Taxes on Stripe fees for India-based businesses", https://support.stripe.com/questions/taxes-on-stripe-fees-for-india-based-businesses | Verified |
| Stripe India requires PAN, except for sole proprietors. The payout account must be in the legal entity's name. Stripe states that Stripe India Pvt Ltd acts as a payment aggregator under RBI KYC rules. | Stripe, "Complying with RBI's Guidelines on Payment Aggregators and Payment Gateways and KYC Master Direction, 2016", https://stripe.com/en-fi/guides/rbi-guidelines-kyc-direction | Company statement (Stripe-hosted). Not regulatory text. |
| Razorpay: cards 2% plus GST on the fee. UPI 2% platform fee, which conflicts with the note that the government sets UPI MDR at 0%. Netbanking 2%. No setup or AMC fee. T+2 settlement. Temporary zero-platform-fee offer for activations from 1 July 2026, capped at ₹5 lakh GMV or 90 days. | Razorpay, "Razorpay payment gateway pricing explained", https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/ (page dated 13 Feb 2026) | Secondary |
| Razorpay India KYC documents: PAN, GST certificate or non-enrolment declaration, and a bank proof. | Razorpay, "Payment Gateway KYC Onboarding Guide India (2026)", https://razorpay.com/blog/payment-gateway-kyc-onboarding-india/ | Secondary |
| CGST s.22(1): registration threshold of ₹20 lakh aggregate turnover for suppliers of **services** in normal-category states, and ₹10 lakh for special-category states. The same section sets a different threshold for goods, which this draft does not use. | CBIC, Section 22 of the CGST Act, https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter6/section22_v1.00.html | Verified, official |
| CGST s.24(i): registration is compulsory for "persons making any inter-State taxable supply", notwithstanding s.22(1). | CBIC, Section 24 of the CGST Act, https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter6/section24_v1.00.html | Verified, official |
| Notification 10/2017-Integrated Tax, dated 13 Oct 2017: exempts persons making inter-State taxable service supplies whose all-India turnover is at most ₹20 lakh (₹10 lakh for special-category states). Later amendments not checked. | CBIC PDF, https://cbic-gst.gov.in/hindi/pdf/integrated-tax/10_2017_IT.pdf | Verified as shown on PDF |
| Notification 8/2017-Integrated Tax (Rate), dated 28 Jun 2017: 18% for heading 9983 (serial 21(ii)) and heading 9984 (serial 22). No separate SaaS or OIDAR entry found. | CBIC PDF, https://cbic-gst.gov.in/hindi/pdf/integrated-tax-rate/Notification8-IGST.pdf | Verified text; QRquick's classification not confirmed |
| Supabase Pro from $25/month, with a $10 compute credit, 8 GB database, 100 GB storage, and 250 GB egress. Overages $0.125/GB database, $0.0213/GB storage, $0.09/GB egress. Spend caps on by default. Page says prices "may change". | Supabase, pricing, https://supabase.com/pricing.md | Verified, undated |
| Supabase built-in auth email: 2 per hour. Custom SMTP limit is adjustable. | Supabase docs, "Rate limits", https://supabase.com/docs/guides/auth/rate-limits | Verified |
| Supabase region `ap-south-1` (Mumbai) is listed. New-project availability not confirmed. | Supabase docs, "Available regions", https://supabase.com/docs/guides/platform/regions.md | Verified listing only |
| Resend: Free 3,000 emails/month, 100/day. Pro $20/month for 50,000 emails/month. Tiers above Pro not retrieved. | Resend, pricing, https://resend.com/pricing.md | Verified, undated |
| Google Play: one-time $25 registration fee. | Google Play Console Help, "Get started with Play Console", https://support.google.com/googleplay/android-developer/answer/6112435?hl=en | Verified |
| **GitHub Pages:** available in public repositories on GitHub Free. Private repositories need GitHub Pro, Team, Enterprise Cloud, or Enterprise Server. If the owning account is on GitHub Free, the repository must be public. Pages sites are publicly reachable even when the repository is private, if the plan allows. | GitHub Docs, "Creating a GitHub Pages site", https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site | **Re-fetched 2026-10-29** (earlier revision) |
| RBI directions (21 Apr 2026): recurring transactions up to ₹15,000 need no extra authentication. | MediaNama, https://www.medianama.com/2026/04/223-rbi-additional-factor-authentication-e-mandates/ | Secondary; RBI text not read |
| DPDP Rules notified Nov 2025. Most obligations apply 18 months after publication. | Storyboard18, https://storyboard18.com/amp/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm (dated 14 Nov 2025) | Secondary. "About May 2027" is my arithmetic. Penalties not in source. Applicability not analysed (§4). |
| Competitor prices: myBillBook Plus ₹3,490/yr, Pro ₹3,990/yr. The page's listed prices conflict with its struck-through figures. **Not a like-for-like comparator (billing software, not print ordering). Not used in any pricing decision.** | myBillBook, https://mybillbook.in/pricing-plans (undated) | Verified, undated |
| Competitor prices: GoFrugal entry billing ₹5,000–15,000 one-time or ₹500–1,500/month, before GST. | GoFrugal, https://cdn-origin.gofrugal.com/blog/billing-software-cost/ (dated 6 May 2026) | Verified, dated |
| Competitor prices: Petpooja $800, $1,600, $2,000 per outlet per year. Restaurant POS, not a direct comparator. | Petpooja, https://amd.petpooja.com/pricing (undated) | Verified, undated |
| Competitor prices: Printo ₹5 per "piece" for unbound documents. "Piece" undefined. | Printo, https://printo.in/p/document-printing-service-in-india (undated) | Verified, undated. Customer-facing, not a subscription comparator |
| USD/INR ≈ ₹94.6 implied by a 22 Oct 2026 rate table. | Ekantipur, https://ekantipur.com/business/2026/10/22/en/october-22-2026-whats-the-exchange-rate.html | Secondary, indirect |

**Access date for all rows above: 2026-10-29**, during Phase 1 research. The GitHub Pages row was re-fetched on 2026-10-29 in an earlier revision. The correction pass accessed no external source.

---

## 4. Unverified or unresolved

- **Stripe access:** invite-only for new businesses. Whether QRquick has an account or invite is unknown.
- **Razorpay India onboarding:** the Razorpay docs I could read show only US sign-up. Self-serve for Indian businesses is unverified.
- **Stripe UPI and netbanking fees (India):** unverified. The general page shows 2% UPI; no India-specific page was read. Settlement timing and payout schedule unverified.
- **Stripe ≤₹2,000 rule for debit cards:** the rule is stated for "card transactions". Whether it covers debit cards is unverified.
- **GST classification:** 18% is likely for this kind of service, but no source confirms it for QRquick's service.
- **Exemption status:** Notification 10/2017-IT's current status, later amendments, and how the ₹10 lakh special-category limit applies are unchecked.
- **Registration route:** a qualified Indian CA must decide. No legal conclusion is drawn here.
- **Input tax credit and reverse charge:** whether QRquick, if registered, can claim input credit on its own costs (Supabase, Resend, domain, and others), and how reverse-charge applies to foreign services. Not modelled. **CA review required.**
- **TDS:** whether business customers deduct TDS on payments to QRquick. Unverified.
- **Consumer protection and refunds:** not researched. No legal conclusion is drawn here.
- **DPDP applicability and obligations (new):** not analysed. Whether and when DPDP obligations apply to QRquick, and what they require for customer files, needs qualified Indian legal review. Penalties are not in the source read. **Lawyer review required.**
- **RBI e-mandate:** whether manual annual payments fall under the e-mandate rules. Not decided here. Based on a secondary summary.
- **Supabase data location:** README lines 32–33 state `ap-south-1` (Mumbai). This is a README statement, not checked against the live project. Availability of `ap-south-1` for new projects is unconfirmed.
- **Supabase plan:** §5 uses Supabase Pro (₹2,375 a month) as the cost base. README lines 32–33 say the live project is on the free plan. The live plan is **UNVERIFIED**. The Pro figure is a forward assumption.
- **Live Auth settings:** README next steps item 6 lists leaked-password protection and the Site URL as open. SMTP and MFA settings are not recorded anywhere in the repository. **UNVERIFIED.**
- **Live migration state (0007 to 0010):** unknown (§2). **Production-owner check** (§14, item 26).
- **Cleanup deployment and secrets:** unverified (§2, §5C). **Production-owner check** (§14, item 27).
- **Hosting (GitHub Pages):** the ₹0 assumption is **PROVISIONAL**. Official documentation (re-fetched 2026-10-29 in an earlier revision) says Pages on private repositories needs a paid GitHub plan, and that a GitHub Free account must use a public repository. Repository visibility and the owning account's plan are **not verified**. The tool refused to fetch the repository URL because that URL had not appeared in the conversation's provenance set. The refusal is not evidence of visibility either way. The price of any paid GitHub plan is not in this draft and was not retrieved.
- **Email-volume tier, E (new):** undecided. Not in the repo. Results that change with E are shown for both Free and Pro (§5A). **PENDING OWNER APPROVAL.**
- **Resend tiers above Pro (new):** the price and email limit of any tier above Pro (50,000 emails/month) were not retrieved. The 10,000-shop net is **PROVISIONAL**.
- **Database size and overage:** not estimated. Overage beyond 8 GB is unmodelled.
- **FX rate:** no official USD/INR rate retrieved. The FBIL reference-rate page was blocked to my tool by robots. No RBI rate found.

**This file is not legal or tax advice.** A qualified Indian CA and lawyer must review the tax and legal items, including DPDP.

---

## 5. Assumptions and formulas

| Assumption | Value | Status |
|---|---|---|
| FX | ₹95 per USD | Assumed. Sensitivity in §6 item 10. |
| Supabase Pro | $25 × 95 = ₹2,375/month | Verified price × assumed FX |
| Resend Free | ₹0. 3,000 emails/month; 100/day | Verified limits |
| Resend Pro | $20 × 95 = ₹1,900/month. Applies only when shops exceed 150 ÷ E (§5A). | Verified price × assumed FX |
| Email-volume tier, E | Emails per order. Undecided. Scenarios shown in §5A. | Assumed. **PENDING OWNER APPROVAL.** |
| Domain | ₹100/month | Assumed |
| Accounting and GST filing | ₹3,000/month. 54.8% of F_A. | Assumed, no source |
| Fixed base, Resend Free | F_A = 2,375 + 100 + 3,000 = **₹5,475** | Derived |
| Fixed base, Resend Pro | F_B = F_A + 1,900 = **₹7,375** | Derived |
| Processor fee, main case | 2.36% of gross = 2% fee × 1.18 (18% GST on that fee) | **Derived** from verified inputs (§3). Used as the main case for all options. For Options A and B (≤ ₹2,000), it is conservative against the derived 2.00%. For Option C (₹2,999), it is the applicable assumption under the §3 rule as drafted (see note below). |
| Stripe card, ≤₹2,000 GST rule | No GST on fees for single card transactions up to ₹2,000 | Verified rule (§3) |
| Stripe card fee rate under that rule | 2.00% of gross (2% with the 18% GST removed) | **Derived** from the verified rule. Sensitivity only. |
| Stripe debit fee | 0.4% (§3, Stripe pricing row) | Verified rate. Whether the ≤₹2,000 rule applies to debit is Unverified (§4). |
| Licence GST rate | 18% | Assumed classification (§4) |
| Orders per shop | 20/month | Assumed |
| File size | 2 MB average | Assumed |
| Emails per order | E. Undecided (§5A). | Assumed |
| File retention (two rules, §5C) | Unclaimed files: expire one day after upload (`customer_files.expires_at`, 0003 line 41). Claimed files: removed only after the order has been completed, cancelled or rejected for 30 days, and only when no queued, claimed, printing or needs-check job uses the file (0010 lines 794–807). | **Code in repo. Live deployment UNVERIFIED.** `docs/PRINTING_STATUS.md` line 24 says "Built, not deployed". See §5C. |
| Payment pattern | Yearly, all shops pay, no churn. The base tables do not model trials, free periods, or churn (see §5B). | Assumed |
| Payment channel | A working processor or other payment channel exists | **Unverified.** Revenue projections are conditional on it (§8, §9 item 9, §10 item 2). |
| Unpriced | Founder and support time, compute upgrades, database overage, paid GitHub plan if needed, CA and lawyer fees | Excluded. See §8 and §8A. |

**Formulas**
- Ex-GST price = price incl. GST ÷ 1.18
- GST = price incl. GST − ex-GST price
- Processor fee = fee rate × gross (the price incl. GST)
- Monthly net per shop, GST charged = (ex-GST ÷ 12) − (fee ÷ 12). For ₹1,499: 1,270.339 ÷ 12 − 35.376 ÷ 12 = 102.9135.
- Monthly net per shop, GST not charged = (gross ÷ 12) − (fee ÷ 12)
- **Break-even shops (minimum to cover costs) = ⌈fixed monthly ÷ monthly net per shop⌉.** Rounded up, because the smallest whole number of shops that covers costs is needed.
- **Maximum shops under a turnover limit = ⌊limit ÷ annual ex-GST price⌋.** Rounded down, because the limit is a maximum. See §6 item 7.

**Processor fee note.** The 2.36% is 2% × 1.18. The 2% and the 18% GST are both verified (§3), so 2.36% is derived. Under the §3 rule as drafted, GST on the fee is removed only for single card transactions up to ₹2,000. For those, the derived rate is 2.00%. Above ₹2,000, which includes Option C (₹2,999), 2.36% is the applicable assumption. It is not a conservative figure in that case. Whether the rule covers debit cards, UPI, or netbanking is unverified (§4). All of this assumes a working processor exists (§9 item 9, §10 item 2).

### §5A Email volume and the Resend threshold

**Base-case status: E is undecided.** No source or repo fact sets it. Every result that changes with E is shown for both Free and Pro. No result assumes Pro silently. **PENDING OWNER APPROVAL.**

E = emails per order. **Assumed, not from the repo.** Pro thresholds are Verified (§3 Resend row). Order volume of 20 orders per shop per month is Assumed.

- Monthly emails M = shops × 20 × E
- Free ceiling: M ≤ 3,000 per month. The 100/day limit is separate: a monthly total under 3,000 can still fail on a busy day, so daily sends must also stay within 100.
- Pro ceiling: M ≤ 50,000 per month.
- **Pro applies when shops exceed 150 ÷ E.** Maximum shops on Free = 3,000 ÷ (20 × E) = **150 ÷ E**. Maximum shops on Pro = 50,000 ÷ (20 × E) = **2,500 ÷ E**.

| E (emails per order) | Maximum shops on Free | Maximum shops on Pro |
|---|---|---|
| 1 | 150 | 2,500 |
| 1.5 | 100 | 1,666 |
| 2 | 75 | 1,250 |
| 2.5 | 60 | 1,000 |

Implications:
- **100 shops (Scenario):** Free applies if E ≤ 1.5, with fixed cost ₹5,475 and monthly result ₹4,816 (100 × 102.9135 − 5,475). Pro applies if E > 1.5, with fixed cost ₹7,375 and monthly result ₹2,916 (100 × 102.9135 − 7,375). Both are shown wherever 100 shops appear.
- **1,000 shops:** Pro applies if E > 0.15. Pro covers 1,000 shops up to E = 2.5. The Pro figures for 1,000 shops are valid only for 0.15 < E ≤ 2.5.
- **10,000 shops:** M = 200,000 at E = 1 (4 times the Pro allowance) and 400,000 at E = 2 (8 times). Pro cannot cover 10,000 shops at any E above 0.25. The next tier is not priced (§4), so the 10,000-shop net is **PROVISIONAL**.
- **Sign-up codes** are not counted in M. Sign-up codes are sent by Supabase Auth (§2). Supabase's built-in limit is 2 emails per hour (§3), so production sign-up email would need custom SMTP. Which provider to use, and when, is not decided. **PENDING OWNER APPROVAL.**

### §5B Timing: free periods, trials, and the basis of break-even

**Inputs**
- N = existing shops that would receive a free period: **[OWNER TO PROVIDE]**. The figures below use N = 100 only to show the arithmetic. They are not a forecast.
- Per paying shop, GST charged: ex-GST ₹1,270.34 less processor fee ₹35.38 = **₹1,234.96 per year**, or **₹102.9135 per month** (unrounded).
- F = fixed monthly cost. Free: ₹5,475. Pro: ₹7,375. Pro applies only if E > 1.5 at N = 100 (§5A).
- Assumed throughout: GST charged, no trial, no churn, no new shops, fixed cost constant for the period, no compute upgrade.

**Forgone or deferred (Decision 8).** Decision 8 as drafted says the free period gives no licence revenue from these shops in year one. It does **not** say whether the paid term is extended afterwards. This draft's illustrations assume **no extension**, so that year-one licence revenue is **forgone**. If the paid term were extended by the free months, the same revenue would instead be **deferred** (collected later, not lost). The choice is open. **PENDING OWNER APPROVAL (decision 8).**

**Two bases. These are not interchangeable.**
- **Accrual basis:** annual fees spread evenly across months. Used for the monthly operating result and the accrual break-even month.
- **Cash basis:** each shop pays once a year, at the start of its term. Used for the cash position. Simplified: GST is remitted from the receipt; processor settlement and remittance timing are ignored.

**Formulas (N existing shops, GST charged)**
- Year-one forgone licence net = N × 1,234.96
- Year-one net, pay from month one = N × 1,234.96 − 12F
- Year-one net, 12-month free period = −12F
- Accrual monthly result after the free period = N × 102.9135 − F
- Accrual break-even month = 12 + ⌈12F ÷ (N × 102.9135 − F)⌉. Defined only where N × 102.9135 > F.
- Cash position after month 13 = N × 1,234.96 − 13F, assuming all N pay at the start of month 13.

**Illustration at N = 100 (illustration only; PENDING OWNER APPROVAL, decision 8)**

| Result | Free (E ≤ 1.5): F = ₹5,475 | Pro (E > 1.5): F = ₹7,375 |
|---|---|---|
| Year-one net, all pay from month one | +₹57,796 | +₹34,996 |
| Year-one net, 12-month free period | −₹65,700 | −₹88,500 |
| Year-one forgone licence net (N = 100; ex-GST, after processor fee) | ₹1,23,496 | ₹1,23,496 |
| Accrual monthly result after the free period | +₹4,816.35 | +₹2,916.35 |
| Accrual break-even month (from launch) | **Month 26** | **Month 43** |
| Cash position after month 13 (annual receipts at start of month 13) | +₹52,321 | +₹27,621 |

Check of the Pro column: 100 × 1,234.96 − 12 × 7,375 = 1,23,496 − 88,500 = 34,996. The shortfall of 88,500 ÷ 2,916.35 = 30.35 gives 31 whole months after year one, so the accrual break-even is month 12 + 31 = 43. The cash position is 100 × 1,234.96 − 13 × 7,375 = 1,23,496 − 95,875 = 27,621.

**Reading the results**
- Month 26 (Free) and month 43 (Pro) are **accrual** results from the stated assumptions. They are not cash dates.
- Under annual receipts at the start of month 13, **cash turns positive in month 13** in both scenarios. That is the first cohort's position only. Later annual receipts are lumpy, and no steady-state cash break-even is computed.
- On the stated assumptions, the cash and accrual dates differ by 13 months (Free) or 30 months (Pro). Use the basis that matches the decision.
- Every Pro column result depends on E > 1.5 (§5A). Every Free column result depends on E ≤ 1.5.
- These are illustrations, not forecasts.

**Trial (decision 5, 30 days; deferred out of Stage 7, C-10):** moves each new shop's first payment back by 30 days. It changes timing only and is not modelled as lost revenue.

### §5C Storage, retention, and egress (10,000-shop scenario)

- **Retention status: CODE IN REPO; LIVE DEPLOYMENT UNVERIFIED.** The purge function `expired_customer_file_paths` (0010 lines 785–810) and its daily caller (`supabase/functions/cleanup-files/index.ts`, run by `.github/workflows/cleanup-files.yml` at cron `30 20 * * *` UTC, which is 02:00 IST) exist in the repository. `docs/PRINTING_STATUS.md` line 24 says "Built, not deployed", and line 54 says migration 0010 "is not applied anywhere yet". The function's deployment, the workflow's secrets (`QRQUICK_CLEANUP_URL`, `CLEANUP_SECRET`) and the migration state were not checked. No Supabase or GitHub Actions access was used. **The 10,000-shop storage overage in §8 assumes that retention runs.**
- Storage with 30-day retention (steady state): GB = shops × 20 orders × 2 MB ÷ 1,000 = 10,000 × 20 × 2 ÷ 1,000 = **400 GB**. This is an upper bound. It keeps every file for 30 days, but unclaimed files expire after one day (0003 line 41).
- Without retention, storage grows every month: 400 GB × months. After 12 months: 4,800 GB. Overage: (4,800 − 100) × $0.0213 = $100.11 ≈ ₹9,510 per month. **Storage only; egress excluded. Illustration only. Not in any table.**
- Overage at 10,000 shops, with retention (Assumed):
  - Storage: (400 − 100) GB × $0.0213 = $6.39 ≈ ₹607.05
  - Egress: assumes each file is downloaded once a month, so 400 GB. (400 − 250) GB × $0.09 = $13.50 ≈ ₹1,282.50
  - Total: $19.89 ≈ ₹1,889.55, shown as ₹1,890.
- **Database overage: unmodelled.** Supabase bills $0.125/GB beyond 8 GB (§3). No database size estimate exists, so no figure in this draft includes it. **PROVISIONAL.**
- Compute tier upgrades: unmodelled.
- **Purge capacity (checked 2026-10-30).** `cleanup-files` deletes at most 2,000 files per run (`BATCH_SIZE` 100 × `MAX_BATCHES` 20; `index.ts` lines 19–20). At 20 orders a month per shop and one file per order (both Assumed), the steady-state need is about 0.67 files per shop per day. The cap is reached at about 3,000 shops (2,000 ÷ 0.667). At 10,000 shops the daily need is about 6,667 files. Changing the cap is a code change that needs separate approval (§14, item 27).

---

## 6. Corrections to the Phase 1 report

1. **Break-even range.** "54–72 shops" applies only when GST is charged. Without GST the range is **45–61**. §7 labels both.
2. **Accounting dominates fixed costs.** ₹3,000 is 54.8% of ₹5,475. Without it, break-even is **25–43** (GST charged) or **21–36** (no GST).
3. **Stripe card rule.** The verified rule (§3) removes GST on fees for single card transactions up to ₹2,000. The derived fee on ₹1,499 is 2.00% × 1,499 = ₹29.98, against ₹35.38 at 2.36%. Break-even: **53–72** (GST charged). The derived 2.00% is a sensitivity, not the main case.
   - 3a. Debit cards at 0.4% with no GST on the fee: break-even **52–70** (GST charged). This assumes the ≤₹2,000 rule applies to debit cards, which is **Unverified**.
   - 3b. Debit cards at 0.4% with 18% GST on the fee (the rule not applied): **53–71** (GST charged). Fee 0.472% × 1,499 = ₹7.08 per payment, ₹0.59 per month.
4. **Option A and C break-evens.** §7 states both GST cases.
5. **10,000-shop row, arithmetic.** Revenue ex-GST ₹10,58,616. Fees ₹29,480. Net ₹10,19,870.94 from unrounded values, with fixed costs of ₹9,264.55, which displays as ₹10,19,871. The earlier ₹10,19,870 came from using the overage rounded up to ₹1,890 in the fixed cost. The net is **PROVISIONAL** and an upper bound. The Pro tier cannot cover 10,000 shops (§5A), and the next tier is unpriced.6. **GST registration route.** The Phase 1 advice to "register before first inter-state sale" was overstated. Notification 10/2017-IT exempts inter-State taxable service suppliers with all-India turnover up to ₹20 lakh (₹10 lakh for special-category states), as shown on the CBIC PDF. Its current status is **Unverified**. The s.22 threshold also applies to services supplied within one State, at the same figures. A CA must confirm which provision applies.
7. **Shop counts under the turnover limits.** Maximum shops = ⌊limit ÷ annual ex-GST price⌋. The thresholds use the **unrounded** ex-GST price of ₹1,270.339 (₹1,499 ÷ 1.18). The displayed ₹1,270.34 gives different totals if multiplied by hand, as shown below. The shop counts do not change.
   - ₹20 lakh ÷ ₹1,270.339 = 1,574.4, so **1,574 shops** (turnover ₹19,99,514; ₹19,99,515 at the displayed price). 1,575 shops would be ₹20,00,784 unrounded (₹20,00,785.50 at the displayed price), which is over the limit.
   - ₹10 lakh ÷ ₹1,270.339 = 787.2, so **787 shops** (turnover ₹9,99,757; ₹9,99,758 at the displayed price). 788 shops would be ₹10,01,027 unrounded (₹10,01,028 at the displayed price), which is over the limit.
   - These counts apply only if licences are the only turnover. The earlier figures of 1,575 and 788 rounded up, which breaks the maximum. Break-even counts (§5) are the opposite case: they round up.
8. **Processor fee and Stripe GST.** The 2.36% figure is derived (§5, processor note). It is conservative for transactions up to ₹2,000, where the verified GST rule gives a derived 2.00%. Option C (₹2,999) is above ₹2,000 and uses 2.36%. For Option C, 2.36% is the applicable assumption under the §3 rule as drafted, not a conservative one. Option A (₹499) would fall under the 2.00% rule if the ≤₹2,000 rule applies to its payments. At 2.00% its net is ₹34.41 per month, with break-evens of 160 / 215 (GST charged). The difference is negligible.
9. **Razorpay "updated 27 Oct 2026".** Unverified. The zero-fee offer may not be current.
10. **FX.** ₹95 is an estimate. Each ±₹5 moves Supabase by **±₹125 per month** at any shop count. **When Resend Pro applies** (shops above 150 ÷ E, §5A), Resend Pro moves by a further ±₹100, for a total of **±₹225 per month**. At 10,000 shops the USD overage ($19.89) adds ±₹99.45. The indirect ₹94.6 reading (§3) would lower Supabase by about ₹10 per month.
11. **Scope.** The 10,000-shop row excludes compute tier upgrades, database overage (§5C), the Resend tier above Pro (§5A), support, and founder time. The flat ₹3,000 accounting figure probably understates cost at volume; no source exists.
12. **Email (new).** Pro does not cover 10,000 shops at any E above 0.25 (§5A). The 100-shop result depends on E: **₹4,816 per month if Free applies (E ≤ 1.5), ₹2,916 if Pro applies (E > 1.5)**. E is undecided. **PENDING OWNER APPROVAL.**
13. **Retention (new).** The retention code is in the repository. Live deployment is unverified (§5C). The 10,000-shop storage overage in §8 assumes the purge runs, and is an upper bound.
14. **Timing and forgone revenue (new).** Decision 8 does not say whether the free period extends the paid term. Without an extension, year-one licence revenue is forgone. With one, it would be deferred (§5B). The illustrations assume no extension. Trials delay the first payment by 30 days. The base tables assume every shop pays from month one.
15. **Accrual and cash bases (new).** The "month 43" and "month 26" figures are accrual results. Cash turns positive in month 13 under annual receipts (§5B). Neither is a forecast.
16. **Input tax credit (new).** Not modelled (§4). The GST-charged net is conservative on this side if QRquick can claim credit. **CA review required.**
17. **Comparators (new).** The myBillBook comparison is removed from §7. It is not like-for-like, and its own page conflicts. It stays in §3 as a reference row only.
18. **Hosting (new).** GitHub Pages costs ₹0 only if the repository is public, or the owning account is on a paid GitHub plan (§3 GitHub Pages row). Visibility and plan are unverified. Hosting cost is **PROVISIONAL**.

---

## 7. Pricing options (all PENDING OWNER APPROVAL)

**Blocked (decision I, 2026-10-29, §12B): no option is approved. Pricing, minimum amount, tax treatment, and published prices stay blocked until reviewed.**

All options: 12-month term, paid by a new payment each year, no automatic renewal. Figures use the assumptions in §5. The base tables assume every shop pays from month one (§5B). Revenue is conditional on a working payment channel (§8). **PENDING OWNER APPROVAL.**

| | **A: Low-cost pilot** | **B: Recommended proposal** | **C: Higher-priced** |
|---|---|---|---|
| Price incl. GST | ₹499 | ₹1,499 | ₹2,999 |
| Ex-GST price (÷ 1.18) | ₹422.88 | ₹1,270.34 | ₹2,541.53 |
| GST (if charged) | ₹76.12 | ₹228.66 | ₹457.47 |
| Processor fee, 2.36% (main case, derived) | ₹11.78/yr (₹0.98/mo) | ₹35.38/yr (₹2.95/mo) | ₹70.78/yr (₹5.90/mo) |
| Monthly net per shop, GST charged | ₹34.26 | ₹102.91 | ₹205.90 |
| Monthly net per shop, no GST | ₹40.60 | ₹121.97 | ₹244.02 |
| **GST-charged scenario:** break-even shops, Resend Free / Pro | 160 / 216 | **54 / 72** | 27 / 36 |
| **No-GST scenario:** break-even shops, Resend Free / Pro | 135 / 182 | **45 / 61** | 23 / 31 |
| Pilot of 20 shops, net monthly, GST charged, Resend Free | 20 × 34.26 − 5,475 = **−₹4,790** | n/a | n/a |
| Advantages | Lowest barrier to trial. Fast feedback. | Covers fixed costs at 54 shops on Free, or at 72 shops on Pro if E > 2.08. GST-charged scenario. With no GST: 45 on Free, or 61 on Pro if E > 2.46. | Fewer shops needed: 27 (Free) or 36 (Pro) in the GST-charged scenario; 23 or 31 with no GST. Room for added value. |
| Disadvantages | Needs 160 (Free) or 216 (Pro) shops in the GST-charged scenario, and 135 or 182 with no GST. Runs at a loss during the pilot. Hard to raise later. | Above the pilot price. Needs evidence of willingness to pay. | Smaller market. Added value is **not defined or built**; must not be charged until built. |

**Reading the Pro break-evens.** A Pro break-even applies only if Pro is needed at that shop count, that is, when shops exceed 150 ÷ E (§5A). At 72 shops that requires E > 2.08. At 61 shops it requires E > 2.46. At 216 shops it requires E > 0.694. Where those conditions are not met, the Free value applies. **PENDING OWNER APPROVAL (E).**

**Sensitivities for Option B, GST-charged scenario (Resend Free / Pro):**
- Stripe card, ≤₹2,000 rule (derived 2.00%): fee ₹29.98; net ₹103.36 per month; **53 / 72**
- Debit at 0.4%, no GST on the fee (assumes the rule applies to debit, which is Unverified): net ₹105.36 per month; **52 / 70**
- Debit at 0.4% with 18% GST on the fee (rule not applied): net ₹105.27 per month; **53 / 71**
- Without the ₹3,000 accounting cost: **25 / 43**

**Sensitivity for Option A:** at the derived 2.00%, net ₹34.41 per month; break-even **160 / 215** (GST charged).

**Note on Option C:** the "additional value" is undecided. The current product does not include premium features. Any premium tier needs a written feature list and build plan first. **DEFERRED (decision 12, §14.6).**

---

## 8. Revenue table, Option B, GST charged (monthly, ₹)

**Conditional on a working payment channel and processor, neither of which is confirmed (§9 item 9, §10 item 2).** Every row is a projection, not a forecast. The Free and Pro rows depend on E (§5A). **PENDING OWNER APPROVAL.**

| Shops (scenario) | Gross billing | GST collected (liability) | Revenue ex-GST | Processor fees | Fixed costs | Net |
|---|---|---|---|---|---|---|
| 10 (Free) | 1,249 | 191 | 1,059 | 29 | 5,475 | −4,446 |
| 100 (Free, E ≤ 1.5) | 12,492 | 1,906 | 10,586 | 295 | 5,475 | 4,816 |
| 100 (Pro, E > 1.5) | 12,492 | 1,906 | 10,586 | 295 | 7,375 | 2,916 |
| 1,000 (Pro; valid for 0.15 < E ≤ 2.5) | 1,24,917 | 19,055 | 1,05,862 | 2,948 | 7,375 | 95,539 |
| 10,000 (Pro insufficient; **PROVISIONAL, upper bound**) | 12,49,167 | 1,90,551 | 10,58,616 | 29,480 | 9,265 | 10,19,871 |

**Rounding.** Every figure is calculated from unrounded values, and each displayed figure is then rounded separately. A row can therefore fail to sum by ₹1:
- 10-shop GST: 1,249 − 1,059 = 190, but GST shows 191. Unrounded: 1,249.17 − 1,058.62 = 190.55, which rounds to 191.
- 10-shop net: the displayed components give 1,059 − 29 − 5,475 = −4,445. The unrounded net is −4,445.86, which displays as −4,446. The net does not foot by ₹1.
- 10,000-shop row: the displayed fixed cost of ₹9,265 is the ₹1,889.55 overage rounded up. Unrounded fixed cost is ₹9,264.55, giving net ₹10,19,870.94, which rounds to ₹10,19,871. The displayed components foot to ₹10,19,871. The earlier ₹10,19,870 came from using the rounded overage in the fixed cost.

Other notes:
- Per shop: gross ₹124.92, GST ₹19.06, revenue ₹105.86, fee ₹2.95, net ₹102.91.
- Net = revenue ex-GST − fees − fixed costs. GST is excluded from net because it is passed to the government when QRquick is registered.
- Fixed costs at 10,000 shops: Supabase ₹2,375 + Resend Pro ₹1,900 + domain ₹100 + accounting ₹3,000 + overage ₹1,890 = ₹9,265. Two items are not valid at this scale. The Resend element is insufficient (§5A) and the next tier is not priced, so the net is an **upper bound**. The overage assumes retention that is not deployed (§5C).
- Excludes: compute upgrades, database overage (§5C), support, founder time, trials, free periods and churn (§5B), cash timing of yearly prepayment, input tax credit (§4), and GitHub plan costs if a paid plan is needed (§4).

---

## 8A. One-time costs

| Item | Amount | Status |
|---|---|---|
| Google Play registration | $25 one-time = ₹2,375 at ₹95 (§3, Google Play row) | Verified amount. **Conditional** on publishing the Android app on Google Play. The distribution route is **PENDING OWNER APPROVAL**. Not added to any monthly table. |
| Stripe India setup | No setup fee (§3, Stripe pricing row) | Verified, undated. Applies only if an account exists or an invite is issued (§4). |
| Razorpay India setup | No setup or AMC fee (§3) | Secondary. Applies only if Indian signup is verified (§4). |
| Domain registration fee | Not priced. The ₹100/month figure is recurring and Assumed. | Unpriced. [OWNER TO PROVIDE] or research needed. |
| CA and lawyer fees | Not priced | [OWNER TO PROVIDE]. No source. |
| GST registration fee, if any | Not priced | Unverified. CA to confirm. |
| **Total one-time, priced** | ₹2,375 if Google Play is used; ₹0 otherwise, from priced items | **PROVISIONAL** |

---

## 9. Decision checklist: status per item

Each item is a proposal, not a decision. Decisions 13–20 (manual licence management and admin grants) are in §12A. They are PENDING OWNER APPROVAL, except where §12B.3 records a partial status.

1. **Licence unit.** Proposal: per shop. Options: per owner; per printer computer. **PENDING OWNER APPROVAL.**
2. **Term.** The 12-month paid term is approved as policy (M4). The paid path stays blocked (M5). Renewal: the owner pays again each year, with no automatic renewal (RECOMMENDED; owner confirmation pending). Options: yearly manual renewal; one-time (not recommended, since recurring costs need recurring income). Stacking of an early payment: C-4 (§12B.9). See §14, items 3 and 16.
3. **Price.** Proposal: Option B, ₹1,499 incl. GST, as the starting point. Options: A (₹499 pilot); C (₹2,999); other. **PENDING OWNER APPROVAL.**
4. **GST route.** No option chosen. Options: (a) stay unregistered and charge no GST, only if a CA confirms the exemption applies; (b) register and charge GST on an inclusive price. Input credit: whether a registered shop can claim input credit on the licence depends on QRquick issuing valid GST invoices. This claim is **unsourced** in this draft. Whether QRquick can claim input credit on its own costs, and the reverse-charge treatment of foreign services, are **not modelled**. **PENDING OWNER APPROVAL. CA review required.**
5. **Trial.** **DEFERRED out of Stage 7, not permanently removed** (§14.6 decision 5; C-10; owner instruction 4, 2026-10-31). Proposal, not approved: 30 days, no card, one per owner account. Options: none; 14 days. **Trial terms are not approved.** A trial delays first payment and is not modelled as lost revenue (§5B). Reopening needs a new owner decision on product and pricing terms.
6. **Refunds.** Proposal: full refund within 7 days. After that, only for duplicate charges or a QRquick outage. QRquick absorbs the processor fee: ₹35.38 per year on a ₹1,499 card payment at 2.36%, or ₹29.98 at the derived 2.00%. Each Stripe dispute costs ₹1,000 (§3, Stripe pricing row). That is Stripe's dispute fee. Pausing the licence during a dispute does not itself cost ₹1,000. **PENDING OWNER APPROVAL. Lawyer review required.**
7. **Expiry behaviour.** *Partly superseded 2026-10-29 (§12B): decision A (printing only, no order blocking), B (queued jobs held), C (no retries while inactive).* Original proposal: no new customer orders. In-flight paid orders finish. The print agent claims no new jobs. Owners keep read and CSV export. **Licence expiry does not itself delete data.** Order files follow the two retention rules in §5C. Unclaimed files expire one day after upload. Claimed files are removed 30 days after the order is completed, cancelled or rejected, subject to the purge exclusions. The purge code is in the repository. Its live deployment is **unverified** (§5C). Whether licence expiry should also change the deletion schedule is a separate decision. **PENDING OWNER APPROVAL.**
8. **Existing shops.** Proposal: free for 12 months from launch, with 30 days' written notice before the first charge. Effect as drafted: no licence revenue from these shops in year one. Decision 8 does not say whether the paid term is extended. The illustrations assume it is not, so that revenue is **forgone**, not deferred (§5B). Existing-shop count (N): [OWNER TO PROVIDE]. Illustration at N = 100 (arithmetic only): year-one net −₹65,700 on Free (E ≤ 1.5) or −₹88,500 on Pro (E > 1.5), against +₹57,796 or +₹34,996 if all pay from month one. Accrual break-even month 26 (Free) or 43 (Pro). Cash turns positive in month 13 under annual receipts. **PENDING OWNER APPROVAL.**
9. **Processor.** Options: Stripe, only if an active account or invite exists; Razorpay, only after its India signup is verified; defer. Neither is confirmed available. Every revenue projection in §8 assumes a working channel. **DEFERRED (§14.6 decision 9).** The gateway is not reopened, and nothing in this section is approved. Reopening needs a new owner decision. The collection-channel answer (item 4) is separate, and it is still needed before pricing.
10. **Stage 6 merge order.** The item is named precisely: branch `stage6-simulated-printer`, commit `885d28b` ("Stage 6: offline simulated printing for the local print agent"). It exists locally and as `origin/stage6-simulated-printer`. It is not an ancestor of `origin/main` (717717b). The base print agent, migration 0010 and the print-agent function are already on `origin/main` and are not part of this item. Proposal: the owner decides whether this branch is merged before Stage 7 is rebased. Not merged by me. **RECOMMENDED; owner decision pending** (§14, item 20).
11. **Advisers.** Proposal: engage an Indian CA and lawyer before any payment launch. Scope includes GST route, input credit, reverse charge, TDS, DPDP, refunds, and consumer protection. **PENDING OWNER APPROVAL.**
12. **Premium features.** **DEFERRED (§14.6 decision 12; §14.2 item 21).** Proposal: none for now. Options: name the features to build first. Reopening needs a feature list and build plan.

---

## 10. Blockers before payment integration

1. **Business identity:** entity type, PAN, and registered state are unknown. The identifiers that a processor and GST registration each require need CA confirmation. The draft has no source for the GST PAN requirement. **CA confirmation required.**
2. **Processor access:** Stripe is invite-only for new Indian businesses. Razorpay India signup is unverified. Processor work applies only if decision 9 (gateway) is reopened. It is DEFERRED (§14.6). Until then, no processor account, call or key is needed.
3. **Tax route:** registered or unregistered, plus the GST classification, input credit, reverse charge, and any TDS treatment. A CA must decide.
4. **Invoicing:** the repo has no GST invoice code or numbering (from earlier review; not re-checked in the correction pass). Needed if registered.
5. **Phase 2 dependencies:** the following owner decisions drive Phase 2 code where they apply. **Decision 4** (GST route) affects invoicing and tax fields. **Decision 7** (expiry) affects licence gates and deletion. **Decision 9** (processor) affects the integration design only if the gateway is reopened. It is DEFERRED (§14.6). **Decision 12** (premium features) affects any tier logic, and is DEFERRED (§14.6). **PENDING OWNER APPROVAL** for decisions 4 and 7.
6. **Legal terms, refunds, and DPDP obligations:** a lawyer must review them. DPDP applicability to customer files is not analysed (§4).
7. **Settlement account:** processors require a bank account in the entity's name. Unknown.
8. **Data location:** README lines 32–33 state `ap-south-1`. This is not checked against the live project. Availability of `ap-south-1` for new projects is unconfirmed.
9. **TDS on business payments:** unverified.
10. **Email provider:** whether Supabase Auth uses custom SMTP, and which provider, is not decided. The built-in limit is 2 emails per hour (§3). **PENDING OWNER APPROVAL.**
11. **Email-volume tier (E):** undecided. Results that depend on it are shown for both Free and Pro (§5A). **PENDING OWNER APPROVAL.**
12. **Super-admin identity:** the owner's Supabase Auth user UUID is required and has not been inferred. Bootstrap is a one-time owner-run SQL row (§12A.3). **PENDING OWNER APPROVAL.**
13. **Admin MFA and admin UI hosting:** the owner confirms MFA status and chooses hosting (§12A, decisions 14 and 15). **PENDING OWNER APPROVAL.**

---

## 11. Sources

Access date: 2026-10-29, unless stated. The correction pass accessed no external source.

- Stripe: "Stripe accounts are invite-only in India", https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india
- Stripe: "Taxes on Stripe fees for India-based businesses", https://support.stripe.com/questions/taxes-on-stripe-fees-for-india-based-businesses
- Stripe: "Pricing & Fees" (India), https://stripe.com/in/pricing
- Stripe: "Complying with RBI's Guidelines on Payment Aggregators and Payment Gateways and KYC Master Direction, 2016", https://stripe.com/en-fi/guides/rbi-guidelines-kyc-direction
- Stripe: "Local payment methods pricing", https://stripe.com/pricing/local-payment-methods (general page, not India-specific)
- Razorpay: "Razorpay payment gateway pricing explained", https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/ (secondary)
- Razorpay: "Payment Gateway KYC Onboarding Guide India (2026)", https://razorpay.com/blog/payment-gateway-kyc-onboarding-india/ (secondary)
- Razorpay: "Create a Razorpay Account" (US flow), https://razorpay.com/docs/payments/sign-up/
- CBIC: CGST Act s.22, https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter6/section22_v1.00.html
- CBIC: CGST Act s.24, https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter6/section24_v1.00.html
- CBIC: Notification No. 10/2017-Integrated Tax, 13 Oct 2017, https://cbic-gst.gov.in/hindi/pdf/integrated-tax/10_2017_IT.pdf
- CBIC: Notification No. 8/2017-Integrated Tax (Rate), 28 Jun 2017, https://cbic-gst.gov.in/hindi/pdf/integrated-tax-rate/Notification8-IGST.pdf
- GitHub Docs: "Creating a GitHub Pages site", https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site (re-fetched 2026-10-29 in an earlier revision)
- Supabase: pricing, https://supabase.com/pricing.md (undated)
- Supabase: "Rate limits", https://supabase.com/docs/guides/auth/rate-limits
- Supabase: "Available regions", https://supabase.com/docs/guides/platform/regions.md
- Resend: pricing, https://resend.com/pricing.md (undated)
- Google Play Console Help: "Get started with Play Console", https://support.google.com/googleplay/android-developer/answer/6112435?hl=en
- MediaNama: RBI additional factor authentication for e-mandates, https://www.medianama.com/2026/04/223-rbi-additional-factor-authentication-e-mandates/ (secondary, April 2026)
- Storyboard18: DPDP Rules staggered rollout, https://storyboard18.com/amp/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm (secondary, 14 Nov 2025)
- myBillBook: pricing plans, https://mybillbook.in/pricing-plans (undated; reference only, not used in pricing)
- GoFrugal: "Billing software prices in India", https://cdn-origin.gofrugal.com/blog/billing-software-cost/ (dated 6 May 2026)
- Petpooja: pricing, https://amd.petpooja.com/pricing (undated)
- Printo: document printing service, https://printo.in/p/document-printing-service-in-india (undated)
- Ekantipur: exchange rate, 22 Oct 2026, https://ekantipur.com/business/2026/10/22/en/october-22-2026-whats-the-exchange-rate.html (secondary, indirect)

**Repository evidence (read-only, checked 2026-10-30, worktree `stage7-payments` at 717717b).** `supabase/migrations/0001_stage1_foundation.sql`, `0003_customer_files.sql`, `0006_payments_and_statistics.sql`, `0008_payment_intents.sql`, `0009_cash_policy_and_payment_hardening.sql` and `0010_print_agents.sql`; `supabase/functions/cleanup-files/index.ts`, `owner-file-link/index.ts` and `print-agent/index.ts`; `.github/workflows/cleanup-files.yml` and `pages.yml`; `agent/src/worker.mjs`; `web/src/owner.js`, `web/src/auth.js` and `web/tests/owner-registration.test.js`; `docs/PRINTING_STATUS.md`; `README.md`; `CLAUDE.md`. Git was read with `rev-parse`, `branch --contains`, `ls-tree origin/main` and `stash list` only.

---

## 12. Status

- DRAFT ONLY. Not committed. Not approved.
- Corrected 2026-10-29 after the read-only audit and a targeted correction pass. Corrections are listed in §13.
- The correction pass accessed no external source.
- `CLAUDE.md` is untouched and still untracked.
- No application code, migrations, tests, Edge Functions, or configuration were changed.
- No payment-provider, Stripe, Razorpay, or Supabase calls. No credentials used.
- Phase 2 has not started. No implementation has begun.
- Admin-grant and manual licence design added (§12A). Design only: no code, migration, Edge Function, UI, or enforcement.
- Stage 7 decision record added 2026-10-29 (§12B). Documentation only. No implementation, setup, tests, migration, or commit.
- Final documentation pass 2026-10-30. Corrections are in §13. The decision register is §14, the roadmap is §15 and the exit checklist and verdict are §16.
- No commit, push, merge, deployment, migration, test, Docker, Supabase, production or live-setting action was taken. The protected main checkout, its three modified files and `stash@{0}` (b559dce) are untouched.
- **Ready for final owner review. Not approved.** §16 gives the verdict and its reasons.

---

## 12A. Manual licence management and admin-granted access (design, added 2026-10-29)

**Status: DESIGN ONLY. Nothing is implemented.** No migration, Edge Function, admin UI, shop-app screen, or licence enforcement exists or is approved. Decisions in this section are **PENDING OWNER APPROVAL** unless §12B.2 or §12B.3 records a status. No licence state below is approved policy, except as recorded in §12B. Next free migration number: 0011 (CLAUDE.md). **Update 2026-10-29:** the decisions in §12B supersede conflicting text in this section. Corrections are marked *Corrected 2026-10-29*. Decision status is in §12B.3.

### 12A.1 Scope

- The platform owner (super-admin) collects shop licence payments manually, outside the app, for now.
- The super-admin can grant any shop full platform access without payment: promotions, partnerships, or other business reasons. Trials are deferred (C-10).
- **Complimentary grant** (used in §12B): an `admin_grant` or `lifetime_grant` created without a payment. It has no `payment_id`, and no payment reversal changes it (H, §12B.2).
- This is private platform administration. It is not in the shopkeeper Android app and not in shop owner screens, except a read-only licence status view (decision 19).
- Licence records are separate from customer printing payments. No licence action changes `orders`, order payment status, or `set_order_payment`.

### 12A.2 Repository facts (worktree, checked 2026-10-29)

- No admin, role, platform-admin, or licence concept exists in migrations 0001–0010 or in `web/`, `mobile/`, `agent/`, or `supabase/functions/`. Searches for `is_admin`, `super_admin`, `platform_admin`, `app_metadata`, and `user_role` found no matches. This design is new.
- Shop access uses `shop_memberships (shop_id, user_id, role in owner|staff)` and `is_shop_owner()`. `shops` has no licence columns.
- Edge Functions read `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) from their environment. `owner-file-link` is documented with JWT verification on. Its source header says "Deployed with verify_jwt = true" (`supabase/functions/owner-file-link/index.ts` lines 4–5), and README setup step 7 deploys it without `--no-verify-jwt`. README lines 215–217 say it is deployed to the live project. **Verified against repository sources on 2026-10-30. The live setting and the live deployment were not checked, and no `supabase/config.toml` exists to record them.**
- Browser config holds only the publishable key (`web/config.js`).

### 12A.3 Super-admin identity and bootstrap

- **Proposed:** a server-side allow-list table `platform_admins (user_id uuid primary key references auth.users, created_at, disabled_at)`.
- Admin status is not granted by email address, client-editable `user_metadata`, a hardcoded client flag, or shop membership.
- Rows are added only by a one-time SQL statement that the owner runs in the Supabase dashboard, using the owner's Auth user UUID. No API or UI path adds admins. **No user UUID has been identified or assumed.** The owner must supply it.
- RLS on `platform_admins` is enabled with no policies for `anon` or `authenticated`. Admin checks use a `SECURITY DEFINER` function, `is_platform_admin()`, keyed on `auth.uid()`.
- Break-glass: a documented dashboard SQL statement sets `disabled_at` on an admin row. Not automated.
- **Needed from the owner:** the Auth user UUID, or confirmation that a dedicated admin user will be created; whether a second admin is wanted (decision 13); whether MFA is enabled on the Supabase account and the admin user (decision 14).

### 12A.4 Architecture

- **Database:** new licence tables with RLS deny-all for client roles. All writes go through `SECURITY DEFINER` RPCs. Each RPC first checks `is_platform_admin()`, and if decision 14 is yes, `auth.jwt()->>'aal' = 'aal2'`. Each RPC writes its audit row in the same transaction. `EXECUTE` is revoked from `public`, `anon`, and `authenticated` on internal helpers. Admin RPCs are granted to `authenticated` only, and each checks admin status and aal2 itself. *Corrected 2026-10-29 (R9, §12B.5).*
- **Why RPCs rather than an Edge Function with the service key:** the check, the write, and the audit happen in one transaction, and no service key is needed. This matches the existing RPC pattern (`set_order_payment`, `set_shop_features`). An Edge Function stays an option if a later stage needs one.
- **Admin UI:** a separate private app (hosting, decision 15). It holds the publishable key and the admin's session only. It calls admin RPCs and nothing else. The shop app has no link to it.
- **Shop read:** `shop_licence_status(p_shop_id)` returns only: active or inactive; the access end date and time in Asia/Kolkata, or no-expiry; and the next start date when relevant. *Decision D, §12B.* Owner only, through `is_shop_owner()`. Staff receive nothing. It never returns basis, reasons, actor IDs, payment references, notes, audit rows, or coverage IDs.
- **No service-role key** appears in `web/`, `mobile/`, the admin UI, or any committed file.

### 12A.5 Proposed data model

- **`platform_admins`:** as in §12A.3.
- **`licence_coverages`:** append-only records of access. Columns: `id`, `shop_id`, `kind` (`admin_grant` | `lifetime_grant` in Stage 7B; `paid_verified` and `trial` deferred, §12B.2 M5 and §12B.9 C-10), `starts_at`, `ends_at` (null only for `lifetime_grant`), `revoked_at` (null until revoked), `revoked_by`, `revoke_reason`, `payment_id` (deferred with `paid_verified`; null for all Stage 7B kinds), `reason` (required), `created_by`, `created_at`, `request_id` (unique). *Corrected 2026-10-29 (R7):* `shop_id` on this table and on `licence_payments` is enforced by a composite foreign key to the payment, so a coverage's shop must match its payment's shop. This key applies only when `licence_payments` is approved (M5). Stage 7B has no payment table to reference.
  - Checks: `ends_at > starts_at`; `lifetime_grant` has no `ends_at`; every other kind has one. *Corrected 2026-10-29 (fix 1):* the earlier check `revoked_at >= starts_at` is replaced by a trigger rule: `revoked_at >= created_at` and `revoked_at <= clock_timestamp()` at write time. A cancelled future period is therefore stored with `revoked_at` = now.
  - Trigger: the only permitted update sets `revoked_at`, `revoked_by`, and `revoke_reason`, once, from null. *Corrected 2026-10-29 (R6):* the trigger compares `to_jsonb(new)` and `to_jsonb(old)` with those three keys removed, rather than listing columns. Deletes and TRUNCATE are blocked. *UNVERIFIED until staging.*
- **`licence_payments`:** **deferred (M5, §12B.2).** Not built until pricing, minimum amount, tax treatment, and the payment-recording policy are approved. Proposed columns, for later review: `id`, `shop_id`, `amount_paise` (greater than 0), `currency` (INR only), `method` (`upi_direct` | `bank_transfer` | `cash` | `cheque` | `other`), `external_reference` (required except for `cash`), `received_on`, `status` (`recorded` | `verified` | `reversed`), `recorded_by`, `recorded_at`, `verified_by`, `verified_at`, `reversed_by`, `reversed_at`, `reversal_reason`, `note` (internal).
  - Unique index on (`method`, `external_reference`) where the reference is present, so one bank or UPI transaction cannot be verified twice.
  - Records are never deleted. Corrections are made by reversal.
  - No foreign key to `orders`, `order_items`, or any customer payment table.
- **`licence_audit_log`:** append-only (§12A.9).
- **`shop_licence_meta`:** one row per shop holding `state_version`. *Corrected 2026-10-29 (R1, R2):* the row is created lazily through `licence_lock_shop` (no trigger on `shops`). The version is incremented once per admin RPC request, inside the RPC, not by triggers. Admin RPCs take `expected_state_version` and reject stale requests.
- **`shop_licence_state(shop_id, at)`:** a deterministic SQL function that derives state from the coverage rows (§12A.6). Internal only: no client role is granted EXECUTE (R9, R10).
- **`licence_lock_shop(shop_id)`:** internal helper. Creates the `shop_licence_meta` row if it is missing and takes the shop lock. No client role is granted EXECUTE (R1, R9).
- **`licence_requests`:** proposed replay ledger for consequential admin mutations (R5, §12B.8). Stores the request ID, action, payload hash, and a non-personal result summary. Stores `actor_user_id` only where replay prevention needs it. Not deleted at 90 days (M8). Columns to be fixed in review.
- **`licence_denials`:** proposed denial log (M3, §12B.7). Stores the actor UUID, function name, time, request ID if supplied, and denial code. Detailed rows are capped at 20 per user per hour. Kept 90 days, subject to review (M8). Columns to be fixed in review.

### 12A.6 Access states and precedence

A coverage record `c` is effective at time `t` if `c.starts_at <= t`, `t < c.ends_at` (or it has no end, for lifetime), and `t < c.revoked_at` (if revoked). Intervals are half-open: at exactly `ends_at` or `revoked_at`, the coverage is no longer effective.

**Access** is granted if any coverage is effective at `t`. Overlaps are allowed and do not add time.

*Corrected 2026-10-29 (state-machine fixes 1–11, §12B.5).* The **state** is chosen in this order. The first match wins. Only ACTIVE grants access.

1. **ACTIVE:** an effective coverage contains `t`. **Basis** describes current access only: the highest-ranked effective kind (`lifetime_grant`, then `admin_grant`; `paid_verified` is deferred, M5). `access_until` is the end of the contiguous block that contains `t` (algorithm in §12B.5). Lifetime gives no expiry.
2. **SCHEDULED:** no effective coverage at `t`, and at least one valid future coverage. `next_start` is shown.
3. **REVOKED:** no effective coverage, and the latest-ending valid coverage ended by revocation. If two coverages end at the same instant and one was revoked, the state is REVOKED (proposal; owner confirmation pending, §12B.5 fix 5).
4. **EXPIRED:** no effective coverage, and the latest-ending valid coverage ended naturally.
5. **NONE:** no valid coverage ever. NONE is not ACTIVE, so it blocks printing once enforcement is on (decisions A to C).

A coverage cancelled before its start is stored with `revoked_at` set to the cancellation time, which is before `starts_at` (fix 1). Its effective interval is empty, so it is dropped from every state. The FREE TRIAL state is not part of Stage 7 because trials are deferred, not permanently removed (§9 item 5, C-10).

*Corrected 2026-10-29:* the state decides access, not only the display.

**Operations**, each recorded as a coverage change:

- **Grant** (1 month, 1 year, custom, or lifetime): the new coverage starts now, unless an explicitly confirmed backdate is given (decision 16). A custom grant needs a start and an end, with the end after the start. *Approved convention (M4):* custom dates are entered as Asia/Kolkata calendar dates. The start is inclusive at 00:00 IST, and the end is exclusive at 00:00 IST on the entered end date. A custom grant is an administrative grant, not a paid transaction, and has no `payment_id`.
- **Extend:** a new coverage starting at the current latest effective end (or now, if none). The old record's end is never edited.
- **Revoke:** sets `revoked_at` on one coverage record, effective now. Not retroactive. Other coverages are untouched. *Approved (M2):* refused when the coverage's natural end has already passed. Cancelling a future period is allowed (fix 1).
- **Replace:** in one transaction, revokes the named coverage (effective now) and creates the new coverage starting now. The revoke step follows the M2 rule: it is refused when the named coverage's natural end has already passed. The two audit rows share one `request_id`. A replace that names a `paid_verified` coverage is deferred with the paid path (M5).
- Revoking a `paid_verified` period is deferred with the paid path (M5). Payment reversal revokes its linked coverage (H, §12B). No revocation refunds anything.

### 12A.7 Manual payment verification

1. **Record:** *Deferred (M5).* When approved: the owner enters a payment received outside the app: shop, amount, method, reference, received date, and internal note. Status becomes `recorded`. Access does not change.
2. **Verify:** *Deferred (M5).* When approved: after checking external evidence (bank statement, UPI app record, or receipt), the owner verifies the payment. The RPC requires `confirm = true` and a matching `expected_state_version`. The term is fixed at 12 calendar months (M4), calculated from the exact server timestamp taken after the shop lock (J). The owner does not choose a term. Verification is refused while a lifetime grant is effective (F). It creates one `paid_verified` coverage linked to the payment and sets status `verified`.
3. **Reverse:** for a refund or a wrong entry. Requires a reason and `confirm = true`. Sets status `reversed`. *Approved (H, M2):* in the same transaction, a linked coverage that is current is cut at now, and a future one is cancelled. If the linked period has already ended, only the payment status changes. Admin grants are never changed by a reversal.

Rules:

- Verification does not compare the amount with an approved price, because no price is approved (§9 decision 3). The RPC stores the amount. The term is fixed at 12 calendar months (M4, J); the owner does not choose it. A price-mismatch check is added after decision 3 is approved. These rules apply only when the paid path is approved (M5).
- No step reads or writes `orders`, `order_items`, `set_order_payment`, or any order payment status. Stage tests assert this (§12A.11).
- **UPI MDR note.** If licence money arrives as a P2M UPI payment to a merchant account, the MDR framework applies. Per the MoF DFS FAQ in §12A.15: 0.4% on P2M UPI above ₹2,000, capped at ₹300 for ₹75,000 and above, and no MDR up to ₹2,000. Option B (₹1,499) is under the threshold. Option C (₹2,999) would carry about ₹12 MDR per payment (0.4% of ₹2,999) if the rail is P2M. Whether a gateway would pass that on is unverified. Direct P2P transfers are not covered by this MDR rule (the FAQ says P2P is free). Whether the owner's receiving account is categorised as P2M is unverified.

### 12A.8 Rules for all admin RPCs

- Every admin RPC: (a) runs `is_platform_admin()`; (b) requires a non-empty reason for grants, revocations, replacements, and reversals; (c) requires `confirm = true`; (d) requires `expected_state_version`; (e) requires a `request_id` (uuid). A repeated `request_id` with the same payload hash returns the original result without a second change. The same `request_id` with a different payload is a conflict (R5). (f) writes an audit row in the same transaction; (g) on denial, returns `{ok: false, code: 'forbidden'}` as a committed result, not a raised error, so the denial record and the rate-limit counter survive (R3). The same code is returned for every denial reason. Detailed denial records and their cap are in §12B.7 (M3).
- Shop owners and staff can call only `shop_licence_status`. They cannot call any write RPC.
- A platform admin cannot act as a shop user, and a shop owner cannot act as a platform admin. Platform admin status is not shop membership. If the owner also owns a shop, the owner can grant that shop, and the action is logged the same way.
- The typed shop-slug confirmation is a UI step. The server checks only `confirm = true`, the state version, and admin identity.
- *Added 2026-10-29 (R11):* an admin cannot disable their own admin row, and the last active admin cannot be disabled. Disabling through the RPC is audited. The break-glass SQL in §12A.3 remains the only other path.

### 12A.9 Audit log

- Table `licence_audit_log`: `id`, `created_at`, `actor_user_id`, `shop_id`, `action` (`grant`, `extend`, `revoke`, `replace`, `enforcement_change`; `payment_record`, `payment_verify`, and `payment_reverse` are deferred with M5). Denied attempts are not written here. They go to `licence_denials` (§12B.7, M8). `reason`, `coverage_id`, `payment_id`, `licence_start`, `licence_end`, `before` (jsonb), `after` (jsonb), `request_id`.
- Written in the same transaction as the change. Append-only: UPDATE, DELETE, and TRUNCATE are blocked by trigger and revoked from all roles.
- Readable only by platform admins, through an RPC. Not readable by shop owners.
- Contains personal data: actor UUID, shop identity, and dates. Retention period and DPDP handling are decision 20 and need lawyer review (§4). *Retention split (M8, §12B.8):* consequential audit rows and replay records are kept separately from temporary denial logs. Denial retention is 90 days, subject to security and legal review. No retention job exists or is approved.
- Every row carries actor, shop, action, reason, timestamp, and the relevant licence dates, as the owner brief requires.

### 12A.10 Expiry and revocation

- Expiry is computed at read time from `ends_at`. Access needs no cron job. A notice job is a later stage.
- *Corrected 2026-10-29 (decisions A, B, C; §12B.2):* once enforcement exists, it applies to printing only. For SCHEDULED, EXPIRED, REVOKED, and NONE shops: no new print jobs, no retries, queued jobs held until ACTIVE, jobs already printing finish, the agent receives no claims, and `mark_printing` refuses. Customer checkout and order placement are not blocked. Owners keep read and CSV export. Enforcement is not started and needs its own approval (7F).
- Revocation takes effect at `revoked_at`. It does not alter orders, customer files, or statistics. Its only effect on printing is through the 7F gate.
- Licence expiry or revocation does not itself delete any data. The file retention rules in §5C are separate. Their live deployment is unverified. *Proposal M1 (§12B.6), not approved for implementation:* a job held only because the licence is inactive fails after 7 days. Whether its file then becomes purgeable is an open conflict (§12B.9 C-1).
- Grace period: decision 18.

### 12A.11 Required tests (before any stage is approved to ship)

SQL tests run only on a staging copy (CLAUDE.md). Minimum matrix:

- No coverage gives NONE. Trial and paid-overlap cases are deferred with the trial kind (§9 item 5) and the paid path (M5).
- Admin 1 month, then time passes, gives EXPIRED. Revocation mid-period gives REVOKED. (The paid fallback case is deferred with M5.)
- Lifetime plus an expiring admin grant gives ACTIVE with basis lifetime. Revoking the lifetime grant while an admin grant is still effective gives ACTIVE with basis admin grant.
- Half-open boundaries: `t = ends_at` and `t = revoked_at` are not effective.
- An extension starts exactly at the old end, with no gap and no added overlap.
- Replace is atomic: a failure partway leaves the old coverage in place.
- Revoking an already revoked coverage is rejected.
- A backdated grant without explicit confirmation is rejected.
- A stale `expected_state_version` is rejected. The same `request_id` returns the original result.
- A non-admin caller of any write RPC is denied, and a denial record is written to `licence_denials` within the cap (§12B.7). Denials are not written to `licence_audit_log`. A shop owner cannot grant themselves access.
- An admin JWT without `aal2` is denied, if decision 14 is yes.
- Audit rows cannot be updated or deleted.
- Coverage rows accept only the one-time revocation update.
- Licence actions leave `orders` unchanged. A checksum of the `orders` payment columns (`payment_status`, `payment_channel`, `paid_at`, `refunded_at`, `refund_paise`, `payment_verified_by`, `payment_verified_at`) and the `order_events` row count is taken before and after. *Corrected 2026-10-29: `order_payments` does not exist in any migration.*
- `shop_licence_status` returns no reason, actor, or reference fields.
- The full test list, updated for the §12B decisions, is in §12B.11. No test has been run.

### 12A.12 Implementation stages (proposed; none started or approved)

- **7A. Owner inputs:** decisions 13–20; the Auth user UUID; MFA confirmation; admin UI hosting. No code.
- **7B. Schema:** migration (next free number, 0011 or later), tables, triggers, RLS deny-all, `is_platform_admin()`, `shop_licence_state()`, `licence_lock_shop()`, and `shop_licence_meta`. Proposed to exclude `paid_verified`, `trial`, and `licence_payments` (M5; C-5, RECOMMENDED, owner confirmation pending). Built to the corrections in §12B.5 and the tests in §12B.11. SQL tests on staging only, after separate approvals for local setup and for migration creation.
- **7C. Admin RPCs and the read RPC:** grant, extend, revoke (with the M2 rule), and replace; `shop_licence_status` (owner read RPC); denial logging (M3, M8). Manual payment record, verify, and reverse are deferred (M5). Matrix from §12A.11 and §12B.11 on staging.
- **7D. Admin UI:** a separate private app with login, shop search, grant, extend, revoke, and replace forms with confirmation, and an audit view. Payment entry is deferred (M5). Browser smoke test on staging.
- **7E. Shop read-only status:** owner web view with the minimal fields in decision D. Android is DEFERRED (item 13). No enforcement.
- **7F. Enforcement (printing only, decision A):** gates on approve, retry, claim, and `mark_printing` (§12B.4). Order intake is not gated. Separate approval gate. The refund and claim fix and the duplicate-print fix are separate gates (§12B.4). The 7-day hold rule (M1) is a separate gate (§12B.6).
- Gateway payments (Stripe, Razorpay) come later. They depend on §9 decision 9 and on the external access checks in §4.
- Each stage needs explicit approval before it starts. No commit, push, merge, or deploy without it.

### 12A.13 New owner decisions (all PENDING OWNER APPROVAL, except where §12B.3 records a status)

13. **Admin accounts (PENDING OWNER APPROVAL):** one owner account only (recommended), or additional super-admins? Each extra admin needs an owner-run SQL row.
14. **MFA (PENDING OWNER APPROVAL):** require `aal2` (TOTP) for all admin RPCs (recommended)? The owner confirms whether MFA is enabled on the Supabase account and the admin user.
15. **Admin UI hosting (PENDING OWNER APPROVAL):** (a) a separate private deployment, not linked from the shop app and not published with the public shop site (recommended), or (b) another host, to be named. The public GitHub Pages site is not recommended for the admin UI.
16. **Grant limits (PENDING OWNER APPROVAL):** which durations are allowed (1 month, 1 year, custom, lifetime); whether backdating is allowed at all (recommended: only with explicit confirmation); maximum custom length (none, or N years); whether lifetime is owner-only. Dates are entered and shown in Asia/Kolkata and stored in UTC. Proposed: "1 month" and "1 year" start at the time of grant.
17. **Revoking verified paid periods (PENDING OWNER APPROVAL):** allowed with a reason and confirmation, with no automatic refund (recommended), or only through replace?
18. **Expiry and grace (PENDING OWNER APPROVAL):** no grace period (proposed), or N days? Shop-visible wording for the NONE state.
19. **Shop-facing licence view (PENDING OWNER APPROVAL):** which fields show (state label, expiry date); whether an admin grant appears as "Admin grant", "Active", or another label; web only or also Android. Reasons, actor IDs, and payment references are never shown to shops.
20. **Manual payments and audit (PENDING OWNER APPROVAL):** accepted methods (proposed: UPI direct, bank transfer, cash, cheque, other); references required except for cash; GST invoice handling for manual receipts (CA); audit log retention period; logging of denied attempts (proposed: yes); DPDP treatment of audit personal data (lawyer).

### 12A.14 Financial and model effects (flagged, not applied to the base case)

- **Granted and trial shops** produce no licence revenue but incur per-shop costs: email (M = shops × 20 × E, §5A), storage (§5C), and database. §8 counts paying shops, while §5A and §5C count total active shops. A future model must separate paying shops from granted shops. Not changed here.
- **Manual collection** avoids the gateway fee. Scenario only (Option B, GST charged, no processor fee): net ₹105.86 per shop per month, break-even 52 shops (Free) or 70 (Pro). This differs from the §7 base case, which uses a 2.36% gateway fee. It depends on decision 20 and on GST invoicing (CA).
- **UPI MDR on Option C** via a P2M rail: about ₹1.00 per shop per month extra. Option C break-even stays at 27 (Free) and 36 (Pro) after recomputation. Relevant only if the rail is P2M.
- **§5B grandfathering illustrations** include a gateway processor fee (₹35.38 per shop per year), so they assume a working channel. Manual collection would change them.
- **Turnover caps (1,574 and 787)** assume paying licences only. Free grants are assumed to give no consideration. Whether that is correct for GST, including the treatment of supplies without consideration, is for the CA. No conclusion is drawn here.

### 12A.15 Sources for §12A (accessed 2026-10-29)

- Ministry of Finance, Department of Financial Services, FAQ "Merchant Discount Rate (MDR) on Select UPI (P2M) Transactions", cover date 15 Sep 2026: https://financialservices.gov.in/sites/default/files/2026-09/FAQs---Merchant-Discount-Rate--MDR--on-Select-UPI--P2M--Transactions_0.pdf. Read through a WebFetch summary, so quotations are short and some answers are paraphrased. No gazette or notification number was found. The owner or CA should read the original PDF before relying on any figure from it.
- Razorpay pricing page, https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/ (accessed 2026-10-29, WebFetch summary). It confirms that the 2% UPI platform fee plus GST is separate from MDR. Its statement that zero MDR is an "RBI mandate" is contradicted by the MoF FAQ above and is not relied on.
- Newsbytes, 17 Sep 2026, https://www.newsbytesapp.com/news/business/india-sets-04-mdr-on-p2m-upi-from-october-15/tldr (secondary source). Consistent on 0.4% above ₹2,000 from 15 October. It says RuPay debit transactions are exempt, which the FAQ summary did not confirm. **Unresolved.**

### 12A.16 Open item for approval: §3 Razorpay row

The §3 row still says "the government sets UPI MDR at 0%". The MoF FAQ shows that this is outdated for P2M UPI above ₹2,000. **This section does not edit §3.** Proposed replacement, pending your approval:

> UPI MDR from 15 Oct 2026 is 0.4% on P2M UPI transactions above ₹2,000 (cap ₹300), per the MoF DFS FAQ dated 15 Sep 2026 (accessed 2026-10-29). Razorpay's 2% platform fee plus GST is a separate gateway charge (Razorpay pricing page, accessed 2026-10-29). Whether Razorpay passes MDR on to QRquick is unverified.

## 12B. Stage 7 decision record (2026-10-29)

**Scope.** This section records the owner's answers to decisions A–L and M1–M8, the state-machine corrections, and the R1–R19 findings. It is documentation only. Approval here sets the planning direction. It does **not** authorise local setup, Docker, the Supabase CLI, `supabase init`, containers, database resets, tests, migration 0011, implementation of 7B–7F, any commit, push, merge, deployment, live configuration change, production inspection, production data change, or APK rebuild. The email sign-in and sign-up decisions in §2 are unchanged. The protected main checkout, its three modified files, and `stash@{0}` (b559dce) are untouched.

### 12B.1 Status key

- **APPROVED:** owner direction for design and planning. Implementation still needs its own gate.
- **APPROVED, CONDITIONAL:** approved subject to the stated condition. Its register status in §14.1 is not DECIDED while the condition is open.
- **BLOCKED:** cannot proceed until the named condition is met.
- **REVIEW REQUIRED:** a separate diff or legal review is needed before implementation.
- **PROPOSAL:** recorded for review. Not approved for implementation.
- **UNVERIFIED:** needs a staging or primary-source check. No conclusion is drawn.

### 12B.2 Decisions A–L and M1–M8

| ID | Decision (as recorded) | Status | Consequence and condition |
|---|---|---|---|
| A | Printing-only enforcement. Customer checkout and order placement are not blocked by licence status. | APPROVED | Replaces the order-insert gate in the earlier chat plan and the original 7F wording. Checkout is unchanged. Both `place_order` signatures stay granted to `anon` and `authenticated` in the migration chain (§2; §12B.11). |
| B | Queued jobs held until the shop is ACTIVE. Jobs already printing may finish. | APPROVED, CONDITIONAL | Held files are kept by the purge rule (0010 lines 795–798) until M1 is implemented (C-1, C-3). |
| C | Retries blocked while inactive. No requeue or reuse of old job rows. | APPROVED | Each retry is a new row, created only while ACTIVE. Supersedes the earlier chat plan's pre-expiry retry wording. |
| D | Minimal owner status: active or inactive; access end or no-expiry; next start when relevant. No payment references, admin notes, audit history, coverage IDs, or revocation reasons. | APPROVED | Owner only. Staff and Android visibility are open (decision 19). |
| E | Enabling enforcement: preview first, blocked-shop count, digest, typed confirmation, reason, audited server-side change. Not enabled now. | APPROVED for design. ENABLING BLOCKED | Enabling needs a reviewed transition policy for existing shops (owner input: N and the free-period policy, §5B, decision 8). |
| F | Refuse paid coverage while a lifetime grant is active. | APPROVED. BLOCKED with the paid path (M5) | Verification is refused while a lifetime grant is effective. Payments recorded but not verified need a refund policy (outside the software; lawyer and CA, §9 item 6). |
| G | Show SCHEDULED when no coverage is active but a valid future coverage exists. | APPROVED | Revoking current coverage does not cancel future coverage (C-8). |
| H | A payment reversal atomically revokes its linked coverage. Admin and complimentary grants are never revoked by a payment reversal. | APPROVED. BLOCKED with the paid path (M5) | Admin kinds have `payment_id` null (§12A.5), so the link is structural. |
| I | Pricing and minimum payment. | **BLOCKED** | No price, minimum amount, tax treatment, or published pricing. The paid path stays blocked. The §7 options are not approved. |
| J | Coverage anchor: exact server verification timestamp taken after the shop lock; Asia/Kolkata calendar arithmetic. | APPROVED. BLOCKED with the paid path (M5) | See C-4 on stacking. |
| K | Investigate and test two printing fixes. Stop if a fix is broader. | Duplicate-print fix: investigation and targeted local tests APPROVED only after the proposed code diff is reviewed (owner instruction 5, 2026-10-31). Staging tests need separate explicit approval. Implementation needs its own approval after diff review. Refund and claim fix: **REVIEW REQUIRED (stopped)** | §12B.4. Nothing implemented. |
| L | Read-only inspection of the local Auth schema, only after separate local setup approval. Synthetic fixture only after its columns are verified and the approach is reviewed. | **BLOCKED** until local setup is approved separately | Nothing inspected. No user created. |
| M1 | Jobs held only because the licence is inactive fail after a proposed 7-day limit, with a stated reason. Their files then become eligible under the existing purge rules. Files required by actively printing jobs are never deleted. The effect on paid orders is documented. Tests before implementation. | PROPOSAL. Not approved for implementation. Review and tests required first | §12B.6. Conflicts C-1 and C-2 must be resolved first. |
| M2 | Refuse manual revocation of coverage whose natural end has already passed. Payment reversal stays a separate, audited operation. | APPROVED | Resolves state-machine fix 2 (§12B.5). |
| M3 | Detailed denial records capped at 20 per user per hour, with rate limiting and aggregate counts for excess attempts. Limitations documented. | APPROVED as design. NOT IMPLEMENTED | §12B.7. |
| M4 | Paid term: 12 calendar months, Asia/Kolkata arithmetic, from the exact server timestamp after the shop lock. Custom admin dates use the same timezone convention with explicit start and end semantics. A custom grant is not a paid transaction. | Custom-grant convention APPROVED. Paid term APPROVED, BLOCKED with the paid path (M5) | Custom grant: start inclusive at 00:00 IST, end exclusive at 00:00 IST. Stacking question: C-4. |
| M5 | The paid-coverage implementation is left out of 7C and 7D until pricing, minimum amount, tax treatment, and the payment-recording policy are reviewed and approved. No invented price. No unconfigured payment path grants access. Complimentary admin grants stay independently available. | APPROVED (blocking condition) | `paid_verified` and `licence_payments` are excluded from 7B (C-5). |
| M6 | Lifetime may be granted over existing paid coverage. Paid records are preserved and never refunded, deleted, rewritten, or automatically revoked. Lifetime takes precedence while active. If lifetime is later revoked, a still-valid paid period may give access. | APPROVED as policy. State transitions to be tested | Applies only when paid records exist, so it becomes testable with the paid path (M5). Compatible with F (C-7). |
| M7 | Stop-and-review for the refund and claim fix. The duplicate-print fix needs targeted tests and must not change unrelated printing behaviour. | APPROVED (review requirement confirmed) | No fix implemented. Diff review pending. |
| M8 | Separate retention: detailed denial records 90 days, subject to review; successful replay records kept until an independently safe replay-prevention mechanism exists; audit records kept separate from denial logs; personal data minimised. No retention job. No deletion. | APPROVED as policy proposal. LEGAL REVIEW REQUIRED | §12B.8. |

### 12B.3 Owner decisions 13–20 (§12A.13): status after 2026-10-29

| Decision | Status |
|---|---|
| 13 Admin accounts | PENDING OWNER APPROVAL. Recommended default: one owner account. Not approved. |
| 14 MFA (`aal2`) | PENDING. The owner must confirm MFA status. Admin RPCs cannot run without aal2 if it is required. |
| 15 Admin UI hosting | PENDING. |
| 16 Grant limits | PARTLY APPROVED: custom-date convention (M4). PENDING: backdating, maximum custom length, lifetime owner-only. |
| 17 Revoking paid periods | PARTLY APPROVED through H and M2 (reversal; refusal after end). Standalone revocation of an active paid period is PENDING and deferred with M5. |
| 18 Expiry and grace | PARTLY: B and C block printing in every non-ACTIVE state, so no grace is implied. PENDING: any grace days, and the wording for NONE. |
| 19 Shop-facing view | PARTLY APPROVED: fields as in D. PENDING: Android, and whether an admin grant may show a label. D shows active or inactive only. |
| 20 Manual payments and audit | PARTLY APPROVED: denial logging (M3) and retention split (M8). PENDING: accepted methods, reference rules, GST invoice handling (CA), DPDP treatment of audit data (lawyer). |

### 12B.4 Printing safety fixes (K, M7): findings and state rules

**Duplicate-print fix (investigated, not implemented).**
- Current code: `retry_print_job` (0010 lines 502–549; the `return` is at line 547) locks the source job (line 515) and checks its status (`failed` or `needs_check`, line 522). It then requires the order to be `printing` and `paid`, read without a row lock (lines 530–533). It refuses only when a sibling job for the same `order_item_id` is `queued`, `claimed`, or `printing` (lines 534–539). It does not check for a `sent` sibling, and it does not require the source to be the highest attempt.
- Gap: attempt 1 fails and attempt 2 is sent. A retry of attempt 1 still passes and creates attempt 3, which prints a second copy. *Confirmed by reading the code. Not reproduced on any database.*
- Proposed rule: refuse if any job for the item has status `sent`. Refuse unless the source attempt is the highest attempt for the item. Keep the `needs_check` confirmation unchanged.
- Changes: the body of `retry_print_job` only. No schema change. No change to claim, finish, or approve.
- Status (owner instruction 5, 2026-10-31): investigation and targeted local tests are approved only after the proposed code diff is reviewed. No diff has been presented yet. Staging tests need separate explicit approval. Implementation needs a separate approval after diff review (M7). The code reading above is recorded findings, not a fix.

**Refund and claim fix (stopped; REVIEW REQUIRED).**
- Refund path: `set_order_payment`, action `refund` (0006 lines 213–219), sets `payment_status = 'refunded'`, `refunded_at`, and `refund_paise`. It does not change the order status or any `print_jobs` row.
- Claim path: `agent_claim_next_job` (0010 lines 646–656) selects queued jobs for the shop whose file is not deleted. It checks neither payment status nor order status.
- Order transitions: 0001 lines 153–155 allow `printing` → `ready` or `completed`. The 0008 guard (lines 39–43) requires `payment_status = 'paid'` when the order status changes into `printing`, `ready` or `completed`. It does not re-check payment when a paid order is later refunded, because a refund changes only the payment fields. The only order update in 0010 is at line 493, in `approve_order_for_print`. No migration found changes a `print_jobs` row when an order's status or payment changes, and 0006 does not touch `print_jobs`. So an order that is `printing`, `ready` or `completed` can still have queued jobs.
- Schema constraint: the `print_jobs` status check (0010 line 59) allows only `queued`, `claimed`, `printing`, `sent`, `failed`, and `needs_check`. No terminal state exists for jobs of ineligible orders.
- Options for review (none implemented):
  - **R-a:** in the refund path and in the ready or completed transition, mark the order's queued jobs `failed` with a specific reason code. Uses existing states. Changes the bodies of `set_order_payment` (0006) and the order status update path. Touches the customer payment ledger.
  - **R-b:** add a `cancelled` job status and cancel jobs in the same paths. Schema change, plus the same body changes.
  - **R-c:** claim-side eligibility only (order `printing` and `paid`). Ineligible jobs stay `queued`, so they pin their files indefinitely (0010 lines 795–798). **Not acceptable without a retention decision (C-1).**
- Recommendation for review: R-a, with the state transitions shown in the diff and a test that a refunded order's files are not claimed. The exact diff must be presented before any implementation.
- State-transition effects to review under R-a: queued → failed (new reason code) on refund or on the ready or completed transition. Claimed and printing jobs are unchanged in this option. To be confirmed in the diff review.

### 12B.5 State-machine corrections and R1–R19 findings

**State-machine corrections (from the read-only audit in the planning conversation; that audit report is not reproduced in this file).**

| # | Correction | Status |
|---|---|---|
| 1 | Cancel a future period by setting `revoked_at` to now, before its start. Replaces the zero-length representation. The trigger enforces the bounds. | Design resolved; not tested. UNVERIFIED on staging. |
| 2 | Refuse revocation after the natural end. | APPROVED (M2). |
| 3 | Payment reversal revokes the linked coverage. The anchor excludes coverages whose payment is reversed. | APPROVED (H). Blocked with the paid path (M5). |
| 4 | Remove the wording "future-dated revocation". | Resolved (wording). |
| 5 | Tie-break: if two coverages end at the same instant and one was revoked, the state is REVOKED. | PROPOSAL. Owner confirmation pending. |
| 6 | Hide `next_start` when there is no expiry. | Resolved under D and F. |
| 7 | Basis describes current access only. Owners see no basis. | APPROVED (D). |
| 8 | `access_until` algorithm: start from the end of the covering coverage (lifetime gives no expiry). Repeatedly extend while a valid coverage starts at or before the current end and ends after it. The result can include intervals that start after `t`. | Design resolved; not tested. UNVERIFIED on staging. |
| 9 | Display the exclusive end, e.g. "until 1 Jan 2028, 00:00 IST", not "until 31 Dec". | Resolved under D. Wording to confirm. |
| 10 | Anchor and term arithmetic in Asia/Kolkata: `((anchor at time zone 'Asia/Kolkata') + interval '12 months') at time zone 'Asia/Kolkata'`. Replaces the garbled expression in the earlier chat plan. | APPROVED (J, M4). Blocked with the paid path (M5). |
| 11 | The literal and truncated anchor forms agree only if `verified_at` is read after the shop lock and revocations are no later than it. | Test precondition resolved; not run. |

**R1–R19 (from the 7B review in the planning conversation; that review is not reproduced in this file).** Nothing here has been run. Items marked UNVERIFIED need staging, after separate approvals.

| ID | Finding and resolution | Status |
|---|---|---|
| R1 | Meta row creation: no trigger on `shops`. Created lazily by `licence_lock_shop`. | Design resolved; not tested. Verify the upsert on staging. |
| R2 | Versioning: one increment per RPC request, inside the RPC. Triggers only enforce immutability. | Design resolved; not tested. The versioning test in §12B.11 reflects this. |
| R3 | Denials: an admin denial returns a committed result. Print refusals may raise. The rate-limit counter follows the same rule. | Design resolved; not tested. |
| R4 | Atomic success: one function, with no exception after the audit insert. | Design resolved; not tested. Enforce by test. |
| R5 | Idempotency: same `request_id` and payload hash returns the stored result. Different payload is a conflict. Ledger retention per M8. | Design resolved; not tested. Retention: §12B.8. |
| R6 | Revocation immutability: compare `to_jsonb` with the three revocation keys removed. | Design resolved; not tested. UNVERIFIED on staging. |
| R7 | `shop_licence_id` columns: the earlier chat plan omitted `shop_id` on coverages and payments. This file already includes it. Composite foreign key added. | Design corrected. The key applies only if `licence_payments` is approved (M5). |
| R8 | Payment immutability: shop, amount, currency, method, reference, and `received_on` fixed at insert. | Design resolved; not tested. Paid path blocked. |
| R9 | Privileges: internal helpers revoked from `public`, `anon`, and `authenticated`. Admin RPCs granted to `authenticated` only. REVOKE from `PUBLIC` made explicit, because PostgREST exposes `public` functions. | Design resolved; not tested. UNVERIFIED: Supabase default grants (R17). |
| R10 | Owner status through a separate RPC. `shop_licence_state` is internal. | Design resolved; not tested. Follows D. |
| R11 | No self-disable. The last active admin cannot be disabled. | Design resolved; not tested. Added to §12A.8. |
| R12 | Functions that write are not `STABLE`. Read functions stay pure. | Design resolved; not tested. |
| R13 | No price rule exists. | **BLOCKED** by I. |
| R14 | Test fixtures use fixed past dates. `p_at` is used only for reads, because mutations are stamped with the wall clock. | Test design resolved; not run. |
| R15 | Synthetic `auth.users` fixture: the required columns for the pinned local Auth schema are unknown. | **BLOCKED** by L. |
| R16 | Simulating `auth.uid()` and `aal` through request claims. | UNVERIFIED (staging). |
| R17 | Owner role and Supabase default grants on new `public` tables. | UNVERIFIED (staging). |
| R18 | Lock order, per RPC, as the existing code does it (checked 2026-10-30). `approve_order_for_print` locks the order row (0010 line 451). `retry_print_job` locks the source job row (line 515), then reads the order and the sibling jobs without a lock (lines 530–539). `consume_print_pairing` locks the pairing row (line 576). `agent_claim_next_job` selects one queued job with `for update skip locked` (line 655). Its recovery step, `recover_expired_print_jobs`, updates rows without an explicit lock. `agent_mark_printing` locks the job row (line 699). `agent_finish_job` locks the job row (line 736). `set_order_payment` takes no row lock (0006). No advisory lock exists in migrations 0001 to 0010. **Designed, not built:** print paths take the order row, then the shop meta row (share). Admin paths take an advisory lock, then the meta row, then the payment. These are design statements only. The two-session test is **outstanding** (staging, separate approval). | Existing code: verified by reading only. Designed order: UNVERIFIED. Two-session test: outstanding. |
| R19 | Shop deletion. Licence tables use `on delete restrict`, matching `orders.shop_id` (0001 line 53). | Design resolved; not tested. |

### 12B.6 Held-job rule M1 (proposal, not approved for implementation)

- **Scope:** jobs in `queued` status, and `claimed` jobs requeued by recovery, that are held only because the licence is not ACTIVE. Jobs in `printing`, `needs_check`, `sent`, or `failed` are out of scope.
- **Hold start (C-2):** not decided. Option (a) is the job's `created_at`, which can fail a job a day into a lapse. Option (b) is the time the shop left ACTIVE, which needs a stored marker or a derived value. Neither is chosen.
- **Limit:** 7 days (M1), measured from the chosen hold start.
- **Effect:** status `failed`, `error_code` such as `licence_inactive_timeout`, and a clear `error_message`. Retry is allowed after the shop returns to ACTIVE (rule C).
- **Mechanism (C-2, corrected 2026-10-30):** a daily scheduler exists for the file purge: the GitHub Actions workflow `cleanup-files.yml` (cron `30 20 * * *` UTC, which is 02:00 IST). Its deployment and secrets are **UNVERIFIED** (§5C). **No scheduler exists for held-job timeouts.** The only job-recovery step, `recover_expired_print_jobs`, runs inside `agent_claim_next_job` (0010 line 644). It handles leases, not licence holds. A timeout for held queued jobs would be new code, run either lazily at agent claim or by a new scheduled job. A new scheduled job needs separate approval. None is approved.
- **File effect (C-1):** M1 says the file "becomes eligible for deletion under the existing purge safeguards". **For paid orders still in `printing`, that is not true under the current code.** `expired_customer_file_paths` (0010 lines 785–810) purges a claimed file only when its order is `completed`, `cancelled` or `rejected`, and that status is at least 30 days old (lines 799–807). It also requires that no queued, claimed, printing or needs-check job uses the file (lines 795–798). An unclaimed file is purged after its one-day expiry (0003 line 41). A failed job does not change the order. 0001 does not allow `printing` → `cancelled`. So the file would stay until the order reaches a terminal status that the current workflow may never reach for that order. A decision is needed before implementation.
- **Printing jobs:** M1 never deletes their files. The purge excludes `printing` and `needs_check` jobs (0010 line 797).
- **Effect on paid customer orders:** the customer receives no printed output. The order stays `printing` with `payment_status = 'paid'`, because no transition to a terminal status exists. The owner may refund through `set_order_payment`, which does not touch the job. Consumer-refund obligations have not been researched (§4). **Lawyer review required before implementation.**
- **Tests before implementation:** listed in §12B.11.
- **Status:** PROPOSAL for implementation review and tests. No schema or code change now.

### 12B.7 Denial logging design (M3)

- **Detailed records:** the first 20 denied calls per authenticated user per hour are written to a `licence_denials` table (proposed). Fields: actor UUID, function name, time, `request_id` if supplied, and the denial code.
- **Excess attempts:** counted in an hourly aggregate per user, using the rate-limit mechanism (`consume_rate_limit`, key `licence:denied:<uid>`). The aggregate records only a count.
- **Response:** the same `forbidden` code for every denial, so a caller cannot tell whether the cap was reached.
- **Commit rule:** the counter and the detailed row are committed, as R3 requires.
- **Limitations (documented, not solved):**
  - Anonymous calls are rejected at the grant level before the function runs (§12A.4 grants to `authenticated` only). Those attempts are not logged.
  - A caller with many accounts gets a separate cap for each account.
  - Above the cap, the details of a burst are lost. Only counts remain (C-12).
  - `purge_old_rate_limits` exists (0010). `cleanup-files` calls it (`index.ts` line 81), and that daily workflow's live deployment is **UNVERIFIED** (§5C).
  - `consume_rate_limit` is granted to `service_role` only (0010 line 868). Calling it from a licence function needs a staging check before use.
- **Status:** APPROVED as design. NOT IMPLEMENTED.

### 12B.8 Retention (M8)

| Record | Proposed retention | Status |
|---|---|---|
| Detailed denial records (`licence_denials`) | 90 days | Subject to security and legal review. No deletion job. |
| Denial aggregate counters | Expire with their rate-limit window. `purge_old_rate_limits` runs from `cleanup-files` (`index.ts` line 81), which the daily workflow calls. Live deployment UNVERIFIED. | UNVERIFIED |
| Replay records (`licence_requests`) for consequential mutations | Kept until an independently safe replay-prevention mechanism exists. Store the request ID, action, payload hash, and a non-personal result summary. Not deleted at 90 days. | Policy proposal. Period to be set in review. |
| Consequential audit log (`licence_audit_log`) | Kept as needed for administrative and financial records. Personal data minimised. | Lawyer review (decision 20, DPDP). |
| Customer files and print jobs | Unclaimed: one day after upload (0003 line 41). Claimed: 30 days after the order is completed, cancelled or rejected, with purge exclusions (0010 lines 785–810). **Code in repo; live deployment UNVERIFIED** (§5C). M1 would add a licence-driven failure path. | Separate decision (C-1). |

`licence_requests` stores `actor_user_id`, which is personal data. Store the user ID only where replay prevention needs it.

### 12B.9 Contradictions, open conditions, and security weaknesses

**Contradictions and open conditions**
- **C-1 (M1 vs the purge rule).** M1 assumes a failed job makes the file eligible. The purge rule does not, for orders that remain `printing` (§12B.6). Options: a new terminal order status, which changes the 0001 transitions and is out of scope so far; or a licence-specific file-release rule. **Not decided.**
- **C-2 (M1 mechanics).** The hold-start clock is unresolved. A purge scheduler exists in the repository (`cleanup-files.yml`; deployment UNVERIFIED). No scheduler exists for held-job timeouts (§12B.6). The owner must choose the hold start (option a or b), and any scheduled job needs separate approval. Deferred with item 2 (owner instruction 1, 2026-10-31). It reopens under §14.2 item 2.
- **C-3 (B vs retention).** Until M1 is implemented, held jobs keep customer files indefinitely. Two separate questions. **Decision:** the owner accepts this as an interim, or holds enforcement back. **Requirement:** holding enforcement back makes M1 a prerequisite of enabling, with item 2 and, where paid orders are affected, item 10. The 7F build needs only C-3 decided (§15.3). Stage 7 closure needs C-3 decided, not enforcement enabled (§16.1(e)).
- **C-4 (M4 vs J stacking).** M4 says the term is calculated from "the exact server-side verification timestamp". J and the anchor rule start a new paid term at the end of an existing paid term when that end is later. The two differ while a paid term is still running. Recommended: keep stacking, so there is no overlap. **Owner confirmation needed.** Applies only when the paid path is approved.
- **C-5 (M5 and 7B).** Whether `paid_verified` and `licence_payments` are excluded from migration 0011. Proposed: excluded. **Owner confirmation needed.**
- **C-6 (decisions 13–15).** Admin accounts, MFA, and hosting are unanswered. 7A cannot finish without the Auth user UUID and the MFA answer. Blocks 7A, the bootstrap row and 7C–7D. It is not a 7B schema prerequisite (§15.3).
- **C-7 (F and M6 with H).** Consistent: F refuses a new paid period during a lifetime grant, and M6 allows a lifetime over existing paid coverage. **Confirm** that revoking a lifetime grant while a paid period is still valid leaves access through the paid period, as M6 states.
- **C-8 (G with revocation).** G shows SCHEDULED after revocation of current coverage when a future coverage exists. **Confirm** that revocation does not cancel future coverage.
- **C-9 (§9 item 7 and §12A.10 wording).** "In-flight paid orders finish" and "no new customer orders" are superseded by A and B. Those passages are annotated. Other original text in §9 item 7 remains.
- **C-10 (trials).** §9 item 5 and §12A.5–12A.6 mention trials. Trials are deferred out of Stage 7 under the 2026-10-29 direction (the earlier chat plan is not reproduced in this file). **Owner confirmed 2026-10-31:** trials are deferred out of Stage 7, not permanently removed. Trial terms are not approved. Reopening needs a new owner decision on product and pricing terms.
- **C-11 (refunds).** The refund policy (§9 item 6) is open. M1's effect on paid orders depends on it. Lawyer review required.
- **C-12 (denial design).** M3 accepts counts-only records above the cap. **Owner must accept** that detail is lost above the cap.
- **C-13 (blocked item I).** The paid path and pricing are blocked, so Stage 7 cannot sell paid licences after 7C and 7D. This is expected under M5. No paid licence can be offered until I is approved.
- **C-14 (E).** Enabling enforcement needs the existing-shop policy. **BLOCKED.**
- **C-15 (email and authentication).** The email sign-in and sign-up decisions in §2 are not changed. Admin login relies on Supabase Auth, and therefore on the MFA answer (C-6).

**Security weaknesses (each needs a staging test before implementation)**
- **S-1.** A missed REVOKE from `PUBLIC` would leave a function callable by `anon`. The checks would still deny the call, but it would reveal that the function exists (R9). **UNVERIFIED** against Supabase default grants (R17).
- **S-2.** Supabase may grant default table privileges to `anon` and `authenticated` on new `public` tables. RLS with no policies blocks reads only while RLS stays enabled. **UNVERIFIED** (R17).
- **S-3.** Admin RPCs depend on the `aal` claim. How hosted and local Supabase expose that claim, and how the check reads it, is **UNVERIFIED** (R16).
- **S-4.** A signed file link issued at claim time stays valid for 180 seconds (`supabase/functions/print-agent/index.ts` line 23). A modified agent could print with a link issued before a lapse, without calling `mark_printing`. The residual window is at most 3 minutes. Accept or document before 7F.
- **S-5.** Static code, verified 2026-10-30 in the committed worktree version of `agent/src/worker.mjs` (lines 258–264). When `markPrinting` throws, the agent clears its journal and returns. It does not print and does not report a failure. **Runtime behaviour is still UNVERIFIED.** A local test is required before 7F. No test was run.
- **S-6.** The denial and replay ledgers hold user IDs. Retention is set in §12B.8.
- **S-7.** The duplicate-print gap (§12B.4) exists in the current printing code. It is a printing defect, not a licence defect.
- **S-8.** The refund-without-claim-stop gap (§12B.4) exists in the current printing code.

### 12B.10 Corrections to my earlier planning text

The earlier chat plan is not reproduced in this file. The items below record its errors and their corrections.

- The earlier chat plan listed no `shop_id` on coverage or payment rows. This file already has `shop_id` on both. The correction is the composite foreign key (R7).
- The earlier chat plan's 12-month end expression was garbled. Replaced by the Asia/Kolkata formula in fix 10.
- The earlier chat plan gated `orders` inserts. Withdrawn under decision A.
- The earlier checksum named `order_payments`, which does not exist in any migration. Corrected in §12A.11.

### 12B.11 Required tests (updated; none run; staging only)

- **States:** NONE; ACTIVE by admin grant; SCHEDULED; EXPIRED; REVOKED. Boundaries: start inclusive, end and revocation exclusive. A future period cancelled before its start is dropped. Revocation after the natural end is refused (M2). `access_until` covers contiguous blocks. Lifetime precedence, and its revocation. SCHEDULED after revocation (G). Tie-break (fix 5).
- **Admin RPCs:** a non-admin is denied, with a committed denial row and counter. aal2 is required. A stale state version is rejected. A reason is required. A replay returns the stored result. A conflicting payload is rejected. No self-disable. The last admin is protected. Custom grant boundaries at 00:00 IST. One-month and one-year grants start at the time of the grant.
- **Privileges:** admin RPCs are callable only by an authenticated admin with aal2. Internal helpers are denied to `public`, `anon`, and `authenticated`. No default grants on licence tables (staging inspection).
- **Triggers:** the revocation whitelist. One revocation only. DELETE and TRUNCATE blocked on coverage and audit tables. Denial and audit rows are append-only.
- **Versioning:** exactly one increment per RPC request. No increment on reads.
- **Denial cap:** 20 detailed rows, then aggregates. Identical response. The counter persists after a denial.
- **Concurrency:** a two-session test. The second writer waits on the shop lock.
- **Orders unchanged:** checksum over the `orders` payment columns and the `order_events` row count, before and after licence actions.
- **Checkout unaffected (A):** `place_order` succeeds while the licence is inactive, with enforcement on. Migrations define two signatures (three arguments in 0001 and 0003; four arguments in 0008 and 0009). No migration drops either. Which overloads exist on a live database is UNVERIFIED. Test every overload that exists. The three-argument version is granted to `anon` and `authenticated` (0003 lines 277–278). The four-argument version is granted to both as well (0008 line 115; 0009 line 81), and it calls the three-argument version (0008 line 75; 0009 line 62). Test both signatures as an anonymous caller and as an authenticated caller.
- **Printing gate (7F, after approval):** approve and retry are refused, with no rows and no order status change. Claim returns nothing. `mark_printing` refuses. Finish works for a printing job. Queued jobs resume when the shop is ACTIVE.
- **Duplicate-print fix:** retry refused when a sibling is `sent`. Retry refused for a source that is not the latest attempt. Retry still works for `failed` and confirmed `needs_check`. Existing printing tests unchanged.
- **Refund and claim fix:** defined after diff review. Must include a check that a refunded order's files are not claimed.
- **Held-job limit (M1, not approved for implementation):** 7-day failure. Reason code. File eligibility per the rule chosen under C-1. Printing jobs' files never deleted. No effect on other orders.
- **Owner status:** enforcement off returns no fields. Enforcement on returns only the D fields. Staff denied.
- **Timezone:** 29 February plus 12 months gives 28 February.
- **Regression:** 0011 changes no existing function, trigger, policy, or grant. Checked statically and at runtime.

### 12B.12 Next gates (none authorised by this document)

1. Owner answers to C-1, C-3, C-4, C-5, C-6, and the pending items in §12B.3. C-2 is deferred with item 2. C-10 is answered: trials are deferred, not removed (owner instruction 4, 2026-10-31).
2. Separate approval for local setup (Option A). The setup steps are not reproduced in this file and must be written out and reviewed before that approval is requested.
3. Separate approval to inspect the local Auth schema (L).
4. Separate approval to create migration 0011 to the corrected 7B spec (§12B.5, §12B.11).
5. Diff review of the duplicate-print fix (K). Then a separate approval for targeted local tests. Staging tests and the implementation each need their own explicit approval.
6. Separate approval for the refund and claim fix (M7), after diff review.
7. Separate approval for each of 7C, 7D, 7E, and 7F. The M1 rule has its own review (§12B.6).

## 13. Revision log

### Owner decisions and correction pass (2026-10-31)

Five owner instructions from 2026-10-31, and the corrections that follow from them. They change statuses and wording only. No gate, setup, migration, test, deployment, production action or commit is approved.

| Item | Change | Where applied |
|---|---|---|
| Instruction 1: item 2 DEFERRED | Status changed from RECOMMENDED to DEFERRED. Removed from the default Stage 7 closure requirements. Reopening trigger added. C-2 follows as DEFERRED. Counts updated | §14.2 item 2 and count line; §14.3 C-2; §15.1; §15.3 held-job rows; §16.1(e); §16 Q6 |
| Instruction 2: enforcement not a closure requirement | Enabling enforcement is not a Stage 7 closure requirement. Building and validating enforcement is separate from enabling it in production | §16.1(e); §15.3 gate 7F; §14.2 items 1 and 11 |
| Instruction 3: items 11 and 26 | Neither is a general closure requirement. Item 11 is required before enforcement activation. Item 26 is required before the relevant production migration | §14.2 items 11 and 26; §15.1; §16.1(c); §16 Q2; §16.2 |
| Instruction 4: C-10 trials | Trials are DEFERRED out of Stage 7, not permanently removed. Trial terms are not approved. The PENDING marker beside the trial item is replaced | §9 item 5; §12B.9 C-10; §12B.12 item 1; §14.2 item 9; §14.3 C-10; §14.6 decision 5 |
| Instruction 5: item 23 approval scope | Investigation and targeted local tests are approved only after the proposed code diff is reviewed. Staging tests need separate explicit approval. Implementation needs its own approval | §12B.2 K; §12B.4 status; §12B.12 item 5; §14.1 K; §14.2 item 23; §15.1; §15.3 duplicate-print row |
| Correction: decision 9 wording | §10 items 2 and 5 say processor work applies only if the gateway is reopened | §10 items 2 and 5 |
| Correction: decision 19 fields and labels | Owner-only status fields are approved (§12B.2 D). Labels, the admin-grant label and staff visibility stay open. The Android view is DEFERRED, with a reopening trigger | §14.2 item 13; §14.6 decision 19 |
| Correction: C-3 | The decision to hold enforcement back is separated from the requirement to implement M1 before enabling. Item 10 is added where the M1 gate needs it | §12B.9 C-3; §14.2 item 1; §14.3 C-3; §15.1 |
| Correction: group A | Item 17 removed from group A. Items 9 and 21 are also DEFERRED and remain in group A. Flagged for the owner, not changed | §14.0 |
| Correction: reopening triggers | Every deferred item now names a reopening trigger: items 2, 9, 17, 21, 22, 27 and 34 (deletion), and the Android view (item 13) | §14.2; §14.6; §15.1 |
| Correction: §9 status | The §9 heading no longer says all items are pending. Item 12 now reads DEFERRED, matching decision 12 in §14.6 | §9 heading; §9 item 12 |
| Correction: closure checks | Production checks for closure are items 5, 25, 27, 31 and 34. Items 11 and 26 are not closure checks | §16.1(c); §16 Q2; §16.2 |
| Counts | 9 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 5 DEFERRED, 0 DECIDED (total 35). Verdict unchanged: READY FOR FINAL OWNER REVIEW; NOT APPROVED | §14.2; §16.2 |

### Four-issue resolution (2026-10-31)

| Item | Change | Where applied |
|---|---|---|
| Item 2 closure | Item 2 is no longer a Stage 7 closure requirement by default. No 7F build gate depends on it, and group D (safe to defer) is kept. Proposed for owner confirmation. It is a prerequisite of enabling only if C-3 holds enforcement back. §16.1(e) states the change, so no requirement is removed silently | §14.2 items 1, 2; §14.3 C-3; §15.3 gate 7F; §16.1(e); §16 Q6 |
| Items 1, 23 and 24 closure | Still closure requirements. §16.1(e) states what "closed" means for each. No requirement is relaxed | §16.1(e) |
| C-1, C-3, C-6 and item 2 | §15.1 has a table of which gates need each answer and how each one closes. C-1 comes before the owner's C-3 decision (item 1), so the 7F build now names "C-1 answered, C-3 decided". Item 11 is needed before enabling only, as §15.3 already said | §15.1; §15.3 gate 7F; §16 Q6 |
| Decision 9 | §9 item 9 changed from PENDING OWNER APPROVAL to DEFERRED (§14.6 decision 9). The gateway is not reopened, and nothing is approved. The Phase 2 dependencies item now matches. Status unchanged | §9 item 9; §10 item 5 |
| Decision B | Register status changed from DECIDED to EXTERNAL BLOCKER, because its condition (item 1) is open. §14.0 says a conditional approval is not DECIDED while its condition is open. Decision E stays DECIDED, since it is an unconditional design approval | §14.0; §14.1 row B; §12B.1 legend |
| Counts and verdict | No item status changed. §14.2 counts are unchanged: 10 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 4 DEFERRED and 0 DECIDED (total 35). Verdict unchanged: READY FOR FINAL OWNER REVIEW; NOT APPROVED | §14.2; §16.2 |
| Known mismatch, resolved 2026-10-31 (owner instruction 4) | §9 item 5 (trial) said PENDING OWNER APPROVAL while decision 5 was DEFERRED. Now DEFERRED, with trial terms not approved | §9 item 5 |

### Consistency correction (2026-10-31)

| Item | Change | Where applied |
|---|---|---|
| Processor and paid-path dependencies | Item 4 names two answers that come before pricing: the CA's tax answer (item 18) and the owner's collection-channel answer. Item 17 stays DEFERRED. It is a pricing prerequisite only if a named processor is chosen, and then only for eligibility evidence and fee basis. Dependency note added. Decision 3, decision 9 and row I aligned. The paid-path gate lists items 3, 4, 7, 10, 14, 16 and 18, and M6 tests | §14.1 I; §14.2 items 4, 17; dependency note; §14.6 decisions 3, 9; §15.3 paid path and gateway rows |
| 7B grant-limit dependency | Maximum custom length, backdating, durations and lifetime owner-only are 7C validation, not 7B schema prerequisites. The 7B owner inputs are listed: C-5, item 8, item 16 (unit) and the item 7 basis ranking. Item 7 states that the 7B schema does not check `starts_at` against `created_at` | §14.2 items 7, 8, 16; §14.6 decision 16; §15.3 gates 7B and 7C; owner-inputs note |
| 7E rollback | "Revoke the grant" removed. The rollback removes the owner status UI, and withdraws the read RPC only through a migration. It changes no coverage row. The same rule is added for 7C and 7D | §15.3 gates 7C, 7D, 7E; §15.5 |
| Other prerequisite mismatches | Item 2 removed from 7F (it blocks M1 only). Item 14 no longer blocks 7C. Item 24 is not a 7F prerequisite. Item 26 blocks production migrations only. Item 31 no longer blocks 7D. Item 34 blocks shop count only. M1 gate lists item 10. §12B.9 C-6 no longer says it blocks 7B | §14.2 items 14, 24, 26, 31, 34; §15.3; §16 Q6; §12B.9 C-6 |
| Owner action and stage wording | §15.1: owner answers approve no gate, and production-owner checks run only on the owner's separate request. §15.4: Stage 8 is blocked until §16.1 is met | §15.1; §15.4 |
| Counts and verdict | No status changed. Counts stay at 10 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 4 DEFERRED and 0 DECIDED (total 35). Verdict unchanged: READY FOR FINAL OWNER REVIEW; NOT APPROVED | §14.2; §16.2 |

### Register and checks (2026-10-31)

| Item | Change | Where applied |
|---|---|---|
| Register rebuilt | §14 gives one status to each numbered item 1–35. The earlier sub-letter split (for example 4a and 5b) is removed, so no numbered item carries two statuses. Group statuses A–E added. The status rule is stated | §14.0; §14.2 |
| Open IDs given statuses | C-1 to C-15, decisions A–L and 1–20, M1–M8, S-1 to S-8 and R1–R19 each have one status, in tables | §14.1; §14.3 to §14.7 |
| Closure review numbering | Items, group letters and the 35 numbered items follow the 2026-10-30 closure review (its §2 and §7). That review is not in the repository | §14 |
| Roadmap and checklist rebuilt | §15 and §16 use the new item numbers. Separate gates include the held-job marker or scheduler (item 2). Verdict: READY FOR FINAL OWNER REVIEW; NOT APPROVED | §15; §16 |
| Reference fixes | "item 27a" and "item 27b" changed to item 27. §9 item 2 now refers to items 3 and 16 | §4; §5C; §9 item 2 |
| place_order grants | Both signatures and their grants noted in §12B.2 row A (closure correction 8) | §12B.2 |
| Resend call sites | Checked against `web/src/owner.js` on 2026-10-31. Call sites are lines 259 and 358 only. Line 327 is the button and line 345 is the countdown text. §2 was already correct and is unchanged | §2 |
| Privacy and terms search | Worktree search on 2026-10-31 found no privacy policy, terms, consent, grievance, takedown or DPDP text. Item 29 unchanged | §14.2 item 29 |
| Header | Date set to 2026-10-31 (last updated). Register status label updated | Header |

### Final documentation pass (2026-10-30)

| Item | Change | Where applied |
|---|---|---|
| Header and labels | Date updated. README-statement and register-status labels added | Header; labels |
| Repository re-check (read-only) | Line references re-checked in migrations 0001, 0003, 0006, 0008, 0009 and 0010; the edge functions and workflows; `agent/src/worker.mjs`, `web/src/owner.js`, `web/src/auth.js`; and the README. Each claim now shows its source | §2; §4; §5; §5C; §11; §12A.2; §12B.4 to §12B.9 |
| C-2 scheduler | Corrected. The daily purge scheduler exists in the repository (`cleanup-files.yml`). No scheduler exists for held-job timeouts. Deployment unverified | §2; §5C; §12B.6; §12B.9 C-2 |
| File retention | Two rules documented: unclaimed files expire one day after upload (0003 line 41); claimed files are removed 30 days after the order is completed, cancelled or rejected, with purge exclusions (0010 lines 794–807). "30 days after finish" replaced in §5, §9 item 7, §12A.10 and §12B.8 | §5; §5C; §9 item 7; §12A.10; §12B.6; §12B.8 |
| Migration 0010 and deployment | Documented as not applied to any database (`docs/PRINTING_STATUS.md` line 54). Code and workflow in the repository. Live deployment unverified | §2; §4; §5C |
| S-5 | Static finding recorded: `worker.mjs` lines 258–264 return without printing or reporting failure. Runtime test still required | §12B.9 S-5 |
| R18 | Replaced with the per-RPC lock map of the existing code, with line numbers. The designed order is marked as design only. Two-session test outstanding | §12B.5 R18 |
| R7 | Status clarified: the composite key applies only if `licence_payments` is approved | §12B.5 R7 |
| §9 item 2 and M4 | 12-month paid term approved as policy (M4); paid path blocked (M5). Renewal and stacking remain recommendations | §9 item 2; §14 items 3, 16 |
| Stage 6 | Named precisely: branch `stage6-simulated-printer`, commit 885d28b, not an ancestor of origin/main. Base print agent already on origin/main | §2; §9 item 10; §14 item 20 |
| `place_order` | Both signatures and their grants documented. The three-argument version is granted to `anon` and `authenticated` (0003 lines 277–278) and is called by the four-argument version. Live state unverified | §2; §12B.11 |
| `owner.js` | Resend references corrected: button line 327, binding line 332, countdown lines 337–350, call sites lines 259 and 358 | §2 |
| README drift | Recorded, not changed: region and plan statements; 0006 applied; Stage 6, 7 and 8 wording; cleanup in the repository against README Stage 8 | §2; §4 |
| `owner-file-link` `verify_jwt` | Kept only as a source and README statement. Live setting unverified; no `config.toml` | §12A.2 |
| Retry body | Range corrected to 502–549. Order status and payment check (lines 530–533) added. 0008 guard at lines 39–43 | §12B.4 |
| Purge ranges | Expiry check at line 794; exclusions 795–798; retention 799–807; function 785–810 | §5C; §12B.6 |
| Purge capacity | Added: 2,000 files per run, reached near 3,000 shops, with the assumptions stated | §5C |
| Rate-limit purge | `purge_old_rate_limits` is called by `cleanup-files` (`index.ts` line 81) | §12B.7; §12B.8 |
| Decision 13 | "Assumed" replaced with a recommended default, not an approval | §12B.3 |
| Paid tables in 7B | Exclusion of `paid_verified`, `trial` and `licence_payments` marked as proposed (C-5) | §12A.12 |
| Register, roadmap and checklist | Added §14 (decisions A–L; items 1–35 with statuses; mapping of C-1 to C-15, S-1 to S-8, M1 to M8 and decisions 1–20), §15 (categories, gates and separate gates) and §16 (checklist, closure criteria, verdict) | §14; §15; §16 |
| Status | "Waiting for owner review" replaced with the final-pass status | §12 |
| Not changed | §6 item 5 formatting; §3 Razorpay MDR row; §12A.16 proposed replacement (still pending approval); every approval and pending status; decisions A–L and M1–M8 | — |

### Final cleanup (2026-10-30)

| Item | Change | Where applied |
|---|---|---|
| Chat-plan labels U10, N3, N2 and A7 | Removed as labels. Meaning kept. The earlier chat plan is described as not reproduced in this file. No decision changed | §12B.2 (rows A and C); §12B.9 C-10; §12B.10; §13 (Stage 7 decision record, Trial row) |
| §12B.12 item 2 | Comma splice corrected to a full stop | §12B.12 |
| Last-updated date | Header date set to 2026-10-30. Historical revision dates unchanged | Header (line 4) |
| Not changed | §6 item 5 formatting; §3 Razorpay MDR row; all approval and pending statuses; the "decision date 2026-10-29 (owner to confirm)" item in the review entry below | — |

### Review corrections (2026-10-30)

| Item | Change | Where applied |
|---|---|---|
| Review items 1–12 | Term rule corrected to the fixed 12-month term (M4). Denials no longer described as audit rows. §9 intro and §12A header show pending status, with partial approvals noted. M1 status reworded as not approved. Payment recording marked deferred (M5). R7 key scoped to after M5. Data-model entries added for `licence_lock_shop`, `licence_requests` and `licence_denials`. Cancelled-before-start wording corrected. Replace follows the M2 rule and is deferred for paid coverage. Retry line range corrected to 502–547. Trial deferral marked in §5B and §12A.1 | §12A header; §12A.1; §12A.5; §12A.6; §12A.7; §12A.11; §12B.2; §12B.4; §5B; §9 intro |
| Complimentary grants | Defined in §12A.1 as an admin or lifetime grant created without a payment | §12A.1 |
| Wording | Chat-only sources marked as not reproduced in this file. Setup steps flagged as not reproduced. Design labels changed to "design resolved; not tested". place_order overloads stated as unverified | §12B.5; §12B.11; §12B.12 |
| Not changed | §6 item 5 formatting; §3 Razorpay row (open, §12A.16); decision date 2026-10-29 (owner to confirm) | — |


### Stage 7 decision record (2026-10-29)

| Item | Change | Where applied |
|---|---|---|
| A–L and M1–M8 | Recorded with status | §12B.2 |
| Decisions 13–20 | Status recorded | §12B.3; §12A.13 heading |
| Printing fixes (K, M7) | Investigated. Stop-and-review recorded. Nothing implemented | §12B.4 |
| State-machine corrections 1–11 | Recorded. Applied to §12A.5, §12A.6, §12A.10 | §12B.5 |
| R1–R19 | Recorded with status. Unverified items marked | §12B.5; §12A.4; §12A.5; §12A.8; §12A.11 |
| Held-job rule (M1) | Recorded as a proposal, with conflicts | §12B.6; §12B.9; §12A.10 |
| Denial logging (M3) and retention (M8) | Recorded as design and policy proposals | §12B.7; §12B.8; §12A.9 |
| Pricing and paid path | Kept blocked (I, M5) | §7 notice; §12A.5; §12A.7; §12A.12 |
| Expiry wording | Superseded in part by A, B, C | §9 item 7; §12A.10 |
| Trial | Deferred under the 2026-10-29 direction (earlier chat plan, not reproduced in this file). §9 item 5 still open | §9 item 5; §12A.5; §12A.6; §12A.11; C-10 |
| Checksum name | Corrected: `order_payments` does not exist | §12A.11 |
| Auth decisions, protected checkout, stash | Unchanged | §2; §12B preamble |
| Status and cross-references | Updated | Header; §7; §12; §12A intro; §12A.4 |

### Admin-grant and manual licence design (2026-10-29)

| Item | Change | Where applied |
|---|---|---|
| Admin grants, licence states, manual payments, audit, expiry, tests, stages, new decisions 13–20 | Added (design only) | §12A; §9 pointer; §10 items 12–13; §12 status |
| §3 Razorpay row, "government sets UPI MDR at 0%" | **Not edited.** Outdated per the MoF DFS FAQ (15 Sep 2026). Replacement wording proposed, pending approval | §12A.16 |
| Financial base case | No change. Flagged effects: granted shops, manual route, UPI MDR on Option C, turnover assumption | §12A.14 |

### Correction pass (2026-10-29)

Critical financial corrections:

| Item | Correction | Where applied |
|---|---|---|
| A | Email-volume base case: E undecided, Free and Pro shown separately; 100-shop result ₹4,816 (Free) or ₹2,916 (Pro) | §5 table; §5A; §6 items 10, 12; §7; §8; §9 item 8; §10 item 11 |
| B | Accrual and cash bases separated; month 43 (Pro) and 26 (Free) labelled accrual; month 13 cash position verified | §5B; §6 item 15 |
| C | Forgone and deferred revenue distinguished; Decision 8 is silent on term extension, so the illustrations assume none and label the revenue forgone; N made an explicit input | §1; §5B; §6 item 14; §9 item 8 |

Remaining audit corrections:

| # | Correction | Where applied |
|---|---|---|
| 1 | FX ±₹225 applies when Pro applies, cross-referenced to §5A | §6 item 10 |
| 2 | 2.36% described as derived; not universally conservative; ₹2,999 assumptions distinguished | §5 table; processor fee note; §6 item 8; §7 |
| 3 | DPDP applicability and obligations flagged for lawyer review | §3 DPDP row; §4; §9 item 11; §10 item 6 |
| 4 | Unimplemented 30-day retention cross-referenced to the 10,000-shop overage | §5C; §8 notes |
| 5 | 10-shop net footing explained using unrounded values | §8 rounding note |
| 6 | Shop thresholds use unrounded ex-GST price; displayed-price results shown | §6 item 7 |
| 7 | ₹2,916 equation corrected to 100 × 102.9135 − 7,375 = 2,916.35 | §5B |
| 8 | Revenue projections labelled conditional on a payment channel and processor | §5 table; §8 header and notes; §9 item 9 |
| 9 | Grandfathering comparison cross-referenced to the email tier and to accrual vs cash | §5B; §9 item 8 |
| 10 | Licence expiry separated from the retention and deletion schedule | §9 item 7 |
| 11 | Prior-revision cross-reference for shop-count rounding corrected: it pointed to the §3 s.22 row (services scope); now §5 formulas and §6 item 7 | §13, prior revision row 1 |
| 12 | Phase 2 dependencies updated for decisions 4, 7, 9, and 12 | §10 item 5 |
| 13 | PAN and GST registration statement marked for CA confirmation | §10 item 1 |
| 14 | Stripe's description of its own status relabelled as a company statement | §3 Stripe row |
| 15 | Provenance wording corrected | §4 hosting |
| 16 | Resend: sign-up code path stated (Supabase Auth `/auth/v1/resend`); no Resend integration claimed | §2 |
| 17 | Shop thresholds 1,574 and 787 preserved; other audit-consistent figures unchanged | §5, §6, §7, §8 |

### Prior revision (2026-10-29, read-only audit)

| # | Requested correction | Where applied |
|---|---|---|
| 1 | Shop counts rounded down for maximum turnover limits | §5 formulas; §6 item 7 |
| 2 | 10,000-shop Resend cost corrected; next tier unverified; net provisional | §5A; §8; §6 item 12; §4 |
| 3 | "Stripe is installed" tied to README.md, not "appears nowhere else" | §2 |
| 4 | ₹1 rounding differences explained | §8 rounding note; §6 item 5 |
| 5 | GST-charged labels; no-GST alternatives shown separately | §7 table and sensitivities; §6 items 1–2 |
| 6 | Resend threshold derived from emails per order | §5A |
| 7 | myBillBook comparison removed from pricing | §6 item 17; §7; §3 row marked |
| 8 | Verified Stripe rule separate from derived 2.00%; 2.36% kept; debit qualified | §3; §5 table; §6 item 3; §7 |
| 9 | FX sensitivity includes Resend Pro | §6 item 10 |
| 10 | Retention marked not deployed; storage formula and assumption shown | §5 table; §5C |
| 11 | Free period and trial timing modelled; base assumption of month-one payment disclosed | §5B; §5 table; §9 item 8 |
| 12 | Input tax credit and reverse charge flagged for CA; unsourced claim qualified | §4; §6 item 16; §9 item 4 |
| 13 | ₹1,000 dispute fee distinguished from licence pause | §9 item 6 |
| 14 | GitHub Pages rules from official docs; visibility unverified; hosting provisional | §3 new row; §4; §6 item 18 |
| 15 | One-time cost section, including conditional Google Play fee | §8A |
| 16 | Database overage marked unmodelled | §5C; §8; §4 |
| 17 | GST threshold scope limited to services | §3 s.22 row; §6 item 6 |
| 18 | Source titles aligned; accounting share at one decimal | §3; §11; §6 item 2 |

## 14. Consolidated decision register (added 2026-10-30; rebuilt 2026-10-31)

This register gives one status to each numbered item of the 2026-10-30 closure review (items 1 to 35), to each group A to E, and to each open ID in this file: decisions A to L, decisions 1 to 20, C-1 to C-15, S-1 to S-8, M1 to M8 and R1 to R19. The closure review is not reproduced in this file. Its item numbers and group letters are used as recorded there. Nothing in this register approves a gate, setup, migration, test, deployment, live change or production access.

### 14.0 Status key and rules

- **DECIDED:** approved by the owner in this file (§12B.2 or §12B.3) with no open condition. Any implementation still needs its own gate. A conditional approval (APPROVED, CONDITIONAL in §14.1) is not DECIDED while its condition is open. Its register status follows the open condition.
- **RECOMMENDED:** a proposed default that the owner can confirm or change by written answer.
- **DEFERRED:** postponed on purpose. The trigger for reopening is given.
- **EXTERNAL BLOCKER:** the next step needs an outside party: a CA, a lawyer, a processor, the production owner, or evidence from a live system.
- **IMPLEMENTATION GATE:** the next step is technical work (design, local or staging tests, or diff review) that needs its own approval.

Where an item has several open parts, its status is the status of the first step that must happen before the item can close. Approved parts are noted in the row. They do not give the item a second status.

**Groups.** The closure review (its §7) sorts items into groups A to E. A group status describes how the group closes. Each item keeps its own status in §14.2, and the item status governs. Items 9 and 21 are DEFERRED and still sit in group A. That is flagged for the owner (§13), not changed here.

| Group | Meaning in the closure review | Group status | Items in the group |
|---|---|---|---|
| A | Owner can decide now | RECOMMENDED | 3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 19, 20, 21 |
| B | Technical evidence first | IMPLEMENTATION GATE | 2, 5, 6, 11, 12, 15, 24, 25, 26, 27, 31, 32, 33, 34 |
| C | CA or lawyer | EXTERNAL BLOCKER | 4, 10, 11, 14, 17, 18, 28, 29, 30 |
| D | Safe to defer | DEFERRED | 2, 4, 8, 9, 13, 14, 17, 21, 22, 34, 35 |
| E | Blocks Stage 7 implementation | IMPLEMENTATION GATE | 4, 5, 15, 25, 26, 31, 32, 33, 35 |

Items 1 and 23 are not listed in any group in the closure review.

### 14.1 Decisions A to L (§12B.2)

| ID | Recorded in §12B.2 | Register status | Note |
|---|---|---|---|
| A | APPROVED | DECIDED | Printing-only enforcement. The build is gate 7F. |
| B | APPROVED, CONDITIONAL on C-1 and C-3 | EXTERNAL BLOCKER | Approved subject to C-1 and C-3. The condition is open (item 1), so the status is not DECIDED. |
| C | APPROVED | DECIDED | Retries blocked while inactive. The build is gate 7F. |
| D | APPROVED | DECIDED | Minimal owner status. The build is gates 7C and 7E. |
| E | APPROVED for design; ENABLING BLOCKED | DECIDED | Design only. Enabling is open under item 11. |
| F | APPROVED; BLOCKED with the paid path (M5) | DECIDED | Paid parts follow M5. |
| G | APPROVED | DECIDED | SCHEDULED state. |
| H | APPROVED; BLOCKED with the paid path (M5) | DECIDED | Paid parts follow M5. |
| I | BLOCKED | EXTERNAL BLOCKER | Pricing and minimum payment. Needs item 4 first: the CA's tax answer (item 18) and the collection-channel answer. Integration (item 17) is not needed. |
| J | APPROVED; BLOCKED with the paid path (M5) | DECIDED | Paid parts follow M5. |
| K | Investigation and local tests only after diff review (owner instruction 5); fixes REVIEW REQUIRED | IMPLEMENTATION GATE | Items 23 and 24. Staging tests need separate approval. |
| L | BLOCKED until local setup is approved separately | IMPLEMENTATION GATE | Local setup gate, then the R15 fixture check. |

### 14.2 Numbered items 1 to 35 (closure review)

Count: 9 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 5 DEFERRED, 0 DECIDED. Total 35. Each item has exactly one status. Parts with other statuses are named in the row, and do not change its status.

| No. | Item and references | Status | Group | Open parts and who acts | Blocks |
|---|---|---|---|---|---|
| 1 | Held-job file retention; C-1, C-3; M1 file effect (§12B.6, §12B.9) | EXTERNAL BLOCKER | none listed | A held paid order that stays in `printing` never reaches a terminal status, so its file is not purged (0010 lines 795–798). A lawyer reviews when such a file may be released. The owner then chooses the C-1 option and decides C-3 (accept held files as an interim, or hold enforcement back). | M1; the 7F build (C-1 answered, C-3 decided). Enabling needs M1, with item 2 and item 10 where paid orders are affected, if C-3 holds enforcement back. Not 7B. Stage 7 closure: §16.1(e). |
| 2 | Hold start and scheduler; C-2 (§12B.6) | DEFERRED | B, D | Deferred by owner instruction 1 (2026-10-31). Reopening trigger: C-3 holds enforcement back, or M1 is put forward for build. The owner then chooses the hold start: (a) the job's `created_at`, which can fail a job a day into a lapse, or (b) the time the shop left ACTIVE, stored as a marker. Option (b) is recommended. The purge scheduler exists (§5C), but it does not time out held jobs. A marker, timeout code or new scheduled job needs its own gate (§15.3). | M1. Enabling only if C-3 holds enforcement back. Not a Stage 7 closure requirement (§16.1(e)). |
| 3 | Paid-term stacking; C-4 (M4, J) | RECOMMENDED | A | The owner confirms stacking, so paid terms do not overlap. | Paid path only (M5). |
| 4 | Pricing, minimum payment, tax treatment, paid path and the 0011 paid-table scope; I, M5, C-5, C-13 (§7, §12B.2) | EXTERNAL BLOCKER | A, C, D, E | Price, minimum and tax treatment need two answers first: the CA's tax answer (item 18), and the owner's collection-channel answer, either manual collection or a named processor. Decision 9 (gateway) stays DEFERRED, and integration (item 17) is not needed. If a named processor is chosen, its eligibility evidence and fee basis are needed before pricing. The exclusion of `paid_verified` and `licence_payments` from 0011 (C-5) is recommended. It is the only part of this item that gates 7B. See the dependency note below the table. | Paid coverage and any published price. 7B only through C-5. |
| 5 | Admin identity, MFA and the Auth UUID (decisions 13, 14; C-6, C-15; §10 items 12–13; §12A.3) | EXTERNAL BLOCKER | A, B, E | The production owner supplies the owner's Auth user UUID from their own account. It is never inferred. The production owner also records the MFA status on the Supabase account. One owner admin (decision 13) and `aal2` for admin RPCs (decision 14) are recommended. `aal2` behaviour needs staging evidence (S-3). | 7A; the bootstrap row; 7C to 7D. |
| 6 | Admin UI hosting: a separate private deployment outside `web/` (decision 15) | RECOMMENDED | A, B | The owner confirms a separate private deployment, not linked from the shop app. `pages.yml` publishes `web/` publicly on pushes to `main` that change `web/**` or the workflow. The repository visibility and plan (§3, GitHub Pages row) are a production-owner check. The check affects the hosting cost, not the recommendation. | 7D. |
| 7 | Lifetime, complimentary and grant limits (M4, M5, M6, F, H; C-7; decision 16) | RECOMMENDED | A | Approved: the custom-date convention, complimentary-grant independence, M6 as policy, and F and H (paid parts blocked by M5). Open for 7C validation: the owner confirms that backdating needs explicit confirmation and that lifetime is owner-only. Open for 7B: the owner confirms that a lifetime grant ranks above an admin grant in the basis (§12A.6). M6 covers paid coverage only, so this admin-grant ranking is not separately confirmed. C-7 (access continues through a valid paid period after a lifetime revocation) matters only once the paid path is approved. The maximum custom length is DEFERRED until the owner sets it. It is a 7C validation input, and "none" is a valid setting. No default is invented. The 7B schema has no maximum-length check. It is proposed not to check `starts_at` against `created_at`, so backdating is enforced in the 7C RPC. | 7C grant validation (duration, backdating, lifetime owner-only, maximum length); 7B state function (basis ranking); paid transition tests. |
| 8 | Revocation and future coverage (C-8, G; fixes 5 and 9; decision 17) | RECOMMENDED | A, D | The owner confirms that revoking current coverage does not cancel future coverage (C-8), that a same-instant tie gives REVOKED (fix 5), and that the exclusive end is displayed (fix 9). Approved: refusal after the natural end (M2) and reversal (H). Standalone revocation of an active paid period is DEFERRED with the paid path (decision 17). | 7B state function, revocation design and state tests; 7E wording. |
| 9 | Trial policy (decision 5; C-10) | DEFERRED | A, D | Deferred out of Stage 7 (owner instruction 4, 2026-10-31). Postponed, not deleted. Trial terms are not approved. Reopening trigger: a new owner decision on product and pricing terms. | Nothing while deferred. |
| 10 | Refund policy (§9 item 6; C-11) | EXTERNAL BLOCKER | C | A lawyer reviews first, then the owner decides. The processor and dispute fees in §9 item 6 are facts, not policy. | Paid path; refund tests; the M1 effect on paid orders. |
| 11 | Existing shops: count N, free period and notice (decision 8; C-14; §5B) | EXTERNAL BLOCKER | B, C | The production owner counts N, excluding test rows (README lines 395–405; item 34). A lawyer reviews the 30-day notice, which is only a proposal. The free-period and term policy stays open: there is no free-year promise and no term extension until N is known. The §5B figures are arithmetic only. | Enforcement activation, which is not a Stage 7 closure requirement (owner instructions 2 and 3, 2026-10-31); any published existing-shop terms. |
| 12 | Email-volume tier E (§5A; §10 item 11) | RECOMMENDED | B | The owner estimates emails per order from real data. Both the Free and Pro scenarios stay until then. | Projections only. Not Stage 7 code. |
| 13 | Expiry, grace and the shop-facing view (decisions 7, 18, 19) | RECOMMENDED | A, D | Approved: printing-only enforcement, held queued jobs and no retries while inactive (A, B, C). The "no new customer orders" wording is superseded (C-9). Approved (§12B.2 D): owner-only status with the fields listed there. Open: staff visibility (§12B.2 D); the owner confirms no grace period (decision 18); and the labels, Active or Inactive, with no admin-grant label (decision 19). The Android view is DEFERRED. Reopening trigger for it: a new owner decision to show the licence view in the Android app. The deletion-schedule question under decision 7 sits in item 1. | 7E wording. |
| 14 | Manual payments, verification and audit (decision 20; §12A.7; §12B.8) | EXTERNAL BLOCKER | A, C, D | The payment-method list is recommended (UPI direct, bank transfer, cash, cheque, other), but it is DEFERRED with the paid path (M5). A CA advises on GST invoices for manual receipts. A lawyer advises on personal data in audit rows and their retention. | Paid path (M5); any audit-retention job (none approved). |
| 15 | Denial and replay retention; denial growth (M3, M8; C-12; decision 20) | EXTERNAL BLOCKER | A, B, E | Approved: detailed denial records capped at 20 per user per hour, with count-only records above the cap (M3, design only). A lawyer reviews the retention periods (90 days for denial records; replay records kept until a safe mechanism exists; M8). Staging measures row growth. The owner accepts the global ceiling (no value is proposed here) and the count-only limitation (C-12). | 7C denial logging; retention in 7C. |
| 16 | Licence unit and term (decisions 1, 2; §9 items 1–2) | RECOMMENDED | A | Recommended unit: per shop. It matches the `shop_id` model (§12A.5). A per-owner or per-computer unit would change the 7B data model, so the unit must be confirmed before 7B design. Term: 12 months, approved as policy (M4). Renewal: manual, with no automatic renewal, recommended. §9 item 2 is updated to match M4. | 7B data model (the unit only; the term does not change the schema); paid path (term and renewal). |
| 17 | Processor and gateway (decision 9; §3; §4) | DEFERRED | C, D | The gateway is deferred. §12A.1 records that the owner collects licence payments manually for now. Stripe is invite-only for new Indian businesses (§3, verified). Razorpay India signup is unverified. When the gateway is reopened, processor eligibility evidence and CA advice are needed first. If a named processor is chosen for pricing (item 4), its eligibility evidence and fee basis are needed before pricing; that does not reopen integration. | Gateway work (later stage; §12A.12); the fee basis for pricing if a named processor is chosen (item 4). Reopening trigger: a new owner decision to reopen decision 9. |
| 18 | GST route, exemption, input credit, reverse charge, TDS and invoices (decision 4; §10 item 3) | EXTERNAL BLOCKER | C | The CA decides the registration route, the current status of Notification 10/2017-IT, input credit, reverse charge on foreign services, TDS and invoicing. | Pricing tax treatment (I); invoices; paid path. |
| 19 | Advisers (decision 11) | RECOMMENDED | A | The owner engages an Indian CA and a lawyer before any paid collection. No engagement is evidenced. The advice itself is an EXTERNAL BLOCKER (items 10, 11, 14, 15, 18, 28, 29, 30). | Paid collection; published terms. |
| 20 | Stage 6 merge order (decision 10; §9 item 10) | RECOMMENDED | A | The owner decides whether `stage6-simulated-printer` (885d28b) is merged before Stage 7 is rebased. The base print agent is already on `origin/main`. No merge is approved. | Rebase order only. |
| 21 | Premium features (decision 12) | DEFERRED | A, D | None built. Option C's added value is undefined. A feature list and build plan are needed first. | Option C; any tier logic. Reopening trigger: the owner names the features to build and approves a feature list and build plan (decision 12). |
| 22 | Email provider and custom SMTP (§10 item 10; §3, Supabase built-in limit of 2 an hour) | DEFERRED | D | Deferred until before production sign-up volume. The production owner sets custom SMTP if it is chosen. Not Stage 7 code. | Production sign-up growth. Reopening trigger: the owner chooses custom SMTP, or production sign-up volume is about to start (§3 limit: 2 emails an hour). |
| 23 | Duplicate-print defect (K, M7; S-7; §12B.4) | IMPLEMENTATION GATE | none listed | Confirmed from code, not reproduced. Next: diff review of the proposed change (M7). Only after that review, targeted local tests for a `sent` sibling, the latest-attempt rule, and failed or confirmed `needs_check` jobs remaining retryable (owner instruction 5, 2026-10-31). Staging tests need a separate explicit approval. The implementation needs its own approval. | Printing change only. Not 7B. Ordering against the 7F build is an owner decision (§15.3). |
| 24 | Refund-and-claim defect (K, M7; S-8; §12B.4) | IMPLEMENTATION GATE | B | Confirmed from code, not reproduced. Next: diff review. Only then does the owner choose R-a, R-b or R-c. R-a is recommended, and it touches the customer payment ledger. | Printing change under its own gate (§15.3). Not a 7F prerequisite by default. Ordering against the 7F build is an owner decision (§15.3). |
| 25 | Second `place_order` signature (§2; §12B.11) | EXTERNAL BLOCKER | B, E | The production owner lists the live function signatures and grants, read-only. Both signatures are in the migration chain, and the three-argument version is granted to `anon` and `authenticated` (0003 lines 277–278). Keeping it is the default. Retiring it is a checkout change that needs separate approval. | The "checkout unaffected" test; 7F. |
| 26 | Live migration state and 0010 sequencing (§2; `docs/PRINTING_STATUS.md` line 54; README) | EXTERNAL BLOCKER | B, E | The production owner lists the applied migrations, read-only. The owner then decides whether 0010 may be applied, after staging evidence. | Production application of 0010 and 0011 (the live list comes first; owner instruction 3). Not a Stage 7 closure requirement. Staging tests of print paths. Not needed for 7B on staging. |
| 27 | Purge deployment, secrets and capacity (§5C; `.github/workflows/cleanup-files.yml`) | EXTERNAL BLOCKER | B | The production owner records, read-only, whether `cleanup-files` is deployed, whether `QRQUICK_CLEANUP_URL` and `CLEANUP_SECRET` are set, and its recent runs. Capacity is 2,000 files per run and is reached near 3,000 shops. A capacity change is DEFERRED until growth needs it, and it needs separate approval. Reopening trigger: shop count nears about 3,000. | Any claim that the purge runs (§5C; §8); growth beyond about 3,000 shops. |
| 28 | Google Play payment policy for any in-app licence purchase (§8A; `mobile/`) | EXTERNAL BLOCKER | C | A lawyer checks the current Play policy text. No Android licence payment is approved. | Any Android licence purchase or payment instruction. |
| 29 | Privacy policy, terms, refund text, intermediary and takedown duties, consent (§4) | EXTERNAL BLOCKER | C | A lawyer drafts and reviews. The owner approves publication. A search of the worktree on 2026-10-31 found no privacy policy, terms, consent, grievance, takedown or DPDP text. | Published terms; paid collection. |
| 30 | Customer-document sensitivity and retention (§4; README passport-photo layout) | EXTERNAL BLOCKER | C | A lawyer classifies sensitivity and DPDP applicability (§4). Engineering reviews storage and link handling, including the 180-second window (S-4). | Retention rules (item 1); privacy text (item 29). |
| 31 | Live Auth settings and Supabase configuration (§4; README next steps item 6; `supabase/config.toml`) | EXTERNAL BLOCKER | B, E | The production owner records, read-only, the live leaked-password protection, Site URL, SMTP and MFA settings. Versioning the configuration (`supabase/config.toml`, created by `supabase init`) is DEFERRED until local setup is approved. | MFA decision (item 5). Configuration versioning waits for local setup. |
| 32 | Rollback and enforcement kill switch (§12A.10; §12B) | IMPLEMENTATION GATE | B, E | No design exists. Engineering designs it, and the owner approves before 7F. Without it, 7F has no designed off switch. 0011 has no production rollback plan. | 7F approval. |
| 33 | Lock-order contract (R18; §12B.5) | IMPLEMENTATION GATE | B, E | The per-RPC lock map of the existing code is in §12B.5. The designed order is not built. Two-session tests on staging need separate approval. | 7C and 7F. |
| 34 | Test data and demo seed on live (README lines 397 and 463; `supabase/seed/demo_seed.sql`) | EXTERNAL BLOCKER | B, D | The production owner confirms whether `demo_seed.sql` ever ran on live. Deleting the test rows listed in the README is destructive and needs explicit owner go-ahead. That deletion is DEFERRED. Reopening trigger: the owner's explicit go-ahead. | Shop count N (item 11). |
| 35 | Other numbered items: R1 to R19, S-1 to S-8, M1 to M8 (§12B) | EXTERNAL BLOCKER | D, E | Each ID has its own status in §14.4 to §14.7. The item takes the status of its first outside step: a lawyer reviews the M8 and S-6 retention periods (item 15). | As listed per ID. |

**Dependencies for pricing and paid coverage (item 4; decisions 3 and 9; I; M5).** This note sets out what must be decided before pricing, and then before paid coverage, can proceed. It approves no price, no paid coverage, no account, call, key or integration. The paid path stays blocked (M5).

Before any price or minimum (decision 3, I) can be proposed:
1. The CA's tax answer (item 18): the registration route, and whether GST is charged on the licence.
2. The owner's collection-channel answer (item 4): manual collection, with no processor fee, or a named processor with its fee basis. This is not the gateway decision. Decision 9 stays DEFERRED, and integration (item 17) is not needed.
3. Only if a named processor is chosen: its eligibility evidence, which is needed before its fee basis is used. Stripe is invite-only for new Indian businesses (§3). Razorpay India signup is unverified (§4).

The owner then chooses the price and minimum (decision 3). No option in §7 is approved.

Before paid coverage can be built (the M5 path, a separate gate), in addition to the above:
- Item 10: the refund policy (lawyer first, then the owner).
- Item 14: manual payment methods, reference rules, GST invoice handling and audit handling (decision 20).
- Item 16: the term and renewal rule. Item 3: stacking (C-4). Item 7: C-7, a valid paid period stays in force after a lifetime revocation.
- A separate M5 approval naming the scope.

Apart from C-5, items 4 (pricing and channel), 10, 14, 17 and 18 are not prerequisites for 7B.

### 14.3 Conflicts and open conditions C-1 to C-15 (§12B.9)

| ID | Status | Item | Note |
|---|---|---|---|
| C-1 | EXTERNAL BLOCKER | 1 | M1 against the purge rule. A lawyer reviews a release rule. The owner chooses an option. |
| C-2 | DEFERRED | 2 | The hold-start choice, deferred with item 2 (owner instruction 1, 2026-10-31). The premise is corrected (§5C): a scheduler exists for the purge, not for held-job timeouts. |
| C-3 | RECOMMENDED | 1 | Two separate questions. The decision: accept held files as an interim (kept until M1 exists), or hold enforcement back. The requirement: holding enforcement back makes M1 a prerequisite of enabling, with item 2 and, where paid orders are affected, item 10 (§15.3). The 7F build needs only C-3 decided. |
| C-4 | RECOMMENDED | 3 | Stacking. Applies only once the paid path is approved. |
| C-5 | RECOMMENDED | 4 | Exclude `paid_verified` and `licence_payments` from 0011. |
| C-6 | EXTERNAL BLOCKER | 5 | Admin accounts, MFA and the Auth UUID are unanswered. 7A cannot finish without the UUID and the MFA status. |
| C-7 | RECOMMENDED | 7 | The owner confirms that a lifetime revocation leaves a valid paid period in force (M6). |
| C-8 | RECOMMENDED | 8 | The owner confirms that revocation does not cancel future coverage. |
| C-9 | DECIDED | 13 | "No new customer orders" is superseded by A and B. The superseded passages are annotated in §9 item 7 and §12A.10. |
| C-10 | DEFERRED | 9 | Owner confirmed 2026-10-31: trials are deferred out of Stage 7, not permanently removed. Trial terms are not approved. |
| C-11 | EXTERNAL BLOCKER | 10 | The refund policy needs a lawyer. |
| C-12 | RECOMMENDED | 15 | The owner accepts count-only records above the cap. |
| C-13 | EXTERNAL BLOCKER | 4 | The paid path and pricing are blocked. This is expected under M5. |
| C-14 | EXTERNAL BLOCKER | 11 | Enabling enforcement needs N and the existing-shop policy. |
| C-15 | EXTERNAL BLOCKER | 5 | Admin login relies on Supabase Auth, and therefore on the MFA answer. |

### 14.4 Security findings S-1 to S-8 (§12B.9)

| ID | Status | Item | Note |
|---|---|---|---|
| S-1 | IMPLEMENTATION GATE | 35 | Staging test that `anon` cannot call internal helpers (R9). |
| S-2 | IMPLEMENTATION GATE | 35 | Staging inspection of default grants on new public tables (R17). |
| S-3 | IMPLEMENTATION GATE | 35 | Staging test of the `aal` claim (R16). Depends on item 5. |
| S-4 | RECOMMENDED | 35 | The owner accepts the residual 180-second file-link window, or it is reduced before 7F. |
| S-5 | IMPLEMENTATION GATE | 35 | Static finding (`agent/src/worker.mjs` lines 258–264). A local runtime test is needed before 7F. |
| S-6 | EXTERNAL BLOCKER | 35 | User IDs in ledgers. Retention needs the lawyer (item 15). |
| S-7 | IMPLEMENTATION GATE | 23 | The duplicate-print defect. |
| S-8 | IMPLEMENTATION GATE | 24 | The refund-without-claim-stop defect. |

### 14.5 Milestones M1 to M8 (§12B.2)

| ID | Status | Item | Note |
|---|---|---|---|
| M1 | IMPLEMENTATION GATE | 1, 2 | A proposal, not approved for implementation. Items 1 and 2 come first, then review and tests (§12B.6). |
| M2 | DECIDED | none | Revocation is refused after the natural end. |
| M3 | DECIDED | 15 | Design approved and not implemented. The build is gate 7C. |
| M4 | DECIDED | 7, 16 | Custom-grant convention approved. Paid term approved and blocked by M5. |
| M5 | DECIDED | 4 | The paid-path block is approved as a blocking condition. |
| M6 | DECIDED | 7 | Lifetime over paid coverage, approved as policy. Its tests need the paid path. |
| M7 | DECIDED | 23, 24 | The review requirement for both fixes is approved. No fix is implemented. |
| M8 | EXTERNAL BLOCKER | 15 | Policy proposal approved. Legal review is needed before the periods are fixed. |

### 14.6 Decisions 1 to 20 (§9, §12A.13, §12B.3)

| Decision | Topic | Status | Item | Note |
|---|---|---|---|---|
| 1 | Licence unit (per shop) | RECOMMENDED | 16 | Owner confirms. |
| 2 | Term and renewal | RECOMMENDED | 16 | The 12-month term is approved as policy (M4). The renewal rule is recommended. |
| 3 | Price (Option B proposal) | EXTERNAL BLOCKER | 4 | No price is approved. First, the CA's tax answer (item 18) and the owner's collection-channel answer (item 4). Then the owner chooses the price and minimum. |
| 4 | GST route | EXTERNAL BLOCKER | 18 | CA. |
| 5 | Trial | DEFERRED | 9 | Deferred out of Stage 7, not removed (owner instruction 4, 2026-10-31). Trial terms are not approved. Reopening trigger: a new owner decision on product and pricing terms. |
| 6 | Refunds | EXTERNAL BLOCKER | 10 | Lawyer, then owner. |
| 7 | Expiry behaviour | RECOMMENDED | 13 | A, B and C are approved. The deletion-schedule question is open under item 1. |
| 8 | Existing shops and free period | EXTERNAL BLOCKER | 11 | The production owner counts N. The lawyer reviews notice. |
| 9 | Processor | DEFERRED | 17 | Gateway deferred. The collection-channel answer (item 4) comes before pricing; integration does not. Reopening trigger: a new owner decision to reopen decision 9. |
| 10 | Stage 6 merge order | RECOMMENDED | 20 | Owner decides. |
| 11 | Advisers | RECOMMENDED | 19 | Owner engages. |
| 12 | Premium features | DEFERRED | 21 | None built. Reopening trigger: a feature list and build plan (item 21). |
| 13 | Admin accounts (one owner account) | RECOMMENDED | 5 | Owner confirms. The UUID is EXTERNAL (item 5). |
| 14 | MFA (`aal2`) | EXTERNAL BLOCKER | 5 | The production owner records the MFA status. |
| 15 | Admin UI hosting | RECOMMENDED | 6 | Owner confirms a separate private deployment. |
| 16 | Grant limits | RECOMMENDED | 7 | Duration, backdating and lifetime rules are 7C validation. The maximum custom length is DEFERRED until the owner sets it, and is not a 7B schema prerequisite. |
| 17 | Standalone revocation of paid periods | DEFERRED | 8 | Deferred with the paid path (M5). Reversal (H) and refusal after the natural end (M2) are approved. Reopening trigger: the paid path is approved (M5). |
| 18 | Expiry and grace (no grace) | RECOMMENDED | 13 | Owner confirms. Printing is blocked in every non-ACTIVE state. |
| 19 | Shop-facing view | RECOMMENDED | 13 | The owner-only fields are approved (§12B.2 D). Open: the labels, including whether an admin grant may show a label; and staff visibility (§12B.3). The Android view is DEFERRED. Reopening trigger: a new owner decision to show the licence view in the Android app. |
| 20 | Manual payments and audit | EXTERNAL BLOCKER | 14 | CA for invoices; lawyer for audit personal data and retention. |

### 14.7 Findings R1 to R19 (§12B.5), grouped by status

| Status | IDs | Note |
|---|---|---|
| IMPLEMENTATION GATE | R1, R2, R3, R4, R5, R6, R9, R10, R11, R12, R14, R15, R16, R17, R18, R19 | Design resolved and not tested, or blocked by L (R15). Each needs a staging test as §12B.5 says. R5 retention depends on item 15. R18 is item 33. |
| DEFERRED | R7, R8 | Both belong to the paid path (M5). R7 applies only if `licence_payments` is approved. |
| EXTERNAL BLOCKER | R13 | No price rule exists. Blocked by I (item 4). |
| DECIDED | none | No R item has an approval of its own. |

---

## 15. Roadmap and gates (added 2026-10-30; rebuilt 2026-10-31)

Planning approval, if the owner gives it, approves the direction of this file only. It approves no gate, setup, migration, test, deployment, live change or production access. Each gate needs its own approval naming its exact scope. No gate is automatically approved by planning approval.

### 15.1 What each category needs

| Category | Items and IDs (§14) | Who acts | Can start now? |
|---|---|---|---|
| Owner confirmation (RECOMMENDED) | Items 3, 6, 7, 8, 12, 13, 16, 19, 20; C-3, C-4, C-5, C-7, C-8, C-12; S-4; decisions 1, 2, 7, 10, 11, 13, 15, 16, 18, 19 | Owner, by written answer | Yes. An answer records a decision and approves no gate |
| Professional advice (EXTERNAL BLOCKER) | Items 1, 4, 10, 14, 15, 18, 28, 29, 30, and the M8 and S-6 parts of 35; C-1, C-11, C-13; decisions 3, 4, 6, 20; the engagement in item 19 | CA or lawyer | No. No engagement is evidenced |
| Production-owner verification (read-only unless stated) | Items 5, 25, 27, 31, 34 (closure checks); item 11 (before enforcement activation); item 26 (before a production migration); the item 6 visibility check; C-6, C-14, C-15; decisions 8, 14 | Production owner | Only on the owner's separate request. Read-only. Any change is the owner's decision |
| Local or staging setup (separate approval each) | Gate 1 (local setup, Docker, CLI, containers, `supabase init`); staging tests for items 15 (growth), 25 and 33; the R and S tests in §14.4 and §14.7; the item 23 targeted local tests (only after diff review) and staging tests (separate explicit approval); the item 24 tests (after diff review); the M1 tests | Owner approves; engineering runs | No |
| Separate implementation approval (IMPLEMENTATION GATE) | Items 23, 24, 32, 33 (code); gates 7B to 7F; M1 (after items 1 and 2); the held-job marker or scheduler, once item 2 is reopened; the paid path (item 4 and M5); the gateway (item 17); the Android view (item 13); retiring the three-argument `place_order` (item 25); publishing privacy text and terms (item 29) | Owner, per gate | No |
| Deferred (no action until reopened) | Items 2, 9, 17, 21, 22; the deletion of test rows (item 34); the maximum custom length (item 7); standalone paid revocation (item 8); the Android view (item 13); the capacity change (item 27); configuration versioning (item 31); decisions 5, 9, 12, 17; C-2; C-10 | Owner, when reopened | No |
| Outside Stage 7 | §15.4 | None | Not applicable |

Item 4's owner parts (collection channel, price and minimum) follow the CA's tax answer, as set out in the dependency note under §14.2. Until then they are not owner-confirmation items. Decision 3 and item 4 stay in the professional-advice row.

**Which answers gate which step (C-1, C-3, C-6, item 2).** This table is the authority. The gate rows in §15.3 and the §16 Q6 answer agree with it.

| Answer | Needed for | Not needed for | How it closes |
|---|---|---|---|
| C-6 (item 5): admin Auth user UUID, MFA status and admin accounts (decisions 13 to 15) | 7A; the bootstrap row; 7C and 7D | 7B schema design and the 7B staging run (the migration holds no UUID) | §16.1(c), production-owner checks |
| C-1 (item 1): lawyer's review of the held-file release rule | Before the owner's C-3 decision, so before the 7F build. Also M1 implementation. Enabling needs it through C-3 | 7A to 7E; 7B | §16.1(e) |
| C-3 (item 1): owner chooses held files accepted as an interim, or enforcement held back | 7F build (C-3 decided); 7F enabling. Holding back also makes M1 and item 2 (reopened) prerequisites of enabling | 7A to 7E; 7B | §16.1(e) |
| Item 2 (C-2): hold start and scheduler (DEFERRED, owner instruction 1) | M1. Enabling only if C-3 holds enforcement back | 7A to 7F build; Stage 7 closure | Reopens when C-3 holds enforcement back, or M1 is put forward for build (§14.2 item 2) |

### 15.2 Staging options (for setup approval only)

- **Option A: local Supabase stack.** Needs Docker, the Supabase CLI and containers, each of which needs approval. `supabase init` would create `supabase/config.toml` (item 31).
- **Option B: separate staging Supabase project.** Needs its own project and an owner decision. Nothing from production is supplied to it.
- Neither option may touch the live project. A test account needs explicit approval. A synthetic Auth fixture needs decision L and the R15 column check. A localhost hostname does not prove a test database (`CLAUDE.md`).

### 15.3 Gates 7A to 7F

| Gate | Scope | Prerequisites | Approval needed | Tests (§12A.11, §12B.11) | Rollback |
|---|---|---|---|---|---|
| 7A Owner inputs | Decisions 13 to 16 and 18 to 19; owner confirmations for items 6, 7, 8, 13, 16; the production-owner UUID and MFA answers (item 5) | Owner's written answers; production-owner checks | The owner's written answers | None. No code | None needed |
| 7B Schema, migration 0011 (staging only) | Licence tables, triggers, RLS deny-all, `is_platform_admin()`, `shop_licence_state()`, `licence_lock_shop()`, `shop_licence_meta`. Paid tables excluded if C-5 is confirmed | Gate 1 or staging setup, with 0010 applied to the staging copy under its own approval; the owner inputs listed below the gate table (C-5, item 8, item 16, and the basis ranking in item 7). For tests only: the R15 fixture approach (decision L) and the R17 default-privilege check. Item 26's live list is needed before any production migration, not for staging | Separate approval to create the migration, and a separate approval for each staging run | State, trigger, privilege and regression tests | Drop the 0011 objects on staging. No production rollback plan exists (item 32) |
| 7C Admin RPCs and owner read RPC | Grant, extend, revoke (M2), replace; denial logging (M3); idempotency (R5); owner read (decision D) | 7B on staging; the lock map confirmed by a two-session test (item 33); the global denial ceiling accepted (item 15); the count-only limitation accepted (C-12); item 5; the decision 16 validation inputs (duration, backdating, lifetime owner-only, and maximum custom length, which may be "none", item 7) | Separate approval | Admin, privilege, concurrency and denial-cap tests | Revoke `EXECUTE` on the admin RPCs (needs a migration). This rollback changes no coverage row (§15.5) |
| 7D Admin UI, separate private deployment | Login, shop search, grant, extend, revoke, replace with confirmation, audit view; MFA enrolment if decision 14 requires it | 7C on staging; the hosting decision (item 6); the visibility check (item 6); item 5 | Separate approval | Browser smoke test on staging; static scan that no service key is in the bundle | Take the deployment down. No database change, and no coverage row changes (§15.5) |
| 7E Owner read-only status, web | Fields as in decision D; labels (item 13); display rule (item 8) | 7C; the label decision (item 13); the display rule (item 8) | Separate approval | Enforcement off returns no fields; enforcement on returns only the D fields; staff denied | Remove the owner status UI. Revoke `EXECUTE` on `shop_licence_status` only if the read RPC must be withdrawn (needs a migration). The rollback changes no coverage row and grants or revokes no licence (§15.5) |
| 7F Enforcement, printing only | Gates on approve, retry, claim and `mark_printing` (decisions A, B, C) | 7C and 7E; S-4 accepted (item 35); item 33 lock tests; item 25 tests of both signatures; item 32 kill switch approved; item 1 for the build (C-1 answered, C-3 decided). Before enabling only: item 11 (existing-shop policy); M1 and item 2 (reopened), if C-3 holds enforcement back. Ordering of items 23 and 24 against this build is an owner decision; neither is a prerequisite by default | Separate approval to build, and a separate approval to enable | Printing and checkout tests (§12B.11) | A designed kill switch is needed (item 32). None exists yet |

**Owner inputs needed before the 7B schema can be designed.** Four inputs, and no others:

1. C-5: exclude `paid_verified` and `licence_payments` from 0011 (owner confirmation, RECOMMENDED). `trial` is also excluded (C-10, deferred).
2. Item 8: C-8 (revoking current coverage does not cancel future coverage), the same-instant tie-break (fix 5) and the exclusive-end display (fix 9). The state function and the revocation trigger depend on them.
3. Item 16: the licence unit (per shop, recommended). It sets the `shop_id` model. The term does not change the schema.
4. Item 7: the basis ranking of a lifetime grant over an admin grant (§12A.6). M6 covers paid coverage only.

**Not needed for the 7B design:** the maximum custom length, backdating, the durations and lifetime owner-only (7C validation, decision 16); C-7 and the other paid-path items (paid path only); items 1 and 2 (M1 only); item 5 (the admin UUID is inserted by a one-time owner-run row, and the migration must not contain it); decision 13 (the table holds any number of admin rows) and decision 14 (`aal2` is checked in the 7C RPCs); item 26 (its live list is needed before any production migration, not for staging). The R15 fixture approach and the R17 privilege check are needed for 7B tests, not for the design.

**Separate gates (none authorised):**

| Gate | Scope | Prerequisites | Approval | Tests |
|---|---|---|---|---|
| M1 held-job rule | 7-day failure for licence holds | Item 1 decided (C-1 answered, C-3 decided); item 2 reopened and the hold start chosen (a or b); item 10 (effect on paid orders); a file-release rule under C-1; a hold-start marker or scheduler, separately approved | Separate review, then implementation approval | §12B.11 held-job tests |
| Held-job marker or scheduler (item 2) | A stored marker when the shop leaves ACTIVE; any scheduled timeout job | Item 2 reopened (§14.2); the owner's hold-start choice; C-2 | Separate | Staging tests of the hold start |
| Duplicate-print fix (item 23) | Body of `retry_print_job` only | Diff review (M7) first. Targeted local tests only after that review. Staging tests need separate explicit approval | Separate approval for local tests; separate approval for staging and for implementation | A `sent` sibling is refused; the latest-attempt rule holds; failed and confirmed `needs_check` jobs stay retryable; existing printing tests unchanged |
| Refund-and-claim fix (item 24) | Option R-a, R-b or R-c | Diff review, then the owner's choice | Separate | A refunded or ineligible order's files are not claimed |
| Purge capacity change (item 27) | `cleanup-files` cap or loop | Growth beyond about 3,000 shops; owner priority; the production-owner deployment check | Separate | Staging load test |
| Retire the three-argument `place_order` (item 25) | Checkout change | Live check (item 25) | Separate checkout approval | Checkout tests under both signatures |
| Paid path (item 4, M5) | `paid_verified`, `licence_payments`, record, verify, reverse | The owner's pricing and channel answers (item 4, after item 18); items 3 (C-4), 7 (C-7), 10, 14, 16 and 18; item 17 only if a named processor is chosen; CA and lawyer advice; M5 approval | Separate | §12A.11 paid tests; F, H, J, M4 stacking and M6 |
| Gateway (item 17) | Processor integration | The owner's decision to reopen decision 9; processor eligibility evidence; CA advice | Separate | Later |

### 15.4 Explicitly outside Stage 7

- Stage 8 scope. This document does not define it. The README's Stage 8 wording (lines 23 and 467–470) is not adopted here. Stage 8 is blocked until the criteria in §16.1 are met.
- Gateway integration, and any Stripe or Razorpay call or key (later stage; §12A.12).
- Android licence payments and the Android licence view (items 13 and 28).
- Fixes to the printing defects (items 23 and 24), which have their own gates.
- Changes to the README, `CLAUDE.md` or any file other than this document.
- Live settings, production data (including deleting the test rows, item 34), deployments and APK builds.
- Tax registration, GST filing, invoicing and legal drafting (professional advice).
- Publication of prices (I) and of any terms.

### 15.5 Rules for every gate

- Each gate needs its own written approval, naming the exact files, environment and tests.
- Setup, staging, production and deployment permissions are separate. Approval for one gives no other.
- Test results are recorded in this file before a gate closes.
- A UI or RPC rollback changes no coverage row. An entitlement change (grant, extend, revoke, replace or reversal) is a licence action with its own approval, reason and audit row. It is never part of a gate rollback. This applies to 7C, 7D and 7E.

---

## 16. Exit checklist, closure criteria and verdict (added 2026-10-30; rebuilt 2026-10-31)

Answers are as of 2026-10-31. "NO" means the question is not yet satisfied.

| # | Question | Answer | Evidence and what is missing |
|---|---|---|---|
| 1 | Is the document ready for owner review? | YES | Corrections in §13 are applied. Repository claims are re-checked with line numbers. Each numbered item, group, and open ID has one status in §14. |
| 2 | Is the document ready for planning approval? | NO | The owner's answers to the RECOMMENDED items (§15.1) are not given. The production-owner checks for items 5, 25, 27, 31 and 34 are not made. |
| 3 | Is every open ID given one status? | YES | Items 1 to 35, groups A to E, decisions A to L and 1 to 20, M1 to M8, C-1 to C-15, S-1 to S-8 and R1 to R19 are each in §14. |
| 4 | Are external blockers identified with their outside party? | YES | The 17 EXTERNAL BLOCKER items in §14.2 name the party. The answers are not in the repository. |
| 5 | Are factual claims supported by repository evidence? | PARTLY | Repository facts are re-checked with line numbers (§2, §4, §5C, §12A.2, §12B.4 to §12B.9). Live state, README statements and external sources are labelled and not verified. |
| 6 | Is the implementation scope frozen? | NO | 7B waits on C-5, items 8 and 16, the basis-ranking confirmation under item 7, and a staging copy with 0010 applied. Item 26 is needed only before a production migration. 7F build waits on 7C and 7E, on item 1 (C-1 answered, C-3 decided), and on items 25, 32, 33 and S-4. Before enabling only: item 11, and M1 and item 2 if C-3 holds enforcement back. |
| 7 | Are setup, staging, production and deployment permissions still separate? | YES | §15.2, §15.3 and §15.5. No approval exists for any of them. The main checkout and `stash@{0}` are untouched. |
| 8 | Are the Stage 7 closure criteria met? | NO | See §16.1. |

### 16.1 Stage 7 closure criteria (RECOMMENDED; owner to confirm)

a. The owner's written planning approval of this file, with the RECOMMENDED items answered and the EXTERNAL BLOCKER items answered or formally deferred.
b. Every numbered item in §14.2 is DECIDED or DEFERRED, or its outside input has been received, or its gate is approved and run.
c. The production-owner checks are recorded: items 5, 25, 27, 31 and 34. For the admin stages, also the item 6 visibility and plan check. Item 11 is not a closure check: it is required before enforcement activation. Item 26 is not a closure check: it is required before the relevant production migration (owner instruction 3, 2026-10-31).
d. Each gate that is run has its test results recorded in this file and accepted by the owner.
e. Items 1, 23 and 24 are closed. Item 1 closes when a lawyer has answered C-1 and the owner has decided C-3. Items 23 and 24 close when each fix has passed its diff review and tests under its own approval (§15.3). Item 24 also needs the owner's choice of R-a, R-b or R-c. Item 2 is DEFERRED (owner instruction 1, 2026-10-31) and is not a Stage 7 closure requirement. If C-3 holds enforcement back, M1 and item 2 become prerequisites of enabling, not of closure. Stage 7 closure does not require enforcement to be enabled (owner instruction 2, 2026-10-31). Building and validating enforcement is separate from enabling it in production, and enabling is a separate 7F approval.

**Transition rule:** Stage 8 cannot begin until Stage 7's planning approval and criteria (a) to (e) are satisfied. This document does not define Stage 8 scope.

### 16.2 Verdict

**READY FOR FINAL OWNER REVIEW. NOT APPROVED.**

Reasons it is ready for review:
1. The corrections in §13 are applied. Closure corrections 1 to 11 are answered in §13. Closure correction 9 was checked against `web/src/owner.js`: the resend call sites are lines 259 and 358. Lines 327 and 345 are the button and the countdown text, not call sites.
2. Each numbered item 1 to 35, and each group A to E, has exactly one status in §14.
3. Each open item names its owner, outside party or evidence (§14, §15).

Reasons it is not ready for planning approval:
1. The owner's answers to the RECOMMENDED items in §15.1 have not been given.
2. The production-owner checks (items 5, 25, 27, 31 and 34) have not been made, so the facts they would settle remain unverified.
3. Items 1, 23, 24 and 33 remain open. Item 1 needs lawyer review. Items 23, 24 and 33 need diff review first. Staging tests for them need a separate approval.

---

**Figures still provisional:** the 10,000-shop net and Resend tier cost (§5A, §8); the email tier E (§5A, undecided); the 100-shop result (Free or Pro depending on E); the grandfathering illustrations, which depend on N (not provided), on E, and on the accrual or cash basis (§5B); hosting cost (§4); database overage (§5C); FX rate (§6 item 10); retention cost (§5C).
