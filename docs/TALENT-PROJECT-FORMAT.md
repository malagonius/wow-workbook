# Canonical Talent Project Format

`config/talent-project.json` is the planned single source of truth for talent-tree structure.

## Contract

```json
{
  "format": "wow-workbook-talent-project",
  "version": 2,
  "content": {
    "Death Knight": ["Blood", "Frost", "Unholy", "Lichborn"]
  },
  "trees": {
    "Death Knight/Lichborn": {
      "class": "Death Knight",
      "spec": "Lichborn",
      "description": "...",
      "sections": [
        {
          "id": "spec",
          "title": "Lichborn",
          "type": "spec",
          "maxPoints": 34,
          "selectableEmpty": true,
          "nodes": [
            {
              "id": "spec-0-0",
              "name": "",
              "description": "",
              "icon": "",
              "row": 0,
              "column": 0,
              "type": "talent"
            }
          ],
          "connections": [
            { "from": "spec-0-0", "to": "spec-1-0" }
          ]
        }
      ]
    }
  }
}
```

## Rules

- `format` must be `wow-workbook-talent-project`.
- `version` is currently `2`.
- A node ID is stable identity; row/column are layout information and may change.
- Empty talent sockets are real nodes and must not be represented by `null` when they are selectable.
- Connections belong to their section. There is no separate canonical connection file.
- Export/import uses this exact project object.
- IndexedDB drafts use this exact project object.
- The Calculator and Designer normalize older project exports for compatibility during migration.

## Migration

The repository currently still contains the legacy `config/talent-trees.json` and `config/talent-connections.json` files. `scripts/migrate-talent-project.mjs` deterministically converts those files into the v2 canonical format.

The final migration step is to generate and commit `config/talent-project.json`, verify the Calculator and Designer against it, and then remove the legacy files.
