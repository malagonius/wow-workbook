# WoW Workbook

A homebrew **talent tree creator** for World of Warcraft classes and specializations, in the style of the Wowhead talent calculator.

Two pages, one shared talent model:

- **Talent Calculator** (`index.html`) — spend points in a tree: ranks, unlock rules, connection lines.
- **Talent Designer** (`designer.html`) — build that tree visually: drag & drop talents, connect them, edit names, descriptions, icons, ranks, node kinds and active-spell details, and create whole new classes and specs.

Both pages load the same small [configuration manifest](config/talent-project.json), which references:

- **One self-contained JSON file per class** under `config/class/`, such as `death-knight-talents.json` or `thinker-talents.json`.
- Each file contains the class's spec registry, class talents, every configured specialization, hero talents, Apex sections, and class/spec abilities.
- Shared class and hero talents are stored once **inside that class file**, never in a separate global file.

Unfinished specializations remain listed in the class file's `content` registry without invented talent trees. The manifest indexes class filenames only: changing a class's specs does not require changing the manifest.

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
5. Talent and ability changes autosave together to your browser. **Export class** downloads all data for the selected class. Importing replaces only the classes in that file; other classes are preserved.
6. **Replace the matching file in `config/class/` with the download**, then commit that file. For example, replace `config/class/thinker-talents.json` with the exported `thinker-talents.json`. No splitting or migration is needed. Do not replace the manifest with a class export.
7. For a brand-new class, place its export in `config/class/` and add its name/path to the manifest's `classFiles` registry. Alternatively, the import maintenance command below does this automatically.

Browser autosave is a local draft, not a write to repository files. If a previously saved draft is showing old data after replacing a class file, use **Reset draft** to reload the repository baseline (this discards local edits).

## Configuration maintenance

Node 22+ is needed only for developer validation/migration, not to run the static site. No npm dependencies are needed.

- `npm test` — regression tests for loading, sharing, migration and class exports.
- `npm run check:talents` — validate that every referenced file and shared section resolves.
- `npm run migrate:talents` — consolidate legacy split/whole-project data into one file per class, or rewrite the current layout deterministically.
- `node scripts/migrate-talent-config.mjs --import /path/to/class-talents.json` — optional automated publishing; merge an export and update the class index, including new classes.

Migration and validation run locally; commit the resulting files when ready. Migration removes obsolete legacy class/spec/hero/ability JSON only after writing the new files and manifest. Old whole-project files, split manifests and browser drafts remain supported; old separate browser ability edits are migrated into the project draft.

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
