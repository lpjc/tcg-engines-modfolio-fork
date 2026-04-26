import type { CardDef, ModCardDef, Owner, SpellCardDef } from "./types";

// === BASE CARD DEFINITIONS (templates) ===

const MOD_DEFS: ModCardDef[] = [
  // --- Player-leaning mods (balanced stats, strategic traits) ---
  {
    id: "base_old_local",
    type: "mod",
    name: "Old Local Mod",
    karma: 1,
    comments: 2,
    posts: 2,
    age: 10,
    trait: "veteran",
  },
  {
    id: "base_viral_poster",
    type: "mod",
    name: "Viral Poster",
    karma: 3,
    comments: 1,
    posts: 5,
    age: 2,
    trait: "poster",
  },
  {
    id: "base_quiet_lurker",
    type: "mod",
    name: "Quiet Lurker",
    karma: 0,
    comments: 1,
    posts: 1,
    age: 8,
    trait: "lurker",
  },
  {
    id: "base_karma_chaser",
    type: "mod",
    name: "Karma Chaser",
    karma: 5,
    comments: 1,
    posts: 1,
    age: 4,
    trait: "celebrity",
  },
  {
    id: "base_thread_spinner",
    type: "mod",
    name: "Thread Spinner",
    karma: 1,
    comments: 5,
    posts: 1,
    age: 3,
    trait: "chatterbox",
  },
  {
    id: "base_archive_bot",
    type: "mod",
    name: "Archive Bot",
    karma: 2,
    comments: 2,
    posts: 2,
    age: 11,
    trait: "archivist",
  },
  {
    id: "base_contrarian_guy",
    type: "mod",
    name: "Contrarian Guy",
    karma: 1,
    comments: 3,
    posts: 2,
    age: 5,
    trait: "contrarian",
  },
  // --- Bot-leaning mods (higher raw stats, aggressive) ---
  {
    id: "base_famous_mod",
    type: "mod",
    name: "Famous Mod",
    karma: 6,
    comments: 2,
    posts: 1,
    age: 3,
    trait: "celebrity",
  },
  {
    id: "base_thread_goblin",
    type: "mod",
    name: "Thread Goblin",
    karma: 1,
    comments: 5,
    posts: 2,
    age: 1,
    trait: "chatterbox",
  },
  {
    id: "base_old_admin",
    type: "mod",
    name: "Old Admin",
    karma: 2,
    comments: 2,
    posts: 1,
    age: 12,
    trait: "veteran",
  },
  {
    id: "base_front_pager",
    type: "mod",
    name: "Front Pager",
    karma: 4,
    comments: 1,
    posts: 3,
    age: 2,
    trait: "poster",
  },
  {
    id: "base_karma_king",
    type: "mod",
    name: "Karma King",
    karma: 5,
    comments: 2,
    posts: 1,
    age: 5,
    trait: "celebrity",
  },
  {
    id: "base_lurker_prime",
    type: "mod",
    name: "Lurker Prime",
    karma: 0,
    comments: 2,
    posts: 2,
    age: 9,
    trait: "lurker",
  },
];

const SPELL_DEFS: SpellCardDef[] = [
  // --- Player spells ---
  {
    id: "base_crosspost",
    type: "spell",
    name: "Crosspost",
    school: "posts",
    effectId: "CROSSPOST",
    description: "Move Posts +3 toward you and another uncaptured track +1 toward you.",
  },
  {
    id: "base_locked_thread",
    type: "spell",
    name: "Locked Thread",
    school: "comments",
    effectId: "LOCKED_THREAD",
    description: "Choose a track. Spell effects cannot move it this turn.",
    needsTrackTarget: true,
  },
  {
    id: "base_precedent",
    type: "spell",
    name: "Precedent",
    school: "age",
    effectId: "PRECEDENT",
    description: "Prevent the next 2 movement away from you this turn.",
  },
  {
    id: "base_thread_momentum",
    type: "spell",
    name: "Thread Momentum",
    school: "comments",
    effectId: "THREAD_MOMENTUM",
    description: "Move Comments +3 toward you.",
  },
  // --- Bot spells ---
  {
    id: "base_front_page_surge",
    type: "spell",
    name: "Front Page Surge",
    school: "karma",
    effectId: "FRONT_PAGE_SURGE",
    description: "Move Karma 4 toward you.",
  },
  {
    id: "base_mass_post",
    type: "spell",
    name: "Mass Post",
    school: "posts",
    effectId: "MASS_POST",
    description: "Move Posts 4 toward you.",
  },
  {
    id: "base_comment_bomb",
    type: "spell",
    name: "Comment Bomb",
    school: "comments",
    effectId: "COMMENT_BOMB",
    description: "Move Comments 4 toward you.",
  },
  {
    id: "base_veterans_guard",
    type: "spell",
    name: "Veteran's Guard",
    school: "age",
    effectId: "VETERANS_GUARD",
    description: "Prevent the next 3 movement away from you this turn.",
  },
];

// Combined registry by base id
export const BASE_CARD_REGISTRY: Record<string, CardDef> = Object.fromEntries(
  [...MOD_DEFS, ...SPELL_DEFS].map((c) => [c.id, c]),
);

// === DECK LISTS (base card id arrays) ===

export const PLAYER_DECK_BASE_IDS: string[] = [
  "base_old_local",
  "base_old_local",
  "base_old_local",
  "base_viral_poster",
  "base_viral_poster",
  "base_quiet_lurker",
  "base_quiet_lurker",
  "base_karma_chaser",
  "base_karma_chaser",
  "base_thread_spinner",
  "base_thread_spinner",
  "base_archive_bot",
  "base_archive_bot",
  "base_contrarian_guy",
  "base_contrarian_guy",
  "base_crosspost",
  "base_crosspost",
  "base_locked_thread",
  "base_locked_thread",
  "base_precedent",
  "base_thread_momentum",
  "base_thread_momentum",
];

export const OPPONENT_DECK_BASE_IDS: string[] = [
  "base_famous_mod",
  "base_famous_mod",
  "base_famous_mod",
  "base_thread_goblin",
  "base_thread_goblin",
  "base_old_admin",
  "base_old_admin",
  "base_old_admin",
  "base_front_pager",
  "base_front_pager",
  "base_karma_king",
  "base_karma_king",
  "base_lurker_prime",
  "base_lurker_prime",
  "base_lurker_prime",
  "base_front_page_surge",
  "base_front_page_surge",
  "base_mass_post",
  "base_mass_post",
  "base_comment_bomb",
  "base_comment_bomb",
  "base_veterans_guard",
  "base_veterans_guard",
];

// === INSTANCE BUILDER ===

/**
 * Creates a shuffled deck of card instances for a player.
 * Returns both the instanceId array and the cards record.
 */
export function buildDeck(
  baseIds: string[],
  owner: Owner,
): { deckIds: string[]; cards: Record<string, CardDef> } {
  const cards: Record<string, CardDef> = {};
  const deckIds: string[] = [];

  baseIds.forEach((baseId, i) => {
    const base = BASE_CARD_REGISTRY[baseId];
    if (!base) return;
    const instanceId = `${owner}_${baseId}_${i}`;
    cards[instanceId] = { ...base, id: instanceId };
    deckIds.push(instanceId);
  });

  return { deckIds: shuffleArray(deckIds), cards };
}

export function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
