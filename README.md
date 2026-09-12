# WoW Workbook

A homebrew **talent tree creator** for World of Warcraft classes and specializations, in the style of the Wowhead talent calculator.

Two pages, one data file:

- **Talent Calculator** (`index.html`) — spend points in a tree: ranks, unlock rules, connection lines.
- **Talent Designer** (`designer.html`) — build that tree visually: drag & drop talents, connect them, edit names, descriptions, icons, ranks, node kinds and active-spell details, and create whole new classes and specs.

Everything is stored in `config/talent-project.json`, which both pages read.

## Run it

No build step, no dependencies. It does need a web server, because ES modules and `fetch()` do not work from `file://`:

```powershell
cd wow-workbook
python -m http.server 8000
```

Open <http://localhost:8000/>.

## Designing a tree

1. Open the **Talent Designer**.
2. Pick a class and spec, or create your own with **＋ Class** / **＋ Spec**.
3. Click an empty socket to create a talent, then edit it in the right-hand panel.
4. Drag talents to rearrange them; drag the gold dot from one talent onto another to connect them.
5. Changes autosave to your browser. Use **Export** to download the project, then replace `config/talent-project.json` and commit it to publish.

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
