/* ============================================================
   db.js — Couche de stockage local (IndexedDB)
   Tout est sauvegardé sur l'appareil. Aucune connexion requise.
   Conçu pour qu'on puisse brancher Firebase plus tard sans tout
   réécrire : toutes les écritures passent par les méthodes put/del.
   ============================================================ */

const DB_NAME = 'pilote-db';
const DB_VERSION = 1;
const STORES = ['projects', 'tasks', 'meetings', 'files', 'meta'];

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

const DB = {
  async all(store) {
    const os = await tx(store);
    return new Promise((res, rej) => {
      const r = os.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },
  async get(store, id) {
    const os = await tx(store);
    return new Promise((res, rej) => {
      const r = os.get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  },
  async put(store, obj) {
    const os = await tx(store, 'readwrite');
    return new Promise((res, rej) => {
      const r = os.put(obj);
      r.onsuccess = () => res(obj);
      r.onerror = () => rej(r.error);
    });
  },
  async del(store, id) {
    const os = await tx(store, 'readwrite');
    return new Promise((res, rej) => {
      const r = os.delete(id);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  async clear(store) {
    const os = await tx(store, 'readwrite');
    return new Promise((res, rej) => {
      const r = os.clear();
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  }
};

/* Identifiant court et lisible */
function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export { DB, uid };
