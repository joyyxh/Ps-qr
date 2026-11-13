# Stage 7 decisions: draft for owner review

**Status:** DRAFT PROPOSAL. This file is not an approval of any business, legal, tax, pricing, or technical decision.
**Date:** 2026-10-29. Revised 2026-10-29 after the read-only audit. Corrections are listed in §13.
**Worktree:** `/home/claude/joyyxh/ps-qr-stage7`, branch `stage7-payments`, base `origin/main` at `717717b`
**Committed:** No. Untracked draft.

**Labels used**
- **PENDING OWNER APPROVAL:** every undecided item.
- **Verified:** read on the access date from the cited official or primary page. **Re-fetched** marks a page read again in the 2026-10-29 revision. Other Verified rows are from Phase 1 and were not re-fetched.
- **Secondary:** a third-party or company-blog summary, not checked against the primary text.
- **Assumed:** no source; a working number for the model.
- **Derived:** calculated from Verified or Assumed inputs. The formula is shown.
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
| Number of existing shops that would receive a free period | [OWNER TO PROVIDE] |

---

## 2. Repository facts

- Migrations `0001` to `0010` contain no plan, billing, licence, or entitlement column. (Searched 2026-10-28 and 2026-10-29 in earlier work. Not re-run in the 2026-10-29 revision.)
- No Stripe or Razorpay code or dependency exists in `web/`, `mobile/`, `agent/`, or `supabase/`. Stripe appears in the worktree only in `README.md`, `CLAUDE.md`, and this draft. Razorpay appears only in this draft (grep, 2026-10-29).
- **"Stripe is installed" appears in `README.md`.** Lines 22 and 35 read "Stripe is installed but not connected" and "Stripe (installed, not connected)". This is a README statement, not evidence of an installed package. The bare word "installed" also appears in unrelated code and docs: `agent/src/cli.mjs`, `agent/src/printers/linux.mjs`, `agent/src/printers/windows.mjs`, `agent/test/printers.test.mjs`, and `TODO.md` line 38. The tracked-file search was capped at ten lines, so this list is not exhaustive. The Stripe claim rests on `README.md` lines 22 and 35.
- No direct Resend or SMTP API call exists in `web/`, `agent/`, or `supabase/` (grep, 2026-10-29). The "Resend code" button in `web/src/owner.js` (lines 327–350) is one-time-code UI text, not the Resend email provider. The repo does not show whether Supabase Auth uses custom SMTP. The Supabase dashboard was not checked.
- Next free migration number: `0011`.
- Worktree: `stage7-payments` at `717717b`. Untracked: `CLAUDE.md`, and this file.
- Main checkout: three pre-existing modified files (`agent/README.md`, `agent/src/worker.mjs`, `agent/test/worker.test.mjs`) and stash `b559dce`. Not touched.

---

## 3. Externally verified facts

| Fact | Source | Type |
|---|---|---|
| Businesses from India cannot sign up on Stripe's website. Accounts are invite-only, with no published criteria or timeline. Active Indian accounts continue. | Stripe support, "Stripe accounts are invite-only in India", https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india | Verified |
| Stripe India: domestic Visa and Mastercard 2%. Domestic debit 0.4%, capped at ₹200 per footnote. No setup or monthly fee. ₹1,000 per dispute received. Refunds do not return processing fees. Page undated. | Stripe, "Pricing & Fees" (India), https://stripe.com/in/pricing | Verified, undated |
| Stripe charges 18% GST on its fees. **No GST on fees for single card transactions up to ₹2,000.** This is a GST rule stated by Stripe. Stripe's fee rate is not stated as a separate rate for this case. | Stripe support, "Taxes on Stripe fees for India-based businesses", https://support.stripe.com/questions/taxes-on-stripe-fees-for-india-based-businesses | Verified |
| Stripe India requires PAN, except for sole proprietors. The payout account must be in the legal entity's name. Stripe India Pvt Ltd acts as a payment aggregator under RBI KYC rules. | Stripe, "Complying with RBI's Guidelines on Payment Aggregators and Payment Gateways and KYC Master Direction, 2016", https://stripe.com/en-fi/guides/rbi-guidelines-kyc-direction | Verified (Stripe-hosted) |
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
| **GitHub Pages:** available in public repositories on GitHub Free. Private repositories need GitHub Pro, Team, Enterprise Cloud, or Enterprise Server. If the owning account is on GitHub Free, the repository must be public. Pages sites are publicly reachable even when the repository is private, if the plan allows. | GitHub Docs, "Creating a GitHub Pages site", https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site | **Re-fetched 2026-10-29** |
| RBI directions (21 Apr 2026): recurring transactions up to ₹15,000 need no extra authentication. | MediaNama, https://www.medianama.com/2026/04/223-rbi-additional-factor-authentication-e-mandates/ | Secondary; RBI text not read |
| DPDP Rules notified Nov 2025. Most obligations apply 18 months after publication. | Storyboard18, https://storyboard18.com/amp/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm (dated 14 Nov 2025) | Secondary. "About May 2027" is my arithmetic. Penalties not in source. |
| Competitor prices: myBillBook Plus ₹3,490/yr, Pro ₹3,990/yr. The page's listed prices conflict with its struck-through figures. **Not a like-for-like comparator (billing software, not print ordering). Not used in any pricing decision.** | myBillBook, https://mybillbook.in/pricing-plans (undated) | Verified, undated |
| Competitor prices: GoFrugal entry billing ₹5,000–15,000 one-time or ₹500–1,500/month, before GST. | GoFrugal, https://cdn-origin.gofrugal.com/blog/billing-software-cost/ (dated 6 May 2026) | Verified, dated |
| Competitor prices: Petpooja $800, $1,600, $2,000 per outlet per year. Restaurant POS, not a direct comparator. | Petpooja, https://amd.petpooja.com/pricing (undated) | Verified, undated |
| Competitor prices: Printo ₹5 per "piece" for unbound documents. "Piece" undefined. | Printo, https://printo.in/p/document-printing-service-in-india (undated) | Verified, undated. Customer-facing, not a subscription comparator |
| USD/INR ≈ ₹94.6 implied by a 22 Oct 2026 rate table. | Ekantipur, https://ekantipur.com/business/2026/10/22/en/october-22-2026-whats-the-exchange-rate.html | Secondary, indirect |

**Access date for all rows above: 2026-10-29**, during Phase 1 research. The GitHub Pages row was re-fetched on 2026-10-29 during the revision. No other row was re-fetched in the revision.

---

## 4. Unverified or unresolved

- **Stripe access:** invite-only for new businesses. Whether QRquick has an account or invite is unknown.
- **Razorpay India onboarding:** the Razorpay docs I could read show only US sign-up. Self-serve for Indian businesses is unverified.
- **Stripe UPI and netbanking fees (India):** unverified. The general page shows 2% UPI; no India-specific page was read. Settlement timing and payout schedule unverified.
- **Stripe ≤₹2,000 rule for debit cards:** the rule is stated for "card transactions". Whether it covers debit cards is unverified.
- **GST classification:** 18% is likely for this kind of service, but no source confirms it for QRquick's service.
- **Exemption status:** Notification 10/2017-IT's current status, later amendments, and how the ₹10 lakh special-category limit applies are unchecked.
- **Registration route:** a qualified Indian CA must decide. No legal conclusion is drawn here.
- **Input tax credit and reverse charge (new):** whether QRquick, if registered, can claim input credit on its own costs (Supabase, Resend, domain, and others), and how reverse-charge applies to foreign services. Not modelled. **CA review required.**
- **TDS:** whether business customers deduct TDS on payments to QRquick. Unverified.
- **Consumer protection and refunds:** not researched. No legal conclusion is drawn here.
- **RBI e-mandate:** whether manual annual payments fall under the e-mandate rules. Not decided here. Based on a secondary summary.
- **DPDP penalties:** not in the source read.
- **Supabase data location:** project region not in repo. `ap-south-1` availability for new projects unconfirmed.
- **Hosting (GitHub Pages):** the ₹0 assumption is **PROVISIONAL**. Official documentation (re-fetched 2026-10-29) says Pages on private repositories needs a paid GitHub plan, and that a GitHub Free account must use a public repository. Repository visibility and the owning account's plan are **not verified**. The tool refused an unauthenticated fetch of the repository URL because the URL was not in an approved source; that refusal is not evidence of visibility either way. The price of any paid GitHub plan is not in this draft and was not retrieved.
- **Resend tiers above Pro (new):** the price and email limit of any tier above Pro (50,000 emails/month) were not retrieved. The 10,000-shop net is **PROVISIONAL**.
- **Emails per order (new):** not in the repo. It is an assumption, shown as E in §5A.
- **Database size and overage (new):** not estimated. Overage beyond 8 GB is unmodelled.
- **FX rate:** no official USD/INR rate retrieved. The FBIL reference-rate page was blocked to my tool by robots. No RBI rate found.

**This file is not legal or tax advice.** A qualified Indian CA and lawyer must review the tax and legal items.

---

## 5. Assumptions and formulas

| Assumption | Value | Status |
|---|---|---|
| FX | ₹95 per USD | Assumed. Sensitivity in §6 item 10. |
| Supabase Pro | $25 × 95 = ₹2,375/month | Verified price × assumed FX |
| Resend Free | ₹0. 3,000 emails/month; 100/day | Verified limits |
| Resend Pro | $20 × 95 = ₹1,900/month, only when Pro is needed (§5A) | Verified price × assumed FX |
| Domain | ₹100/month | Assumed |
| Accounting and GST filing | ₹3,000/month. 54.8% of F_A. | Assumed, no source |
| Fixed base, Resend Free | F_A = 2,375 + 100 + 3,000 = **₹5,475** | Derived |
| Fixed base, Resend Pro | F_B = F_A + 1,900 = **₹7,375** | Derived |
| Processor fee, main case | 2.36% of gross (2% plus 18% GST on the fee) | Assumed. Conservative main case. |
| Stripe card, ≤₹2,000 GST rule | No GST on fees for single card transactions up to ₹2,000 | Verified rule (§3) |
| Stripe card fee rate under that rule | 2.00% of gross (2% with the 18% GST removed) | **Derived** from the verified rule. Sensitivity only. |
| Stripe debit fee | 0.4% (§3, Stripe pricing row) | Verified rate. Whether the ≤₹2,000 rule applies to debit is Unverified (§4). |
| Licence GST rate | 18% | Assumed classification (§4) |
| Orders per shop | 20/month | Assumed |
| File size | 2 MB average | Assumed |
| Emails per order | E. Not in the repo. §5A shows E = 1, 2, and 2.5. | Assumed |
| File retention | 30 days after finish, per `docs/PRINTING_STATUS.md` | **NOT DEPLOYED.** That file says "Built, not deployed" (line 24). Deployment not verified. See §5C. |
| Payment pattern | Yearly, all shops pay, no churn. The base tables do not model trials, free periods, or churn (see §5B). | Assumed |
| Unpriced | Founder and support time, compute upgrades, database overage, paid GitHub plan if needed, CA and lawyer fees | Excluded. See §8 and §8A. |

**Formulas**
- Ex-GST price = price incl. GST ÷ 1.18
- GST = price incl. GST − ex-GST price
- Processor fee = fee rate × gross (the price incl. GST)
- Monthly net per shop, GST charged = (ex-GST ÷ 12) − (fee ÷ 12)
- Monthly net per shop, GST not charged = (gross ÷ 12) − (fee ÷ 12)
- **Break-even shops (minimum to cover costs) = ⌈fixed monthly ÷ monthly net per shop⌉.** Rounded up, because a fractional shop does not exist and the smallest whole number that covers costs is needed.
- **Maximum shops under a turnover limit = ⌊limit ÷ annual ex-GST price⌋.** Rounded down, because the limit is a maximum. See §6 item 7.

### §5A Email volume and the Resend threshold

E = emails per order. **Assumed, not from the repo.** Pro thresholds are Verified (§3 Resend row). Order volume is 20 orders per shop per month, which is Assumed.

- Monthly emails M = shops × 20 × E
- Free tier ceiling: M ≤ 3,000 per month. The 100/day limit gives the same ceiling on average (100 × 30 days = 3,000). Daily peaks can exceed 100 earlier.
- Pro tier ceiling: M ≤ 50,000 per month.
- Maximum shops on Free = 3,000 ÷ (20 × E) = **150 ÷ E**
- Maximum shops on Pro = 50,000 ÷ (20 × E) = **2,500 ÷ E**

| E (emails per order) | Maximum shops on Free | Maximum shops on Pro |
|---|---|---|
| 1 | 150 | 2,500 |
| 2 | 75 | 1,250 |
| 2.5 | 60 | 1,000 |

Implications:
- **100 shops:** M = 2,000 (E = 1) or 4,000 (E = 2). Pro is needed at 100 shops only if E is above 1.5.
- **1,000 shops:** M = 20,000 (E = 1), 40,000 (E = 2), 50,000 (E = 2.5). Pro covers 1,000 shops up to E = 2.5.
- **10,000 shops:** M = 200,000 (E = 1) or 400,000 (E = 2). That is 4 and 8 times the Pro allowance. Pro cannot cover 10,000 shops at any E above 0.25. The price of the next tier is not retrieved (§4), so the 10,000-shop net is **PROVISIONAL**.
- **Sign-up codes** are not counted in M. The built-in Supabase auth limit is 2 emails per hour (§3), so production sign-up email would need custom SMTP. Which provider to use and when is not decided. **PENDING OWNER APPROVAL.**

### §5B Timing: free periods and trials

- Per paying shop, GST charged: ₹1,234.96 net per year (ex-GST ₹1,270.34 less the full-year fee ₹35.38). ₹102.91 per month.
- The base tables assume every shop pays from month one, with no trial, free period, or churn.
- **Illustration only. PENDING OWNER APPROVAL (decision 8).** The number of existing shops is [OWNER TO PROVIDE]. The example uses 100 shops for arithmetic. GST charged, Pro fixed cost of ₹7,375 per month.
  - Year-one net if all pay from month one: 100 × 1,234.96 − 12 × 7,375 = 1,23,496 − 88,500 = **+₹34,996**
  - Year-one net if all 100 are free for year one: 0 − 88,500 = **−₹88,500**
  - Net licence revenue deferred out of year one: 100 × 1,234.96 = **₹1,23,496**
  - Monthly net once paying: 100 × 102.91 − 7,375 = **₹2,916.35**
  - Recovering the ₹88,500 shortfall: 88,500 ÷ 2,916.35 = 30.35, so 31 whole months after year one. Cumulative break-even at **month 43 from launch**.
- **Trial (decision 5, 30 days):** moves each new shop's first payment back by 30 days. Not modelled as lost revenue. It changes timing only.

### §5C Storage, retention, and egress (10,000-shop scenario)

- **Retention status: NOT DEPLOYED.** `docs/PRINTING_STATUS.md` line 24 reads "Built, not deployed." Deployment was not verified in this revision (no Supabase or GitHub Actions access was used).
- Storage with 30-day retention (steady state): GB = shops × 20 orders × 2 MB ÷ 1,000 = 10,000 × 20 × 2 ÷ 1,000 = **400 GB**
- Without retention, storage grows every month: 400 GB × months. After 12 months: 4,800 GB. Overage: (4,800 − 100) × $0.0213 = $100.11 ≈ ₹9,510 per month. **Illustration only. Not in any table.**
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
5. **10,000-shop row, arithmetic.** Revenue ex-GST ₹10,58,616. Fees ₹29,480. Net ₹10,19,871 from unrounded values, with fixed costs of ₹9,264.55. The earlier ₹10,19,870 came from rounding the overage up to ₹1,890 before subtracting. The net is **PROVISIONAL** and an upper bound (§5A, §8). The first report's "₹1,01,000" was a magnitude error. The second report's ₹10,19,869 was a rounding slip.
6. **GST registration route.** The Phase 1 advice to "register before first inter-state sale" was overstated. Notification 10/2017-IT exempts inter-State taxable service suppliers with all-India turnover up to ₹20 lakh (₹10 lakh for special-category states), as shown on the CBIC PDF. Its current status is **Unverified**. The s.22 threshold also applies to services supplied within one State, at the same figures. A CA must confirm which provision applies.
7. **Shop counts under the turnover limits (corrected).** Maximum shops = ⌊limit ÷ annual ex-GST price⌋.
   - ₹20 lakh ÷ ₹1,270.34 = 1,574.4, so **1,574 shops** (turnover ₹19,99,514). 1,575 shops would be ₹20,00,784, which is over the limit.
   - ₹10 lakh ÷ ₹1,270.34 = 787.2, so **787 shops** (turnover ₹9,99,757). 788 shops would be ₹10,01,027, which is over the limit.
   - These counts apply only if licences are the only turnover. The earlier figures of 1,575 and 788 rounded up, which breaks the maximum. Break-even counts (§5) are the opposite case: they round up.
8. **Stripe fee GST.** The 2.36% figure is the conservative main case. The ≤₹2,000 rule gives a derived 2.00%, kept as a separate sensitivity. Option C (₹2,999) is above ₹2,000, so it stays at 2.36%. Option A (₹499) would qualify. At 2.00% its net is ₹34.41 per month, with break-evens of 160 / 215 (GST charged). The difference is negligible.
9. **Razorpay "updated 27 Oct 2026".** Unverified. The zero-fee offer may not be current.
10. **FX.** ₹95 is an estimate. Each ±₹5 moves Supabase by ±₹125 per month, and Resend Pro by ±₹100 per month when Pro applies. Total: **±₹225 per month at 100+ shops**. At 10,000 shops the USD overage ($19.89) adds ±₹99.45. The indirect ₹94.6 reading (§3) would lower Supabase by about ₹10 per month.
11. **Scope.** The 10,000-shop row excludes compute tier upgrades, database overage (§5C), the Resend tier above Pro (§5A), support, and founder time. The flat ₹3,000 accounting figure probably understates cost at volume; no source exists.
12. **Email (new).** Resend Pro does not cover 10,000 shops (§5A). The 100-shop trigger was not derived from order volume and is now derived in §5A.
13. **Retention (new).** Retention is not deployed (§5C). The storage overage assumes it is.
14. **Timing (new).** Free periods and trials delay revenue (§5B). The base tables assume all shops pay from month one.
15. **Input tax credit (new).** Not modelled (§4). The GST-charged net is conservative on this side if QRquick can claim credit. **CA review required.**
16. **Comparators (new).** The myBillBook comparison is removed from §7. It is not like-for-like, and its own page conflicts. It stays in §3 as a reference row only.
17. **Hosting (new).** GitHub Pages costs ₹0 only if the repository is public, or the owning account is on a paid GitHub plan (§3 GitHub Pages row). Visibility and plan are unverified. Hosting cost is **PROVISIONAL**.

---

## 7. Pricing options (all PENDING OWNER APPROVAL)

All options: 12-month term, paid by a new payment each year, no automatic renewal. Figures use the assumptions in §5. The base tables assume every shop pays from month one (§5B). **PENDING OWNER APPROVAL.**

| | **A: Low-cost pilot** | **B: Recommended proposal** | **C: Higher-priced** |
|---|---|---|---|
| Price incl. GST | ₹499 | ₹1,499 | ₹2,999 |
| Ex-GST price (÷ 1.18) | ₹422.88 | ₹1,270.34 | ₹2,541.53 |
| GST (if charged) | ₹76.12 | ₹228.66 | ₹457.47 |
| Processor fee, 2.36% (main case) | ₹11.78/yr (₹0.98/mo) | ₹35.38/yr (₹2.95/mo) | ₹70.78/yr (₹5.90/mo) |
| Monthly net per shop, GST charged | ₹34.26 | ₹102.91 | ₹205.90 |
| Monthly net per shop, GST not charged | ₹40.60 | ₹121.97 | ₹244.02 |
| **GST-charged scenario:** break-even shops, Resend Free / Pro | 160 / 216 | **54 / 72** | 27 / 36 |
| **No-GST scenario:** break-even shops, Resend Free / Pro | 135 / 182 | **45 / 61** | 23 / 31 |
| Pilot of 20 shops, net monthly, GST charged, Resend Free | 20 × 34.26 − 5,475 = **−₹4,790** | n/a | n/a |
| Advantages | Lowest barrier to trial. Fast feedback. | Covers fixed costs at 54 (Free) or 72 (Pro) shops in the GST-charged scenario, and at 45 or 61 with no GST. | Fewer shops needed: 27 / 36 in the GST-charged scenario, 23 / 31 with no GST. Room for added value. |
| Disadvantages | Needs 160 (Free) or 216 (Pro) shops in the GST-charged scenario, and 135 or 182 with no GST. Runs at a loss during the pilot. Hard to raise later. | Above the pilot price. Needs evidence of willingness to pay. | Smaller market. Added value is **not defined or built**; must not be charged until built. |

**Sensitivities for Option B, GST-charged scenario (Resend Free / Pro):**
- Stripe card, ≤₹2,000 rule (derived 2.00%): fee ₹29.98; net ₹103.36 per month; **53 / 72**
- Debit at 0.4%, no GST on the fee (assumes the rule applies to debit, which is Unverified): net ₹105.36 per month; **52 / 70**
- Debit at 0.4% with 18% GST on the fee (rule not applied): net ₹105.27 per month; **53 / 71**
- Without the ₹3,000 accounting cost: **25 / 43**

**Sensitivity for Option A:** at the derived 2.00%, net ₹34.41 per month; break-even **160 / 215** (GST charged).

**Note on Option C:** the "additional value" is undecided. The current product does not include premium features. Any premium tier needs a written feature list and build plan first. **PENDING OWNER APPROVAL (decision 12).**

---

## 8. Revenue table, Option B, GST charged (monthly, ₹)

| Shops | Gross billing | GST collected (liability) | Revenue ex-GST | Processor fees | Fixed costs | Net |
|---|---|---|---|---|---|---|
| 10 | 1,249 | 191 | 1,059 | 29 | 5,475 | −4,446 |
| 100 | 12,492 | 1,906 | 10,586 | 295 | 7,375 | 2,916 |
| 1,000 | 1,24,917 | 19,055 | 1,05,862 | 2,948 | 7,375 | 95,539 |
| 10,000 | 12,49,167 | 1,90,551 | 10,58,616 | 29,480 | 9,265 | 10,19,871 (**PROVISIONAL, upper bound**) |

**Rounding.** Every figure is calculated from unrounded values, and each displayed figure is then rounded separately. A row can therefore fail to sum by ₹1:
- 10-shop row: 1,249 − 1,059 = 190, but GST shows 191. Unrounded: 1,249.17 − 1,058.62 = 190.55, which rounds to 191.
- 10,000-shop row: the displayed fixed cost of ₹9,265 is the ₹1,889.55 overage rounded up. Unrounded fixed cost is ₹9,264.55, giving net ₹10,19,870.94, which rounds to ₹10,19,871. The earlier ₹10,19,870 came from using the rounded fixed cost.

Other notes:
- Per shop: gross ₹124.92, GST ₹19.06, revenue ₹105.86, fee ₹2.95, net ₹102.91.
- Net = revenue ex-GST − fees − fixed costs. GST is excluded from net because it is passed to the government when QRquick is registered.
- Fixed costs at 10,000 shops: Supabase ₹2,375 + Resend Pro ₹1,900 + domain ₹100 + accounting ₹3,000 + overage ₹1,890 = ₹9,265. The Resend element is insufficient (§5A) and the next tier is not priced, so the net is an **upper bound**.
- Excludes: compute upgrades, database overage (§5C), support, founder time, trials, free periods and churn (§5B), cash timing of yearly prepayment, and input tax credit (§4).

---

## 8A. One-time costs (new)

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

Each item is a proposal, not a decision.

1. **Licence unit.** Proposal: per shop. Options: per owner; per printer computer. **PENDING OWNER APPROVAL.**
2. **Term.** Proposal: 12 months; the owner pays again each year; no automatic renewal. Options: yearly manual renewal; one-time (not recommended, since recurring costs need recurring income). **PENDING OWNER APPROVAL.**
3. **Price.** Proposal: Option B, ₹1,499 incl. GST, as the starting point. Options: A (₹499 pilot); C (₹2,999); other. **PENDING OWNER APPROVAL.**
4. **GST route.** No option chosen. Options: (a) stay unregistered and charge no GST, only if a CA confirms the exemption applies; (b) register and charge GST on an inclusive price. Input credit: whether a registered shop can claim input credit on the licence depends on QRquick issuing valid GST invoices. This claim is **unsourced** in this draft. Whether QRquick can claim input credit on its own costs, and the reverse-charge treatment of foreign services, are **not modelled**. **PENDING OWNER APPROVAL. CA review required.**
5. **Trial.** Proposal: 30 days, no card, one per owner account. Options: none; 14 days. A trial delays first payment and is not modelled (§5B). **PENDING OWNER APPROVAL.**
6. **Refunds.** Proposal: full refund within 7 days. After that, only for duplicate charges or a QRquick outage. QRquick absorbs the processor fee: ₹35.38 per year on a ₹1,499 card payment at 2.36%, or ₹29.98 at the derived 2.00%. Each Stripe dispute costs ₹1,000 (§3, Stripe pricing row). That is Stripe's dispute fee. Pausing the licence during a dispute does not itself cost ₹1,000. **PENDING OWNER APPROVAL. Lawyer review required.**
7. **Expiry behaviour.** Proposal: no new customer orders. In-flight paid orders finish. The print agent claims no new jobs. Owners keep read and CSV export. No early deletion of data. **PENDING OWNER APPROVAL.**
8. **Existing shops.** Proposal: free for 12 months from launch, with 30 days' written notice before the first charge. Effect: no licence revenue from these shops in year one. The §5B illustration for 100 shops gives year-one net of −₹88,500 instead of +₹34,996. Existing-shop count: [OWNER TO PROVIDE]. **PENDING OWNER APPROVAL.**
9. **Processor.** Options: Stripe, only if an active account or invite exists; Razorpay, only after its India signup is verified; defer. Neither is confirmed available. **PENDING OWNER APPROVAL.**
10. **Stage 6 merge order.** Proposal: owner reviews and merges Stage 6 before Stage 7 is rebased. Not merged by me. **PENDING OWNER APPROVAL.**
11. **Advisers.** Proposal: engage an Indian CA and lawyer before any payment launch. **PENDING OWNER APPROVAL.**
12. **Premium features.** Proposal: none for now. Options: name the features to build first. **PENDING OWNER APPROVAL.**

---

## 10. Blockers before payment integration

1. **Business identity:** entity type, PAN, and registered state are unknown. A processor cannot be onboarded, and GST cannot be registered, without them.
2. **Processor access:** Stripe is invite-only for new Indian businesses. Razorpay India signup is unverified.
3. **Tax route:** registered or unregistered, plus the GST classification, input credit, reverse charge, and any TDS treatment. A CA must decide.
4. **Invoicing:** the repo has no GST invoice code or numbering (from earlier review; not re-checked on 2026-10-29). Needed if registered.
5. **Product definition:** licence gates and expiry rules (decisions 7 and 12) drive Phase 2 code.
6. **Legal terms and refunds:** a lawyer must review them.
7. **Settlement account:** processors require a bank account in the entity's name. Unknown.
8. **Data location:** the Supabase project region is not in the repo. `ap-south-1` availability is unconfirmed.
9. **TDS on business payments:** unverified.
10. **Email provider (new):** whether Supabase Auth uses custom SMTP, and which provider, is not decided. The built-in limit is 2 emails per hour (§3). **PENDING OWNER APPROVAL.**

---

## 11. Sources

Access date: 2026-10-29, unless stated.

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
- GitHub Docs: "Creating a GitHub Pages site", https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site (**re-fetched 2026-10-29**)
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
- Revised 2026-10-29 after the read-only audit. Corrections are listed in §13.
- `CLAUDE.md` is untouched and still untracked.
- No application code, migrations, tests, Edge Functions, or configuration were changed.
- No payment-provider, Stripe, Razorpay, or Supabase calls. No credentials used.
- Re-fetched in this revision: GitHub Pages documentation only. The tool refused a fetch of the repository URL, so repository visibility is unverified.
- Phase 2 has not started.
- **Waiting for owner review.**

---

## 13. Revision log (2026-10-29)

| # | Requested correction | Where applied |
|---|---|---|
| 1 | Shop counts rounded down for maximum turnover limits | §5 formulas; §6 item 7; §3 s.22 row |
| 2 | 10,000-shop Resend cost corrected; next tier unverified; net provisional | §5A; §8; §6 item 12; §4 |
| 3 | "Stripe is installed" tied to README.md, not "appears nowhere else" | §2 |
| 4 | ₹1 rounding differences explained | §8 rounding note; §6 item 5 |
| 5 | GST-charged labels; no-GST alternatives shown separately | §7 table and sensitivities; §6 items 1–2 |
| 6 | Resend threshold derived from emails per order | §5A |
| 7 | myBillBook comparison removed from pricing | §6 item 16; §7; §3 row marked |
| 8 | Verified Stripe rule separate from derived 2.00%; 2.36% kept; debit qualified | §3; §5 table; §6 item 3; §7 |
| 9 | FX sensitivity includes Resend Pro | §6 item 10 |
| 10 | Retention marked not deployed; storage formula and assumption shown | §5 table; §5C |
| 11 | Free period and trial timing modelled; base assumption of month-one payment disclosed | §5B; §5 table; §9 item 8 |
| 12 | Input tax credit and reverse charge flagged for CA; unsourced claim qualified | §4; §6 item 15; §9 item 4 |
| 13 | ₹1,000 dispute fee distinguished from licence pause | §9 item 6 |
| 14 | GitHub Pages rules from official docs; visibility unverified; hosting provisional | §3 new row; §4; §6 item 17 |
| 15 | One-time cost section, including conditional Google Play fee | §8A |
| 16 | Database overage marked unmodelled | §5C; §8; §4 |
| 17 | GST threshold scope limited to services | §3 s.22 row; §6 item 6 |
| 18 | Source titles aligned; accounting share at one decimal | §3; §11; §6 item 2 |

**Figures still provisional:** the 10,000-shop net and Resend tier cost (§5A, §8); hosting cost (§4); database overage (§5C); FX rate (§6 item 10); retention cost (§5C); emails per order E (§5A); the §5B illustration (depends on the existing-shop count).
