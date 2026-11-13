# Stage 7 decisions: draft for owner review

**Status:** DRAFT PROPOSAL. This file is not an approval of any business, legal, tax, pricing, or technical decision.
**Date:** 2026-11-02 (last updated: O1–O13 owner decisions and consistency pass; 2026-11-04: ten owner decisions, §13 record, with §12B.13, §12C and §12D added). Earlier passes: final documentation pass 2026-10-30, register and checks 2026-10-31, consistency correction 2026-10-31, four-issue resolution 2026-10-31, owner decisions and correction pass 2026-10-31: corrections are in §13, the decision register in §14, the roadmap in §15 and the exit checklist and verdict in §16. Corrected 2026-10-29 after the read-only audit and a targeted correction pass. Corrections are listed in §13. Admin-grant and manual licence design added 2026-10-29 (§12A). Stage 7 decision record (A–L, M1–M8), state-machine corrections, and R1–R19 findings added 2026-10-29 (§12B). Where §12A and §12B differ, §12B governs.
**Worktree:** `/home/claude/joyyxh/ps-qr-stage7`, branch `stage7-payments`, base `origin/main` at `717717b`
**Committed:** The file is tracked on `stage7-payments` (latest commit `2f1f9c3`). The 2026-11-02 O1–O13 edits are uncommitted and need a separate commit instruction. The 2026-11-04 edits are also uncommitted and are not committed or pushed.

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

1. **Licence unit. DECIDED (decision 1, owner decision 2026-10-31).** QRquick licences are issued per shop. Each individual shop requires its own licence. A single owner account may manage multiple shops, but licensing one shop does not automatically license the others. Changing the printer computer does not change the licence. Options not chosen: per owner; per printer computer.
2. **Term.** The 12-month paid term is approved as policy (M4). The paid path stays blocked (M5). Renewal: DEFERRED (owner decision 7, 2026-11-01). It does not block 7B and reopens with the paid path (M5). Proposal: the owner pays again each year, with no automatic renewal. Options: yearly manual renewal; one-time (not recommended, since recurring costs need recurring income). Stacking of an early payment: C-4 (§12B.9). See §14, items 3 and 16.
3. **Price.** Proposal: Option B, ₹1,499 incl. GST, as the starting point. Options: A (₹499 pilot); C (₹2,999); other. **PENDING OWNER APPROVAL.**
4. **GST route.** No option chosen. Options: (a) stay unregistered and charge no GST, only if a CA confirms the exemption applies; (b) register and charge GST on an inclusive price. Input credit: whether a registered shop can claim input credit on the licence depends on QRquick issuing valid GST invoices. This claim is **unsourced** in this draft. Whether QRquick can claim input credit on its own costs, and the reverse-charge treatment of foreign services, are **not modelled**. **PENDING OWNER APPROVAL. CA review required.**
5. **Trial.** **DEFERRED out of Stage 7, not permanently removed** (§14.6 decision 5; C-10; owner instruction 4, 2026-10-31). Proposal, not approved: 30 days, no card, one per owner account. Options: none; 14 days. **Trial terms are not approved.** A trial delays first payment and is not modelled as lost revenue (§5B). Reopening needs a new owner decision on product and pricing terms.
6. **Refunds.** Proposal: full refund within 7 days. After that, only for duplicate charges or a QRquick outage. QRquick absorbs the processor fee: ₹35.38 per year on a ₹1,499 card payment at 2.36%, or ₹29.98 at the derived 2.00%. Each Stripe dispute costs ₹1,000 (§3, Stripe pricing row). That is Stripe's dispute fee. Pausing the licence during a dispute does not itself cost ₹1,000. **PENDING OWNER APPROVAL. Lawyer review required.**
7. **Expiry behaviour.** *Partly superseded 2026-10-29 (§12B): decision A (printing only, no order blocking), B (queued jobs held), C (no retries while inactive).* Original proposal: no new customer orders. In-flight paid orders finish. The print agent claims no new jobs. Owners keep read and CSV export. **Licence expiry does not itself delete data.** Order files follow the two retention rules in §5C. Unclaimed files expire one day after upload. Claimed files are removed 30 days after the order is completed, cancelled or rejected, subject to the purge exclusions. The purge code is in the repository. Its live deployment is **unverified** (§5C). Whether licence expiry should also change the deletion schedule is a separate decision. Status: RECOMMENDED (§14.6 decision 7). The deletion-schedule question is open under item 1 (§14.2).
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
13. **Admin MFA and admin UI hosting:** the `aal2` requirement for admin RPCs is APPROVED on 2026-11-02 (§13, item 1). The owner still confirms MFA status on the Supabase account, and chooses hosting (§12A, decision 15). **Hosting: PENDING OWNER APPROVAL.**

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

- DRAFT. Not approved as a whole. Tracked on `stage7-payments`; the 2026-11-02 O1–O13 edits are uncommitted.
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
- 2026-11-02: commits `608265f` and `2f1f9c3` were made on explicit owner instruction (docs only). No push, merge, deployment, migration, SQL, test or database action has been taken.
- **Ready for final owner review. Not approved.** §16 gives the verdict and its reasons.

---

## 12A. Manual licence management and admin-granted access (design, added 2026-10-29)

**Status: DESIGN ONLY. Nothing is implemented.** No migration, Edge Function, admin UI, shop-app screen, or licence enforcement exists or is approved. Decisions in this section are **PENDING OWNER APPROVAL** unless §12B.2, §12B.3 or the 2026-11-02 records in §13 record a status. No licence state below is approved policy, except as recorded in §12B. Next free migration number on the origin/main line: 0011 (CLAUDE.md; owner decision 1, 2026-11-01). Local main's 0011 is a different, unmerged file (owner decision 2). **Update 2026-10-29:** the decisions in §12B supersede conflicting text in this section. Corrections are marked *Corrected 2026-10-29*. Decision status is in §12B.3.

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
- Break-glass: a documented dashboard SQL statement sets `disabled_at` on an admin row. Not automated. Under O6 and O7 (2026-11-02), an emergency disable and recovery procedure is required before 7C implementation sign-off, and the break-glass DB-owner procedure needs separate owner approval before 7C implementation sign-off. Neither procedure is written in this file. *A3 (2026-11-04):* the written procedure is required before 7C implementation sign-off. It is not required before implementation starts.
- **Needed from the owner:** the Auth user UUID, or confirmation that a dedicated admin user will be created; whether a second admin is wanted (decision 13); whether MFA is enabled on the Supabase account and the admin user (decision 14).

### 12A.4 Architecture

- **Database:** new licence tables with RLS deny-all for client roles. All writes go through `SECURITY DEFINER` RPCs. Each RPC first checks `is_platform_admin()`, and requires `auth.jwt()->>'aal' = 'aal2'` (decision 14, approved 2026-11-02). *AAL2 failure handling decided 2026-11-04: a failed check is an authorisation failure (§12A.8, AAL2 failure bullet).* Each RPC writes its audit row in the same transaction. *Clarified 2026-11-04:* this requirement applies to successful operations. An authorisation-denied request, including a failed AAL2 check, is exempt: it writes to `licence_denials` and the denial counter (`licence_denial_windows`), not to `licence_audit_log` (§12A.8, A4 and AAL2 failure bullets). `EXECUTE` is revoked from `public`, `anon`, `authenticated`, and `service_role` on internal helpers. Migration 0011 also revokes all table privileges from the same four roles. Owner decision 10 (2026-11-01): `service_role` stays revoked, which differs from 0010 by design (§13). Admin RPCs are granted to `authenticated` only, and each checks admin status and aal2 itself. *Corrected 2026-10-29 (R9, §12B.5).*
- **Why RPCs rather than an Edge Function with the service key:** the check, the write, and the audit happen in one transaction, and no service key is needed. This matches the existing RPC pattern (`set_order_payment`, `set_shop_features`). An Edge Function stays an option if a later stage needs one.
- **Admin UI:** a separate private app (hosting, decision 15). It holds the publishable key and the admin's session only. It calls admin RPCs and nothing else. The shop app has no link to it.
- **Shop read:** `shop_licence_status(p_shop_id)` returns only: active or inactive; the access end date and time in Asia/Kolkata, or no-expiry; and the next start date when relevant (the next start is shown only in SCHEDULED, owner decision 8; §12A.6). *Decision D, §12B.* Owner only, through `is_shop_owner()`. Staff receive nothing. It never returns basis, reasons, actor IDs, payment references, notes, audit rows, or coverage IDs. *A5 (2026-11-04):* staff receive no licence information, and this RPC returns only the D fields. Presentation labels belong to 7E.
- **No service-role key** appears in `web/`, `mobile/`, the admin UI, or any committed file.

### 12A.5 Proposed data model

- **`platform_admins`:** as in §12A.3.
- **`licence_coverages`:** append-only records of access. Columns: `id`, `shop_id`, `kind` (`admin_grant` | `lifetime_grant` in Stage 7B; `paid_verified` and `trial` deferred, §12B.2 M5 and §12B.9 C-10), `starts_at`, `ends_at` (null only for `lifetime_grant`), `revoked_at` (null until revoked), `revoked_by`, `revoke_reason`, `reason` (required), `created_by`, `created_at`, `request_id` (unique). *Corrected 2026-10-29 (R7):* `shop_id` on this table and on `licence_payments` is enforced by a composite foreign key to the payment, so a coverage's shop must match its payment's shop. This key applies only when `licence_payments` is approved (M5). Stage 7B has no payment table to reference. *Clarified 2026-11-06:* the column list above matches `0011_licence_foundation.sql`, which has no `payment_id` column on `licence_coverages`. A payment link is deferred with `paid_verified` (M5).
  - Checks: `ends_at > starts_at`; `lifetime_grant` has no `ends_at`; every other kind has one. *Corrected 2026-10-29 (fix 1):* the earlier check `revoked_at >= starts_at` is replaced by a trigger rule: `revoked_at >= created_at` and `revoked_at <= clock_timestamp()` at write time. A cancelled future period is therefore stored with `revoked_at` = now.
  - Trigger: the only permitted update sets `revoked_at`, `revoked_by`, and `revoke_reason`, once, from null. *Corrected 2026-10-29 (R6):* the trigger compares `to_jsonb(new)` and `to_jsonb(old)` with those three keys removed, rather than listing columns. Deletes and TRUNCATE are blocked. *UNVERIFIED until staging.*
- **`licence_payments`:** **deferred (M5, §12B.2).** Not built until pricing, minimum amount, tax treatment, and the payment-recording policy are approved. Proposed columns, for later review: `id`, `shop_id`, `amount_paise` (greater than 0), `currency` (INR only), `method` (`upi_direct` | `bank_transfer` | `cash` | `cheque` | `other`), `external_reference` (required except for `cash`), `received_on`, `status` (`recorded` | `verified` | `reversed`), `recorded_by`, `recorded_at`, `verified_by`, `verified_at`, `reversed_by`, `reversed_at`, `reversal_reason`, `note` (internal).
  - Unique index on (`method`, `external_reference`) where the reference is present, so one bank or UPI transaction cannot be verified twice.
  - Records are never deleted. Corrections are made by reversal.
  - No foreign key to `orders`, `order_items`, or any customer payment table.
- **`licence_audit_log`:** append-only (§12A.9).
- **`shop_licence_meta`:** one row per shop holding `state_version`. *Corrected 2026-10-29 (R1, R2):* the row is created lazily through `licence_lock_shop` (no trigger on `shops`). The version is incremented once per committed successful admin operation, inside the RPC, not by triggers (B2-2, approved 2026-11-05). The 0011 guard requires each update to add exactly 1. Denials, rejected requests, replays and reads do not increment it. Admin RPCs take `expected_state_version` and reject stale requests.
- **`shop_licence_state(shop_id, at)`:** a deterministic SQL function that derives state from the coverage rows (§12A.6). Internal only: no client role is granted EXECUTE (R9, R10).
- **`licence_lock_shop(p_shop_id uuid, p_mode text)`, returns `bigint`:** internal helper. `p_mode` is `'exclusive'` (admin writes) or `'shared'` (print gates, 7F). Creates the `shop_licence_meta` row if it is missing and takes the shop lock. No client role is granted EXECUTE (R1, R9). *Corrected 2026-11-06:* the signature previously omitted `p_mode`. `0011` lines 546–548 define both arguments.
- **`licence_requests`:** replay ledger for committed successful admin operations only (R5, B1-1 and B2-1, approved 2026-11-05). Placement approved (decision 3; O2). Added to `0011_licence_foundation.sql` on 2026-11-05 (unapplied, untested). Columns: `request_id` (primary key), `action` (grant, extend, revoke, replace), `shop_id`, `payload_hash` (SHA-256 of the server-computed canonical encoding defined in §12A.17 A, which includes the caller UID and `shop_id`; legal review of identity-derived hashes is OPEN), `target_coverage_id` (required for revoke and replace, forbidden for grant and extend), `state_version_after`, `created_at`. There is no `coverage_id` and no actor column. The created coverage is found through `licence_coverages.request_id`. Replay response: action, created coverage ID where applicable, target coverage ID where applicable, and `state_version_after`. Retention OPEN (§12B.8).
- **`licence_denials`:** denial log (M3, §12B.7). Placement approved (decision 3; O2). Added to `0011_licence_foundation.sql` on 2026-11-05 (unapplied, untested). Stores the actor UUID as a plain `uuid` with no foreign key to `auth.users` (bundle 2), function name, internal denial reason, request ID if supplied, and time. The public response is always `forbidden`. A detailed row is written only while the caps allow: 20 per actor per UTC hour (spec), and a provisional global ceiling of 1,000 detail records per UTC hour (set 2026-11-06 as a staging and initial engineering default, not a production decision; the production value is OPEN). Omitted details are derived in `licence_denial_windows`, not stored here. No delete path until a retention decision (bundle 2). The 90-day retention period (M8) is a proposal subject to legal review. It is not an approved period.
- **`licence_denial_windows`:** counter table for licence denials, replacing the `consume_rate_limit` design (O1, approved 2026-11-02). One row per actor per UTC hour (`scope` = actor) and one global row per UTC hour (`scope` = global). Columns: `denial_count` (every authorisation denial) and `detail_count` (detail rows actually written). Both only rise, and `0 <= detail_count <= denial_count`. Omitted details = `denial_count − detail_count`, derived and not stored (bundle 3, 2026-11-05). Lock order: actor row, then global row, both before any shop meta lock. Added to `0011_licence_foundation.sql` on 2026-11-05 (unapplied, untested). Pre-staging review of 0011 (O2) is still required before any staging run. Retention is not decided (§12B.8). The global detail ceiling is provisional at 1,000 per UTC hour (2026-11-06); the production value is OPEN. `0011` lines 345–392 refuse DELETE and TRUNCATE, fix the identity columns and stop both counts from decreasing.

### 12A.6 Access states and precedence

A coverage record `c` is effective at time `t` if `c.starts_at <= t`, `t < c.ends_at` (or it has no end, for lifetime), and `t < c.revoked_at` (if revoked). Intervals are half-open: at exactly `ends_at` or `revoked_at`, the coverage is no longer effective. Owner-facing reads evaluate `t` at the current time only; historical state queries are not supported (owner decision 11, 2026-11-01). History comes from `licence_audit_log`.

**Access** is granted if any coverage is effective at `t`. Overlaps do not add time.

*O4 (approved with condition, 2026-11-02).* Overlapping grants and duplicate non-revoked lifetime grants are rejected. The half-open overlap test: coverages `[a1, b1)` and `[a2, b2)` overlap if and only if `a1 < b2` and `a2 < b1`. The rule is documented here before 7C implementation sign-off and is tested only in separately approved staging. **Scope to confirm (open):** O4 is read as applying to grants of the same kind (admin with admin, lifetime with lifetime). A lifetime grant over an admin grant stays allowed, because item 7 (basis ranking, 2026-11-01) and the test in §12A.11 require it. The owner must confirm this reading before 7C implementation sign-off. *Resolved 2026-11-04 (A1); see the A1 paragraph below.*

*Decided 2026-11-04 (no. 1, option A):* O4 applies to grants of the same kind only. Overlapping admin grants are rejected. Overlapping non-revoked lifetime grants are rejected. A lifetime grant over an admin grant stays allowed (item 7 and the test in §12A.11). The 2026-11-04 decision does not address an admin grant placed over an existing lifetime grant. Under the same-kind rule that grant is allowed; the owner must confirm this reading before 7C sign-off. *Confirmed 2026-11-04 (A1): allowed.* The rule is documented here. Staging tests and 7C sign-off still apply.

**Decided 2026-11-04 (A1, owner): different-kind grants may coexist.** Admin and lifetime grants may overlap. Same-kind overlap restrictions remain: overlapping admin grants, and overlapping non-revoked lifetime grants, are rejected. Lifetime coverage takes precedence in the basis (ACTIVE rule 1 below). An admin grant placed over an existing lifetime grant is therefore allowed. The lifetime-revocation exposure paragraph below applies to that case.

**Lifetime revocation exposure (documented 2026-11-04).** Revoking a lifetime grant can expose admin coverage that was already valid. (a) Admin coverage effective at the revocation instant becomes the basis, and access continues with basis `admin_grant` (§12A.11). (b) Admin coverage that starts after the revocation instant is not changed by the revocation; while no coverage is effective, the state is SCHEDULED (item 8). (c) Admin coverage that ended before the revocation instant is not revived. (d) The revocation is one update of `revoked_at` on the lifetime coverage (§12B.5, R6). Proposed requirement for 7E review: when the basis changes to an admin grant, the owner-facing view shows that grant's end date, so the change in access is visible.

*Corrected 2026-10-29 (state-machine fixes 1–11, §12B.5).* The **state** is chosen in this order. The first match wins. Only ACTIVE grants access.

1. **ACTIVE:** an effective coverage contains `t`. **Basis** describes current access only: the highest-ranked effective kind (`lifetime_grant`, then `admin_grant`; `paid_verified` is deferred, M5). The ranking was confirmed by the owner on 2026-11-01 (item 7). `access_until` is the end of the contiguous block that contains `t` (algorithm in §12B.5). Lifetime gives no expiry. *Owner decision 8 (2026-11-01): `next_start` is shown only in SCHEDULED. In ACTIVE it is NULL (migration 0011).*
2. **SCHEDULED:** no effective coverage at `t`, and at least one valid future coverage. `next_start` is shown.
3. **REVOKED:** no effective coverage, and the latest-ending valid coverage ended by revocation. If two coverages end at the same instant and one was revoked, the state is REVOKED (fix 5 approved by the owner on 2026-11-01; §14.2 item 8).
4. **EXPIRED:** no effective coverage, and the latest-ending valid coverage ended naturally.
5. **NONE:** no valid coverage ever. NONE is not ACTIVE, so it blocks printing once enforcement is on (decisions A to C).

A coverage cancelled before its start is stored with `revoked_at` set to the cancellation time, which is before `starts_at` (fix 1). Its effective interval is empty, so it is dropped from every state. The FREE TRIAL state is not part of Stage 7 because trials are deferred, not permanently removed (§9 item 5, C-10).

*Corrected 2026-10-29:* the state decides access, not only the display.

**Operations**, each recorded as a coverage change:

- **Grant** (1 month, 1 year, custom, or lifetime): the new coverage starts now, unless an explicitly confirmed backdate is given (decision 16). A custom grant needs a start and an end, with the end after the start. *Approved convention (M4):* custom dates are entered as Asia/Kolkata calendar dates. The start is inclusive at 00:00 IST, and the end is exclusive at 00:00 IST on the entered end date. *Decided 2026-11-06 (§12A.17 B):* date-only custom starts are inclusive at 00:00 IST and date-only custom ends are exclusive at 00:00 IST. This closes the 2026-11-04 hold (A2). A custom grant is an administrative grant, not a paid transaction, and has no `payment_id`.
- **Calendar-based end (A2, decided 2026-11-04 by owner):** for 1-month and 1-year grants, the end keeps the start's clock time, computed as `((start at time zone 'Asia/Kolkata') + interval) at time zone 'Asia/Kolkata'`. Month-end dates clamp (O5). Example: a 1-month grant starting 31 January at 15:00 IST ends 28 February at 15:00 IST (29 February in a leap year). **Custom-grant boundaries: DECIDED 2026-11-06 (§12A.17 B).** The 00:00 IST rule above applies to date-only custom inputs. It does not apply to calendar-based grants with timestamps. **Extend lengths: DECIDED 2026-11-06 (§12A.17 C).**
- **Extend:** one calendar month or one calendar year only (decided 2026-11-06, §12A.17 C), with the arithmetic above. A new coverage starts at `greatest(v_now, latest non-revoked coverage end)` (O3, approved 2026-11-02), where `v_now` is the clock timestamp taken after the shop lock. Extend is rejected while lifetime coverage is active (§13, 2026-11-02 item 6). The old record's end is never edited.
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

- Every admin RPC: (a) runs `is_platform_admin()`; (b) requires a non-empty reason for grants, revocations, replacements, and reversals; (c) requires `confirm = true`; (d) requires `expected_state_version`; (e) requires a `request_id` (uuid), globally unique (§13, 2026-11-02 item 8). A repeated `request_id` with the same payload hash returns the original result without a second change. The payload hash includes the caller UID and `shop_id` (2026-11-05), and the server computes it (§12A.17 A). The same `request_id` with the same hash is a replay. The same `request_id` with a different hash is a conflict: a specific committed code, not `forbidden`, with no write (R5; §12A.17 A and J). (f) writes an audit row in the same transaction for a successful operation; a denied request is exempt and writes no audit row (§12A.4); (g) on denial, returns `{ok: false, code: 'forbidden'}` as a committed result, not a raised error, so the denial record and the denial counter (`licence_denial_windows`, O1) survive (R3). The same code is returned for every denial reason. Detailed denial records and their cap are in §12B.7 (M3). *Scope narrowed 2026-11-04 (A4):* this forbidden result covers authorisation failures only. See the A4 bullet below.
- *Response contract (A4, decided 2026-11-04 by owner):* (i) An authorisation failure returns `{ok: false, code: 'forbidden'}` as a committed result, is logged to `licence_denials`, and counts toward the authorisation-denial counter (`licence_denial_windows`). Authorisation failures include a failed `is_platform_admin()` check, a failed `aal2` check (read as 'denied' in §12A.11; confirmed 2026-11-04, see the AAL2 failure bullet below), and a shop owner or staff caller of a write RPC. (ii) Every other rejection, whether validation or business (missing reason, unconfirmed call, stale `expected_state_version`, backdating without confirmation, revocation after the natural end (M2), a request ID reused with a different payload (R5), or an invalid custom range), returns a specific committed code. It is not counted as an authorisation denial and writes no denial row. Specific code names are set in implementation review. These rejections write no replay-ledger row (B2-1, approved 2026-11-05).
- *AAL2 failure (decided 2026-11-04, owner):* a platform-admin request that fails the required AAL2 assurance check (`auth.jwt()->>'aal' = 'aal2'`) is an authorisation failure. It returns a committed `{ok: false, code: 'forbidden'}`, is logged to `licence_denials`, and counts toward the authorisation-denial counter (`licence_denial_windows`). The protected admin operation is not executed, and the request writes no coverage row, no audit row and no replay-ledger row. Resolved 2026-11-05 (B2-2): a denied request does not increment `shop_licence_meta.state_version`. Resolved 2026-11-06 (§12A.17 D): a missing, unreadable or insufficient `aal` claim fails closed, with the same effects. Still OPEN: hosted and local staging verification of the claim (R16, S-3, O11; decision 14). No verification has occurred.
- Shop owners and staff can call only `shop_licence_status`. They cannot call any write RPC.
- A platform admin cannot act as a shop user, and a shop owner cannot act as a platform admin. Platform admin status is not shop membership. If the owner also owns a shop, the owner can grant that shop, and the action is logged the same way.
- The typed shop-slug confirmation is a UI step. The server checks only `confirm = true`, the state version, and admin identity.
- *Added 2026-10-29 (R11):* an admin cannot disable their own admin row, and the last active admin cannot be disabled. These rules apply to any future disable path.
- **Admin disable is outside 7C (O6, approved with condition, 2026-11-02).** No disable RPC is part of 7C. Until a documented emergency disable and recovery procedure is approved, the break-glass SQL in §12A.3 is the only disable route. That procedure is required before 7C implementation sign-off.

### 12A.9 Audit log

- Table `licence_audit_log`: `id`, `created_at`, `actor_user_id`, `shop_id`, `action` (`grant`, `extend`, `revoke`, `replace`, `enforcement_change`; `payment_record`, `payment_verify`, and `payment_reverse` are deferred with M5). Denied attempts are not written here. They go to `licence_denials` (§12B.7, M8). `reason`, `coverage_id`, `licence_start`, `licence_end`, `before_state` (jsonb), `after_state` (jsonb), `request_id`. `payment_id` is deferred with M5 and is not in 0011 (C-5). Column names are as in `0011_licence_foundation.sql`.
- Written in the same transaction as the change. Append-only: UPDATE, DELETE, and TRUNCATE are blocked by trigger and revoked from all roles.
- Readable only by platform admins, through an RPC. Not readable by shop owners.
- Contains personal data: actor UUID, shop identity, and dates. Retention period and DPDP handling are decision 20 and need lawyer review (§4). *Retention split (M8, §12B.8):* consequential audit rows and replay records are kept separately from temporary denial logs. Denial retention of 90 days is a proposal (M8), subject to security and legal review. It is not an approved period. No retention job exists or is approved.
- Every row carries actor, shop, action, reason, timestamp, and the relevant licence dates, as the owner brief requires.

### 12A.10 Expiry and revocation

- Expiry is computed at read time from `ends_at`. Access needs no cron job. A notice job is a later stage.
- *Corrected 2026-10-29 (decisions A, B, C; §12B.2):* once enforcement exists, it applies to printing only. For SCHEDULED, EXPIRED, REVOKED, and NONE shops: no new print jobs, no retries, queued jobs held until ACTIVE, jobs already printing finish, the agent receives no claims, and `mark_printing` refuses. Customer checkout and order placement are not blocked. Owners keep read and CSV export. Enforcement is not started and needs its own approval (7F).
- Revocation takes effect at `revoked_at`. It does not alter orders, customer files, or statistics. Its only effect on printing is through the 7F gate.
- Licence expiry or revocation does not itself delete any data. The file retention rules in §5C are separate. Their live deployment is unverified. *Proposal M1 (§12B.6), not approved for implementation:* a job held only because the licence is inactive fails after 7 days. Whether its file then becomes purgeable is an open conflict (§12B.9 C-1). *Retention position (2026-11-04, temporary):* retention option R-D is selected temporarily. Cleanup stays disabled until C-1/M1 has legal review and an owner-approved retention policy. This is temporary, not final policy (§13, 2026-11-04 record).
- Grace period: decision 18.

### 12A.11 Required tests (before any stage is approved to ship)

SQL tests run only on a staging copy (CLAUDE.md). Minimum matrix:

- No coverage gives NONE. Trial and paid-overlap cases are deferred with the trial kind (§9 item 5) and the paid path (M5).
- Admin 1 month, then time passes, gives EXPIRED. Revocation mid-period gives REVOKED. (The paid fallback case is deferred with M5.)
- Lifetime plus an expiring admin grant gives ACTIVE with basis lifetime. Revoking the lifetime grant while an admin grant is still effective gives ACTIVE with basis admin grant.
- Half-open boundaries: `t = ends_at` and `t = revoked_at` are not effective.
- An extension starts at `greatest(v_now, latest non-revoked coverage end)` (O3). When the old end is in the future, it starts exactly there, with no gap and no overlap. When the old end has passed, it starts at now.
- Replace is atomic: a failure partway leaves the old coverage in place.
- Revoking an already revoked coverage is rejected.
- A backdated grant without explicit confirmation is rejected.
- A stale `expected_state_version` is rejected. The same `request_id` returns the original result.
- A non-admin caller of any write RPC is denied, and a denial record is written to `licence_denials` within the cap, and above the cap the count is kept with the omitted-detail marker (§12B.7, O10). Denials are not written to `licence_audit_log`. A shop owner cannot grant themselves access.
- An admin JWT without `aal2` is denied (decision 14, approved 2026-11-02). Decided 2026-11-04: committed `forbidden`, logged and counted, protected operation not executed (§12A.8, AAL2 failure bullet).
- Audit rows cannot be updated or deleted.
- Coverage rows accept only the one-time revocation update.
- Licence actions leave `orders` unchanged. A checksum of the `orders` payment columns (`payment_status`, `payment_channel`, `paid_at`, `refunded_at`, `refund_paise`, `payment_verified_by`, `payment_verified_at`) and the `order_events` row count is taken before and after. *Corrected 2026-10-29: `order_payments` does not exist in any migration.*
- `shop_licence_status` returns no reason, actor, or reference fields.
- The full test list, updated for the §12B decisions, is in §12B.11. No test has been run.

### 12A.12 Implementation stages (proposed; none started or approved)

- **7A. Owner inputs:** decisions 13–20; the Auth user UUID; MFA confirmation; admin UI hosting. No code.
- **7B. Schema:** migration (next free number, 0011 or later), tables, triggers, RLS deny-all, `is_platform_admin()`, `shop_licence_state()`, `licence_lock_shop()`, and `shop_licence_meta`. Excludes `paid_verified`, `trial`, and `licence_payments` (M5; C-5, DECIDED 2026-11-01). **Split on 2026-11-01:** 7B-1 (file only, unapplied, `supabase/migrations/0011_licence_foundation.sql`) covers the tables, triggers, RLS deny-all, `is_platform_admin()` and `shop_licence_state()`. `licence_requests`, `licence_denials` and `licence_denial_windows` are approved for placement in this file (decision 3; O2) and are now in it (added 2026-11-05 under bundle 3; unapplied, untested). Pre-staging review of 0011 is still required before any staging run. 7B-2 (`licence_lock_shop()` and `shop_licence_meta`) was approved for implementation on 2026-11-01, for that scope only, because it takes the shop lock. The R18 lock-order contract is design-approved (§13, third record). Its implementation is not approved. Built to the corrections in §12B.5 and the tests in §12B.11. SQL tests on staging only, after separate approvals for local setup and for migration creation.
- **7C. Admin RPCs and the read RPC:** grant, extend, revoke (with the M2 rule), and replace; `shop_licence_status` (owner read RPC); denial logging (M3, M8; counters in `licence_denial_windows`, O1). Admin disable is not in 7C (O6). Manual payment record, verify, and reverse are deferred (M5). Matrix from §12A.11 and §12B.11 on staging.
- **7D. Admin UI:** a separate private app with login, shop search, grant, extend, revoke, and replace forms with confirmation, and an audit view. Payment entry is deferred (M5). Browser smoke test on staging.
- **7E. Shop read-only status:** owner web view with the minimal fields in decision D. Android is DEFERRED (item 13). No enforcement.
- **7F. Enforcement (printing only, decision A):** gates on approve, retry, claim, and `mark_printing` (§12B.4). Order intake is not gated. Separate approval gate. The refund and claim fix and the duplicate-print fix are separate gates (§12B.4). The 7-day hold rule (M1) is a separate gate (§12B.6).
- Gateway payments (Stripe, Razorpay) come later. They depend on §9 decision 9 and on the external access checks in §4.
- Each stage needs explicit approval before it starts. No commit, push, merge, or deploy without it.

### 12A.13 New owner decisions (all PENDING OWNER APPROVAL, except where §12B.3 or the 2026-11-02 records in §13 record a status)

13. **Admin accounts (PENDING OWNER APPROVAL):** one owner account only (recommended), or additional super-admins? Each extra admin needs an owner-run SQL row.
14. **MFA (`aal2` requirement APPROVED 2026-11-02, §13 item 1; recovery procedure and claim verification OPEN):** require `aal2` (TOTP) for all admin RPCs (recommended)? The owner confirms whether MFA is enabled on the Supabase account and the admin user.
15. **Admin UI hosting (PENDING OWNER APPROVAL):** (a) a separate private deployment, not linked from the shop app and not published with the public shop site (recommended), or (b) another host, to be named. The public GitHub Pages site is not recommended for the admin UI.
16. **Grant limits (PENDING OWNER APPROVAL):** which durations are allowed (1 month, 1 year, custom, lifetime); whether backdating is allowed at all (recommended: only with explicit confirmation); maximum custom length (decided 2026-11-01: none, owner decision 6); whether lifetime is owner-only. *2026-11-02 (§13 items 4 and 5):* lifetime grants are admin-only, and backdating requires explicit confirmation. The maximum backdating window is OPEN. Dates are entered and shown in Asia/Kolkata and stored in UTC. Proposed: "1 month" and "1 year" start at the time of grant.
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

### 12A.17 Specification correction pass (2026-11-06): decisions and mandatory 7C RPC requirements

**Status.** Documentation and specification only. Nothing in this section is implemented, applied, executed, tested or staged. `0011_licence_foundation.sql` and `CLAUDE.md` are not changed by this pass. Approvals dated 2026-11-05 and earlier stand as recorded. Where a later clarification applies, it is added as a dated note and the earlier text is kept. The record is in §13 ("Owner decision record (2026-11-06)").

**A. Replay payload hash and conflict contract (DECIDED 2026-11-06).**
1. *Hash input:* the caller UID; `shop_id`; `action`; `expected_state_version`; `confirm`; `reason`; and every operation-affecting, action-specific field. For a grant: the grant kind and every start, end and duration input. For a revoke: `target_coverage_id`. For a replace: `target_coverage_id` and every field that defines the replacement grant. Any other field that can change the result is included.
2. *Excluded:* `request_id`, which is the lookup key.
3. *Unknown fields:* an unknown operation field is rejected, not ignored.
4. *Encoding:* a versioned, server-side canonical encoding, with fixed field order, typed and normalised values, an explicit representation of null, and unambiguous length-prefixing. The digest is SHA-256.
5. *Who computes it:* the server computes the hash. A client never supplies a trusted hash.
6. *Outcomes for one `request_id`:*
   - Same hash: replay. Return the stored result (B1-4), with no second change.
   - Different hash: conflict. Return a specific committed code (§12A.8 (ii)). Write nothing. It is not an authorisation denial and writes no denial row.
   - A conflicting ledger insert whose row is not visible on re-read: fail safely with an error. Write nothing. Never continue as a new operation.
7. *Still OPEN:* legal review of identity-derived payload hashes (§12B.8; S-6).

**B. Custom-grant boundaries (DECIDED 2026-11-06).**
1. A date-only start is inclusive at 00:00 Asia/Kolkata.
2. A date-only end is exclusive at 00:00 Asia/Kolkata.
3. Intervals are half-open throughout.
4. This rule does not apply to calendar-based grants with timestamps. One-month and one-year grants keep the clock-time rule in §12A.6 (A2).

This closes the OPEN status recorded on 2026-11-04 (A2) and carried in the 2026-11-04 and 2026-11-05 lists in §13. Those entries are kept, with dated notes.

**C. Extend lengths (DECIDED 2026-11-06).** Extend supports one calendar month and one calendar year only. The Asia/Kolkata calendar arithmetic and month-end clamping in §12A.6 are preserved (A2, O5). No other extend length is approved.

**D. AAL claim (DECIDED 2026-11-06; verification OPEN).**
1. A missing, unreadable or insufficient `aal` claim fails closed. Insufficient means any value other than `aal2`.
2. It is an authorisation failure under the committed `forbidden` contract (§12A.8 (i); AAL2-1 to AAL2-4). The result is a committed `{ok: false, code: 'forbidden'}`, logged to `licence_denials`, and counted in `licence_denial_windows`. The protected operation does not execute. No coverage, audit or replay-ledger row is written, and `state_version` does not change.
3. Local and hosted staging verification of the claim is required before 7C sign-off, not before implementation begins (decision 14; O11).
4. No verification has occurred, and no evidence exists. This section records the required behaviour only.

**E. Denial detail ceiling (PROVISIONAL, set 2026-11-06).**
1. Provisional engineering ceiling: 1,000 detail records per UTC hour, global (the `global` row of `licence_denial_windows`).
2. Exact denial counts continue after the ceiling is reached: `denial_count` keeps rising (B3-2).
3. Omitted detail count = `denial_count` minus `detail_count`. It is derived and not stored.
4. The existing limit of 20 detailed records per actor per UTC hour is kept.
5. This is a provisional staging and initial engineering default. It is not a production legal, retention or capacity decision. The production ceiling is OPEN.
6. No automatic alerting exists or is claimed. The threshold and the alert mechanism are OPEN (O9).

**F. Complete lock order (documentation).** This supersedes the 0011 header comment at lines 40–41, which omits the denial counters. Locks are taken only in this order:
1. actor denial-counter row (`licence_denial_windows`, scope `actor`, current UTC hour);
2. global denial-counter row (scope `global`, same UTC hour);
3. shop meta row (`shop_licence_meta`, through `licence_lock_shop`: `'exclusive'` for admin writes, `'shared'` for print gates in 7F);
4. order rows;
5. agent rows;
6. job rows, in ascending `id`.

The denial path takes steps 1 and 2 only, and takes no meta, ledger, order, agent or job lock. A transaction that needs both the counters and the meta lock takes the counters first. Admin writes take step 3 onward. The replay lookup and the ledger insert run while the step-3 lock is held (B1-1).

**G. Denial logging must not undo a committed `forbidden` result (7C RPC requirement).**
1. The `forbidden` result is a committed return value, not a raised error (R3).
2. The counter updates are in the same transaction as the `forbidden` return.
3. Detail-row insertion runs in a subtransaction (a savepoint or exception block). Its failure must not roll back the counter updates or the `forbidden` result. `detail_count` is incremented only together with a detail row that was inserted inside that subtransaction.
4. No `RAISE` may occur after the counter writes (§12B.7 commit rule).
5. *No-actor-UID path.* If the caller has no usable UID, the actor counter row is neither created nor updated. The global counter is incremented. No detail row is written, because `licence_denials.actor_user_id` is not null. The result is the committed `forbidden`, and no protected operation runs. This path defaults to denial and does not weaken authorisation.
6. *OPEN for implementation review:* what happens if the global counter write itself fails. In every case the RPC must not return success and must not run the protected operation. Whether to raise an internal error or return a committed `forbidden` result without a counter is an implementation review item.

**H. ON CONFLICT predicates (7C RPC requirement).** Use the partial-index predicates of `0011` lines 204–210 exactly:
- actor rows: `on conflict (actor_user_id, window_start) where scope = 'actor'`;
- global rows: `on conflict (window_start) where scope = 'global'`.

A conflict clause without the matching predicate does not infer the partial unique index.

**I. UTC-hour alignment (7C RPC requirement).** The RPC computes `window_start` as the start of the current UTC hour, as the 0011 comment at lines 181–183 describes: `date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC'`. Every counter write in one transaction uses that same value. 0011 does not enforce alignment with a check constraint; its constraints are at lines 191–199. Whether to add one is a future migration review item (N.4).

**J. READ COMMITTED replay (7C RPC requirement).** Every admin and denial RPC checks `transaction_isolation` on entry (bundle 1). Under READ COMMITTED each statement sees only rows committed before that statement began. The replay lookup therefore runs after the shop meta lock is taken. After a ledger insert conflict, the RPC re-reads the ledger in a new statement. A row committed by a concurrent winner is then visible, and the result follows A. If the row is still not visible, the RPC fails safely.

**K. Target and clock checks (7C RPC requirements).**
1. For revoke and replace, `target_coverage_id` must belong to the same `shop_id` as the request. If it does not, the RPC returns a specific committed rejection. That code must not reveal whether the coverage exists in another shop. The code name is set in implementation review.
2. Revoke timestamps are taken with `clock_timestamp()` after the shop meta lock is acquired, so that waiting for the lock cannot produce a stale timestamp.

**L. Hardened SECURITY DEFINER (7C RPC requirement).** Admin and denial RPCs are `SECURITY DEFINER`, owned by the migration owner role that holds the helper privileges, with a fixed `search_path`, schema-qualified references, and no dynamic SQL without `format` and `quote_ident`. EXECUTE on each RPC is granted to `authenticated` only (R9). Internal helpers keep EXECUTE revoked from `public`, `anon`, `authenticated` and `service_role` (0011 lines 608–623). The 0011 functions set `search_path = public`. Whether to tighten that to `pg_catalog, public` is a review item and is not changed here.

**M. Sequence privileges (7C review item).** `licence_denial_windows.id` is an identity column, so PostgreSQL creates a sequence for it. 0011 revokes table privileges (lines 603–606) and has no sequence revoke. Supabase default privileges (R17, UNVERIFIED) may grant sequence access to client roles. Review the sequence privileges on staging. Where a client role has access, revoke it in a future migration. Not done in this pass.

**N. Future migration changes (recorded for separate review and approval; NOT made).**
1. `0011` header: the append-only description (see O), the D-labels in the header comments, and the lock-order comment at lines 40–41 (§12A.17 F).
2. Revoke sequence privileges on the `licence_denial_windows` identity sequence (M).
3. Whether to tighten `search_path` on the 0011 functions (L).
4. Whether to add a UTC-hour alignment check to `licence_denial_windows` (I).

Each needs its own approval. None is part of this pass.

**O. Append-only description (documentation; corrects the 0011 header at line 31).** Line 31 says "Deletes and TRUNCATE are refused on both append-only tables." The accurate description is:
- Append-only: `licence_coverages` (DELETE and TRUNCATE refused; the one permitted UPDATE is the revocation); `licence_audit_log`, `licence_requests` and `licence_denials` (UPDATE, DELETE and TRUNCATE refused).
- Guarded, not append-only: `shop_licence_meta` (DELETE and TRUNCATE refused; identity fixed; exactly +1 per UPDATE) and `licence_denial_windows` (DELETE and TRUNCATE refused; identity fixed; both counts non-decreasing).

**P. Retention (proposal).** The 90-day period for detailed denial records is a proposal subject to security and legal review (M8). It is not an approved period. The periods for counters, the replay ledger and the audit log are OPEN.

**Q. Still OPEN (not decided, and not approved by this pass).**
- Legal retention periods for denial records, counters, the replay ledger and the audit log, including DPDP handling.
- The production denial-detail ceiling. E is provisional only.
- The production backdating window.
- Production admin identity and MFA policy beyond the approved requirements.
- Legal review of identity-derived payload hashes (A.7).
- Production alert thresholds and the alerting mechanism (E.6).
- Actual hosted and local `aal` verification evidence (D.4).
- Completion of the emergency-disable, break-glass and recovery procedure (A3, O6, O7).

**R. Status of this pass.** No SQL was executed, no tests were run, and there was no staging, no migration application or change, and no code. The requirements in G to M are specifications for the later 7C implementation and pre-staging review.

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
| D | Minimal owner status: active or inactive; access end or no-expiry; next start when relevant (next start shown only in SCHEDULED, owner decision 8). No payment references, admin notes, audit history, coverage IDs, or revocation reasons. | APPROVED | Owner only. Staff and Android visibility are open (decision 19). *A5 (2026-11-04):* staff visibility is closed. Staff receive no licence information. Android visibility remains open (item 13). |
| E | Enabling enforcement: preview first, blocked-shop count, digest, typed confirmation, reason, audited server-side change. Not enabled now. | APPROVED for design. ENABLING BLOCKED | Enabling needs a reviewed transition policy for existing shops (owner input: N and the free-period policy, §5B, decision 8). |
| F | Refuse paid coverage while a lifetime grant is active. | APPROVED. BLOCKED with the paid path (M5) | Verification is refused while a lifetime grant is effective. Payments recorded but not verified need a refund policy (outside the software; lawyer and CA, §9 item 6). |
| G | Show SCHEDULED when no coverage is active but a valid future coverage exists. | APPROVED. C-8 confirmed by the owner on 2026-11-01 | Revoking current coverage does not cancel future coverage (C-8). |
| H | A payment reversal atomically revokes its linked coverage. Admin and complimentary grants are never revoked by a payment reversal. | APPROVED. BLOCKED with the paid path (M5) | Admin kinds have `payment_id` null (§12A.5), so the link is structural. |
| I | Pricing and minimum payment. | **BLOCKED** | No price, minimum amount, tax treatment, or published pricing. The paid path stays blocked. The §7 options are not approved. |
| J | Coverage anchor: exact server verification timestamp taken after the shop lock; Asia/Kolkata calendar arithmetic. | APPROVED. BLOCKED with the paid path (M5) | See C-4 on stacking. |
| K | Investigate and test two printing fixes. Stop if a fix is broader. | Duplicate-print fix: investigation and targeted local tests APPROVED only after the proposed code diff is reviewed (owner instruction 5, 2026-10-31). Staging tests need separate explicit approval. Implementation needs its own approval after diff review. Refund and claim fix: **REVIEW REQUIRED (stopped)** | §12B.4. Nothing implemented. |
| L | Read-only inspection of the local Auth schema, only after separate local setup approval. Synthetic fixture only after its columns are verified and the approach is reviewed. | **BLOCKED** until local setup is approved separately | Nothing inspected. No user created. |
| M1 | Jobs held only because the licence is inactive fail after a proposed 7-day limit, with a stated reason. Their files then become eligible under the existing purge rules. Files required by actively printing jobs are never deleted. The effect on paid orders is documented. Tests before implementation. | PROPOSAL. Not approved for implementation. Review and tests required first | §12B.6. Conflicts C-1 and C-2 must be resolved first. |
| M2 | Refuse manual revocation of coverage whose natural end has already passed. Payment reversal stays a separate, audited operation. | APPROVED | Resolves state-machine fix 2 (§12B.5). |
| M3 | Detailed denial records capped at 20 per user per hour, with rate limiting and aggregate counts for excess attempts. Limitations documented. | APPROVED as design (O1, O9, O10, 2026-11-02). NOT IMPLEMENTED | §12B.7. The counter is `licence_denial_windows` (O1), not `consume_rate_limit`. Above the cap: a count per window with a visible omitted-detail marker (O10, synthetic staging only). Global ceiling: provisional 1,000 detail records per UTC hour (2026-11-06, §12A.17 E); production value OPEN. O9: counted, no automatic refusal. Alerting is not approved, implemented or claimed (2026-11-04). |
| M4 | Paid term: 12 calendar months, Asia/Kolkata arithmetic, from the exact server timestamp after the shop lock. Custom admin dates use the same timezone convention with explicit start and end semantics. A custom grant is not a paid transaction. | Custom-grant convention APPROVED. Paid term APPROVED, BLOCKED with the paid path (M5) | Custom grant: start inclusive at 00:00 IST, end exclusive at 00:00 IST (date-only inputs). *Decided 2026-11-06 (§12A.17 B):* this closes the 2026-11-04 hold (A2). Stacking question: C-4. |
| M5 | The paid-coverage implementation is left out of 7C and 7D until pricing, minimum amount, tax treatment, and the payment-recording policy are reviewed and approved. No invented price. No unconfigured payment path grants access. Complimentary admin grants stay independently available. | APPROVED (blocking condition) | `paid_verified` and `licence_payments` are excluded from 7B (C-5). C-5 was confirmed by the owner on 2026-11-01. `trial` is excluded under C-10. |
| M6 | Lifetime may be granted over existing paid coverage. Paid records are preserved and never refunded, deleted, rewritten, or automatically revoked. Lifetime takes precedence while active. If lifetime is later revoked, a still-valid paid period may give access. | APPROVED as policy. State transitions to be tested | Applies only when paid records exist, so it becomes testable with the paid path (M5). Compatible with F (C-7). |
| M7 | Stop-and-review for the refund and claim fix. The duplicate-print fix needs targeted tests and must not change unrelated printing behaviour. | APPROVED (review requirement confirmed) | No fix implemented. Diff review pending. The 0012 read-only review approved 2026-11-04 (no. 6) is not a fix approval. |
| M8 | Separate retention: a proposal of 90 days for detailed denial records, subject to legal review (not approved); successful replay records kept until an independently safe replay-prevention mechanism exists; audit records kept separate from denial logs; personal data minimised. No retention job. No deletion. | APPROVED as policy proposal. LEGAL REVIEW REQUIRED | §12B.8. |

### 12B.3 Owner decisions 13–20 (§12A.13): status after 2026-10-29

| Decision | Status |
|---|---|
| 13 Admin accounts | PENDING OWNER APPROVAL. Recommended default: one owner account. Not approved. |
| 14 MFA (`aal2`) | APPROVED 2026-11-02 (§13 item 1): `aal2` is required for every platform-admin RPC. OPEN: the recovery procedure, and hosted and local verification of the claim (O11). The owner still confirms MFA status on the Supabase account. |
| 15 Admin UI hosting | PENDING. |
| 16 Grant limits | PARTLY APPROVED: custom-date convention (M4). Maximum custom length: none (owner, 2026-11-01). Lifetime ranks above admin grants (item 7, 2026-11-01). 2026-11-02 (§13 items 4 and 5): lifetime grants are admin-only, and backdating needs explicit confirmation. OPEN: the maximum backdating window. |
| 17 Revoking paid periods | PARTLY APPROVED through H and M2 (reversal; refusal after end). Standalone revocation of an active paid period is PENDING and deferred with M5. |
| 18 Expiry and grace | PARTLY: B and C block printing in every non-ACTIVE state, so no grace is implied. PENDING: any grace days, and the wording for NONE. |
| 19 Shop-facing view | PARTLY APPROVED: fields as in D. PENDING: Android, and whether an admin grant may show a label. D shows active or inactive only. Staff visibility closed 2026-11-04 (A5). |
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
  - **R-a:** in the refund path and in the ready or completed transition, mark the order's queued jobs `failed` with a specific reason code. Uses existing states. Changes the body of `set_order_payment` (the 0006 body on the origin/main line; the 0013 body on local main, unmerged) and the order status update path. Touches the customer payment ledger.
  - **R-b:** add a `cancelled` job status and cancel jobs in the same paths. Schema change, plus the same body changes.
  - **R-c:** claim-side eligibility only (order `printing` and `paid`). Ineligible jobs stay `queued`, so they pin their files indefinitely (0010 lines 795–798). **Not acceptable without a retention decision (C-1).**
- Local main migration 0012 (unmerged; not on this line) combines R-b with claim and mark checks. It is not one of R-a, R-b or R-c as written, and it has not been reviewed. Its effect on retention (cancelled jobs are not in the 0010 keep-list) is open under C-1. *Read-only review approved 2026-11-04 (no. 6): no implementation, SQL, staging application or deployment. The review does not approve R-b or any fix. The 0012 header says retention keeps failed jobs; 0010 does not list `failed` in its keep rules (the file is kept only through the open-order claimed-file rule), so the header is to be corrected in review.*
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
| 5 | Tie-break: if two coverages end at the same instant and one was revoked, the state is REVOKED. | APPROVED (owner, 2026-11-01; item 8). |
| 6 | Hide `next_start` when there is no expiry. | Resolved under D and F. Next start is shown only in SCHEDULED (owner decision 8, 2026-11-01). |
| 7 | Basis describes current access only. Owners see no basis. | APPROVED (D). |
| 8 | `access_until` algorithm: start from the end of the covering coverage (lifetime gives no expiry). Repeatedly extend while a valid coverage starts at or before the current end and ends after it. The result can include intervals that start after `t`. | Design resolved; not tested. UNVERIFIED on staging. |
| 9 | Display the exclusive end, e.g. "until 1 Jan 2028, 00:00 IST", not "until 31 Dec". | Exclusive end confirmed by the owner on 2026-11-01 (item 8). Exact display wording still to confirm. |
| 10 | Anchor and term arithmetic in Asia/Kolkata: `((anchor at time zone 'Asia/Kolkata') + interval '12 months') at time zone 'Asia/Kolkata'`. Replaces the garbled expression in the earlier chat plan. | APPROVED (J, M4). Blocked with the paid path (M5). |
| 11 | The literal and truncated anchor forms agree only if `verified_at` is read after the shop lock and revocations are no later than it. | Test precondition resolved; not run. |

**R1–R19 (from the 7B review in the planning conversation; that review is not reproduced in this file).** Nothing here has been run. Items marked UNVERIFIED need staging, after separate approvals.

| ID | Finding and resolution | Status |
|---|---|---|
| R1 | Meta row creation: no trigger on `shops`. Created lazily by `licence_lock_shop`. | Design resolved; not tested. Verify the upsert on staging. |
| R2 | Versioning: one increment per committed successful admin operation, inside the RPC (B2-2, 2026-11-05). The 0011 guard requires `new.state_version = old.state_version + 1` on each update. Triggers do not increment. | Design resolved 2026-11-05; not tested. The versioning test in §12B.11 reflects this. |
| R3 | Denials: an admin denial returns a committed result. Print refusals may raise. The licence denial counter (`licence_denial_windows`, O1) follows the same rule. | Design resolved; not tested. |
| R4 | Atomic success: one function, with no exception after the audit insert. | Design resolved; not tested. Enforce by test. |
| R5 | Idempotency: same `request_id` and canonical payload hash returns the stored result. A different hash is a conflict. The hash includes the caller UID and `shop_id` (2026-11-05), so the same `request_id` on another shop is a conflict. The ledger is the arbiter under READ COMMITTED (bundle 1). Ledger retention per M8. Conflict contract: §12A.17 A and J (2026-11-06). | Design resolved 2026-11-05; not tested. Retention: §12B.8. |
| R6 | Revocation immutability: compare `to_jsonb` with the three revocation keys removed. | Design resolved; not tested. UNVERIFIED on staging. |
| R7 | `shop_licence_id` columns: the earlier chat plan omitted `shop_id` on coverages and payments. This file already includes it. Composite foreign key added. | Design corrected. The key applies only if `licence_payments` is approved (M5). |
| R8 | Payment immutability: shop, amount, currency, method, reference, and `received_on` fixed at insert. | Design resolved; not tested. Paid path blocked. |
| R9 | Privileges: internal helpers revoked from `public`, `anon`, and `authenticated`. Admin RPCs granted to `authenticated` only. REVOKE from `PUBLIC` made explicit, because PostgREST exposes `public` functions. | Design resolved; not tested. UNVERIFIED: Supabase default grants (R17). |
| R10 | Owner status through a separate RPC. `shop_licence_state` is internal. | Design resolved; not tested. Follows D. |
| R11 | No self-disable. The last active admin cannot be disabled. | Design resolved; not tested. Added to §12A.8. |
| R12 | Functions that write are not `STABLE`. Read functions stay pure. | Design resolved; not tested. |
| R13 | No price rule exists. | **BLOCKED** by I. |
| R14 | Test fixtures use fixed past dates. `p_at` is used only for reads, because mutations are stamped with the wall clock. Owner decision 11 (2026-11-01): owner-facing reads use the current time only; historical state queries are not supported (history: `licence_audit_log`). | Test design resolved; not run. |
| R15 | Synthetic `auth.users` fixture: the required columns for the pinned local Auth schema are unknown. | **BLOCKED** by L. |
| R16 | Simulating `auth.uid()` and `aal` through request claims. | UNVERIFIED (staging). |
| R17 | Owner role and Supabase default grants on new `public` tables. | UNVERIFIED (staging). |
| R18 | Lock order, per RPC, as the existing code does it (checked 2026-10-30). `approve_order_for_print` locks the order row (0010 line 451). `retry_print_job` locks the source job row (line 515), then reads the order and the sibling jobs without a lock (lines 530–539). `consume_print_pairing` locks the pairing row (line 576). `agent_claim_next_job` selects one queued job with `for update skip locked` (line 655). Its recovery step, `recover_expired_print_jobs`, updates rows without an explicit lock. `agent_mark_printing` locks the job row (line 699). `agent_finish_job` locks the job row (line 736). `set_order_payment` takes no row lock (0006). No advisory lock exists in migrations 0001 to 0010. **Superseded design, not built:** the earlier designed order (print paths: order, then meta; admin: advisory lock, then meta, then payment) is replaced by the lock-order contract in §13 (third record, 2026-11-01: meta → order → agent → jobs). The advisory lock is removed. The two-session test is **outstanding** (staging, separate approval). | Existing code: verified by reading only. Contract: design APPROVED 2026-11-01 (§13, third record); not built, not tested. Two-session test: outstanding. Reconciled 2026-11-01 (§13): `retry_print_job` takes the job before the order, which conflicts with the print-path wording. The job-level order and the claim design are proposals, not validated. Implementation is NOT approved (owner, 2026-11-01). Design approval authorises no code, SQL or test. |
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

- **Detailed records:** the first 20 denied calls per authenticated user per hour are written to a `licence_denials` table (placement in 0011 approved, O2). Fields: actor UUID, function name, internal denial reason, time, and `request_id` if supplied. The public response is always `forbidden`, so the reason is never returned to the caller (2026-11-05).
- **Excess attempts:** counted in `licence_denial_windows` (O1, approved 2026-11-02): counts per actor and globally, per UTC hour. This replaces the earlier `consume_rate_limit` design. The counter records counts only (`denial_count` and `detail_count`), and `consume_rate_limit` is not used for licence denials (2026-11-05).
- **Response:** the same `forbidden` code for every denial, so a caller cannot tell whether the cap was reached. *A4 (2026-11-04):* the same code applies to authorisation failures only. Other rejections use specific committed codes (§12A.8).
- **Commit rule:** the counters and any detailed row are committed together, as R3 requires (2026-11-05). The detail row is written after both counter upserts, and `detail_count` is incremented in the same transaction. Lock order: actor row, then global row, both before any shop meta lock. The denial path takes no meta, ledger, order, agent or job lock. No raise is allowed after the counter writes.
- **Limitations (documented, not solved):**
  - Anonymous calls are rejected at the grant level before the function runs (§12A.4 grants to `authenticated` only). Those attempts are not logged. No anon-callable counting wrapper is created (2026-11-04, B2). Calls rejected before RPC execution are not counted for staging, a documented limitation. Staging test expectations follow §12B.11. The 2026-11-04 no. 3 position is kept in §13 for history only.
  - A caller with many accounts gets a separate cap for each account. A provisional global detail ceiling of 1,000 records per UTC hour applies (2026-11-06, §12A.17 E). It is not a production decision, and the production value is OPEN.
  - Above the cap, the details of a burst are lost. Only counts remain (C-12). O10 (approved for synthetic staging only, 2026-11-02): overflow is recorded as a count per window with a visible omitted-detail marker, and evidence is not silently discarded. Production C-12 is OPEN.
  - `purge_old_rate_limits` exists (0010). `cleanup-files` calls it (`index.ts` line 81), and that daily workflow's live deployment is **UNVERIFIED** (§5C).
  - `consume_rate_limit` is granted to `service_role` only (0010 line 868). That is one reason it is not used for licence denials (O1).
- **Status:** APPROVED as design (O1, O9, O10, 2026-11-02). NOT IMPLEMENTED. O9: denials are counted, there is no automatic refusal, and alerting is not implemented or claimed. The numeric threshold and the alert mechanism are OPEN.

### 12B.8 Retention (M8)

| Record | Proposed retention | Status |
|---|---|---|
| Detailed denial records (`licence_denials`) | Proposal: 90 days | Proposal, subject to security and legal review. Not an approved period. No deletion job. |
| `licence_denial_windows` counters (O1) | Retention not decided. `purge_old_rate_limits` purges the rate-limit table, not this table, so it does not apply here. No purge job for these counters is approved. | Retention OPEN |
| Replay records (`licence_requests`) for consequential mutations | Kept until an independently safe replay-prevention mechanism exists. Store the request ID, action, shop ID, payload hash, target coverage ID where applicable, and `state_version_after`. No actor column (2026-11-05). Not deleted at 90 days. | Retention period OPEN. No delete path (bundle 2). |
| Consequential audit log (`licence_audit_log`) | Kept as needed for administrative and financial records. Personal data minimised. | Lawyer review (decision 20, DPDP). |
| Customer files and print jobs | Unclaimed: one day after upload (0003 line 41). Claimed: 30 days after the order is completed, cancelled or rejected, with purge exclusions (0010 lines 785–810). **Code in repo; live deployment UNVERIFIED** (§5C). M1 would add a licence-driven failure path. | Separate decision (C-1). R-D selected temporarily (2026-11-04, no. 4): cleanup disabled until legal review and an owner-approved retention policy. Lawyer review required (no. 5). |

`licence_requests` has no actor column (2026-11-05). The caller UID enters only through `payload_hash`. Whether a hash derived from a user UID is personal data is not decided and needs lawyer review. `licence_denials` and `licence_denial_windows` store `actor_user_id` as a plain uuid with no foreign key. It is personal data, and its retention is OPEN.

### 12B.9 Contradictions, open conditions, and security weaknesses

**Contradictions and open conditions**
- **C-1 (M1 vs the purge rule).** M1 assumes a failed job makes the file eligible. The purge rule does not, for orders that remain `printing` (§12B.6). Options: a new terminal order status, which changes the 0001 transitions and is out of scope so far; or a licence-specific file-release rule. **Not decided.** *2026-11-04:* retention option R-D is selected temporarily, so cleanup stays disabled until legal review (C-1/M1) and an owner-approved retention policy. The release option is still not decided. Lawyer review required.
- **C-2 (M1 mechanics).** The hold-start clock is unresolved. A purge scheduler exists in the repository (`cleanup-files.yml`; deployment UNVERIFIED). No scheduler exists for held-job timeouts (§12B.6). The owner must choose the hold start (option a or b), and any scheduled job needs separate approval. Deferred with item 2 (owner instruction 1, 2026-10-31). It reopens under §14.2 item 2.
- **C-3 (B vs retention).** Until M1 is implemented, held jobs keep customer files indefinitely. Two separate questions. **Decision:** the owner accepts this as an interim, or holds enforcement back. **Requirement:** holding enforcement back makes M1 a prerequisite of enabling, with item 2 and, where paid orders are affected, item 10. The 7F build needs C-1 answered and C-3 decided (§15.3 7F). Stage 7 closure needs C-3 decided, not enforcement enabled (§16.1(e)).
- **C-4 (M4 vs J stacking).** M4 says the term is calculated from "the exact server-side verification timestamp". J and the anchor rule start a new paid term at the end of an existing paid term when that end is later. The two differ while a paid term is still running. Recommended: keep stacking, so there is no overlap. **Owner confirmation needed.** Applies only when the paid path is approved.
- **C-5 (M5 and 7B).** Whether `paid_verified` and `licence_payments` are excluded from migration 0011. Decided 2026-11-01: excluded (owner confirmation given).
- **C-6 (decisions 13–15).** Admin accounts, MFA, and hosting are unanswered. 7A cannot finish without the Auth user UUID and the MFA answer. Blocks 7A, the bootstrap row and 7C–7D. It is not a 7B schema prerequisite (§15.3).
- **C-7 (F and M6 with H).** Consistent: F refuses a new paid period during a lifetime grant, and M6 allows a lifetime over existing paid coverage. **Confirm** that revoking a lifetime grant while a paid period is still valid leaves access through the paid period, as M6 states.
- **C-8 (G with revocation).** G shows SCHEDULED after revocation of current coverage when a future coverage exists. **Confirmed by the owner on 2026-11-01** that revocation does not cancel future coverage.
- **C-9 (§9 item 7 wording).** Owner decision 9 (2026-11-01) adopts this replacement wording: "C-9 confirmed. In §9 item 7, 'no new customer orders', 'in-flight paid orders finish' and 'the print agent claims no new jobs' are replaced by §12B.2 A, B and C. Checkout is not blocked, queued jobs are held while the shop is not ACTIVE, jobs already printing may finish, and retries are refused while inactive." **Status: DECIDED (owner, 2026-11-01).** The superseded passages are in §9 item 7 only. The §12A.10 correction note (A, B, C) is separate and unchanged. Other original text in §9 item 7 remains. B keeps its own condition (C-1 and C-3), which this decision does not change.
- **C-10 (trials).** §9 item 5 and §12A.5–12A.6 mention trials. Trials are deferred out of Stage 7 under the 2026-10-29 direction (the earlier chat plan is not reproduced in this file). **Owner confirmed 2026-10-31:** trials are deferred out of Stage 7, not permanently removed. Trial terms are not approved. Reopening needs a new owner decision on product and pricing terms.
- **C-11 (refunds).** The refund policy (§9 item 6) is open. M1's effect on paid orders depends on it. Lawyer review required.
- **C-12 (denial design).** M3 accepts counts-only records above the cap. O10 (2026-11-02): accepted for synthetic staging only. Overflow is recorded as a count per window with a visible omitted-detail marker. A provisional global ceiling of 1,000 detail records per UTC hour is recorded 2026-11-06 (§12A.17 E). Production C-12 is OPEN.
- **C-13 (blocked item I).** The paid path and pricing are blocked, so Stage 7 cannot sell paid licences after 7C and 7D. This is expected under M5. No paid licence can be offered until I is approved.
- **C-14 (E).** Enabling enforcement needs the existing-shop policy. **BLOCKED.**
- **C-15 (email and authentication).** The email sign-in and sign-up decisions in §2 are not changed. Admin login relies on Supabase Auth, and therefore on the MFA answer (C-6).

**Security weaknesses (each needs a staging test before implementation)**
- **S-1.** A missed REVOKE from `PUBLIC` would leave a function callable by `anon`. The checks would still deny the call, but it would reveal that the function exists (R9). **UNVERIFIED** against Supabase default grants (R17).
- **S-2.** Supabase may grant default table privileges to `anon` and `authenticated` on new `public` tables. RLS with no policies blocks reads only while RLS stays enabled. **UNVERIFIED** (R17).
- **S-3.** Admin RPCs depend on the `aal` claim. How hosted and local Supabase expose that claim, and how the check reads it, is **UNVERIFIED** (R16).
- **S-4.** A signed file link issued at claim time stays valid for 180 seconds (`supabase/functions/print-agent/index.ts` line 23). A modified agent could print with a link issued before a lapse, without calling `mark_printing`. The residual window is at most 3 minutes. Accept or document before 7F.
- **S-5.** Static code, verified 2026-10-30 in the committed worktree version of `agent/src/worker.mjs` (lines 258–264). When `markPrinting` throws, the agent clears its journal and returns. It does not print and does not report a failure. **Runtime behaviour is still UNVERIFIED.** A local test is required before 7F. No test was run.
- **S-6.** The denial table and the denial counter table hold plain actor UUIDs (no auth-user foreign key, bundle 2). The replay ledger (`licence_requests`) has no actor column, but its `payload_hash` is derived from the caller UID (§12B.8; lawyer review). Retention is OPEN (§12B.8).
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
- **Admin RPCs:** a non-admin is denied, with a committed denial row and counter. aal2 is required. A stale state version is rejected. A reason is required. A replay returns the stored result. A conflicting payload is rejected. No self-disable. The last admin is protected. Both rules apply to any future disable path, because admin disable is outside 7C (O6). Custom date-only grant (decided 2026-11-06, §12A.17 B): the start is active at 00:00 IST on the start date, and the end is not active at 00:00 IST on the end date. Test both boundaries with Asia/Kolkata dates. One-month and one-year grants start at the time of the grant. For calendar grants the end keeps the start's clock time, with IST month-end clamping (add a test). The 2026-11-04 OPEN expectation is withdrawn.
- **Response contract (A4):** an authorisation failure returns a committed `forbidden` result, writes a denial row and increments the counter. Each other rejection (for example missing reason, unconfirmed call, stale version, backdating without confirmation, revocation after the natural end, or a request-ID payload conflict) returns a specific committed code, writes no denial row, does not increment the counter and writes no replay-ledger row. Code names are set in implementation review.
- **AAL2 failure (2026-11-04):** an admin JWT without `aal2` returns a committed `forbidden` result, writes a denial row and increments the counter, and the protected operation does not run. Staging test, subject to separate staging approval. A missing, unreadable or insufficient `aal` claim gives the same result (2026-11-06, §12A.17 D).
- **Privileges:** admin RPCs are callable only by an authenticated admin with aal2. Internal helpers are denied to `public`, `anon`, and `authenticated`. No default grants on licence tables (staging inspection).
- **Triggers:** the revocation whitelist. One revocation only. DELETE and TRUNCATE blocked on coverage and audit tables. Denial and audit rows are append-only.
- **Versioning:** exactly one increment per committed successful admin operation (B2-2, 2026-11-05). No increment on denials, rejections, replays or reads. The 0011 guard checks +1 per update.
- **Denial cap:** 20 detailed rows per actor per UTC hour (spec). A provisional global detail ceiling of 1,000 per UTC hour applies (2026-11-06, §12A.17 E); the production value is OPEN. Omitted details = `denial_count − detail_count` per row, derived (B3-2, 2026-11-05). Identical response. The counter persists after a denial. Staging expectation (B2, 2026-11-04): a call rejected before RPC execution (for example, `anon` without EXECUTE) produces no denial row and no counter increment, and the staging report records this as a documented limitation. Subject to separate staging approval.
- **Concurrency:** a two-session test. The second writer waits on the shop lock. Add these cases (2026-11-05; none run): (a) the same `request_id` on two shops (the hash includes `shop_id`), where the second caller gets the committed conflict code, or, if the conflict is not visible on re-read, a safe error with no writes, and never a raw unique-violation error; (b) two denials for one actor and hour, with exact counts and no deadlock; (c) a session that is not READ COMMITTED, which must fail the isolation check.
- **Orders unchanged:** checksum over the `orders` payment columns and the `order_events` row count, before and after licence actions.
- **Checkout unaffected (A):** `place_order` succeeds while the licence is inactive, with enforcement on. Migrations define two signatures (three arguments in 0001 and 0003; four arguments in 0008 and 0009). No migration drops either. Which overloads exist on a live database is UNVERIFIED. Test every overload that exists. The three-argument version is granted to `anon` and `authenticated` (0003 lines 277–278). The four-argument version is granted to both as well (0008 line 115; 0009 line 81), and it calls the three-argument version (0008 line 75; 0009 line 62). Test both signatures as an anonymous caller and as an authenticated caller.
- **Printing gate (7F, after approval):** approve and retry are refused, with no rows and no order status change. Claim returns nothing. `mark_printing` refuses. Finish works for a printing job. Queued jobs resume when the shop is ACTIVE.
- **Duplicate-print fix:** retry refused when a sibling is `sent`. Retry refused for a source that is not the latest attempt. Retry still works for `failed` and confirmed `needs_check`. Existing printing tests unchanged.
- **Refund and claim fix:** defined after diff review. Must include a check that a refunded order's files are not claimed.
- **Held-job limit (M1, not approved for implementation):** 7-day failure. Reason code. File eligibility per the rule chosen under C-1. Printing jobs' files never deleted. No effect on other orders.
- **Owner status:** returns only the D fields whatever the enforcement state. Staff denied (§12B.2 D).
- **Timezone:** 29 February plus 12 months gives 28 February.
- **Regression:** the Stage 7 migration 0011 (origin/main line) must change no existing function, trigger, policy, or grant. Not yet run. Local main's `0011_service_options` is a different, unmerged file, and it does change existing functions (owner decision 2, 2026-11-01).

### 12B.12 Next gates (none authorised by this document)

1. Owner answers to C-1, C-3, C-4, C-6, and the pending items in §12B.3. C-5 and C-8 were answered on 2026-11-01. C-2 is deferred with item 2. C-10 is answered: trials are deferred, not removed (owner instruction 4, 2026-10-31).
2. Separate approval for local setup (Option A). The setup steps are not reproduced in this file and must be written out and reviewed before that approval is requested.
3. Separate approval to inspect the local Auth schema (L).
4. Creating migration 0011 for 7B-1 was approved on 2026-11-01. It is file only and unapplied. 7B-2 implementation was approved on 2026-11-01 for its scope only (§13, status correction). The R18 lock-order contract is design-approved (§13, third record); its implementation is NOT approved. Each staging run needs its own approval.
5. Diff review of the duplicate-print fix (K). Then a separate approval for targeted local tests. Staging tests and the implementation each need their own explicit approval.
6. Separate approval for the refund and claim fix (M7), after diff review.
7. Separate approval for each of 7C, 7D, 7E, and 7F. The M1 rule has its own review (§12B.6).

### 12B.13 Completion, queued jobs, cancellation and reprint: comparison for owner decision (2026-11-04)

*Comparison only. No option is selected or approved (2026-11-04 no. 7). Nothing here is implemented, tested or run.*

**Facts from reading the code (not run)**
- Approval (`approve_order_for_print`, 0010 lines 439–498) creates a `queued` job for each item that has no job yet, and moves an `approved` order to `printing` in the same transaction. An order that is already `printing` keeps that status.
- An order in `printing` may move only to `ready` or `completed` (0001 lines 153–155). `cancelled` is reachable only from `pending` or `approved`, and `rejected` only from `pending` (0001 lines 153–154). An order with queued jobs is in `printing`, so an owner status change cannot cancel or reject it.
- The claim (`agent_claim_next_job`, 0010 lines 630–686) selects `queued` jobs for the shop whose file is not deleted. It checks neither the order status nor the payment status.
- A refund (`set_order_payment`, action `refund`, 0006 lines 213–219) changes payment fields only. The order status and `print_jobs` are unchanged (§12B.4).
- Moving an order to `ready` or `completed` changes no `print_jobs` row. Queued jobs of a completed order therefore stay `queued` and remain claimable.
- `retry_print_job` (0010 lines 502–552) accepts only `failed` or `needs_check` source jobs, and requires the order to be `printing` and `paid`. A `ready`, `completed`, `cancelled` or `rejected` order cannot be retried.
- The owner app's job labels (`web/src/logic.js`, `JOB_STATUS_LABELS`) have no `cancelled` entry. `printJobLabel` shows the raw status.
- 0012 (local main, unmerged, not reviewed) adds a `cancelled` job status and a `cancel_unprintable_jobs()` trigger that cancels queued jobs when the order is not printable (refunded, cancelled or rejected, not paid, or completed). The description is from reading only.

**Scope of the queued-job defect.** The defect is reachable through refund and through completion (`ready` or `completed`) while a job is still queued. Cancellation and rejection are not reachable from `printing` under 0001, so they are not part of the defect as the current transitions stand.

**Comparison**

| Event | Option 1: no change | Option 2: queued jobs become `failed` (R-a shape) | Option 3: new `cancelled` job status (R-b, 0012 shape) | Option 4: claim-side check only (R-c shape) |
|---|---|---|---|---|
| Completion (`ready` or `completed`) with a queued job | Job stays `queued`; the agent can still print it. | Job becomes `failed` with a reason code; it is no longer claimable. | Job becomes `cancelled`; it is no longer claimable. | Job stays `queued`; the claim refuses it because the order is not `printing`. |
| Refund with queued jobs | Job stays `queued`; it can still print (§12B.4). | Job becomes `failed`; the order status is unchanged. | Job becomes `cancelled` (0012 trigger). | Job stays `queued`; the claim refuses it. |
| Reprint of the item | None. `retry_print_job` refuses any order that is not `printing`. | None without a new path. The retry rule needs the order to be `printing` and `paid`. | None without a new path. `cancelled` is not a retry source. | Not needed for the job, which is never printed. |
| Files and retention | Queued jobs pin their files (0010 lines 795–798). | Follows the existing purge rule (§12B.8). C-1 applies while the order stays `printing`. | As option 2. `cancelled` is not in the purge keep-list. | Queued jobs pin their files indefinitely (C-1). |
| Owner display | Shows `queued` for a completed order. | Shows `failed`. A reason code is needed so it is not read as a print error. | Needs a new `cancelled` label; none exists today. | Shows `queued` for a completed order, which is misleading. |
| Code and schema | None. | Changes `set_order_payment` (0006) and the order-status path. No schema change. | Changes the `print_jobs` status check (0010 line 59) and the claim, mark and retry bodies. 0012 implements this shape and is unreviewed. | Changes the claim and mark bodies. No schema change. |
| Recorded status | Defect open (item 24; S-8). | Recommended in §12B.4 (R-a), subject to diff review. | Local main 0012 only; not reviewed. | Not acceptable without a retention decision (§12B.4; C-1). |

**Points that apply under every option**
1. Any new job state needs an owner-app label.
2. Items 23 and 24 keep their own gates, and the M7 review applies to both (§12B.4). The 0012 review (no. 6) approves no option.
3. No file is released under any option until C-1 is decided and the retention position is settled. R-D (temporary) keeps cleanup disabled (no. 4).
4. No reprint path exists for a completed or cancelled order. Creating one is a separate design and approval.

**Owner decision needed (not made here).** Choose option 1, 2, 3 or 4 for completion and refund behaviour. Decide whether cancellation after approval is needed at all, since 0001 does not reach it from `printing`. Decide whether a reprint path is needed.

### 12C. Agent token lifecycle: proposal (2026-11-04)

*Proposal only (2026-11-04 no. 8). Not approved for implementation. Rotation implementation is deferred until separately approved. No migration, function, agent or secret change is approved.*

**Current behaviour (read from 0010, not run)**
- Only the SHA-256 hash of an agent token is stored (`print_agents.token_hash`, line 28).
- `agent_for_token` (lines 166–186) checks the hash format and that the agent is not revoked. It checks no expiry and no idle time.
- `last_seen_at` is set by heartbeat (line 620) and by each claim (line 643). The "online" flag is true within 2 minutes (line 343).
- `revoke_print_agent` (lines 378–409) sets `revoked_at`.
- `agent_mark_printing` (line 688) and `agent_finish_job` (line 714) resolve the token through `agent_for_token`.
- Pairing codes expire after 10 minutes and are single-use (`consume_print_pairing`).

**Proposed policy**
1. **Idle expiry:** a token expires 30 days after its agent last checked in (`last_seen_at`).
2. **Maximum lifetime:** a token expires 180 days after it was issued, whatever the activity.
3. **Rotation overlap:** after a rotation, the old token stays valid for 10 minutes after the new one is issued.
4. **In-flight exemption:** a finish call (`agent_finish_job`) for a job claimed before expiry is accepted after expiry, so claimed work can still be closed.

Consequences that follow from expiry, to confirm: after expiry, new claims and heartbeats are refused, and the agent is re-paired with a new 10-minute pairing code.

**Not decided**
- Whether `agent_mark_printing` is also exempt after expiry. The owner's decision names only finish calls.
- Whether rotation is started by the owner or by the agent.
- What "in flight" means exactly. This proposal reads it as a job whose lease is still open (`claimed` or `printing`).

**Before any implementation (separate approval).** Change `agent_for_token` and the claim path; add a rotation function; change the agent to store and use the new token; add staging tests for idle expiry, the lifetime cap, the overlap window, a finish call after expiry for a claimed job, and a claim refused after expiry.

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

---

## 13. Revision log

### Owner decision record (2026-11-06): specification correction pass

Source: owner instruction on 2026-11-06 for a documentation and specification correction pass, based on the latest read-only review. Edits are limited to `STAGE7_DECISIONS.md` and `OWNER_DECISION_SHEET.md`. Not authorised: SQL, tests, staging, project creation, migration application or change, code, commit, push, PR, merge, deployment or APK build. `0011_licence_foundation.sql` and `CLAUDE.md` are unchanged.

| No. | Decision (2026-11-06) | Status | Recorded in |
|---|---|---|---|
| A | Replay payload hash: field list, server-side canonical encoding, SHA-256, `request_id` excluded; same hash is a replay, different hash is a conflict; a conflict that disappears on re-read fails safely | DECIDED. Legal review of identity-derived hashes OPEN | §12A.17 A |
| B | Custom-grant boundaries: date-only start inclusive and end exclusive at 00:00 Asia/Kolkata; half-open; not for calendar grants with timestamps | DECIDED | §12A.17 B |
| C | Extend: one calendar month or one calendar year only | DECIDED | §12A.17 C |
| D | Missing, unreadable or insufficient `aal` claim fails closed as a committed `forbidden` | DECIDED. Local and hosted staging verification OPEN; required before 7C sign-off; no evidence exists | §12A.17 D |
| E | Denial detail ceiling: 1,000 detail records per UTC hour, global; exact counts kept after the cap; the 20-per-actor limit kept | PROVISIONAL: staging and initial engineering default only. Production OPEN. No automatic alerting | §12A.17 E |

**Corrections made in this pass.** Earlier records are kept. Dated notes are added where the text was operative.
1. Custom-grant status made consistent (C2). Operative text changed in §12A.5, §12A.6, §12B.2 M4, §12B.11 and §15.3 (7C row). §14.5 M4 changed. Dated notes added to the 2026-11-04 and 2026-11-05 lists in this section. In the sheet: Parts 1D item 11, 1I A2, 1K, 1L and 10.
2. Undefined labels replaced with the labels they correspond to. D3 becomes B1-1 and B2-1. D5 becomes B2-2. D2 (extend lengths) is removed, because extend lengths are decided in §12A.17 C.
3. Stale line references corrected in the 2026-11-05 list and the advisory-lock row. The exact new positions are in the review report.
4. AAL references that cited licence-unit decision 1 now cite decision 14 (MFA and `aal2`): the 2026-11-05 list, the 2026-11-04 AAL record, and the 2026-11-02 O11 rows.
5. `payment_id` is removed from the `licence_coverages` column list in §12A.5. 0011 has no such column. A payment link is deferred with `paid_verified` (M5).
6. The `licence_lock_shop` signature is corrected to `(p_shop_id uuid, p_mode text)` in §12A.5.
7. The omitted-count reference is corrected to B3-2 in §12B.11. Superseded permission-count wording is removed from operative text (§12B.7, §12B.11 and sheet Part 10). It is kept in §13 and in sheet Part 1H for history.
8. The 90-day denial retention is described as a proposal subject to legal review (§12A.5, §12A.9, §12B.2 M8, §12B.8 and §14 item 15).
9. The replay conflict contract is stated in §12A.8 (e), §12B.5 R5, §12B.11 and sheet Part 1K (B1-1), following §12A.17 A and J.
10. The append-only description for the 0011 header is in §12A.17 O. The header itself is not edited. That change needs a separate approval.
11. The complete lock order, with the actor and global denial counters before the shop meta lock, is in §12A.17 F.
12. The global ceiling wording is updated to the provisional value (§12A.5, §12B.2 M3, §12B.7, §12B.11, §14, §15.3 and the sheet).

**Mandatory 7C RPC requirements added** (specification only, not implemented): §12A.17 G to M. These cover: no rollback of a committed `forbidden` result; the denial-path lock order; the ON CONFLICT predicates; UTC-hour alignment; safe replay under READ COMMITTED; the target shop check and `clock_timestamp()` after the lock; hardened SECURITY DEFINER; and sequence privileges. Future migration changes are recorded in §12A.17 N. None is made.

**Still OPEN after this record:** the items in §12A.17 Q.

**Not approved by this record:** 7C implementation, 7C staging, SQL and test execution, migration change or application, staging project creation, commit, push, merge and deployment.

### Owner decision record (2026-11-05): Stage 7C bundles 1 to 3

Source: owner instruction in this session on 2026-11-05 ("Proceed with the three approved Stage 7C decision bundles"). The authorisation covers documentation edits and the approved migration-file edit only. It does not approve 7C implementation, SQL, tests, staging, creating or configuring any Supabase project, applying the migration, committing, pushing, opening a PR, merging, deploying, building an APK, or changing the protected main checkout or stash.

Status of the edits: `0011_licence_foundation.sql` (untracked, not applied, not executed, not tested), `STAGE7_DECISIONS.md` and `OWNER_DECISION_SHEET.md` were edited on 2026-11-05. Nothing was committed.

| No. | Approved decision (2026-11-05) | Label | Recorded in |
|---|---|---|---|
| B1-1 | Replay design: Option L, the ledger as arbiter. The order is: isolation check, authorisation, shape and hash validation, shop existence, shop meta lock, replay lookup, business checks, ledger insert, operation writes, state_version increment, commit. READ COMMITTED is enforced for the relevant RPCs. If the ledger insert conflicts and the replay lookup finds no row, the RPC fails safely and never continues with writes. `request_id` stays globally unique. | Approved | §12A.8; 0011 header and rules |
| B1-2 | `licence_requests` has no `coverage_id`. `target_coverage_id` is added with an immediate FK, required for revoke and replace and forbidden for grant and extend. The created coverage is derived from `licence_coverages.request_id`. | Approved | §12A.5; 0011 |
| B1-3 | The canonical payload hash includes the caller UID and `shop_id`, with action, expected version, confirmation and reason. It excludes `request_id`. The caller UID is not stored as a separate ledger column. | Approved | §12A.5; §12B.8; 0011 |
| B1-4 | Replay response: action, created coverage ID where applicable, target coverage ID where applicable, and `state_version_after`. No mutable fields are returned. | Approved | §12A.8; §12A.5 |
| B2-1 | Only committed successful operations create replay-ledger rows. | Approved | §12A.5; §12A.8 (e) |
| B2-2 | `state_version` increments exactly once per committed successful admin operation. No increment for denials, rejected requests, replays or reads. | Approved | §12A.5; §12A.8; §12B.11 |
| B2-3 | No `auth.users` foreign key on denial or counter actor columns. The `platform_admins` foreign key is kept. | Approved | §12A.5; §12B.8; 0011 |
| B2-4 | No DELETE or TRUNCATE on denial or counter records until retention is approved. | Approved | §12A.5; §12B.8; 0011 guards |
| B3-1 | 0011 adds `licence_requests`, `licence_denials` and `licence_denial_windows`, with constraints, indexes, RLS, revokes and guards. Added to the file; not applied. | Approved; done in file | 0011 |
| B3-2 | Counter rows carry `denial_count` and `detail_count`. Omitted details = `denial_count − detail_count`. `detail_omitted_count` is not stored. `0 <= detail_count <= denial_count`. | Approved; done in file | §12A.5; §12B.7; 0011 |
| B3-3 | The actor-then-global counter lock order is preserved in the documentation: actor row, then global row, both before any shop meta lock, with no meta lock on the denial path. This records the invariant the owner asked to preserve. It is not implementation approval. | Documented | §12B.7; §12B.9; 0011 rules |
| B3-4 | Actor columns are plain `uuid` with no `auth.users` foreign key. | Approved; done in file | 0011 |
| B3-5 | `target_coverage_id` and its action-dependent constraint. | Approved; done in file | 0011 |
| B3-6 | Shop meta guard enforces `NEW.state_version = OLD.state_version + 1` on each update, without changing the other approved checks. | Approved; done in file | 0011 guard |

**Superseded wording, resolved by this record:**
- State-version wording at l.476, R2, §12B.11 and the 0011 header is replaced by B2-2.
- The replay ledger wording at l.479, the R5 idempotency row and §12B.8 is replaced by B1-1 to B1-4 and B2-1.
- Whether a business rejection writes a replay-ledger row (l.1179, l.533): no row (B2-1).
- Whether a denied request increments `state_version` (l.534, l.1219): no (B2-2).
- The earlier proposal to replay before the shop meta lock (not approved): replaced by B1-1. Replay now follows the shop meta lock.
- The actor FK question (Q4, withdrawn): resolved by B2-3.
- The denial detail cap: now uses `denial_count` and `detail_count` (B3-2).

**Still OPEN, not approved by this record:**
- Global denial-detail ceiling G. No value was set on 2026-11-05. A provisional value of 1,000 per UTC hour was recorded on 2026-11-06 (§12A.17 E). The production value remains OPEN. The per-actor cap of 20 is unchanged.
- Custom-grant date convention, including whether the end date is inclusive. The 00:00 IST text in M4 is not approved. *Clarified 2026-11-06:* decided (§12A.17 B): date-only start inclusive and end exclusive at 00:00 IST. Extend period lengths: decided 2026-11-06 (§12A.17 C). This list is kept for history.
- Retention periods for denial rows, counters, the replay ledger and the audit log (legal review, DPDP).
- Meaning of "before 7C", and whether hosted or local AAL verification is required (decision 14).
- Handling of a missing or unreadable `aal` claim (§12A.8 AAL2 item ii). *Clarified 2026-11-06:* decided, fails closed (§12A.17 D).
- Pre-staging review of 0011 (O2). Not done.
- Recovery procedure (A3) and break-glass text (O7).
- The advisory-lock admin contract (l.1333) stays NOT APPROVED. This record does not use it.
- Single-update enforcement: the guard checks each update to `shop_licence_meta`. It does not count updates per transaction. The 7C RPC must perform exactly one update per committed operation (see 0011 guard comment).

### Owner decision record (2026-11-04)

Source: owner instruction in this session on 2026-11-04, ten items, numbered 1 to 10 here. These are decisions only. They approve no implementation, SQL, migration change or application, staging setup or run, project creation, test execution, deployment, secret change, commit or push. Each gate named below needs its own explicit approval.

| No. | Decision (2026-11-04) | Label | Recorded in |
|---|---|---|---|
| 1 | O4 scope: option A. Overlapping grants of the same kind are rejected. A lifetime grant over an admin grant stays allowed. Lifetime-revocation exposure documented. | New. Closes the O4 scope point. | §12A.6; sheet Part 1H; O4 rows in §13 |
| 2 | O9: corrected wording approved. Denials are counted; no automatic refusal; alerting is not approved, implemented or claimed; the threshold and mechanism remain OPEN. | New. Approves the corrected CHANGED wording. | §12B.7; §13 O9 rows; §15.3 7C row |
| 3 | O10: the visible omitted-detail marker is approved. Permission-rejected calls are counted within the approved staging cap; no automatic refusal; the overflow-count behaviour is preserved. | Marker: new. Overflow count: previously approved 2026-11-02. Permission-rejected counting: new; supersedes "not counted" for staging. Superseded again for staging by the 2026-11-04 Stage 7C record (B2): not counted. | §12B.7; §12B.11; §13 O10 rows |
| 4 | Retention: option R-D selected TEMPORARILY. Cleanup stays disabled until C-1/M1 has legal review and an owner-approved retention policy. Not final policy. | New. Temporary. | §12A.10; §12B.8; §12B.9 C-1; §14.2 items 1 and 27; §14.3 C-1; §15.3 M1 |
| 5 | Legal review is required for customer-file retention and related obligations. | New confirmation. Lawyer rows already listed. | §14.2 items 1, 15 and 30; §14.3 C-1; §15.3 M1 |
| 6 | Migration 0012 (local main, unmerged): read-only review only. No implementation, SQL, staging application or deployment. | New. | §12B.4; §12B.2 M7; §14.2 items 23 and 24 |
| 7 | Completion behaviour: not decided. Comparison prepared for owner approval. | New. Deferred. | §12B.13 |
| 8 | Agent token: proposed 30-day idle expiry, 180-day maximum lifetime, 10-minute rotation overlap, in-flight exemption for finish calls after expiry. Rotation implementation deferred until separately approved. | New proposal, not decided. | §12C |
| 9 | Staging: NOT approved. O12 cost and setup report provided first. | New. The O12 approach was previously approved; no setup is approved. | §12D; §13 O12 rows |
| 10 | Live database queries: NOT approved. The owner checks migration state and live jobs through the dashboard. | New. | §14.2 items 25 and 26 |

**Counts and approvals.** No item changed status, and the §14.2 counts are unchanged. Earlier approvals are not withdrawn. Where this record supersedes earlier wording for staging (O9 "count and alert"; O10 "not counted"), the earlier text is kept and annotated.

**Correction.** The §15.3 7C row read "O9: counted and alerted". It now reads the decided wording (no. 2).

### Status correction (2026-11-02): 7B-2 implementation

*Corrected 2026-11-02.* Earlier wording in this file and in `OWNER_DECISION_SHEET.md` described 7B-2 as NOT approved or waiting for approval. That wording was stale. The accurate status is:

- **7B-2 implementation was approved on 2026-11-01**, under the owner's instruction of that date to implement only Stage 7B-2 under the approved R18 design. Scope: `shop_licence_meta`, its guard (`shop_licence_meta_guard`), and `licence_lock_shop()`. Nothing else is covered.
- The draft is in `supabase/migrations/0011_licence_foundation.sql`, untracked on `stage7-payments`. It is not applied, not tested and not committed.
- **Not approved:** staging verification of 7B-2, SQL execution, database access, staging setup and runs, and migration application. Each needs its own approval.
- **R18 implementation: NOT APPROVED.** The R18 lock-order design is approved (third record, 2026-11-01). That approval does not cover R18 implementation or the two-session tests.
- The O1–O13 proposals in the 2026-11-02 section below were decided by the owner on 2026-11-02 (see the decision record in that section). The 2026-11-02 migration-placement approval (decision 3) is unchanged.

### Owner decision record (2026-11-04): Stage 7C, A1 to A5 and B2

Source: owner approval in this session on 2026-11-04 of six Stage 7C decisions, recorded as the owner stated them. These are decisions only. They approve no 7C implementation, staging setup or run, test, SQL, migration change or application (including adding `licence_requests`, `licence_denials` or `licence_denial_windows` to `0011_licence_foundation.sql`), staging project creation, commit, push, merge or deployment. The 2026-11-02 approvals O1 and O2 are unchanged: the separate `licence_denial_windows` table and its placement in `0011` stay approved. Exact schema and migration changes still require review.

| ID | Owner decision (2026-11-04) | Status | Conditions, effect and where recorded |
|---|---|---|---|
| A1 | Admin grant over lifetime: different-kind grants may coexist. Same-kind overlap restrictions remain. Lifetime coverage takes precedence. | DECIDED | The overlap check rejects same-kind overlaps only. Basis ranking is unchanged (§12A.6, ACTIVE rule 1). Recorded in §12A.6 (A1 paragraph). |
| A2 | Calendar-based grants keep the start's clock time, with Asia/Kolkata month-end clamping. | DECIDED for 1-month and 1-year grants | Custom-grant boundaries: OPEN. The owner has not decided whether a custom start or end keeps a clock time or uses midnight. The 00:00 IST convention in M4 is not treated as decided. Recorded in §12A.6 (Operations) and §12B.2 M4. *[Clarified 2026-11-06: custom-grant boundaries are DECIDED, §12A.17 B.]* |
| A3 | Written emergency-disable, DB-owner break-glass and admin recovery procedure, required before 7C implementation sign-off. | DECIDED (timing) | Not required before 7C implementation starts. The procedure is not yet written, and its text needs owner approval. §12A.3, §12A.8. |
| A4 | Authorisation failures return a committed `forbidden` result, are logged to `licence_denials` and count toward the authorisation-denial counter. Other validation and business rejections return specific committed codes and are not counted as authorisation denials. | DECIDED | Code names are set in implementation review. §12A.8, §12B.7, §12B.11. |
| A5 | Staff receive no licence information. The owner-facing RPC returns only the approved D fields. Presentation labels belong to 7E. | DECIDED | Closes the staff-visibility point (§12B.2 D; sheet Part 2, Dec 19). Label wording, the admin-grant label and Android (item 13) remain open. |
| B2 | No anon-callable counting wrapper. Calls rejected before RPC execution remain uncounted for staging. The limitation is documented. Staging test expectations are adjusted, subject to separate staging approval. | DECIDED. Staging approval still needed | Supersedes the 2026-11-04 no. 3 counting approval for staging only. §12B.7, §12B.11. Production C-12 remains OPEN. |

**Earlier text superseded or corrected by this record (kept and annotated in place):**
1. 2026-11-04 no. 3 (permission-rejected calls counted within the staging cap): superseded for staging by B2.
2. The 2026-11-02 gate list read "7C implementation. It requires ... the O6 emergency procedure, the O7 break-glass approval". Corrected by A3: both are required before 7C implementation sign-off.
3. The 2026-11-04 "must confirm" on an admin grant over a lifetime grant (§12A.6): resolved by A1.
4. The staff-visibility open point (§12B.2 D; sheet Parts 2 and 10): closed by A5.
5. The timestamp decision in the 2026-11-02 gate list: decided for calendar-based grants by A2. Custom-grant boundaries remain OPEN. *[Clarified 2026-11-06: custom-grant boundaries are DECIDED, §12A.17 B.]*

**Remaining 7C blockers after this record**

Blocks 7C implementation start:
- An explicit 7C implementation approval (separate).
- Adding `licence_requests`, `licence_denials` and `licence_denial_windows` to `0011`: done on 2026-11-05 under bundle 3 (unapplied). The pre-staging review (O2; §12A.5; sheet Part 1D item 3) is still required.
- Admin RPC lock order (R18 rules 1 to 3, §13 third record). Rule 1 names `rate_limits` only. The denial-counter lock order (actor row, then global row, both before any meta lock) is recorded as an invariant (2026-11-05, bundle 3). That record is not implementation approval. R18 implementation beyond 7B-2 is not approved.
- Custom-grant boundary semantics (A2). The owner has not said whether this blocks implementation. Until the owner classifies it, the custom-grant path is treated as blocked. *[Clarified 2026-11-06: decided (§12A.17 B). This item no longer blocks the custom-grant path.]*
- Extend period lengths: not specified in this file. The calendar rule in A2 applies only if extend uses calendar periods. *[Clarified 2026-11-06: extend is one calendar month or one calendar year only (§12A.17 C).]*
- Whether a business rejection writes a replay-ledger row: resolved 2026-11-05 (B2-1). It writes no row, as for denials (2026-11-02 item 7).
- Code names for specific rejections (A4): set in implementation review.

Blocks 7C implementation sign-off (not implementation start):
- The A3 procedure written and approved: emergency disable, DB-owner break-glass, admin recovery.
- Hosted verification of the `aal` claim and recovery (O11; execution not approved).

Blocks 7C staging only:
- Hosted staging project (O12; §12D). The owner confirms the organisation's plan and chooses the option. Creation not approved.
- Provisional staging denial ceiling value (Part 4 item 15, option (a)): no value was set on 2026-11-04. Set 2026-11-06 at 1,000 detail records per UTC hour (§12A.17 E), provisional and not a production decision.
- Staging test expectations for B2 and A4 (§12B.11), run only under separate staging approval.
- Item 33 two-session tests (R18). Separate approval.
- Synthetic admin account, and applying 0010 to a staging copy: each separate approval.
- Pre-staging review of 0011 (O2).

Blocks production only:
- Backdating window (decision 5). Staging is 31 days (O8).
- Denial ceiling value, threshold and alert mechanism (O9). Alerting is not approved.
- Final C-12 acceptance.
- Lawyer review: denial retention (90 days), replay-ledger retention, audit retention, and DPDP handling of actor UUIDs (decision 20; M8).
- Production admin Auth UUID and MFA status (item 5); admin count (decision 13).
- Production migration list (item 26) and live function signatures (item 25), checked by the owner in the dashboard (2026-11-04 no. 10).

Not changed by this record: §14.2 statuses and counts; 7D hosting; 7E labels and Android; the paid path (M5); printing items 23 and 24.

**Not approved by this record:** 7C implementation; 7C staging; SQL and test execution; migration changes and application; staging project creation; commit, push, merge and deployment.


### Owner decision record (2026-11-04): AAL2 failure handling

Source: owner instruction in this session on 2026-11-04. This is a decision only. It approves no 7C implementation, staging setup or run, test, SQL, migration change or application, staging project creation, commit, push, merge or deployment.

| ID | Owner decision (2026-11-04) | Status | Conditions and where recorded |
|---|---|---|---|
| AAL2-1 | An admin RPC request that fails the required AAL2 assurance check is an authorisation failure. | DECIDED | Consistent with the A4 response contract. Recorded in §12A.8 (AAL2 failure bullet). |
| AAL2-2 | It returns a committed `forbidden` result. | DECIDED | Committed, as R3 requires. |
| AAL2-3 | It is logged to `licence_denials` and counted toward the authorisation-denial counter (`licence_denial_windows`). | DECIDED | Detailed rows are subject to the 20-per-user-per-hour cap, with counts kept above it (§12B.7). Not written to the replay ledger (2026-11-02 item 7) or to `licence_audit_log` (§12A.9). |
| AAL2-4 | The protected admin operation is not executed. | DECIDED | The denied request writes no coverage, audit or replay-ledger row. |

**Still open after this record (not decided):**
- Resolved 2026-11-05 (B2-2): a denied AAL2 request does not increment `shop_licence_meta.state_version`.
- Handling of a missing or unreadable `aal` claim. The owner's decision does not address it expressly. *[Clarified 2026-11-06: decided, fails closed (§12A.17 D).]*
- Hosted and local verification of the `aal` claim (R16, S-3, O11; decision 14). Local verification remains OPEN.
- The recovery procedure required by A3 (2026-11-04). Its text is not written.

**Not changed by this record:** §14.2 statuses and counts; the 2026-11-02 and 2026-11-04 approvals.

**Not approved by this record:** 7C implementation, 7C staging, SQL and test execution, migration changes and application, staging project creation, commit, push, merge and deployment.


### Owner decisions (2026-11-02): Stage 7C recommendations (OWNER-APPROVED)

Source: owner approval given in a ChatGPT conversation on 2026-11-02, in direct response to the Stage 7C recommendations: "Continue, i approve". Recorded here at the owner's instruction.

This record approves the decisions below, and nothing else. It does **not** approve 7C implementation, SQL execution, staging setup or tests, migration application, commit, push, merge or deployment. 7B-2 implementation, R18 implementation and the two-session tests keep their existing status. No earlier decision or date is changed.

| # | Decision (OWNER-APPROVED, 2026-11-02) | Conditions and OPEN items | Applied to |
|---|---|---|---|
| 1 | AAL2: `aal2` is required for every platform-admin RPC. | OPEN: a verified recovery procedure if the admin loses the TOTP factor; hosted and local verification of the `aal` claim (R16, S-3). Both remain prerequisites before 7C. *Timing clarified 2026-11-04 (A3):* the recovery procedure is required before 7C implementation sign-off, not before implementation starts. Hosted and local verification of the `aal` claim is not changed by this clarification and remains a separate prerequisite before 7C. | Decision 14; item 5; §12A.4; §12A.11 |
| 2 | Item 15: option (a), a provisional ceiling for staging only. | OPEN: the production ceiling value; the remaining C-12 and item 15 details. The §15.3 7C row now separates staging from production (this pass). | Item 15; C-12; §15.3 |
| 3 | Migration placement P1: `licence_requests` and `licence_denials` are included in `supabase/migrations/0011_licence_foundation.sql`. | Annotated 2026-11-05 (bundle 3): all three tables are now in 0011. Not applied. Pre-staging review (O2) is still required. | §12A.12 7B; §15.3 7B |
| 4 | Lifetime grants: admin-only. | Replaces the earlier "owner-only" recommendation. Under 0011 as written, any platform admin can grant lifetime, because no role column exists. | Decision 16; item 7 |
| 5 | Backdating: explicit confirmation required. | OPEN: the maximum backdating window. | Decision 16; item 7 |
| 6 | Extend: rejected while lifetime coverage is active. | Not addressed by this record. The start rule is O3 (later record below). | §12A.6; §12B.11 |
| 7 | Denied requests: not written to the replay ledger. A later valid request may reuse the same request ID. | Denial rows (detail or count) are unchanged. | R5; M3; §12B.7 |
| 8 | Request ID scope: globally unique. | Replay matching rules are not restated here; they stay as in R5. | R5; §12A.8 |
| 9 | Global enforcement audit (`enforcement_change`): deferred to 7F. | Out of 7C scope. No change to 0011 from this decision. | §12A.9; §15.3 7F |
| 10 | Lock enforcement: no GUC marker. No lock-acquiring trigger, unless staging evidence shows a gap and a separate 7B-2 amendment is approved. | OPEN: that staging evidence and that amendment. | R18; §13 third record |
| 11 | Admin grant arithmetic: Asia/Kolkata calendar arithmetic. | OPEN: month-end clamping, and exact timestamp behaviour. | M4; fix 10; §12B.11 |

**Still OPEN after this record (not decided):**
- The maximum backdating window.
- The AAL2 recovery procedure, and hosted and local verification of the `aal` claim. *A3 (2026-11-04): the written procedure is required before 7C implementation sign-off. Its text is not yet written.*
- Admin grant month-end arithmetic confirmation (clamping and exact timestamp behaviour). *A2 (2026-11-04): clamping (O5) and clock-time behaviour for calendar grants are decided. Custom-grant boundaries remain OPEN as recorded. *Clarified 2026-11-06: decided (§12A.17 B).*
- C-12 and the remaining item 15 details, including the production ceiling value.
- Legal review of production retention and personal-data handling (decision 20; M8; S-6; items 14 and 15).

**Status after this record:** 7C implementation NOT approved. 7C staging NOT approved. *Corrected 2026-11-02:* 7B-2 implementation APPROVED on 2026-11-01 for its scope only (§13, status correction). R18 implementation NOT APPROVED (unchanged). Two-session tests OUTSTANDING. Migration 0011 NOT applied, and this record does not edit it. Item statuses and counts in §14.2 are unchanged, because no item changed status.

### Proposed decisions (2026-11-02): decided by owner (see decision record below)

**Decided by owner, 2026-11-02.** These 13 items were proposals. Their decisions are in the status column below and in the decision record that follows. The decisions approve no 7C implementation, staging setup or runs, SQL execution, test execution, migration application, commit, push, merge or deployment. The approved 2026-11-02 record above is unchanged, including decision 3 (migration placement).

| # | Proposal | Status | Relation to approved decisions and open points |
|---|---|---|---|
| O1 | Use a separate `licence_denial_windows` table for licence denial counters. | DECIDED 2026-11-02: APPROVED | Would replace the `consume_rate_limit` counter design in §12B.7. Applied to §12B.7, §12A.5 and §12B.2 M3. Placement: O2. |
| O2 | Keep the 2026-11-02 placement: `licence_requests` and `licence_denials` stay in `0011_licence_foundation.sql` and are not moved to a new migration. The `licence_denial_windows` table is proposed for the same file (approved as O2 below). | DECIDED 2026-11-02: APPROVED | Restates approved decision 3 for `licence_requests` and `licence_denials`. Extended to `licence_denial_windows` by the decision record below (O2). The tables were not yet in the file on 2026-11-02. Annotated 2026-11-05: they are now in 0011 (bundle 3). |
| O3 | Extend starts at `greatest(v_now, latest non-revoked coverage end)`. | DECIDED 2026-11-02: APPROVED | Fills the open start-rule point in decision 6. Applied to §12A.6 and §12A.11 in this pass. |
| O4 | Reject overlapping grants and duplicate non-revoked lifetime grants. | DECIDED 2026-11-02: APPROVED WITH CONDITION | No rule existed for either case. The half-open test is documented in §12A.6. Scope to confirm: whether O4 applies to same-kind grants only, since lifetime over admin stays allowed (item 7). Scope decided 2026-11-04 (no. 1): same-kind grants only. |
| O5 | Accept PostgreSQL month-end clamping for admin grant arithmetic. | DECIDED 2026-11-02: APPROVED | Partly fills decision 11. The exact timestamp behaviour stays OPEN. |
| O6 | Defer admin disable from 7C. | DECIDED 2026-11-02: APPROVED WITH CONDITION | Applied to §12A.8, §12A.12 and §15.3 in this pass: admin disable is outside 7C. |
| O7 | Break-glass writes require a documented lock-first procedure: `licence_lock_shop()` is called before any write. | DECIDED 2026-11-02: CHANGED | The break-glass procedure is not written here, and needs separate owner approval before 7C sign-off (O7). Decision 10 (no GUC marker, no lock-acquiring trigger) is unchanged. |
| O8 | Staging backdating window: 31 days, staging only. | DECIDED 2026-11-02: APPROVED (staging only) | The production window stays OPEN (decision 5). |
| O9 | Staging denial ceiling: count and alert, with no automatic refusal. | DECIDED 2026-11-02: CHANGED | Applied to item 15, §12B.7 and §15.3 in this pass. Alerting is not implemented or claimed. The numeric ceiling stays undecided. Item 15 stays on option (a) (decision 2). The phrase "count and alert" in this proposal is superseded (2026-11-04 no. 2). |
| O10 | Accept the C-12 limitations for synthetic staging only. The limitations: above 20 detailed denial rows per user per hour, only counts are kept; calls rejected by the permission check before the function runs (for example anon, which has no EXECUTE on admin RPCs) are not counted. | DECIDED 2026-11-02: APPROVED WITH CONDITION (synthetic staging only) | Overflow is recorded as a count per window with a visible omitted-detail marker. Not accepted for production. The production C-12 position stays OPEN. 2026-11-04 (no. 3): the "not counted" limitation above is superseded for staging. Permission-rejected calls are to be counted within the cap; the counting mechanism is OPEN. Superseded for staging 2026-11-04 (B2): not counted. |
| O11 | Verify the AAL2 requirement and the recovery procedure using hosted staging. | DECIDED 2026-11-02: APPROVED, OBJECTIVE ONLY | Local verification of the `aal` claim is not covered and stays OPEN (decision 14). |
| O12 | Use a hosted staging project for SQL and staging tests (recommended). | DECIDED 2026-11-02: APPROVED, APPROACH ONLY | No project, credentials or setup are approved. |
| O13 | Approve the proposed staging test scope, including the R18 two-session tests (item 33). | DECIDED 2026-11-02: APPROVED, TEST SCOPE ONLY | Subject to separate setup approval and separate execution approval. Two-session tests stay OUTSTANDING. |

**Status after these decisions:** the gates in the decision record below remain outstanding. The status of 7C, staging and production is otherwise unchanged from "Status after this record" above.

### Owner decision record (2026-11-02): O1–O13 confirmed

Source: owner confirmation in this session on 2026-11-02 of the draft decision record of the same date, including its four clarifications. These are decisions only. They approve no implementation, staging, setup, SQL, test execution, migration application, commit, push, merge or deployment. Each gate listed below needs its own explicit approval.

**Approved decisions**

| ID | Owner decision (2026-11-02) | Conditions and limits | Outstanding gate |
|---|---|---|---|
| O1 | APPROVED. A separate `licence_denial_windows` table holds licence denial counters per actor and globally, per UTC hour. It replaces the `consume_rate_limit` design for licence denials (§12B.7). | Counts only. Print rate limits are unchanged. | 7C implementation |
| O2 | APPROVED. `licence_denial_windows` is placed in `0011_licence_foundation.sql` with `licence_requests` and `licence_denials`, extending the 2026-11-02 placement (decision 3). | Pre-staging review of 0011 is required. This record does not edit 0011. | Pre-staging review; 7C implementation |
| O3 | APPROVED. Extend starts at `greatest(v_now, latest non-revoked coverage end)`. | Closes the start-rule point left open in decision 6. §12A.6 wording is corrected at implementation. | 7C implementation |
| O4 | APPROVED WITH CONDITION. Overlapping grants and duplicate non-revoked lifetime grants are rejected. | Before 7C implementation sign-off, the half-open overlap rule is explicitly documented. During separately approved staging, the rule is tested. Scope to confirm before 7C sign-off: whether O4 applies to same-kind grants only (§12A.6). Scope decided 2026-11-04 (no. 1): same-kind grants only. | Rule documentation before 7C sign-off; staging test |
| O5 | APPROVED. PostgreSQL month-end clamping for admin grant arithmetic. | The exact timestamp behaviour remains OPEN (decision 11). | 7C implementation; timestamp decision |
| O6 | APPROVED WITH CONDITION. Admin disable is deferred from 7C. | Before 7C implementation sign-off, a documented emergency disable and recovery procedure is required. Break-glass SQL remains the only disable route until then. | Procedure approval before 7C sign-off |
| O7 | CHANGED. Normal licence writes go only through the internal SECURITY DEFINER writer and the approved RPCs. Owner-role SQL discipline is not the normal security control. | Break-glass DB-owner access is documented in a separate procedure. That procedure needs separate owner approval before 7C implementation sign-off. This replaces the earlier "documented lock-first procedure" proposal as the normal control. | Break-glass procedure approval before 7C sign-off |
| O8 | APPROVED. 31-day backdating window, staging only. | The production window remains OPEN (decision 5). | Staging execution; production value |
| O9 | CHANGED. Denials are counted. There is no automatic refusal. | Alerting is not implemented and must not be claimed. The numeric threshold and the alert mechanism are OPEN. This replaces "count and alert" in the proposal. 2026-11-04 (no. 2): corrected wording approved; alerting is not approved, implemented or claimed. | Threshold and alert mechanism decision |
| O10 | APPROVED WITH CONDITION. C-12 limits accepted for synthetic staging only. | Overflow is recorded as a count per window, with a visible omitted-detail marker. Evidence is not silently discarded. Production C-12 remains OPEN. 2026-11-04 (no. 3): the omitted-detail marker is approved; permission-rejected calls are counted within the staging cap; no automatic refusal; the counting mechanism is OPEN. Superseded for staging 2026-11-04 (B2): not counted. | 7C implementation of the marker; staging evidence; production acceptance |
| O11 | APPROVED, OBJECTIVE ONLY. Verify the `aal` claim and recovery on hosted staging. | Execution is not authorised by this decision. Staging and execution are gated separately. Local `aal` verification remains OPEN (decision 14). | Hosted staging project (O12); execution approval |
| O12 | APPROVED, APPROACH ONLY. Hosted staging project. | Before creating any project, report the expected cost, plan and setup requirements for separate approval. No production data. | Project creation approval |
| O13 | APPROVED, TEST SCOPE ONLY. Staging test scope, including the R18 two-session tests (item 33). | Does not authorise staging setup, SQL execution or test execution. R18 implementation remains NOT APPROVED. | Setup, SQL execution and test execution, each separately |

**Outstanding gates (not approved)**

- 7C implementation. It requires: the O4 rule documentation, the O6 emergency procedure, the O7 break-glass approval, the timestamp decision (decision 11), and an explicit implementation approval. *Corrected 2026-11-04 (A3, A2): the O6 emergency procedure and the O7 break-glass approval are required before 7C implementation sign-off, not before implementation starts. The timestamp decision is partly made: calendar-based grants are decided (A2); custom-grant boundaries remain OPEN.* *[Clarified 2026-11-06: custom-grant boundaries are DECIDED, §12A.17 B.]* The O2 pre-staging review of 0011 is required before any staging run.
- 7C staging, including the R18 two-session tests (item 33).
- 7B-2 staging verification, which needs its own approval.
- Hosted staging project creation, after the cost and plan report.
- Staging setup, SQL execution and test execution.
- R18 implementation beyond 7B-2.
- Migration application, commit, push, merge and deployment.
- Production, all OPEN: backdating window; ceiling value; denial threshold and alert mechanism; legal review of 90-day denial retention and deletion, replay ledger retention, audit retention and DPDP; admin UUID and MFA status (item 5); production migration list (item 26); final C-12 acceptance.

**Preserved approvals (unchanged)**

- 7B-2 implementation, approved 2026-11-01, scope only.
- R18 design approved. R18 implementation NOT APPROVED.
- The 11 approvals of 2026-11-02 in the table above.
- No §14.2 status or count is changed by this record.

### Owner decisions (2026-11-01): baseline, C-5, items 7 and 8, Dec 16, renewal

Seven owner decisions recorded. They change statuses and scope. No code, test, SQL run, local setup, staging, commit, push, merge or applied migration is approved by this entry.

| Item | Change | Where applied |
|---|---|---|
| Baseline | Stage 7 uses origin/main (717717b lineage). Numbering starts at 0011. Local-main 0011–0014 stay separate and unmerged | §12A intro; §12A.12 7B; sheet Part 1A |
| C-5 | DECIDED. `paid_verified`, `licence_payments` and `trial` excluded from 7B | §12B.2 M5; §12B.9 C-5; §14.2 item 4; §14.3; sheet Part 3 |
| Item 8 | DECIDED: revocation keeps future coverage (C-8); REVOKED wins same-instant ties (fix 5); the end is exclusive (fix 9). Standalone paid revocation stays DEFERRED (decision 17) | §12B.2 G; §12B.5 fixes 5 and 9; §12B.9 C-8; §14.2 item 8; §14.3; sheet Part 3 |
| Item 7 | Basis ranking confirmed: lifetime over admin grant. Backdating and lifetime owner-only remain RECOMMENDED for 7C | §12A.6; §14.2 item 7; §12B.3 decision 16; sheet Part 3 |
| Dec 16 | Maximum custom length: none | §12B.3 decision 16; §14.2 item 7; §14.6 decision 16; sheet Parts 2, 4, 9 |
| Renewal | DEFERRED (decision 2). Does not block 7B. Item 16 moves RECOMMENDED to DEFERRED for the renewal part; its unit stays DECIDED | §9 item 2; §14.2 item 16; §14.6 decision 2; sheet Parts 1A, 2, 9 |
| Counts | 7 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 6 DEFERRED, 1 DECIDED (item 8). Total 35 | §14.2 |
| R18 boundary | Admin-side lock contract (advisory lock, then shop meta row, then payment) NOT APPROVED. 7B split: 7B-1 (file only, done) and 7B-2 (`licence_lock_shop()`, `shop_licence_meta`, waiting) | §12B.5 R18; §15.3 7B; sheet Parts 4, 8 |
| File | `supabase/migrations/0011_licence_foundation.sql` created on stage7-payments. Unapplied, not executed, not tested | §15.3 7B; §12B.12 item 4; sheet Part 8 |
| Corrections | §9 item 7 aligned to §14.6 decision 7 (RECOMMENDED). §12B.9 C-3 and §15.3 7F: the 7F gate requires C-1 answered and C-3 decided. Neither is answered or decided in this record (§14.3: C-1 EXTERNAL BLOCKER; C-3 RECOMMENDED). §12B.11 and §15.3 7E owner status: D fields whatever the enforcement state. §12B.11 regression: scope limited to the Stage 7 0011. §12B.4 R-a: 0006 body on the origin line, 0013 body on local main. Local main 0012 recorded as unreviewed | As listed |
| Open | Item 15 is circular: §15.3 needs the ceiling accepted before 7C, but its measurement needs the 7C denial log on staging. Owner to choose (a) or (b) in sheet Part 4. Not decided | §14.2 item 15; sheet Part 4 |
| Not changed | Item 1 (held-job file retention) keeps its status and is not the licence unit. Sub-parts of items 7, 8 and 13 keep their labels. Historical entries are not rewritten | — |

### Owner decisions (2026-11-01, second record): next start, C-9, service_role, p_at

Four owner decisions recorded (decisions 8 to 11). They change statuses and wording only. No code, migration change, test, SQL, database setup, staging, commit, push, merge or applied migration is approved by this entry. R18 is not decided: the admin-side lock contract stays NOT APPROVED.

| Decision | Change | Where applied |
|---|---|---|
| 8: ACTIVE `next_start` | `next_start` is shown only in SCHEDULED. In ACTIVE it is NULL, as migration 0011 already returns. Fix 6 is resolved. The Dec 19 label questions stay open | §12A.4 shop read; §12A.6 item 1; §12B.2 D; §12B.5 fix 6; sheet Parts 1B, 2 |
| 9: C-9 | Replacement wording adopted (§12B.9). The superseded passages are in §9 item 7 only; the cross-reference to §12A.10 is removed (§12A.10 keeps its own A, B, C note). B keeps its condition (C-1, C-3) | §12B.9 C-9; §14.2 item 13; §14.3 C-9; sheet Part 1B |
| 10: `service_role` | Stays revoked from the three licence tables and the helper functions in 0011. This differs from 0010 by design. The owner review note is closed | §12A.4 Database; sheet Part 1B |
| 11: `p_at` | Owner-facing state reads use the current time only. Historical state queries are not supported; history comes from `licence_audit_log` | §12A.6 intro; §12B.5 R14; sheet Part 1B |

### Owner decision (2026-11-01, third record): R18 lock-order contract, design only

The owner accepted the final R18 lock-order contract as an approved **design** decision. **Design approval is not implementation approval.** It authorises no code, SQL, migration, function, printing change, test, staging run, local setup, commit, push, merge or deployment. Each item below keeps its own gate. Nothing here has been built or tested. Counts are unchanged; item 33 stays an IMPLEMENTATION GATE.

**Contract.** Acquire locks in ascending order: **shop meta row → order → agent → jobs (ascending id).** The advisory lock in the earlier R18 design is removed. The meta row is the only shop-level lock.

Rules:

1. **Rate limits first.** A rate-limit call runs before any meta lock, in its own statement or transaction. The `rate_limits` row is never locked while a meta, order, agent or job lock is held.
2. **Admin licence writes (7C).** Insert the meta row with `INSERT … ON CONFLICT DO NOTHING`, lock it with `SELECT … FOR UPDATE`, then write the coverage and audit rows. Admin writes take no order, agent or job lock.
3. **No coverage without meta.** A `licence_coverages` row, and its audit row, is written only when the shop's meta row exists and is locked in the same transaction. A missing meta row means no coverage: `shop_licence_state` returns NONE, and print gates treat it as NONE.
4. **Print gates (claim and mark, 7F).** Insert the meta row if it is missing, lock it `FOR SHARE`, and only then read `shop_licence_state` and take any agent or job lock. In claim, this comes before the first agent write (0010 line 643).
5. **Retry (item 23).** Read the source job's `order_id` without a lock. Then lock the meta row `FOR SHARE`, the order `FOR SHARE`, and the job `FOR UPDATE`. Re-check the job, order and payment status after the locks. This replaces the job-first order (0010 lines 515 and 530).
6. **Refund R-a (item 24).** Lock the order `FOR UPDATE`, then the shop's affected jobs in ascending id. R-a takes no meta lock. It is safe only with rule 5 in place, because retry and refund then both take the order before the jobs.
7. **Paid path (M5).** Meta before order. Excluded from 7B and not approved.
8. **Approve (`approve_order_for_print`).** Takes the order lock only, as now, and no meta lock. If a licence check is ever added to approve, the meta row must be locked before the order. Whether approve checks licence is a 7F question, not decided here.
9. **Heartbeat, revoke and finish.** Agent then jobs, unchanged. None of them takes the meta row.
10. **Recovery.** Each of the three statements in `recover_expired_print_jobs` selects its rows `FOR UPDATE SKIP LOCKED` in ascending id, so recovery never waits on a row another session holds. It needs its own printing approval and M7 review.

**Function requirements.** These are design requirements. Each row needs its own implementation approval.

| Function (0010 unless stated) | Requirement | Gate |
|---|---|---|
| `licence_lock_shop()` and `shop_licence_meta` (new, 7B-2) | Rules 2 to 4: insert-if-missing and lock. No advisory lock | Approved for implementation 2026-11-01 (7B-2 scope only). Staging and application need separate approval |
| Admin licence RPCs (new, 7C) | Rules 1 to 3 | 7C approval; item 15 ceiling; staging test first |
| `agent_claim_next_job` (630–685) | Rule 4 before line 643; rule 10 for the recovery call at line 644 | 7F approval; rule 10 under printing approval |
| `agent_mark_printing` (688–709) | Rule 4 before line 699 | 7F approval |
| `retry_print_job` (502–549) | Rule 5 | Item 23: M7 diff review first, then approval |
| Refund R-a (`set_order_payment` refund branch, 0006 213–242) | Rule 6 | Item 24: after item 23; owner chooses R-a, R-b or R-c; separate approval |
| `recover_expired_print_jobs` (189–227) | Rule 10 | Printing approval; M7 review |
| `approve_order_for_print` (439–498) | No change under this contract (rule 8) | 7F, only if a licence check is added |
| `revoke_print_agent`, `agent_heartbeat`, `agent_finish_job` | No change, except that heartbeat calls the recovery in rule 10 | Rule 10 only |

**Two-session tests.** Staging only. Each run needs its own approval. The target is zero `40P01` deadlocks across all runs.

1. Claim vs admin revoke, one shop: claim waits or sees REVOKED; no deadlock.
2. Mark vs revoke: mark refuses once revoke commits; revoke returns the claimed job to the queue.
3. Two admin revokes of one coverage: the second is rejected by the guard.
4. Recovery vs recovery, two agents, one shop, expired rows: no deadlock over repeated runs.
5. Revoke vs recovery on the same expired rows, in both orders: no deadlock.
6. Retry vs approve on one order: retry waits, then sees `printing`.
7. Retry vs refund: no print is queued for a refunded order; no deadlock.
8. Two retries of one job: exactly one new attempt row.
9. Claim vs mark or finish on one job: claim skips the locked job and does not wait.
10. First coverage grant vs claim, no meta row yet: no deadlock; claim sees the state either before or after the grant, never a mix.
11. `place_order` vs purge of one customer file: no deadlock.

**Remaining blockers.** None is cleared by this record.

- 7B-2 (`licence_lock_shop()` and `shop_licence_meta`): implementation approved on 2026-11-01 for that scope only. Each other row of the function table still needs its own implementation approval.
- Item 23 (M7 diff review) before the retry change. Item 24 after item 23 and the R-a, R-b or R-c choice.
- Printing approval for rule 10, with the M7 review.
- Rule 8 decision: whether approve checks licence (7F).
- 7F gate, unchanged: C-1 answered; C-3 decided; S-4 accepted; item 32 kill-switch design approved; item 25 live signatures; S-5 local test.
- Item 15 circularity, still open (a 7C prerequisite).
- Staging copy with 0010 applied, and 0011 once approved. Local setup (Option A or B) and Decision L, each with its own approval.

**Status.** R18: design APPROVED (2026-11-01). Implementation NOT approved. Two-session tests OUTSTANDING. The earlier designed order in §12B.5 R18 is superseded by this contract.

### Owner decision 1: licence unit (2026-10-31)

| Item | Change | Where applied |
|---|---|---|
| Decision 1 approved | Owner decision recorded: "QRquick licences are issued per shop. Each individual shop requires its own licence. A single owner account may manage multiple shops, but licensing one shop does not automatically license the others. Changing the printer computer does not change the licence." Status DECIDED (no open condition). The §14.0 DECIDED rule now also cites §13 | §9 item 1; §14.0; §14.6 decision 1 |
| Item 16 | Stays RECOMMENDED, because the renewal rule (decision 2) is still open. *Superseded 2026-11-01: renewal DEFERRED by owner decision 7; see the block above.* The unit no longer blocks 7B | §14.2 item 16; §15.1 owner row; §15.3 7B row and owner-inputs list; §16 Q6 |
| Counts | Unchanged for items 1–35: 9 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 5 DEFERRED, 0 DECIDED | §14.2 |
| Not changed | No code, migration, test, production setting or gate approved. Historical log entries are not edited | — |

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
| Correction: decision 19 fields and labels | Owner-only status fields are approved (§12B.2 D). Labels, the admin-grant label and staff visibility stay open. Staff visibility closed 2026-11-04 (A5). The Android view is DEFERRED, with a reopening trigger | §14.2 item 13; §14.6 decision 19 |
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
| C-1, C-3, C-6 and item 2 | §15.1 has a table of which gates need each answer and how each one closes. C-1 comes before the owner's C-3 decision (item 1), so the 7F build now requires "C-1 answered, C-3 decided". Item 11 is needed before enabling only, as §15.3 already said | §15.1; §15.3 gate 7F; §16 Q6 |
| Decision 9 | §9 item 9 changed from PENDING OWNER APPROVAL to DEFERRED (§14.6 decision 9). The gateway is not reopened, and nothing is approved. The Phase 2 dependencies item now matches. Status unchanged | §9 item 9; §10 item 5 |
| Decision B | Register status changed from DECIDED to EXTERNAL BLOCKER, because its condition (item 1) is open. §14.0 says a conditional approval is not DECIDED while its condition is open. Decision E stays DECIDED, since it is an unconditional design approval | §14.0; §14.1 row B; §12B.1 legend |
| Counts and verdict | No item status changed. §14.2 counts are unchanged: 10 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 4 DEFERRED and 0 DECIDED (total 35). Verdict unchanged: READY FOR FINAL OWNER REVIEW; NOT APPROVED | §14.2; §16.2 |
| Known mismatch, resolved 2026-10-31 (owner instruction 4) | §9 item 5 (trial) said PENDING OWNER APPROVAL while decision 5 was DEFERRED. Now DEFERRED, with trial terms not approved | §9 item 5 |

### Consistency correction (2026-10-31)

| Item | Change | Where applied |
|---|---|---|
| Processor and paid-path dependencies | Item 4 names two answers that come before pricing: the CA's tax answer (item 18) and the owner's collection-channel answer. Item 17 stays DEFERRED. It is a pricing prerequisite only if a named processor is chosen, and then only for eligibility evidence and fee basis. Dependency note added. Decision 3, decision 9 and row I aligned. The paid-path gate lists items 3, 4, 7, 10, 14, 16 and 18, and M6 tests | §14.1 I; §14.2 items 4, 17; dependency note; §14.6 decisions 3, 9; §15.3 paid path and gateway rows |
| 7B grant-limit dependency | Backdating, durations and lifetime owner-only are 7C validation, not 7B schema prerequisites. Maximum custom length is decided as none (owner decision 6, 2026-11-01). The 7B owner inputs are listed: C-5, item 8, item 16 (unit) and the item 7 basis ranking. Item 7 states that the 7B schema does not check `starts_at` against `created_at` | §14.2 items 7, 8, 16; §14.6 decision 16; §15.3 gates 7B and 7C; owner-inputs note |
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
| §9 item 2 and M4 | 12-month paid term approved as policy (M4); paid path blocked (M5). Renewal is DEFERRED (owner decision 7, 2026-11-01); stacking remains a recommendation (C-4) | §9 item 2; §14 items 3, 16 |
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

- **DECIDED:** approved by the owner in this file (§12B.2, §12B.3 or §13) with no open condition. Any implementation still needs its own gate. A conditional approval (APPROVED, CONDITIONAL in §14.1) is not DECIDED while its condition is open. Its register status follows the open condition.
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

Count (2026-11-01): 7 RECOMMENDED, 17 EXTERNAL BLOCKER, 4 IMPLEMENTATION GATE, 6 DEFERRED, 1 DECIDED (item 8). Total 35. The 2026-10-31 count was 9, 17, 4, 5 and 0. Each item has exactly one status. Parts with other statuses are named in the row, and do not change its status.

| No. | Item and references | Status | Group | Open parts and who acts | Blocks |
|---|---|---|---|---|---|
| 1 | Held-job file retention; C-1, C-3; M1 file effect (§12B.6, §12B.9) | EXTERNAL BLOCKER | none listed | A held paid order that stays in `printing` never reaches a terminal status, so its file is not purged (0010 lines 795–798). A lawyer reviews when such a file may be released. The owner then chooses the C-1 option and decides C-3 (accept held files as an interim, or hold enforcement back). 2026-11-04 (no. 4): retention option R-D is selected temporarily; cleanup stays disabled until legal review and an owner-approved retention policy. Not final policy. | M1; the 7F build (requires C-1 answered and C-3 decided; neither is decided). Enabling needs M1, with item 2 and item 10 where paid orders are affected, if C-3 holds enforcement back. Not 7B. Stage 7 closure: §16.1(e). |
| 2 | Hold start and scheduler; C-2 (§12B.6) | DEFERRED | B, D | Deferred by owner instruction 1 (2026-10-31). Reopening trigger: C-3 holds enforcement back, or M1 is put forward for build. The owner then chooses the hold start: (a) the job's `created_at`, which can fail a job a day into a lapse, or (b) the time the shop left ACTIVE, stored as a marker. Option (b) is recommended. The purge scheduler exists (§5C), but it does not time out held jobs. A marker, timeout code or new scheduled job needs its own gate (§15.3). | M1. Enabling only if C-3 holds enforcement back. Not a Stage 7 closure requirement (§16.1(e)). |
| 3 | Paid-term stacking; C-4 (M4, J) | RECOMMENDED | A | The owner confirms stacking, so paid terms do not overlap. | Paid path only (M5). |
| 4 | Pricing, minimum payment, tax treatment, paid path and the 0011 paid-table scope; I, M5, C-5, C-13 (§7, §12B.2) | EXTERNAL BLOCKER | A, C, D, E | Price, minimum and tax treatment need two answers first: the CA's tax answer (item 18), and the owner's collection-channel answer, either manual collection or a named processor. Decision 9 (gateway) stays DEFERRED, and integration (item 17) is not needed. If a named processor is chosen, its eligibility evidence and fee basis are needed before pricing. The exclusion of `paid_verified` and `licence_payments` from 0011 (C-5) was confirmed by the owner on 2026-11-01. It no longer gates 7B. See the dependency note below the table. | Paid coverage and any published price. 7B only through C-5. |
| 5 | Admin identity, MFA and the Auth UUID (decisions 13, 14; C-6, C-15; §10 items 12–13; §12A.3) | EXTERNAL BLOCKER | A, B, E | The production owner supplies the owner's Auth user UUID from their own account. It is never inferred. The production owner also records the MFA status on the Supabase account. One owner admin (decision 13) is recommended. `aal2` for admin RPCs (decision 14) is APPROVED 2026-11-02 (§13 item 1). Its recovery procedure and claim verification remain OPEN, and `aal2` behaviour needs staging evidence (S-3; O11, objective only). | 7A; the bootstrap row; 7C to 7D. |
| 6 | Admin UI hosting: a separate private deployment outside `web/` (decision 15) | RECOMMENDED | A, B | The owner confirms a separate private deployment, not linked from the shop app. `pages.yml` publishes `web/` publicly on pushes to `main` that change `web/**` or the workflow. The repository visibility and plan (§3, GitHub Pages row) are a production-owner check. The check affects the hosting cost, not the recommendation. | 7D. |
| 7 | Lifetime, complimentary and grant limits (M4, M5, M6, F, H; C-7; decision 16) | RECOMMENDED | A | Approved: the custom-date convention, complimentary-grant independence, M6 as policy, and F and H (paid parts blocked by M5). For 7C validation (2026-11-02, §13 items 4 and 5): backdating needs explicit confirmation (approved), and lifetime grants are admin-only (approved; this replaces "owner-only"). The maximum backdating window is OPEN. Confirmed by the owner on 2026-11-01 for 7B: a lifetime grant ranks above an admin grant in the basis (§12A.6). M6 covers paid coverage only. C-7 (access continues through a valid paid period after a lifetime revocation) matters only once the paid path is approved. The maximum custom length is DECIDED by the owner on 2026-11-01: none, with no maximum duration. It is a 7C validation input. The 7B schema has no maximum-length check. It is proposed not to check `starts_at` against `created_at`, so backdating is enforced in the 7C RPC. | 7C grant validation (duration, backdating, lifetime admin-only, maximum length); 7B state function (basis ranking); paid transition tests. |
| 8 | Revocation and future coverage (C-8, G; fixes 5 and 9; decision 17) | DECIDED (owner, 2026-11-01) | A, D | Confirmed by the owner on 2026-11-01: revoking current coverage does not cancel future coverage (C-8), a same-instant tie gives REVOKED (fix 5), and the exclusive end is displayed (fix 9). Approved: refusal after the natural end (M2) and reversal (H). Standalone revocation of an active paid period is DEFERRED with the paid path (decision 17). | 7B state function, revocation design and state tests; 7E wording. |
| 9 | Trial policy (decision 5; C-10) | DEFERRED | A, D | Deferred out of Stage 7 (owner instruction 4, 2026-10-31). Postponed, not deleted. Trial terms are not approved. Reopening trigger: a new owner decision on product and pricing terms. | Nothing while deferred. |
| 10 | Refund policy (§9 item 6; C-11) | EXTERNAL BLOCKER | C | A lawyer reviews first, then the owner decides. The processor and dispute fees in §9 item 6 are facts, not policy. | Paid path; refund tests; the M1 effect on paid orders. |
| 11 | Existing shops: count N, free period and notice (decision 8; C-14; §5B) | EXTERNAL BLOCKER | B, C | The production owner counts N, excluding test rows (README lines 395–405; item 34). A lawyer reviews the 30-day notice, which is only a proposal. The free-period and term policy stays open: there is no free-year promise and no term extension until N is known. The §5B figures are arithmetic only. | Enforcement activation, which is not a Stage 7 closure requirement (owner instructions 2 and 3, 2026-10-31); any published existing-shop terms. |
| 12 | Email-volume tier E (§5A; §10 item 11) | RECOMMENDED | B | The owner estimates emails per order from real data. Both the Free and Pro scenarios stay until then. | Projections only. Not Stage 7 code. |
| 13 | Expiry, grace and the shop-facing view (decisions 7, 18, 19) | RECOMMENDED | A, D | Approved: printing-only enforcement, held queued jobs and no retries while inactive (A, B, C). The "no new customer orders" wording is superseded by A and B (C-9, DECIDED 2026-11-01, owner decision 9; see §12B.9). Approved (§12B.2 D): owner-only status with the fields listed there. Open: staff visibility (§12B.2 D); the owner confirms no grace period (decision 18); and the labels, Active or Inactive, with no admin-grant label (decision 19). The Android view is DEFERRED. Reopening trigger for it: a new owner decision to show the licence view in the Android app. The deletion-schedule question under decision 7 sits in item 1. Staff visibility closed 2026-11-04 (A5); status unchanged. | 7E wording. |
| 14 | Manual payments, verification and audit (decision 20; §12A.7; §12B.8) | EXTERNAL BLOCKER | A, C, D | The payment-method list is recommended (UPI direct, bank transfer, cash, cheque, other), but it is DEFERRED with the paid path (M5). A CA advises on GST invoices for manual receipts. A lawyer advises on personal data in audit rows and their retention. | Paid path (M5); any audit-retention job (none approved). |
| 15 | Denial and replay retention; denial growth (M3, M8; C-12; decision 20) | EXTERNAL BLOCKER | A, B, E | Approved: detailed denial records capped at 20 per user per hour, with count-only records above the cap (M3, design only). A lawyer reviews the retention periods (90 days is a proposal for denial records, subject to legal review; replay records kept until a safe mechanism exists; M8). Staging measures row growth. The owner accepts the global ceiling (no production value is proposed here; a provisional engineering value of 1,000 per UTC hour is recorded 2026-11-06, §12A.17 E) and the count-only limitation (C-12). Circular: §15.3 requires the ceiling accepted before 7C, but the measurement needs 7C denial logging on staging. The owner chooses (a) a test-only provisional ceiling for staging measurement, or (b) a value set without measurement. Not decided. 2026-11-02 (§13): option (a) chosen, a provisional ceiling for staging only. The production ceiling value and the remaining C-12 and item 15 details remain OPEN. O9 (2026-11-02): denials are counted with no automatic refusal; alerting is not implemented or claimed; the numeric threshold and alert mechanism are OPEN. O10: C-12 limits are accepted for synthetic staging only. Status unchanged. 2026-11-04 (B2): permission-rejected calls are not counted for staging; status unchanged. | 7C denial logging; retention in 7C. |
| 16 | Licence unit and term (decisions 1, 2; §9 items 1–2) | DEFERRED (renewal part; unit DECIDED) | A | Unit: DECIDED, per shop (decision 1, owner decision 2026-10-31; §13). Term: 12 months, approved as policy (M4). Renewal (decision 2): DEFERRED by owner decision 7 (2026-11-01). It does not block 7B. Its proposal is manual renewal with no automatic renewal. | Paid path (renewal rule). The unit no longer blocks 7B. |
| 17 | Processor and gateway (decision 9; §3; §4) | DEFERRED | C, D | The gateway is deferred. §12A.1 records that the owner collects licence payments manually for now. Stripe is invite-only for new Indian businesses (§3, verified). Razorpay India signup is unverified. When the gateway is reopened, processor eligibility evidence and CA advice are needed first. If a named processor is chosen for pricing (item 4), its eligibility evidence and fee basis are needed before pricing; that does not reopen integration. | Gateway work (later stage; §12A.12); the fee basis for pricing if a named processor is chosen (item 4). Reopening trigger: a new owner decision to reopen decision 9. |
| 18 | GST route, exemption, input credit, reverse charge, TDS and invoices (decision 4; §10 item 3) | EXTERNAL BLOCKER | C | The CA decides the registration route, the current status of Notification 10/2017-IT, input credit, reverse charge on foreign services, TDS and invoicing. | Pricing tax treatment (I); invoices; paid path. |
| 19 | Advisers (decision 11) | RECOMMENDED | A | The owner engages an Indian CA and a lawyer before any paid collection. No engagement is evidenced. The advice itself is an EXTERNAL BLOCKER (items 10, 11, 14, 15, 18, 28, 29, 30). | Paid collection; published terms. |
| 20 | Stage 6 merge order (decision 10; §9 item 10) | RECOMMENDED | A | The owner decides whether `stage6-simulated-printer` (885d28b) is merged before Stage 7 is rebased. The base print agent is already on `origin/main`. No merge is approved. | Rebase order only. |
| 21 | Premium features (decision 12) | DEFERRED | A, D | None built. Option C's added value is undefined. A feature list and build plan are needed first. | Option C; any tier logic. Reopening trigger: the owner names the features to build and approves a feature list and build plan (decision 12). |
| 22 | Email provider and custom SMTP (§10 item 10; §3, Supabase built-in limit of 2 an hour) | DEFERRED | D | Deferred until before production sign-up volume. The production owner sets custom SMTP if it is chosen. Not Stage 7 code. | Production sign-up growth. Reopening trigger: the owner chooses custom SMTP, or production sign-up volume is about to start (§3 limit: 2 emails an hour). |
| 23 | Duplicate-print defect (K, M7; S-7; §12B.4) | IMPLEMENTATION GATE | none listed | Confirmed from code, not reproduced. Next: diff review of the proposed change (M7). Only after that review, targeted local tests for a `sent` sibling, the latest-attempt rule, and failed or confirmed `needs_check` jobs remaining retryable (owner instruction 5, 2026-10-31). Staging tests need a separate explicit approval. The implementation needs its own approval. | Printing change only. Not 7B. Ordering against the 7F build is an owner decision (§15.3). |
| 24 | Refund-and-claim defect (K, M7; S-8; §12B.4) | IMPLEMENTATION GATE | B | Confirmed from code, not reproduced. Next: diff review. Only then does the owner choose R-a, R-b or R-c. R-a is recommended, and it touches the customer payment ledger. 0012 (local main, unmerged) is approved for read-only review only (2026-11-04 no. 6). It is not a fix approval. | Printing change under its own gate (§15.3). Not a 7F prerequisite by default. Ordering against the 7F build is an owner decision (§15.3). |
| 25 | Second `place_order` signature (§2; §12B.11) | EXTERNAL BLOCKER | B, E | The production owner lists the live function signatures and grants, read-only. Both signatures are in the migration chain, and the three-argument version is granted to `anon` and `authenticated` (0003 lines 277–278). Keeping it is the default. Retiring it is a checkout change that needs separate approval. The owner checks the live signatures through the dashboard (2026-11-04 no. 10); Claude does not query live data. | The "checkout unaffected" test; 7F. |
| 26 | Live migration state and 0010 sequencing (§2; `docs/PRINTING_STATUS.md` line 54; README) | EXTERNAL BLOCKER | B, E | The production owner lists the applied migrations, read-only. The owner then decides whether 0010 may be applied, after staging evidence. The owner checks migration state through the dashboard (2026-11-04 no. 10); Claude does not query live data. | Production application of 0010 and 0011 (the live list comes first; owner instruction 3). Not a Stage 7 closure requirement. Staging tests of print paths. Not needed for 7B on staging. |
| 27 | Purge deployment, secrets and capacity (§5C; `.github/workflows/cleanup-files.yml`) | EXTERNAL BLOCKER | B | The production owner records, read-only, whether `cleanup-files` is deployed, whether `QRQUICK_CLEANUP_URL` and `CLEANUP_SECRET` are set, and its recent runs. Capacity is 2,000 files per run and is reached near 3,000 shops. A capacity change is DEFERRED until growth needs it, and it needs separate approval. Reopening trigger: shop count nears about 3,000. 2026-11-04 (no. 4): cleanup stays disabled until legal review (C-1/M1) and an owner-approved retention policy. | Any claim that the purge runs (§5C; §8); growth beyond about 3,000 shops. |
| 28 | Google Play payment policy for any in-app licence purchase (§8A; `mobile/`) | EXTERNAL BLOCKER | C | A lawyer checks the current Play policy text. No Android licence payment is approved. | Any Android licence purchase or payment instruction. |
| 29 | Privacy policy, terms, refund text, intermediary and takedown duties, consent (§4) | EXTERNAL BLOCKER | C | A lawyer drafts and reviews. The owner approves publication. A search of the worktree on 2026-10-31 found no privacy policy, terms, consent, grievance, takedown or DPDP text. | Published terms; paid collection. |
| 30 | Customer-document sensitivity and retention (§4; README passport-photo layout) | EXTERNAL BLOCKER | C | A lawyer classifies sensitivity and DPDP applicability (§4). Engineering reviews storage and link handling, including the 180-second window (S-4). Legal review of customer-file retention and related obligations is required (2026-11-04 no. 5). | Retention rules (item 1); privacy text (item 29). |
| 31 | Live Auth settings and Supabase configuration (§4; README next steps item 6; `supabase/config.toml`) | EXTERNAL BLOCKER | B, E | The production owner records, read-only, the live leaked-password protection, Site URL, SMTP and MFA settings. Versioning the configuration (`supabase/config.toml`, created by `supabase init`) is DEFERRED until local setup is approved. | MFA decision (item 5). Configuration versioning waits for local setup. |
| 32 | Rollback and enforcement kill switch (§12A.10; §12B) | IMPLEMENTATION GATE | B, E | No design exists. Engineering designs it, and the owner approves before 7F. Without it, 7F has no designed off switch. 0011 has no production rollback plan. | 7F approval. |
| 33 | Lock-order contract (R18; §12B.5) | IMPLEMENTATION GATE | B, E | The per-RPC lock map of the existing code is in §12B.5. The lock-order contract (meta → order → agent → jobs) is design-APPROVED (2026-11-01, §13 third record) and not built. It is NOT approved for implementation (owner, 2026-11-01). Two-session tests on staging need separate approval. The 7B-2 helper and meta row (`licence_lock_shop()`, `shop_licence_meta`) are approved for implementation (2026-11-01, scope only). That approval does not approve the R18 implementation above or these tests. O13 (2026-11-02) approves the staging test scope only, including these two-session tests. It does not authorise setup, SQL execution or test execution. | 7B-2, 7C and 7F. |
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
- Item 16: the renewal rule is DEFERRED (owner decision 7, 2026-11-01). The term is approved as policy (M4). Item 3: stacking (C-4). Item 7: C-7, a valid paid period stays in force after a lifetime revocation.
- A separate M5 approval naming the scope.

Apart from C-5, items 4 (pricing and channel), 10, 14, 17 and 18 are not prerequisites for 7B.

### 14.3 Conflicts and open conditions C-1 to C-15 (§12B.9)

| ID | Status | Item | Note |
|---|---|---|---|
| C-1 | EXTERNAL BLOCKER | 1 | M1 against the purge rule. A lawyer reviews a release rule. The owner chooses an option. R-D selected temporarily (2026-11-04 no. 4): cleanup stays disabled until legal review and an owner-approved retention policy. Not final policy. |
| C-2 | DEFERRED | 2 | The hold-start choice, deferred with item 2 (owner instruction 1, 2026-10-31). The premise is corrected (§5C): a scheduler exists for the purge, not for held-job timeouts. |
| C-3 | RECOMMENDED | 1 | Two separate questions. The decision: accept held files as an interim (kept until M1 exists), or hold enforcement back. The requirement: holding enforcement back makes M1 a prerequisite of enabling, with item 2 and, where paid orders are affected, item 10 (§15.3). The 7F build needs only C-3 decided. |
| C-4 | RECOMMENDED | 3 | Stacking. Applies only once the paid path is approved. |
| C-5 | DECIDED | 4 | Exclude `paid_verified` and `licence_payments` from 0011. Confirmed by the owner on 2026-11-01. |
| C-6 | EXTERNAL BLOCKER | 5 | Admin accounts, MFA and the Auth UUID are unanswered. 7A cannot finish without the UUID and the MFA status. |
| C-7 | RECOMMENDED | 7 | The owner confirms that a lifetime revocation leaves a valid paid period in force (M6). |
| C-8 | DECIDED | 8 | Confirmed by the owner on 2026-11-01 that revocation does not cancel future coverage. |
| C-9 | DECIDED | 13 | Owner decision 9 (2026-11-01): replacement wording adopted (§12B.9). The superseded passages are in §9 item 7 only. |
| C-10 | DEFERRED | 9 | Owner confirmed 2026-10-31: trials are deferred out of Stage 7, not permanently removed. Trial terms are not approved. |
| C-11 | EXTERNAL BLOCKER | 10 | The refund policy needs a lawyer. |
| C-12 | RECOMMENDED | 15 | Accepted for synthetic staging only (O10, 2026-11-02): count-only records above the cap, with a visible omitted-detail marker. Production acceptance is OPEN. Provisional global ceiling of 1,000 detail records per UTC hour recorded 2026-11-06 (§12A.17 E). Permission-rejected counting within the staging cap approved 2026-11-04 (no. 3); mechanism OPEN. Superseded for staging by B2 (2026-11-04, Stage 7C record): not counted. |
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
| M4 | DECIDED | 7, 16 | Custom-grant convention approved; custom-grant boundaries DECIDED 2026-11-06 (§12A.17 B). Paid term approved and blocked by M5. |
| M5 | DECIDED | 4 | The paid-path block is approved as a blocking condition. |
| M6 | DECIDED | 7 | Lifetime over paid coverage, approved as policy. Its tests need the paid path. |
| M7 | DECIDED | 23, 24 | The review requirement for both fixes is approved. No fix is implemented. 0012 read-only review approved 2026-11-04 (no. 6); not a fix. |
| M8 | EXTERNAL BLOCKER | 15 | Policy proposal approved. Legal review is needed before the periods are fixed. |

### 14.6 Decisions 1 to 20 (§9, §12A.13, §12B.3)

| Decision | Topic | Status | Item | Note |
|---|---|---|---|---|
| 1 | Licence unit (per shop) | DECIDED | 16 | Owner decision 2026-10-31 (§13): QRquick licences are issued per shop. Each individual shop requires its own licence. A single owner account may manage multiple shops, but licensing one shop does not automatically license the others. Changing the printer computer does not change the licence. |
| 2 | Term and renewal | DEFERRED | 16 | The 12-month term is approved as policy (M4). Renewal is DEFERRED by owner decision 7 (2026-11-01) and does not block 7B. |
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
| 14 | MFA (`aal2`) | EXTERNAL BLOCKER | 5 | OWNER-APPROVED 2026-11-02 (§13): `aal2` is required for every platform-admin RPC. OPEN: the verified recovery procedure, and hosted and local verification of the `aal` claim. A missing or unreadable `aal` claim fails closed (decided 2026-11-06, §12A.17 D). The production owner records the MFA status. Status unchanged. |
| 15 | Admin UI hosting | RECOMMENDED | 6 | Owner confirms a separate private deployment. |
| 16 | Grant limits | RECOMMENDED | 7 | Maximum custom length: none (owner decision 6, 2026-11-01). 2026-11-02 (§13): backdating requires explicit confirmation; lifetime grants are admin-only, replacing the earlier "owner-only" recommendation; the maximum backdating window is OPEN. Status unchanged. |
| 17 | Standalone revocation of paid periods | DEFERRED | 8 | Deferred with the paid path (M5). Reversal (H) and refusal after the natural end (M2) are approved. Reopening trigger: the paid path is approved (M5). |
| 18 | Expiry and grace (no grace) | RECOMMENDED | 13 | Owner confirms. Printing is blocked in every non-ACTIVE state. |
| 19 | Shop-facing view | RECOMMENDED | 13 | The owner-only fields are approved (§12B.2 D). Open: the labels, including whether an admin grant may show a label; and staff visibility (§12B.3). Staff visibility closed 2026-11-04 (A5). The Android view is DEFERRED. Reopening trigger: a new owner decision to show the licence view in the Android app. |
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
| Owner confirmation (RECOMMENDED) | Items 3, 6, 7, 12, 13, 19, 20; C-3, C-4, C-7, C-12; S-4; decisions 7, 10, 11, 13, 15, 16, 18, 19 | Owner, by written answer | Yes. An answer records a decision and approves no gate |
| Professional advice (EXTERNAL BLOCKER) | Items 1, 4, 10, 14, 15, 18, 28, 29, 30, and the M8 and S-6 parts of 35; C-1, C-11, C-13; decisions 3, 4, 6, 20; the engagement in item 19 | CA or lawyer | No. No engagement is evidenced |
| Production-owner verification (read-only unless stated) | Items 5, 25, 27, 31, 34 (closure checks); item 11 (before enforcement activation); item 26 (before a production migration); the item 6 visibility check; C-6, C-14, C-15; decisions 8, 14 | Production owner | Only on the owner's separate request. Read-only. Any change is the owner's decision |
| Local or staging setup (separate approval each) | Gate 1 (local setup, Docker, CLI, containers, `supabase init`); staging tests for items 15 (growth), 25 and 33; the R and S tests in §14.4 and §14.7; the item 23 targeted local tests (only after diff review) and staging tests (separate explicit approval); the item 24 tests (after diff review); the M1 tests | Owner approves; engineering runs | No |
| Separate implementation approval (IMPLEMENTATION GATE) | Items 23, 24, 32, 33 (code); gates 7B to 7F; M1 (after items 1 and 2); the held-job marker or scheduler, once item 2 is reopened; the paid path (item 4 and M5); the gateway (item 17); the Android view (item 13); retiring the three-argument `place_order` (item 25); publishing privacy text and terms (item 29) | Owner, per gate | No |
| Deferred (no action until reopened) | Items 2, 9, 17, 21, 22; the renewal part of item 16 (decision 2); the deletion of test rows (item 34); standalone paid revocation (decision 17; item 8 is DECIDED); the Android view (item 13); the capacity change (item 27); configuration versioning (item 31); decisions 2, 5, 9, 12, 17; C-2; C-10 | Owner, when reopened | No |
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
| 7B Schema, migration 0011 (staging only) | 7B-1 (file only, unapplied): licence tables, triggers, RLS deny-all, `is_platform_admin()`, `shop_licence_state()`. 7B-2 (approved for implementation 2026-11-01, scope only; R18 contract design-approved 2026-11-01; R18 implementation NOT approved): `licence_lock_shop()`, `shop_licence_meta`, and the guard. Paid tables excluded (C-5, decided 2026-11-01). `licence_requests`, `licence_denials` and `licence_denial_windows` are approved for placement in this file (decision 3; O2) but are now in it (added 2026-11-05 under bundle 3; unapplied, untested). Pre-staging review of 0011 is still required before any staging run | Gate 1 or staging setup, with 0010 applied to the staging copy under its own approval; the owner inputs listed below the gate table (C-5, item 8, and the basis ranking in item 7, all decided 2026-11-01; the licence unit in item 16 was decided 2026-10-31). For tests only: the R15 fixture approach (decision L) and the R17 default-privilege check. Item 26's live list is needed before any production migration, not for staging | File creation for 7B-1 approved 2026-11-01. Separate approval for each staging run and for any application. 7B-2 implementation approved 2026-11-01 (scope only) | State, trigger, privilege and regression tests | Drop the 0011 objects on staging. No production rollback plan exists (item 32) |
| 7C Admin RPCs and owner read RPC | Grant, extend, revoke (M2), replace; denial logging (M3; `licence_denial_windows`, O1); idempotency (R5); owner read (decision D). Admin disable is not in 7C (O6) | 7B on staging; the lock map confirmed by a two-session test (item 33); a staging-only provisional denial ceiling for measurement (item 15 option (a), approved 2026-11-02; provisional value of 1,000 detail records per UTC hour recorded 2026-11-06, §12A.17 E; the production ceiling is OPEN; O9: denials counted, with no automatic refusal; alerting is not approved, implemented or claimed (corrected 2026-11-04)); C-12 accepted for synthetic staging only (O10; production OPEN); permission-rejected calls not counted for staging (B2, 2026-11-04); `licence_denial_windows` (O1) in 0011 after pre-staging review (O2); the item 5 `aal2` requirement (approved 2026-11-02; recovery procedure OPEN; a missing or unreadable `aal` claim fails closed, 2026-11-06); before 7C sign-off, the O4 half-open overlap rule documented, the O6 emergency disable and recovery procedure approved, and the O7 break-glass procedure approved; the decision 16 validation inputs (duration, backdating with explicit confirmation, lifetime admin-only, and maximum custom length, decided as none by owner decision 6); 2026-11-04: A1 decided (different-kind coexistence); A2 decided for calendar grants; custom-grant boundaries DECIDED 2026-11-06 (§12A.17 B); A3 procedure required before sign-off only; A4 and A5 decided | Separate approval | Admin, privilege, concurrency and denial-cap tests | Revoke `EXECUTE` on the admin RPCs (needs a migration). This rollback changes no coverage row (§15.5) |
| 7D Admin UI, separate private deployment | Login, shop search, grant, extend, revoke, replace with confirmation, audit view; MFA enrolment if decision 14 requires it | 7C on staging; the hosting decision (item 6); the visibility check (item 6); item 5 | Separate approval | Browser smoke test on staging; static scan that no service key is in the bundle | Take the deployment down. No database change, and no coverage row changes (§15.5) |
| 7E Owner read-only status, web | Fields as in decision D; labels (item 13); display rule (item 8) | 7C; the label decision (item 13); the display rule (item 8) | Separate approval | Owner status returns only the D fields whatever the enforcement state; staff denied (§12B.2 D) | Remove the owner status UI. Revoke `EXECUTE` on `shop_licence_status` only if the read RPC must be withdrawn (needs a migration). The rollback changes no coverage row and grants or revokes no licence (§15.5) |
| 7F Enforcement, printing only | Gates on approve, retry, claim and `mark_printing` (decisions A, B, C) | 7C and 7E; S-4 accepted (item 35); item 33 lock tests; item 25 tests of both signatures; item 32 kill switch approved; item 1 for the build (requires C-1 answered and C-3 decided; neither is decided, §14.3). Before enabling only: item 11 (existing-shop policy); M1 and item 2 (reopened), if C-3 holds enforcement back. Ordering of items 23 and 24 against this build is an owner decision; neither is a prerequisite by default | Separate approval to build, and a separate approval to enable | Printing and checkout tests (§12B.11) | A designed kill switch is needed (item 32). None exists yet |

**Owner inputs for the 7B schema.** Four inputs, and no others. All four are now decided: inputs 1, 2 and 4 on 2026-11-01, and input 3 on 2026-10-31:

1. C-5: exclude `paid_verified` and `licence_payments` from 0011 (DECIDED 2026-11-01). `trial` is also excluded (C-10, deferred).
2. Item 8: C-8 (revoking current coverage does not cancel future coverage), the same-instant tie-break (fix 5) and the exclusive-end display (fix 9). The state function and the revocation trigger depend on them.
3. Item 16: the licence unit, DECIDED as per shop (decision 1, 2026-10-31). It sets the `shop_id` model. The term does not change the schema.
4. Item 7: the basis ranking of a lifetime grant over an admin grant (§12A.6). M6 covers paid coverage only.

**Not needed for the 7B design:** the maximum custom length, backdating, the durations and lifetime admin-only (7C validation, decision 16; approved 2026-11-02); C-7 and the other paid-path items (paid path only); items 1 and 2 (M1 only); item 5 (the admin UUID is inserted by a one-time owner-run row, and the migration must not contain it); decision 13 (the table holds any number of admin rows) and decision 14 (`aal2` is checked in the 7C RPCs); item 26 (its live list is needed before any production migration, not for staging). The R15 fixture approach and the R17 privilege check are needed for 7B tests, not for the design.

**Separate gates (none authorised):**

| Gate | Scope | Prerequisites | Approval | Tests |
|---|---|---|---|---|
| M1 held-job rule | 7-day failure for licence holds | Item 1 decided (requires C-1 answered and C-3 decided; neither is decided, §14.3); item 2 reopened and the hold start chosen (a or b); item 10 (effect on paid orders); a file-release rule under C-1; a hold-start marker or scheduler, separately approved | Separate review, then implementation approval. Lawyer review required before implementation (2026-11-04 no. 5). R-D temporary: cleanup stays disabled until legal review and an owner-approved retention policy | §12B.11 held-job tests |
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

Answers are as of 2026-11-02, after the O1–O13 record. "NO" means the question is not yet satisfied.

| # | Question | Answer | Evidence and what is missing |
|---|---|---|---|
| 1 | Is the document ready for owner review? | YES | Corrections in §13 are applied. Repository claims are re-checked with line numbers. Each numbered item, group, and open ID has one status in §14. |
| 2 | Is the document ready for planning approval? | NO | The owner's answers to the RECOMMENDED items (§15.1) are not given. The production-owner checks for items 5, 25, 27, 31 and 34 are not made. |
| 3 | Is every open ID given one status? | YES | Items 1 to 35, groups A to E, decisions A to L and 1 to 20, M1 to M8, C-1 to C-15, S-1 to S-8 and R1 to R19 are each in §14. |
| 4 | Are external blockers identified with their outside party? | YES | The 17 EXTERNAL BLOCKER items in §14.2 name the party. The answers are not in the repository. |
| 5 | Are factual claims supported by repository evidence? | PARTLY | Repository facts are re-checked with line numbers (§2, §4, §5C, §12A.2, §12B.4 to §12B.9). Live state, README statements and external sources are labelled and not verified. |
| 6 | Is the implementation scope frozen? | NO | The 7B-1 inputs (C-5, item 8, item 7 basis ranking) were decided on 2026-11-01. 7B-2 implementation was approved on 2026-11-01 for its scope only (R18 contract design-approved 2026-11-01; R18 implementation NOT approved). Staging waits on a copy with 0010 applied and its own approval. The licence unit (item 16) is decided. Item 26 is needed only before a production migration. 7F build waits on 7C and 7E, on item 1 (requires C-1 answered and C-3 decided; neither is decided), and on items 25, 32, 33 and S-4. Before enabling only: item 11, and M1 and item 2 if C-3 holds enforcement back. The 2026-11-02 record adds 7C sign-off conditions: the O4 overlap rule, the O6 emergency disable and recovery procedure, and the O7 break-glass procedure. Each needs approval before 7C sign-off. |
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
