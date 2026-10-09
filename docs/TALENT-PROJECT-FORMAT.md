# Canonical Talent Project Format

[The manifest](../config/talent-project.json) indexes the split configuration. It contains no talent nodes:

```json
{
  "format": "wow-workbook-talent-manifest",
  "version": 1,
  "content": { "Death Knight": ["Blood", "Frost"] },
  "classTalents": { "Death Knight": "class/death-knight.json" },
  "heroTalents": "hero-talent.json",
  "specFiles": {
    "Death Knight/Blood": "spec/death-knight/blood.json",
    "Death Knight/Frost": "spec/death-knight/frost.json"
  }
}
```

Class files contain `{ "class": "Death Knight", "sections": { "Death Knight/class": <section> } }`. The hero registry contains `{ "heroes": { "Death Knight/hero": <section> } }`. Spec files contain tree metadata and ordered sections: shared references such as `{ "classTalent": "Death Knight/class" }` and `{ "heroTalent": "Death Knight/hero" }`, together with inline spec/Apex sections. Missing specialization trees have `{ "class": "Death Knight", "spec": "Frost", "available": false }` scaffold files. An empty class file has `sections: {}`.

References resolve to shared editable section objects. Shared sections never cross class boundaries. Distinct hero sections get distinct keys; no existing hero content is overwritten just because it has the same section ID.

## Compact class export and draft format (v6)

Exports contain only one selected class; browser drafts contain all classes. Both use:

```json
{
  "format": "wow-workbook-talent-project",
  "version": 6,
  "content": { "Death Knight": ["Blood", "Frost"] },
  "shared": {
    "classes": { "Death Knight/class": { "id": "class", "type": "class", "nodes": [], "connections": [] } },
    "heroes": { "Death Knight/hero": { "id": "hero", "type": "hero", "nodes": [], "connections": [] } }
  },
  "trees": {
    "Death Knight/Blood": {
      "class": "Death Knight", "spec": "Blood", "description": "",
      "sections": [
        { "classTalent": "Death Knight/class" },
        { "id": "spec", "type": "spec", "nodes": [], "connections": [] },
        { "id": "apex", "type": "apex", "nodes": [], "connections": [] },
        { "heroTalent": "Death Knight/hero" }
      ]
    }
  }
}
```

Importing a class replaces that class's registry and trees, not the entire project. Apply an exported class to disk with `node scripts/migrate-talent-config.mjs --import <export-file>`; the script merges it with the existing configuration before generating files.

## Resolved runtime contract

```json
{
  "format": "wow-workbook-talent-project",
  "version": 6,
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
- Resolved projects and compact exports use version `6`; the file manifest has its own version `1`.
- A node ID is stable identity; row/column are layout information and may change.
- Empty talent sockets are real nodes and must not be represented by `null` when they are selectable.
- Connections belong to their section. There is no separate canonical connection file.
- Class exports and IndexedDB drafts use the compact representation above; renderers receive resolved sections.
- The Calculator and Designer use `loadTalentProject` and normalize through the shared model.
- Conflicting class copies in legacy imports fail explicitly instead of discarding talents. Identical copies are shared, and existing trees without a class section inherit it.

## Versions

| Version | Change |
| --- | --- |
| 1 | Row-based trees with a separate connection file. |
| 2 | Node/connection objects merged into the section. |
| 3 | Added node `kind`, `maxRank` and `choices`; added section `columns` and `rowCount`. |
| 4 | Increased the minimum/default section width from 4 to 7 columns. |
| 5 | Added optional `cost`, `range`, `charges`, `castTime` and `cooldown` fields for active abilities. |
| 6 | Shared class/hero references; split repository scaffold; current-class exports and class-safe import merging. |

Older files still load: `normalizeProject` upgrades them in memory, filling in the current defaults (`kind: "active"`, `maxRank: 1`, and at least 7 columns). Re-exporting from the Designer writes the current version.

## Repository state

The repository uses the split manifest/class/spec/hero scaffold. Both apps can still load older whole-project files during migration, and old local drafts and imports are upgraded to the shared v6 model.
