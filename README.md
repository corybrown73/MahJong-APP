# Báhay — Filipino Mahjong

A mobile game of Filipino (16-tile) mahjong: five *báhay* and an eye,
sixteen-tile hands, four players, and every call announced slowly enough
that a beginner can follow the whole hand.

Built for Filipino mahjong first — not a reskinned Chinese engine. Winds and
dragons are bonus tiles (*bulaklák*), the wall is one circle consumed from
both ends, and the ambitions (*búnot*, *escaléra*, *siete pares*, *sagása*,
*bisaklát*…) pay exactly the way the family table pays them.

## Layout

```
bahay/
├─ apps/
│  └─ mobile/          # Expo app (SDK 57) — expo-router, Reanimated, SVG tiles
└─ packages/
   ├─ engine/          # pure TypeScript rules engine — no React, no I/O
   └─ ai/              # opponents; sees only a PublicGameView, never the wall
```

The engine is a deterministic function of `(state, action) → state`. Given a
seed, a game replays identically — the same module will later run
authoritatively on a server for online play.

## Running it

```sh
pnpm install

pnpm test        # engine + AI suites (140 tests)
pnpm play seed 4 # watch four hands of AI-vs-AI in the terminal
pnpm mobile      # expo start — scan the QR with Expo Go
```

`pnpm --filter @bahay/mobile bundle-check` exports the web bundle, which is
the fastest way to prove the app compiles without a device.

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
- ⬜ Phase 4 — friends-and-family rooms (the engine is already server-ready)
- ⬜ Phase 5 — store assets and release
