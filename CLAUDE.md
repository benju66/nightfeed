# Nightfeed

Newborn feeding & care tracker PWA — two parents' Android phones, realtime shared data via Cloud Firestore. Built from the Claude Design handoff in `README.md` + `Baby Tracker.dc.html` (prototype reference, do not ship) + `styles.css` (design system, shipped verbatim as `src/styles.css`).

## Stack
- Vite + React 19, `vite-plugin-pwa` (autoUpdate service worker)
- Firebase JS SDK v12 — Firestore with `persistentLocalCache` (offline support)
- Firebase project: **nightfeed-al972** (console: https://console.firebase.google.com/project/nightfeed-al972)

## Commands
- `npm run dev` — dev server (also in `.claude/launch.json` as "nightfeed")
- `npm run build` — production build to `dist/`
- `npm run emulators` — Firestore emulator (needs Java on PATH; swap `projectId` in `src/firebase-config.js` to `demo-nightfeed` to use it)
- `npx firebase deploy` — deploy hosting + firestore rules (CLI logged in as benj.urness@gmail.com)

## Architecture
- No accounts: an 8-char family code is both the pairing mechanism and the secret (see `firestore.rules`). Code stored in localStorage; shown in Settings.
- `families/{code}` doc: settings (babyName, birth, units, timeFormat, bottleKind) + **active timers** (`activeFeed`, `activePump`, `sleepStart`) — timers live on the doc so both phones see them tick and either can stop them. Elapsed = stored start epoch vs. local clock, ticked every second.
- `families/{code}/entries/{id}`: immutable logged events (feed/pump/diaper/sleep/health), client-generated ids. Volumes stored with entry-time unit, converted at display time (1 oz = 29.5735 ml). Health types: vitd, weight (wunit lb/kg), height (hunit in/cm), temp (tunit °F/°C), med (free text in `med`). Breast feeds support mid-feed side switching: one entry with `leftSecs`/`rightSecs` and type left/right/both; the in-progress session lives on `activeFeed` as {type, start (segment), feedStart, leftSecs, rightSecs, paused?}. Pause (burping) folds the running segment into the side totals and freezes timers; paused time is excluded from the logged secs (entry ts→end spans the whole session, secs = actual feeding). Switching sides while paused resumes on the new side.
- Extra-dim night mode is per-device (localStorage `nightfeed-dim`), an overlay div — deliberately not synced. Deleting entries asks for confirmation via window.confirm.
- Entries can be added manually (backdated) and edited via EntryDialog; edits use setDoc full-replace (overwriteEntry) so cleared fields drop.
- Full-screen feeding mode (FeedFocus): starting/tapping a ticking breast side opens it (local state, per phone); giant finish zone logs the feed, side tiles switch, chevron minimizes. Tapping the active side on the dashboard re-enters (does NOT stop). Finish shows a 6s undo snackbar that deletes the entry and restores the exact prior activeFeed. Exit-on-remote-stop is transition-based (prevFeedRef) — do not "close when activeFeed is null" or it races the local start-write's snapshot. Android back minimizes via a pushed history state.
- Reminders: `vitdReminder {enabled, time}` (built-in, done = vitd entry today) + `reminders[]` ({id, label, who baby|mom, mode daily|interval, time/hours, enabled, lastDone}) on the family doc. Due reminders show in a Track-tab card.
- **Push notifications** (project is on Blaze): raw web-push (VAPID keys in `functions/.env`, public key duplicated in `src/lib/push.js`) — no FCM SDK. Phones that opt in (Settings toggle → Notification permission + PushManager.subscribe) store subscriptions in `families/{code}/pushSubs/{deviceId}`; subscription refreshes on every app load. `functions/index.js` `reminderPush` runs every 5 min: computes due reminders in the family's `tz` (stamped by the client on load; daily reminders are skipped without it), sends to all subs, dedupes via `notifState` map on the family doc, deletes 404/410 subs. Manual test trigger: `https://us-central1-nightfeed-al972.cloudfunctions.net/reminderPushNow?key=nf-test-8231`. Service worker is custom (`src/sw.js`, vite-plugin-pwa `injectManifest`) — precache + push + notificationclick handlers. Deploy functions with `npx firebase deploy --only functions --force`.
- All shared state renders from `onSnapshot`; local React state is only UI (tab, filters, in-progress inputs, quick note).
- Settings has a "Clear all data" button — gated by typing the family code (window.prompt). Batch-deletes all entries + resets timers.
- Entries: live onSnapshot window is LIVE_LIMIT (2000) recent docs; History shows a "Load older entries" pager past it; CSV/print always fetch the full collection (fetchAllEntries) so exports never truncate. Print offers 7/14/30-day/all ranges.
- Weekly backups: `weeklyBackup` function (Mondays 03:00 America/Chicago) dumps each family (doc + all entries) as JSON to gs://nightfeed-al972-backups/backups/{code}/{date}.json, keeping the last 8. Manual run: /backupNow?key=nf-test-8231.

- Three tabs: Track (feed/diaper/sleep/pump + reminders + quick note), Health (vitD/weight/height/temp/med logging + growth charts + health-only entry list), History (7-day trend, export, filterable full log). Vitamin D daily logging stays one-tap on Track via the reminders card.
- PWA app shortcuts (long-press icon): feed-left/feed-right/diaper-wet/sleep via `?action=` param, handled once after the family doc loads then stripped from the URL. Sleep action only starts (never toggles off) sleep.

## Companion widget (widget/)
Separate native Android app providing a 4x2 home-screen widget — deliberately NOT part of the PWA so the web app keeps instant deploys. Kotlin, RemoteViews with Chronometers (live tickers work; data refresh is WorkManager every 15 min + on action). Reads/writes Firestore via REST with the family code (entered in ConfigActivity, stored in SharedPreferences). Wet button logs a diaper directly; Feed L/R deep-link to the PWA's ?action= URLs. Built by .github/workflows/widget.yml (Gradle 8.9/AGP 8.5.2, debug APK) and published to the GitHub release tagged `widget-latest` — phones sideload from there. Widget's reminder/due logic mirrors functions/index.js — keep in sync when reminder semantics change.

## Design fidelity
`src/styles.css` is the Nocturne design system — never edit it, never hard-code values its tokens carry. App-specific classes live in `src/app.css`, mirroring the prototype's inline styles.

**Deliberate deviation (user-approved 2026-07-26):** a legibility pass in app.css overrides the prototype's density for the "low-energy parent" brief — muted text floor 65–75% opacity (was 45–55%), nothing under 11px, time-since values 16px/500, 44px tap targets (delete ×, history filter). Don't "restore fidelity" by reverting these.
