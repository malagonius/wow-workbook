# Talent Designer — Implementation Status

What the Talent Designer can do today. For *how* it is built see [ARCHITECTURE.md](ARCHITECTURE.md); for *how to work on it* see [DEVELOPMENT.md](DEVELOPMENT.md).

## Files

- `designer.html` — the designer page.
- `js/talent-designer.js` — editing logic, history, persistence.
- `js/talent-tree-renderer.js` — shared renderer, also used by the calculator.
- `js/talent-model.js` — canonical schema, construction and validation.
- `js/supabase-storage.js` — public database reads, authentication, ownership,
  revision-aware transactional saves and class copying.
- `js/talent-designer-storage.js` — legacy browser-draft migration and optional file import/export.
- `css/talent-tree.css`, `css/talent-designer.css` — tree visuals and designer chrome.

## Capabilities

**Database and accounts**

- Everyone can view saved classes; email/password sign-in is required to create.
- Only the owner can edit/delete a class, including its specs, talents and abilities.
- Duplicate public classes into your own uniquely named, editable copies.
- Edits autosave to Supabase; files are optional backups, not a publishing step.
- One-time import of bundled classes and legacy browser drafts.
- Explicit save/retry/error status, stale-write protection, atomic multi-class
  saves, reload from database, and a warning before leaving with unsaved changes.
- Authentication tokens live only in memory; sign in again after reloading.

**Content**

- Create, rename, duplicate and delete classes and specializations.
- A new spec is scaffolded with empty Class, Spec, Apex and Hero sections.
- Add, rename, retype and delete sections; set max points, columns and rows.

**Talents**

- Click an empty socket to create a talent there; click a talent to edit it.
- Edit name, description, icon, kind, max rank, grid position and node ID.
- Active abilities expose cost, range, charges, cast time and cooldown fields; both the Designer and Calculator show them in the shared talent tooltip.
- Kinds follow the WoW convention: `active` (square), `passive` (circle), `choice` (octagon with two options).
- Max rank drives the `0/N` badge that the calculator then fills in.
- Duplicate, clear and delete talents; `Delete` key works on the selected talent.
- Clear every talent and connection from the current section in one undoable action.

**Layout and connections**

- Drag a talent onto an empty socket to move it, or onto another talent to swap them.
- Drag the gold dot onto another talent or an empty socket to connect them, or click the dot and then the target. Empty targets are created and selected automatically.
- Click a connection line to delete it, or remove it from the connection list.
- Connections are stored on the section and are never inferred.

**Safety and data**

- Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`) across every change, with text edits grouped per field.
- Live validation: duplicate IDs, overlapping positions, out-of-grid nodes, invalid ranks, broken or circular connections, unreachable nodes, impossible point totals.
- Autosave to Supabase, optional backup export/import, Reload database and a full JSON view with Apply (owner-only changes).

## Current limitations

- Only one section is edited at a time.
- Icons are entered as a path or a glyph; there is no icon browser.
- Validation runs on the current section, not the whole project at once.
- Initial Supabase setup and a first sign-in/import are required; subsequent saves publish automatically.
- Renaming and some spec operations still use browser `prompt`/`confirm` dialogs; class creation and duplication use styled dialogs.
