# Talent Designer — TODO & Architecture Plan

## Goal

Build a visual **Talent Designer** for WoW Workbook so talent trees can be created and edited through the interface instead of manually editing JSON.

The designer should not become a second, separate data system. The **JSON remains the single source of truth**, and the designer is a visual editor for that data.

The long-term idea is to make `wow-workbook` more than a static talent calculator: it should become a **WoW homebrew talent-tree authoring tool**.

---

## Core principle: JSON is the source of truth

The architecture should eventually look like:

```text
                 ┌── Calculator
                 │
JSON ←───────────┼── Designer
                 │
                 └── JSON Editor
```

The calculator and designer should consume the same underlying tree model. A tree created in the designer must behave exactly like a manually authored tree.

Do **not** build a separate designer-only representation and then invent a fragile conversion layer later.

---

# Phase 1 — Define an editor-friendly data model

Before building the designer UI, make the JSON schema clean and expressive enough to be edited safely.

- [ ] Define a stable `TalentTree` schema.
- [ ] Define a stable `Section` schema.
  - Class
  - Spec
  - Apex
  - Hero
- [ ] Define a stable `TalentNode` schema.
  - ID
  - name
  - description
  - icon
  - row/position
  - type
  - optional spell reference
  - optional cost/requirements
- [ ] Define a connection schema.
  - `from`
  - `to`
- [ ] Define tree metadata.
  - class
  - spec
  - max points
  - description
  - other metadata as needed
- [ ] Make empty nodes first-class objects rather than relying on magic `""` values.
- [ ] Decide which fields are required and which are optional.
- [ ] Add a schema/version field if useful for future migrations.

Example node direction:

```json
{
  "id": "spec-2-1",
  "name": "Death's Grasp",
  "description": "Pull the target toward you.",
  "icon": "icons/deaths-grasp.png",
  "row": 2,
  "column": 1
}
```

Example connection direction:

```json
{
  "from": "spec-1-1",
  "to": "spec-2-1"
}
```

The exact schema is still open for design. Do not prematurely lock it down before checking how existing trees fit into it.

---

# Phase 2 — Build the Designer shell

Add a dedicated designer page, likely:

```text
/designer.html
```

Initial layout idea:

```text
┌─────────────────────────────────────────────┐
│ WOW WORKBOOK — TALENT DESIGNER              │
├───────────────┬─────────────────────────────┤
│               │                             │
│  TREE CONFIG  │                             │
│               │        TALENT TREE          │
│ Class         │                             │
│ [Death Knight]│          ○                  │
│               │         / \                 │
│ Spec          │        ○   ○                │
│ [Lichborn]    │         |   \               │
│               │        ○    ○               │
│ Section       │                             │
│ [Spec ▼]      │                             │
│               │                             │
├───────────────┴─────────────────────────────┤
│ Selected Node                                │
│ Name: [________________]                     │
│ Description: [______________]               │
│ Icon: [____________________]                 │
│                                             │
│ [Delete] [Duplicate] [Save]                 │
└─────────────────────────────────────────────┘
```

Requirements:

- [ ] Reuse the existing calculator tree renderer.
- [ ] Do not create a visually separate implementation of the talent tree.
- [ ] Support desktop and mobile layouts.
- [ ] Allow choosing the tree/class/spec being edited.
- [ ] Allow choosing the section being edited.
- [ ] Show the current JSON-backed tree visually.

---

# Phase 3 — Node creation and editing

Clicking an empty or existing node should open an editor.

Example:

```text
┌──────────────────────────────┐
│ Talent                       │
├──────────────────────────────┤
│ ID                           │
│ [spec-2-1____________]       │
│                              │
│ Name                         │
│ [Death's Grasp_______]       │
│                              │
│ Description                  │
│ [Pull the target toward...]  │
│                              │
│ Icon                         │
│ [____________________]       │
│                              │
│ [Save]                       │
└──────────────────────────────┘
```

- [ ] Select a node.
- [ ] Edit node ID.
- [ ] Edit name.
- [ ] Edit description.
- [ ] Edit icon/reference.
- [ ] Edit node type where applicable.
- [ ] Edit cost/requirements where applicable.
- [ ] Save changes into the in-memory JSON model.
- [ ] Immediately reflect changes in the tree renderer.
- [ ] Preserve empty selectable nodes as valid nodes.

---

# Phase 4 — Connecting nodes

This is one of the most important designer features.

The designer should allow connections to be created without manually editing JSON.

Initial interaction:

1. Select node A.
2. Choose **Connect**.
3. Select node B.
4. The connection appears visually.
5. The JSON model is updated.

Example:

```text
      [A]
       │
       ▼
      [B]
      / \
     ▼   ▼
   [C] [D]
```

becomes conceptually:

```json
"connections": [
  ["A", "B"],
  ["B", "C"],
  ["B", "D"]
]
```

Later interaction could support:

- [ ] Click-to-connect.
- [ ] Drag from one node to another.
- [ ] Remove an existing connection.
- [ ] Highlight the connection currently being edited.
- [ ] Prevent duplicate connections.
- [ ] Validate that connections reference existing nodes.
- [ ] Prevent invalid/circular connections where the tree model disallows them.

The **JSON connection data remains authoritative**. Do not return to JavaScript-generated nearest-neighbor connections.

---

# Phase 5 — Visual node positioning

Current tree architecture uses rows/columns. This should initially remain the default.

Possible representation:

```json
{
  "id": "spec-2-1",
  "position": {
    "row": 2,
    "column": 1
  }
}
```

Do **not** immediately switch to arbitrary X/Y coordinates.

Rows and columns provide:

- responsive layouts
- predictable tree structure
- simpler validation
- easier mobile rendering
- easier JSON
- easier connection handling

Future possibility:

```json
"position": {
  "x": 420,
  "y": 260
}
```

Free-form positioning can be added later if the WoW-style layout actually needs it.

Designer requirements:

- [ ] Move a node between columns.
- [ ] Move a node between rows where valid.
- [ ] Add rows.
- [ ] Remove rows.
- [ ] Keep the renderer and connection system synchronized after movement.
- [ ] Preserve position data in JSON.

---

# Phase 6 — Tree management

The designer should eventually be capable of creating an entire tree without manually touching JSON.

- [ ] Create a new tree.
- [ ] Delete a tree.
- [ ] Duplicate a tree.
- [ ] Rename a tree.
- [ ] Edit tree description.
- [ ] Add a section.
- [ ] Delete a section.
- [ ] Rename a section.
- [ ] Add rows.
- [ ] Delete rows.
- [ ] Add nodes.
- [ ] Delete nodes.
- [ ] Duplicate nodes.
- [ ] Move nodes.
- [ ] Connect nodes.
- [ ] Disconnect nodes.

Target mental model:

```text
Death Knight
 └── Lichborn
      ├── Spec
      ├── Apex
      └── Hero Talents
```

A user should eventually be able to create and modify this entirely through the designer.

---

# Phase 7 — JSON preview and editing

Add a dedicated **`<> JSON`** view.

The designer should be able to show the exact JSON it is producing.

Features:

- [ ] Formatted JSON display.
- [ ] Syntax highlighting if practical.
- [ ] Copy JSON button.
- [ ] Download/export JSON.
- [ ] Show the relevant tree JSON.
- [ ] Optional full configuration JSON.
- [ ] Allow manually editing JSON.
- [ ] Add an **Apply JSON** action.
- [ ] Re-render the designer after valid JSON is applied.

Long-term goal:

```text
Visual Designer ↔ JSON Editor
```

Both should manipulate the same underlying model.

---

# Phase 8 — Validation

Once the designer becomes powerful, validation becomes essential.

Before export/save, validate:

- [ ] All node IDs are unique.
- [ ] All connection source IDs exist.
- [ ] All connection target IDs exist.
- [ ] No invalid/circular connections.
- [ ] No broken references.
- [ ] Required sections exist.
- [ ] Max point values are valid.
- [ ] Node positions are valid.
- [ ] Empty nodes are allowed where intentionally configured.
- [ ] Required tree metadata exists.

Example successful validation:

```text
✓ Tree is valid

✓ All node IDs are unique
✓ All connections reference existing nodes
✓ No orphaned nodes
✓ No circular connections
✓ Max points valid
✓ All required sections exist
```

Example warning state:

```text
⚠ Node spec-4-2 has no incoming connection
⚠ Hero section contains 15 nodes but max points is 13
```

Validation should distinguish between **errors** that make the tree invalid and **warnings** that may be intentional.

---

# Phase 9 — Save and export

Initial implementation should be local/client-side and simple.

```text
Designer
   ↓
JavaScript object
   ↓
JSON
   ↓
Download
```

Features:

- [ ] Export tree JSON.
- [ ] Export connection JSON if kept separate.
- [ ] Import JSON.
- [ ] Local draft/autosave if useful.
- [ ] Reset/revert changes.

Long-term GitHub integration:

```text
Designer
   ↓
JSON
   ↓
GitHub
   ↓
config/talent-trees.json
config/talent-connections.json
```

Potential future feature:

- [ ] **Save to GitHub** button.
- [ ] Create/update configuration files through GitHub.
- [ ] Commit changes with a meaningful commit message.
- [ ] Optionally create a branch or pull request rather than directly changing the default branch.

This should be considered a later phase, not a requirement for the first designer.

---

# Recommended implementation order

Do not attempt the entire designer in one change.

```text
1. Clean up JSON schema
        ↓
2. Refactor calculator around that schema
        ↓
3. Extract reusable Tree Renderer
        ↓
4. Create designer.html
        ↓
5. Select/edit node
        ↓
6. Create/delete nodes
        ↓
7. Connect/disconnect nodes
        ↓
8. Move nodes
        ↓
9. JSON preview/export
        ↓
10. Validation
        ↓
11. Import JSON
        ↓
12. GitHub save
```

Each phase should ideally remain independently usable and testable.

---

# Important architectural constraints

## 1. Keep connections data-driven

Connections must be explicitly stored in JSON.

Do **not** restore the previous JavaScript behavior where connections were inferred from nearest nodes/grid proximity.

The designer exists partly to make those explicit connections easy to author.

## 2. Reuse the calculator renderer

The designer should use the same visual tree rendering logic as the calculator whenever possible.

Avoid maintaining two separate tree-rendering implementations.

## 3. Preserve the current WoW-style visual direction

The existing polished visual design should remain the basis:

- dark WoW-like background
- talent icons/nodes
- connection lines
- section styling
- glow/selection states
- locked/available states
- mobile responsiveness

The designer should feel like an extension of the existing calculator, not a generic admin panel.

## 4. Empty nodes are legitimate

The Lichborn prototype intentionally contains empty selectable sockets.

The designer must support these as real nodes/placeholders rather than treating them as missing data.

## 5. Keep game logic separate from editor logic

The designer should manipulate the tree model, while the calculator interprets that model.

The editor should not hardcode special behavior for Lichborn, Death Knight, or individual talents.

---

# Future ideas / nice-to-have features

These are intentionally not part of the initial implementation, but fit the long-term vision.

- [ ] Drag-and-drop node creation.
- [ ] Drag-to-connect nodes.
- [ ] Multi-select nodes.
- [ ] Copy/paste nodes.
- [ ] Undo/redo.
- [ ] Keyboard shortcuts.
- [ ] Search talents.
- [ ] Icon browser.
- [ ] Spell browser linked to `spells.json`.
- [ ] Preview calculator mode directly inside the designer.
- [ ] Toggle between **Designer Mode** and **Play/Test Mode**.
- [ ] Tree validation visualization.
- [ ] Highlight all parents/children of a selected node.
- [ ] Automatic layout suggestions.
- [ ] Import existing WoW talent-tree data.
- [ ] Compare two versions of a tree.
- [ ] Version/history support.
- [ ] Git diff preview before saving.
- [ ] GitHub branch/PR workflow.
- [ ] Collaboration support in the very distant future.

---

# Current starting point

The repository already has important foundations for this plan:

- `config/talent-trees.json` contains the talent-tree data.
- `config/talent-connections.json` contains explicit JSON-defined connections for the Lichborn prototype.
- `js/talent-calculator.js` already consumes the connection JSON for selection rules and rendering.
- The calculator already supports connected-node selection and locked/available states.
- Lichborn currently provides an intentionally empty tree that can be used as the first designer test case.

Therefore, the **next technical milestone should be Phase 1: redesign/refine the data schema**, not immediately building the complete UI.

The designer should be developed incrementally from that foundation.
