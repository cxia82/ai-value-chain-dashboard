export const createCacheStore = (ttlMs) => {
  const store = new Map();

  const get = (key) => {
    const entry = store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.cachedAt > ttlMs) {
      store.delete(key);
      return null;
    }
    return entry.data;
  };

  const set = (key, data) => {
    store.set(key, { cachedAt: Date.now(), data });
  };

  return {
    get,
    set
  };
};
