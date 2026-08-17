/**
 * Who you are at the table.
 *
 * A random per-device id, kept forever, is enough: it is what lets you drop
 * off the bus and get your own seat and tiles back when you reconnect. No
 * account, no sign-in, nothing to lose.
 */

import { loadJson, saveJson } from './storage';

const KEY = 'bahay.identity.v1';

export type Identity = { playerId: string; name: string };

function randomId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `p-${id}`;
}

let cached: Identity | null = null;

export async function getIdentity(): Promise<Identity> {
  if (cached) return cached;
  const stored = await loadJson<Identity>(KEY, { playerId: '', name: '' });
  const identity: Identity = {
    playerId: stored.playerId || randomId(),
    name: stored.name || 'Player',
  };
  if (identity.playerId !== stored.playerId) await saveJson(KEY, identity);
  cached = identity;
  return identity;
}

export async function setDisplayName(name: string): Promise<Identity> {
  const identity = await getIdentity();
  const next = { ...identity, name: name.trim().slice(0, 16) || 'Player' };
  cached = next;
  await saveJson(KEY, next);
  return next;
}
