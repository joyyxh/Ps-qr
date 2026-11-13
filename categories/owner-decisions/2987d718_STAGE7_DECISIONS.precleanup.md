# Stage 7 decisions: draft for owner review

**Status:** DRAFT PROPOSAL. This file is not an approval of any business, legal, tax, pricing, or technical decision.
**Date:** 2026-10-29. Corrected 2026-10-29 after the read-only audit and a targeted correction pass. Corrections are listed in §13. Admin-grant and manual licence design added 2026-10-29 (§12A). Stage 7 decision record (A–L, M1–M8), state-machine corrections, and R1–R19 findings added 2026-10-29 (§12B). Where §12A and §12B differ, §12B governs.
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

- Migrations `0001` to `0010` contain no plan, billing, licence, or entitlement column. (Searched 2026-10-28 and 2026-10-29 in earlier work. Not re-run in the correction pass.)
- No Stripe or Razorpay code or dependency exists in `web/`, `mobile/`, `agent/`, or `supabase/`. Stripe appears in the worktree only in `README.md`, `CLAUDE.md`, and this draft. Razorpay appears only in this draft (grep, 2026-10-29).
- **"Stripe is installed" appears in `README.md`.** Lines 22 and 35 read "Stripe is installed but not connected" and "Stripe (installed, not connected)". This is a README statement, not evidence of an installed package. The bare word "installed" also appears in unrelated code and docs: `agent/src/cli.mjs`, `agent/src/printers/linux.mjs`, `agent/src/printers/windows.mjs`, `agent/test/printers.test.mjs`, and `TODO.md` line 38. The tracked-file search was capped at ten lines, so this list is not exhaustive. The Stripe claim rests on `README.md` lines 22 and 35.
- **Resend.** No direct Resend or SMTP API call exists in `web/`, `agent/`, or `supabase/` (grep, 2026-10-29). The "Resend code" button in `web/src/owner.js` (lines 327–350) calls `resendSignupCode` in `web/src/auth.js` (lines 207–208), which requests Supabase Auth's `/auth/v1/resend` endpoint (test at `web/tests/owner-registration.test.js` line 344). Sign-up codes are therefore sent through Supabase Auth. QRquick is not integrated with Resend. Whether Supabase Auth uses custom SMTP, and through which provider, is not shown in the repo. The Supabase dashboard was not checked.
- Next free migration number: `0011`.
- Worktree: `stage7-payments` at `717717b`. Untracked: `CLAUDE.md`, and this file.
- Main checkout: three pre-existing modified files (`agent/README.md`, `agent/src/worker.mjs`, `agent/test/worker.test.mjs`) and stash `b559dce`. Not touched.

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
- **Supabase data location:** project region not in repo. `ap-south-1` availability for new projects unconfirmed.
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
| File retention | 30 days after finish, per `docs/PRINTING_STATUS.md` | **NOT DEPLOYED.** That file says "Built, not deployed" (line 24). Deployment not verified. See §5C. |
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

- **Retention status: NOT DEPLOYED.** `docs/PRINTING_STATUS.md` line 24 reads "Built, not deployed." Deployment was not verified (no Supabase or GitHub Actions access was used). **The 10,000-shop storage overage in §8 assumes this unimplemented retention.**
- Storage with 30-day retention (steady state): GB = shops × 20 orders × 2 MB ÷ 1,000 = 10,000 × 20 × 2 ÷ 1,000 = **400 GB**
- Without retention, storage grows every month: 400 GB × months. After 12 months: 4,800 GB. Overage: (4,800 − 100) × $0.0213 = $100.11 ≈ ₹9,510 per month. **Storage only; egress excluded. Illustration only. Not in any table.**
- Overage at 10,000 shops, with retention (Assumed):
  - Storage: (400 − 100) GB × $0.0213 = $6.39 ≈ ₹607.05
  - Egress: assumes each file is downloaded once a month, so 400 GB. (400 − 250) GB × $0.09 = $13.50 ≈ ₹1,282.50
  - Total: $19.89 ≈ ₹1,889.55, shown as ₹1,890.
- **Database overage: unmodelled.** Supabase bills $0.125/GB beyond 8 GB (§3). No database size estimate exists, so no figure in this draft includes it. **PROVISIONAL.**
- Compute tier upgrades: unmodelled.

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
13. **Retention (new).** Retention is not deployed (§5C). The 10,000-shop storage overage in §8 assumes it is.
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

**Note on Option C:** the "additional value" is undecided. The current product does not include premium features. Any premium tier needs a written feature list and build plan first. **PENDING OWNER APPROVAL (decision 12).**

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

## 9. Decision checklist: all PENDING OWNER APPROVAL

Each item is a proposal, not a decision. Decisions 13–20 (manual licence management and admin grants) are in §12A. They are PENDING OWNER APPROVAL, except where §12B.3 records a partial status.

1. **Licence unit.** Proposal: per shop. Options: per owner; per printer computer. **PENDING OWNER APPROVAL.**
2. **Term.** Proposal: 12 months; the owner pays again each year; no automatic renewal. Options: yearly manual renewal; one-time (not recommended, since recurring costs need recurring income). **PENDING OWNER APPROVAL.**
3. **Price.** Proposal: Option B, ₹1,499 incl. GST, as the starting point. Options: A (₹499 pilot); C (₹2,999); other. **PENDING OWNER APPROVAL.**
4. **GST route.** No option chosen. Options: (a) stay unregistered and charge no GST, only if a CA confirms the exemption applies; (b) register and charge GST on an inclusive price. Input credit: whether a registered shop can claim input credit on the licence depends on QRquick issuing valid GST invoices. This claim is **unsourced** in this draft. Whether QRquick can claim input credit on its own costs, and the reverse-charge treatment of foreign services, are **not modelled**. **PENDING OWNER APPROVAL. CA review required.**
5. **Trial.** **Deferred out of Stage 7 (2026-10-29 direction, §12B, conflict C-10).** Proposal: 30 days, no card, one per owner account. Options: none; 14 days. A trial delays first payment and is not modelled as lost revenue (§5B). **PENDING OWNER APPROVAL.**
6. **Refunds.** Proposal: full refund within 7 days. After that, only for duplicate charges or a QRquick outage. QRquick absorbs the processor fee: ₹35.38 per year on a ₹1,499 card payment at 2.36%, or ₹29.98 at the derived 2.00%. Each Stripe dispute costs ₹1,000 (§3, Stripe pricing row). That is Stripe's dispute fee. Pausing the licence during a dispute does not itself cost ₹1,000. **PENDING OWNER APPROVAL. Lawyer review required.**
7. **Expiry behaviour.** *Partly superseded 2026-10-29 (§12B): decision A (printing only, no order blocking), B (queued jobs held), C (no retries while inactive).* Original proposal: no new customer orders. In-flight paid orders finish. The print agent claims no new jobs. Owners keep read and CSV export. **Licence expiry does not itself delete data.** Order files follow the retention schedule: 30 days after finish, which is **not deployed** (§5C). Whether licence expiry should also change the deletion schedule is a separate decision. **PENDING OWNER APPROVAL.**
8. **Existing shops.** Proposal: free for 12 months from launch, with 30 days' written notice before the first charge. Effect as drafted: no licence revenue from these shops in year one. Decision 8 does not say whether the paid term is extended. The illustrations assume it is not, so that revenue is **forgone**, not deferred (§5B). Existing-shop count (N): [OWNER TO PROVIDE]. Illustration at N = 100 (arithmetic only): year-one net −₹65,700 on Free (E ≤ 1.5) or −₹88,500 on Pro (E > 1.5), against +₹57,796 or +₹34,996 if all pay from month one. Accrual break-even month 26 (Free) or 43 (Pro). Cash turns positive in month 13 under annual receipts. **PENDING OWNER APPROVAL.**
9. **Processor.** Options: Stripe, only if an active account or invite exists; Razorpay, only after its India signup is verified; defer. Neither is confirmed available. Every revenue projection in §8 assumes a working channel. **PENDING OWNER APPROVAL.**
10. **Stage 6 merge order.** Proposal: owner reviews and merges Stage 6 before Stage 7 is rebased. Not merged by me. **PENDING OWNER APPROVAL.**
11. **Advisers.** Proposal: engage an Indian CA and lawyer before any payment launch. Scope includes GST route, input credit, reverse charge, TDS, DPDP, refunds, and consumer protection. **PENDING OWNER APPROVAL.**
12. **Premium features.** Proposal: none for now. Options: name the features to build first. **PENDING OWNER APPROVAL.**

---

## 10. Blockers before payment integration

1. **Business identity:** entity type, PAN, and registered state are unknown. The identifiers that a processor and GST registration each require need CA confirmation. The draft has no source for the GST PAN requirement. **CA confirmation required.**
2. **Processor access:** Stripe is invite-only for new Indian businesses. Razorpay India signup is unverified.
3. **Tax route:** registered or unregistered, plus the GST classification, input credit, reverse charge, and any TDS treatment. A CA must decide.
4. **Invoicing:** the repo has no GST invoice code or numbering (from earlier review; not re-checked in the correction pass). Needed if registered.
5. **Phase 2 dependencies:** the following owner decisions drive Phase 2 code where they apply. **Decision 4** (GST route) affects invoicing and tax fields. **Decision 7** (expiry) affects licence gates and deletion. **Decision 9** (processor) affects the integration design. **Decision 12** (premium features) affects any tier logic. **PENDING OWNER APPROVAL** for each.
6. **Legal terms, refunds, and DPDP obligations:** a lawyer must review them. DPDP applicability to customer files is not analysed (§4).
7. **Settlement account:** processors require a bank account in the entity's name. Unknown.
8. **Data location:** the Supabase project region is not in the repo. `ap-south-1` availability is unconfirmed.
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
- **Waiting for owner review.**

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
- Edge Functions read `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) from their environment. `owner-file-link` is deployed with JWT verification (`verify_jwt = true`, per its header comment).
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

A coverage cancelled before its start is stored with `revoked_at` set to the cancellation time, which is before `starts_at` (fix 1). Its effective interval is empty, so it is dropped from every state. The FREE TRIAL state is removed because trials are deferred (§9 item 5, C-10).

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
- Licence expiry or revocation does not itself delete any data. The 30-day file retention schedule (not deployed, §5C) is separate. *Proposal M1 (§12B.6), not approved for implementation:* a job held only because the licence is inactive fails after 7 days. Whether its file then becomes purgeable is an open conflict (§12B.9 C-1).
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
- **7B. Schema:** migration (next free number, 0011 or later), tables, triggers, RLS deny-all, `is_platform_admin()`, `shop_licence_state()`, `licence_lock_shop()`, and `shop_licence_meta`. Excludes `paid_verified`, `trial`, and `licence_payments` (M5; conflict C-5). Built to the corrections in §12B.5 and the tests in §12B.11. SQL tests on staging only, after separate approvals for local setup and for migration creation.
- **7C. Admin RPCs and the read RPC:** grant, extend, revoke (with the M2 rule), and replace; `shop_licence_status` (owner read RPC); denial logging (M3, M8). Manual payment record, verify, and reverse are deferred (M5). Matrix from §12A.11 and §12B.11 on staging.
- **7D. Admin UI:** a separate private app with login, shop search, grant, extend, revoke, and replace forms with confirmation, and an audit view. Payment entry is deferred (M5). Browser smoke test on staging.
- **7E. Shop read-only status:** owner web view with the minimal fields in decision D. Android is undecided (decision 19). No enforcement.
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
- **APPROVED, CONDITIONAL:** approved subject to the stated condition.
- **BLOCKED:** cannot proceed until the named condition is met.
- **REVIEW REQUIRED:** a separate diff or legal review is needed before implementation.
- **PROPOSAL:** recorded for review. Not approved for implementation.
- **UNVERIFIED:** needs a staging or primary-source check. No conclusion is drawn.

### 12B.2 Decisions A–L and M1–M8

| ID | Decision (as recorded) | Status | Consequence and condition |
|---|---|---|---|
| A | Printing-only enforcement. Customer checkout and order placement are not blocked by licence status. | APPROVED | Replaces the order-insert gate in the earlier chat plan (label U10) and the original 7F wording. Checkout is unchanged. |
| B | Queued jobs held until the shop is ACTIVE. Jobs already printing may finish. | APPROVED, CONDITIONAL | Held files are kept by the purge rule (0010 lines 795–798) until M1 is implemented (C-1, C-3). |
| C | Retries blocked while inactive. No requeue or reuse of old job rows. | APPROVED | Each retry is a new row, created only while ACTIVE. Supersedes the earlier chat plan's pre-expiry retry wording (label N3). |
| D | Minimal owner status: active or inactive; access end or no-expiry; next start when relevant. No payment references, admin notes, audit history, coverage IDs, or revocation reasons. | APPROVED | Owner only. Staff and Android visibility are open (decision 19). |
| E | Enabling enforcement: preview first, blocked-shop count, digest, typed confirmation, reason, audited server-side change. Not enabled now. | APPROVED for design. ENABLING BLOCKED | Enabling needs a reviewed transition policy for existing shops (owner input: N and the free-period policy, §5B, decision 8). |
| F | Refuse paid coverage while a lifetime grant is active. | APPROVED. BLOCKED with the paid path (M5) | Verification is refused while a lifetime grant is effective. Payments recorded but not verified need a refund policy (outside the software; lawyer and CA, §9 item 6). |
| G | Show SCHEDULED when no coverage is active but a valid future coverage exists. | APPROVED | Revoking current coverage does not cancel future coverage (C-8). |
| H | A payment reversal atomically revokes its linked coverage. Admin and complimentary grants are never revoked by a payment reversal. | APPROVED. BLOCKED with the paid path (M5) | Admin kinds have `payment_id` null (§12A.5), so the link is structural. |
| I | Pricing and minimum payment. | **BLOCKED** | No price, minimum amount, tax treatment, or published pricing. The paid path stays blocked. The §7 options are not approved. |
| J | Coverage anchor: exact server verification timestamp taken after the shop lock; Asia/Kolkata calendar arithmetic. | APPROVED. BLOCKED with the paid path (M5) | See C-4 on stacking. |
| K | Investigate and test two printing fixes. Stop if a fix is broader. | Duplicate-print fix: APPROVED for investigation and tests; REVIEW REQUIRED before implementation. Refund and claim fix: **REVIEW REQUIRED (stopped)** | §12B.4. Nothing implemented. |
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
| 13 Admin accounts | PENDING OWNER APPROVAL. One owner account is assumed until answered. |
| 14 MFA (`aal2`) | PENDING. The owner must confirm MFA status. Admin RPCs cannot run without aal2 if it is required. |
| 15 Admin UI hosting | PENDING. |
| 16 Grant limits | PARTLY APPROVED: custom-date convention (M4). PENDING: backdating, maximum custom length, lifetime owner-only. |
| 17 Revoking paid periods | PARTLY APPROVED through H and M2 (reversal; refusal after end). Standalone revocation of an active paid period is PENDING and deferred with M5. |
| 18 Expiry and grace | PARTLY: B and C block printing in every non-ACTIVE state, so no grace is implied. PENDING: any grace days, and the wording for NONE. |
| 19 Shop-facing view | PARTLY APPROVED: fields as in D. PENDING: Android, and whether an admin grant may show a label. D shows active or inactive only. |
| 20 Manual payments and audit | PARTLY APPROVED: denial logging (M3) and retention split (M8). PENDING: accepted methods, reference rules, GST invoice handling (CA), DPDP treatment of audit data (lawyer). |

### 12B.4 Printing safety fixes (K, M7): findings and state rules

**Duplicate-print fix (investigated, not implemented).**
- Current code: `retry_print_job` (0010 lines 502–547) checks the source status (`failed` or `needs_check`, line 522). It refuses only when a sibling job for the same `order_item_id` is `queued`, `claimed`, or `printing` (lines 534–539). It does not check for a `sent` sibling, and it does not require the source to be the highest attempt.
- Gap: attempt 1 fails and attempt 2 is sent. A retry of attempt 1 still passes and creates attempt 3, which prints a second copy. *Confirmed by reading the code. Not reproduced on any database.*
- Proposed rule: refuse if any job for the item has status `sent`. Refuse unless the source attempt is the highest attempt for the item. Keep the `needs_check` confirmation unchanged.
- Changes: the body of `retry_print_job` only. No schema change. No change to claim, finish, or approve.
- Status: APPROVED for investigation and targeted tests. Implementation needs a separate diff review (M7).

**Refund and claim fix (stopped; REVIEW REQUIRED).**
- Refund path: `set_order_payment`, action `refund` (0006 lines 213–219), sets `payment_status = 'refunded'`, `refunded_at`, and `refund_paise`. It does not change the order status or any `print_jobs` row.
- Claim path: `agent_claim_next_job` (0010 lines 646–656) selects queued jobs for the shop whose file is not deleted. It checks neither payment status nor order status.
- Order transitions: 0001 lines 153–155 allow `printing` → `ready` or `completed`. The 0008 guard checks payment only on those transitions. An order that is `ready` or `completed` can still have queued jobs.
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
| R7 | `shop_licence_id` columns: the earlier chat plan omitted `shop_id` on coverages and payments. This file already includes it. Composite foreign key added. | Corrected. |
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
| R18 | Lock order. Print paths: order row, then meta (share). Admin paths: advisory lock, then meta, then payment. No path takes meta before an order. | Design resolved; not tested. Two-session test required. |
| R19 | Shop deletion. Licence tables use `on delete restrict`, matching `orders.shop_id` (0001 line 53). | Design resolved; not tested. |

### 12B.6 Held-job rule M1 (proposal, not approved for implementation)

- **Scope:** jobs in `queued` status, and `claimed` jobs requeued by recovery, that are held only because the licence is not ACTIVE. Jobs in `printing`, `needs_check`, `sent`, or `failed` are out of scope.
- **Hold start (C-2):** not decided. Option (a) is the job's `created_at`, which can fail a job a day into a lapse. Option (b) is the time the shop left ACTIVE, which needs a stored marker or a derived value. Neither is chosen.
- **Limit:** 7 days (M1), measured from the chosen hold start.
- **Effect:** status `failed`, `error_code` such as `licence_inactive_timeout`, and a clear `error_message`. Retry is allowed after the shop returns to ACTIVE (rule C).
- **Mechanism (C-2):** no scheduler is confirmed. The timeout could run lazily when an agent calls the claim or heartbeat, or on an owner read. A `pg_cron` job would need separate approval, and the repo does not show one. **UNVERIFIED** whether any scheduler exists. Until one does, timeouts run only when an agent calls.
- **File effect (C-1):** M1 says the file "becomes eligible for deletion under the existing purge safeguards". **For paid orders still in `printing`, that is not true under the current code.** `expired_customer_file_paths` (0010 lines 795–807) requires that a file's order be `completed`, `cancelled`, or `rejected`, and that it has been so for 30 days. A failed job does not change the order. 0001 does not allow `printing` → `cancelled`. So the file would stay until the order reaches a terminal status that the current workflow may never reach for that order. A decision is needed before implementation.
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
  - `purge_old_rate_limits` exists (0010), but its schedule is **UNVERIFIED**.
  - `consume_rate_limit` is granted to `service_role` only (0010 line 868). Calling it from a licence function needs a staging check before use.
- **Status:** APPROVED as design. NOT IMPLEMENTED.

### 12B.8 Retention (M8)

| Record | Proposed retention | Status |
|---|---|---|
| Detailed denial records (`licence_denials`) | 90 days | Subject to security and legal review. No deletion job. |
| Denial aggregate counters | Expire with their rate-limit window. Purge schedule UNVERIFIED. | UNVERIFIED |
| Replay records (`licence_requests`) for consequential mutations | Kept until an independently safe replay-prevention mechanism exists. Store the request ID, action, payload hash, and a non-personal result summary. Not deleted at 90 days. | Policy proposal. Period to be set in review. |
| Consequential audit log (`licence_audit_log`) | Kept as needed for administrative and financial records. Personal data minimised. | Lawyer review (decision 20, DPDP). |
| Customer files and print jobs | The existing 30-day rule, **not deployed** (§5C). M1 would add a licence-driven failure path. | Separate decision (C-1). |

`licence_requests` stores `actor_user_id`, which is personal data. Store the user ID only where replay prevention needs it.

### 12B.9 Contradictions, open conditions, and security weaknesses

**Contradictions and open conditions**
- **C-1 (M1 vs the purge rule).** M1 assumes a failed job makes the file eligible. The purge rule does not, for orders that remain `printing` (§12B.6). Options: a new terminal order status, which changes the 0001 transitions and is out of scope so far; or a licence-specific file-release rule. **Not decided.**
- **C-2 (M1 mechanics).** The hold-start clock and the scheduler are unresolved (§12B.6).
- **C-3 (B vs retention).** Until M1 is implemented, held jobs keep customer files indefinitely. Decide whether to accept this as an interim, or to hold enforcement back until M1 is built.
- **C-4 (M4 vs J stacking).** M4 says the term is calculated from "the exact server-side verification timestamp". J and the anchor rule start a new paid term at the end of an existing paid term when that end is later. The two differ while a paid term is still running. Recommended: keep stacking, so there is no overlap. **Owner confirmation needed.** Applies only when the paid path is approved.
- **C-5 (M5 and 7B).** Whether `paid_verified` and `licence_payments` are excluded from migration 0011. Proposed: excluded. **Owner confirmation needed.**
- **C-6 (decisions 13–15).** Admin accounts, MFA, and hosting are unanswered. 7A cannot finish without the Auth user UUID and the MFA answer. Blocks 7B–7D.
- **C-7 (F and M6 with H).** Consistent: F refuses a new paid period during a lifetime grant, and M6 allows a lifetime over existing paid coverage. **Confirm** that revoking a lifetime grant while a paid period is still valid leaves access through the paid period, as M6 states.
- **C-8 (G with revocation).** G shows SCHEDULED after revocation of current coverage when a future coverage exists. **Confirm** that revocation does not cancel future coverage.
- **C-9 (§9 item 7 and §12A.10 wording).** "In-flight paid orders finish" and "no new customer orders" are superseded by A and B. Those passages are annotated. Other original text in §9 item 7 remains.
- **C-10 (trials).** §9 item 5 and §12A.5–12A.6 mention trials. Trials are deferred out of Stage 7 under the earlier direction (chat-plan labels N2 and A7; those directions are not reproduced in this file). The trial item in §9 remains open for product and pricing decisions. **Owner confirmation needed** that trials are deferred, not removed.
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
- **S-5.** How `agent/src/worker.mjs` handles a `mark_printing` refusal is **UNVERIFIED**. Required before 7F.
- **S-6.** The denial and replay ledgers hold user IDs. Retention is set in §12B.8.
- **S-7.** The duplicate-print gap (§12B.4) exists in the current printing code. It is a printing defect, not a licence defect.
- **S-8.** The refund-without-claim-stop gap (§12B.4) exists in the current printing code.

### 12B.10 Corrections to my earlier planning text

- The earlier chat plan listed no `shop_id` on coverage or payment rows. This file already has `shop_id` on both. The correction is the composite foreign key (R7).
- The earlier chat plan's 12-month end expression was garbled. Replaced by the Asia/Kolkata formula in fix 10.
- The earlier chat plan gated `orders` inserts (U10). Withdrawn under decision A.
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
- **Checkout unaffected (A):** `place_order` succeeds while the licence is inactive, with enforcement on. Migrations define two signatures (three arguments in 0001 and 0003; four arguments in 0008 and 0009). No migration drops either. Which overloads exist on a live database is UNVERIFIED. Test every overload that exists.
- **Printing gate (7F, after approval):** approve and retry are refused, with no rows and no order status change. Claim returns nothing. `mark_printing` refuses. Finish works for a printing job. Queued jobs resume when the shop is ACTIVE.
- **Duplicate-print fix:** retry refused when a sibling is `sent`. Retry refused for a source that is not the latest attempt. Retry still works for `failed` and confirmed `needs_check`. Existing printing tests unchanged.
- **Refund and claim fix:** defined after diff review. Must include a check that a refunded order's files are not claimed.
- **Held-job limit (M1, not approved for implementation):** 7-day failure. Reason code. File eligibility per the rule chosen under C-1. Printing jobs' files never deleted. No effect on other orders.
- **Owner status:** enforcement off returns no fields. Enforcement on returns only the D fields. Staff denied.
- **Timezone:** 29 February plus 12 months gives 28 February.
- **Regression:** 0011 changes no existing function, trigger, policy, or grant. Checked statically and at runtime.

### 12B.12 Next gates (none authorised by this document)

1. Owner answers to C-1, C-2, C-3, C-4, C-5, C-6, C-10, and the pending items in §12B.3.
2. Separate approval for local setup (Option A), The setup steps are not reproduced in this file and must be written out and reviewed before that approval is requested.
3. Separate approval to inspect the local Auth schema (L).
4. Separate approval to create migration 0011 to the corrected 7B spec (§12B.5, §12B.11).
5. Separate approval for the duplicate-print fix (K), after diff review.
6. Separate approval for the refund and claim fix (M7), after diff review.
7. Separate approval for each of 7C, 7D, 7E, and 7F. The M1 rule has its own review (§12B.6).

## 13. Revision log

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
| Trial | Deferred under the earlier direction (chat-plan labels N2 and A7). §9 item 5 still open | §9 item 5; §12A.5; §12A.6; §12A.11; C-10 |
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

**Figures still provisional:** the 10,000-shop net and Resend tier cost (§5A, §8); the email tier E (§5A, undecided); the 100-shop result (Free or Pro depending on E); the grandfathering illustrations, which depend on N (not provided), on E, and on the accrual or cash basis (§5B); hosting cost (§4); database overage (§5C); FX rate (§6 item 10); retention cost (§5C).
