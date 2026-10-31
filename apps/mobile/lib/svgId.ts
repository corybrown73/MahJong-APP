import { useId } from 'react';

/**
 * A gradient id unique to this SVG.
 *
 * SVG ids are global to the page on the web, and a screen the navigator keeps
 * mounted but hidden still holds its <defs>. A gradient defined inside a hidden
 * subtree does not paint, so two tiles sharing an id with a hidden screen would
 * both lose their faces. Every SVG gets its own ids instead.
 */
export function useSvgIds(): (name: string) => string {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (name: string) => `bh-${name}-${base}`;
}
