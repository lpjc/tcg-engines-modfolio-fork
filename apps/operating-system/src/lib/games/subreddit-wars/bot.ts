import { defaultBacklineSlot, getHandMods, getHandSpells } from "./engine";
import type { CommittedAction, GameState, SpellCardDef, TrackName } from "./types";
import { TRACK_NAMES } from "./types";

/**
 * Random bot: picks a random mod and optionally a random spell.
 * No intelligence — just random legal choices.
 */
export function botCommit(state: GameState): CommittedAction {
  const mods = getHandMods(state, "opponent");

  let modId: string;

  if (mods.length === 0) {
    // Fallback: pick any mod from discard (reshuffling mid-turn, just keep game running)
    const discardMods = state.opponent.discard.filter(
      (id) => state.cards[id]?.type === "mod",
    );
    if (discardMods.length === 0) {
      // Absolute last resort: bot can't play — pick any card id (engine will handle gracefully)
      // Return a minimal commit that won't crash resolveTurn
      const anyCard = Object.keys(state.cards).find(
        (id) => id.startsWith("opponent_") && state.cards[id]?.type === "mod",
      );
      if (!anyCard) throw new Error("Bot has absolutely no mod cards.");
      modId = anyCard;
    } else {
      modId = discardMods[Math.floor(Math.random() * discardMods.length)] as string;
    }
  } else {
    modId = mods[Math.floor(Math.random() * mods.length)] as string;
  }

  const spells = getHandSpells(state, "opponent");

  // Pick a random spell (optional — ~70% chance if available)
  let spellId: string | null = null;
  let spellTarget: TrackName | undefined;

  if (spells.length > 0 && Math.random() < 0.7) {
    spellId = spells[Math.floor(Math.random() * spells.length)] as string;

    // If the spell needs a track target, pick a random uncaptured track
    const spellDef = state.cards[spellId] as SpellCardDef;
    if (spellDef?.needsTrackTarget) {
      const uncaptured = TRACK_NAMES.filter((t) => state.tracks[t].capturedBy === null);
      if (uncaptured.length > 0) {
        spellTarget = uncaptured[Math.floor(Math.random() * uncaptured.length)];
      }
    }
  }

  // Pick backline slot
  const backlineSlot = defaultBacklineSlot(state, "opponent");

  return { modId, spellId, backlineSlot, spellTarget };
}
