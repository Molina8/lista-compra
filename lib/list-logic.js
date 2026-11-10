// Pure helpers (usable from Node tests and app.js via importScripts pattern — duplicated import in browser).

export function normalizeForSearch(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** After finish shopping: drop inCart items; keep pending with inCart false. */
export function listaAfterFinish(lista) {
  const remaining = {};
  for (const [k, item] of Object.entries(lista || {})) {
    if (!item.inCart) {
      remaining[k] = { name: item.name, inCart: false };
    }
  }
  return remaining;
}
