# Talent Designer — Initial Implementation Notes

This document records what is implemented after the first Talent Designer milestone.

## Implemented

- `designer.html` provides a dedicated visual designer page.
- `css/talent-designer.css` provides the designer workspace and responsive layout.
- `js/talent-model.js` provides shared editor-oriented helpers for nodes, connections, cloning, and validation.
- `js/talent-designer.js` loads the existing tree and connection JSON and provides the first editing interactions.

## Current interactions

- Choose class, specialization, and section.
- Existing row-based configuration is normalized into editor nodes at runtime.
- Select a node and edit:
  - ID
  - name
  - description
  - icon
  - row
  - column
- Add an empty node.
- Delete a node.
- Connect two nodes using **Connect nodes** mode.
- Display the resulting tree connections visually.
- Open a JSON preview for the current tree.
- Apply edited JSON back into the current in-memory tree.
- Copy the JSON to the clipboard.
- Run basic section validation.

## Important limitation of this first milestone

The repository currently has two related representations:

1. `config/talent-trees.json` — existing row-based talent content.
2. `config/talent-connections.json` — explicit connection data, currently populated for Lichborn.

The designer currently bridges these representations at runtime instead of migrating the whole repository immediately. This is intentional: the next architectural task is to define and migrate to a canonical editor-friendly schema without accidentally breaking the calculator's existing trees.

Likewise, the current JSON preview shows the tree object, while connection persistence remains in the separate connection configuration. A later milestone should decide whether connections become part of the canonical tree schema or remain a separate first-class JSON document, then make the designer export/import both consistently.

## Next work

1. Define the canonical node/section/tree schema.
2. Migrate Lichborn to that schema first as a safe test case.
3. Update the calculator to consume the canonical representation.
4. Migrate existing Blood/Frost/Unholy/class trees.
5. Make connection editing persist cleanly in the chosen canonical JSON format.
6. Add robust validation, including connection and graph validation.
7. Add undo/redo and stronger editor UX.
8. Add import/export of complete tree data.
9. Eventually add optional GitHub save/commit/PR workflows.
