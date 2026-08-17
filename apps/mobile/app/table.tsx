/**
 * The table.
 *
 * Portrait-first. Everything the player can legally do comes from
 * `legalActions` — the screen never guesses — and the only thing that ever
 * happens to their tiles without a tap is a PASS when the claim window runs out.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  claimOptions,
  currentSeat,
  faceLabel,
  legalActions,
  publicView,
  seatsAwaitingClaimResponse,
  tilesRemaining,
  unseenCount,
  winningFaces,
  type Action,
  type Face,
  type GameState,
  type Meld,
  type SeatId,
  type Tile as TileModel,
} from '@bahay/engine';
import { shanten } from '@bahay/ai';
import { CallBanner } from '../components/CallBanner';
import { CallBar, type CallOption } from '../components/CallBar';
import { DiscardPool } from '../components/DiscardPool';
import { Rack } from '../components/Rack';
import { MeldChip, OpponentStrip, describeMeld } from '../components/Seats';
import { Tile } from '../components/Tile';
import { WinScreen } from '../components/WinScreen';
import { Body, Button, Muted, Term, usePalette } from '../components/ui';
import { fontSize, motion, radius, space, speedMultiplier, type } from '../theme/tokens';
import { HUMAN, seatNames, useGame } from '../store/game';
import { useSettings } from '../store/settings';

export default function TableScreen() {
  const palette = usePalette();
  const settings = useSettings();
  const game = useGame();
  const state = game.state;

  const [magnified, setMagnified] = useState<TileModel | null>(null);
  const [inspecting, setInspecting] = useState<TileModel | null>(null);
  const [explain, setExplain] = useState<string | null>(null);
  const [meldNote, setMeldNote] = useState<string | null>(null);
  const [windowProgress, setWindowProgress] = useState<number | null>(null);

  const names = useMemo(() => seatNames(game.difficulties), [game.difficulties]);

  // Drain the claim-window line. The engine has no clock; this is purely the
  // visible countdown, and the store is what actually passes on expiry.
  useEffect(() => {
    if (!game.claimEndsAt) {
      setWindowProgress(null);
      return;
    }
    const total = motion.claimWindow * speedMultiplier[settings.speed];
    const id = setInterval(() => {
      const left = (game.claimEndsAt ?? 0) - Date.now();
      setWindowProgress(Math.max(0, Math.min(1, left / total)));
    }, 60);
    return () => clearInterval(id);
  }, [game.claimEndsAt, settings.speed]);

  const options: Action[] = useMemo(
    () => (state ? legalActions(state, HUMAN) : []),
    [state],
  );

  const callOptions: CallOption[] = useMemo(() => {
    if (!state || state.phase.name !== 'PENDING_CLAIMS') return [];
    const described = claimOptions(state, HUMAN, state.phase.discard, state.phase.from);
    return options
      .filter((a): a is Extract<Action, { type: 'CLAIM' }> => a.type === 'CLAIM')
      .map((action) => {
        const match = described.find(
          (o) => o.call === action.call && o.tileIds.join() === action.tileIds.join(),
        );
        return {
          call: action.call,
          tileIds: action.tileIds,
          describe: match?.describe ?? `Call ${action.call}`,
        };
      });
  }, [options, state]);

  const declarations = useMemo(
    () =>
      options.filter(
        (a) => a.type === 'DECLARE_TODAS' || a.type === 'SECRET_KANG' || a.type === 'SAGASA',
      ),
    [options],
  );

  const onCall = useCallback(
    (option: CallOption) => {
      if (settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      game.claim(option.call, option.tileIds);
    },
    [game, settings.haptics],
  );

  if (!state) {
    return (
      <SafeAreaView style={[styles.empty, { backgroundColor: palette.feltDeep }]}>
        <Body>No hand in progress.</Body>
        <Button label="Back" tone="ghost" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const me = state.players[HUMAN];
  const active = currentSeat(state);
  const waiting = seatsAwaitingClaimResponse(state);
  const myTurn = active === HUMAN;
  const justDrew =
    state.phase.name === 'AWAITING_DISCARD' && state.phase.seat === HUMAN
      ? (state.phase.justDrew?.id ?? null)
      : null;

  const view = publicView(state, HUMAN);
  const waits = winningFaces({
    concealed: me.concealed,
    melds: me.melds,
    joker: state.joker,
    sieteParesRequiresConcealed: state.ruleset.sieteParesRequiresConcealed,
  });
  const distance = shanten({ concealed: me.concealed, melds: me.melds, joker: state.joker });

  const selected = me.concealed.find((t) => t.id === game.selectedTileId) ?? null;
  const handOver = state.phase.name === 'HAND_OVER';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.feltDeep }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.headerText, { color: palette.capiz }]}>◀ Leave</Text>
        </Pressable>
        <Text style={[styles.headerText, { color: palette.capiz }]}>
          Round {state.round} · hand {state.handNumber}
          {state.doublesActive ? ' · doubles' : ''}
        </Text>
        <Text style={[styles.chips, { color: palette.gold }]}>
          {me.chips >= 0 ? '' : '−'}
          {Math.abs(me.chips).toFixed(2)}
        </Text>
      </View>

      <View style={styles.topSeat}>
        <OpponentStrip
          summary={summaryFor(state, 2, names)}
          active={active === 2 || waiting.includes(2)}
          orientation="top"
          onMeldPress={(meld) => setMeldNote(describeMeld(meld))}
        />
      </View>

      <View style={styles.middle}>
        <View style={styles.sideSeat}>
          <OpponentStrip
            summary={summaryFor(state, 3, names)}
            active={active === 3 || waiting.includes(3)}
            orientation="left"
            onMeldPress={(meld) => setMeldNote(describeMeld(meld))}
          />
        </View>

        <DiscardPool
          discards={state.discards}
          tilesRemaining={tilesRemaining(state)}
          onTapTile={setInspecting}
        />

        <View style={styles.sideSeat}>
          <OpponentStrip
            summary={summaryFor(state, 1, names)}
            active={active === 1 || waiting.includes(1)}
            orientation="right"
            onMeldPress={(meld) => setMeldNote(describeMeld(meld))}
          />
        </View>
      </View>

      {settings.coachMode ? (
        <View style={styles.coach}>
          <Term>Coach</Term>
          <Muted style={{ fontSize: fontSize.small }}>
            {distance <= 0
              ? `Waiting on ${waits.map(faceLabel).join(' or ') || 'nothing yet'}`
              : `${distance} tile${distance === 1 ? '' : 's'} from a winning hand`}
          </Muted>
        </View>
      ) : null}

      <CallBar
        options={callOptions}
        windowProgress={windowProgress}
        onCall={onCall}
        onPass={game.pass}
        onExplain={setExplain}
      />

      {me.melds.length > 0 ? (
        <View style={styles.myMelds}>
          {me.melds.map((meld, index) => (
            <MeldChip key={index} meld={meld} onPress={() => setMeldNote(describeMeld(meld))} />
          ))}
        </View>
      ) : null}

      {declarations.length > 0 ? (
        <View style={styles.declarations}>
          {declarations.map((action, index) => (
            <Pressable
              key={index}
              onPress={() => {
                if (settings.haptics) {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                game.declareKang(action);
              }}
              style={[styles.declare, { backgroundColor: palette.gold }]}
              accessibilityRole="button"
            >
              <Text style={styles.declareText}>{declarationLabel(action)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {game.pendingDiscard ? (
        <View style={[styles.undo, { backgroundColor: palette.felt }]}>
          <Body style={{ flex: 1 }}>Discarding…</Body>
          <Pressable onPress={game.undoDiscard} accessibilityRole="button">
            <Text style={[styles.undoText, { color: palette.gold }]}>UNDO</Text>
          </Pressable>
        </View>
      ) : selected && myTurn && state.phase.name === 'AWAITING_DISCARD' ? (
        <View style={styles.confirmRow}>
          <Pressable
            onPress={() => {
              if (settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              game.confirmDiscard();
            }}
            style={[styles.confirm, { backgroundColor: palette.gold }]}
            accessibilityRole="button"
            accessibilityLabel={`Discard ${describeShort(selected)}`}
          >
            <Text style={styles.confirmText}>DISCARD {describeShort(selected).toUpperCase()}</Text>
          </Pressable>
          <Pressable
            onPress={() => game.selectTile(null)}
            style={[styles.cancel, { borderColor: 'rgba(255,253,247,0.25)' }]}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: palette.capiz }]}>CANCEL</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.rackArea, { backgroundColor: 'rgba(0,0,0,0.28)' }]}>
        <Rack
          tiles={me.concealed}
          selectedTileId={game.selectedTileId}
          justDrewId={justDrew}
          joker={state.joker}
          onSelect={game.selectTile}
          onMove={game.moveTile}
          onMagnify={setMagnified}
          disabled={handOver}
        />

        <View style={styles.tools}>
          <Tool label="Sort" onPress={game.sortHand} />
          <Tool label={game.showHint ? 'Hint ▾' : 'Hint'} onPress={game.toggleHint} />
          <Tool label={`🌸 ${me.flowers.length}`} onPress={() => undefined} />
          <Tool
            label={`Coach ▸ ${settings.coachMode ? 'on' : 'off'}`}
            onPress={() => settings.set('coachMode', !settings.coachMode)}
          />
        </View>

        {game.showHint ? (
          <View style={styles.hint}>
            {waits.length === 0 ? (
              <Muted style={{ fontSize: fontSize.small }}>
                Not waiting on anything yet — {distance} tile{distance === 1 ? '' : 's'} to go.
              </Muted>
            ) : (
              <Muted style={{ fontSize: fontSize.small }}>
                Waiting on{' '}
                {waits
                  .map((face) => `${faceLabel(face)} (${unseenCount(view, face)} unseen)`)
                  .join(' · ')}
              </Muted>
            )}
          </View>
        ) : null}
      </View>

      <CallBanner
        banner={game.banner}
        who={game.banner ? names[game.banner.seat] : ''}
        onDone={game.dismissBanner}
      />

      {handOver && state.phase.name === 'HAND_OVER' ? (
        <WinScreen
          settlement={state.phase.settlement}
          names={names}
          winnerHand={
            state.phase.settlement.winner === null
              ? null
              : {
                  concealed: state.players[state.phase.settlement.winner].concealed,
                  melds: state.players[state.phase.settlement.winner].melds,
                }
          }
          onNextHand={game.nextHand}
          onLeave={() => {
            game.abandon();
            router.replace('/');
          }}
        />
      ) : null}

      <Modal visible={!!magnified} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setMagnified(null)}>
          {magnified ? <Tile tile={magnified} width={120} palette={palette} /> : null}
        </Pressable>
      </Modal>

      <Modal visible={!!inspecting} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setInspecting(null)}>
          <View style={[styles.sheet, { backgroundColor: palette.capiz }]}>
            {inspecting ? (
              <>
                <Text style={styles.sheetTitle}>{describeShort(inspecting)}</Text>
                <Text style={styles.sheetBody}>
                  {inspecting.kind === 'suited'
                    ? `${unseenCount(view, {
                        suit: inspecting.suit,
                        rank: inspecting.rank,
                      })} of 4 still unseen`
                    : 'A flower — bonus only, never part of a hand'}
                </Text>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!explain || !!meldNote} transparent animationType="fade">
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setExplain(null);
            setMeldNote(null);
          }}
        >
          <View style={[styles.sheet, { backgroundColor: palette.capiz }]}>
            <Text style={styles.sheetBody}>{explain ?? meldNote}</Text>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Tool({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.tool, { backgroundColor: 'rgba(255,255,255,0.07)' }]}
    >
      <Text style={[styles.toolText, { color: palette.capiz }]}>{label}</Text>
    </Pressable>
  );
}

function summaryFor(state: GameState, seat: SeatId, names: Record<SeatId, string>) {
  const player = state.players[seat];
  return {
    seat,
    name: names[seat],
    concealedCount: player.concealed.length,
    melds: player.melds as Meld[],
    flowers: player.flowers.length,
    chips: player.chips,
    isDealer: player.isDealer,
  };
}

function declarationLabel(action: Action): string {
  switch (action.type) {
    case 'DECLARE_TODAS':
      return 'TÓDAS';
    case 'SECRET_KANG':
      return `SECRET · ${faceLabel({ suit: action.suit, rank: action.rank } as Face)}`;
    case 'SAGASA':
      return `SAGÁSA · ${faceLabel({ suit: action.suit, rank: action.rank } as Face)}`;
    default:
      return action.type;
  }
}

function describeShort(tile: TileModel): string {
  if (tile.kind === 'flower') return tile.face;
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  return `${tile.rank} ${names[tile.suit]}`;
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  headerText: { fontFamily: type.body, fontSize: fontSize.small, opacity: 0.8 },
  chips: { fontFamily: type.displaySemi, fontSize: fontSize.body },
  topSeat: { alignItems: 'center', paddingTop: 2 },
  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  sideSeat: { width: 78, justifyContent: 'center' },
  coach: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: 2,
  },
  myMelds: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    flexWrap: 'wrap',
  },
  declarations: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    flexWrap: 'wrap',
  },
  declare: { paddingVertical: 10, paddingHorizontal: space.lg, borderRadius: radius.pill },
  declareText: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 1.4,
    color: '#2A1D07',
  },
  confirmRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm },
  confirm: { flex: 1, paddingVertical: 13, borderRadius: radius.card, alignItems: 'center' },
  confirmText: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.small,
    letterSpacing: 1.2,
    color: '#2A1D07',
  },
  cancel: {
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  cancelText: { fontFamily: type.displaySemi, fontSize: fontSize.small, letterSpacing: 1.2 },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.md,
    marginTop: space.sm,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    gap: space.md,
  },
  undoText: { fontFamily: type.displaySemi, fontSize: fontSize.small, letterSpacing: 1.4 },
  rackArea: { paddingTop: space.sm, paddingBottom: space.sm, gap: space.sm },
  tools: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  tool: { paddingVertical: 7, paddingHorizontal: space.md, borderRadius: radius.pill },
  toolText: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  hint: { paddingHorizontal: space.lg },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,18,13,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: { borderRadius: radius.sheet, padding: space.xl, gap: space.sm, maxWidth: 380 },
  sheetTitle: { fontFamily: type.displaySemi, fontSize: fontSize.large, color: '#1A1613' },
  sheetBody: { fontFamily: type.body, fontSize: fontSize.body, color: '#1A1613' },
});
