// Lista de la compra — PWA minimalista, localStorage, sin servidor.
// Datos: { master: [producto...], active: [ {name, inCart} ] }

const STORAGE_KEY = 'lista-compra-v1';

const state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { master: [], active: [] };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- RENDER ----------

const $ = (id) => document.getElementById(id);

function render() {
  renderShop();
  renderMaster();
  renderStatus();
}

function renderShop() {
  const ul = $('shop-list');
  const empty = $('shop-empty');
  const endBtn = $('btn-end-shop');
  ul.innerHTML = '';

  if (state.active.length === 0) {
    empty.hidden = false;
    endBtn.hidden = true;
    return;
  }

  empty.hidden = true;
  endBtn.hidden = false;

  state.active.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = item.inCart ? 'done' : '';
    li.innerHTML = `
      <span class="check"></span>
      <span class="name"></span>
    `;
    li.querySelector('.name').textContent = item.name;
    li.addEventListener('click', () => toggleInCart(idx));
    ul.appendChild(li);
  });
}

function renderMaster() {
  const ul = $('master-list');
  const empty = $('master-empty');
  ul.innerHTML = '';

  if (state.master.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  state.master.forEach((name, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="name"></span>
      <button class="remove" aria-label="Borrar">×</button>
    `;
    li.querySelector('.name').textContent = name;
    li.querySelector('.remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromMaster(idx);
    });
    ul.appendChild(li);
  });
}

function renderStatus() {
  const total = state.active.length;
  const inCart = state.active.filter(x => x.inCart).length;
  $('status').textContent = total === 0
    ? 'Sin compra activa'
    : `Compra activa: ${inCart}/${total} en el carrito`;
}

// ---------- ACCIONES ----------

function addToMaster(name) {
  name = name.trim();
  if (!name) return;
  if (state.master.some(n => n.toLowerCase() === name.toLowerCase())) return;
  state.master.push(name);
  save();
  renderMaster();
}

function removeFromMaster(idx) {
  confirmDialog(`¿Borrar "${state.master[idx]}" de la lista maestra?`, () => {
    state.master.splice(idx, 1);
    save();
    renderMaster();
  });
}

function startShopping() {
  if (state.active.length > 0) return; // ya hay una activa
  state.active = state.master.map(name => ({ name, inCart: false }));
  save();
  render();
}

function toggleInCart(idx) {
  state.active[idx].inCart = !state.active[idx].inCart;
  save();
  renderShop();
  renderStatus();
}

function endShopping() {
  confirmDialog(
    `¿Terminar compra? Se borrarán los ${state.active.length} productos de la lista activa.`,
    () => {
      state.active = [];
      save();
      render();
    }
  );
}

// ---------- TABS ----------

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.view').forEach(v => v.hidden = true);
    $(`view-${target}`).hidden = false;
    if (target === 'shop' && state.active.length === 0) startShopping();
  });
});

// ---------- FORM ----------

$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('add-input');
  addToMaster(input.value);
  input.value = '';
  input.focus();
});

$('btn-end-shop').addEventListener('click', endShopping);

// ---------- IMPORT / EXPORT / RESET ----------

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista-compra-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
      });
    } catch (err) {
      alert('Archivo no válido.');
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
  });
});

// ---------- DIALOG ----------

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

// ---------- INIT ----------

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
