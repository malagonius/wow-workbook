# Development Guide

How to keep building this app without breaking the parts that already work.

## Run it locally

ES modules and `fetch()` do not work from `file://`. Serve the folder:

```powershell
cd wow-workbook
python -m http.server 8000
```

Then open <http://localhost:8000/> (calculator) or <http://localhost:8000/designer.html> (designer).

> **Gotcha:** browsers cache ES modules aggressively. If a change does not appear, hard-reload (`Ctrl+Shift+R`) or restart the server on a different port. This costs more debugging time than any actual bug in this codebase.

There is no build, no bundler, no dependency install and no test runner.

## Where to make a change

| I want to… | Edit |
| --- | --- |
| Add a field to talents (cooldown, spell ID, resource cost…) | `talent-model.js` (`makeNode` + `normalizeNode`), then the designer's node form, then the renderer if it should be visible |
| Change how a talent looks | `css/talent-tree.css` and, if it needs new state, `getNodeState` in the consuming app |
| Change talent-spending rules | `talent-calculator.js` only |
| Add an editing gesture | `talent-tree-renderer.js` (emit a handler) + `talent-designer.js` (implement it) |
| Add a validation rule | `validateSection` in `talent-model.js` — both apps pick it up automatically |

## Conventions

- **Never draw a tree outside the renderer.** If the designer and calculator ever diverge visually, the architecture has been broken.
- **Never infer connections.** They are authored data.
- **Empty talent sockets are real nodes**, not `null`. A blank Lichborn slot is a deliberate placeholder with an ID.
- **Normalize on the way in.** Anything entering the app (fetch, import, JSON paste, undo snapshot) goes through `normalizeProject`, so the rest of the code can assume a complete object.
- **Editor logic stays out of game logic.** The designer manipulates data; the calculator interprets it. Neither hardcodes a class, spec or talent name.
- Keep new code in the existing plain-ES-module style. No framework, no dependencies.

## Adding a new node field, end to end

A worked example — adding `cooldown`:

1. `makeNode` — accept and default it (`cooldown = ''`).
2. `RESERVED_NODE_KEYS` — add `'cooldown'` so it is not duplicated into the extras spread.
3. `normalizeNode` — pass it through.
4. `designer.html` — add the input to the node form.
5. `talent-designer.js` — add the id to `TEXT_FIELDS` and read it in `applyNodeForm`.
6. `talent-tree-renderer.js` — only if it should appear on the node itself.
7. `docs/TALENT-PROJECT-FORMAT.md` — document it, and bump the version if old files need migrating.

## Manual test checklist

There are no automated tests, so run this before calling a change done.

**Calculator**

- [ ] Class and spec dropdowns populate; switching resets spent points.
- [ ] Row 0 talents are selectable; deeper talents stay locked until a parent is taken.
- [ ] Left-click spends a rank, right-click refunds; multi-rank talents count up.
- [ ] A talent cannot be refunded while a selected child depends only on it.
- [ ] Connection lines highlight between selected talents and survive a window resize.

**Designer**

- [ ] The tree renders with the same visuals as the calculator.
- [ ] Clicking a talent opens the editor; name, kind and rank changes appear immediately.
- [ ] Dragging a talent onto an empty socket moves it; dragging onto another talent swaps them.
- [ ] Dragging the gold dot onto another talent connects them; clicking the dot then a target does the same.
- [ ] Clicking a connection line deletes it.
- [ ] Changing columns/rows resizes the grid and warns before deleting talents that fall outside.
- [ ] Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`) covers moves, edits, deletes and structural changes.
- [ ] Creating a class then a spec produces four empty sections.
- [ ] Export → Import round-trips the project; Reset draft restores the repository baseline.

## Publishing changes to the repository data

The designer saves drafts to IndexedDB in the browser, not to disk. To make a tree part of the repository:

1. **Export** in the designer.
2. Replace `config/talent-project.json` with the downloaded file.
3. Commit.

## Roadmap

Tracked in [TALENT-DESIGNER-TODO.md](TALENT-DESIGNER-TODO.md). The highest-value next steps:

1. **Icon library** — a picker with real WoW-style icon assets instead of a free-text path.
2. **Gating** — Wowhead-style "spend N points to unlock the next block of rows".
3. **Multi-section designer view** — edit class/spec/hero side by side instead of one section at a time.
4. **Richer choice nodes** — per-option icons in the editor and a proper picker in the calculator.
5. **Build sharing** — encode spent talents into a URL so a build can be linked.
6. **Save to GitHub** — commit `talent-project.json` from the browser via a PR.
