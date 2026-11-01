# Báhay — Filipino Mahjong

A game of Filipino (16-tile) mahjong for **the browser and for phones**:
five *báhay* and an eye, sixteen-tile hands, four players, and every call
announced slowly enough that a beginner can follow the whole hand.

One codebase, three ways to play:

- **In a browser** — desktop or phone, nothing to install. Keyboard play on
  desktop; add it to a home screen and it opens full screen and works offline.
- **The iPhone app** and **the Android app** — the same game, built with Expo.

Every version plays the same rules and can sit at the same online table.

Built for Filipino mahjong first — not a reskinned Chinese engine. Winds and
dragons are bonus tiles (*bulaklák*), the wall is one circle consumed from
both ends, and the ambitions (*búnot*, *escaléra*, *siete pares*, *sagása*,
*bisaklát*…) pay exactly the way the family table pays them.

## Layout

```
bahay/
├─ apps/
│  └─ mobile/          # the game: Expo (SDK 57) for iOS, Android and the web
│     └─ public/       # the browser page, web manifest, service worker, icons
├─ packages/
│  ├─ engine/          # pure TypeScript rules engine — no React, no I/O
│  ├─ ai/              # opponents; sees only a PublicGameView, never the wall
│  └─ room/            # online tables: seats, clocks, the authoritative server
└─ supabase/           # the hosted room server and its locked-down table
```

The engine is a deterministic function of `(state, action) → state`. Given a
seed, a game replays identically, and the same module runs authoritatively on
the server for online play.

## Running it

```sh
pnpm install

pnpm test        # engine, AI and room suites
pnpm play seed 4 # watch four hands of AI-vs-AI in the terminal
pnpm web         # the browser version, live-reloading, on localhost
pnpm mobile      # expo start — scan the QR with Expo Go on a phone
```

### The browser version

```sh
pnpm build:web   # → apps/mobile/dist, a static site for any host
pnpm serve:web   # try that build on http://localhost:8080
```

`dist/` is plain static files, so it can go on any static host — GitHub
Pages, Netlify, Cloudflare Pages, Vercel, an S3 bucket. It includes a
`404.html` copy of the page so a refresh on `/table` still loads the game.
Serving it under a sub-path rather than a domain root? Build with
`EXPO_BASE_URL=/the-path pnpm build:web`.

**Published automatically:** `.github/workflows/web.yml` tests, builds and
deploys to GitHub Pages on every push to the default branch. Turn it on once
in *Settings → Pages → Source: GitHub Actions*; the game then lives at
`https://<owner>.github.io/<repo>/`. GitHub Pages on a private repository
needs a paid GitHub plan — otherwise any host above works with `dist/`.

In the browser the game:

- plays from the keyboard on desktop — ← → choose a tile, Enter discards,
  Esc cancels or undoes, Space passes, C / P / K / M call chow, pong, kong
  and mahjongg (the **Keys** button at the table lists them)
- centres a column on wide screens, and the table grows with the window
- installs to a home screen (web manifest + icons) and keeps solo play
  working offline (service worker)

### The phone apps

The same `apps/mobile` builds the iOS and Android apps with
[EAS](https://docs.expo.dev/build/introduction/):

```sh
cd apps/mobile
npx eas-cli build --profile preview --platform android   # an installable .apk
npx eas-cli build --profile production --platform all    # store builds
npx eas-cli submit --platform ios                        # App Store Connect
```

### Online tables

Browser players and app players sit at the same tables. Set
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (or
`EXPO_PUBLIC_ROOM_URL` for a self-hosted room server, `pnpm room:dev`) when
building; for the published browser build, add them as repository variables.
Without them, the practice table — the same room code, run on the device —
still works.

## What the player is promised

- **Legibility over speed.** Every call is announced, animated, and held.
  Speed is adjustable; the default is Relaxed.
- **The hand belongs to the player.** No auto-sort, no auto-meld, no
  auto-discard. Two-step discard with an undo window.
- **The count is visible.** Tap any discard to see how many of that face are
  still unseen; the hint shows exactly what you are waiting on.
- **House rules are real rules.** Joker, chow eligibility, payout values —
  all a config object surfaced in Settings, with presets.
- **The win screen itemizes everything.** Line by line, so nobody ever
  wonders why they were paid what they were paid.
- **No dark patterns.** No timers, no ads, no purchasable chips.

## Status

- ✅ Phase 1 — engine, complete with tests and a CLI harness
- ✅ Phase 2 — playable table against three AI opponents
- ✅ Phase 3 — personalities, Learn flow, coach mode, hints, stats, house
  rules, accessibility (high contrast, reduced motion, tile size), haptics
- ✅ Phase 4 — friends-and-family rooms: room codes, chairs, reconnects
- ✅ Browser version — keyboard play, desktop layout, installable, offline
- ⬜ Phase 5 — deploy the room server, store listings and release
