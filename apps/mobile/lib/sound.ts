/**
 * Table sounds: the clack of a discard, a tick when a tile is lifted, a chime
 * for a call and a flourish for a win. The clips are synthesized (see
 * assets/sounds), so there is nothing licensed to track.
 *
 * Everything here is fire-and-forget and fails quietly — a missing audio
 * device must never break a hand. The Sound setting is checked by the caller.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type SoundName = 'discard' | 'select' | 'call' | 'win';

const SOURCES: Record<SoundName, number> = {
  discard: require('../assets/sounds/discard.wav'),
  select: require('../assets/sounds/select.wav'),
  call: require('../assets/sounds/call.wav'),
  win: require('../assets/sounds/win.wav'),
};

const VOLUME: Record<SoundName, number> = {
  discard: 0.7,
  select: 0.35,
  call: 0.6,
  win: 0.7,
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let configured = false;

function player(name: SoundName): AudioPlayer | null {
  try {
    if (!configured) {
      configured = true;
      // Respect the ringer switch, and never stop the player's own music.
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(
        () => undefined,
      );
    }
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name];
      players[name] = p;
    }
    return p;
  } catch {
    return null;
  }
}

export function playSound(name: SoundName): void {
  const p = player(name);
  if (!p) return;
  try {
    void p
      .seekTo(0)
      .then(() => p.play())
      .catch(() => undefined);
  } catch {
    // A browser that has not had a user gesture yet refuses to play; ignore.
  }
}
