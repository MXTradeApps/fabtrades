# App Store Review checklist

What to put in App Store Connect before every iOS review submission. The two
items that blocked review in July 2026 were a missing Terms of Use (EULA) link
and a missing demo account for the sign-in UI.

For full agent handoff context (what was fixed, local IPA path, Organizer
issues, remaining upload steps), see
[APP_STORE_RESUBMISSION_HANDOFF.md](./APP_STORE_RESUBMISSION_HANDOFF.md).

## Legal URLs

| Document | URL |
| --- | --- |
| Privacy Policy | https://fabtrades.net/privacy |
| Terms of Use (EULA) | https://fabtrades.net/terms |

### App Store Connect

1. **App Information → Privacy Policy URL** → `https://fabtrades.net/privacy`
2. **App Information → License Agreement** → either keep Apple’s standard EULA
   **or** paste the custom Terms text / URL for a custom EULA. The hosted page at
   `/terms` is the custom Terms of Use.
3. **Version → Description** — include a functional Terms link (required when
   offering auto-renewable subscriptions). Append something like:

   ```
   Terms of Use (EULA): https://fabtrades.net/terms
   Privacy Policy: https://fabtrades.net/privacy
   ```

4. **Subscriptions** — for each localization of the FABTrades Pro group /
   products, ensure Privacy Policy and Terms of Use URLs are set if App Store
   Connect shows those fields.
5. **RevenueCat Paywall** — set footer Privacy / Terms links to the same URLs so
   the native paywall also satisfies Guideline 3.1.2.

Deploy the web app so `/terms` and the updated `/privacy` are live **before**
resubmitting. Reviewers fetch those URLs.

## Demo account (required)

The app includes optional sign-in (Apple, Google, Discord, email). App Review’s
automated check requires a username/password demo account in **App Review
Information**.

### One-time setup (production Supabase)

1. Supabase → Authentication → Providers → **Email** → enable.
   - Turn **Confirm email** off for the App Review user (or confirm the address
     yourself) so the reviewer is not blocked on a confirmation mail.
2. Authentication → Users → **Add user**:
   - Email: `appreview@fabtrades.net` (or another address you control)
   - Password: generate a strong password and store it in your password manager
   - Auto Confirm User: on
3. Sign in once on a TestFlight build with **Sign in with email** to confirm the
   account works against production.

Do **not** commit the password to git. Put it only in App Store Connect.

### App Review Information fields

| Field | Value |
| --- | --- |
| Sign-in required | No (optional; unlocks cloud sync and Pro on other devices) |
| Username | `appreview@fabtrades.net` (or the email you created) |
| Password | *(the password from step 2)* |

### Notes for Review (paste into ASC)

```
FAB Trades can be reviewed without signing in. Core features (card prices,
trade balancing, binder/want list on-device, camera card scanning) work while
signed out.

Sign-in is optional. It unlocks cloud sync and lets FABTrades Pro follow the
customer to other devices. It is not required to purchase or use Pro on this
device.

To review FABTrades Pro:
1. Open My Account → See plans (no sign-in prompt)
2. Subscribe with a Sandbox Apple ID
3. After purchase, an optional “Use Pro on other devices” sheet may appear —
   dismiss it with Not now, or sign in if you want to test sync

A demo account is provided only for testing optional sign-in / sync:
- Open My Account → Sign in → “Sign in with email”
- Username and password are in the Demo Account fields above

Legal:
- Terms of Use: https://fabtrades.net/terms
- Privacy Policy: https://fabtrades.net/privacy

Camera: used only for on-device card scanning; frames are not uploaded.
```

## Resubmit

1. Confirm the Paid Apps Agreement is **Active** (Business section), with tax
   and banking filled in.
2. On this version, attach both subscriptions under **In-App Purchases and
   Subscriptions** (`com.fabtrades.app.pro.monthly`,
   `com.fabtrades.app.pro.yearly`) before submitting. They stay Ready to Submit
   until a version includes them.
3. Ship a mobile build that opens See plans without a sign-in sheet.
4. Paste the Notes for Review above. Sign-in required = **No**. Keep the demo
   account filled in so reviewers can still test optional sync.
5. Confirm App Description contains the Terms URL.
