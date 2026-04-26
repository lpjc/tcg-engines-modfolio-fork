import {
  OPPONENT_DECK_BASE_IDS,
  PLAYER_DECK_BASE_IDS,
  buildDeck,
  shuffleArray,
} from "./cards";
import type {
  CardDef,
  CommittedAction,
  GameState,
  ModCardDef,
  Owner,
  PlayerState,
  SpellCardDef,
  TempEffectType,
  TemporaryEffect,
  TrackName,
} from "./types";
import { TRACK_MAX, TRACK_NAMES } from "./types";

// ─── helpers ───────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ownerOf(state: GameState, owner: Owner): PlayerState {
  return owner === "player" ? state.player : state.opponent;
}

function opponentOf(owner: Owner): Owner {
  return owner === "player" ? "opponent" : "player";
}

function getCard(state: GameState, id: string): CardDef {
  const card = state.cards[id];
  if (!card) throw new Error(`Card not found: ${id}`);
  return card;
}

function getModCard(state: GameState, id: string): ModCardDef {
  const card = getCard(state, id);
  if (card.type !== "mod") throw new Error(`Expected mod card: ${id}`);
  return card as ModCardDef;
}

function getSpellCard(state: GameState, id: string): SpellCardDef {
  const card = getCard(state, id);
  if (card.type !== "spell") throw new Error(`Expected spell card: ${id}`);
  return card as SpellCardDef;
}

/** Weakest uncaptured track (lowest abs value), excluding an optional track */
function weakestUncaptured(state: GameState, exclude?: TrackName): TrackName | null {
  const candidates = TRACK_NAMES.filter(
    (t) => state.tracks[t].capturedBy === null && t !== exclude,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, t) =>
    Math.abs(state.tracks[t].value) < Math.abs(state.tracks[best].value) ? t : best,
  );
}

// ─── drawCards ─────────────────────────────────────────────────────────────

function drawCard(state: GameState, owner: Owner, log: string[]): void {
  const p = ownerOf(state, owner);
  if (p.deck.length === 0) {
    if (p.discard.length === 0) {
      log.push(`${owner === "player" ? "You have" : "Bot has"} no cards left to draw.`);
      return;
    }
    p.deck = shuffleArray(p.discard);
    p.discard = [];
    log.push(`${owner === "player" ? "Your" : "Bot's"} discard reshuffled into deck.`);
  }
  const drawn = p.deck.pop();
  if (drawn) {
    p.hand.push(drawn);
  }
}

// ─── track movement ────────────────────────────────────────────────────────

/**
 * Move a track by `amount` toward `owner`'s side.
 * amount is always positive; owner determines direction.
 * source: 'mod' | 'spell' | 'trait' | 'subreddit'
 * Returns the actual movement applied (for logging).
 */
function moveTrack(
  state: GameState,
  trackName: TrackName,
  amount: number,
  owner: Owner,
  source: "mod" | "spell" | "trait" | "subreddit",
  log: string[],
  traitTriggered: Set<string>,
): void {
  if (amount <= 0) return;
  const track = state.tracks[trackName];

  // Skip if captured (normal movement can't affect captured tracks)
  if (track.capturedBy !== null) {
    log.push(
      `  ↩ ${trackName} is captured — movement ignored.`,
    );
    return;
  }

  // Skip if locked from spells
  if (source === "spell") {
    const locked = state.temporaryEffects.find(
      (e) => e.type === "LOCK_TRACK_FROM_SPELLS" && e.track === trackName,
    );
    if (locked) {
      log.push(`  🔒 ${trackName} is locked from spell effects this turn.`);
      return;
    }
  }

  // Effective signed amount (positive = toward player)
  let effective = owner === "player" ? amount : -amount;

  // Apply prevention effects
  if (effective < 0) {
    // Movement goes away from player — check player's PREVENT_MOVEMENT_AWAY
    const preventions = state.temporaryEffects.filter(
      (e) => e.type === "PREVENT_MOVEMENT_AWAY" && e.owner === "player",
    );
    for (const eff of preventions) {
      const blocked = Math.min(-effective, eff.amount);
      eff.amount -= blocked;
      effective += blocked; // reduce how far it moves
      if (blocked > 0) log.push(`  🛡 Prevention blocked ${blocked} movement away from you.`);
    }
  } else if (effective > 0) {
    // Movement toward player — check opponent's PREVENT_MOVEMENT_AWAY
    const preventions = state.temporaryEffects.filter(
      (e) => e.type === "PREVENT_MOVEMENT_AWAY" && e.owner === "opponent",
    );
    for (const eff of preventions) {
      const blocked = Math.min(effective, eff.amount);
      eff.amount -= blocked;
      effective -= blocked;
      if (blocked > 0) log.push(`  🛡 Bot prevention blocked ${blocked} movement.`);
    }
  }

  if (effective === 0) {
    log.push(`  All movement on ${trackName} was prevented.`);
    return;
  }

  const oldValue = track.value;
  track.value = clamp(oldValue + effective, -TRACK_MAX, TRACK_MAX);
  const moved = track.value - oldValue;
  if (moved === 0) return;

  const displayVal = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
  const dir = moved > 0 ? "→ you" : "→ bot";
  log.push(
    `  📊 ${trackName}: ${displayVal(oldValue)} ${dir === "→ you" ? "+" : ""}${moved} = ${displayVal(track.value)}`,
  );

  // Capture check
  if (track.value >= TRACK_MAX && track.capturedBy === null) {
    track.capturedBy = "player";
    log.push(`  🏆 YOU captured ${trackName}!`);
    // Trigger Archivist for player
    triggerArchivist(state, "player", trackName, log, traitTriggered);
    // Trigger Contrarian for opponent's backline (they see opponent capturing... no, this is player capturing)
    // Actually Contrarian triggers when OPPONENT captures. So nothing for player capturing.
  } else if (track.value <= -TRACK_MAX && track.capturedBy === null) {
    track.capturedBy = "opponent";
    log.push(`  💀 BOT captured ${trackName}!`);
    // Trigger Contrarian for player
    triggerContrarian(state, "player", trackName, log, traitTriggered);
    // Trigger Archivist for opponent
    triggerArchivist(state, "opponent", trackName, log, traitTriggered);
  }
}

// ─── trait trigger helpers ─────────────────────────────────────────────────

function getBacklineMods(state: GameState, owner: Owner): ModCardDef[] {
  return ownerOf(state, owner)
    .backline.filter((id): id is string => id !== null)
    .map((id) => getModCard(state, id));
}

function triggerArchivist(
  state: GameState,
  owner: Owner,
  capturedTrack: TrackName,
  log: string[],
  traitTriggered: Set<string>,
): void {
  const backlineMods = getBacklineMods(state, owner);
  for (const mod of backlineMods) {
    if (mod.trait !== "archivist") continue;
    if (traitTriggered.has(mod.id)) continue;
    traitTriggered.add(mod.id);
    const target = weakestUncaptured(state, capturedTrack);
    if (!target) continue;
    const who = owner === "player" ? "Your" : "Bot's";
    log.push(`  ✨ ${who} ${mod.name} [Archivist] — bonus push to ${target}!`);
    moveTrack(state, target, 1, owner, "trait", log, traitTriggered);
  }
}

function triggerContrarian(
  state: GameState,
  owner: Owner,
  capturedTrack: TrackName,
  log: string[],
  traitTriggered: Set<string>,
): void {
  const backlineMods = getBacklineMods(state, owner);
  for (const mod of backlineMods) {
    if (mod.trait !== "contrarian") continue;
    if (traitTriggered.has(mod.id)) continue;
    traitTriggered.add(mod.id);
    const target = weakestUncaptured(state, capturedTrack);
    if (!target) continue;
    const who = owner === "player" ? "Your" : "Bot's";
    log.push(`  😤 ${who} ${mod.name} [Contrarian] — opposition surge on ${target}!`);
    moveTrack(state, target, 2, owner, "trait", log, traitTriggered);
  }
}

// ─── spell resolution ──────────────────────────────────────────────────────

function resolveSpell(
  state: GameState,
  owner: Owner,
  spellId: string,
  spellTarget: TrackName | undefined,
  log: string[],
  traitTriggered: Set<string>,
): void {
  const spell = getSpellCard(state, spellId);
  const who = owner === "player" ? "You play" : "Bot plays";
  log.push(`  🪄 ${who} ${spell.name} [${spell.school}] — ${spell.description}`);

  switch (spell.effectId) {
    case "CROSSPOST": {
      moveTrack(state, "posts", 3, owner, "spell", log, traitTriggered);
      // Pick weakest non-posts uncaptured track
      const bonus = weakestUncaptured(state, "posts");
      if (bonus) {
        log.push(`  ↪ Crosspost bonus on ${bonus}:`);
        moveTrack(state, bonus, 1, owner, "spell", log, traitTriggered);
      }
      break;
    }
    case "LOCKED_THREAD": {
      const target = spellTarget ?? "karma";
      state.temporaryEffects.push({
        type: "LOCK_TRACK_FROM_SPELLS",
        owner,
        amount: 1,
        track: target,
      });
      log.push(`  🔒 ${target} is now locked from spell effects this turn.`);
      break;
    }
    case "PRECEDENT": {
      state.temporaryEffects.push({ type: "PREVENT_MOVEMENT_AWAY", owner, amount: 2 });
      log.push(`  🛡 Precedent: ${owner === "player" ? "you" : "bot"} gains prevention (2).`);
      break;
    }
    case "THREAD_MOMENTUM": {
      moveTrack(state, "comments", 3, owner, "spell", log, traitTriggered);
      break;
    }
    case "FRONT_PAGE_SURGE": {
      moveTrack(state, "karma", 4, owner, "spell", log, traitTriggered);
      break;
    }
    case "MASS_POST": {
      moveTrack(state, "posts", 4, owner, "spell", log, traitTriggered);
      break;
    }
    case "COMMENT_BOMB": {
      moveTrack(state, "comments", 4, owner, "spell", log, traitTriggered);
      break;
    }
    case "VETERANS_GUARD": {
      state.temporaryEffects.push({ type: "PREVENT_MOVEMENT_AWAY", owner, amount: 3 });
      log.push(
        `  🛡 Veteran's Guard: ${owner === "player" ? "you" : "bot"} gains prevention (3).`,
      );
      break;
    }
  }

  // Subreddit passive: Post spell → Karma +1 toward caster
  if (state.subreddit.passiveType === "POST_SPELL_KARMA_1" && spell.school === "posts") {
    log.push(`  📋 r/${state.subreddit.name} passive: Post spell → Karma +1!`);
    moveTrack(state, "karma", 1, owner, "subreddit", log, traitTriggered);
  }
}

// ─── backline trait triggers (post-spell) ──────────────────────────────────

function triggerBacklinePostSpell(
  state: GameState,
  owner: Owner,
  spellId: string,
  log: string[],
  traitTriggered: Set<string>,
): void {
  const spell = getSpellCard(state, spellId);
  const backlineMods = getBacklineMods(state, owner);
  const who = owner === "player" ? "Your" : "Bot's";

  for (const mod of backlineMods) {
    if (traitTriggered.has(mod.id)) continue;
    switch (mod.trait) {
      case "celebrity":
        if (spell.school === "karma") {
          traitTriggered.add(mod.id);
          log.push(`  ⭐ ${who} ${mod.name} [Celebrity] — Karma +1!`);
          moveTrack(state, "karma", 1, owner, "trait", log, traitTriggered);
        }
        break;
      case "chatterbox":
        if (spell.school === "comments") {
          traitTriggered.add(mod.id);
          log.push(`  💬 ${who} ${mod.name} [Chatterbox] — Comments +1!`);
          moveTrack(state, "comments", 1, owner, "trait", log, traitTriggered);
        }
        break;
      case "poster":
        if (spell.school === "posts") {
          traitTriggered.add(mod.id);
          log.push(`  📌 ${who} ${mod.name} [Poster] — Posts +1!`);
          moveTrack(state, "posts", 1, owner, "trait", log, traitTriggered);
        }
        break;
      case "veteran":
        if (spell.school === "age") {
          traitTriggered.add(mod.id);
          log.push(`  🏛 ${who} ${mod.name} [Veteran] — Prevention +1!`);
          state.temporaryEffects.push({ type: "PREVENT_MOVEMENT_AWAY", owner, amount: 1 });
        }
        break;
    }
  }
}

// ─── lurker trigger ────────────────────────────────────────────────────────

function triggerLurkerIfSecond(
  state: GameState,
  owner: Owner,
  isSecond: boolean,
  log: string[],
  traitTriggered: Set<string>,
): void {
  if (!isSecond) return;
  const backlineMods = getBacklineMods(state, owner);
  const who = owner === "player" ? "Your" : "Bot's";

  for (const mod of backlineMods) {
    if (mod.trait !== "lurker") continue;
    if (traitTriggered.has(mod.id)) continue;
    traitTriggered.add(mod.id);
    const target = weakestUncaptured(state);
    if (!target) continue;
    log.push(`  👁 ${who} ${mod.name} [Lurker] — resolved second, ${target} +1!`);
    moveTrack(state, target, 1, owner, "trait", log, traitTriggered);
  }
}

// ─── apply mod stat pushes ─────────────────────────────────────────────────

function applyModPushes(
  state: GameState,
  owner: Owner,
  modId: string,
  log: string[],
  traitTriggered: Set<string>,
): void {
  const mod = getModCard(state, modId);
  const who = owner === "player" ? "Your" : "Bot's";
  log.push(`  🎴 ${who} ${mod.name} pushes tracks:`);
  if (mod.karma > 0) moveTrack(state, "karma", mod.karma, owner, "mod", log, traitTriggered);
  if (mod.comments > 0)
    moveTrack(state, "comments", mod.comments, owner, "mod", log, traitTriggered);
  if (mod.posts > 0) moveTrack(state, "posts", mod.posts, owner, "mod", log, traitTriggered);
}

// ─── enter backline ────────────────────────────────────────────────────────

function enterBackline(
  state: GameState,
  owner: Owner,
  modId: string,
  slot: number,
  log: string[],
): void {
  const p = ownerOf(state, owner);
  const who = owner === "player" ? "Your" : "Bot's";
  const mod = getModCard(state, modId);

  // Remove from hand
  const handIdx = p.hand.indexOf(modId);
  if (handIdx !== -1) p.hand.splice(handIdx, 1);

  // Discard old mod if slot occupied
  const existing = p.backline[slot];
  if (existing) {
    const old = getModCard(state, existing);
    log.push(`  ♻️ ${who} ${old.name} is retired from backline slot ${slot + 1}.`);
    p.discard.push(existing);
  }

  p.backline[slot] = modId;
  log.push(`  🪑 ${who} ${mod.name} [${mod.trait}] enters backline slot ${slot + 1}.`);
}

// ─── discard spell from hand ───────────────────────────────────────────────

function discardSpell(state: GameState, owner: Owner, spellId: string): void {
  const p = ownerOf(state, owner);
  const idx = p.hand.indexOf(spellId);
  if (idx !== -1) {
    p.hand.splice(idx, 1);
    p.discard.push(spellId);
  }
}

// ─── resolve one player's package ──────────────────────────────────────────

function resolvePackage(
  state: GameState,
  owner: Owner,
  commit: CommittedAction,
  isSecond: boolean,
  log: string[],
  traitTriggered: Set<string>,
): void {
  const who = owner === "player" ? "YOUR TURN" : "BOT TURN";
  log.push(`\n━━ ${who} (resolving ${isSecond ? "second" : "first"}) ━━`);

  // 1. Resolve spell
  if (commit.spellId) {
    resolveSpell(state, owner, commit.spellId, commit.spellTarget, log, traitTriggered);
    // 2. Trigger backline traits from the spell
    triggerBacklinePostSpell(state, owner, commit.spellId, log, traitTriggered);
    // Discard spell
    discardSpell(state, owner, commit.spellId);
  } else {
    const mod = getModCard(state, commit.modId);
    const who2 = owner === "player" ? "You" : "Bot";
    log.push(`  ${who2} played ${mod.name} [${mod.trait}] — no spell this turn.`);
  }

  // 3. Lurker fires if resolving second
  triggerLurkerIfSecond(state, owner, isSecond, log, traitTriggered);

  // 4. Apply mod track pushes
  applyModPushes(state, owner, commit.modId, log, traitTriggered);

  // 5. Enter backline
  enterBackline(state, owner, commit.modId, commit.backlineSlot, log);
}

// ─── check win condition ───────────────────────────────────────────────────

function checkWin(state: GameState): Owner | null {
  const playerCaptures = TRACK_NAMES.filter(
    (t) => state.tracks[t].capturedBy === "player",
  ).length;
  const opponentCaptures = TRACK_NAMES.filter(
    (t) => state.tracks[t].capturedBy === "opponent",
  ).length;
  if (playerCaptures >= 2) return "player";
  if (opponentCaptures >= 2) return "opponent";
  return null;
}

// ─── clean expired temp effects ────────────────────────────────────────────

function cleanExpiredEffects(state: GameState): void {
  state.temporaryEffects = state.temporaryEffects.filter((e) => {
    // Remove zero-amount prevention effects
    if (e.type === "PREVENT_MOVEMENT_AWAY") return e.amount > 0;
    // Lock effects expire at end of turn
    if (e.type === "LOCK_TRACK_FROM_SPELLS") return false;
    return true;
  });
}

// ─── EXPORTED API ──────────────────────────────────────────────────────────

export function createGame(): GameState {
  const { deckIds: playerDeckIds, cards: playerCards } = buildDeck(
    PLAYER_DECK_BASE_IDS,
    "player",
  );
  const { deckIds: opponentDeckIds, cards: opponentCards } = buildDeck(
    OPPONENT_DECK_BASE_IDS,
    "opponent",
  );

  const allCards = { ...playerCards, ...opponentCards };

  // Deal starting hands (5 cards each)
  const playerHand = playerDeckIds.splice(playerDeckIds.length - 5, 5);
  const opponentHand = opponentDeckIds.splice(opponentDeckIds.length - 5, 5);

  return {
    phase: "COMMIT",
    turnNumber: 1,
    cards: allCards,
    tracks: {
      karma: { value: 0, capturedBy: null },
      comments: { value: 0, capturedBy: null },
      posts: { value: 0, capturedBy: null },
    },
    player: {
      id: "player",
      name: "You",
      hand: playerHand,
      deck: playerDeckIds,
      discard: [],
      backline: [null, null, null, null],
    },
    opponent: {
      id: "opponent",
      name: "Bot",
      hand: opponentHand,
      deck: opponentDeckIds,
      discard: [],
      backline: [null, null, null, null],
    },
    subreddit: {
      id: "technology",
      name: "technology",
      description: "The home of tech mods and link farmers.",
      passiveRule: "Whenever a Post spell is played, move Karma 1 toward that player.",
      passiveType: "POST_SPELL_KARMA_1",
    },
    lastTurnLog: ["Game started. Good luck! Choose a Mod to commit."],
    winner: null,
    temporaryEffects: [],
    playerCommit: null,
    opponentCommit: null,
    resolveOrder: [],
  };
}

export function performDraw(state: GameState): GameState {
  const newState = structuredClone(state);
  const log: string[] = [];

  log.push(`\n═══ Turn ${newState.turnNumber} — Draw Phase ═══`);
  drawCard(newState, "player", log);
  drawCard(newState, "opponent", log);

  newState.lastTurnLog = log;
  newState.phase = "COMMIT";
  return newState;
}

export function resolveTurn(
  state: GameState,
  playerCommit: CommittedAction,
  opponentCommit: CommittedAction,
): GameState {
  const newState = structuredClone(state);
  const log: string[] = [];

  // Determine priority
  const playerMod = getModCard(newState, playerCommit.modId);
  const opponentMod = getModCard(newState, opponentCommit.modId);

  let resolveOrder: Owner[];
  if (playerMod.age > opponentMod.age) {
    resolveOrder = ["player", "opponent"];
    log.push(
      `\n═══ Turn ${newState.turnNumber} — Resolve Phase ═══\n⚡ Priority: ${playerMod.name} (Age ${playerMod.age}) resolves before ${opponentMod.name} (Age ${opponentMod.age}).`,
    );
  } else if (opponentMod.age > playerMod.age) {
    resolveOrder = ["opponent", "player"];
    log.push(
      `\n═══ Turn ${newState.turnNumber} — Resolve Phase ═══\n⚡ Priority: ${opponentMod.name} (Age ${opponentMod.age}) resolves before ${playerMod.name} (Age ${playerMod.age}).`,
    );
  } else {
    // Tie: player currently more ahead resolves first; else coin flip
    const playerScore = TRACK_NAMES.reduce((s, t) => s + newState.tracks[t].value, 0);
    if (playerScore >= 0) {
      resolveOrder = ["player", "opponent"];
    } else {
      resolveOrder = ["opponent", "player"];
    }
    log.push(
      `\n═══ Turn ${newState.turnNumber} — Resolve Phase ═══\n⚡ Age tied! Priority determined by track lead.`,
    );
  }

  newState.resolveOrder = resolveOrder;

  // One shared traitTriggered set for the whole turn
  const traitTriggered = new Set<string>();

  // Resolve both packages in order
  for (let i = 0; i < resolveOrder.length; i++) {
    const owner = resolveOrder[i];
    if (owner === undefined) continue;
    const isSecond = i === 1;
    const commit = owner === "player" ? playerCommit : opponentCommit;
    resolvePackage(newState, owner, commit, isSecond, log, traitTriggered);
  }

  // Clean temp effects at end of turn
  cleanExpiredEffects(newState);

  // Check win
  const winner = checkWin(newState);
  if (winner) {
    newState.winner = winner;
    newState.phase = "GAME_OVER";
    log.push(
      `\n🎉 ${winner === "player" ? "YOU WIN! You control the subreddit!" : "BOT WINS! The bots have taken over!"}`,
    );
  } else {
    newState.phase = "TURN_END";
  }

  newState.playerCommit = playerCommit;
  newState.opponentCommit = opponentCommit;
  newState.lastTurnLog = log;
  return newState;
}

export function startNextTurn(state: GameState): GameState {
  const newState = structuredClone(state);
  newState.turnNumber += 1;
  return performDraw(newState);
}

/** Find a default backline slot for a player committing a mod */
export function defaultBacklineSlot(state: GameState, owner: Owner): number {
  const backline = ownerOf(state, owner).backline;
  // First empty slot
  const empty = backline.findIndex((s) => s === null);
  if (empty !== -1) return empty;
  // Otherwise replace first slot
  return 0;
}

/** Get all mod card ids in hand */
export function getHandMods(state: GameState, owner: Owner): string[] {
  return ownerOf(state, owner).hand.filter((id) => state.cards[id]?.type === "mod");
}

/** Get all spell card ids in hand */
export function getHandSpells(state: GameState, owner: Owner): string[] {
  return ownerOf(state, owner).hand.filter((id) => state.cards[id]?.type === "spell");
}

export type { GameState, CommittedAction, CardDef, ModCardDef, SpellCardDef, Owner, TrackName, TemporaryEffect, TempEffectType };
