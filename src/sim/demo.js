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
    // Charge aura, approach the wall gap, blast husk1 from range.
    { type: 'CHARGE' }, { type: 'CHARGE' },
    M(1, 0), M(1, 0),
    { type: 'AURA_BLAST', enemyId: 'husk1' },
    // Walk around the blocked column at x=10 (one bump proves collision).
    M(1, 0),
    M(0, 1), M(0, 1), M(1, 0), M(1, 0), M(1, -1),
    // Melee husk1 down; it strikes back while we trade.
    { type: 'MELEE', enemyId: 'husk1' },
    { type: 'ENEMY_STRIKE', enemyId: 'husk1' },
    { type: 'MELEE', enemyId: 'husk1' },
    { type: 'MELEE', enemyId: 'husk1' },
    // On to husk2 at (14,9).
    M(1, 1), M(1, 1),
    { type: 'CHARGE' }, { type: 'CHARGE' },
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
