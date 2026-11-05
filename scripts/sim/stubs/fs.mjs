// in-memory expo-file-system (File / Directory / Paths) for the harness
export const __files = new Map();
const join = (parts) => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/').replace(/\/+/g, '/');
export class File {
  constructor(...parts) { this.uri = join(parts); }
  get exists() { return __files.has(this.uri); }
  get name() { return this.uri.split('/').pop(); }
  get size() { return (__files.get(this.uri) ?? '').length; }
  create() { __files.set(this.uri, ''); }
  async write(v) { if (globalThis.__fsFail) throw new Error('disk full'); __files.set(this.uri, v); }
  async text() { return __files.get(this.uri); }
  async move(dest) { __files.set(dest.uri, __files.get(this.uri)); __files.delete(this.uri); this.uri = dest.uri; }
  delete() { __files.delete(this.uri); }
}
export class Directory {
  constructor(...parts) { this.uri = join(parts); }
  create() {}
  list() { return [...__files.keys()].filter((k) => k.startsWith(this.uri + '/')).map((k) => new File(k)); }
}
export const Paths = { document: { uri: '/doc' }, cache: { uri: '/cache' } };
