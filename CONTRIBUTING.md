# Contributing to Inkora

Thank you for being here. 🎉 Inkora is built to be forked, hacked on, and improved — whether you're fixing a typo, squashing a bug, adding a word pack, or shipping a whole new feature, you're welcome.

This file is also the **full setup guide** — everything you need to run Inkora locally is below.

---

## Ways to contribute

- 🐛 **Report a bug** — open an [issue](../../issues) with steps to reproduce.
- 💡 **Suggest a feature** — open an issue describing the idea and why it's fun/useful.
- 📝 **Add a word pack** — extend or add languages in `server/src/data/words/`.
- 🔧 **Send a pull request** — grab something from the [roadmap](#roadmap) or scratch your own itch.

---

## Running it locally

### Prerequisites
- **Node.js 20+** and npm
- _(Optional)_ a free [Supabase](https://supabase.com) project — only for accounts & the leaderboard. The game is fully playable without it.

### Setup

```bash
git clone https://github.com/<your-username>/inkora.git
cd inkora
npm install            # installs all workspaces and builds the shared package
cp .env.example .env   # defaults work out of the box for local play
npm run dev            # starts client + server together
```

- Client → **http://localhost:5173**
- Server → **http://localhost:3001**

Open the client in **two browser tabs** (or share over your LAN / a tunnel) to play multiplayer — it's a real-time game, so a single tab can't play alone. Your browser asks for **microphone permission** when you enter a room; that's the in-room voice chat (it stays off until you turn it on).

> **Note:** `shared/` is compiled by `npm install` (via a `postinstall` step) because both `client` and `server` import its types & constants. If you ever pull changes to `shared/`, rebuild it with `npm run build --workspace=shared`.

### Production build

```bash
npm run build                  # builds shared → client → server
npm start --workspace=server   # serves the API / socket server
```

### Tests

```bash
npm test                       # runs the server unit tests (guess checker, scoring)
```

Tests use Node's built-in test runner (no extra tooling). New logic in `server/src/game/` is a great place to add coverage — drop a `*.test.ts` next to the file.

---

## Project layout

This is an **npm workspaces** monorepo with three packages:

```
inkora/
├── client/          # Vite + React frontend
│   └── src/
│       ├── components/   # Canvas, Chat, Game UI (voice, sound, timer…)
│       ├── pages/        # Home, Lobby, Game, Leaderboard
│       ├── hooks/        # useRoom, usePlayer, useVoice, useDrawingSync
│       ├── context/      # Socket, Drawing, Auth
│       └── services/     # VoiceManager, sounds
├── server/          # Node + Express + Socket.io backend
│   └── src/
│       ├── socket/       # event handlers (the heart of the game)
│       ├── game/         # GameManager, guess checker, scoring, word lists
│       └── rooms/        # Room / Player / RoomManager
├── shared/          # Types & constants imported by both client & server
└── supabase/        # Database schema (optional)
```

When you change a type in `shared/`, both client and server pick it up — keep cross-cutting contracts there.

---

## Configuration

Gameplay defaults live in [`shared/types/game.ts`](shared/types/game.ts):

| Setting | Default | Range |
|---|---|---|
| Players per room | 8 | 2–10 |
| Rounds | 3 | 1–10 |
| Drawing time | 80s | 30–180s |
| Words per turn | 3 | 1–5 |
| Word-choice timeout | 30s | — |
| Room code | 4 digits | — |

Environment variables are documented in [`.env.example`](.env.example). Voice chat uses the public PeerJS cloud by default, so there's nothing to configure for it.

**Leaderboard (optional):** create a free Supabase project, fill the `SUPABASE_*` / `VITE_SUPABASE_*` keys in `.env`, and run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor to create the `profiles` and `game_history` tables and the `leaderboard` view. Without it, the game runs anonymously and the leaderboard is simply hidden.

---

## Before you open a PR

1. **Branch** off `main`: `git checkout -b feat/short-description`
2. **Build cleanly**: `npm run build` passes with no type errors.
3. **Lint**: `npm run lint` is clean.
4. **Test**: `npm test` is green (add a test if you changed game logic).
5. **Play-test** the flow you touched with at least two browser tabs.
6. **Keep it focused** — one logical change per PR is easier to review.

### Commit & PR style
- Clear, imperative commit messages (e.g. `fix: prevent duplicate player on reconnect`).
- In the PR, explain **what** changed and **why**, and add screenshots/GIFs for any UI change.
- Link the issue your PR closes (`Closes #123`).

### Code style
- TypeScript everywhere — prefer explicit types on public boundaries.
- Match the surrounding code's conventions (naming, formatting, file layout).
- Keep components small and hooks focused.

---

## Adding a word pack

1. Add a JSON array of words under `server/src/data/words/`.
2. Wire it into the word-selection logic in `server/src/game/`.
3. Mention the new language in your PR so it can be documented.

---

## Roadmap

**Planned for the next release:**

- [ ] **Quick Play / public rooms** — make a room public and let anyone jump straight into a random open game (including games already in progress).

Other ideas — great first contributions:

- [ ] More languages & community word packs
- [ ] Emoji reactions on the canvas
- [ ] Replay & shareable round highlights
- [ ] Mobile gesture polish & on-device testing
- [ ] Self-hosted PeerJS option for voice

Have an idea? [Open an issue](../../issues) — this project is built to be forked and extended.

---

## Questions?

Open a [discussion or issue](../../issues) — happy to help you get started. And if Inkora is useful to you, a ⭐ goes a long way.

Happy drawing! 🎨
