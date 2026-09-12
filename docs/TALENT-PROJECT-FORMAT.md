# Canonical Talent Project Format

`config/talent-project.json` is the single source of truth for talent-tree structure.

## Contract

```json
{
  "format": "wow-workbook-talent-project",
  "version": 5,
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
          "columns": 7,
          "rowCount": 10,
          "selectableEmpty": true,
          "nodes": [
            {
              "id": "spec-0-0",
              "name": "Frozen Dominion",
              "description": "Your grasp over death deepens.",
              "icon": "icons/frozen-dominion.png",
              "row": 0,
              "column": 0,
              "type": "talent",
              "kind": "passive",
              "maxRank": 2,
              "cost": "",
              "range": "",
              "charges": "",
              "castTime": "",
              "cooldown": ""
            },
            {
              "id": "spec-0-1",
              "name": "",
              "row": 0,
              "column": 1,
              "kind": "choice",
              "maxRank": 1,
              "choices": [
                { "name": "Wraith Walk", "description": "...", "icon": "" },
                { "name": "March of Darkness", "description": "...", "icon": "" }
              ]
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

## Fields

### Section

| Field | Meaning |
| --- | --- |
| `id` | Stable identity, also the prefix used for generated node IDs. |
| `title` | Shown in the section header. |
| `type` | `class`, `spec`, `apex` or `hero`. Drives section colouring. |
| `maxPoints` | Points spendable in this section. |
| `columns` | Declared grid width. Has a minimum and default of 7; grows automatically if a node sits further right. |
| `rowCount` | Declared grid height, so a section can hold empty rows. Grows automatically if a node sits lower. |
| `selectableEmpty` | Whether blank sockets are real, selectable placeholders. |
| `nodes` / `connections` | The talents and the edges between them. |

### Node

| Field | Meaning |
| --- | --- |
| `id` | Stable identity. Row/column are layout and may change; the ID must not. |
| `name`, `description` | Display text. |
| `icon` | Image path/URL, or a single glyph such as an emoji. |
| `row`, `column` | Grid position. |
| `kind` | `active` (square), `passive` (circle) or `choice` (octagon). Defaults to `active`. |
| `maxRank` | Points investable in this talent. Defaults to 1 and renders as the `0/N` badge. |
| `cost`, `range` | Optional active-ability resource cost and effective range, such as `30 Runic Power` and `40 yd`. |
| `charges`, `castTime`, `cooldown` | Optional active-ability timing details, such as `1 Charge`, `Instant` and `6 sec cooldown`. |
| `choices` | Only for `kind: "choice"` — the two selectable options. |

## Rules

- `format` must be `wow-workbook-talent-project`.
- `version` is currently `5`.
- A node ID is stable identity; row/column are layout information and may change.
- Empty talent sockets are real nodes and must not be represented by `null` when they are selectable.
- Connections belong to their section. There is no separate canonical connection file.
- Export/import uses this exact project object.
- IndexedDB drafts use this exact project object.
- The Calculator and Designer consume the canonical project and normalize it through the shared model.

## Versions

| Version | Change |
| --- | --- |
| 1 | Row-based trees with a separate connection file. |
| 2 | Node/connection objects merged into the section. |
| 3 | Added node `kind`, `maxRank` and `choices`; added section `columns` and `rowCount`. |
| 4 | Increased the minimum/default section width from 4 to 7 columns. |
| 5 | Added optional `cost`, `range`, `charges`, `castTime` and `cooldown` fields for active abilities. |

Older files still load: `normalizeProject` upgrades them in memory, filling in the current defaults (`kind: "active"`, `maxRank: 1`, and at least 7 columns). Re-exporting from the Designer writes the current version.

## Repository state

The canonical migration is complete. `config/talent-project.json` contains the talent-tree data previously split across the legacy tree and connection files.

The Calculator and Designer load only `config/talent-project.json`; the legacy `config/talent-trees.json` and `config/talent-connections.json` files have been removed.

The stored file is still written in the v2 shape and is upgraded on load, which is valid. Exporting from the Designer rewrites it at version 5.
