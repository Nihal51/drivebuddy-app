# DriveBuddy Driver app (`apps/driver`)

A separate app for the team's drivers: `in.thedrivebuddy.driver`, "DriveBuddy Driver", amber icon.

- **Login:** mobile number + a 6-digit SMS code. The code is sent and checked by the
  alerts robot (website repo, `apps-script/Code.js`, "driver login") through Message
  Central VerifyNow, about ₹0.20 a code. Only numbers on a driver record that is
  **Verified** or **Active** in `/admin` get a code; at most 3 codes per number in
  24 hours and 40 a day in all. A driver stays logged in; he needs a new code only on
  a new phone or after logging out.
- **My jobs:** every booking assigned to his number in `/admin` while it is
  "assigned", live. Customer name and Call, pickup and **Navigate** (Google Maps, to
  the pinned spot when the customer pinned one), time, trip, notes.
- **Live tracking:** **Start** shares his location every ~15 seconds (a foreground
  service with a notification, no background-location permission) until **Arrived**.
  The customer sees him on a map in their booking in the DriveBuddy app. Once the job
  is completed, cancelled or given to another driver, the rules refuse the next point
  and sharing stops by itself.

Firestore: `firestore.rules` (website repo) — `isDriver()`, `isMyJob()` and
`match /tracking/{bookingId}`; tests in `tests/rules/rules.test.mjs`.

## One-time setup

### 1. Message Central (the SMS codes)

1. console.messagecentral.com → note your **Customer ID** and your login **password**.
2. Apps Script (the "DriveBuddy Bookings" Sheet → Extensions → Apps Script) →
   Project Settings → Script properties → add:
   - `MC_CUSTOMER_ID` = your Customer ID
   - `MC_PASSWORD` = your Message Central password
     Never in the app, GitHub or a chat.

### 2. The Firebase service account (signs the driver's login)

1. Firebase console → Project settings → **Service accounts** → **Generate new
   private key** → a `.json` file downloads.
2. Open it in Notepad. In Script properties add:
   - `FIREBASE_SA_EMAIL` = the `client_email` value
   - `FIREBASE_SA_KEY` = the whole `private_key` value, from `-----BEGIN PRIVATE KEY-----`
     to `-----END PRIVATE KEY-----\n` (the `\n`s may stay as they are).
3. Delete the `.json` file afterwards. Nobody else needs it.

### 3. Robot code and rules

1. Paste the new `apps-script/Code.js` into the Apps Script editor → Save →
   **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**
   (the URL stays the same).
2. Publish `firestore.rules`: `npm run deploy:backend` in the website folder, or
   Firebase console → Firestore → Rules → paste → Publish.

### 4. A test number for the Play reviewer (optional, recommended)

Script properties: `REVIEW_PHONE` = a 10-digit number you control, `REVIEW_CODE` =
6 digits. That number logs in with that code and no SMS. Put both in Play Console →
App content → **App access**. To show the reviewer a job, add a driver record with that
number in `/admin` and assign it a test booking.

### 5. Build

```
cd C:\git\drivebuddy-app-new\apps\driver
npx eas-cli init            (once: creates the "drivebuddy-driver" project on expo.dev)
```

`eas init` prints a project ID: paste it into `EAS_PROJECT_ID` in `apps/driver/app.config.ts`
(or send it to Claude). Then:

```
npx eas-cli build --platform android --profile preview      (APK for your phone)
npx eas-cli build --platform android --profile production   (AAB for Google Play)
```

## Google Play

A new app in Play Console ("DriveBuddy Driver", free, app), with its own closed test
(12 testers for 14 days — the drivers). Declarations that differ from the customer app:

- **Foreground service:** type **Location**, "user-initiated location sharing during
  a job, started by the driver's tap on Start and stopped by Arrived". Google asks for a
  short video: log in → open a job → Start (notification shows) → Arrived.
- **Location permission:** foreground only (no background location).
- **Data safety:** collected — Phone number (account), Precise location (app
  functionality, shared with the customer of that job only while sharing), User IDs.
- **App access:** the review number and code from step 4.
- **Target audience:** 18 and over.
