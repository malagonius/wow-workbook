import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { SupabaseStorage, copyClass, emptyProject } from '../js/supabase-storage.js';
import { compactProject, mergeProject } from '../js/talent-config.js';
import { createTree, normalizeProject } from '../js/talent-model.js';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' };

function fixture(name = 'Mage') {
  return normalizeProject({
    content: { [name]: ['Frost', 'Unfinished'] },
    trees: { [`${name}/Frost`]: createTree({ className: name, specName: 'Frost' }) },
    abilities: {
      [name]: [{ name: 'Class spell' }],
      [`${name}/Frost`]: [{ name: 'Spec spell' }]
    }
  });
}

function row(name = 'Mage', owner = alice, revision = 1) {
  return { class_name: name, owner_id: owner, revision, payload: compactProject(fixture(name)) };
}

function response(data, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(data) };
}

function login(storage, id = alice) {
  storage.setSession({ access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600, user: { id } });
}

test('copying a class preserves all specs, shared sections, talents and abilities under the new name', () => {
  const original = fixture();
  const copy = normalizeProject(copyClass(original, 'Mage', 'My Mage'));
  assert.deepEqual(copy.content, { 'My Mage': ['Frost', 'Unfinished'] });
  assert.equal(copy.trees['My Mage/Frost'].class, 'My Mage');
  assert.equal(copy.abilities['My Mage'][0].name, 'Class spell');
  assert.equal(copy.abilities['My Mage/Frost'][0].name, 'Spec spell');
  assert.equal(copy.trees['Mage/Frost'], undefined);
  assert.equal(original.trees['Mage/Frost'].class, 'Mage');
  assert.throws(() => copyClass(original, 'Mage', 'Invalid/name'), /class name/);
});

test('public loads page beyond 1000 classes and never enable anonymous edits', async () => {
  const pages = [];
  const storage = new SupabaseStorage(config, async url => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    pages.push(offset);
    return response(Array.from({ length: offset < 1000 ? 100 : 1 }, (_, index) => {
      const name = `Class ${offset + index}`;
      const project = emptyProject();
      project.content[name] = [];
      return { class_name: name, owner_id: alice, revision: 1, payload: compactProject(project) };
    }));
  });
  const project = await storage.load();
  assert.equal(Object.keys(project.content).length, 1001);
  assert.equal(pages.length, 11);
  assert.equal(storage.canEdit('Class 0'), false);
});

test('saves only changed owned classes with expected revision and commits deletions', async () => {
  let saved;
  const initial = [row(), row('Other', bob)];
  const storage = new SupabaseStorage(config, async (url, options) => {
    if (url.includes('/rpc/')) {
      saved = JSON.parse(options.body).changes;
      assert.equal(options.headers.Authorization, 'Bearer test-access');
      return response(saved.map(change => ({
        class_name: change.class_name, owner_id: alice,
        revision: change.payload === null ? null : (change.revision ?? 0) + 1,
        payload: change.payload
      })));
    }
    return response(initial);
  });
  const project = await storage.load();
  login(storage);
  project.abilities.Mage[0].name = 'Changed';
  await storage.save(compactProject(project));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].class_name, 'Mage');
  assert.equal(saved[0].revision, 1);
  assert.equal(storage.rows.get('Mage').revision, 2);
  assert.equal(storage.changes(project).length, 0);
  await storage.save(mergeProject(emptyProject(), compactProject(project, 'Other')));
  assert.equal(saved[0].payload, null);
  assert.equal(storage.rows.has('Mage'), false);
});

test('editing another owner is rejected before any network write', async () => {
  let requests = 0;
  const storage = new SupabaseStorage(config, async () => { requests++; return response([row('Mage', bob)]); });
  const project = await storage.load();
  login(storage);
  project.abilities.Mage[0].name = 'Not mine';
  await assert.rejects(storage.save(project), /read-only/);
  assert.equal(requests, 1);
});

test('a failed or unconfirmed save keeps the previous revision and unsaved changes', async () => {
  let fail = true;
  const storage = new SupabaseStorage(config, async url => {
    if (!url.includes('/rpc/')) return response([row()]);
    return fail ? response({ message: 'Class changed. Reload.' }, 409) : response([]);
  });
  const project = await storage.load();
  login(storage);
  project.abilities.Mage[0].name = 'Unsaved';
  await assert.rejects(storage.save(project), /Class changed/);
  fail = false;
  await assert.rejects(storage.save(project), /did not confirm/);
  assert.equal(storage.rows.get('Mage').revision, 1);
  assert.equal(storage.changes(project).length, 1);
});

test('auth confirms email signup, refreshes expired tokens, and clears session on logout', async () => {
  const requests = [];
  const session = { access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600, user: { id: alice } };
  const storage = new SupabaseStorage(config, async (url, options) => {
    requests.push({ url, ...options });
    if (url.endsWith('/signup')) return response({ user: { id: alice } });
    if (url.includes('/token?')) return response(session);
    return response(null);
  });
  assert.equal(await storage.signUp('a@example.test', 'password'), false);
  assert.equal(storage.user, null);
  await storage.signIn('a@example.test', 'password');
  storage.session.expiresAt = 0;
  await storage.signOut();
  assert.ok(requests.some(request => request.url.includes('grant_type=refresh_token')));
  assert.equal(requests.at(-1).headers.Authorization, 'Bearer new-token');
  assert.equal(storage.user, null);
});

test('public read failure is explicit, without falling back to browser or bundled data', async () => {
  const storage = new SupabaseStorage(config, async () => response({ message: 'Database unavailable' }, 503));
  await assert.rejects(storage.load(), /Database unavailable/);
  assert.throws(() => new SupabaseStorage({ ...config, publishableKey: 'sb_secret_bad' }), /never a secret/);
});

test('the fetch implementation is invoked without binding it to the storage instance', async () => {
  const storage = new SupabaseStorage(config, async function () {
    assert.equal(this, undefined);
    return response([]);
  });
  await storage.load();
});

test('PostgreSQL migration enforces ownership, atomic saves, revision conflicts and payload boundaries', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users values ('${alice}'), ('${bob}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202610150001_workbook.sql', import.meta.url), 'utf8'));
    async function asUser(role, id = '') {
      await db.exec(`reset role; set role ${role};`);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    }
    async function save(changes) {
      return (await db.query('select public.save_workbook_classes($1::jsonb) as result', [JSON.stringify(changes)])).rows[0].result;
    }
    const create = name => ({ class_name: name, revision: null, payload: compactProject(fixture(name)) });

    await t.test('anonymous users can read but cannot write or invoke save', async () => {
      await asUser('anon');
      assert.deepEqual((await db.query('select * from public.workbook_classes')).rows, []);
      await assert.rejects(save([create('Mage')]), /permission denied/);
      await assert.rejects(db.query('insert into public.workbook_classes (class_name, payload) values ($1, $2)', ['Mage', create('Mage').payload]), /permission denied/);
    });
    await t.test('new classes belong to the signed-in creator', async () => {
      await asUser('authenticated', alice);
      const result = await save([create('Mage'), create('Druid')]);
      assert.equal(result.length, 2);
      assert.equal(result[0].owner_id, alice);
      assert.equal(result[0].revision, 1);
    });
    await t.test('another user cannot update, delete, replace or claim a class', async () => {
      await asUser('authenticated', bob);
      assert.equal((await db.query('select * from public.workbook_classes')).rows.length, 2);
      await assert.rejects(save([{ ...create('Mage'), revision: 1 }]), /not yours/);
      await assert.rejects(save([{ class_name: 'Mage', revision: 1, payload: null }]), /not yours/);
      await assert.rejects(save([create('Mage')]), /duplicate key/);
      const direct = await db.query('update public.workbook_classes set owner_id = $1 where class_name = $2 returning *', [bob, 'Mage']);
      assert.equal(direct.rows.length, 0);
      const forged = { ...create('Forged').payload };
      await assert.rejects(db.query('insert into public.workbook_classes (class_name, owner_id, payload) values ($1, $2, $3)', ['Forged', alice, forged]), /row-level security/);
    });
    await t.test('updates increment revisions; stale saves and mixed failed batches roll back', async () => {
      await asUser('authenticated', alice);
      await save([{ ...create('Mage'), revision: 1 }]);
      await assert.rejects(save([{ ...create('Mage'), revision: 1 }]), /Class changed/);
      await assert.rejects(save([{ ...create('Druid'), revision: 1 }, { ...create('Mage'), revision: 1 }]), /Class changed/);
      const rows = (await db.query('select class_name, revision from public.workbook_classes order by class_name')).rows;
      assert.deepEqual(rows, [{ class_name: 'Druid', revision: 1 }, { class_name: 'Mage', revision: 2 }]);
      await assert.rejects(db.query('update public.workbook_classes set owner_id = $1 where class_name = $2', [bob, 'Mage']), /ownership cannot be transferred/);
    });
    await t.test('payloads cannot overwrite a different class through nested trees or abilities', async () => {
      const payload = create('Bad').payload;
      payload.trees['Mage/Frost'] = payload.trees['Bad/Frost'];
      await assert.rejects(save([{ class_name: 'Bad', revision: null, payload }]), /Specializations must belong/);
      const abilities = create('Bad').payload;
      abilities.abilities.Mage = [];
      await assert.rejects(save([{ class_name: 'Bad', revision: null, payload: abilities }]), /must belong/);
      await assert.rejects(save([{ class_name: 'Bad', revision: null, payload: {} }]), /valid_class_payload/);
    });
    await t.test('renames and deletes persist atomically and anonymous readers see them', async () => {
      const result = await save([
        { class_name: 'Mage', revision: 2, payload: null },
        { class_name: 'My Mage', revision: null, payload: copyClass(fixture(), 'Mage', 'My Mage') }
      ]);
      assert.equal(result.find(item => item.class_name === 'Mage').revision, null);
      await asUser('anon');
      assert.deepEqual((await db.query('select class_name from public.workbook_classes order by class_name')).rows,
        [{ class_name: 'Druid' }, { class_name: 'My Mage' }]);
    });
    await t.test('all existing bundled classes can migrate losslessly into the database', async () => {
      await asUser('authenticated', alice);
      const manifest = JSON.parse(await readFile(new URL('../config/talent-project.json', import.meta.url), 'utf8'));
      const changes = [];
      for (const [name, path] of Object.entries(manifest.classFiles)) {
        const original = normalizeProject(JSON.parse(await readFile(new URL(`../config/${path}`, import.meta.url), 'utf8')));
        const payload = copyClass(original, name, `Imported ${name}`);
        changes.push({ class_name: `Imported ${name}`, revision: null, payload });
      }
      const saved = await save(changes);
      assert.equal(saved.length, 14);
      for (const change of changes) {
        assert.deepEqual(saved.find(item => item.class_name === change.class_name).payload, change.payload);
      }
    });
  } finally { await db.close(); }
});
