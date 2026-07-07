// A fixed scripted playthrough shared by the smoke suite (Node) and the boot
// page (browser). Both environments must produce the identical fingerprint —
// that parity IS the Stage 0 deliverable.

export const DEMO_SEED = 0xc0ffee;

export function demoCommands() {
  const cmds = [];
  for (let i = 0; i < 100; i++) {
    cmds.push({ type: 'TICK' });
    cmds.push({ type: 'MOVE', dx: (i % 3) - 1, dy: ((i + 1) % 3) - 1 });
    if (i % 4 === 0) cmds.push({ type: 'ROLL' });
    if (i % 25 === 24) cmds.push({ type: 'DAMAGE', amount: 1 });
  }
  return cmds;
}
