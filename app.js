// Lista de la compra — PWA sincronizada en tiempo real con Firebase.
// Sin auth: cada lista se identifica por una "clave compartida" que ambos usuarios conocen.
// Estructura en Firebase:
//   /listas/<clave>/master/items    = { nameLower: name }                     (catálogo)
//   /listas/<clave>/lista/items     = { nameLower: { name, inCart, ts } }     (lista única persistente)
//   /listas/<clave>/lista/shopping  = boolean                                  (¿hay compra en curso?)

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDVodEI4q1k280O50xvb5gnzLN_IPtxZrI",
  authDomain: "list-e9e7f.firebaseapp.com",
  databaseURL: "https://list-e9e7f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "list-e9e7f",
  storageBucket: "list-e9e7f.firebasestorage.app",
  messagingSenderId: "697517057614",
  appId: "1:697517057614:web:5455360840bd731514c51f",
  measurementId: "G-78JLP37GHN"
};

const KEY_STORAGE = 'lista-compra-key-v1';
const $ = (id) => document.getElementById(id);

// ============================================================
// FIREBASE INIT
// ============================================================

let fb = { available: false };

async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');
    const app = initializeApp(FIREBASE_CONFIG);
    const database = dbMod.getDatabase(app);
    fb = {
      db: database,
      ref: dbMod.ref,
      onValue: dbMod.onValue,
      set: dbMod.set,
      update: dbMod.update,
      remove: dbMod.remove,
      available: true
    };
    return true;
  } catch (e) {
    console.warn('Firebase no disponible, modo local:', e);
    return false;
  }
}

// ============================================================
// ESTADO LOCAL
// ============================================================

const state = {
  key: localStorage.getItem(KEY_STORAGE) || null,
  master: {},
  lista: {},          // la lista única persistente de la compra
  shopping: false,    // ¿hay una compra en curso?
  addQuery: '',
  connected: false
};

function persistLocal() {
  try {
    if (state.key) {
      localStorage.setItem(`lista-cache-${state.key}`, JSON.stringify({
        master: state.master,
        lista: state.lista,
        shopping: state.shopping
      }));
    }
  } catch {}
}

function loadLocalCache() {
  if (!state.key) return null;
  try {
    const raw = localStorage.getItem(`lista-cache-${state.key}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ============================================================
// KEY / AUTH-LITE
// ============================================================

function sanitizeKey(raw) {
  return (raw || '').trim().toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function generateKey() {
  const words = ['leche','pan','cafe','queso','fruta','arroz','huevo','agua','pera','luna','sol','flor','mar','rio','verde','sal'];
  const a = words[Math.floor(Math.random()*words.length)];
  const b = words[Math.floor(Math.random()*words.length)];
  const c = Math.random().toString(36).slice(2, 6);
  return `${a}-${b}-${c}`;
}

async function setKey(key) {
  state.key = key;
  localStorage.setItem(KEY_STORAGE, key);
  await connectToFirebase();
  render();
}

async function connectToFirebase() {
  if (!fb.available || !state.key) {
    state.connected = false;
    return;
  }

  fb.onValue(fb.ref(fb.db, dbPath('master/items')), (snap) => {
      state.master = snap.val() || {};
      persistLocal();
      renderMaster();
      renderShop();
    });
    fb.onValue(fb.ref(fb.db, dbPath('lista/items')), (snap) => {
          state.lista = snap.val() || {};
          persistLocal();
          renderShop();
          renderMaster();
        });
        fb.onValue(fb.ref(fb.db, dbPath('lista/shopping')), (snap) => {
          state.shopping = !!snap.val();
          persistLocal();
          renderShop();
          renderMaster();
        });
    fb.onValue(fb.ref(fb.db, '.info/connected'), (snap) => {
      state.connected = !!snap.val();
      renderSyncStatus();
    });
}

function renderSyncStatus() {
  const dot = document.querySelector('.sync-dot');
  const lbl = $('sync-label');
  if (!dot || !lbl) return;
  if (state.connected) {
    dot.style.background = 'var(--primary)';
    lbl.textContent = 'Conectado';
  } else {
    dot.style.background = 'var(--outline)';
    lbl.textContent = 'Sin conexión';
  }
}

// ============================================================
// OPERACIONES
// ============================================================

function dbPath(subpath) { return `listas/${state.key}/${subpath}`; }

async function addToMaster(nameRaw) {
  const name = nameRaw.trim();
  if (!name) return;
  const key = name.toLowerCase();
  if (state.master[key]) {
    showToast(`"${name}" ya está en el catálogo`, true);
    return;
  }
  if (!fb.available) {
    state.master[key] = name;
    persistLocal();
    renderMaster();
    renderShop();
    showToast(`"${name}" añadido al catálogo (local)`);
    return;
  }
  await fb.set(fb.ref(fb.db, dbPath(`master/items/${key}`)), name);
  showToast(`"${name}" añadido al catálogo`);
}

async function removeFromMaster(key) {
  const name = state.master[key];
  if (!fb.available) {
    delete state.master[key];
    persistLocal();
    renderMaster();
    renderShop();
    return;
  }
  await fb.remove(fb.ref(fb.db, dbPath(`master/items/${key}`)));
  showToast(`"${name}" eliminado del catálogo`);
}

async function addToLista(key) {
  if (!state.master[key]) return;
  if (state.lista[key]) return; // ya está en la lista
  const item = { name: state.master[key], inCart: false, ts: Date.now() };
  if (!fb.available) {
    state.lista[key] = item;
    persistLocal();
    renderShop();
    return;
  }
  await fb.update(fb.ref(fb.db, dbPath('lista/items')), { [key]: item });
}

async function removeFromLista(key) {
  if (!state.lista[key]) return;
  if (state.shopping) return; // en modo compra no se puede borrar
  if (!fb.available) {
    delete state.lista[key];
    persistLocal();
    renderShop();
    return;
  }
  await fb.remove(fb.ref(fb.db, dbPath(`lista/items/${key}`)));
}

async function startShopping() {
  const total = Object.keys(state.lista).length;
  if (total === 0) return;
  if (state.shopping) return;
  // Reset de checks (por si quedó algo a medias) + marcar modo compra.
  const reset = {};
  const ts = Date.now();
  for (const k of Object.keys(state.lista)) {
    reset[k] = { name: state.lista[k].name, inCart: false, ts };
  }
  if (!fb.available) {
    state.lista = reset;
    state.shopping = true;
    persistLocal();
    renderShop();
    showToast(`Compra iniciada (local): ${total} productos`);
    return;
  }
  await fb.set(fb.ref(fb.db, dbPath('lista/items')), reset);
  await fb.set(fb.ref(fb.db, dbPath('lista/shopping')), true);
  showToast(`Compra iniciada: ${total} productos`);
}

async function toggleInCart(key) {
  if (!state.shopping) return;
  const item = state.lista[key];
  if (!item) return;
  const next = { ...item, inCart: !item.inCart, ts: Date.now() };
  if (!fb.available) {
    state.lista[key] = next;
    persistLocal();
    renderShop();
    return;
  }
  await fb.update(fb.ref(fb.db, dbPath('lista/items')), { [key]: next });
}

// Finalizar compra = salir del modo compra Y vaciar la lista única.
async function finishShopping() {
  const count = Object.keys(state.lista).length;
  const done = Object.values(state.lista).filter(x => x.inCart).length;
  if (!fb.available) {
    state.lista = {};
    state.shopping = false;
    persistLocal();
    renderShop();
    showToast(`Compra finalizada (local): ${done}/${count}`);
    return;
  }
  await fb.set(fb.ref(fb.db, dbPath('lista/items')), null);
  await fb.set(fb.ref(fb.db, dbPath('lista/shopping')), false);
  showToast(`Compra finalizada: ${done}/${count}`);
}

async function deleteList() {
  if (!fb.available) {
    state.master = {}; state.lista = {}; state.shopping = false;
    persistLocal();
    render();
    showToast('Lista borrada (local)');
    return;
  }
  await fb.remove(fb.ref(fb.db, dbPath('')));
  localStorage.removeItem(`lista-cache-${state.key}`);
  showToast('Lista borrada del servidor');
}

// ============================================================
// RENDER
// ============================================================

function render() {
  renderShop();
  renderMaster();
  renderSyncStatus();
}

function renderShop() {
  const content = $('shop-content');
  const editBox = $('shop-edit');
  const activeBox = $('shop-active');
  const emptyState = $('shop-empty-state');
  if (!content) return;

  content.hidden = false;
  const listaKeys = Object.keys(state.lista);
  const total = listaKeys.length;
  const masterCount = Object.keys(state.master).length;

  // Modo compra: barra de progreso, checks, finalizar
  if (state.shopping && total > 0) {
    editBox.hidden = true;
    activeBox.hidden = false;
    emptyState.hidden = true;
    renderActive();
    return;
  }

  // Modo rellenar entre días (lista tiene items)
  activeBox.hidden = true;
  if (total > 0) {
    editBox.hidden = false;
    emptyState.hidden = true;
    renderEdit();
    return;
  }

  // Lista vacía
  editBox.hidden = true;
  emptyState.hidden = false;
  const emptyTitle = emptyState.querySelector('.empty-title');
  const emptyText = emptyState.querySelector('.empty-text');
  const goBtn = $('btn-go-master');
  if (masterCount === 0) {
    if (emptyTitle) emptyTitle.textContent = 'Tu catálogo está vacío';
    if (emptyText) emptyText.innerHTML = 'Añade los productos que sueles comprar en la pestaña <strong>Catálogo</strong>. Después vuelve aquí para ir apuntando lo que necesites.';
    if (goBtn) goBtn.textContent = 'Ir al catálogo';
  } else {
    if (emptyTitle) emptyTitle.textContent = 'Tu lista está vacía';
    if (emptyText) emptyText.innerHTML = 'Usa el buscador para añadir productos del catálogo. Apúntalos poco a poco entre días y cuando vayas al súper, pulsa <strong>Iniciar compra</strong>.';
    if (goBtn) goBtn.textContent = 'Ir al catálogo';
  }
}

function renderActive() {
  const list = $('shop-list');
  if (!list) return;
  list.innerHTML = '';

  const keys = Object.keys(state.lista);
  const sorted = keys.map(k => ({ k, ...state.lista[k] })).sort((a, b) => (a.ts||0) - (b.ts||0));

  sorted.forEach((item) => {
    const li = document.createElement('li');
    li.className = item.inCart ? 'done' : '';
    li.dataset.key = item.k;
    li.innerHTML = `
      <div class="body">
        <span class="checkbox-circle">✓</span>
        <span class="name"></span>
      </div>
    `;
    li.querySelector('.name').textContent = item.name;
    li.addEventListener('click', () => toggleInCart(item.k));
    list.appendChild(li);
  });

  const total = sorted.length;
  const done = sorted.filter(x => x.inCart).length;
  $('progress-pill').textContent = `${done} / ${total}`;
  $('progress-fill').style.width = total ? `${(done / total) * 100}%` : '0%';
  $('pending-counter').textContent = `${total - done} pendientes`;
  $('cart-counter').textContent = `${done} en carrito`;
}

function renderEdit() {
  const counter = $('edit-counter');
  const startBtn = $('btn-start-shop');
  const search = $('add-search');
  const ulLista = $('lista-edit');
  const emptyLista = $('lista-edit-empty');
  if (!ulLista) return;

  if (search && search.value !== state.addQuery) {
    search.value = state.addQuery;
  }

  // Lista persistente (con botón ×). Solo lo que el usuario añadió desde el catálogo.
  ulLista.innerHTML = '';
  const keys = Object.keys(state.lista);
  keys.sort((a, b) => state.lista[a].name.localeCompare(state.lista[b].name, 'es'));
  keys.forEach((k) => {
    const item = state.lista[k];
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="body">
        <span class="name"></span>
      </div>
      <button class="remove" aria-label="Borrar">×</button>
    `;
    li.querySelector('.name').textContent = item.name;
    li.querySelector('.remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromLista(k);
    });
    ulLista.appendChild(li);
  });

  if (emptyLista) emptyLista.hidden = keys.length > 0;

  const listaCount = keys.length;
  counter.textContent = `${listaCount} producto${listaCount === 1 ? '' : 's'}`;
  startBtn.disabled = listaCount === 0;
}

function renderMaster() {
  const list = $('master-list');
  const empty = $('add-empty');
  const noResults = $('add-no-results');
  const counter = $('master-counter');
  const storageSubtitle = $('storage-subtitle');
  if (!list) return;

  list.innerHTML = '';
  const keys = Object.keys(state.master);
  const count = keys.length;

  // Cuántos están en la lista de la compra ahora mismo
  const inLista = Object.keys(state.lista).length;
  counter.textContent = `${count} producto${count === 1 ? '' : 's'} guardado${count === 1 ? '' : 's'}${inLista > 0 ? ` · ${inLista} en la lista` : ''}`;
  if (storageSubtitle) storageSubtitle.textContent = `Clave activa: ${state.key || '—'}`;

  if (count === 0) {
    empty.hidden = false;
    if (noResults) noResults.hidden = true;
    return;
  }
  empty.hidden = true;

  const q = (state.addQuery || '').trim().toLowerCase();
  const sorted = keys.slice().sort((a, b) => state.master[a].localeCompare(state.master[b], 'es'));
  const filtered = q ? sorted.filter(k => state.master[k].toLowerCase().includes(q)) : sorted;

  if (noResults) noResults.hidden = filtered.length > 0;
  if (filtered.length === 0) return;

  filtered.forEach((k) => {
    const name = state.master[k];
    const inCart = !!state.lista[k];
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="body">
        <span class="name"></span>
      </div>
      <button class="add-to-lista" aria-label="${inCart ? 'Quitar de la lista' : 'Añadir a la lista'}" title="${inCart ? 'Quitar de la lista' : 'Añadir a la lista'}">${inCart ? '✓' : '🛒'}</button>
      <button class="remove" aria-label="Borrar">×</button>
    `;
    li.querySelector('.name').textContent = name;
    const addBtn = li.querySelector('.add-to-lista');
    addBtn.classList.toggle('in-cart', inCart);
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.shopping) {
        showToast('Finaliza la compra actual para modificar la lista', true);
        return;
      }
      if (inCart) {
        removeFromLista(k);
      } else {
        addToLista(k);
      }
    });
    li.querySelector('.remove').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDialog(`¿Borrar "${name}" del catálogo?`, () => removeFromMaster(k));
    });
    list.appendChild(li);
  });
}

// ============================================================
// TABS
// ============================================================

let currentView = 'shop';
function switchView(target) {
  currentView = target;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === target));
  document.querySelectorAll('.view').forEach(v => { if (v.closest('#app-shell')) v.hidden = true; });
  $(`view-${target}`).hidden = false;
  render();
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ============================================================
// KEY SCREEN
// ============================================================

let keyMode = 'join';
let pendingCreatedKey = null;

function showKeyScreen() {
  $('app-shell').hidden = true;
  $('view-key').hidden = false;
  $('key-created').hidden = true;
  $('key-error').hidden = true;
  $('key-input').value = state.key || '';
  $('key-input').focus();
}

function showApp() {
  $('view-key').hidden = true;
  $('app-shell').hidden = false;
  render();
}

$('mode-join').addEventListener('click', () => {
  keyMode = 'join';
  $('mode-join').classList.add('active');
  $('mode-create').classList.remove('active');
  $('key-title').textContent = 'Conectar a una lista';
  $('key-text').textContent = 'Pega la clave compartida que te pasó tu pareja.';
  $('key-input').placeholder = 'Ej: compras-molina-2026';
  $('key-submit').textContent = 'Conectar';
  $('key-created').hidden = true;
  $('key-input').value = '';
  $('key-error').hidden = true;
});

$('mode-create').addEventListener('click', () => {
  keyMode = 'create';
  $('mode-create').classList.add('active');
  $('mode-join').classList.remove('active');
  $('key-title').textContent = 'Crear una lista nueva';
  $('key-text').textContent = 'Generaremos una clave. Compártela con tu pareja para que se conecte.';
  $('key-input').placeholder = 'Personaliza la clave (opcional)';
  $('key-submit').textContent = 'Crear y conectar';
  $('key-created').hidden = true;
  $('key-input').value = '';
  $('key-error').hidden = true;
  pendingCreatedKey = null;
});

$('key-submit').addEventListener('click', async () => {
  const raw = $('key-input').value.trim();
  const finalKey = sanitizeKey(raw || (keyMode === 'create' ? generateKey() : ''));
  if (!finalKey) {
    $('key-error').textContent = 'La clave no puede estar vacía.';
    $('key-error').hidden = false;
    return;
  }

  if (keyMode === 'create') {
    if (!pendingCreatedKey) {
      pendingCreatedKey = finalKey;
      $('key-display').textContent = finalKey;
      $('key-created').hidden = false;
      $('key-submit').textContent = 'Entrar a la lista';
      return;
    }
    await setKey(pendingCreatedKey);
    showApp();
  } else {
    await setKey(finalKey);
    showApp();
  }
});

$('copy-key').addEventListener('click', () => {
  const k = $('key-display').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(k).then(() => showToast('Clave copiada'));
  } else {
    showToast(k);
  }
});

$('btn-change-key').addEventListener('click', () => {
  confirmDialog('¿Cambiar de lista? Te desconectarás de la actual.', () => {
    localStorage.removeItem(KEY_STORAGE);
    state.key = null;
    state.master = {};
    state.lista = {};
    state.shopping = false;
    pendingCreatedKey = null;
    showKeyScreen();
  });
});

// ============================================================
// FORM / BUTTONS
// ============================================================

$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('add-input');
  addToMaster(input.value);
  input.value = '';
  input.focus();
});

$('btn-start-shop').addEventListener('click', startShopping);
$('add-search').addEventListener('input', (e) => {
  state.addQuery = e.target.value;
  renderMaster();
});
$('btn-finish-shop').addEventListener('click', () => {
  const total = Object.keys(state.lista).length;
  const done = Object.values(state.lista).filter(x => x.inCart).length;
  const und = total - done;
  if (und > 0) {
    confirmDialog(`Te quedan ${und} producto${und === 1 ? '' : 's'} sin marcar. ¿Finalizar y vaciar la lista de todas formas?`, () => finishShopping());
  } else {
    finishShopping();
  }
});
$('btn-go-master').addEventListener('click', () => switchView('master'));

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({
    master: state.master,
    lista: state.lista,
    shopping: state.shopping
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-compra-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Lista exportada');
});

$('btn-reset').addEventListener('click', () => {
  confirmDialog('¿Borrar esta lista compartida? Tu pareja también la perderá.', () => deleteList());
});

// ============================================================
// DIALOG / TOAST
// ============================================================

const dialog = $('confirm-dialog');
let pendingOnOk = null;
let pendingFired = false;

dialog.addEventListener('close', () => {
  if (pendingFired) return;
  pendingFired = true;
  const ok = dialog.returnValue === 'ok';
  const cb = pendingOnOk;
  pendingOnOk = null;
  if (ok && cb) cb();
});

function confirmDialog(text, onOk) {
  $('confirm-text').textContent = text;
  pendingOnOk = onOk;
  pendingFired = false;
  dialog.returnValue = ''; // reset
  dialog.showModal();
}

let toastTimeout;
function showToast(msg, isError = false) {
  const toast = $('toast');
  $('toast-msg').textContent = msg;
  $('toast-icon').textContent = isError ? '⚠' : '✓';
  $('toast-icon').style.color = isError ? '#FFB3B0' : '#9FD49B';
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 2500);
}

// ============================================================
// INIT
// ============================================================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

(async function main() {
  if (state.key) {
      const cached = loadLocalCache();
      if (cached) {
        state.master = cached.master || {};
        state.lista = cached.lista || {};
        state.shopping = !!cached.shopping;
      }
    }

  const fbOk = await initFirebase();
  if (fbOk && state.key) {
    await connectToFirebase();
    showApp();
  } else if (!state.key) {
    showKeyScreen();
  } else {
    showApp();
  }
  render();
})();
