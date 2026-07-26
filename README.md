# Handoff: Nightfeed — newborn feeding & care tracker (PWA + Firebase)

## Overview
Nightfeed is a mobile-first tracker for newborn care, used by two parents on Android phones with realtime shared data. It tracks breastfeeding (left/right with live timers), bottle feeds (milk/formula, timer + volume), pumping (left/right/both, timer + volume), diaper changes (wet/solid/both), sleep sessions, and health events (daily vitamin D, weight). It shows today/7-day-average/all-time metrics, "time since" counters, a 7-day trend chart, a filterable day-grouped history, CSV export, and a printable doctor-visit summary.

**Target deliverable: an installable PWA (Add to Home Screen on Android), hosted on Firebase Hosting, with realtime sync between two phones via Cloud Firestore with offline persistence enabled.**

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to ship directly. `Baby Tracker.dc.html` is the full prototype (a self-rendering design-component file: the markup template is inside `<x-dc>…</x-dc>`, the application logic is a React-style class in the `data-dc-script` script tag — all handlers, formatting, and derived-metric logic there is correct and complete and can be ported nearly 1:1). `styles.css` is the design system (tokens + component classes).

**The task is to recreate this design as a production PWA.** No existing codebase exists — recommended stack: **Vite + React (or Preact) + the bundled `styles.css` verbatim + Firebase JS SDK v10+ (Firestore + Hosting)**. Keep the app a single small SPA; no router needed (two tabs are internal state).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interaction states are final and come from `styles.css` design tokens. Recreate pixel-perfectly; never hard-code values the tokens carry.

## Architecture (the part that must be built)

### Firestore data model
```
families/{familyCode}                 // one doc per family
  babyName: string
  birth: string                       // ISO datetime-local, e.g. "2026-07-01T04:32"
  units: "oz" | "ml"
  timeFormat: "12h" | "24h"
  bottleKind: "milk" | "formula"      // default bottle contents
  activeFeed:  null | { type: "left"|"right"|"bottle", start: epochMs, bottleKind }
  activePump:  null | { side: "left"|"right"|"both", start: epochMs }
  sleepStart:  null | epochMs

families/{familyCode}/entries/{entryId}   // one doc per logged event
  kind: "feed" | "pump" | "diaper" | "sleep" | "health"
  ts: epochMs                         // start time
  end?: epochMs                       // feed / pump / sleep
  secs?: number                       // duration, feed / pump / sleep
  type?: string                       // feed: left|right|bottle; pump: left|right|both;
                                      // diaper: wet|solid|both; health: vitd|weight
  bottleKind?: "milk"|"formula"       // feed type=bottle
  amount?: number; unit?: "oz"|"ml"   // bottle feed & pump volumes (stored as entered)
  value?: number; wunit?: "lb"|"kg"   // health type=weight
  note?: string
```
Key decisions embodied in the prototype — keep them:
- **Volumes are stored with the unit they were entered in**; totals convert at display time (1 oz = 29.5735 ml). Weight unit follows volume unit (oz→lb, ml→kg).
- **Active timers live on the family doc**, not in local state — so a feed started on one phone shows ticking on the other, and either phone can stop it. Elapsed time is computed from `start` vs. local clock every second.
- Entries are immutable except delete. A sleep session is attributed to the day it **started**.

### Sync & offline
- `initializeFirestore(app, { localCache: persistentLocalCache() })` — offline persistence ON. All writes go through Firestore; drop the prototype's localStorage layer except for remembering the family code + chosen theme locally.
- Subscribe with `onSnapshot` to the family doc and the entries collection (query: `orderBy("ts","desc")`, optionally `limit(1000)`); render from the live snapshot. `includeMetadataChanges` not needed.
- Entry IDs: `doc(collection(...)).id` client-generated so offline writes work.

### Auth / pairing (keep it minimal)
- No accounts. On first launch, a phone either **creates a family** (generate an 8-char code, write the family doc) or **joins** by typing the code the other phone shows in Settings.
- Store the code in localStorage. Show it in Settings under "Share with partner".
- Firestore security rules: allow read/write on `families/{code}/**` for all (the code is the secret), or gate behind Anonymous Auth if you want rules that at least require an app instance. Document the tradeoff in code comments.

### PWA requirements
- `manifest.webmanifest`: name "Nightfeed", `display: standalone`, `background_color`/`theme_color` = `#161826` (--color-bg), 192/512 maskable icons (a simple moon/drop glyph on the bg color is fine).
- Service worker: precache the app shell (Vite PWA plugin `vite-plugin-pwa`, `registerType: "autoUpdate"`). Firestore handles data offline; the SW only needs to serve the shell.
- `<meta name="viewport" content="width=device-width, initial-scale=1">`, `color-scheme: dark`.

## Screens / Views
The app is one screen with two tabs (bottom bar: **Track** / **History**) plus a Settings dialog. Max content width 430px, centered; background `var(--color-bg)`; font `var(--font-body)` (Inter).

### Shared header (both tabs)
- Left: title = baby's name (fallback "Nightfeed"), 19px `var(--font-heading)` weight 500; beneath it an 11.5px muted line: `"{age} · {weekday, month day}"`. Age format: `"born today"`, `"5 days old"`, then `"2 weeks (16 days) old"`.
- Right: settings gear — `.btn .btn-icon .btn-secondary`, 16px stroke icon (Phosphor "gear-six" style).
- Below: **stat scope toggle** — three ghost text buttons `Today · 7-day avg · All time` (11px, active = accent text on 12% accent tint, inactive 55% text).
- Below: **stat strip** — 5-column grid, gap 6px, each tile `background: var(--color-surface)`, radius `var(--radius-md)`, padding 9px 10px: big value 16px/500 + 10px uppercase label. Tiles: **Feeds** (count), **Bottle** (volume in current unit), **Pumped** (volume), **Diapers** (count), **Sleep** (duration "2h 15m"). Em-dash when zero. 7-day average divides by days **that have entries**; a running sleep timer counts into today's Sleep.

### Track tab
1. **Time-since row** — 3 outlined tiles (1px `var(--color-divider)`, radius md): "Last fed" ("1h 20m ago", or accent "feeding now"), "Last diaper", "Awake" (since last sleep ended, or accent "sleeping now"). Updates every second.
2. **Feeding card** (`.card .elev-sm`, kicker "FEEDING"):
   - Row of two large toggle buttons **Left** / **Right** (min-height 78px, column layout: 15px name + 12px sub). Sub = "Tap to start" or live elapsed `m:ss` / `h:mm:ss`.
   - **Active state** (all timer buttons app-wide): `border-color: var(--color-accent); color: var(--color-accent-100); background: color-mix(in srgb, var(--color-accent) 16%, transparent); box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent)`.
   - Behavior: tap starts; tap again stops & logs; tapping the *other* side (or Bottle) stops+logs the current one and starts the new one in a single action.
   - Bottle row: **Bottle** toggle button (min-height 64px) beside a column with a Milk/Formula segmented control (`.seg`/`.seg-opt`) and an amount `<input type=number>` + unit label. On stop, amount (if entered) is logged with the feed and cleared.
3. **Pumping card**: three toggle buttons **Left / Right / Both** (min-height 60px, sub "Start" or elapsed), amount input "Total pumped" + unit. Same toggle/switch semantics as feeding. Pump and feed timers are independent — both can run.
4. **Diaper card**: three `.btn .btn-secondary` buttons **Wet / Solid / Wet + Solid** (min-height 48px) — instant log.
5. **Sleep card**: one full-width toggle (min-height 64px): "Start sleep / Tap when baby falls asleep" → active "Sleeping… / elapsed".
6. **Health card**: **Vitamin D** toggle-look button (min-height 64px; once given today: accent border+text, sub "Given 8:12 AM"; tapping again logs another dose) beside a weight column: number input (placeholder shows "Last 4.2 lb") + unit label + "Log weight" secondary button (32px). Invalid/empty weight = no-op.
7. **Quick note field** (`.field` + `.input`): label "Quick note — attached to the next entry you log". The note attaches to the next entry of ANY kind and clears after.

### History tab
1. **"Last 7 days" trend card**: 4 rows — Feeds, Pumped, Diapers, Sleep. Each: 52px label, 7 bars (flex, gap 5px, 36px track, bars bottom-aligned, radius 2px, min-height 2px, `var(--color-accent-700)`; today's bar `var(--color-accent)`; scaled to the row max; native `title` tooltip per bar), 48px right-aligned total ("32 total" / "12.5 oz" / "41.2h"). Beneath: narrow weekday letters row aligned under the bars.
2. **Export row**: "Export CSV" `.btn-primary` + "Print summary" `.btn-secondary`, side by side.
   - CSV columns: `Date, Time, Category, Detail, Duration (min), Amount, Unit, Note` — chronological ascending; download as `nightfeed-log.csv`.
   - Print summary: opens a new window with a light (print-friendly) document — H1 "{Name} — feeding & care summary", age + generated timestamp, then per-day heading + summary line + table (Time/Type/Detail/Note) — and calls `window.print()`.
3. **Filter row**: segmented control `All / Feeds / Diapers / Sleep / Pump / Health` — filters the day lists and their summary lines (not the trend card).
4. **Day sections** (newest first): header "Today" or "Wed, Jul 22" + muted summary ("6 feeds · 4 diapers · 3h 20m sleep"); rows = surface-filled bars (padding 9px 12px, radius md): 58px time column (11.5px, muted, respects 12/24h setting), a `.tag` (Feed=`tag-accent`, Pump=`tag-accent-2`, Diaper=`tag-neutral`, Sleep=`tag-outline`, Health=`tag-neutral`), detail line 13px (e.g. "Left breast · 18m", "Bottle (formula) · 12m · 3 oz", "Both sides · 15m · 2.5 oz", "Wet + solid", "45m · woke 3:20 PM", "Vitamin D given", "Weight · 4.2 lb"), optional truncated muted note beneath, and a 28px ghost "×" delete button.
5. Empty state: centered muted "Nothing logged yet — entries will appear here."

### Settings dialog
`.dialog-backdrop` (fixed, centered, backdrop click closes) + `.dialog .elev-lg`, max-width 320px. Fields: Baby's name (text), Born date & time (`datetime-local`, `color-scheme: dark`), Volume units seg (oz/ml), Time format seg (12/24h), Default bottle contents seg (Milk/Formula), **[NEW for production] Family code display + copy button and "Join a different family" input**, Done `.btn-primary`. All settings sync via the family doc.

### Bottom tab bar
Fixed, max-width 430px, `padding-bottom: calc(12px + env(safe-area-inset-bottom))`, background = bg at 88% + `backdrop-filter: blur(10px)`, top divider border. Two `.btn`s: active = accent border + accent text; inactive = transparent border + 60% text.

## Interactions & Behavior
- All timers tick from a 1-second interval; elapsed derives from stored `start` epoch vs. now (never accumulate locally — this is what makes cross-device timers correct).
- Timer buttons, tab switches and toggles are instant (no animations needed); hover/active/focus states come from `styles.css` — do not restyle.
- Minimum hit target 44px for all primary actions.
- Deleting an entry is immediate (no confirm) — acceptable at this scale; an undo snackbar is a nice-to-have.
- Midnight rollover: "today" = local calendar day.

## State Management
Local UI state only: current tab, stat scope, history filter, dialog open, in-progress input values (amount, pump amount, weight, note). Everything else (settings, active timers, entries) lives in Firestore and renders from snapshots.

## Design Tokens
All in `styles.css` (`:root`). Core: `--color-bg #161826`, `--color-text #e9e9ed`, `--color-accent #9184d9`, `--color-surface`, `--color-divider`, full 100–900 ramps per role, `--font-heading`/`--font-body` (Inter, headings max weight 500), `--space-*` (0.7× density), `--radius-md` (8px), `--shadow-sm/md/lg`. Rules: no pure black/white; accent as line/glow, never a flood; muted text via `color-mix(in srgb, var(--color-text) N%, transparent)`.

## Assets
- `styles.css` — the design system; ship it verbatim.
- Icons: Phosphor (https://phosphoricons.com), inline SVG on `currentColor` (gear icon in the prototype is hand-drawn stroke SVG — replace with Phosphor equivalents).
- PWA icons: create 192/512 maskable PNGs (moon/drop glyph, `#9184d9` on `#161826`).

## Screenshots
- `screenshots/01-track.png` — Track tab (header, stat strip, time-since row, feeding/pumping/diaper/sleep/health cards, quick note)
- `screenshots/02-history.png` — History tab (trend card, export row, filter, day log)
- `screenshots/03-settings.png` — Settings dialog

## Files
- `Baby Tracker.dc.html` — the complete prototype: template markup + all application logic (formatting, metric math, CSV/print generation, toggle semantics). Port the logic class functions nearly as-is.
- `styles.css` — design tokens + component classes (`.btn*`, `.card*`, `.tag*`, `.seg*`, `.field`, `.input`, `.dialog*`, `.elev-*`).

## Build checklist for Claude Code
1. Scaffold Vite + React + `vite-plugin-pwa`; drop in `styles.css`.
2. Recreate the two tabs + settings dialog per the specs above, porting logic from the prototype's `Component` class.
3. Firebase project: Firestore (rules above), Hosting. `initializeFirestore` with persistent local cache.
4. Family create/join flow + code in Settings.
5. Move active timers & settings onto the family doc; entries into the subcollection; wire `onSnapshot`.
6. Manifest + icons + SW; verify Lighthouse PWA installability.
7. Test: two devices, one family code; start a feed on phone A, watch it tick on phone B; stop on B; airplane-mode logging syncs on reconnect.
