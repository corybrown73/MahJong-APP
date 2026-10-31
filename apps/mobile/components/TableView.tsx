/**
 * The table screen, as a presentational component.
 *
 * Solo play and online play render this same screen. It takes a
 * PublicGameView — the filtered view a server would send — so it is incapable
 * of showing another player's tiles even by accident, and the two paths can
 * never drift apart visually.
 *
 * Top to bottom: a slim header, the automatic table filling whatever room is
 * left, the call bar, and your own tiles on a narra rack.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
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
import { MahjongTable, seatWind } from './MahjongTable';
import { Rack } from './Rack';
import { describeMeld } from './Seats';
import { Tile } from './Tile';
import { WinScreen } from './WinScreen';
import { Backdrop, Body, Muted, Term, usePalette } from './ui';
import { fontSize, onBrass, radius, space, type } from '../theme/tokens';
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
  /** Which seats the table is waiting on, for the lit nameplate and wind. */
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

const WIND_NAMES = ['East', 'South', 'West', 'North'] as const;

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
  const [tableBox, setTableBox] = useState({ width: 0, height: 0 });

  const onTableLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTableBox((box) =>
      Math.abs(box.width - width) < 1 && Math.abs(box.height - height) < 1 ? box : { width, height },
    );
  }, []);
  // Square when the room is square; on a tall phone the table lengthens (up to half
  // again as long) so the extra height goes to bigger, readable discards.
  const tableWidth = Math.floor(Math.min(tableBox.width - space.sm * 2, 620));
  const tableHeight = Math.floor(Math.min(tableBox.height, tableWidth * 1.5));

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
  const seat = yourSeat ?? 0;
  const myChips = view.players[seat].chips;

  const describeSeat = (target: SeatId) => {
    const player = view.players[target];
    const wind = WIND_NAMES[seatWind(target, view.dealerSeat)];
    const melds = player.melds.map((m) => describeMeld(m as Meld)).join('; ');
    setNote(
      `${names[target]} — ${wind}${target === view.dealerSeat ? ' (máno)' : ''}. ` +
        `${player.concealedCount} tiles hidden, ${player.flowers.length} flowers, ` +
        `${player.chips >= 0 ? '+' : '−'}${Math.abs(player.chips).toFixed(2)} chips.` +
        (melds ? ` Showing: ${melds}.` : ''),
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.night }} edges={['top', 'bottom']}>
      <Backdrop />

      <View style={styles.header}>
        <Pressable onPress={props.onLeave} accessibilityRole="button" hitSlop={8} style={styles.leave}>
          <Text style={[styles.leaveText, { color: palette.capiz }]}>‹ Leave</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Term style={{ fontSize: 10 }}>
            Round {view.round} · Hand {view.handNumber}
          </Term>
          <Text style={[styles.headerSub, { color: palette.capiz }]}>
            {view.dealerSeat === yourSeat ? 'You deal' : `${names[view.dealerSeat]} deals`}
            {view.ruleset.jaiAlai.enabled ? ` · pot ${view.pot.toFixed(2)}` : ''}
          </Text>
        </View>
        <Text style={[styles.chips, { color: palette.goldGlow }]}>
          {view.ruleset.jaiAlai.enabled ? `◆${view.markers[seat]}  ` : ''}
          {myChips >= 0 ? '+' : '−'}
          {Math.abs(myChips).toFixed(2)}
        </Text>
      </View>

      {statusLine ? (
        <Text style={[styles.status, { color: palette.goldGlow }]} numberOfLines={1}>
          {statusLine}
        </Text>
      ) : null}

      <View style={styles.tableArea} onLayout={onTableLayout}>
        {tableWidth > 120 && tableHeight > 120 ? (
          <MahjongTable
            width={Math.min(tableWidth, tableHeight)}
            height={tableHeight}
            view={view}
            viewerSeat={seat}
            spectating={yourSeat === null}
            names={names}
            waiting={waiting}
            palette={palette}
            onTapDiscard={setInspecting}
            onTapMeld={(meld) => setNote(describeMeld(meld))}
            onTapSeat={describeSeat}
          />
        ) : null}
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
              style={[
                styles.declare,
                {
                  backgroundColor: palette.gold,
                  borderTopColor: palette.goldGlow,
                  borderBottomColor: palette.brassDark,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.declareText}>{declarationLabel(action)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {pendingDiscard ? (
        <View style={[styles.undo, { borderColor: 'rgba(201,161,90,0.35)' }]}>
          <Body style={{ flex: 1 }}>Discarding…</Body>
          <Pressable onPress={props.onUndoDiscard} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.undoText, { color: palette.goldGlow }]}>UNDO</Text>
          </Pressable>
        </View>
      ) : selected && myTurn ? (
        <View style={styles.confirmRow}>
          <Pressable
            onPress={() => {
              if (settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              props.onConfirmDiscard();
            }}
            style={[
              styles.confirm,
              {
                backgroundColor: palette.gold,
                borderTopColor: palette.goldGlow,
                borderBottomColor: palette.brassDark,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Discard ${describeShort(selected)}`}
          >
            <Text style={styles.confirmText}>DISCARD {describeShort(selected).toUpperCase()}</Text>
          </Pressable>
          <Pressable
            onPress={props.onCancelSelection}
            style={[styles.cancel, { borderColor: 'rgba(244,238,227,0.2)' }]}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: palette.capiz }]}>CANCEL</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.rackArea}>
        {yourSeat === null ? (
          <Muted style={{ textAlign: 'center', paddingVertical: space.lg }}>
            Watching — every chair was taken.
          </Muted>
        ) : (
          <>
            <View>
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
              {/* The narra ledge the tiles stand on. */}
              <View
                pointerEvents="none"
                style={[
                  styles.ledge,
                  {
                    backgroundColor: palette.narra,
                    borderTopColor: palette.narraLight,
                    borderBottomColor: palette.narraDark,
                  },
                ]}
              />
            </View>

            <View style={styles.tools}>
              <Tool label="Sort" onPress={props.onSort} />
              <Tool label={showHint ? 'Hint ▾' : 'Hint'} onPress={props.onToggleHint} />
              <Tool label={`花 ${view.flowers.length}`} onPress={() => describeSeat(seat)} />
              <Tool
                label={`Coach · ${settings.coachMode ? 'on' : 'off'}`}
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
          {magnified ? <Tile tile={magnified} width={132} palette={palette} /> : null}
        </Pressable>
      </Modal>

      <Modal visible={!!inspecting} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setInspecting(null)}>
          <View style={[styles.sheet, { backgroundColor: palette.lacquerLight }]}>
            {inspecting ? (
              <>
                <View style={{ alignItems: 'center', paddingBottom: space.sm }}>
                  <Tile tile={inspecting} width={84} palette={palette} />
                </View>
                <Text style={[styles.sheetTitle, { color: palette.capiz }]}>
                  {describeShort(inspecting)}
                </Text>
                <Text style={[styles.sheetBody, { color: palette.capiz }]}>
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
          <View style={[styles.sheet, { backgroundColor: palette.lacquerLight }]}>
            <Text style={[styles.sheetBody, { color: palette.capiz }]}>{note}</Text>
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
      style={[styles.tool, { borderColor: 'rgba(201,161,90,0.28)' }]}
    >
      <Text style={[styles.toolText, { color: palette.capiz }]}>{label}</Text>
    </Pressable>
  );
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
    paddingVertical: space.xs,
  },
  leave: { minWidth: 64 },
  leaveText: { fontFamily: type.bodyMedium, fontSize: fontSize.small, opacity: 0.85 },
  headerSub: { fontFamily: type.displayItalic, fontSize: fontSize.small, opacity: 0.8 },
  chips: { fontFamily: type.display, fontSize: fontSize.body, minWidth: 64, textAlign: 'right' },
  status: {
    fontFamily: type.label,
    fontSize: fontSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingBottom: 2,
  },
  tableArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs,
  },
  coach: { paddingHorizontal: space.lg, paddingBottom: space.xs, gap: 2 },
  declarations: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  declare: {
    paddingVertical: 10,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderTopWidth: 1,
    borderBottomWidth: 2,
  },
  declareText: {
    fontFamily: type.label,
    fontSize: fontSize.micro,
    letterSpacing: 1.6,
    color: onBrass,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  confirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.card,
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 3,
  },
  confirmText: {
    fontFamily: type.label,
    fontSize: fontSize.small,
    letterSpacing: 1.4,
    color: onBrass,
  },
  cancel: {
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  cancelText: { fontFamily: type.label, fontSize: fontSize.small, letterSpacing: 1.4 },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.md,
    marginTop: space.sm,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    backgroundColor: 'rgba(255,236,214,0.04)',
    gap: space.md,
  },
  undoText: { fontFamily: type.label, fontSize: fontSize.small, letterSpacing: 1.6 },
  rackArea: { paddingTop: space.sm, paddingBottom: space.xs, gap: space.sm },
  ledge: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: 0,
    height: 12,
    borderRadius: 4,
    borderTopWidth: 1,
    borderBottomWidth: 2,
    zIndex: -1,
  },
  tools: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  tool: {
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(255,236,214,0.03)',
  },
  toolText: {
    fontFamily: type.label,
    fontSize: fontSize.micro,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  hint: { paddingHorizontal: space.lg },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,6,5,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: {
    borderRadius: radius.sheet,
    padding: space.xl,
    gap: space.sm,
    maxWidth: 380,
    borderWidth: 1,
    borderColor: 'rgba(201,161,90,0.35)',
  },
  sheetTitle: { fontFamily: type.display, fontSize: fontSize.large, textAlign: 'center' },
  sheetBody: { fontFamily: type.body, fontSize: fontSize.body, lineHeight: 23 },
});
