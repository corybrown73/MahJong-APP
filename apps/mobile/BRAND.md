# Báhay — brand

**Báhay, Filipino Mahjong.** *Five báhay and an eye.*

The app should feel like sitting down at a good automatic table in a family
home: black lacquer, a narra rim, emerald baize, brass fittings, and tiles that
look heavy enough to click.

## Materials

Three Filipino materials carry the whole identity.

| Material | Role | Token | Hex |
| --- | --- | --- | --- |
| **Narra** — the national hardwood | the table rim, chairs, the rack ledge | `narra` / `narraLight` / `narraDark` | `#6E2F1B` / `#9A4A2C` / `#3A160C` |
| **Capiz** — the window shell | all light type | `capiz` | `#F4EEE3` |
| **Brass** — the fittings | buttons, rules, labels, the lit seat | `gold` / `goldGlow` / `brassDark` | `#C9A15A` / `#EFD08F` / `#7D5E28` |

Set against:

| | Token | Hex |
| --- | --- | --- |
| The room | `night`, `lacquer`, `lacquerLight` | `#0C0907`, `#15100D`, `#221A15` |
| The baize | `feltDeep`, `felt`, `feltLight` | `#062A24`, `#0B4A3F`, `#147060` |
| Tile face / back | `tileFace`, `tileBack` | `#FBF6EA`, `#17705B` |
| LED read-outs | `led` | `#FFB547` |

**Saturated colour belongs to the tiles.** Vermilion `#C23B22`, jade `#1D7A4C`
and indigo `#22407A` are the engraving colours of the three suits and appear
nowhere else, so the tiles are always the brightest thing on screen.

## Type

- **Fraunces** (700, 600, 400 italic) — the wordmark, headings, every number
  on a tile, the scorecard. Italic for quiet asides ("You deal").
- **Inter** (400, 500, 600) — reading text, and labels set in spaced capitals.

Reading text never goes below 16pt. Labels may go to 11pt in capitals.

## Marks

- **Emblem** — a mahjong tile under the pitched roof of a *bahay kubo*, with a
  single red eye on its face: one house, one eye — the shape of every winning
  hand. Source: `assets/brand/emblem.svg`; component: `Emblem` in
  `components/Brand.tsx`.
- **Wordmark** — "Báhay" in Fraunces Bold, with *Filipino Mahjong* in brass
  capitals between two brass rules. Component: `Wordmark`.

Regenerate the app icon, splash, Android adaptive icon and favicon from the
emblem with `node assets/brand/render.cjs`.

## The table

The table screen is an automatic mahjong table seen from above
(`components/MahjongTable.tsx`): narra rim with a brass inlay and a nameplate
per seat, emerald baize, and the lacquered centre console — glass dice dome,
the four winds lit for whoever is acting, and an amber count of tiles left. The
wall rings the console and visibly shrinks. Each player's discards sit in
front of them; hidden hands stand on edge along the rim.

## Tiles

Built the way real tiles are made (`components/TileFace.tsx`): a jade back
showing as a band of thickness, an ivory face lit from the top left, a bevel,
a glaze sheen, and every mark *carved* — a shadow above, a highlight below,
then the colour. The rank sits in the top-left corner like a playing card so
it stays readable when tiles overlap on the rack.

## Voice

Warm, plain, a little bit Tita. "Pull up a chair." "Deal the first hand."
"Your tiles are where you left them." Filipino terms stay in Filipino and are
explained once, in place.
