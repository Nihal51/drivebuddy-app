# DriveBuddy mobile

The DriveBuddy apps for Android and iPhone. They share one backend with
[thedrivebuddy.in](https://thedrivebuddy.in) (repo `Nihal51/very_new`): the
same Firebase project, the same `bookings` collection, the same admin panel,
Telegram alerts and Google Sheet. A booking made in the app is handled exactly
like a website booking.

| App                        | Folder          | Status                                         |
| -------------------------- | --------------- | ---------------------------------------------- |
| **DriveBuddy** (customers) | `apps/customer` | Ready to build and test                        |
| DriveBuddy Driver          | `apps/driver`   | Next: live location for tracking, today's jobs |

## What the customer app does

- **Book a driver** in a minute: service list with **live prices** (downloaded
  from the website, so a price changed in `site-settings.ts` reaches the app
  without an app update), city, pickup, "as soon as possible" or a time slot.
  Works without logging in, like the website.
- **If saving fails** (no internet, an outage), the customer is offered
  WhatsApp with everything they typed — a booking is never lost.
- **Log in with Google** (optional) → **My bookings** with live status
  (Received → Confirmed → Driver assigned → Completed), the driver's name and a
  Call button, and details filled in next time.
- **Notifications** when a booking is confirmed, a driver is assigned,
  completed or cancelled — in English or Hindi. Tapping one opens the booking.
- **English and हिंदी** everywhere, switchable on Home and in Account.
- Call / WhatsApp DriveBuddy from every screen; privacy policy, terms, and
  **Delete my account** (required by both stores).

## Run it

You need [Node.js 22 LTS](https://nodejs.org) and Git.

```bash
npm install            # once, from this folder
npm run customer:web   # quick look in your browser (no phone needed)
```

On a phone, Google login and notifications need a **development build** — a
test version of the app made by EAS (Expo's build service). One-time steps are
in **[docs/SETUP.md](docs/SETUP.md)**. After that:

```bash
npm run customer       # start; open the DriveBuddy (Dev) app on your phone
```

## Repository layout

```
apps/customer/          the customer app (Expo + React Native + TypeScript)
  app.config.ts         name, ids, icons, permissions, plugins — the only native config
  eas.json              build profiles: development, preview (APK), production (stores)
  .env                  Firebase project + website address (public identifiers only)
  src/app/              screens; the file path is the route (expo-router)
  src/i18n/             every word, in en.ts and hi.ts (type-checked to match)
  src/data/             Firestore reads and writes
  src/firebase/         Firebase app, login (*.native.ts = phones, *.ts = web preview)
  src/notifications/    push registration
  src/components/       buttons, fields, cards… one look everywhere (src/theme.ts)
packages/shared/        rules both apps share: packages, cities, prices,
                        validation, the exact booking shape firestore.rules accepts
docs/                   SETUP.md (first build), RELEASING.md (Play Store, App Store),
                        ARCHITECTURE.md (how it fits together)
```

## Good practices in this repo

- **TypeScript strict** everywhere; Hindi text is type-checked against English, so no screen can show an empty label.
- **One source of truth:** prices come from the website; package ids, cities and the booking shape live in `packages/shared` and are tested against `firestore.rules`.
- **Never lose a booking:** every failure path ends in a WhatsApp fallback with the details pre-typed.
- **Tests** for the shared rules, the screens (booking, errors, Hindi, account deletion) and the data layer: `npm test`.
- **Checks on every push** (GitHub Actions): formatting, lint, type-check, tests, and an Android bundle — `npm run check` runs the same locally.
- **No secrets in git.** `.env` holds only public Firebase identifiers (like the website's `.env.production`); signing keys stay with EAS.
- **Minimal permissions:** internet and notifications only — no location, contacts or storage.
- **Accessible:** 48 dp touch targets, screen-reader labels and roles, text that grows with the phone's font size (capped so layouts hold).
- **Over-the-air updates** (EAS Update): text and screen fixes reach installed apps without a store review.

## Scripts

| From the repo root     |                                                     |
| ---------------------- | --------------------------------------------------- |
| `npm run customer`     | start the customer app for a development build      |
| `npm run customer:web` | the app in a browser                                |
| `npm run check`        | everything CI runs: format, lint, type-check, tests |
| `npm run format`       | fix formatting                                      |

In `apps/customer`: `npm run build:preview` (installable APK for testing),
`npm run build:production`, `npm run submit:android`, `npm run submit:ios`.
