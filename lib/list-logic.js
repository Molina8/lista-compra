// Fuente única de verdad para normalización de búsqueda y finalizar compra (app + tests Node).

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
