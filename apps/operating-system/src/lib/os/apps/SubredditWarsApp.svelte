<script lang="ts">
  import { botCommit } from "$lib/games/subreddit-wars/bot";
  import {
    createGame,
    defaultBacklineSlot,
    getHandMods,
    getHandSpells,
    resolveTurn,
    startNextTurn,
  } from "$lib/games/subreddit-wars/engine";
  import type {
    CardDef,
    CommittedAction,
    GameState,
    ModCardDef,
    SpellCardDef,
    TrackName,
  } from "$lib/games/subreddit-wars/types";
  import { TRACK_NAMES } from "$lib/games/subreddit-wars/types";

  // ─── Game State ────────────────────────────────────────────────────────────
  let game = $state<GameState>(createGame());

  // ─── Player Selections (UI state, not engine state) ───────────────────────
  let selectedModId = $state<string | null>(null);
  let selectedSpellId = $state<string | null>(null);
  let selectedBacklineSlot = $state<number>(0);
  let selectedSpellTarget = $state<TrackName | null>(null);
  let logExpanded = $state(true);

  // ─── Derived helpers ───────────────────────────────────────────────────────
  let playerHandMods = $derived(getHandMods(game, "player"));
  let playerHandSpells = $derived(getHandSpells(game, "player"));

  let needsSpellTarget = $derived(
    !!selectedSpellId &&
      !!game.cards[selectedSpellId] &&
      game.cards[selectedSpellId]!.type === "spell" &&
      !!(game.cards[selectedSpellId] as SpellCardDef).needsTrackTarget,
  );

  let canCommit = $derived(
    game.phase === "COMMIT" && selectedModId !== null && game.winner === null,
  );

  // ─── Track display helpers ─────────────────────────────────────────────────
  function trackPercent(value: number): number {
    // -10 = 0%, 0 = 50%, +10 = 100%
    return ((value + 10) / 20) * 100;
  }

  function trackColor(track: (typeof game.tracks)[TrackName]): string {
    if (track.capturedBy === "player") return "bg-success";
    if (track.capturedBy === "opponent") return "bg-error";
    if (track.value > 0) return "bg-info";
    if (track.value < 0) return "bg-warning";
    return "bg-base-300";
  }

  function trackEmoji(name: TrackName): string {
    return name === "karma" ? "⬆️" : name === "comments" ? "💬" : "📌";
  }

  function displayVal(v: number): string {
    return v >= 0 ? `+${v}` : `${v}`;
  }

  // ─── Card display helpers ──────────────────────────────────────────────────
  function cardOf(id: string): CardDef | undefined {
    return game.cards[id];
  }

  function traitEmoji(trait: ModCardDef["trait"]): string {
    const map: Record<string, string> = {
      celebrity: "⭐",
      chatterbox: "💬",
      poster: "📌",
      veteran: "🏛",
      lurker: "👁",
      archivist: "📚",
      contrarian: "😤",
    };
    return map[trait] ?? "❓";
  }

  function schoolEmoji(school: SpellCardDef["school"]): string {
    const map: Record<string, string> = {
      karma: "⬆️",
      comments: "💬",
      posts: "📌",
      age: "⏳",
    };
    return map[school] ?? "❓";
  }

  // ─── Actions ───────────────────────────────────────────────────────────────
  function selectMod(id: string) {
    if (game.phase !== "COMMIT") return;
    selectedModId = id;
    selectedBacklineSlot = defaultBacklineSlot(game, "player");
  }

  function selectSpell(id: string) {
    if (game.phase !== "COMMIT") return;
    if (selectedSpellId === id) {
      selectedSpellId = null;
      selectedSpellTarget = null;
    } else {
      selectedSpellId = id;
      const card = game.cards[id];
      if (card?.type === "spell" && !(card as SpellCardDef).needsTrackTarget) {
        selectedSpellTarget = null;
      }
    }
  }

  function selectBacklineSlot(slot: number) {
    selectedBacklineSlot = slot;
  }

  function handleCommit() {
    if (!canCommit || !selectedModId) return;

    const playerAction: CommittedAction = {
      modId: selectedModId,
      spellId: selectedSpellId,
      backlineSlot: selectedBacklineSlot,
      spellTarget: selectedSpellTarget ?? undefined,
    };

    const botAction = botCommit(game);

    game = resolveTurn(game, playerAction, botAction);

    // Reset selections
    selectedModId = null;
    selectedSpellId = null;
    selectedSpellTarget = null;
  }

  function handleNextTurn() {
    if (game.phase !== "TURN_END") return;
    game = startNextTurn(game);
    selectedModId = null;
    selectedSpellId = null;
    selectedSpellTarget = null;
  }

  function handleNewGame() {
    game = createGame();
    selectedModId = null;
    selectedSpellId = null;
    selectedSpellTarget = null;
    selectedBacklineSlot = 0;
  }
</script>

<div class="h-full flex flex-col bg-base-100 text-base-content overflow-hidden text-sm">
  <!-- Header -->
  <div class="bg-base-300 px-3 py-1 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-2">
      <span class="text-lg">🎮</span>
      <span class="font-bold">r/{game.subreddit.name}</span>
      <span class="badge badge-ghost badge-sm">{game.subreddit.passiveRule}</span>
    </div>
    <div class="flex items-center gap-2 text-xs text-base-content/60">
      <span>Turn {game.turnNumber}</span>
      <span class="badge badge-sm badge-outline">{game.phase}</span>
      <button class="btn btn-xs btn-ghost" onclick={handleNewGame}>↺ New Game</button>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto flex flex-col gap-2 p-2 min-h-0">
    <!-- GAME OVER Banner -->
    {#if game.phase === "GAME_OVER"}
      <div
        class="alert {game.winner === 'player'
          ? 'alert-success'
          : 'alert-error'} text-center font-bold text-lg"
      >
        {game.winner === "player"
          ? "🏆 YOU WIN! You control the subreddit!"
          : "💀 BOT WINS! The bots have taken over!"}
        <button class="btn btn-sm ml-4" onclick={handleNewGame}>Play Again</button>
      </div>
    {/if}

    <!-- Tracks -->
    <div class="card bg-base-200 p-2">
      <div class="text-xs font-bold text-base-content/60 mb-1">TRACKS — capture 2 to win</div>
      {#each TRACK_NAMES as trackName}
        {@const track = game.tracks[trackName]}
        <div class="mb-2">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="w-20 font-semibold flex items-center gap-1">
              {trackEmoji(trackName)}
              {trackName}
            </span>
            <span class="text-xs font-mono w-8 text-right">{displayVal(track.value)}</span>
            {#if track.capturedBy === "player"}
              <span class="badge badge-success badge-sm">YOU captured</span>
            {:else if track.capturedBy === "opponent"}
              <span class="badge badge-error badge-sm">BOT captured</span>
            {/if}
          </div>
          <div class="relative h-3 bg-base-300 rounded-full overflow-hidden">
            <!-- Center line -->
            <div class="absolute top-0 bottom-0 left-1/2 w-0.5 bg-base-content/20"></div>
            <!-- Track indicator -->
            <div
              class="absolute top-0 bottom-0 w-3 rounded-full transition-all duration-300 {trackColor(track)} -translate-x-1/2"
              style="left: {trackPercent(track.value)}%"
            ></div>
            <!-- Left label -->
            <span class="absolute left-1 top-0 text-[8px] text-base-content/40">BOT −10</span>
            <span class="absolute right-1 top-0 text-[8px] text-base-content/40">+10 YOU</span>
          </div>
        </div>
      {/each}
    </div>

    <!-- Bot area -->
    <div class="card bg-base-200 p-2">
      <div class="text-xs font-bold text-base-content/60 mb-1">
        BOT — {game.opponent.hand.length} cards in hand, {game.opponent.deck.length} in deck
      </div>
      <div class="flex gap-1 flex-wrap">
        {#each game.opponent.hand as _}
          <div class="w-8 h-10 bg-base-300 rounded border border-base-content/20 flex items-center justify-center text-lg">
            🂠
          </div>
        {/each}
      </div>
      <!-- Bot backline -->
      {#if game.opponent.backline.some((s) => s !== null)}
        <div class="mt-1 text-xs text-base-content/50">Backline:</div>
        <div class="flex gap-1 flex-wrap mt-0.5">
          {#each game.opponent.backline as slotId, i}
            {#if slotId}
              {@const card = cardOf(slotId)}
              {#if card && card.type === "mod"}
                {@const mod = card as ModCardDef}
                <div
                  class="badge badge-outline badge-sm gap-1"
                  title={mod.name}
                >
                  {traitEmoji(mod.trait)} {mod.name}
                </div>
              {/if}
            {:else}
              <div class="badge badge-ghost badge-sm opacity-30">slot {i + 1}</div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Event Log -->
    <div class="card bg-base-200 p-2">
      <button
        class="text-xs font-bold text-base-content/60 w-full text-left flex items-center gap-1"
        onclick={() => (logExpanded = !logExpanded)}
      >
        📋 Event Log {logExpanded ? "▼" : "▶"}
      </button>
      {#if logExpanded}
        <div class="mt-1 max-h-28 overflow-y-auto font-mono text-xs space-y-0.5 bg-base-300 rounded p-1">
          {#each game.lastTurnLog as line}
            <div class="whitespace-pre-wrap leading-tight">{line}</div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Player area -->
    {#if game.phase !== "GAME_OVER"}
      <!-- Player backline -->
      <div class="card bg-base-200 p-2">
        <div class="text-xs font-bold text-base-content/60 mb-1">YOUR BACKLINE (4 slots)</div>
        <div class="flex gap-1">
          {#each game.player.backline as slotId, i}
            <button
              class="flex-1 h-14 rounded border-2 transition-all text-xs {selectedBacklineSlot === i
                ? 'border-primary bg-primary/10'
                : 'border-base-300 bg-base-100 hover:border-base-content/30'} flex flex-col items-center justify-center gap-0.5 p-1"
              onclick={() => selectBacklineSlot(i)}
              disabled={game.phase !== "COMMIT"}
            >
              {#if slotId}
                {@const card = cardOf(slotId)}
                {#if card && card.type === "mod"}
                  {@const mod = card as ModCardDef}
                  <span>{traitEmoji(mod.trait)}</span>
                  <span class="text-[9px] text-center leading-tight truncate w-full text-center"
                    >{mod.name}</span
                  >
                  <span class="text-[8px] opacity-50">[{mod.trait}]</span>
                {/if}
              {:else}
                <span class="opacity-30 text-xs">empty {i + 1}</span>
              {/if}
            </button>
          {/each}
        </div>
        <div class="text-[9px] text-base-content/50 mt-0.5">
          Click a slot to place your mod there. Occupied slots will replace the existing mod.
        </div>
      </div>

      <!-- Player hand -->
      <div class="card bg-base-200 p-2">
        <div class="text-xs font-bold text-base-content/60 mb-1">
          YOUR HAND — {game.player.deck.length} in deck, {game.player.discard.length} in discard
        </div>

        <!-- Mods -->
        {#if playerHandMods.length > 0}
          <div class="text-[10px] text-base-content/50 mb-0.5">MODS (pick one — required)</div>
          <div class="flex gap-1 flex-wrap mb-2">
            {#each playerHandMods as id}
              {@const card = cardOf(id)}
              {#if card && card.type === "mod"}
                {@const mod = card as ModCardDef}
                <button
                  class="border-2 rounded p-1.5 transition-all text-left w-32 {selectedModId === id
                    ? 'border-primary bg-primary/10'
                    : 'border-base-300 hover:border-base-content/40 bg-base-100'} {game.phase !==
                  'COMMIT'
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'}"
                  onclick={() => selectMod(id)}
                  disabled={game.phase !== "COMMIT"}
                >
                  <div class="font-bold text-xs truncate">{mod.name}</div>
                  <div class="text-[9px] text-base-content/70 mt-0.5">
                    ⬆️{mod.karma} 💬{mod.comments} 📌{mod.posts} ⏳{mod.age}yr
                  </div>
                  <div class="text-[9px] mt-0.5 text-primary">
                    {traitEmoji(mod.trait)} {mod.trait}
                  </div>
                </button>
              {/if}
            {/each}
          </div>
        {:else}
          <div class="text-xs text-error">No mods in hand! Draw more cards.</div>
        {/if}

        <!-- Spells -->
        {#if playerHandSpells.length > 0}
          <div class="text-[10px] text-base-content/50 mb-0.5">SPELLS (optional)</div>
          <div class="flex gap-1 flex-wrap">
            {#each playerHandSpells as id}
              {@const card = cardOf(id)}
              {#if card && card.type === "spell"}
                {@const spell = card as SpellCardDef}
                <button
                  class="border-2 rounded p-1.5 transition-all text-left w-36 {selectedSpellId ===
                  id
                    ? 'border-secondary bg-secondary/10'
                    : 'border-base-300 hover:border-base-content/40 bg-base-100'} {game.phase !==
                  'COMMIT'
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'}"
                  onclick={() => selectSpell(id)}
                  disabled={game.phase !== "COMMIT"}
                >
                  <div class="font-bold text-xs truncate">{spell.name}</div>
                  <div class="text-[9px] text-base-content/70">
                    {schoolEmoji(spell.school)} {spell.school}
                  </div>
                  <div class="text-[9px] mt-0.5 text-base-content/80 leading-tight">
                    {spell.description}
                  </div>
                </button>
              {/if}
            {/each}
          </div>
        {/if}

        <!-- Spell target selector -->
        {#if needsSpellTarget}
          <div class="mt-2 p-1.5 bg-base-300 rounded text-xs">
            <div class="font-bold mb-1">Choose track to lock:</div>
            <div class="flex gap-1">
              {#each TRACK_NAMES as t}
                <button
                  class="btn btn-xs {selectedSpellTarget === t ? 'btn-secondary' : 'btn-ghost'} {game.tracks[t].capturedBy
                    ? 'opacity-30'
                    : ''}"
                  onclick={() => (selectedSpellTarget = t)}
                  disabled={!!game.tracks[t].capturedBy}
                >
                  {trackEmoji(t)} {t}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Commit summary & action -->
      <div class="card bg-base-200 p-2">
        <div class="text-xs font-bold text-base-content/60 mb-1">YOUR COMMIT</div>
        <div class="flex items-center gap-2 flex-wrap text-xs">
          {#if selectedModId}
            {@const mod = cardOf(selectedModId) as ModCardDef}
            <span class="badge badge-primary">{mod?.name ?? "?"} → slot {selectedBacklineSlot + 1}</span>
          {:else}
            <span class="text-base-content/40">← pick a mod</span>
          {/if}
          {#if selectedSpellId}
            {@const spell = cardOf(selectedSpellId) as SpellCardDef}
            <span class="badge badge-secondary"
              >+ {spell?.name ?? "?"}
              {#if selectedSpellTarget}&nbsp;→ {selectedSpellTarget}{/if}</span
            >
          {/if}
        </div>
        {#if game.phase === "COMMIT"}
          <button
            class="btn btn-primary btn-sm mt-2 w-full"
            onclick={handleCommit}
            disabled={!canCommit || (needsSpellTarget && !selectedSpellTarget)}
          >
            🚀 Commit & Reveal
          </button>
        {:else if game.phase === "TURN_END"}
          <button class="btn btn-accent btn-sm mt-2 w-full" onclick={handleNextTurn}>
            ➡️ Next Turn (Draw 1 card each)
          </button>
        {:else if game.phase === "RESOLVING"}
          <div class="text-xs text-center text-base-content/50 mt-2">Resolving...</div>
        {/if}
      </div>
    {/if}
  </div>
</div>
