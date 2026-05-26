# KTIDEBT — Debt Tracking App

A local-first mobile debt tracker built with Expo (React Native). Track who owes you, organise debts by category, set installment plans, write off bad debt, and send professional WhatsApp payment reminders — all offline.

---

## Features

### Core
- **Add Debt Entries** – debtor name, phone, email, category, summary, line items, recorded/due dates
- **Line Items** – multiple items per debt with individual costs, auto-calculated total (Maloti M)
- **Categories** – user-created categories with emoji icons, used for filtering on the dashboard
- **Installment Plans** – when debt is M500+, optionally split into 2, 3, 4, or 6 installments (weekly/biweekly/monthly). Each installment can be paid individually.
- **Bad Debt / Write-Off** – mark debts as unrecoverable with a reason; status changes to "Bad Debt"
- **Archive** – move old debts out of the main view; toggle archive view from the dashboard
- **Dashboard**
  - Total pending / archived balance with overdue/grace/paid/bad counts
  - **Search** – filter debts by debtor name or phone number (real-time, case-insensitive)
  - **Category filter chips**
  - **Sort** by newest, oldest, due soon, due later
  - **Top-3 display** with "Load More" button
  - **Alert banner** – shows count of debts due within 2 days
  - **Alert badge** – urgent count in the header
  - Empty-state welcome card for first-time users
- **Debt Detail Screen** – full summary, payment history, line items, status banner, write-off & archive actions
- **Partial Payments** – log payments against a debt; balance auto-updates; status changes to PAID when settled
- **Searchable Contact Picker** – full-screen modal with live search; pulls contacts from device (phone, SIM, email) and saved debtors

### Reminders & WhatsApp
- **Professional Messages** – 3 randomised variations for each reminder type (before due, overdue, payment request, installment reminder) with natural conversational tone
- **Local Notifications** – scheduled 1 day before and 1 day after the due date (via `expo-notifications`, lazy-loaded + try-catch wrapped for Expo Go safety)
- **WhatsApp Sharing** – share a formatted debt summary directly to the debtor's number via WhatsApp (tries native `whatsapp://send` scheme, falls back to `https://wa.me/`)

### Swipe Actions (Dashboard)
- **Swipe left** → Mark as paid
- **Swipe right** → Send WhatsApp reminder
- **Long press** → Action sheet (Archive / Write Off / Delete)

### Security
- **Session-level Auth** – biometric fingerprint (Face ID / fingerprint) or 4-digit PIN
- **Works like a bank app** – prompts on every cold launch; stays authenticated for the session
- **First-time PIN setup** – user creates a 4-digit PIN on first lock screen visit

### Onboarding
- **3 swipeable slides** – Track, Categorise, Reminders
- **Skip / Next / Get Started** – sets `onboardingComplete` flag in AsyncStorage, persists across app restarts

### Offline Persistence
- All data persists to device via `@react-native-async-storage/async-storage`
- State auto-saves on every change (debounced 500ms)
- `restored` flag ensures routing decisions (onboarding/lock/dashboard) wait for saved state to load — no flash of wrong screen

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React Native 0.85 + Expo 56 |
| Language | TypeScript 6 |
| Routing | Expo Router (file-based) |
| UI Icons | Lucide React Native |
| State | React Context + useReducer |
| Persistence | `@react-native-async-storage/async-storage` |
| Gestures | `react-native-gesture-handler` (Swipeable) |
| Date Picker | `@react-native-community/datetimepicker` |
| Contacts | `expo-contacts` (class-based API) |
| Notifications | `expo-notifications` (lazy-loaded, all calls try-catch wrapped) |
| Biometrics | `expo-local-authentication` |
| Reanimated | `react-native-reanimated` + `react-native-worklets` |

---

## Project Structure

```
ktidebt/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout — Stack navigator + AppProvider
│   ├── index.tsx           # Dashboard — FlatList, Swipeable, search, sort, alerts
│   ├── add-debt.tsx        # Add/edit debt form + installment plan + contact picker
│   ├── categories.tsx      # Category CRUD with emoji icon picker
│   ├── lock.tsx            # Biometric / PIN lock screen
│   ├── onboarding.tsx      # 3-slide onboarding
│   └── debt/
│       └── [id].tsx        # Debt detail — reminders, payments, write-off, archive
├── src/
│   ├── types.ts            # All TypeScript interfaces (Contact includes email)
│   ├── store.tsx           # Context + useReducer — global state, persistence, all actions
│   ├── theme.ts            # Design tokens — Colors, Spacing, BorderRadius, Typography, Shadows
│   ├── data.ts             # Constants (CATEGORY_ICONS, generateId)
│   ├── session.ts          # Module-level session auth flag
│   ├── persistence.ts      # AsyncStorage save/load helpers
│   ├── reminders.ts        # Professional reminder message templates (3 variations each)
│   └── whatsapp.ts         # WhatsApp URL opener — native scheme + wa.me fallback
├── assets/
│   └── image_29e2d51-removebg-preview.png   # App icon
├── app.json
├── package.json
└── tsconfig.json
```

---

## Setup & Running

```bash
npm install
npx expo start
# or: npx expo start --android / --ios
```

Runs in **Expo Go** on both platforms. Clear Metro cache if you see stale code:

```bash
npx expo start -c
```

---

## Architecture

### State Management
`src/store.tsx` — React Context + `useReducer`. State includes transactions, line items, contacts (with phone + email), activities, user WhatsApp number, onboarding flag, auth flags, and stored PIN.

**Persistence flow:**
1. App mounts → `loadState()` fetches saved JSON from AsyncStorage
2. If saved state exists → `LOAD_STATE` dispatched, `restored` set to `true`
3. If no saved state (first launch) → `restored` set to `true` with initial state
4. `useEffect` watches `restored` — only then does the routing guard fire
5. Every state change → debounced (500ms) `saveState()` to AsyncStorage

### Session Auth (`src/session.ts`)
Module-level boolean that resets when the JS bundle reloads (cold start). After successful biometric/PIN, `setSessionAuthenticated()` is called. The dashboard checks this on mount and redirects to `/lock` if not authenticated.

### Persistence (`src/persistence.ts`)
Two functions: `loadState()` (called once on provider mount) and `saveState()` (called on every state change via debounced effect). All state is serialised as JSON.

### Routing Flow
```
App Launch → index.tsx
  ├─ (waits for restored=true — state loaded from AsyncStorage)
  ├─ onboardingComplete=false → /onboarding → (Get Started) → /
  ├─ authEnabled & !authed    → /lock        → (auth) → /
  └─ all clear                → Dashboard
```

The `restored` flag in `AppContext` prevents routing decisions until persisted state has been loaded, eliminating the flash-of-wrong-screen on relaunch.

### WhatsApp Sending (`src/whatsapp.ts`)
The `openWhatsApp(phone, message)` helper:
1. Strips all non-digit characters from the phone number
2. Encodes the message (spaces → `+`)
3. Tries the native `whatsapp://send` scheme first
4. Falls back to `https://wa.me/` if the native scheme is unavailable

### Contact Picker (`app/add-debt.tsx`)
- Opens a full-screen `Modal` on tapping the contact icon
- Live search bar filters both **device contacts** and **saved debtors** by name
- Device contacts include phone numbers AND emails (fetched via `ContactField.PHONES | ContactField.EMAILS`)
- Contacts with only an email address (no phone) are shown
- Phone numbers are stored **exactly as they come from the device** (no format stripping)

### Notifications Safety
`expo-notifications` is **never imported at top level**. The `getNotifications()` helper uses a lazy `require()` wrapped in try-catch. **Every notification call site** is also wrapped in its own try-catch to handle `UnavailabilityError` in Expo Go. The `SchedulableTriggerInputTypes` reference was removed — notifications use a plain `{ date: ... }` trigger to avoid partial-module crashes.

### Dashboard Performance
- **FlatList** with `removeClippedSubviews`, `initialNumToRender=8`, `maxToRenderPerBatch=10`, `windowSize=7`
- **React.memo** on `DebtCard` component
- **useMemo** for all filtered/sorted/displayed lists
- **useCallback** for renderItem and event handlers

---

## Key Workflows

### Adding a Debt with Installments
1. Tap **+** FAB → fill debtor (searchable contact picker), category, summary, dates
2. Add line items → total auto-calculates
3. If total ≥ M500, an **Installment Plan** toggle appears
4. Enable it → choose number of installments (2/3/4/6) and frequency (weekly/biweekly/monthly)
5. Save → the debt shows installment badge and plan on detail screen

### Swipe Actions (Dashboard)
- **Left swipe** on a debt card → "Paid" button → marks as fully paid
- **Right swipe** → "Remind" button → opens WhatsApp with professional reminder
- **Long press** → action sheet with Archive, Write Off, Delete options

### Writing Off Bad Debt
1. Open debt detail → scroll to bottom
2. Tap **"Mark as Bad Debt"** → enter reason (iOS) or use default (Android)
3. Debt status changes to "Bad Debt", balance is preserved but flagged
4. Bad debts are counted in the dashboard stats (bad count)

### Archiving Old Debts
- From detail screen: tap **"Archive Debt"**
- From dashboard long press: choose **Archive**
- Use the **Archived/Active toggle** on the balance card to switch views

### Professional Reminder Messages
3 randomised variations are available for each scenario, written in a natural conversational tone:
- **Before due** — polite heads-up with due date
- **Overdue** — firm but courteous follow-up
- **Payment request** — direct request with summary
- **Installment** — tracks installment progress

### Auto-Reminders
Same professional messages used in local notifications. Enable from debt detail → scheduled 1 day before and 1 day after due date. All notification calls are try-catch wrapped — they degrade gracefully in Expo Go without crashing.

---

## Configuration

### App Icon
Replace `assets/image_29e2d51-removebg-preview.png` with your own. Update `app.json`:

```json
"icon": "./assets/your-icon.png",
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/your-foreground.png",
    "backgroundImage": "./assets/your-background.png"
  }
}
```

### WhatsApp Number
Default in store (`src/store.tsx`):
```ts
userWhatsApp: '+26669256516',
```

---

## Known Limitations

- **PIN stored in plaintext** — acceptable for local-only, no network sync
- **`expo-notifications`** — unavailable in Expo Go; all calls are try-catch wrapped to prevent crashes (reminders silently degrade)
- **`expo-contacts` class-based API** — uses `Contact.getAllDetails()` (new API)
- **`DateTimePicker` uses `onValueChange`** — not deprecated `onChange`
- **Write-off prompt on Android** uses default reason text (no native `Alert.prompt`)
- **State fully resets if AsyncStorage is cleared** (e.g., app data wipe)
