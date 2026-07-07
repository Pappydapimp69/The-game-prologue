// A fixed scripted playthrough shared by the smoke suite (Node) and the boot
// page (browser). Both environments must produce the identical fingerprint.
// The script exercises EVERY sim verb at least once; over-issued attacks are
// safe (a downed enemy answers with an `already_down` event, never a throw).

export const DEMO_SEED = 0xc0ffee;

const M = (dx, dy) => ({ type: 'MOVE', dx, dy });

export function demoCommands() {
  return [
    { type: 'TICK' },
    // Mentor is adjacent at spawn: talk, get the offer, accept it.
    { type: 'TALK', npcId: 'warden' },
    { type: 'ACCEPT_QUEST', questId: 'clear-the-road' },
    // Collect the training capsule at (8,4).
    M(1, -1), M(1, 0),
    { type: 'INTERACT', pickupId: 'capsule1' },
    // Break the crate at (7,7) for coins.
    M(0, 1), M(0, 1),
    { type: 'BREAK', destructibleId: 'crate1' },
    // Charge aura, approach the wall gap, walk around the blocked column at
    // x=10 (one bump proves collision) into melee range of husk1.
    { type: 'CHARGE', start: true }, { type: 'CHARGE' },
    M(1, 0), M(1, 0),
    M(1, 0),
    M(0, 1), M(0, 1), M(1, 0), M(1, 0), M(1, -1),
    // husk1 is an IRONHUSK: armored hide, immune to melee. Try the wrong
    // method first — this must bounce off (a `no_effect` event, not a
    // silent no-op), proving the immunity refusal path works — then blast
    // it down with the method that actually works. Three charge+blast
    // cycles guarantee the kill even at minimum damage rolls (3 dmg worst
    // case per blast * 3 >= 8 hp), so this stays robust across ANY seed —
    // this script also runs against the title screen's own boot seed, not
    // just DEMO_SEED. Over-issued attacks past the kill are safe regardless
    // (a downed enemy answers with `already_down`, never a throw).
    { type: 'MELEE', enemyId: 'husk1' },
    { type: 'CHARGE', start: true }, { type: 'CHARGE' }, { type: 'CHARGE' },
    { type: 'AURA_BLAST', enemyId: 'husk1' },
    { type: 'ENEMY_STRIKE', enemyId: 'husk1' },
    { type: 'CHARGE', start: true }, { type: 'CHARGE' }, { type: 'CHARGE' },
    { type: 'AURA_BLAST', enemyId: 'husk1' },
    { type: 'CHARGE', start: true }, { type: 'CHARGE' }, { type: 'CHARGE' },
    { type: 'AURA_BLAST', enemyId: 'husk1' },
    // On to husk2 at (14,9) — a WARDHUSK: aura-warded, immune to blasts.
    // Same robustness reasoning: 3 melee hits guarantee the kill at minimum
    // damage rolls (3 dmg worst case * 3 >= 8 hp).
    M(1, 1), M(1, 1),
    // Wrong method first again, on the OTHER kind this time — proves the
    // immunity is genuinely per-kind, not a one-off for husk1.
    { type: 'CHARGE', start: true }, { type: 'CHARGE' }, { type: 'CHARGE' },
    { type: 'AURA_BLAST', enemyId: 'husk2' },
    { type: 'ENEMY_STRIKE', enemyId: 'husk2' },
    { type: 'MELEE', enemyId: 'husk2' },
    { type: 'MELEE', enemyId: 'husk2' },
    { type: 'MELEE', enemyId: 'husk2' },
    // Walk east to the pass — the reach objective completes the quest.
    M(1, 0), M(1, 0), M(1, 0), M(1, 0),
    // Spend the reward. Buying the tonic is the last teaching step — the
    // Ravager crests the pass the moment it's done.
    { type: 'BUY', itemId: 'tonic' },
    { type: 'USE_ITEM', itemId: 'tonic' },
    // Phase 1: stand with the Warden. Ally strikes come from the driver.
    { type: 'CHARGE' }, { type: 'CHARGE' },
    M(1, 0), M(1, 0),
    { type: 'ALLY_STRIKE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'ALLY_STRIKE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'ENEMY_STRIKE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    // Phase 2 (mentor falls at half health): alone now.
    { type: 'AURA_BLAST', enemyId: 'ravager1' },
    { type: 'ENEMY_STRIKE', enemyId: 'ravager1' },
    { type: 'CHARGE' }, { type: 'CHARGE' },
    { type: 'AURA_BLAST', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    { type: 'MELEE', enemyId: 'ravager1' },
    // The choice — then out the eastern gate.
    { type: 'CHOOSE_FATE', fate: 'spare' },
    M(1, -1), M(1, 0), M(1, 0),
    { type: 'TICK' }, { type: 'TICK' },
  ];
}
