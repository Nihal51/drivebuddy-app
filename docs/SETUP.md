# First-time setup

From nothing to the DriveBuddy app on your own Android phone. About 1–2 hours
once; most of it is clicking through Firebase and Expo. Everything here is free.

Commands run in **Command Prompt** from `C:\git\drivebuddy-mobile` unless it
says otherwise.

## 0. The website first (5 minutes)

The app needs the website update that came with it.

1. `cd C:\git\drivebuddy` → `git push`. GitHub rebuilds the site; after ~3
   minutes https://thedrivebuddy.in/app-config.json should show your prices.
2. **Publish the security rules:** Firebase console → Firestore Database →
   **Rules** → replace everything with `C:\git\drivebuddy\firestore.rules` →
   **Publish**. (Without this, app bookings are refused and the app offers
   WhatsApp instead.)
3. **Update the alerts robot:** open the _DriveBuddy Bookings_ Sheet →
   Extensions → Apps Script → `Code.js` → select all → paste
   `C:\git\drivebuddy\apps-script\Code.js` → Save. This adds app notifications.

## 1. Install and look (10 minutes)

```bash
npm install
npm run customer:web
```

A browser opens with the app. Booking from here writes a real booking (it is
the real Firebase project), so put "TEST" in the name if you try it.

## 2. Expo account and EAS (10 minutes)

EAS builds the Android/iPhone apps in the cloud. The free plan is enough.

1. Sign up at https://expo.dev (use drivebuddyind@gmail.com).
2. ```bash
   npm install -g eas-cli
   eas login
   cd apps\customer
   eas init
   ```
3. `eas init` prints a **project ID** (a long id like `1a2b3c…`). Open
   `apps\customer\app.config.ts` and paste it in the line
   `const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '';` → `|| '1a2b3c…';`.
   This switches on notifications and over-the-air updates.

## 3. Register the app in Firebase (15 minutes)

Firebase console → ⚙ Project settings → **Your apps** → **Add app**:

- **Android**: package name `in.thedrivebuddy.app`, nickname _DriveBuddy app_.
  Skip the SDK steps. Download **google-services.json** into `apps\customer\`.
- (For a test build on your phone, also add Android package
  `in.thedrivebuddy.app.dev` — same project, it goes in the same
  `google-services.json`; download it again after adding.)
- **iOS** (only when you are ready for the App Store): bundle ID
  `in.thedrivebuddy.app` → download **GoogleService-Info.plist** into
  `apps\customer\`.

These files hold public identifiers (like `.env`); commit them.

## 4. Google login (15 minutes)

1. Firebase console → Authentication → Sign-in method → **Google** → open it
   → _Web SDK configuration_ → copy the **Web client ID**
   (`…apps.googleusercontent.com`) into `apps\customer\.env`:
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…`
2. Google checks which app is asking by its signing fingerprint. After your
   first build (step 6):
   ```bash
   cd apps\customer
   eas credentials -p android
   ```
   → choose the build profile → copy the **SHA-1** → Firebase console →
   Project settings → your Android app → **Add fingerprint**. Do this for the
   development app and the store app. When the app is on Google Play, also add
   the SHA-1 from Play Console → _Test and release_ → _App integrity_ → **App
   signing key certificate**.

Without these, "Continue with Google" shows an error; booking as a guest still
works.

## 5. Notifications on Android (10 minutes)

Expo delivers notifications through Google's Firebase Cloud Messaging:

1. Firebase console → Project settings → **Service accounts** → **Generate
   new private key** → a `.json` file downloads. Keep it private (never in git).
2. ```bash
   cd apps\customer
   eas credentials -p android
   ```
   → _Google Service Account_ → _Manage your Google Service Account Key for
   Push Notifications (FCM V1)_ → upload that file.

iPhone notifications need no extra step: EAS sets them up with your Apple
account when you build for iOS.

## 6. A test app on your phone (20 minutes, mostly waiting)

```bash
cd apps\customer
eas build --profile development --platform android
```

EAS builds in the cloud (10–15 minutes) and gives a link and QR code: open it
on your phone and install **DriveBuddy (Dev)** (allow "install from this
source"). Then on your computer:

```bash
npm run customer
```

Open the DriveBuddy (Dev) app on the phone: it connects to your computer (same
Wi-Fi), and every code change shows on the phone in a second.

Want an app to hand to friends for testing, without your computer?
`npm run build:preview` makes a normal installable APK.

## 7. Try the whole loop

1. In the app: log in with Google, allow notifications, book a driver.
2. Telegram gets the alert (marked "📱 Booked in the DriveBuddy app").
3. In https://thedrivebuddy.in/admin/ → Confirm → the phone gets _Booking
   confirmed_ → Assign a driver → _Driver assigned_ with the driver's name.
4. In the booking's panel, **Tell the customer… → English / हिंदी** opens
   WhatsApp with the driver details typed.

## When something does not work

| You see                                        | Fix                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| "We could not save your request just now"      | Publish the rules (step 0.2)                                                                    |
| "Login is not switched on in this version yet" | Web client ID in `.env` (step 4.1), then rebuild or restart                                     |
| Google login error / "DEVELOPER_ERROR"         | SHA-1 fingerprint missing in Firebase (step 4.2)                                                |
| Notifications "Not available on this device"   | Project ID in `app.config.ts` (step 2.3); a real phone, not an emulator                         |
| Notifications never arrive on Android          | FCM key uploaded (step 5); robot code updated (step 0.3)                                        |
| Old prices                                     | The app refreshes prices on start and every 30 minutes; check `/app-config.json` on the website |
