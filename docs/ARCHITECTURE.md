# Architecture

WoW Workbook is a **static frontend**: plain HTML, CSS and ES modules, with
Supabase providing PostgreSQL persistence and email/password authentication.
There is no build step, framework, or application server.

## The one rule

> **One owned JSONB document per class in Supabase is the single source of truth,
> and both apps render its resolved model through the same renderer.**

Everything else follows from that. The Calculator does not own a tree format, the Designer does not own a second one, and neither draws talents its own way.

```text
              Supabase workbook_classes (owner + revision + JSONB)
                              │
                      supabase-storage.js      ← auth · public reads · versioned saves
                              │
                      talent-config.js         ← validate · split · compact · merge
                              │
                      talent-model.js          ← normalize · validate · construct
                              │
                 ┌────────────┴────────────┐
                 │                         │
        talent-calculator.js       talent-designer.js
          (spend points)              (edit the data)
                 │                         │
                 └────────────┬────────────┘
                              │
                   talent-tree-renderer.js     ← the only code that draws a tree
```

## Modules

| File | Responsibility |
| --- | --- |
| `js/supabase-storage.js` | Supabase REST/Auth client, paginated public reads, in-memory auth session/refresh, class copying, changed-class saves, ownership checks and revision tracking. Injectable fetch, no DOM or runtime dependencies. |
| `js/talent-config.js` | Loads bundled class files for explicit import, validates self-contained classes, serializes shared references, scopes exports, merges imports and generates bundled files. Legacy split manifests remain readable. Pure data plus injectable fetching, no DOM. |
| `js/talent-model.js` | The schema. Normalizes any supported input into the canonical shape, constructs nodes/sections/trees, and validates them. Pure data — no DOM. |
| `js/talent-tree-renderer.js` | The only module that turns a section into DOM. Draws the grid, the nodes, the SVG connection lines, and wires interaction callbacks. Has no opinion about game rules. |
| `js/talent-calculator.js` | Interprets a tree as a playable talent calculator: point spending, ranks, unlock rules, spellbook modal. |
| `js/talent-designer.js` | Edits the project: node CRUD, drag & drop, connections, sections, classes/specs, undo/redo, import/export. |
| `js/talent-designer-storage.js` | Legacy IndexedDB draft access for explicit migration, plus optional file import/export. Its local write helpers remain only for backward compatibility/tests; the live Designer never calls them. |
| `js/ability-designer.js` | Ability editor connected to the Designer project through callbacks; shares its autosave, history and class export. |
| `js/app-navigation.js` | Shared page header. |

### Stylesheets

| File | Responsibility |
| --- | --- |
| `css/talent-calculator.css` | Base theme: colours, layout, the `.node` / `.talent-section` look. |
| `css/talent-tree.css` | Shared tree refinements: data-driven grid width, node shapes, icons, rank badges, designer drag affordances. Loaded **after** the base theme by both pages. |
| `css/talent-designer.css` | Designer-only chrome: toolbar, side panel, dialogs. |

## Rendering contract

`renderSections(container, sections, options)` builds the DOM; `layoutConnections(container)` positions the SVG lines afterwards (and again on resize, because line endpoints are measured from real element boxes).

The renderer is deliberately dumb. It asks the caller for anything it cannot know:

| Option | Purpose |
| --- | --- |
| `mode` | `'calculator'` (read-only, locked nodes disabled) or `'designer'` (sockets, dragging, connect handles). |
| `getNodeState(section, node)` | Returns `{ rank, selected, available, partial, choiceIndex, title }`. This is where game rules live — the renderer just applies classes. |
| `getSectionSummary(section)` | Text for the section header's right-hand side. |
| `handlers` | `onNodeClick`, `onNodeAlt`, `onSocketClick`, `onNodeMove`, `onNodeSwap`, `onConnect`, `onHandleClick`, `onEdgeClick`. |
| `selectedNodeId` / `connectSourceId` | Designer highlighting. |

If you need a new visual state, add it to `getNodeState` rather than branching on class names or spec names inside the renderer.

## Layout model

Talents live on a **row/column grid**, not on free x/y coordinates. Rows and columns give responsive layouts, predictable structure and simple validation for free.

- `section.columns` — declared grid width (minimum and default: 7).
- `section.rowCount` — declared grid height, so a section can contain empty rows.
- Both are floors: if a node sits beyond them, the grid grows to fit rather than hiding the node.
- The CSS grid reads the width from a `--cols` custom property set on `.tree-graph`.

Any cell without a node renders as a socket: inert in the calculator, a click-to-create drop target in the designer. Dropping a connection handle on one creates the target node and connection together.

## Connections

Connections are **explicit data** stored on the section that owns them:

```json
{ "from": "spec-0-0", "to": "spec-1-0" }
```

They are never inferred from proximity. The calculator's unlock rule reads them directly: a node is available if it is on row 0, or if any node connecting *into* it has at least one rank spent.

## Undo/redo

The designer snapshots the whole project as compact v6 JSON, with shared sections stored once. Normalizing a snapshot restores shared object identity, so class edits still propagate after undo/redo or a reload. Structural changes go through `mutate()`, which pushes the pre-change snapshot. Text fields use `beginEdit()` on focus and `commitEdit()` on change, so a sentence typed into a description is one undo step rather than forty.

## Shared talents

All configured specializations of a class point to the same class section object. Existing specs without a class section inherit it. Identical hero sections within a class are stored once and linked by references; different hero trees remain separate. Spec and Apex sections are always specialization-local. Deleting a shared section removes it from every tree that uses it; duplicating a spec keeps shared class/hero references while cloning spec/Apex sections.

Export and the JSON dialog contain only the selected class. Import merges the included classes, replacing their complete spec registry while leaving all other classes unchanged. Drafts and history still cover the entire workspace.

Class/spec abilities live in the project's `abilities` registry and are scoped
into the same class document. The Calculator reads them from Supabase, not a
separate global registry or browser-only overlay. Explicit browser-draft import
also merges the old separate ability draft, without deleting the old backup.

## Persistence and ownership

The database migration in `supabase/migrations/` defines public reads and
authenticated owner-only writes using RLS. A class owns all of its specs,
abilities and shared sections. The UI disables editing other owners' classes;
duplicating a class remaps its names, tree keys, shared references and abilities.
Class names are globally unique. The database validates that nested data cannot
impersonate another class, and a trigger prevents ownership transfers.

The Designer debounces edits and serializes save requests. Each request sends
only changed classes with their last-read revision to `save_workbook_classes`.
PostgreSQL applies the batch atomically and rejects stale revisions. Failed
saves leave the committed snapshot unchanged and display an error; there is no
automatic local-storage fallback. Unsaved changes trigger a leave-page warning.

Auth access/refresh tokens stay in memory only. They refresh during an open
tab's lifetime; reloading requires signing in again, but anonymous reads keep
working. The public publishable key in `config/supabase.json` is not an admin
credential. Schema installation is an explicit operator setup step; browser
clients cannot install tables or bypass RLS.

## Known constraints

- Editing a node's text patches the tree label in place (`patchSelectedNode`) instead of re-rendering, otherwise the input would lose focus on every keystroke.
- Both pages read the database on load. Existing open Calculator tabs need a
  reload to see new saves; realtime subscriptions are not implemented.
- The Designer's unsaved work is in memory until the database acknowledges it.
  Offline editing is not a durable workflow; retry the save or export a backup.
- `normalizeProject` still accepts the legacy v1/v2 shapes, so old exports keep working.
