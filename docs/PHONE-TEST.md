# First test on a real phone

The checks that a browser preview and automated tests cannot cover. Do them on
your Android phone with a test build (`npm run build:preview` in
`apps/customer`, or GitHub → Actions → **Build app** → `preview`), after
[SETUP.md](SETUP.md). About 30 minutes. Tick each line; anything that fails,
send a screenshot to Claude with the line number.

Use "TEST" in the name of every test booking so the team knows to ignore it,
then cancel them in `/admin`.

## Without logging in

1. [ ] The app opens on Home within 3 seconds, prices match the website.
2. [ ] Switch to हिंदी: every screen is in Hindi, nothing cut off. Back to English.
3. [ ] Call and WhatsApp buttons open the dialler and WhatsApp with 91114 73929.
4. [ ] Book → "Pick a time": today's slots start at least 45 minutes from now.
5. [ ] Book as a guest (ASAP). The success screen shows your number. Telegram
       gets the alert marked "📱 Booked in the DriveBuddy app" within a minute,
       and it appears in `/admin` and the Sheet with a DB-number.
6. [ ] Book → **One-way car drop** → Raipur → Nagpur: the estimate shows
       ₹1,450–1,650 (the driver is home within the day). Tap **+** once:
       ₹2,900–3,300. Delhi: ₹5,550–6,150 (3 days + 11 h on the train home,
       charged at the ₹1,200 daily maximum).
       Choose a nearby place (Bhilai): the app suggests the full day instead.
       Book it: the Telegram alert shows the trip (under Notes until the
       website update is published).
7. [ ] Turn on airplane mode, book again: after up to 20 seconds the app offers
       **Send on WhatsApp** with everything typed. Turn airplane mode off.
8. [ ] Phone settings → Display → largest font size: screens still readable,
       buttons not cut off. Set it back.
9. [ ] Phone dark mode on: the app turns dark and everything is readable.

## Logged in

10. [ ] Account → Continue with Google → pick your account. The app asks to
        allow notifications → Allow. Account shows "Booking updates: On".
11. [ ] Book again: your name and number are filled in. The booking shows in
        **My bookings** at once ("Numbering…", then DB-number within a minute).
12. [ ] In `/admin`: **Confirm** → within a minute the phone shows _Booking
        confirmed_. Tap it: the booking opens.
13. [ ] **Assign driver** → _Driver assigned_ with the driver's name. The booking
        shows the driver with a Call button.
14. [ ] In `/admin`, the booking's **Tell the customer → English / हिंदी**
        opens WhatsApp with the driver details.
15. [ ] **Complete** → _Trip completed_; the booking shows "Write a review".
16. [ ] Close the app fully and open it again: still logged in.
17. [ ] Switch to हिंदी, ask a friend to confirm another booking: the
        notification arrives in Hindi.
18. [ ] Account → Log out → My bookings asks you to log in. Log in again.
19. [ ] Account → Delete my account → confirm: you are logged out, and logging
        in again starts with empty details (old bookings no longer listed).

## When the website changes

20. [ ] Change a price in `site-settings.ts` on GitHub. 5 minutes after the
        website deploy, close and reopen the app: the new price shows.
21. [ ] (Optional) Set `app.minVersion` in `site-settings.ts` above the app's
        version: the app asks to update. Set it back.
