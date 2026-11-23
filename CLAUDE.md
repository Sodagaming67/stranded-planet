# Stranded Planet — Project Rules for Claude

## The game
3D browser game. The player crash-landed their spaceship on a tiny round planet with a small town.
They must make money to survive (food, oxygen, rent) and eventually repair the ship.
Full design notes: `docs/game-plan.md`.

## Tech
- Three.js + Vite, plain JavaScript (no TypeScript, no frameworks).
- Run with `npm run dev` (port 5180 — port 5173 is reserved for Chore Pool).
- Low-poly, flat-shaded look. Make shapes in code where possible.

## Free tools only
- Only free tools, libraries, and assets. No paid APIs, no API keys, no paid AI services.
- Downloaded art/sound must be CC0 or free-for-any-use (e.g. Kenney.nl, Quaternius, Poly Pizza CC0). Note the source in `docs/credits.md`.

## Commits
- Local git only (no GitHub remote). Do not push.
- No `Co-Authored-By:` trailer. Git username: Sodagaming67.
- Commit after each finished step so long unattended work is saved in pieces.

## Working unattended
The user may send big requests before school and check after. For big requests:
1. Break it into steps, finish and commit each before the next.
2. Keep `docs/PROGRESS.md` updated: done, untested, and what the user should test.

## Communication
- User is a beginner — plain language, no jargon, short answers.
