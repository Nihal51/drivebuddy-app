# Putting DriveBuddy on Google Play and the App Store

Do [SETUP.md](SETUP.md) first and test the app on your phone. Builds and
uploads run on EAS (Expo's cloud), so **no Mac is needed, even for iPhone**.

## Before the first store release

- [ ] Website pushed, rules published, robot updated ([SETUP.md](SETUP.md) step 0)
- [ ] Google login works on the test app (SETUP steps 3–4)
- [ ] Notifications arrive (SETUP step 5)
- [ ] Privacy policy is live: https://thedrivebuddy.in/privacy/ (updated for the app)
- [ ] `version` in `apps/customer/app.config.ts` is what you want shown (`1.0.0`)
- [ ] **iPhone only:** add _Sign in with Apple_ next to Google (App Store rule
      4.8 for apps with a third-party login). Ask Claude to add it before the
      iOS submission; it is a small change.

## Google Play

**Costs:** $25 once (about ₹2,100) for the developer account.

1. **Developer account:** https://play.google.com/console → sign up.
   - _Personal_ account: Google requires a **closed test with at least 12
     testers, opted in for 14 days in a row**, before you can publish to
     everyone. Line up 12 friends, drivers or customers with Android phones.
   - _Organisation_ account (DriveBuddy as a registered business, with a free
     D-U-N-S number): more paperwork up front, but Google does not apply that
     12-tester rule to it.
   - Either way Google verifies your identity (ID, sometimes a video selfie).
2. **Create the app:** name _DriveBuddy_, default language English (India),
   App, Free.
3. **The production build** (an .aab file, signed by EAS):
   ```bash
   cd apps\customer
   eas build --profile production --platform android
   ```
   EAS keeps the signing key safe; never lose access to your Expo account.
4. **First upload by hand** (Google requires it once): Play Console → _Test and
   release_ → _Testing_ → **Closed testing** → create a track → upload the
   .aab from the EAS build page → add testers (an email list or Google Group)
   → roll out. Send testers the opt-in link.
5. Later releases go up with one command, after you create a Google service
   account for uploads (`eas submit` walks you through it):
   ```bash
   npm run submit:android
   ```
6. **App content** (Play Console → _Policy and programmes_ → App content):
   - Privacy policy: `https://thedrivebuddy.in/privacy/`
   - Ads: **No ads**
   - App access: login is optional — "All functionality is available without
     special access"; booking works as a guest
   - Content rating questionnaire: a utility/booking app, no objectionable
     content → rated for everyone
   - Target audience: 18+
   - **Data safety** — what the app collects (matches the privacy policy):

     | Data                             | Collected                | Why                                    | Optional |
     | -------------------------------- | ------------------------ | -------------------------------------- | -------- |
     | Name                             | Yes                      | App functionality (booking)            | No       |
     | Phone number                     | Yes                      | App functionality (we call to confirm) | No       |
     | Address (pickup)                 | Yes                      | App functionality                      | No       |
     | Email address                    | Yes, if logged in        | Account management                     | Yes      |
     | User IDs                         | Yes, if logged in        | Account management                     | Yes      |
     | Device or other IDs (push token) | Yes, if notifications on | App functionality                      | Yes      |

     Encrypted in transit: **Yes**. Data shared with third parties: **No**
     (Firebase and Expo are service providers). Users can request deletion:
     **Yes** — in the app (Account → Delete my account), and for the web form
     use `https://thedrivebuddy.in/privacy/#your-rights`.

   - Government apps, financial features, health: No.
7. **Store listing:** short description (80 characters), full description,
   app icon 512×512 (`apps/customer/assets/icon.png` scaled down), feature
   graphic 1024×500, at least 2 phone screenshots (take them from the test
   app). Category: _Maps & Navigation_ or _Auto & Vehicles_. Contact:
   drivebuddyind@gmail.com, +91 91114 73929, https://thedrivebuddy.in.
8. After 14 days of closed testing with 12+ testers: _Apply for production_,
   answer Google's short questionnaire, then promote the release to
   **Production**. Reviews usually take 1–7 days.

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
   and 6.5" iPhone), **App Privacy** answers (same data as the table above),
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
