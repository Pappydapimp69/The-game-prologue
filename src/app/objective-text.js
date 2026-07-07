// Single source of truth for turning a quest objective into player-facing
// prose. Duplicated logic here (once in the HUD tracker, once in the
// quest-offer modal) has already drifted apart twice — once each type.
export function describeObjective(o) {
  if (o.type === 'kill') return `Defeat ${o.n || 1} ${o.target}${(o.n || 1) > 1 ? 's' : ''}`;
  if (o.type === 'collect') return `Find the ${o.item}`;
  if (o.type === 'reach') return `Scout the ${o.zone.replace(/-/g, ' ')}`;
  throw new Error(`describeObjective: unknown objective type ${o.type}`);
}
