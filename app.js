// Lista de la compra — PWA minimalista, localStorage, sin servidor.
// Estado: { master: [string], active: [{name, inCart}] }

const STORAGE_KEY = 'lista-compra-v1';

const state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migración defensiva
      return {
        master: Array.isArray(parsed.master) ? parsed.master : [],
        active: Array.isArray(parsed.active) ? parsed.active : []
      };
    }
  } catch (e) { /* ignore */ }
  return { master: [], active: [] };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const $ = (id) => document.getElementById(id);

// ===================== RENDER =====================

function render() {
  renderShop();
  renderMaster();
}

function renderShop() {
  const list = $('shop-list');
  const empty = $('shop-empty');
  const activeBox = $('shop-active');
  const emptyState = $('shop-empty-state');
  const progress = $('shop-progress');

  list.innerHTML = '';

  const inActive = state.active.length > 0;

  // Toggle entre lista activa y empty-state
  emptyState.hidden = inActive;
  activeBox.hidden = !inActive;
  progress.hidden = !inActive;

  if (!inActive) {
    // Empty state: ¿hay productos en maestra para ofrecer iniciar compra?
    const mini = $('empty-master-status');
    const miniCount = $('mini-count');
    if (state.master.length === 0) {
      mini.hidden = true;
    } else {
      mini.hidden = false;
      miniCount.textContent = `${state.master.length} productos en la Maestra`;
    }
    return;
  }

  empty.hidden = state.active.length > 0;

  state.active.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = item.inCart ? 'done' : '';
    li.innerHTML = `
      <div class="body">
        <span class="checkbox-circle">✓</span>
        <span class="name"></span>
      </div>
    `;
    li.querySelector('.name').textContent = item.name;
    li.addEventListener('click', () => toggleInCart(idx));
    list.appendChild(li);
  });

  // Progress
  const total = state.active.length;
  const done = state.active.filter(x => x.inCart).length;
  $('progress-pill').textContent = `${done} / ${total}`;
  $('progress-fill').style.width = total ? `${(done / total) * 100}%` : '0%';
  $('pending-counter').textContent = `${total - done} pendientes`;
  $('cart-counter').textContent = `${done} en carrito`;
}

function renderMaster() {
  const list = $('master-list');
  const empty = $('master-empty');
  const counter = $('master-counter');
  list.innerHTML = '';
  counter.textContent = `${state.master.length} producto${state.master.length === 1 ? '' : 's'} guardado${state.master.length === 1 ? '' : 's'}`;

  if (state.master.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  state.master.forEach((name, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="body">
        <span class="name"></span>
      </div>
      <button class="remove" aria-label="Borrar">×</button>
    `;
    li.querySelector('.name').textContent = name;
    li.querySelector('.remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromMaster(idx);
    });
    list.appendChild(li);
  });
}

// ===================== ACCIONES =====================

function addToMaster(name) {
  name = name.trim();
  if (!name) return;
  if (state.master.some(n => n.toLowerCase() === name.toLowerCase())) {
    showToast(`"${name}" ya está en la lista`, true);
    return;
  }
  state.master.push(name);
  save();
  renderMaster();
  showToast(`"${name}" añadido a la Maestra`);
}

function removeFromMaster(idx) {
  const name = state.master[idx];
  confirmDialog(`¿Borrar "${name}" de la lista maestra?`, () => {
    state.master.splice(idx, 1);
    save();
    renderMaster();
    showToast(`"${name}" eliminado`);
  });
}

function startShopping() {
  if (state.active.length > 0) return;
  if (state.master.length === 0) {
    showToast('Añade productos primero a la Maestra', true);
    switchView('master');
    return;
  }
  state.active = state.master.map(name => ({ name, inCart: false }));
  save();
  renderShop();
  showToast('Compra iniciada: ' + state.active.length + ' productos');
}

function toggleInCart(idx) {
  state.active[idx].inCart = !state.active[idx].inCart;
  save();
  renderShop();
}

function endShopping() {
  confirmDialog(
    `¿Terminar compra? Se borrarán los ${state.active.length} productos de la lista activa.`,
    () => {
      state.active = [];
      save();
      renderShop();
      showToast('Compra finalizada');
    }
  );
}

// ===================== TABS =====================

let currentView = 'shop';
function switchView(target) {
  currentView = target;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === target));
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  $(`view-${target}`).hidden = false;
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    switchView(btn.dataset.view);
    render();
  });
});

// ===================== FORM (Maestra) =====================

$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('add-input');
  addToMaster(input.value);
  input.value = '';
  input.focus();
});

$('btn-start-shop').addEventListener('click', startShopping);
$('btn-go-master').addEventListener('click', () => switchView('master'));

// ===================== IMPORT / EXPORT / RESET =====================

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-compra-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Lista exportada');
});

$('btn-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.master) || !Array.isArray(data.active)) throw new Error('formato');
      confirmDialog('¿Reemplazar la lista actual con los datos importados?', () => {
        state.master = data.master;
        state.active = data.active;
        save();
        render();
        showToast('Lista importada');
      });
    } catch (err) {
      showToast('Archivo no válido', true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('btn-reset').addEventListener('click', () => {
  confirmDialog('Esto borrará TODOS los datos. ¿Seguro?', () => {
    localStorage.removeItem(STORAGE_KEY);
    state.master = [];
    state.active = [];
    render();
    showToast('Todos los datos eliminados');
  });
});

// ===================== DIALOG =====================

const dialog = $('confirm-dialog');
function confirmDialog(text, onOk) {
  $('confirm-text').textContent = text;
  dialog.showModal();
  const ok = $('confirm-ok');
  const handler = () => {
    ok.removeEventListener('click', handler);
    if (dialog.returnValue === 'ok') onOk();
  };
  ok.addEventListener('click', handler);
}

// ===================== TOAST =====================

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

// ===================== INIT =====================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
