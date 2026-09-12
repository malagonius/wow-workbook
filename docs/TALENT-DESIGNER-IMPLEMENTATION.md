# Talent Designer — Implementation Status

What the Talent Designer can do today. For *how* it is built see [ARCHITECTURE.md](ARCHITECTURE.md); for *how to work on it* see [DEVELOPMENT.md](DEVELOPMENT.md).

## Files

- `designer.html` — the designer page.
- `js/talent-designer.js` — editing logic, history, persistence.
- `js/talent-tree-renderer.js` — shared renderer, also used by the calculator.
- `js/talent-model.js` — canonical schema, construction and validation.
- `js/talent-designer-storage.js` — IndexedDB drafts, import/export.
- `css/talent-tree.css`, `css/talent-designer.css` — tree visuals and designer chrome.

## Capabilities

**Content**

- Create, rename, duplicate and delete classes and specializations.
- A new spec is scaffolded with empty Class, Spec, Apex and Hero sections.
- Add, rename, retype and delete sections; set max points, columns and rows.

**Talents**

- Click an empty socket to create a talent there; click a talent to edit it.
- Edit name, description, icon, kind, max rank, grid position and node ID.
- Kinds follow the WoW convention: `active` (square), `passive` (circle), `choice` (octagon with two options).
- Max rank drives the `0/N` badge that the calculator then fills in.
- Duplicate, clear and delete talents; `Delete` key works on the selected talent.

**Layout and connections**

- Drag a talent onto an empty socket to move it, or onto another talent to swap them.
- Drag the gold dot onto another talent to connect them, or click the dot and then the target.
- Click a connection line to delete it, or remove it from the connection list.
- Connections are stored on the section and are never inferred.

**Safety and data**

- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`) across every change, with text edits grouped per field.
- Live validation: duplicate IDs, overlapping positions, out-of-grid nodes, invalid ranks, broken or circular connections, unreachable nodes, impossible point totals.
- Autosave to IndexedDB, plus Export, Import, Reset draft and a full JSON view with Apply.

## Current limitations

- Only one section is edited at a time.
- Icons are entered as a path or a glyph; there is no icon browser.
- Validation runs on the current section, not the whole project at once.
- Publishing is manual: export, replace `config/talent-project.json`, commit.
- Renaming and duplicating use browser `prompt`/`confirm` dialogs rather than styled ones.

