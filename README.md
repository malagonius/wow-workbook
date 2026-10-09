# WoW Workbook

A homebrew **talent tree creator** for World of Warcraft classes and specializations, in the style of the Wowhead talent calculator.

Two pages, one shared talent model:

- **Talent Calculator** (`index.html`) — spend points in a tree: ranks, unlock rules, connection lines.
- **Talent Designer** (`designer.html`) — build that tree visually: drag & drop talents, connect them, edit names, descriptions, icons, ranks, node kinds and active-spell details, and create whole new classes and specs.

Both pages load the same small [configuration manifest](config/talent-project.json), which references:

- [Shared hero talents](config/hero-talent.json), stored once per distinct hero tree.
- Class talent files under `config/class/`, shared by every configured spec of that class.
- Specialization files under `config/spec/<class>/<spec>.json`, containing spec and Apex sections plus references to the shared talents.

Class-qualified folders avoid collisions such as Mage/Frost and Death Knight/Frost. Unfinished specializations have explicit `available: false` placeholder files rather than invented talents.

## Run it

No build step, no dependencies. It does need a web server, because ES modules and `fetch()` do not work from `file://`:

```powershell
cd wow-workbook
python -m http.server 8000
```

Open <http://localhost:8000/>. Alternatively, Node 22+ users can run `npm start` and open <http://127.0.0.1:8123/>.

## Designing a tree

1. Open the **Talent Designer**.
2. Pick a class and spec, or create your own with **＋ Class** / **＋ Spec**.
3. Click an empty socket to create a talent, then edit it in the right-hand panel.
4. Drag talents to rearrange them; drag the gold dot from one talent onto another to connect them.
5. Changes autosave to your browser. **Export class** downloads only the selected class (all its specs, shared class talents and referenced hero talents). Importing updates only the classes in that file; other classes are preserved.
6. To publish the downloaded class, run `node scripts/migrate-talent-config.mjs --import /path/to/class-talents.json`, then commit the changed configuration files. Do not replace the manifest with a class export.

## Configuration maintenance

Node 22+ is needed only for developer validation/migration, not to run the static site. No npm dependencies are needed.

- `npm test` — regression tests for loading, sharing, migration and class exports.
- `npm run check:talents` — validate that every referenced file and shared section resolves.
- `npm run migrate:talents` — split a legacy whole-project file, or rewrite the existing scaffold deterministically.

GitHub Actions runs migration and tests. On trusted pushes it commits any generated configuration changes back to the same branch. Both apps still accept old whole-project files and local drafts.

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is put together and why |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | How to continue developing it: conventions, recipes, test checklist |
| [docs/TALENT-PROJECT-FORMAT.md](docs/TALENT-PROJECT-FORMAT.md) | The canonical JSON schema |
| [docs/TALENT-DESIGNER-TODO.md](docs/TALENT-DESIGNER-TODO.md) | Roadmap and status |
| [docs/TALENT-DESIGNER-IMPLEMENTATION.md](docs/TALENT-DESIGNER-IMPLEMENTATION.md) | What the designer can do today |

## Design workbook: Lichborn

`lichborn/` holds the design notes for a fourth Death Knight specialization built around **dominion, inevitability, and the progressive loss of enemy agency**.

> The longer the fight goes, the more inevitable your victory feels.

The player should feel like **Arthas / the next Lich King**: a slow, methodical juggernaut who progressively establishes Death's claim over an enemy. The core is **dominating the enemy**, not building an army — undead and other battlefield consequences are by-products of that domination.

These notes are maintained during brainstorming rather than turned into a giant design document immediately:

1. Ask one focused design question.
2. Record the answer and the reasoning.
3. Freeze decisions only when explicitly agreed.
4. Keep unresolved ideas clearly marked as open.
5. Move to the next high-impact question.
