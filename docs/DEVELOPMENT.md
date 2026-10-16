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

There is no build, bundler or browser dependency. Follow the
[Supabase setup](../README.md#supabase-setup-required-once) before using the app.
Node 20+ runs the tests: `npm ci`, then `npm test`. The development-only PGlite
dependency runs the real migration against embedded PostgreSQL, including
public reads, owner-only writes, cross-class validation, revision conflicts and
transaction rollback. `npm run check:talents` verifies bundled import sources.

The shared Priest baseline follows the Italian Wowhead Priest/Shadow class tree,
captured on 2026-10-14 (48 nodes, 78 directed connections). Specialization and hero
talents are not part of that import. Run `node scripts/sync-priest-class.mjs` to
check against the pinned source, or add `--write` to regenerate only `Priest/class`
and its reference fixture. Review source changes before updating the pinned URL.
Source checkpoint and default-grant metadata are retained; the calculator's
allocation rules are unchanged by this data import.

Playwright compared the rendered class nodes and all connection endpoints against
the live Wowhead DOM, with no missing, extra or broken connections. The checked-in
reference fixture also guards the graph in the Node test suite. Existing local
designer drafts remain untouched. Import them explicitly through the migration
action; bundled source updates do not replace already saved database classes.

## Where to make a change

| I want to… | Edit |
| --- | --- |
| Add a field to talents (cooldown, spell ID, resource cost…) | `talent-model.js` (`makeNode` + `normalizeNode`), then the designer's node form, then the renderer if it should be visible |
| Change how a talent looks | `css/talent-tree.css` and, if it needs new state, `getNodeState` in the consuming app |
| Change responsive layout or shared accessibility styling | `css/mobile.css`, loaded last by both pages; mobile defaults expand at 701px and the designer gains its sidebar at 1001px |
| Change talent-spending rules | `talent-calculator.js` only |
| Add an editing gesture | `talent-tree-renderer.js` (emit a handler) + `talent-designer.js` (implement it) |
| Add a validation rule | `validateSection` in `talent-model.js` — both apps pick it up automatically |
| Change cloud persistence/auth | `js/supabase-storage.js`, `js/talent-designer.js`, and an appropriate SQL migration under `supabase/migrations/`; extend `tests/supabase-storage.test.mjs` |

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

Run `npm test` and `npm run check:talents`, then use this checklist for browser interactions.

The test command uses Node's built-in test discovery and does not require shell wildcard expansion.

**Calculator**

- [ ] Class icons reveal specializations on hover, click or keyboard Arrow Down; switching resets spent points.
- [ ] Row 0 talents are selectable; deeper talents stay locked until a parent is taken.
- [ ] Left-click spends a rank, right-click refunds; multi-rank talents count up.
- [ ] A talent cannot be refunded while a selected child depends only on it.
- [ ] Connection lines highlight between selected talents and survive a window resize.

**Designer**

- [ ] The tree renders with the same visuals as the calculator.
- [ ] In Edit mode, clicking a talent opens its modal editor; changes autosave and support undo/redo. Close or Escape returns to the tree without losing its position.
- [ ] Connect mode selects a source and target without opening the editor. Creating a connected talent in an empty socket stays in Connect mode.
- [ ] Dragging a talent onto an empty socket moves it; dragging onto another talent swaps them.
- [ ] Dragging the gold dot onto another talent connects them; clicking the dot then a target does the same.
- [ ] Clicking a connection line deletes it.
- [ ] Changing columns/rows resizes the grid and warns before deleting talents that fall outside.
- [ ] Undo/redo (`Ctrl+Z` / `Ctrl+Shift+Z`) covers moves, edits, deletes and structural changes.
- [ ] Creating a class then a spec produces four empty sections.
- [ ] Class creation sits beside the class icons; the pencil beside the Spec selector opens Edit specialization and sections. The selector and each class icon menu list `-- NEW SPEC --` before existing specs.
- [ ] The pencil dialog edits the spec name and every section title together, including custom sections. Section-only edits work without renaming the spec; blank titles and duplicate spec names keep the dialog open. Cancel changes nothing; Save is one undoable edit, retains the selected section, and preserves shared section identity across save/reload.
- [ ] Only Tree view is available on desktop and mobile; create talents by selecting empty sockets, without an Add Talent button.
- [ ] No Connections panel or validation list is shown. Invalid talents and connections turn red, expose issue details, and clear after repair; unused empty sockets remain unmarked.
- [ ] Duplicate edges and every edge in a loop turn red. A connection to a missing talent appears as a dashed red stub at the remaining endpoint; click it or focus and press Enter/Space/Delete to remove it.
- [ ] Excessive Max points highlights the section setting in red; the tree heading summarizes errors and warnings, including problems with nodes that cannot be drawn.
- [ ] Cancelling new-spec creation keeps the selected spec. Renaming a spec preserves its talents and spec abilities through autosave, undo/redo and reload; read-only classes cannot create or rename specs.
- [ ] Export class → Import classes round-trips the selected class without removing any other class.
- [ ] Class edits appear when switching specs and survive undo/redo and a page reload.
- [ ] Shared hero edits appear in the other specs using that hero tree, while different heroes and other classes stay unchanged.
- [ ] Reload database restores the latest saved classes and shared edit identity; unsaved changes require confirmation.
- [ ] Ability additions, edits and removals survive autosave, undo/redo, reload and class export/import.
- [ ] After an owned class saves, reloading the Calculator shows its specs, talents and abilities from Supabase.
- [ ] Anonymous users and other owners cannot edit a class; duplicating it creates an editable, owned copy.
- [ ] A stale save fails without losing unsaved work or partially applying an import.

## Mobile accessibility verification

Verified on 2026-10-13 using Playwright Chromium with mobile and touch emulation,
plus axe-core 4.10.3. Tests used isolated browser contexts so synthetic designer
edits did not change the repository data or the user's draft.

Both pages passed at **320x740, 375x812, 390x844, 844x390 (landscape), 768x1024,
and 1440x900**: 12 page/viewport checks with no page-level horizontal overflow,
no active targets smaller than 44x44 CSS pixels (checkbox labels provide the
touch target), and no uncaught JavaScript errors. Wide graphs intentionally
scroll within their focusable canvas instead of shrinking talent buttons.

Automated axe scans reported **zero violations** for the WCAG 2 A/AA, 2.1 AA,
and 2.2 AA tags in all 12 page/viewport checks. Additional scans passed for
selected talent details, the touch talent-details dialog, the spellbook, the
JSON dialog, and the create-class dialog.

Playwright interaction checks passed:

- Touch inspection does not spend a point; Add point and Refund point work.
- Closing talent details preserves the tree position.
- Touch menu navigation reaches the designer; Escape closes the menu.
- Talent edits render immediately; committed edits undo and redo.
- Connect mode creates a connection by selecting a source and target; undo removes it; cancellation works.
- The spellbook contains keyboard focus, closes with Escape, and restores focus.
- Phone screenshots were reviewed for both pages at 390x844.

### Designer usability follow-up

The initial automated checks did not catch a cramped, height-limited designer
canvas or the awkward trips between canvas and editor to create connections.
The revised designer defaults to List below 701px, retains an optional spatial
Tree view, scrolls vertically with the page, and isolates horizontal graph
scrolling from the section heading. A sticky Select/Connect control supports
source-then-target linking without leaving the canvas. Editing is explicit.

Both List and Tree were rechecked at **320, 375, 390, 768, and 1440px**:
10 view/width checks passed with no page overflow, no vertical canvas clipping,
no horizontal clipping in List, no runtime errors, and no axe WCAG A/AA findings.
Additional Playwright checks passed for source highlighting, accessible outgoing
connections, no page jump when linking, undo/cancel, editing, view switching,
preserved graph pan, stationary section headings, and the calculator's touch
add/refund workflow. Keyboard source/target selection, Escape, and unobscured
focus also passed. At 320px all canvas action labels fit without wrapping;
the revised canvas was reviewed in a phone screenshot.

When repeating checks after changes, wait for the tree to render before using
the toolbar. Text-edit history commits on field change, so leave the field
before checking Undo. Use fresh contexts or disable the browser cache to avoid
testing stale ES modules.

Automated checks are not accessibility certification. Physical iOS/Android
devices, VoiceOver/TalkBack, desktop screen readers, OS text scaling, and the
virtual keyboard still need manual verification. Choice cycling uses the same
rank logic as desktop but was not covered by a dedicated touch fixture.

### Icon Picker And Modal Editing (2026-10-14)

Both pages now share an icon-only class picker with hover/click specialization
menus and keyboard support (Arrow Down opens, Tab navigates, Escape dismisses).
Known class icons load from Wowhead's image CDN; custom classes use a gear icon,
with initials if the image cannot load. Data still flows through the existing
class/spec selectors and no project-format change is required.

The designer defaults to the spatial Tree view on phones as well as desktop.
Seven-column trees fit typical phone widths; wider authored grids scroll inside
the graph. List remains available. Edit opens the existing autosaved node form in
a modal; Connect keeps source/target selection separate and never opens it.
Secondary project commands are under Tools.

Browser checks covered both pages at 320, 390, 768 and 1440px, with no page-level
horizontal overflow or uncaught JavaScript errors. Touch checks covered class/spec
selection, modal edits and undo, connecting and undo, List/Tree switching, calculator
inspection/add/refund, and the abilities dialog. Desktop checks covered hover
menus, modal opening, Escape dismissal and keyboard specialization navigation.
All 22 configuration tests and `check:talents` passed. This follow-up does not
repeat the earlier axe audit; compact phone talent targets can be narrower than
44px, and real-device touch/virtual-keyboard checks remain manual.

### Simplified Designer Toolbar (2026-10-16)

The designer now keeps **＋ Class** alongside the class icons and exposes
spec renaming through an accessible pencil button beside the Spec selector.
Only the spatial Tree view is available on all screen sizes; the historical
List-view checks above describe earlier versions. Create talents directly
through empty sockets; the separate **＋ Talent** command has been removed.

## Updating optional bundled import sources

Normal publishing is now automatic: the Designer saves to Supabase and the
Calculator reads it on reload. These steps are only for maintaining the
repository's optional bundled import sources:

1. Select the class and click **Export class backup** in the designer.
2. Replace the matching `config/class/<class>.json` with the downloaded file. Its filename and format already match the repository.
3. Run `npm test` and `npm run check:talents`.
4. Commit the changed files under `config/`. Other classes are preserved.

The manifest's `classFiles` registry lists class filenames only; never replace it with a class export. All spec, class, hero, Apex and ability data belong in the owning class file. A spec listed in `content` without a tree is unconfigured. Use **＋ Spec** with that name to initialize it. Adding/removing specs within an existing class never requires a manifest edit.

For a new class, add its export to `config/class/` and its name/path to `classFiles`. Alternatively, run `node scripts/migrate-talent-config.mjs --import /path/to/class-talents.json`; it merges the export and updates the index automatically. `npm run migrate:talents` also consolidates legacy split/whole-project configuration. It removes only obsolete known data files after writing the new index. Review and commit the generated files yourself; migration does not create Git commits.

Autosave sends changed owned classes (including abilities) to Supabase.
**Reload database** discards unsaved tab changes only after confirmation.
**Import old browser draft** explicitly migrates IndexedDB and legacy
localStorage abilities into new owned classes; it keeps the original browser
backup and renames collisions. Bundled-source maintenance never writes to the
database automatically.

## Roadmap

Tracked in [TALENT-DESIGNER-TODO.md](TALENT-DESIGNER-TODO.md). The highest-value next steps:

1. **Icon library** — a picker with real WoW-style icon assets instead of a free-text path.
2. **Gating** — Wowhead-style "spend N points to unlock the next block of rows".
3. **Multi-section designer view** — edit class/spec/hero side by side instead of one section at a time.
4. **Richer choice nodes** — per-option icons in the editor and a proper picker in the calculator.
5. **Build sharing** — encode spent talents into a URL so a build can be linked.
6. **Save to GitHub** — replace the selected class file from the browser via a PR.
