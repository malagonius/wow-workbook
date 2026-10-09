# Architecture

WoW Workbook is a **static site**: plain HTML, CSS and ES modules. There is no build step, no framework and no backend. Open the files through a local web server and they run.

## The one rule

> **One self-contained JSON per class is the single source of truth, and both apps render its resolved model through the same renderer.**

Everything else follows from that. The Calculator does not own a tree format, the Designer does not own a second one, and neither draws talents its own way.

```text
              class index + one complete JSON per class
                              │
                      talent-config.js         ← fetch · split · compact · merge
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
| `js/talent-config.js` | Loads the class index and self-contained class files, serializes shared references, scopes exports to a class, merges class imports and generates repository files. Legacy split manifests remain readable. Pure data plus injectable fetching — no DOM. |
| `js/talent-model.js` | The schema. Normalizes any supported input into the canonical shape, constructs nodes/sections/trees, and validates them. Pure data — no DOM. |
| `js/talent-tree-renderer.js` | The only module that turns a section into DOM. Draws the grid, the nodes, the SVG connection lines, and wires interaction callbacks. Has no opinion about game rules. |
| `js/talent-calculator.js` | Interprets a tree as a playable talent calculator: point spending, ranks, unlock rules, spellbook modal. |
| `js/talent-designer.js` | Edits the project: node CRUD, drag & drop, connections, sections, classes/specs, undo/redo, import/export. |
| `js/talent-designer-storage.js` | IndexedDB draft persistence plus file import/export. |
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

Class/spec abilities live in the project's `abilities` registry and are scoped into the same class files. The Calculator reads published abilities from these files, not a separate global registry or browser-only overlay. The Designer migrates the old separate ability draft into IndexedDB once, preserving edits.

## Known constraints

- Editing a node's text patches the tree label in place (`patchSelectedNode`) instead of re-rendering, otherwise the input would lose focus on every keystroke.
- The designer autosaves to IndexedDB. Publish by replacing the matching class JSON with its export; the maintenance script is optional for imports/new classes and legacy migration. Browser autosave never writes repository files.
- `normalizeProject` still accepts the legacy v1/v2 shapes, so old exports keep working.
