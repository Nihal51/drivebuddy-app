# Putting DriveBuddy on Google Play and the App Store

Do [SETUP.md](SETUP.md) first and test the app on your phone. Builds and
uploads run on EAS (Expo's cloud), so **no Mac is needed, even for iPhone**.

## Before the first store release

- [ ] Website pushed, rules published, robot updated ([SETUP.md](SETUP.md) step 0)
- [ ] Google login works on the test app (SETUP steps 3–4)
- [ ] Notifications arrive (SETUP step 5)
- [ ] Privacy policy is live and has the account-deletion section:
      https://thedrivebuddy.in/privacy/#delete-account
- [ ] `version` in `apps/customer/app.config.ts` is what you want shown (`1.0.0`)
- [ ] **iPhone only:** add _Sign in with Apple_ next to Google (App Store rule
      4.8 for apps with a third-party login). Ask Claude to add it before the
      iOS submission; it is a small change.

## Google Play

Everything is in **[apps/customer/store/google-play/](../apps/customer/store/google-play/README.md)**:
the step-by-step order, the store listing in English and Hindi, the icon,
feature graphic and screenshots, every _App content_ answer (Data safety,
content rating…), the tester message and the release notes.

The short version:

- **Costs:** $25 once (about ₹2,100). One account covers every app,
  including the driver app later.
- **Personal account:** a **closed test with 12+ testers for 14 days** is
  required before the app can go public (organisation accounts skip it).
- **Build:** `npm run build:play` in `apps\customer` → an `.aab` signed by EAS.
  The **first** upload goes in by hand (Play Console → Closed testing);
  later ones with `npm run submit:android`, which uploads to closed testing
  as a draft.
- **After the first upload:** copy Play's _App signing key_ SHA-1 into
  Firebase, or Google login fails in the Play version.

## App Store (iPhone)

**Costs:** $99 a year for the Apple Developer Program.

1. Enrol at https://developer.apple.com/programs/ (individual, or organisation
   with a D-U-N-S number). Approval takes 1–2 days.
2. Add _Sign in with Apple_ (see the checklist above) and register the iOS
   app in Firebase (SETUP step 3).
3. Build and upload:
   ```bash
   cd apps\customer
   eas build --profile production --platform ios
   npm run submit:ios
   ```
   EAS creates the certificates, the push key and the App Store Connect
   record for you (log in with your Apple ID when asked).
4. App Store Connect → your app: description, keywords, support URL
   (https://thedrivebuddy.in/contact/), privacy policy URL, screenshots (6.9"
   and 6.5" iPhone), **App Privacy** answers (the same data as the Play Data safety answers in `apps/customer/store/google-play/app-content.md`),
   age rating 4+.
5. _Review notes:_ "Booking works without login. Log in with Google to see
   bookings. Driver bookings are confirmed by phone." Submit for review
   (usually 1–3 days).

## Every later release

- **Text, screens, bug fixes** (no new native module): publish over the air,
  no store review:
  ```bash
  cd apps\customer
  eas update --channel production --message "What changed"
  ```
  Installed apps pick it up the next time they open.
- **Anything native** (a new permission, a new native library, a new Expo SDK):
  raise `version` in `app.config.ts` (e.g. 1.1.0), then build and submit again
  as above. EAS raises the store build numbers by itself.

## Upgrading Expo

Expo releases a new SDK about three times a year, and Google Play raises the
required Android version every August, so plan one upgrade a year at least.
Dependabot deliberately leaves Expo, React Native and their libraries alone
(`.github/dependabot.yml`): they must move together.

1. Read the SDK's release notes on https://expo.dev/changelog (breaking changes).
2. On a new git branch:
   ```bash
   cd apps\customer
   npx expo install expo@^<new SDK>.0.0
   npx expo install --fix
   npx expo-doctor
   cd ..\..
   npm run check
   ```
3. Fix what the checks report, build a development app
   (`eas build --profile development --platform android`) and run
   [PHONE-TEST.md](PHONE-TEST.md) on a real phone.
4. Raise `version` in `app.config.ts` (a new SDK is a new native runtime, so
   old installs keep receiving updates for their own version only), then build
   and submit as a normal release.
