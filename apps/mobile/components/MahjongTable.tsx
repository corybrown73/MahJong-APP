/**
 * The table, seen from above: an automatic mahjong table.
 *
 * A narra-wood rim with a brass inlay and a nameplate set into each side. An
 * emerald baize. In the middle, the lacquered console these tables are known
 * for — a glass dice dome, the four winds lit for whoever is acting, and an
 * amber read-out of the tiles left. Around the console, the wall itself, which
 * visibly shrinks as the hand goes on; in front of each player, their own
 * discards; along each edge, their hidden tiles standing on end and anything
 * they have exposed.
 *
 * Purely presentational: it renders a PublicGameView and reports taps.
 */

import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { Meld, PublicGameView, SeatId, Tile as TileModel } from '@bahay/engine';
import { onBrass, type, type Palette } from '../theme/tokens';
import { StandingTile } from './TileFace';
import { useSvgIds } from '../lib/svgId';
import { Tile, TILE_RATIO } from './Tile';

const WINDS = ['東', '南', '西', '北'] as const;
const WIND_NAMES = ['East', 'South', 'West', 'North'] as const;

type Side = 'bottom' | 'right' | 'top' | 'left';

type Props = {
  width: number;
  /** Square by default; on tall screens the table stretches into a long table. */
  height?: number;
  view: PublicGameView;
  /** The seat drawn at the bottom. Spectators watch from seat 0's chair. */
  viewerSeat: SeatId;
  /** Spectating: the bottom seat's hand is hidden too. */
  spectating?: boolean;
  names: Record<SeatId, string>;
  /** Seats the table is waiting on — their nameplate and wind light up. */
  waiting: SeatId[];
  palette: Palette;
  onTapDiscard?: (tile: TileModel) => void;
  onTapMeld?: (meld: Meld) => void;
  onTapSeat?: (seat: SeatId) => void;
};

export function sideOf(seat: SeatId, viewer: SeatId): Side {
  const offset = (seat - viewer + 4) % 4;
  return (['bottom', 'right', 'top', 'left'] as const)[offset];
}

/** The seat's wind this hand: the máno is East, and the winds run counterclockwise. */
export function seatWind(seat: SeatId, dealer: SeatId): number {
  return (seat - dealer + 4) % 4;
}

export const MahjongTable = memo(function MahjongTable({
  width,
  height = width,
  view,
  viewerSeat,
  spectating = false,
  names,
  waiting,
  palette,
  onTapDiscard,
  onTapMeld,
  onTapSeat,
}: Props) {
  const g = useMemo(() => geometry(width, height), [width, height]);
  const seats = [0, 1, 2, 3] as SeatId[];
  const last = view.discards[view.discards.length - 1];
  const lastId = last && !last.claimed ? last.tile.id : null;

  return (
    <View style={{ width, height }} accessibilityLabel="The table">
      <TableBody g={g} palette={palette} />

      {/* The wall, ringing the console, shrinking as tiles are drawn. */}
      <WallRing g={g} remaining={view.tilesRemaining} palette={palette} />

      <Console
        g={g}
        view={view}
        viewerSeat={viewerSeat}
        waiting={waiting}
        palette={palette}
      />

      {seats.map((seat) => {
        const side = sideOf(seat, viewerSeat);
        const player = view.players[seat];
        const discards = view.discards.filter((d) => d.from === seat && !d.claimed);
        return (
          <React.Fragment key={seat}>
            <DiscardZone
              rect={g.zones[side]}
              tiles={discards.map((d) => d.tile)}
              lastId={lastId}
              palette={palette}
              onTap={onTapDiscard}
            />
            <EdgeBand
              g={g}
              side={side}
              concealed={side === 'bottom' && !spectating ? 0 : player.concealedCount}
              melds={player.melds as Meld[]}
              palette={palette}
              onTapMeld={onTapMeld}
            />
            <NamePlate
              g={g}
              side={side}
              name={names[seat]}
              wind={seatWind(seat, view.dealerSeat)}
              chips={player.chips}
              flowers={player.flowers.length}
              active={waiting.includes(seat)}
              palette={palette}
              onPress={onTapSeat ? () => onTapSeat(seat) : undefined}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
});

// ---------------------------------------------------------------- geometry

type Rect4 = { x: number; y: number; w: number; h: number };

type Geometry = {
  width: number;
  height: number;
  rim: number;
  /** The baize, inside the rim. */
  felt: Rect4;
  edge: number;
  ring: Rect4;
  ringDepth: number;
  console: Rect4;
  zones: Record<Side, Rect4>;
};

function geometry(width: number, height: number): Geometry {
  const short = Math.min(width, height);
  const rim = Math.round(short * 0.058);
  const felt = { x: rim, y: rim, w: width - rim * 2, h: height - rim * 2 };
  const edge = Math.round(Math.min(felt.w, felt.h) * 0.14);
  const ix = rim + edge;
  const iy = rim + edge;
  const iw = felt.w - edge * 2;
  const ih = felt.h - edge * 2;
  const R = Math.round(Math.min(iw, ih) * 0.47);
  const C = Math.round(R * 0.66);
  const gapX = (iw - R) / 2;
  const gapY = (ih - R) / 2;
  const ringX = ix + gapX;
  const ringY = iy + gapY;
  const ringDepth = (R - C) / 2;
  return {
    width,
    height,
    rim,
    felt,
    edge,
    ring: { x: ringX, y: ringY, w: R, h: R },
    ringDepth,
    console: { x: ringX + ringDepth, y: ringY + ringDepth, w: C, h: C },
    zones: {
      top: { x: ix, y: iy, w: iw, h: gapY },
      bottom: { x: ix, y: iy + ih - gapY, w: iw, h: gapY },
      left: { x: ix, y: ringY, w: gapX, h: R },
      right: { x: ix + iw - gapX, y: ringY, w: gapX, h: R },
    },
  };
}

/** The biggest tile width at which `count` tiles fit in a box. */
function fitTiles(box: Rect4, count: number, max: number, min = 11, gap = 2): number {
  if (count === 0) return max;
  for (let w = max; w >= min; w -= 0.5) {
    const cols = Math.floor((box.w + gap) / (w + gap));
    const rows = Math.floor((box.h + gap) / (w * TILE_RATIO + gap));
    if (cols * rows >= count) return w;
  }
  return min;
}

// ------------------------------------------------------------------- body

const TableBody = memo(function TableBody({ g, palette }: { g: Geometry; palette: Palette }) {
  const id = useSvgIds();
  const W = g.width;
  const H = g.height;
  const r = Math.min(W, H) * 0.075;
  const inlay = g.rim * 0.5;
  return (
    <View style={[StyleSheet.absoluteFill, styles.tableShadow, { borderRadius: r }]}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={id('narra')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.narraLight} />
            <Stop offset="0.45" stopColor={palette.narra} />
            <Stop offset="1" stopColor={palette.narraDark} />
          </LinearGradient>
          <LinearGradient id={id('narra-grain')} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.3" stopColor="#000" stopOpacity="0.12" />
            <Stop offset="0.55" stopColor="#FFF" stopOpacity="0.06" />
            <Stop offset="0.8" stopColor="#000" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id={id('felt')} cx="50%" cy="45%" rx="62%" ry="62%" fx="50%" fy="40%">
            <Stop offset="0" stopColor={palette.feltLight} />
            <Stop offset="0.55" stopColor={palette.felt} />
            <Stop offset="1" stopColor={palette.feltDeep} />
          </RadialGradient>
          <LinearGradient id={id('rim-light')} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.35" />
          </LinearGradient>
        </Defs>

        {/* Narra rim */}
        <Rect x={0} y={0} width={W} height={H} rx={r} fill={`url(#${id('narra')})`} />
        <Rect x={0} y={0} width={W} height={H} rx={r} fill={`url(#${id('narra-grain')})`} />
        <Rect
          x={1}
          y={1}
          width={W - 2}
          height={H - 2}
          rx={r - 1}
          fill="none"
          stroke={`url(#${id('rim-light')})`}
          strokeWidth={2}
        />
        {/* Brass inlay */}
        <Rect
          x={inlay}
          y={inlay}
          width={W - inlay * 2}
          height={H - inlay * 2}
          rx={r - inlay}
          fill="none"
          stroke={palette.gold}
          strokeOpacity={0.75}
          strokeWidth={1}
        />
        {/* Baize, set slightly below the rim */}
        <Rect
          x={g.felt.x}
          y={g.felt.y}
          width={g.felt.w}
          height={g.felt.h}
          rx={r * 0.45}
          fill={`url(#${id('felt')})`}
        />
        <Rect
          x={g.felt.x + 1.5}
          y={g.felt.y + 1.5}
          width={g.felt.w - 3}
          height={g.felt.h - 3}
          rx={r * 0.45}
          fill="none"
          stroke="#000"
          strokeOpacity={0.45}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
});

// ----------------------------------------------------------------- console

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.22],
    [0.73, 0.22],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.78],
    [0.73, 0.78],
  ],
};

function Console({
  g,
  view,
  viewerSeat,
  waiting,
  palette,
}: {
  g: Geometry;
  view: PublicGameView;
  viewerSeat: SeatId;
  waiting: SeatId[];
  palette: Palette;
}) {
  const { x, y, w } = g.console;
  const id = useSvgIds();
  const dome = w * 0.27;
  const die = dome * 0.62;
  const windSize = Math.max(9, w * 0.15);
  const seats = [0, 1, 2, 3] as SeatId[];

  return (
    <View
      style={{ position: 'absolute', left: x, top: y, width: w, height: w }}
      accessibilityLabel={`${view.tilesRemaining} tiles left in the wall. Dice show ${view.dice[0]} and ${view.dice[1]}.`}
    >
      <Svg width={w} height={w}>
        <Defs>
          <LinearGradient id={id('lacquer')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#2B2420" />
            <Stop offset="0.5" stopColor="#120E0C" />
            <Stop offset="1" stopColor="#050404" />
          </LinearGradient>
          <LinearGradient id={id('brass')} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.goldGlow} />
            <Stop offset="0.5" stopColor={palette.gold} />
            <Stop offset="1" stopColor={palette.brassDark} />
          </LinearGradient>
          <RadialGradient id={id('dome')} cx="40%" cy="35%" rx="65%" ry="65%" fx="35%" fy="28%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
            <Stop offset="0.35" stopColor="#9FC9C0" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.55" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={w} rx={w * 0.16} fill={`url(#${id('brass')})`} />
        <Rect x={2} y={2} width={w - 4} height={w - 4} rx={w * 0.14} fill={`url(#${id('lacquer')})`} />
        {/* the gloss across the lacquer */}
        <Rect
          x={4}
          y={4}
          width={w - 8}
          height={(w - 8) * 0.42}
          rx={w * 0.12}
          fill="#FFFFFF"
          opacity={0.05}
        />
        {/* the dice dome */}
        <Circle cx={w / 2} cy={w / 2} r={dome + 1.5} fill={`url(#${id('brass')})`} />
        <Circle cx={w / 2} cy={w / 2} r={dome} fill="#0A1311" />
      </Svg>

      {/* Two dice under the glass. */}
      <View style={[styles.dice, { left: w / 2 - dome, top: w / 2 - dome, width: dome * 2, height: dome * 2 }]}>
        {view.dice.map((value, index) => (
          <View
            key={index}
            style={{
              width: die,
              height: die,
              borderRadius: die * 0.2,
              backgroundColor: '#F7F2E8',
              transform: [{ rotate: index === 0 ? '-12deg' : '9deg' }],
              marginLeft: index === 0 ? 0 : -die * 0.1,
              marginTop: index === 0 ? -die * 0.3 : die * 0.3,
            }}
          >
            {(PIPS[value] ?? PIPS[1]).map(([px, py], pip) => (
              <View
                key={pip}
                style={{
                  position: 'absolute',
                  left: px * die - die * 0.08,
                  top: py * die - die * 0.08,
                  width: die * 0.16,
                  height: die * 0.16,
                  borderRadius: die,
                  backgroundColor: value === 1 || value === 4 ? palette.vermilion : '#1A1411',
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - dome, top: w / 2 - dome }}>
        <Svg width={dome * 2} height={dome * 2}>
          <Circle cx={dome} cy={dome} r={dome} fill={`url(#${id('dome')})`} />
        </Svg>
      </View>

      {/* The four winds, each facing its seat, lit for whoever is acting. */}
      {seats.map((seat) => {
        const side = sideOf(seat, viewerSeat);
        const wind = seatWind(seat, view.dealerSeat);
        const lit = waiting.includes(seat);
        const rotate = { bottom: '0deg', right: '-90deg', top: '180deg', left: '90deg' }[side];
        const inset = w * 0.06;
        const position =
          side === 'bottom'
            ? { left: 0, right: 0, bottom: inset }
            : side === 'top'
              ? { left: 0, right: 0, top: inset }
              : side === 'left'
                ? { top: 0, bottom: 0, left: inset }
                : { top: 0, bottom: 0, right: inset };
        return (
          <View
            key={seat}
            pointerEvents="none"
            style={[styles.windSlot, position]}
            accessibilityLabel={`${WIND_NAMES[wind]}${lit ? ', to play' : ''}`}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontSize: windSize,
                lineHeight: windSize * 1.1,
                color: lit ? palette.led : wind === 0 ? '#B04A36' : 'rgba(244,238,227,0.32)',
                fontWeight: '700',
                transform: [{ rotate }],
                textShadowColor: lit ? palette.led : 'transparent',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: lit ? 6 : 0,
              }}
            >
              {WINDS[wind]}
            </Text>
          </View>
        );
      })}

      {/* Tiles left, on an amber read-out facing you. */}
      <Text
        allowFontScaling={false}
        style={[
          styles.led,
          {
            left: w * 0.1,
            bottom: w * 0.07,
            fontSize: Math.max(8, w * 0.12),
            color: palette.led,
            textShadowColor: palette.led,
          },
        ]}
      >
        {String(view.tilesRemaining).padStart(2, '0')}
      </Text>
      {view.doublesActive ? (
        <Text
          allowFontScaling={false}
          style={[
            styles.led,
            {
              right: w * 0.1,
              bottom: w * 0.07,
              fontSize: Math.max(8, w * 0.12),
              color: palette.led,
              textShadowColor: palette.led,
            },
          ]}
        >
          ×2
        </Text>
      ) : null}
    </View>
  );
}

// -------------------------------------------------------------------- wall

const WallRing = memo(function WallRing({
  g,
  remaining,
  palette,
}: {
  g: Geometry;
  remaining: number;
  palette: Palette;
}) {
  const stacks = Math.max(0, Math.ceil(remaining / 2));
  const perSideMax = 18;
  const { x, y, w } = g.ring;
  const depth = g.ringDepth * 0.72;
  const along = w / perSideMax;
  const base = Math.floor(stacks / 4);
  const extra = stacks % 4;
  const sides: Side[] = ['bottom', 'right', 'top', 'left'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sides.map((side, sideIndex) => {
        const n = Math.min(perSideMax, base + (sideIndex < extra ? 1 : 0));
        const run = n * along;
        const start = (w - run) / 2;
        const inset = (g.ringDepth - depth) / 2;
        return Array.from({ length: n }).map((_, i) => {
          const horizontal = side === 'top' || side === 'bottom';
          const left = horizontal
            ? x + start + i * along
            : side === 'left'
              ? x + inset
              : x + w - g.ringDepth + inset;
          const top = horizontal
            ? side === 'top'
              ? y + inset
              : y + w - g.ringDepth + inset
            : y + start + i * along;
          return (
            <View
              key={`${side}-${i}`}
              style={{
                position: 'absolute',
                left,
                top,
                width: horizontal ? along - 1 : depth,
                height: horizontal ? depth : along - 1,
                borderRadius: 1.5,
                backgroundColor: palette.tileBack,
                borderTopWidth: 0.75,
                borderTopColor: palette.tileBackLight,
                borderBottomWidth: 1.25,
                borderBottomColor: palette.tileBackDark,
              }}
            />
          );
        });
      })}
    </View>
  );
});

// ---------------------------------------------------------------- discards

const DiscardZone = memo(function DiscardZone({
  rect,
  tiles,
  lastId,
  palette,
  onTap,
}: {
  rect: Rect4;
  tiles: TileModel[];
  lastId: string | null;
  palette: Palette;
  onTap?: (tile: TileModel) => void;
}) {
  const pad = 3;
  const inner = { x: 0, y: 0, w: rect.w - pad * 2, h: rect.h - pad * 2 };
  const w = Math.floor(fitTiles(inner, tiles.length, 26) * 2) / 2;
  return (
    <View
      style={{
        position: 'absolute',
        left: rect.x + pad,
        top: rect.y + pad,
        width: inner.w,
        height: inner.h,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignContent: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      {tiles.map((tile) => (
        <Pressable
          key={tile.id}
          onPress={onTap ? () => onTap(tile) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`discarded ${describe(tile)}${tile.id === lastId ? ', just thrown' : ''}`}
        >
          <Tile tile={tile} width={w} palette={palette} flat legal={tile.id === lastId} reducedMotion />
        </Pressable>
      ))}
    </View>
  );
});

// --------------------------------------------------- hidden tiles and melds

const EdgeBand = memo(function EdgeBand({
  g,
  side,
  concealed,
  melds,
  palette,
  onTapMeld,
}: {
  g: Geometry;
  side: Side;
  concealed: number;
  melds: Meld[];
  palette: Palette;
  onTapMeld?: (meld: Meld) => void;
}) {
  const horizontal = side === 'top' || side === 'bottom';
  const run = horizontal ? g.felt.w : g.felt.h;
  const length = run * 0.86;
  const offset = g.rim + (run - length) / 2;
  const standDepth = Math.max(5, g.edge * 0.26);
  const standGap = 4;
  // What is left of the band once the hidden tiles have stood up in it.
  const meldDepth = g.edge - (concealed > 0 ? standDepth + standGap * 2 : standGap * 2);
  const meldTiles = melds.reduce((n, m) => n + m.tiles.length, 0);
  const groupGap = 4;
  const usable = length - Math.max(0, melds.length - 1) * groupGap;
  // Sideways tiles for the side seats lie along the edge, so their footprint
  // along the band is the tile's width and its depth is the tile's height.
  const meldW = Math.max(
    10,
    Math.min(meldDepth / TILE_RATIO, meldTiles ? usable / meldTiles : 99, 24),
  );
  const standAlong = Math.min(16, (length * 0.9) / Math.max(concealed, 1));

  const edgeOf = (depthFromRim: number, thickness: number) => {
    // Positions the strip `depthFromRim` in from the rim, `thickness` deep.
    switch (side) {
      case 'top':
        return { left: offset, top: g.rim + depthFromRim, width: length, height: thickness };
      case 'bottom':
        return {
          left: offset,
          top: g.rim + g.felt.h - depthFromRim - thickness,
          width: length,
          height: thickness,
        };
      case 'left':
        return { top: offset, left: g.rim + depthFromRim, height: length, width: thickness };
      case 'right':
        return {
          top: offset,
          left: g.rim + g.felt.w - depthFromRim - thickness,
          height: length,
          width: thickness,
        };
    }
  };

  const facing = ({ top: 'up', bottom: 'down', left: 'left', right: 'right' } as const)[side];
  const rotate = { bottom: '0deg', top: '0deg', left: '90deg', right: '-90deg' }[side];

  return (
    <>
      {concealed > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.strip,
            edgeOf(standGap, standDepth),
            { flexDirection: horizontal ? 'row' : 'column', gap: 0.5 },
          ]}
        >
          {Array.from({ length: concealed }).map((_, i) => (
            <StandingTile
              key={i}
              along={standAlong - 0.5}
              depth={standDepth}
              facing={facing}
              palette={palette}
            />
          ))}
        </View>
      ) : null}

      {melds.length > 0 ? (
        <View
          style={[
            styles.strip,
            edgeOf(concealed > 0 ? standDepth + standGap * 2 : standGap, meldDepth),
            { flexDirection: horizontal ? 'row' : 'column', gap: groupGap },
          ]}
        >
          {melds.map((meld, index) => (
            <Pressable
              key={index}
              onPress={onTapMeld ? () => onTapMeld(meld) : undefined}
              accessibilityRole="button"
              accessibilityLabel={describeMeldShort(meld)}
              style={{ flexDirection: horizontal ? 'row' : 'column', gap: 0.5 }}
            >
              {meld.tiles.map((tile, i) => (
                <View
                  key={tile.id ?? i}
                  style={
                    horizontal
                      ? undefined
                      : {
                          width: meldW * TILE_RATIO,
                          height: meldW,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }
                  }
                >
                  <View style={{ transform: [{ rotate }] }}>
                    <Tile
                      tile={tile}
                      width={meldW}
                      palette={palette}
                      flat
                      faceDown={meld.type === 'kang' && meld.variant === 'secret' && i < 3}
                    />
                  </View>
                </View>
              ))}
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
});

// --------------------------------------------------------------- nameplate

function NamePlate({
  g,
  side,
  name,
  wind,
  chips,
  flowers,
  active,
  palette,
  onPress,
}: {
  g: Geometry;
  side: Side;
  name: string;
  wind: number;
  chips: number;
  flowers: number;
  active: boolean;
  palette: Palette;
  onPress?: () => void;
}) {
  const horizontal = side === 'top' || side === 'bottom';
  const height = g.rim * 0.82;
  const width = Math.min((horizontal ? g.felt.w : g.felt.h) * 0.62, 200);
  const rotate = { bottom: '0deg', top: '0deg', left: '-90deg', right: '90deg' }[side];
  const position = horizontal
    ? {
        left: g.width / 2 - width / 2,
        top: side === 'top' ? (g.rim - height) / 2 : g.height - g.rim + (g.rim - height) / 2,
      }
    : {
        left: (side === 'left' ? g.rim / 2 : g.width - g.rim / 2) - width / 2,
        top: g.height / 2 - height / 2,
      };
  const fontSize = Math.max(8, height * 0.55);
  const chipsText = `${chips >= 0 ? '+' : '−'}${Math.abs(chips).toFixed(2)}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${WIND_NAMES[wind]}${wind === 0 ? ', máno' : ''}, ${chipsText} chips, ${flowers} flowers${active ? ', to play' : ''}`}
      style={[
        styles.plate,
        position,
        {
          width,
          height,
          borderRadius: height / 2,
          transform: [{ rotate }],
          backgroundColor: active ? palette.goldGlow : palette.gold,
          borderTopColor: palette.goldGlow,
          borderBottomColor: palette.brassDark,
          shadowColor: active ? palette.goldGlow : '#000',
          shadowOpacity: active ? 0.9 : 0.5,
          shadowRadius: active ? 8 : 2,
        },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.plateWind, { fontSize, color: wind === 0 ? '#8E2A17' : onBrass }]}>
        {WINDS[wind]}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.plateName, { fontSize, color: onBrass }]}
      >
        {name}
      </Text>
      <Text allowFontScaling={false} style={[styles.plateMeta, { fontSize: fontSize * 0.92, color: onBrass }]}>
        {flowers > 0 ? `花${flowers} · ` : ''}
        {chipsText}
      </Text>
    </Pressable>
  );
}

function describe(tile: TileModel): string {
  if (tile.kind === 'flower') return `flower ${tile.face}`;
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  return `${tile.rank} ${names[tile.suit]}`;
}

function describeMeldShort(meld: Meld): string {
  const first = meld.tiles.find((t) => t.kind === 'suited');
  const label = meld.type === 'pung' ? 'pong' : meld.type === 'kang' ? 'kong' : 'chow';
  return first ? `${label} of ${describe(first)}` : label;
}

const styles = StyleSheet.create({
  tableShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  dice: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  windSlot: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  led: {
    position: 'absolute',
    fontFamily: type.label,
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  strip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  plateWind: { fontWeight: '700' },
  plateName: {
    flex: 1,
    fontFamily: type.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  plateMeta: { fontFamily: type.bodyMedium, opacity: 0.8 },
});
