# WoW Workbook

A homebrew **talent tree creator** for World of Warcraft classes and specializations, in the style of the Wowhead talent calculator.

Two pages, one shared talent model:

- **Talent Calculator** (`index.html`) — spend points in a tree: ranks, unlock rules, connection lines.
- **Talent Designer** (`designer.html`) — build that tree visually: drag & drop talents, connect them, edit names, descriptions, icons, ranks, node kinds and active-spell details, and create whole new classes and specs.

Both pages read the same **Supabase database**. Each class is one self-contained
JSONB document containing its specs, shared class/hero talents, Apex sections,
and class/spec abilities. Saves publish immediately; no file uploads or repository
changes are needed.

Everyone can view saved classes. Sign in to create a class or duplicate someone
else's class. Only its creator can edit or delete it; Supabase row-level security
enforces this independently of the browser UI.

The existing [configuration manifest](config/talent-project.json) and per-class
JSON files remain as one-time import sources and optional backup formats, not
the live source of truth.

## Run it

No build step or browser dependencies. It does need a web server, because ES
modules and `fetch()` do not work from `file://`:

```powershell
cd wow-workbook
python -m http.server 8000
```

Open <http://localhost:8000/>. Alternatively, Node 20+ users can run `npm start` and open <http://127.0.0.1:8123/>.

## Supabase setup (required once)

1. Open the project's [SQL Editor](https://supabase.com/dashboard/project/gsyfvjzuxsntvnpewakl/sql/new).
   Run the entire [database migration](supabase/migrations/202610150001_workbook.sql)
   once. It creates the class table, public-read/owner-write policies, validation
   triggers, and transactional save function. Alternatively apply it through your
   usual Supabase migration workflow. Do not rerun the initial migration on an
   already initialized database.
2. The project's API URL and public publishable key are configured in
   [config/supabase.json](config/supabase.json). That key is intended for browsers;
   never put a secret/service-role key here. The public key alone cannot create
   tables or bypass ownership policies.
3. In Supabase **Authentication > Sign In / Providers**, enable email/password
   sign-in and new-user signups. Keep email confirmation enabled for production.
   Set **Authentication > URL Configuration > Site URL** to the deployed app URL
   (or the local server URL for development). After following the confirmation
   email, return to the Designer and sign in.
4. Open the Designer, create an account and sign in. Under **Tools**, choose:
   - **Import old browser draft** to migrate your existing edits from the same
     browser and origin where you made them. Name collisions become new
     `migrated` classes; other people's classes are never overwritten. The old
     browser data is retained as a backup.
   - **Import bundled classes** to import any missing classes from the existing
     repository. Imported classes belong to the importing account. To preserve
     existing browser edits under the original names, import the browser draft
     **first**, then the bundled classes.
5. Wait for **Saved to Supabase**, then reload the Calculator to verify the data.
   Further edits autosave directly to Supabase after a short debounce.

Login sessions are saved in **localStorage**, scoped to the Supabase project,
and restored across page reloads and browser restarts. Expired access tokens are
renewed before database operations; server-expired or revoked sessions require
signing in again. **Sign out** removes the saved session from this browser.
Use sign-out on shared computers. Passwords are not stored. The workbook itself
remains in the database; no new talent drafts are written to browser storage.

Database errors do not fall back silently to local data. Unsaved work stays in
the current tab, the status displays the error, and leaving the page prompts a
warning. Retry **Save to database**, or export the affected class as a backup.
Concurrent edits to the same class reject stale saves instead of overwriting
another tab's work; export unsaved changes, then use **Reload database** to
retrieve the latest version. Multi-class imports, renames and deletions save
atomically. Class names must be globally unique, 1-120 characters, with no `/`.

This is public publishing, not private storage: names, talents, abilities and
descriptions saved here can be viewed by anyone.

## Mobile use

Both pages use a mobile-first layout with touch-sized controls. Wide talent trees
scroll inside their canvas without widening the page.

On a phone, tap a calculator talent to open its details, then use **Add point**,
**Refund point**, or **Next choice**. Closing the dialog keeps your place in the
tree. Desktop left-click and right-click still spend and refund directly.

The designer defaults to a readable **List** on phones; **Tree** switches to
the spatial layout. Both scroll vertically with the page, and tree headings
remain visible when a wide graph pans horizontally. Selecting a talent stays
in the canvas; **Edit talent** opens its editor below. Edit **Row** and **Column**
to move it without dragging.

To link talents, choose **Connect** above the canvas, tap the source, then tap
the target. The source is highlighted and the completed connection appears in
the list. Choose **Select** or press Escape to leave connection mode.
**Back to tree** returns from the editor to the canvas. Your classes autosave to Supabase.

See [mobile accessibility verification](docs/DEVELOPMENT.md#mobile-accessibility-verification)
for the Playwright and axe results, coverage, and remaining manual checks.

## Designing a tree

1. Open the **Talent Designer**.
2. Sign in. Pick one of your classes, use **Duplicate class** to copy any public
   class, or create your own with **＋ Class** / **＋ Spec**.
3. Click or tap an empty socket to create a talent, then edit it in the panel.
4. Drag talents to rearrange them, or edit Row and Column. Choose **Connect**,
   select a source, then a target; desktop also supports dragging the gold dot.
5. Talent and ability changes autosave together to Supabase. **Save to database**
   flushes/retries pending changes. Check for the saved status before closing.
6. **Export class backup** downloads optional JSON. **Import classes** updates only
   included classes; attempting to overwrite someone else's class rejects the
   entire import. Use a new class name or duplicate it instead.

## Configuration maintenance

Node 20+ is needed for developer validation/migration, not to run the static site.
Run `npm ci` to install the development-only PostgreSQL test engine.

- `npm test` — regression tests for loading, sharing, class exports, Supabase requests,
  ownership, revision conflicts, and the actual SQL migration against embedded
  PostgreSQL (including RLS and atomic rollback).
- `npm run check:talents` — validate that every referenced file and shared section resolves.
- `npm run migrate:talents` — consolidate legacy split/whole-project data into one file per class, or rewrite the current layout deterministically.
- `node scripts/migrate-talent-config.mjs --import /path/to/class-talents.json` — optional automated publishing; merge an export and update the class index, including new classes.

These maintenance commands change only bundled JSON sources, not Supabase.
Migration removes obsolete legacy JSON only after writing the new files and
manifest. Old whole-project files, split manifests and browser drafts remain
supported for explicit import.

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is put together and why |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | How to continue developing it: conventions, recipes, test checklist |
| [docs/TALENT-PROJECT-FORMAT.md](docs/TALENT-PROJECT-FORMAT.md) | The canonical JSON schema |
| [docs/TALENT-DESIGNER-TODO.md](docs/TALENT-DESIGNER-TODO.md) | Roadmap and status |
| [docs/TALENT-DESIGNER-IMPLEMENTATION.md](docs/TALENT-DESIGNER-IMPLEMENTATION.md) | What the designer can do today |

## Design workbook: Lichborn

`lichborn/` holds the design notes for a fourth Death Knight specialization built around **dominion, inevitability, and the progressive loss of enemy agency**.

> The longer the fight goes, the more inevitable your victory feels.

The player should feel like **Arthas / the next Lich King**: a slow, methodical juggernaut who progressively establishes Death's claim over an enemy. The core is **dominating the enemy**, not building an army — undead and other battlefield consequences are by-products of that domination.

These notes are maintained during brainstorming rather than turned into a giant design document immediately:

1. Ask one focused design question.
2. Record the answer and the reasoning.
3. Freeze decisions only when explicitly agreed.
4. Keep unresolved ideas clearly marked as open.
5. Move to the next high-impact question.
