import { compactProject, validateClassFile } from './talent-config.js';
import { normalizeProject, TALENT_PROJECT_FORMAT, TALENT_PROJECT_VERSION } from './talent-model.js';

export function emptyProject() {
  return normalizeProject({
    format: TALENT_PROJECT_FORMAT, version: TALENT_PROJECT_VERSION,
    content: {}, abilities: {}, trees: {}, shared: { classes: {}, heroes: {} }
  });
}

export function copyClass(project, previous, name) {
  if (!name || name.includes('/') || name.length > 120) throw new Error('Use a class name of 1-120 characters without "/".');
  const source = normalizeProject(compactProject(project, previous));
  source.content[name] = source.content[previous];
  if (name !== previous) delete source.content[previous];
  source.trees = Object.fromEntries(Object.values(source.trees).map(tree => {
    tree.class = name;
    return [`${name}/${tree.spec}`, tree];
  }));
  source.abilities = Object.fromEntries(Object.entries(source.abilities).map(([key, value]) =>
    [name + key.slice(previous.length), value]));
  return compactProject(source, name);
}

export class SupabaseStorage {
  constructor(config, fetcher = fetch) {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('Supabase requires an HTTPS project URL.');
    }
    if (!config.publishableKey || config.publishableKey.startsWith('sb_secret_')) {
      throw new Error('Configure a Supabase publishable/anon key, never a secret key.');
    }
    this.url = url.href.replace(/\/$/, '');
    this.key = config.publishableKey;
    this.fetcher = (...args) => fetcher(...args);
    this.session = null;
    this.rows = new Map();
    this.committed = emptyProject();
  }

  get user() { return this.session?.user || null; }

  async request(path, { method = 'GET', body, authenticated = false } = {}) {
    if (authenticated) await this.refreshSession();
    const response = await this.fetcher(this.url + path, {
      method,
      headers: {
        apikey: this.key,
        ...(this.session ? { Authorization: `Bearer ${this.session.access_token}` } : {}),
        'Content-Type': 'application/json'
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Supabase returned an invalid response (${response.status}).`); }
    if (!response.ok) {
      throw new Error(data?.message || data?.msg || data?.error_description || data?.error || `Supabase request failed (${response.status}).`);
    }
    return data;
  }

  async refreshSession() {
    if (!this.session) throw new Error('Sign in to save your creations.');
    if (Date.now() < this.session.expiresAt - 60000) return;
    const data = await this.request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: this.session.refresh_token }
    });
    this.setSession(data);
  }

  setSession(data) {
    if (!data.access_token || !data.refresh_token || !data.user?.id) throw new Error('Supabase did not return a valid sign-in session.');
    this.session = { ...data, expiresAt: Date.now() + data.expires_in * 1000 };
  }

  async signIn(email, password) {
    const data = await this.request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password }
    });
    this.setSession(data);
  }

  async signUp(email, password) {
    const data = await this.request('/auth/v1/signup', { method: 'POST', body: { email, password } });
    if (data.access_token) this.setSession(data);
    return Boolean(data.access_token);
  }

  async signOut() {
    await this.request('/auth/v1/logout', { method: 'POST', authenticated: true });
    this.session = null;
  }

  canEdit(name) {
    return Boolean(this.user && (!this.rows.has(name) || this.rows.get(name).owner_id === this.user.id));
  }

  async load() {
    if (this.session) await this.refreshSession();
    // Explicit paging avoids PostgREST's default 1000-row truncation.
    const rows = [];
    for (let offset = 0; ; offset += 100) {
      const page = await this.request(`/rest/v1/workbook_classes?select=class_name,owner_id,revision,payload&order=class_name&limit=100&offset=${offset}`);
      if (!Array.isArray(page)) throw new Error('Supabase class response must be an array.');
      rows.push(...page);
      if (page.length < 100) break;
    }
    const combined = compactProject(emptyProject());
    for (const row of rows) {
      const data = validateClassFile(row.payload, row.class_name, `Supabase/${row.class_name}`);
      Object.assign(combined.content, data.content);
      Object.assign(combined.abilities, data.abilities);
      Object.assign(combined.trees, data.trees);
      Object.assign(combined.shared.classes, data.shared.classes);
      Object.assign(combined.shared.heroes, data.shared.heroes);
    }
    const project = normalizeProject(combined);
    this.rows = new Map(rows.map(row => [row.class_name, row]));
    this.committed = project;
    return normalizeProject(compactProject(project));
  }

  changes(project) {
    const names = new Set([...Object.keys(this.committed.content), ...Object.keys(project.content)]);
    const changes = [];
    for (const name of [...names].sort()) {
      const before = Object.hasOwn(this.committed.content, name) ? compactProject(this.committed, name) : null;
      const after = Object.hasOwn(project.content, name) ? compactProject(project, name) : null;
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      if (!this.canEdit(name)) throw new Error(`"${name}" is read-only. Duplicate it to create your own editable class.`);
      if (name.includes('/') || !name.trim() || name.length > 120) throw new Error('Use a class name of 1-120 characters without "/".');
      changes.push({ class_name: name, revision: this.rows.get(name)?.revision ?? null, payload: after });
    }
    return changes;
  }

  async save(project) {
    const snapshot = normalizeProject(project);
    const changes = this.changes(snapshot);
    if (!changes.length) return;
    const rows = await this.request('/rest/v1/rpc/save_workbook_classes', {
      method: 'POST', authenticated: true, body: { changes }
    });
    if (!Array.isArray(rows) || rows.length !== changes.length ||
        changes.some(change => !rows.some(row => row.class_name === change.class_name &&
          row.revision === (change.payload === null ? null : (change.revision ?? 0) + 1)))) {
      throw new Error('Supabase did not confirm every class save. Reload before retrying.');
    }
    for (const row of rows) {
      if (row.revision === null) this.rows.delete(row.class_name);
      else this.rows.set(row.class_name, row);
    }
    this.committed = snapshot;
  }
}

export async function connectSupabase(fetcher = fetch) {
  const response = await fetcher('config/supabase.json');
  if (!response.ok) throw new Error(`Supabase configuration unavailable (${response.status}).`);
  return new SupabaseStorage(await response.json(), fetcher);
}

export async function loadWorkbook() {
  return (await connectSupabase()).load();
}
