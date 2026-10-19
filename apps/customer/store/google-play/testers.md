# The closed test: 12+ testers for 14 days

A **personal** Play developer account must run a closed test with **at least
12 testers who stay opted in for 14 days in a row** before the app can go to
everyone. Organisation accounts skip this. You have 15 people — good: invite
all 15, so that one or two dropping out does not reset the clock.

The same 15 can later test the DriveBuddy Driver app too (each app needs its
own 14-day test on a personal account; the $25 account fee is paid once).

## Set it up (Play Console)

1. _Test and release_ → _Testing_ → **Closed testing** → _Create track_ (or
   use the default "Closed testing - Alpha") → name it **Friends and drivers**.
2. _Testers_ → **Email lists** → _Create email list_ → paste the 15 Gmail
   addresses (the ones they use for Play Store on their phone; collect them in
   `testers.csv`).
3. _Countries_: **India**.
4. Upload the first `.aab` (see [README.md](README.md) step 6) → _Review
   release_ → **Start rollout to Closed testing**. Google reviews it (a few
   hours to 2 days).
5. Once it is live, copy the **"Join on Android" link** from the _Testers_
   tab and send the message below.

## Message to testers (WhatsApp)

English:

```
Hi! 🙏 I'm launching the DriveBuddy app on Google Play and Google needs 12 people to test it for 14 days before it can go public. Could you help?

1. Open this link on your Android phone (use the same Gmail as your Play Store): <JOIN LINK>
2. Tap "Become a tester", then "Download it on Google Play" and install DriveBuddy.
3. Please keep it installed for 14 days and open it every 2–3 days (look at prices, try the Hindi switch, log in with Google if you like).
4. If you try a booking, write TEST in the name so my team doesn't send a driver 😊

Anything confusing or broken? Tell me here, or use "Send feedback" on the Play Store page. Thank you!
– Nihal
```

हिंदी:

```
नमस्ते! 🙏 मैं DriveBuddy ऐप Google Play पर ला रहा हूँ। पब्लिक होने से पहले Google चाहता है कि 12 लोग इसे 14 दिन टेस्ट करें। क्या आप मदद करेंगे?

1. यह लिंक अपने Android फ़ोन पर खोलें (वही Gmail जो Play Store में है): <JOIN LINK>
2. "Become a tester" दबाएँ, फिर "Download it on Google Play" से DriveBuddy इंस्टॉल करें।
3. 14 दिन तक ऐप फ़ोन में रखें और हर 2–3 दिन में एक बार खोलें (कीमतें देखें, हिंदी बटन आज़माएँ, चाहें तो Google से लॉग इन करें)।
4. बुकिंग आज़माएँ तो नाम में TEST लिखें, ताकि हम ड्राइवर न भेजें 😊

कुछ समझ न आए या काम न करे तो मुझे यहीं बताएँ, या Play Store पेज पर "Send feedback" से लिखें। धन्यवाद!
– निहाल
```

## During the 14 days

- Day 1: check in Play Console → _Closed testing_ → _Testers_ that people
  have joined (it shows a count).
- Every few days: remind anyone who has not opened the app. Google looks at
  real use, not just installs.
- Collect what testers say; fix the small things and upload one update during
  the test (`npm run build:play`, then upload to the same track). Google likes
  to see that testing led to changes.
- Do **not** let testers leave the test before day 14 — leaving and rejoining
  restarts their count.

## After 14 days: apply for production

Play Console → _Dashboard_ → **Apply for production**. Google asks a few
questions; honest short answers work:

- _How did you recruit testers?_ Friends, family, our drivers and customers
  in Raipur.
- _How easy was it to get testers?_ Easy — they are people we know.
- _How did testers use the app?_ Browsed prices, switched to Hindi, logged in
  with Google, made test bookings that our team cancelled.
- _Feedback and changes:_ list what testers reported and what you changed
  (e.g. "clearer booking confirmation text", "fixed a Hindi label").
- _Who is the app for?_ Car owners in Chhattisgarh who need a driver for
  their own car: senior citizens, families, people returning late from events.
- _What makes it valuable?_ Verified drivers in about 30 minutes, clear prices,
  booking updates on the phone, English and Hindi.
- _Is it ready for production?_ Yes — it is tested and connected to our live
  booking system and team.

Google answers in about 7 days. Then: _Production_ → _Create new release_ →
**Promote release** from closed testing → roll out to 100%.
