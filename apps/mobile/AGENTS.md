# apps/mobile

Expo SDK 57 (React Native 0.86, React 19.2), expo-router, Reanimated 4 +
react-native-worklets, react-native-svg for tile art.

Three rules worth keeping:

1. **The engine decides what is legal, always.** Never re-implement a rule in a
   component. Ask `legalActions(state, seat)` and render the answer.
2. **Nothing acts on the player's tiles for them.** No auto-sort, no auto-meld,
   no auto-discard. The claim-window timer dispatches `PASS` on the player's
   behalf, and the one exception the player can opt out of is the
   `autoMahjongg` setting: playing alone, a win is taken for them.

3. **It ships to the browser too.** The same screens run on iOS, Android and
   the web. Guard browser-only code with `Platform.OS === 'web'`, check wide
   desktop windows as well as phones, and keep SVG gradient ids unique per
   instance (`lib/svgId.ts`) — a hidden screen's `<defs>` don't paint on the
   web. `pnpm build:web` builds the static site into `dist/`.

`pnpm bundle-check` exports the web bundle — the fastest way to prove the app
still compiles without a device.
