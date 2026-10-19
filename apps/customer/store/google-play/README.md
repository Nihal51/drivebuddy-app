# DriveBuddy on Google Play — the kit

Everything Google Play asks for, ready to paste, and the order to do it in.
The app itself is ready: Android 16 (API 36) target, internet and
notification permissions only, no advertising ID, account deletion in the
app and on the website, English and Hindi.

| File                                 | What it is                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| [listing-en-IN.md](listing-en-IN.md) | Store listing in English: name, short and full description, category, contact  |
| [listing-hi-IN.md](listing-hi-IN.md) | The same in Hindi (a translation of the listing)                               |
| [app-content.md](app-content.md)     | Every _App content_ answer: Data safety, content rating, ads, target audience… |
| [testers.md](testers.md)             | The 14-day closed test: setup, WhatsApp message, applying for production       |
| [testers.csv](testers.csv)           | Sheet for your 15 testers' Gmail addresses                                     |
| [release-notes.md](release-notes.md) | "What's new" text for version 1.0.0, English and Hindi                         |
| `images/`                            | Icon 512×512, feature graphic 1024×500, 5 English + 5 Hindi phone screenshots  |

`npm run store:check` (in `apps/customer`) confirms all text and images fit
Google's limits. The screenshots are the real app screens with captions; once
you have the app on your phone, real phone screenshots (especially a booking
with "Driver assigned") are even better — replace any of them freely, keeping
1080×1920.

## The order (about 3 weeks, mostly waiting)

**Week 0 — before paying anything** (steps in [docs/SETUP.md](../../../../docs/SETUP.md)):

1. ☐ Website: `git push` in `C:\git\drivebuddy`, publish `firestore.rules`,
   update the robot's `Code.js` (SETUP step 0). The privacy page with the
   account-deletion section must be live:
   https://thedrivebuddy.in/privacy/#delete-account
2. ☐ Expo account → `eas init` → paste the project ID in `app.config.ts`
   (SETUP step 2).
3. ☐ Firebase: add the Android app `in.thedrivebuddy.app`, download
   `google-services.json` into `apps\customer\` (SETUP step 3).
4. ☐ Google login: Web client ID into `apps\customer\.env` (SETUP step 4.1).
5. ☐ Notifications: upload the FCM key to EAS (SETUP step 5).
6. ☐ Decide on crash reports (Sentry) and usage stats (PostHog) — free, and
   both optional (SETUP step 8). Whatever you choose changes the Data safety
   answers ([app-content.md](app-content.md)).
7. ☐ A test build on your own phone; go through
   [docs/PHONE-TEST.md](../../../../docs/PHONE-TEST.md).

**Day 1 — Play Console** (needs the $25):

8. ☐ https://play.google.com/console → sign up → **Personal** → pay $25 →
   verify your identity (Aadhaar/PAN or passport, phone number). Approval
   can take a few days.
9. ☐ _Create app_: name **DriveBuddy: Hire a Driver**, default language
   **English (India) – en-IN**, **App**, **Free**, accept the declarations.
10. ☐ Build the release (EAS signs it and keeps the key):
    ```bash
    cd C:\git\drivebuddy-mobile\apps\customer
    npm run build:play
    ```
    About 15 minutes. Download the `.aab` from the link it prints.
11. ☐ _App content_: answer everything from [app-content.md](app-content.md).
12. ☐ _Main store listing_: [listing-en-IN.md](listing-en-IN.md) + images,
    then the Hindi translation from [listing-hi-IN.md](listing-hi-IN.md).
13. ☐ _Closed testing_: create the track, add testers, upload the `.aab`
    (the first upload must be by hand), paste
    [release-notes.md](release-notes.md), roll out. Details in
    [testers.md](testers.md).
14. ☐ Google login on the Play build: Play Console → _Test and release_ →
    _App integrity_ → **App signing key certificate** → copy the **SHA-1** →
    Firebase → Project settings → Android app → _Add fingerprint_. (Play
    re-signs the app with its own key, so without this "Continue with Google"
    fails in the Play version.)

**Days 2–16 — the closed test:** 12+ testers opted in for 14 days in a row
([testers.md](testers.md)). Upload one improved build in between.

**Day 16+ — production:** _Apply for production_ (questions and answers in
[testers.md](testers.md)) → about 7 days → promote the release to Production.

## Later updates

- Screens, text, prices logic (no new native library): `eas update --channel
production --message "…"` — reaches phones in minutes, no Play review.
- Anything native: raise `version` in `app.config.ts`, `npm run build:play`,
  then `npm run submit:android` (needs `play-service-account.json` in
  `apps\customer\` — `eas submit` explains how to create it; it is git-ignored).
  Uploads go to closed testing as a draft; promote them in Play Console.

## Costs

- Google Play: **$25 once** for the developer account. The driver app goes
  under the same account at no extra cost (it needs its own 14-day test).
- Expo (EAS): the free plan is enough to start (a limited number of builds a
  month, in a slower queue).
- Firebase, Sentry, PostHog: free plans cover this size.
