/**
 * The online table.
 *
 * Same screen as solo play, fed by the server's filtered view instead of a
 * local game. Whose turn it is, when a claim window closes, and what is legal
 * are all the server's answers; this screen only renders them.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  chowOptions,
  kangOption,
  pungOption,
  seatsAwaitingClaimResponse,
  currentSeat,
  type SeatId,
} from '@bahay/engine';
import { CLAIM_WINDOW_MS } from '@bahay/room';
import { TableView } from '../components/TableView';
import { Body, Button, Screen, Title } from '../components/ui';
import { legalForView, useRoom } from '../store/room';

export default function OnlineTableScreen() {
  const room = useRoom();
  const view = room.view;
  const [claimProgress, setClaimProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!view?.claimDeadline) {
      setClaimProgress(null);
      return;
    }
    const deadline = view.claimDeadline;
    const id = setInterval(() => {
      setClaimProgress(Math.max(0, Math.min(1, (deadline - Date.now()) / CLAIM_WINDOW_MS)));
    }, 60);
    return () => clearInterval(id);
  }, [view?.claimDeadline]);

  const legal = useMemo(() => legalForView(view), [view]);

  const names = useMemo(() => {
    const map = {} as Record<SeatId, string>;
    for (const seat of view?.seats ?? []) map[seat.seat] = seat.isYou ? 'You' : seat.name;
    return map;
  }, [view?.seats]);

  const callDescriptions = useMemo(() => {
    const out: Record<string, string> = {};
    if (!view?.game || view.game.phase.name !== 'PENDING_CLAIMS') return out;
    const discard = view.game.phase.discard;
    const hand = view.game.hand;
    const record = (option: { call: string; tileIds: string[]; describe: string } | null) => {
      if (option) out[`${option.call}:${[...option.tileIds].sort().join()}`] = option.describe;
    };
    for (const option of chowOptions(hand, discard)) record(option);
    record(pungOption(hand, discard));
    record(kangOption(hand, discard));
    out['todas:'] = 'Mahjongg — this tile completes your hand';
    return out;
  }, [view?.game]);

  if (!view?.game) {
    return (
      <Screen scroll={false} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Title>Waiting for the table…</Title>
        <Body>
          {room.status.connection === 'offline' ? 'Reconnecting.' : 'The hand has not started yet.'}
        </Body>
        <Button label="Back to the lobby" tone="ghost" onPress={() => router.replace('/lobby')} />
      </Screen>
    );
  }

  const waitingOnClaims = seatsAwaitingClaimResponse(view.game as never);
  const active = currentSeat(view.game as never);
  const waiting: SeatId[] =
    waitingOnClaims.length > 0 ? waitingOnClaims : active === null ? [] : [active];

  const youAreHost = view.seats.some((seat) => seat.isYou && seat.isHost);
  const dropped = view.seats.filter((seat) => seat.kind === 'human' && !seat.connected);

  const statusLine =
    room.status.connection === 'offline'
      ? 'Reconnecting — your seat is held'
      : room.status.error
        ? room.status.error
        : dropped.length > 0
          ? `${dropped.map((seat) => seat.name).join(', ')} dropped — the house is covering`
          : waiting.length > 0 && view.yourSeat !== null && !waiting.includes(view.yourSeat)
            ? `Waiting for ${waiting.map((seat) => names[seat]).join(', ')}`
            : null;

  return (
    <TableView
      view={view.game}
      names={names}
      yourSeat={view.yourSeat}
      legal={legal}
      callDescriptions={callDescriptions}
      claimProgress={claimProgress}
      banner={room.banner}
      onBannerDone={room.dismissBanner}
      selectedTileId={room.selectedTileId}
      pendingDiscard={!!room.pendingDiscard}
      settlement={view.settlement}
      waiting={waiting}
      statusLine={statusLine}
      canDealNextHand={youAreHost}
      showHint={room.showHint}
      onSelectTile={room.selectTile}
      onConfirmDiscard={room.confirmDiscard}
      onCancelSelection={() => room.selectTile(null)}
      onUndoDiscard={room.undoDiscard}
      onCall={(option) => room.claim(option.call, option.tileIds)}
      onPass={room.pass}
      onDeclare={room.declare}
      onSort={room.sortHand}
      onMoveTile={room.moveTile}
      onToggleHint={room.toggleHint}
      onNextHand={room.nextHand}
      onLeave={() => {
        room.leave();
        router.replace('/');
      }}
    />
  );
}
