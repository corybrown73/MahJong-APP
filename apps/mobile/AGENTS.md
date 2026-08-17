# apps/mobile

Expo SDK 57 (React Native 0.86, React 19.2), expo-router, Reanimated 4 +
react-native-worklets, react-native-svg for tile art.

Two rules worth keeping:

1. **The engine decides what is legal, always.** Never re-implement a rule in a
   component. Ask `legalActions(state, seat)` and render the answer.
2. **Nothing acts on the player's tiles for them.** No auto-sort, no auto-meld,
   no auto-discard. The claim-window timer dispatches `PASS` on the player's
   behalf and nothing else.

`pnpm bundle-check` exports the web bundle — the fastest way to prove the app
still compiles without a device.
