/**
 * Solo play.
 *
 * A thin wrapper: the store owns the game and the clock, and the table itself
 * is the same component online play renders, fed the same filtered view a
 * server would send.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  claimOptions,
  isLastHand,
  legalActions,
  publicView,
  seatsAwaitingClaimResponse,
  currentSeat,
  type Action,
  type SeatId,
} from '@bahay/engine';
import { TableView } from '../components/TableView';
import { Body, Button, Screen } from '../components/ui';
import { motion, speedMultiplier } from '../theme/tokens';
import { HUMAN, seatNames, useGame } from '../store/game';
import { useSettings } from '../store/settings';

export default function SoloTableScreen() {
  const game = useGame();
  const speed = useSettings((s) => s.speed);
  const state = game.state;
  const [claimProgress, setClaimProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!game.claimEndsAt) {
      setClaimProgress(null);
      return;
    }
    const total = motion.claimWindow * speedMultiplier[speed];
    const id = setInterval(() => {
      const left = (game.claimEndsAt ?? 0) - Date.now();
      setClaimProgress(Math.max(0, Math.min(1, left / total)));
    }, 60);
    return () => clearInterval(id);
  }, [game.claimEndsAt, speed]);

  const names = useMemo(() => seatNames(game.difficulties), [game.difficulties]);
  const legal: Action[] = useMemo(
    () => (state ? legalActions(state, HUMAN) : []),
    [state],
  );

  const callDescriptions = useMemo(() => {
    if (!state || state.phase.name !== 'PENDING_CLAIMS') return {};
    const described = claimOptions(state, HUMAN, state.phase.discard, state.phase.from);
    return Object.fromEntries(
      described.map((option) => [
        `${option.call}:${[...option.tileIds].sort().join()}`,
        option.describe,
      ]),
    );
  }, [state]);

  if (!state) {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Body>No hand in progress.</Body>
        <Button label="Back" tone="ghost" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  // A session runs a set number of rounds; when the last one is done the
  // table stops offering another deal and shows where everybody finished.
  const sessionOver = isLastHand(state);

  const waitingOnClaims = seatsAwaitingClaimResponse(state);
  const active = currentSeat(state);
  const waiting: SeatId[] =
    waitingOnClaims.length > 0 ? waitingOnClaims : active === null ? [] : [active];

  return (
    <TableView
      view={publicView(state, HUMAN)}
      names={names}
      yourSeat={HUMAN}
      legal={legal}
      callDescriptions={callDescriptions}
      claimProgress={claimProgress}
      banner={game.banner}
      onBannerDone={game.dismissBanner}
      selectedTileId={game.selectedTileId}
      pendingDiscard={!!game.pendingDiscard}
      settlement={state.phase.name === 'HAND_OVER' ? state.phase.settlement : null}
      waiting={waiting}
      canDealNextHand={!sessionOver}
      sessionOver={sessionOver}
      showHint={game.showHint}
      onSelectTile={game.selectTile}
      onConfirmDiscard={game.confirmDiscard}
      onCancelSelection={() => game.selectTile(null)}
      onUndoDiscard={game.undoDiscard}
      onCall={(option) => game.claim(option.call, option.tileIds)}
      onPass={game.pass}
      onDeclare={game.declareKang}
      onSort={game.sortHand}
      onMoveTile={game.moveTile}
      onToggleHint={game.toggleHint}
      onNextHand={game.nextHand}
      onLeave={() => router.replace('/')}
    />
  );
}
