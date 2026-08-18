/**
 * The table, as a presentational component.
 *
 * Solo play and online play render this same screen. It takes a
 * PublicGameView — the filtered view a server would send — so it is incapable
 * of showing another player's tiles even by accident, and the two paths can
 * never drift apart visually.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  faceLabel,
  unseenCount,
  winningFaces,
  type Action,
  type Meld,
  type PublicGameView,
  type SeatId,
  type Settlement,
  type Tile as TileModel,
} from '@bahay/engine';
import { shanten } from '@bahay/ai';
import { CallBanner } from './CallBanner';
import { CallBar, type CallOption } from './CallBar';
import { DiscardPool } from './DiscardPool';
import { Rack } from './Rack';
import { MeldChip, OpponentStrip, describeMeld } from './Seats';
import { Tile } from './Tile';
import { WinScreen } from './WinScreen';
import { Body, Button, Muted, Term, usePalette } from './ui';
import { fontSize, radius, space, type } from '../theme/tokens';
import { useSettings } from '../store/settings';
import type { Banner } from '../store/game';

export type TableViewProps = {
  view: PublicGameView;
  names: Record<SeatId, string>;
  /** Null while spectating: the layout renders without a rack. */
  yourSeat: SeatId | null;
  /** Straight from the engine — the screen never guesses what is legal. */
  legal: Action[];
  callDescriptions: Record<string, string>;
  /** 1 to 0 as the claim window drains. Null when no window is open. */
  claimProgress: number | null;
  banner: Banner | null;
  onBannerDone: () => void;
  selectedTileId: string | null;
  pendingDiscard: boolean;
  settlement: Settlement | null;
  /** Which seats the table is waiting on, for the turn ring. */
  waiting: SeatId[];
  /** Shown under the header: "waiting for Tita", a reconnect notice, and so on. */
  statusLine?: string | null;
  canDealNextHand: boolean;
  /** The session has run its rounds: the win screen shows the final standing. */
  sessionOver?: boolean;
  showHint: boolean;

  onSelectTile: (tileId: string) => void;
  onConfirmDiscard: () => void;
  onCancelSelection: () => void;
  onUndoDiscard: () => void;
  onCall: (option: CallOption) => void;
  onPass: () => void;
  onDeclare: (action: Action) => void;
  onSort: () => void;
  onMoveTile: (from: number, to: number) => void;
  onToggleHint: () => void;
  onNextHand: () => void;
  onLeave: () => void;
};

export function TableView(props: TableViewProps) {
  const palette = usePalette();
  const settings = useSettings();
  const {
    view,
    names,
    yourSeat,
    legal,
    callDescriptions,
    claimProgress,
    banner,
    selectedTileId,
    pendingDiscard,
    settlement,
    waiting,
    statusLine,
    showHint,
  } = props;

  const [magnified, setMagnified] = useState<TileModel | null>(null);
  const [inspecting, setInspecting] = useState<TileModel | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const callOptions: CallOption[] = useMemo(
    () =>
      legal
        .filter((a): a is Extract<Action, { type: 'CLAIM' }> => a.type === 'CLAIM')
        .map((action) => ({
          call: action.call,
          tileIds: action.tileIds,
          describe:
            callDescriptions[`${action.call}:${[...action.tileIds].sort().join()}`] ??
            `Call ${action.call}`,
        })),
    [callDescriptions, legal],
  );

  const declarations = useMemo(
    () =>
      legal.filter(
        (a) => a.type === 'DECLARE_TODAS' || a.type === 'SECRET_KANG' || a.type === 'SAGASA',
      ),
    [legal],
  );

  const onCall = useCallback(
    (option: CallOption) => {
      if (settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      props.onCall(option);
    },
    [props, settings.haptics],
  );

  const waits =
    yourSeat === null
      ? []
      : winningFaces({
          concealed: view.hand,
          melds: view.melds,
          joker: view.joker,
          sieteParesRequiresConcealed: view.ruleset.sieteParesRequiresConcealed,
        });
  const distance =
    yourSeat === null ? 0 : shanten({ concealed: view.hand, melds: view.melds, joker: view.joker });

  const justDrew =
    view.phase.name === 'AWAITING_DISCARD' && view.phase.seat === yourSeat
      ? (view.phase.justDrew?.id ?? null)
      : null;
  const selected = view.hand.find((t) => t.id === selectedTileId) ?? null;
  const myTurn = view.phase.name === 'AWAITING_DISCARD' && view.phase.seat === yourSeat;

  const others = ([0, 1, 2, 3] as SeatId[]).filter((seat) => seat !== (yourSeat ?? 0));
  const [leftSeat, topSeat, rightSeat] = orderAround(yourSeat ?? 0, others);
  const myChips = view.players[yourSeat ?? 0].chips;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.feltDeep }} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={props.onLeave} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.headerText, { color: palette.capiz }]}>◀ Leave</Text>
        </Pressable>
        <Text style={[styles.headerText, { color: palette.capiz }]}>
          Round {view.round} · hand {view.handNumber}
          {view.dealerSeat === yourSeat ? ' · you deal' : ''}
          {view.doublesActive ? ' · doubles' : ''}
          {view.ruleset.jaiAlai.enabled ? ` · pot ${view.pot.toFixed(2)}` : ''}
        </Text>
        <Text style={[styles.chips, { color: palette.gold }]}>
          {view.ruleset.jaiAlai.enabled ? `◆${view.markers[yourSeat ?? 0]} · ` : ''}
          {myChips >= 0 ? '' : '−'}
          {Math.abs(myChips).toFixed(2)}
        </Text>
      </View>

      {statusLine ? (
        <Text style={[styles.status, { color: palette.gold }]} numberOfLines={1}>
          {statusLine}
        </Text>
      ) : null}

      <View style={styles.topSeat}>
        <OpponentStrip
          summary={summaryFor(view, topSeat, names)}
          active={waiting.includes(topSeat)}
          orientation="top"
          onMeldPress={(meld) => setNote(describeMeld(meld))}
        />
      </View>

      <View style={styles.middle}>
        <View style={styles.sideSeat}>
          <OpponentStrip
            summary={summaryFor(view, leftSeat, names)}
            active={waiting.includes(leftSeat)}
            orientation="left"
            onMeldPress={(meld) => setNote(describeMeld(meld))}
          />
        </View>

        <DiscardPool
          discards={view.discards}
          tilesRemaining={view.tilesRemaining}
          onTapTile={setInspecting}
        />

        <View style={styles.sideSeat}>
          <OpponentStrip
            summary={summaryFor(view, rightSeat, names)}
            active={waiting.includes(rightSeat)}
            orientation="right"
            onMeldPress={(meld) => setNote(describeMeld(meld))}
          />
        </View>
      </View>

      {settings.coachMode && yourSeat !== null ? (
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
        windowProgress={claimProgress}
        onCall={onCall}
        onPass={props.onPass}
        onExplain={setNote}
      />

      {view.melds.length > 0 ? (
        <View style={styles.myMelds}>
          {view.melds.map((meld, index) => (
            <MeldChip key={index} meld={meld} onPress={() => setNote(describeMeld(meld))} />
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
                props.onDeclare(action);
              }}
              style={[styles.declare, { backgroundColor: palette.gold }]}
              accessibilityRole="button"
            >
              <Text style={styles.declareText}>{declarationLabel(action)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {pendingDiscard ? (
        <View style={[styles.undo, { backgroundColor: palette.felt }]}>
          <Body style={{ flex: 1 }}>Discarding…</Body>
          <Pressable onPress={props.onUndoDiscard} accessibilityRole="button">
            <Text style={[styles.undoText, { color: palette.gold }]}>UNDO</Text>
          </Pressable>
        </View>
      ) : selected && myTurn ? (
        <View style={styles.confirmRow}>
          <Pressable
            onPress={() => {
              if (settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              props.onConfirmDiscard();
            }}
            style={[styles.confirm, { backgroundColor: palette.gold }]}
            accessibilityRole="button"
            accessibilityLabel={`Discard ${describeShort(selected)}`}
          >
            <Text style={styles.confirmText}>DISCARD {describeShort(selected).toUpperCase()}</Text>
          </Pressable>
          <Pressable
            onPress={props.onCancelSelection}
            style={[styles.cancel, { borderColor: 'rgba(255,253,247,0.25)' }]}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: palette.capiz }]}>CANCEL</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.rackArea, { backgroundColor: 'rgba(0,0,0,0.28)' }]}>
        {yourSeat === null ? (
          <Muted style={{ textAlign: 'center', paddingVertical: space.lg }}>
            Watching — every seat was taken.
          </Muted>
        ) : (
          <>
            <Rack
              tiles={view.hand}
              selectedTileId={selectedTileId}
              justDrewId={justDrew}
              joker={view.joker}
              onSelect={props.onSelectTile}
              onMove={props.onMoveTile}
              onMagnify={setMagnified}
              disabled={!!settlement}
            />

            <View style={styles.tools}>
              <Tool label="Sort" onPress={props.onSort} />
              <Tool label={showHint ? 'Hint ▾' : 'Hint'} onPress={props.onToggleHint} />
              <Tool label={`🌸 ${view.flowers.length}`} onPress={() => undefined} />
              <Tool
                label={`Coach ▸ ${settings.coachMode ? 'on' : 'off'}`}
                onPress={() => settings.set('coachMode', !settings.coachMode)}
              />
            </View>

            {showHint ? (
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
          </>
        )}
      </View>

      <CallBanner
        banner={banner}
        who={banner ? names[banner.seat] : ''}
        onDone={props.onBannerDone}
      />

      {settlement ? (
        <WinScreen
          settlement={settlement}
          names={names}
          // The hand is over, so the winner's tiles are face up for everyone
          // — losing and never seeing what beat you teaches nothing.
          winnerHand={settlement.winnerHand ?? null}
          onNextHand={props.onNextHand}
          onLeave={props.onLeave}
          nextHandLabel={props.canDealNextHand ? 'Next hand' : 'Waiting for the host…'}
          nextHandDisabled={!props.canDealNextHand}
          finalStanding={
            props.sessionOver
              ? [...view.players]
                  .sort((a, b) => b.chips - a.chips)
                  .map((p) => ({ seat: p.seat, chips: p.chips }))
              : null
          }
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

      <Modal visible={!!note} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setNote(null)}>
          <View style={[styles.sheet, { backgroundColor: palette.capiz }]}>
            <Text style={styles.sheetBody}>{note}</Text>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/** Left, top, right as seen from `you` — the player is always at the bottom. */
function orderAround(you: SeatId, others: SeatId[]): [SeatId, SeatId, SeatId] {
  const left = ((you + 3) % 4) as SeatId;
  const top = ((you + 2) % 4) as SeatId;
  const right = ((you + 1) % 4) as SeatId;
  void others;
  return [left, top, right];
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

function summaryFor(view: PublicGameView, seat: SeatId, names: Record<SeatId, string>) {
  const player = view.players[seat];
  return {
    seat,
    name: names[seat],
    concealedCount: player.concealedCount,
    melds: player.melds as Meld[],
    flowers: player.flowers.length,
    chips: player.chips,
    isDealer: player.isDealer,
  };
}

function declarationLabel(action: Action): string {
  switch (action.type) {
    case 'DECLARE_TODAS':
      return 'MAHJONGG';
    case 'SECRET_KANG':
      return `SECRET · ${faceLabel({ suit: action.suit, rank: action.rank })}`;
    case 'SAGASA':
      return `SAGASA · ${faceLabel({ suit: action.suit, rank: action.rank })}`;
    default:
      return action.type;
  }
}

export function describeShort(tile: TileModel): string {
  if (tile.kind === 'flower') return tile.face;
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  return `${tile.rank} ${names[tile.suit]}`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  headerText: { fontFamily: type.body, fontSize: fontSize.small, opacity: 0.8 },
  chips: { fontFamily: type.displaySemi, fontSize: fontSize.body },
  status: {
    fontFamily: type.displaySemi,
    fontSize: fontSize.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingBottom: 4,
  },
  topSeat: { alignItems: 'center', paddingTop: 2 },
  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  // Wide enough for the longest personality name to sit on one line.
  sideSeat: { width: 90, justifyContent: 'center' },
  coach: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: 2 },
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
  confirmRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
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
