// CONTENT — pure data, no functions. This is the authoring surface: adding a
// quest, enemy, NPC, item, or archetype is an edit HERE and nowhere else.
// Objective TYPES (kill / collect / reach) are the code/content seam — a new
// type is a reducer case; a new instance is data. Every id is validated by
// the smoke ladder (schema → referential integrity → completability →
// headless playthrough), so a typo fails the build, not the player.

export const CONTENT = {
  version: 1,

  archetypes: {
    // Identity is front-loaded by template; growth is use-based afterward.
    brawler: {
      name: 'Brawler',
      blurb: 'Fists first. Questions later.',
      hp: 24, aura: 8,
      skills: { melee: 2, aura: 1, perception: 1 },
    },
    channeler: {
      name: 'Channeler',
      blurb: 'The aura answers those who listen.',
      hp: 18, aura: 14,
      skills: { melee: 1, aura: 2, perception: 1 },
    },
    seeker: {
      name: 'Seeker',
      blurb: 'Sees what others miss.',
      hp: 20, aura: 10,
      skills: { melee: 1, aura: 1, perception: 2 },
    },
  },
  defaultArchetype: 'brawler',

  items: {
    tonic: { name: 'Tonic', price: 3, heal: 5 },
    'training-capsule': { name: 'Training Capsule', keyItem: 1 },
  },

  enemyKinds: {
    // senseReq: perception level needed to read exact HP/power (the scouter
    // as an earned skill, not a gadget).
    husk: { name: 'Husk', hp: 8, power: 2, senseReq: 2 },
    stalker: { name: 'Stalker', hp: 12, power: 3, senseReq: 3 },
  },

  regions: {
    'foothold-vale': {
      name: 'Foothold Vale',
      w: 24, h: 16,
      spawn: { x: 5, y: 5 },
      blocked: ['10,5', '10,6', '10,7'],
      npcs: {
        warden: {
          x: 6, y: 5, name: 'Warden Oren', offers: 'clear-the-road',
          dialog: ['The road east is crawling with husks.', 'Stay sharp out there.'],
        },
        keeper: {
          x: 4, y: 8, name: 'Shop Keeper', shop: ['tonic'],
          dialog: ['Fresh tonics. Cheap, mostly.'],
        },
      },
      enemies: {
        husk1: { kind: 'husk', x: 12, y: 6 },
        husk2: { kind: 'husk', x: 14, y: 9 },
        stalker1: { kind: 'stalker', x: 20, y: 4 },
      },
      destructibles: {
        crate1: { x: 7, y: 7, coins: 3 },
      },
      pickups: {
        capsule1: { x: 8, y: 4, item: 'training-capsule' },
      },
      zones: {
        'east-pass': { x: 20, y: 8, r: 2 },
      },
    },
  },
  startRegion: 'foothold-vale',

  quests: {
    'clear-the-road': {
      name: 'Clear the Road',
      giver: 'warden',
      objectives: [
        { type: 'kill', target: 'husk', n: 2 },
        { type: 'collect', item: 'training-capsule' },
        { type: 'reach', zone: 'east-pass' },
      ],
      reward: { coins: 10 },
    },
  },
};
