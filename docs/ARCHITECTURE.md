# How it fits together

```
 DriveBuddy app (this repo)          Firebase project drive-buddy-acc4c        Website repo (Nihal51/very_new)
 ──────────────────────────          ─────────────────────────────────        ────────────────────────────────
 Home: services + live prices  ◀──── https://thedrivebuddy.in/app-config.json ◀── site-settings.ts (on deploy)
 Book ─────── create ─────────────▶ bookings/{id}  source: 'app'        ◀── /admin: confirm, assign, complete
 My bookings ◀── onSnapshot ──────  (customerUid = the login)            ◀── alerts robot (Apps Script):
 Account: profile ◀──────────────▶  users/{uid}                              DB-number, Telegram, Sheet,
 Notifications on ── register ────▶ users/{uid}/devices/{token}  ─────▶     notifications via Expo push,
                                                                              WhatsApp when set up
 Phone notification ◀────────────── Expo push service ◀────────────────────
```

## Decisions, and why

- **The app writes the website's booking shape** (`packages/shared/src/booking.ts`,
  checked against `firestore.rules`), with `source: 'app'`. Nothing downstream
  (admin panel, Sheet, Telegram, customer records) needed a special case.
- **Prices are data, not code.** The website publishes `app-config.json` from
  `site-settings.ts`; the app validates every field, keeps the last good copy
  on the phone, and falls back to a built-in snapshot. A bad file can never
  blank the price list.
- **Guest booking stays first-class.** Login only adds tracking, notifications
  and pre-filled details — the same promise as the website.
- **No server of our own.** Firestore security rules protect the data; the
  free Apps Script robot does the server-side jobs (numbering, alerts,
  notifications). The Firebase project stays on the free Spark plan.
- **Native Google sign-in** (`@react-native-google-signin`) instead of a
  browser pop-up: one tap on Android, then the same Firebase login as the
  website, so a customer sees the same bookings in both places.
- **Notifications through Expo push**: one HTTPS call from the robot reaches
  Android (FCM) and iPhone (APNs). The phone stores its token under the
  customer's own `users/{uid}/devices`, with its language.
- **India time everywhere**, by arithmetic rather than the phone's time-zone
  data: "3:30 pm" always means 3:30 pm in Raipur.
- **Monorepo** (`apps/*`, `packages/shared`): the driver app will reuse the
  data model, prices and validation instead of copying them.

## Next: the driver app and live tracking

Planned in `apps/driver`, sharing `packages/shared`:

- Driver login, linked to their `drivers/{id}` record by the admin.
- Today's and upcoming jobs assigned to them, with customer name, number,
  pickup and a "Navigate" button.
- **Live tracking:** the driver taps _Start_ → the phone shares its location
  (also with the screen off) to a tracking record until _Arrived_. The
  customer sees the driver moving on a map in the app, and on a tracking page
  of the website linked from the "driver assigned" WhatsApp — on free
  OpenStreetMap-based maps, no Google Maps bill.
