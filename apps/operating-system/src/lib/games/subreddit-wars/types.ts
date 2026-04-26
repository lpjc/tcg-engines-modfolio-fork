export type TrackName = "karma" | "comments" | "posts";
export type SchoolName = "karma" | "comments" | "posts" | "age";
export type TraitName =
  | "celebrity"
  | "chatterbox"
  | "poster"
  | "veteran"
  | "lurker"
  | "archivist"
  | "contrarian";
export type Owner = "player" | "opponent";

export const TRACK_NAMES: TrackName[] = ["karma", "comments", "posts"];
export const TRACK_MAX = 10;

export interface Track {
  value: number; // -10 to +10; positive = toward player, negative = toward opponent
  capturedBy: Owner | null;
}

export interface ModCardDef {
  id: string;
  type: "mod";
  name: string;
  karma: number;
  comments: number;
  posts: number;
  age: number;
  trait: TraitName;
}

export type SpellEffectId =
  | "CROSSPOST" // Posts +3 + weakest non-Posts uncaptured +1
  | "LOCKED_THREAD" // Lock target track from spells this turn (needsTrackTarget)
  | "PRECEDENT" // Prevent next 2 movement away from you
  | "THREAD_MOMENTUM" // Comments +3
  | "FRONT_PAGE_SURGE" // Karma +4 toward you
  | "MASS_POST" // Posts +4 toward you
  | "COMMENT_BOMB" // Comments +4 toward you
  | "VETERANS_GUARD"; // Prevent next 3 movement away from you

export interface SpellCardDef {
  id: string;
  type: "spell";
  name: string;
  school: SchoolName;
  effectId: SpellEffectId;
  description: string;
  needsTrackTarget?: boolean;
}

export type CardDef = ModCardDef | SpellCardDef;

export interface PlayerState {
  id: Owner;
  name: string;
  hand: string[]; // instance ids
  deck: string[]; // instance ids (pop = draw from top)
  discard: string[];
  backline: (string | null)[]; // 4 slots of instance ids
}

export type TempEffectType =
  | "PREVENT_MOVEMENT_AWAY" // prevent N movement away from owner
  | "LOCK_TRACK_FROM_SPELLS"; // lock specific track from spell movement

export interface TemporaryEffect {
  type: TempEffectType;
  owner: Owner;
  amount: number;
  track?: TrackName;
}

export type Phase = "DRAW" | "COMMIT" | "RESOLVING" | "TURN_END" | "GAME_OVER";

export interface CommittedAction {
  modId: string;
  spellId: string | null;
  spellTarget?: TrackName; // required for LOCKED_THREAD
  backlineSlot: number; // 0-3
}

export interface SubredditDef {
  id: string;
  name: string;
  description: string;
  passiveRule: string;
  passiveType: "POST_SPELL_KARMA_1" | "NONE";
}

export interface GameState {
  phase: Phase;
  turnNumber: number;
  cards: Record<string, CardDef>;
  tracks: {
    karma: Track;
    comments: Track;
    posts: Track;
  };
  player: PlayerState;
  opponent: PlayerState;
  subreddit: SubredditDef;
  lastTurnLog: string[];
  winner: Owner | null;
  temporaryEffects: TemporaryEffect[];
  playerCommit: CommittedAction | null;
  opponentCommit: CommittedAction | null;
  resolveOrder: Owner[];
}
