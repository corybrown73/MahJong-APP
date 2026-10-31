/**
 * Words for a meld, used wherever a meld is tapped or announced.
 */

import type { Meld } from '@bahay/engine';

export function describeMeld(meld: Meld): string {
  const names = { balls: 'bolá', sticks: 'kahoy', chars: 'letra' } as const;
  const suited = meld.tiles.find((t) => t.kind === 'suited');
  const suit = suited && suited.kind === 'suited' ? names[suited.suit] : '';
  const ranks = meld.tiles
    .filter((t) => t.kind === 'suited')
    .map((t) => (t.kind === 'suited' ? t.rank : 0))
    .join('-');
  const label =
    meld.type === 'kang'
      ? meld.variant === 'secret'
        ? 'secret kang'
        : meld.variant === 'sagasa'
          ? 'sagása'
          : 'kang'
      : meld.type;
  return `${label} — ${ranks} ${suit}`;
}
