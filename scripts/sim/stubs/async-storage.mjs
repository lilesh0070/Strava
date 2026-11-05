const m = new Map(); export const __store = m; export const __fail = { multiSet: false };
const AS = {
  getItem: async (k) => (m.has(k) ? m.get(k) : null), setItem: async (k, v) => { m.set(k, v); },
  removeItem: async (k) => { m.delete(k); }, multiGet: async (ks) => ks.map((k) => [k, m.has(k) ? m.get(k) : null]),
  multiSet: async (kv) => { if (__fail.multiSet) throw new Error('SQLITE_FULL'); for (const [k, v] of kv) m.set(k, v); },
  getAllKeys: async () => [...m.keys()], multiRemove: async (ks) => { for (const k of ks) m.delete(k); },
};
export default AS;
