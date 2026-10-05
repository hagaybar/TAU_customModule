# Guest 500-result paging limit & reCaptcha — what it is and what TAU has to do

**Date:** 2026-09-07
**Trigger:** MALMAD notice that the September 2026 Primo release is live on the SB environment,
asking TAU to look at guest paging beyond 500 results and at the reCaptcha mechanism
("אצלנו לא מוגדר").
**Scope:** Alma/Primo VE back-office configuration only. **Nothing in this repo changes.**

---

## 0. Update, 2026-09-08 — reCaptcha is live in production

Everything below was written while reCaptcha was still switched off. It has since been enabled on
production. Verified independently the same day:

- `/primaws/rest/pub/configuration/vid/972TAU_INST:NDE` now reports `"Activate Captcha [Y/N]" : "Y"`
  with a populated `Public Captcha Key` (the site key is public by design and also appears in the
  page source; the secret key does not appear and never should).
- Google's `recaptcha/api.js` loads on the results page, with the anchor iframe bound to
  `tau.primo.exlibrisgroup.com`.
- A guest paging to result 500 no longer gets "GUEST LIMIT REACHED / Sign in to continue". They now
  get **VERIFY / Verify you are human** with the "I'm not a robot" checkbox.

![reCaptcha on production, English](../assets/research/recaptcha-verify-prod-en.png)

![reCaptcha on production, Hebrew](../assets/research/recaptcha-verify-prod-he.png)

**Not yet confirmed:** that passing the checkbox actually returns the guest to result 501 rather than
page 1. That last step needs a person — it is a human-verification control and should not be
automated.

**New defect found, Ex Libris' to fix.** On the Hebrew interface Primo translates its own dialog
("אימות" / "אמתו שאתם בני אדם") but requests the Google widget with `hl=en`, so the checkbox reads
"I'm not a robot" in English on a `lang="he"` `dir="rtl"` page. Google's `api.js` accepts a language
parameter, so this is Primo not passing the interface language through. The custom module cannot
reach it. Worth a support case — on a Hebrew-first interface an untranslated verification control is
a usability and accessibility problem.

**Still open:** whether `tau-psb.primo.exlibrisgroup.com` is registered on the same Google key.
Production proves the production host is; nobody has checked the sandbox host, and it will matter at
the next refresh (§6). Until that refresh the sandbox still shows the old sign-in dialog, which is
expected.

A team-facing handover document covering the whole setup was produced separately (kept outside this
repository, because it carries a slot for key material).

---

## 1. The one-paragraph version

Guests are cut off at result 500. That is **already live in TAU production**, not just SB — verified
today. Without reCaptcha the guest gets a modal saying "GUEST LIMIT REACHED — sign in to continue".
With reCaptcha configured, the guest passes a checkbox challenge and keeps browsing from where they
were. TAU has reCaptcha switched off in both PROD and SB. Turning it on is a back-office change, but
it is **effectively irreversible without an Ex Libris Support case**, and it also puts a captcha in
front of Export-to-Email and Give Us Feedback. There is also a Google-side complication that the Ex
Libris instructions do not mention (§5).

---

## 2. What we verified live (Tier B)

Guest session (not signed in), Chromium via Playwright, 2026-09-07, view `972TAU_INST:NDE`,
query `history`, 10 results per page.

| Environment | Host | Result |
|---|---|---|
| Premium Sandbox | `tau-psb.primo.exlibrisgroup.com` | Paging normal up to offset 480 (results 481–490). Page 51 (offset 500 → results 501–510) is blocked by a modal. |
| **Production** | `tau.primo.exlibrisgroup.com` | **Identical.** Same block, same modal, same offset. |

The modal, English UI:

> **GUEST LIMIT REACHED**
> Sign in to continue
> `OPENATHENS - ACTIVE`
> Cancel

![Guest limit modal, English](../assets/research/guest-limit-500-en.png)

Hebrew UI — fully translated already, no label work needed:

> **הגעתם למגבלה כאורח**
> התחברו כדי להמשיך
> `OPENATHENS - פעיל`
> ביטול

![Guest limit modal, Hebrew](../assets/research/guest-limit-500-he.png)

Other observed behaviour:

- The results behind the modal never render — the page shows skeleton placeholders.
- **Cancel** drops the user back to offset 480, i.e. the last page they were allowed to see.
- A deep link with `offset=500` in the URL is normalised back to `offset=0` on a fresh page load.
  (So is `offset=100` — this is generic parameter normalisation, not the limit doing the work.)

**Captcha state, from the public config endpoint** `/primaws/rest/pub/configuration/vid/972TAU_INST:NDE`,
on **both** hosts:

```
"Activate Captcha [Y/N]" : "N",
"Public Captcha Key"     : ""
```

That confirms the report: not configured, in either environment.

### What we did **not** test

- Signed-in browsing beyond 500 (needs patron credentials).
- The documented "signing in resets the result set to page 1" behaviour.
- The reCaptcha flow itself — impossible while the keys are unset.

---

## 3. What Ex Libris documents (Tier A)

**September 2026 release — "Improved Offset-Limit Handling" (URM-331013).** The guest offset limit
goes from 250 to 500, and institutions get the option to let guests continue past it via CAPTCHA
approval. The 500 cap itself was introduced as a temporary anti-bot measure in the April and May
2026 releases, after automated traffic began degrading service.

**The three behaviours** ([Search Limitations](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/030Primo_VE_User_Interface/Search_Limitations)):

| User | reCaptcha off (TAU today) | reCaptcha on |
|---|---|---|
| Signed in | Unlimited paging | Unlimited paging |
| Guest, under 500 | Normal | Normal |
| Guest, at 500 | Prompted to sign in. On sign-in the result set **restarts at page 1** and the offset is discarded. | Passes the challenge, **continues from where they left off**. |

Ex Libris explicitly recommends enabling reCaptcha for institutions with high guest traffic.

**Where the keys go** ([Configuring reCaptcha for Primo VE](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/120Other_Configurations/Getting_reCaptcha_Site_and_Secret_Keys)):

1. Alma → **Configuration Menu > Discovery > Other > Captcha configuration**
2. Open the **Captcha Keys** mapping table
3. Fill **reCaptcha Site key** and **reCaptcha Secret key**
4. **Customize** (first time) / **Save**

**Labels**, if the captcha error strings ever need Hebrew:
Configuration Menu > Discovery > Display Configuration > Labels → **Send Email and Sms Labels**
code table → `captcha.notselected`, `captcha.invalidSiteKey`, `captcha.publickey`, `captcha.privatekey`.

---

## 4. The three things Ex Libris' page says that are easy to miss

1. **It cannot be turned off again from the back office.** Verbatim: *"Once saved, this
   functionality cannot be disabled manually; the keys can be modified, but they cannot be left
   undefined. To disable this functionality, open a Support ticket."* Treat enabling as a one-way
   door.
2. **It is not only about paging.** The same keys switch reCaptcha on for the **Export to Email**
   action and the **Give Us Feedback** tool. Those are used far more often than "guest pages past
   result 500", so this decision changes the everyday UX, not an edge case.
3. **"Report a problem" in the NDE UI is not covered** — Ex Libris says a different security
   mechanism will come for it later.

---

## 5. The Google-side complication (not in the Ex Libris instructions)

Ex Libris' linked PDF (*How to get reCAPTCHA keys*) tells you to go to `google.com/recaptcha`,
tick **reCAPTCHA v2**, add your domain, and copy the Site and Secret keys. So Primo wants a
**v2 checkbox** key pair using the legacy `siteverify` verification.

Two things have changed on Google's side since that PDF was written, and both need checking before
anyone promises a date:

- **Classic key creation is being wound down.** New reCAPTCHA keys are created in the **Google Cloud**
  console. To get something Primo can use, create a key with challenge type **Challenge (v2)**, then
  on the key's detail page open **Integration → Use Legacy Key** to reveal the legacy secret key that
  `siteverify` (and therefore Primo) expects. This needs a **Google Cloud project** owned by someone
  at TAU.
- **The free tier was cut on 2026-04-02**, reportedly from 1,000,000 to **10,000 assessments per
  month per organisation**, aggregated across all keys and all projects. Because enabling reCaptcha
  also covers email-export and feedback (§4.2), the monthly assessment count is not just the handful
  of guests who page past 500.
  *The 10,000 figure appears in Google's own quota documentation; the "cut from 1,000,000" framing
  comes from third-party reporting.*

**Domains to register on the key:** `tau.primo.exlibrisgroup.com` and
`tau-psb.primo.exlibrisgroup.com`. If TAU ever serves Primo from a `tau.ac.il` vanity host, that
must be on the key too — no such host was found while researching this, so confirm.

### 5.1 Does this cost money? No — and no credit card is needed

Checked against Google's own documentation, because the Cloud console's "Start free" button makes
this look like a paid signup:

- **A billing account is not required.** Google's *Prepare your environment* page says you do not
  need to enable billing on the project to create keys and run reCAPTCHA; enabling it is only
  *recommended*, so that protection survives passing the free allowance.
- **"Start free" is a different thing** — the Google Cloud **free trial**: $300 of credit for 90
  days. It *does* ask for a card (a temporary $0–$1 authorisation hold, not a charge) and it does
  **not** roll into paid billing on its own; you stay unbilled unless someone clicks **Upgrade**.
  For this task the trial is unnecessary: go straight to the Cloud console, create a project, enable
  the reCAPTCHA Enterprise API (`recaptchaenterprise.googleapis.com`), and create the key. If the
  console demands a billing account at any point, stop there rather than working around it.
- **IAM role needed:** reCAPTCHA Enterprise Admin (`roles/recaptchaenterprise.admin`).

**What actually happens if TAU exceeds 10,000 a month with no billing account** — this is the part
worth knowing, because Primo verifies through the legacy `siteverify` endpoint, and Google
documents the two endpoints behaving differently on quota exhaustion:

| Endpoint | Over quota, billing off |
|---|---|
| `siteverify` (what Primo uses) | **Fails open** — returns `success: true` with a default score of 0.9, plus a quota error in the response |
| `CreateAssessment` (modern API) | Fails closed — HTTP 429, no assessment |

So the downside of running out of free quota is that **the captcha quietly stops filtering anyone**
— not a broken Primo, and not a surprise invoice. That is a mild security regression, not an outage,
which makes starting without billing a reasonable position.

### 5.2 Who owns the key

There is no TAU Libraries Google account today, so in practice the project would sit under an
individual's work Google account. TAU production discovery would then depend on a key only one
person can rotate or repair. Two cheap mitigations, both easiest at creation time:

- Add a second TAU owner on the project in **IAM**, so the key survives one person's absence.
- Plan to move the project into a TAU Google Workspace organisation later — Cloud projects can be
  migrated between organisations, but it is far easier to do before anything depends on it.

Worth noting separately: a Google Cloud project running reCAPTCHA processes end-user IP addresses
and browser signals. Whether that belongs on a personal work account rather than an institutional
one is a data-protection question for the university, not only a convenience question.

---

## 6. Sandbox refresh interaction

The Premium Sandbox is a static image of PROD, refreshed twice a year (the Sunday after the February
and August Alma releases). Consequences for this piece of work:

- Captcha keys configured **in PROD** will be copied into SB at the next refresh. Nothing to add to
  the [SB refresh playbook](../reference/sb-refresh-playbook.md).
- Captcha keys configured **only in SB** are destroyed at the next refresh. Fine for a one-off test,
  useless as a permanent state.
- The Google key must list the SB domain as well, or the widget will fail there after the refresh.

---

## 7. The decision, and what it costs

**Option A — leave it off (status quo).** Guests stop at result 500 and are told to sign in. If they
sign in, they lose their place and restart at page 1. Zero work, zero cost, no Google dependency.

**Option B — enable reCaptcha.** Guests verify once and carry on from where they were. Costs:
a one-way door in the back office; a captcha added to Export-to-Email and Give Us Feedback for
everyone; a Google Cloud project and possibly a billing account; and a privacy/accessibility review,
because reCaptcha loads Google scripts and sets Google cookies on a page that carries TAU's
Accessibility Statement and Privacy and Data Protection notices.

**Recommendation: Option B, but not yet.** It is the better end state — Ex Libris recommends it, and
the current guest experience (lose your place, start over) is worse than a checkbox. But do not touch
the Captcha Keys table until three questions have answers, because the setting cannot be undone
without a Support case:

1. Who owns the Google Cloud project holding the key, and who is the second owner? (Cost is *not*
   the blocker — no billing account is required to start, and going over the free allowance degrades
   the captcha rather than billing anyone. See §5.1–5.2. Continuity is the real question.)
2. Does the library accept a Google captcha in front of Export-to-Email and Give Us Feedback — and
   do the Privacy and Accessibility statements need updating first?
3. How many guest sessions actually reach result 500? If the answer is "almost none", Option A is
   defensible and free.

### Separate observation, worth its own check

The sign-in modal offers exactly one route: **OPENATHENS - ACTIVE**. If that is not the login TAU
patrons recognise, then today's no-captcha fallback is worse than the documentation makes it sound —
the guest is being told to sign in via a method they may not have. Worth confirming against the
production authentication profiles regardless of the captcha decision.

---

## 8. Suggested reply to MALMAD (Hebrew)

> בדקנו. המגבלה כבר פעילה אצלנו **גם בפרודקשן**, לא רק ב-SB: אורח שמגיע לתוצאה 500 מקבל חלונית
> "הגעתם למגבלה כאורח / התחברו כדי להמשיך". ה-reCaptcha אכן לא מוגדר אצלנו — לא ב-PROD ולא ב-SB
> (`Activate Captcha = N`, מפתח ריק). ההגדרה עצמה פשוטה (Discovery > Other > Captcha configuration),
> אבל שלוש נקודות עוצרות אותנו לפני הפעלה: (1) אחרי שמירה **אי אפשר לכבות** בלי פנייה לתמיכה;
> (2) אותם מפתחות מפעילים captcha גם על שליחת מייל ועל טופס המשוב, לא רק על הדפדוף;
> (3) גוגל שינתה את מנגנון המפתחות — צריך פרויקט ב-Google Cloud. זה **לא כרוך בתשלום** (המכסה
> החינמית היא 10,000 אימותים בחודש, ואין צורך בחשבון חיוב), אבל צריך להחליט מי הבעלים של החשבון.
> אנחנו בודקים את השלושה ונחזור עם המלצה.

---

## Sources

- [Primo VE 2026 Release Notes](https://knowledge.exlibrisgroup.com/Primo/Release_Notes/002Primo_VE/2026/010Primo_VE_2026_Release_Notes) — September, "Improved Offset-Limit Handling" (URM-331013)
- [Search Limitations](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/030Primo_VE_User_Interface/Search_Limitations)
- [Paging through Search Results in the NDE UI](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/End_User_Help_(NDE_UI)/Paging_through_Search_Results_in_the_NDE_UI)
- [Configuring reCaptcha for Primo VE](https://knowledge.exlibrisgroup.com/Primo/Product_Documentation/020Primo_VE/Primo_VE_(English)/120Other_Configurations/Getting_reCaptcha_Site_and_Secret_Keys) — and its linked PDF *How to get reCAPTCHA keys*
- [Create reCAPTCHA keys for websites (Google Cloud)](https://docs.cloud.google.com/recaptcha/docs/create-key-website)
- [Map legacy terminology to Google Cloud console](https://docs.cloud.google.com/recaptcha/docs/reconcile-legacy-terminology) — legacy secret key / siteverify
- [Prepare your environment (Google Cloud)](https://docs.cloud.google.com/recaptcha/docs/prepare-environment) — billing not required; API and IAM role
- [Quotas and limits (Google Cloud)](https://docs.cloud.google.com/recaptcha/quotas) — 10,000/month free; `siteverify` fails open, `CreateAssessment` fails closed
- [Google Cloud Free Trial FAQs](https://cloud.google.com/signup-faqs) — the "Start free" $300 / 90-day trial, card hold, manual upgrade
- [Alma Sandbox Environments](https://knowledge.exlibrisgroup.com/Alma/Product_Documentation/010Alma_Online_Help_(English)/010Getting_Started/040Alma_Sandbox_Environments) — refresh cadence
