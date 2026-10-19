# App content answers (Play Console → _Policy and programmes_ → App content)

Every answer below matches what the app really does (checked against the code
on 19 Oct 2026). If the app changes — a new permission, a new data type, ads —
these answers must change too, or Play can remove the app.

## Privacy policy

`https://thedrivebuddy.in/privacy/`

## App access

Choose **"All or some functionality is restricted"** and add one instruction:

> Name: _Booking and login_
> Booking works without an account. Login is optional: "Continue with Google"
> works with any Google account, no credentials needed from us. A booking sent
> from the app is a real request that our team calls back about — please put
> TEST in the name field, and we will cancel it.

(Restricted only so you can leave that note: reviewers sometimes book, and
the note stops a 2 AM call to a Google reviewer.)

## Ads

**No, my app does not contain ads.**

## Advertising ID

**No.** The app does not use the advertising ID (the permission is blocked in
`app.config.ts`).

## Content rating

Start the questionnaire with your email, category **"Utility, Productivity,
Communication, or Other"**:

- Violence, fear, sexuality, crude humour, bad language, gambling: **No**
- Controlled substances: the app does not show or promote alcohol or drugs. It
  does _mention_ that drivers are sober ("no alcohol"). If a question asks
  about any **reference** to alcohol, answer **Yes** honestly; the rating may
  become 12+ / Teen, which is fine for an 18+ app.
- Users can interact or exchange content with each other: **No**
- Shares the user's location with other users: **No**
- Purchases of digital goods: **No**
- Unrestricted web access (a browser): **No**

Expected result: rated for everyone (3+), or 12+ if you answered Yes above.

## Target audience and content

- Age groups: **18 and over** only
- Could the app appeal to children: **No**

## News app / Government app / Financial features / Health

- News app: **No**
- Government app: **No**
- Financial features: **My app doesn't provide any financial features** (no
  payments in the app)
- Health: **My app does not have any health features** (hospital-visit
  drivers are a transport service, not a health app)

## Data safety

**Does your app collect or share any of the required user data types?** Yes
**Is all of the user data collected by your app encrypted in transit?** Yes
**Which methods of account creation does your app support?** "OAuth" /
_Sign in with Google_ (no username or password of our own)
**Do you provide a way for users to request that their data is deleted?** Yes
**Delete account URL:** `https://thedrivebuddy.in/privacy/#delete-account`

Data types — **Collected: Yes, Shared: No** for every row. ("Shared" means
given to another company for its own use; Firebase, Expo, Sentry and PostHog
only process data for DriveBuddy, and the assigned driver works for
DriveBuddy, so none of that counts as sharing.)

| Section → data type                           | Required or optional | Purposes                     | Why                                                                                                      |
| --------------------------------------------- | -------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Personal info → **Name**                      | Required             | App functionality            | Who the driver asks for                                                                                  |
| Personal info → **Phone number**              | Required             | App functionality            | We call to confirm the booking                                                                           |
| Personal info → **Address**                   | Required             | App functionality            | Pickup address                                                                                           |
| Personal info → **Email address**             | Optional             | Account management           | Only if the customer logs in with Google                                                                 |
| Personal info → **User IDs**                  | Optional             | Account management           | The Firebase login ID, only when logged in                                                               |
| Device or other IDs → **Device or other IDs** | Optional             | App functionality, Analytics | The notification token (only if notifications are on); the random ID of the anonymous stats              |
| App activity → **App interactions**           | Optional             | Analytics                    | Anonymous usage stats — **only if `EXPO_PUBLIC_POSTHOG_KEY` is set**; users can switch it off in Account |
| App info and performance → **Crash logs**     | Required             | App functionality, Analytics | **Only if `EXPO_PUBLIC_SENTRY_DSN` is set**                                                              |
| App info and performance → **Diagnostics**    | Required             | App functionality, Analytics | Phone model and OS version in a crash report — **only with Sentry**                                      |

Not collected (leave unticked): location, financial info, health, messages,
photos and videos, audio, files, calendar, contacts, web browsing, installed
apps, other personal info (race, religion…).

**Important:** if you build the release **without** the Sentry DSN, untick
Crash logs and Diagnostics; **without** the PostHog key, untick App
interactions. Answer for the build you actually upload.

## Other declarations Play may ask for

- **Foreground service, exact alarms, full-screen notifications, photo and
  video permissions, accessibility services:** the app uses none — answer No
  / not applicable.
- **Account deletion** (inside the Data safety form, above): in the app,
  Account → _Delete my account_; on the web, the URL above.
