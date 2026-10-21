(() => {
  'use strict';
  const app = document.getElementById('app');
  const state = { user: null, sections: [], artworkFields: [], values: {}, artworks: [], dirty: {}, imgViews: {}, view: 'general', editing: null };

  // ---------- helpers ----------
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const kid of kids.flat()) { if (kid == null || kid === false) continue; e.append(kid.nodeType ? kid : document.createTextNode(kid)); }
    return e;
  };
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  function toast(msg, type) {
    const t = h('div', { class: 'toast' + (type === 'error' ? ' error' : '') }, msg);
    document.getElementById('toasts').append(t);
    setTimeout(() => t.remove(), type === 'error' ? 6000 : 3000);
  }

  async function api(method, path, body, opts = {}) {
    const headers = { 'X-CSRF': '1' };
    let payload;
    if (opts.file) { headers['Content-Type'] = opts.file.type || 'application/octet-stream'; payload = opts.file; }
    else if (body !== undefined && body !== null) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 && path !== '/api/login') {
      const first = state.user === null; // primer intento al abrir el panel: no hay sesión todavía
      state.user = null;
      if (!first) renderLogin('Tu sesión expiró. Vuelve a entrar.');
      throw new Error('Sesión expirada');
    }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  const fmtKB = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');
  const dirtyCount = () => Object.keys(state.dirty).length;
  const current = (key) => (key in state.dirty ? state.dirty[key] : state.values[key]);

  // ---------- login ----------
  function renderLogin(msg) {
    clear(app);
    const err = h('div', { class: 'err hidden' });
    if (msg) { err.textContent = msg; err.classList.remove('hidden'); }
    const user = h('input', { type: 'text', id: 'u', autocomplete: 'username', required: true, autofocus: true });
    const pass = h('input', { type: 'password', id: 'p', autocomplete: 'current-password', required: true });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Entrar');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault(); btn.disabled = true; err.classList.add('hidden');
        try {
          await api('POST', '/api/login', { username: user.value, password: pass.value });
          await boot();
        } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); btn.disabled = false; pass.value = ''; pass.focus(); }
      },
    },
      err,
      h('div', null, h('label', { class: 'lbl', for: 'u' }, 'Usuario'), user),
      h('div', null, h('label', { class: 'lbl', for: 'p' }, 'Contraseña'), pass),
      btn);
    app.append(h('div', { class: 'login-wrap' }, h('div', { class: 'login-card' },
      h('div', { class: 'brand' }, 'ICCA', h('small', null, 'PANEL DE CONTENIDO')), form)));
  }

  // ---------- widgets ----------
  function imageField({ getView, onChange, big }) {
    const wrap = h('div', { class: 'img-field' });
    const prev = h('div', { class: 'img-prev' });
    const meta = h('div', { class: 'img-meta' });
    const input = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
    const pick = h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, 'Subir / cambiar imagen');
    const paint = () => {
      const v = getView();
      clear(prev); clear(meta);
      if (v) {
        prev.append(h('img', { src: v.thumb, alt: '' }));
        const parts = [`${v.w}×${v.h}px`];
        meta.append(parts.join(' · '), ' · ');
        const opt = v.srcBytes ? h('b', null, `${fmtKB(v.srcBytes)} → ${v.kb} KB WebP`) : h('b', null, `${v.kb} KB, WebP optimizado`);
        meta.append(opt);
      } else { prev.append('Sin imagen'); meta.append('Arrastra una imagen aquí o usa el botón.'); }
    };
    async function upload(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) return toast('Ese archivo no es una imagen.', 'error');
      prev.classList.add('busy');
      try {
        const { image } = await api('POST', '/api/admin/images', null, { file });
        state.imgViews[image.id] = image;
        onChange(image); paint();
      } catch (e) { toast(e.message, 'error'); }
      finally { prev.classList.remove('busy'); input.value = ''; }
    }
    input.addEventListener('change', () => upload(input.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => prev.addEventListener(ev, (e) => { e.preventDefault(); prev.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => prev.addEventListener(ev, (e) => { e.preventDefault(); prev.classList.remove('drag'); }));
    prev.addEventListener('drop', (e) => upload(e.dataTransfer.files[0]));
    prev.addEventListener('click', () => input.click());
    paint();
    wrap.append(prev, h('div', null, meta, pick, input));
    return wrap;
  }

  function textField(f, get, set) {
    const isArea = f.type === 'textarea';
    const el = h(isArea ? 'textarea' : 'input', isArea ? { maxlength: f.max, rows: 3 } : { type: f.type === 'url' ? 'url' : 'text', maxlength: f.max });
    el.value = get() || '';
    const counter = h('span', { class: 'counter' }, f.max ? `${el.value.length}/${f.max}` : '');
    el.addEventListener('input', () => { counter.textContent = f.max ? `${el.value.length}/${f.max}` : ''; set(el.value); });
    return { el, counter };
  }

  function listField(f, key) {
    const box = h('div');
    const get = () => JSON.parse(JSON.stringify(current(key) || []));
    const commit = (arr) => setDirty(key, arr);
    const paint = () => {
      clear(box);
      const items = get();
      items.forEach((it, i) => {
        const row = h('div', { class: 'list-item' });
        row.append(h('div', { class: 'row-head' }, `CARTA ${i + 1}`, h('div', { class: 'row-actions' },
          h('button', { class: 'btn small', type: 'button', disabled: i === 0, onclick: () => { const a = get(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; commit(a); paint(); } }, '↑'),
          h('button', { class: 'btn small', type: 'button', disabled: i === items.length - 1, onclick: () => { const a = get(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; commit(a); paint(); } }, '↓'),
          h('button', { class: 'btn small danger', type: 'button', onclick: () => { if (confirm('¿Quitar esta carta?')) { const a = get(); a.splice(i, 1); commit(a); paint(); } } }, 'Quitar'))));
        for (const sf of f.itemFields) {
          const { el, counter } = textField(sf, () => it[sf.key], (v) => { const a = get(); a[i][sf.key] = v; commit(a); });
          row.append(h('div', { class: 'field' }, h('label', { class: 'lbl' }, sf.label, counter), el));
        }
        box.append(row);
      });
      if (items.length < (f.max || 20)) {
        box.append(h('button', { class: 'btn', type: 'button', onclick: () => { const a = get(); a.push(Object.fromEntries(f.itemFields.map((x) => [x.key, '']))); commit(a); paint(); } }, '+ ' + (f.addLabel || 'Agregar')));
      }
    };
    paint();
    return box;
  }

  function setDirty(key, val) {
    const orig = state.values[key];
    const f = fieldDef(key);
    let same;
    if (f.type === 'image') same = (orig ? orig.id : '') === (val || '');
    else if (f.type === 'list') same = JSON.stringify(orig) === JSON.stringify(val);
    else same = orig === val;
    if (same) delete state.dirty[key]; else state.dirty[key] = val;
    updateSavebar();
  }
  const fieldDef = (key) => { for (const s of state.sections) for (const f of s.fields) if (f.key === key) return f; };

  function fieldRow(f) {
    if (f.type === 'image') {
      return h('div', { class: 'field' }, h('label', { class: 'lbl' }, f.label),
        imageField({
          getView: () => (f.key in state.dirty ? (state.dirty[f.key] ? state.imgViews[state.dirty[f.key]] : null) : state.values[f.key]),
          onChange: (img) => setDirty(f.key, img.id),
        }), f.help && h('div', { class: 'help' }, f.help));
    }
    if (f.type === 'list') return h('div', { class: 'field' }, h('label', { class: 'lbl' }, f.label), listField(f, f.key));
    const { el, counter } = textField(f, () => current(f.key), (v) => setDirty(f.key, v));
    return h('div', { class: 'field' }, h('label', { class: 'lbl' }, f.label, counter), el, f.help && h('div', { class: 'help' }, f.help));
  }

  // ---------- vistas ----------
  function renderSection(sec) {
    const main = h('div');
    main.append(h('div', { class: 'head' },
      h('div', null, h('h1', null, sec.title), h('p', null, sec.desc)),
      sec.link && h('a', { class: 'btn', href: sec.link, target: '_blank', rel: 'noopener' }, 'Ver en el sitio ↗')));
    // agrupa campos por "obra N" en destacadas
    let cards = [], cur = null, curGroup = null;
    for (const f of sec.fields) {
      const m = f.key.match(/^featured_(\d)_/);
      const group = m ? 'Obra ' + m[1] : null;
      if (!cur || group !== curGroup) { cur = []; cards.push({ group, fields: cur }); curGroup = group; }
      cur.push(f);
    }
    for (const c of cards) {
      const card = h('div', { class: 'card' });
      if (c.group) card.append(h('div', { class: 'group-title' }, c.group));
      c.fields.forEach((f) => card.append(fieldRow(f)));
      main.append(card);
    }
    return main;
  }

  function renderArtworks() {
    const main = h('div');
    main.append(h('div', { class: 'head' },
      h('div', null, h('h1', null, 'Obras de la galería'), h('p', null, 'Las obras que se ven en la página de Galería. El orden de aquí es el orden en el sitio.')),
      h('div', null,
        h('a', { class: 'btn', href: '/galeria.html', target: '_blank', rel: 'noopener' }, 'Ver galería ↗'), ' ',
        h('button', { class: 'btn primary', onclick: () => { state.editing = { draft: { published: true }, isNew: true }; render(); } }, '+ Nueva obra'))));
    if (!state.artworks.length) {
      main.append(h('div', { class: 'empty' }, 'Aún no hay obras. Agrega la primera con “Nueva obra”.'));
      return main;
    }
    const grid = h('div', { class: 'art-grid' });
    state.artworks.forEach((a, i) => {
      const move = async (d) => {
        const j = i + d; if (j < 0 || j >= state.artworks.length) return;
        [state.artworks[i], state.artworks[j]] = [state.artworks[j], state.artworks[i]];
        render();
        try { await api('POST', '/api/admin/artworks/reorder', { ids: state.artworks.map((x) => x.id) }); } catch (e) { toast(e.message, 'error'); }
      };
      grid.append(h('div', { class: 'art-card' },
        h('div', { class: 'thumb' }, a.image && h('img', { src: a.image.thumb, alt: '', loading: 'lazy' }), !a.published && h('span', { class: 'badge' }, 'Oculta')),
        h('div', { class: 'info' }, h('h3', null, a.title), h('div', { class: 'sub' }, [a.year, a.category].filter(Boolean).join(' · '))),
        h('div', { class: 'acts' },
          h('button', { class: 'btn small', title: 'Mover antes', disabled: i === 0, onclick: () => move(-1) }, '←'),
          h('button', { class: 'btn small', title: 'Mover después', disabled: i === state.artworks.length - 1, onclick: () => move(1) }, '→'),
          h('button', { class: 'btn small primary', onclick: () => { state.editing = { draft: JSON.parse(JSON.stringify(a)), id: a.id }; render(); } }, 'Editar'))));
    });
    main.append(grid);
    return main;
  }

  function renderArtworkEditor() {
    const { draft, isNew, id } = state.editing;
    const main = h('div');
    main.append(h('div', { class: 'head' },
      h('div', null, h('h1', null, isNew ? 'Nueva obra' : 'Editar obra'), h('p', null, 'Lo que escribas aquí aparece en el modal de la galería.')),
      h('button', { class: 'btn', onclick: () => { state.editing = null; render(); } }, '← Volver')));
    const card = h('div', { class: 'card' });
    for (const f of state.artworkFields) {
      if (f.type === 'image') {
        card.append(h('div', { class: 'field' }, h('label', { class: 'lbl' }, f.label + ' *'),
          imageField({ getView: () => draft.image, onChange: (img) => { draft.image = img; } })));
      } else {
        const { el, counter } = textField(f, () => draft[f.key], (v) => { draft[f.key] = v; });
        card.append(h('div', { class: 'field' }, h('label', { class: 'lbl' }, f.label + (f.required ? ' *' : ''), counter), el));
      }
    }
    const pub = h('input', { type: 'checkbox' }); pub.checked = draft.published !== false;
    pub.addEventListener('change', () => { draft.published = pub.checked; });
    card.append(h('div', { class: 'field' }, h('label', { class: 'switch' }, pub, 'Visible en el sitio')));
    main.append(card);
    const save = h('button', { class: 'btn primary', onclick: async () => {
      if (!draft.title || !draft.title.trim()) return toast('Falta el título.', 'error');
      if (!draft.image) return toast('Falta la imagen de la obra.', 'error');
      save.disabled = true;
      const body = { published: draft.published !== false, image: draft.image.id };
      for (const f of state.artworkFields) if (f.type !== 'image') body[f.key] = draft[f.key] || '';
      try {
        const r = isNew ? await api('POST', '/api/admin/artworks', body) : await api('PUT', `/api/admin/artworks/${id}`, body);
        if (isNew) state.artworks.push(r.artwork); else state.artworks = state.artworks.map((x) => (x.id === id ? r.artwork : x));
        state.editing = null; toast('Obra guardada ✓'); render();
      } catch (e) { toast(e.message, 'error'); save.disabled = false; }
    } }, 'Guardar obra');
    const row = h('div', { class: 'acts' }, save, h('button', { class: 'btn', onclick: () => { state.editing = null; render(); } }, 'Cancelar'));
    if (!isNew) {
      row.append(h('button', { class: 'btn danger', onclick: async () => {
        if (!confirm(`¿Eliminar “${draft.title}”? Esta acción no se puede deshacer.`)) return;
        try { await api('DELETE', `/api/admin/artworks/${id}`); state.artworks = state.artworks.filter((x) => x.id !== id); state.editing = null; toast('Obra eliminada'); render(); }
        catch (e) { toast(e.message, 'error'); }
      } }, 'Eliminar'));
    }
    main.append(row);
    return main;
  }

  function renderAccount() {
    const main = h('div');
    main.append(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Cuenta'), h('p', null, `Sesión iniciada como ${state.user}.`))));
    const cur = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const nw = h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, required: true });
    const nw2 = h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, required: true });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Cambiar contraseña');
    main.append(h('form', { class: 'card', onsubmit: async (e) => {
      e.preventDefault();
      if (nw.value !== nw2.value) return toast('Las contraseñas nuevas no coinciden.', 'error');
      btn.disabled = true;
      try { await api('POST', '/api/admin/password', { current: cur.value, next: nw.value }); toast('Contraseña actualizada ✓'); cur.value = nw.value = nw2.value = ''; }
      catch (ex) { toast(ex.message, 'error'); }
      btn.disabled = false;
    } },
      h('div', { class: 'group-title' }, 'Cambiar contraseña'),
      h('div', { class: 'field' }, h('label', { class: 'lbl' }, 'Contraseña actual'), cur),
      h('div', { class: 'field' }, h('label', { class: 'lbl' }, 'Nueva contraseña (mínimo 8 caracteres)'), nw),
      h('div', { class: 'field' }, h('label', { class: 'lbl' }, 'Repite la nueva contraseña'), nw2), btn));
    main.append(h('div', { class: 'card' }, h('button', { class: 'btn danger', onclick: logout }, 'Cerrar sesión')));
    return main;
  }

  async function logout() {
    if (dirtyCount() && !confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) return;
    state.dirty = {};
    try { await api('POST', '/api/logout'); } catch {}
    state.user = null; renderLogin();
  }

  // ---------- shell ----------
  let mainEl, saveEl, navEl;
  function sectionDirty(sec) { return sec.fields.some((f) => f.key in state.dirty); }

  function goto(view) {
    if (view === state.view && !state.editing) return;
    state.view = view; state.editing = null; render(); window.scrollTo(0, 0);
  }

  function renderNav() {
    clear(navEl);
    navEl.append(h('div', { class: 'brand' }, 'ICCA', h('small', null, 'PANEL DE CONTENIDO')));
    const item = (id, icon, label, dot) => h('button', { class: 'nav-btn' + (state.view === id ? ' active' : ''), onclick: () => goto(id) },
      h('span', { class: 'ic' }, icon), label, dot && h('span', { class: 'dot', title: 'Cambios sin guardar' }));
    for (const s of state.sections) navEl.append(item(s.id, s.icon, s.title, sectionDirty(s)));
    navEl.append(h('div', { class: 'nav-sep' }), item('artworks', '🖼', 'Obras de la galería'), item('account', '⚙', 'Cuenta'));
    navEl.append(h('div', { class: 'spacer' }), h('a', { class: 'nav-btn', href: '/', target: '_blank', rel: 'noopener' }, h('span', { class: 'ic' }, '↗'), 'Ver sitio'));
  }

  function updateSavebar() {
    if (!saveEl) return;
    const n = dirtyCount();
    saveEl.classList.toggle('show', n > 0);
    saveEl.querySelector('span').textContent = n === 1 ? '1 cambio sin guardar' : `${n} cambios sin guardar`;
    renderNav();
  }

  function render() {
    clear(app);
    navEl = h('aside', { class: 'side' });
    mainEl = h('main', { class: 'main' });
    const saveBtn = h('button', { class: 'btn primary', onclick: async () => {
      saveBtn.disabled = true;
      try {
        const r = await api('PUT', '/api/admin/content', { values: state.dirty });
        state.values = r.values; state.dirty = {}; toast('Cambios guardados. Ya se ven en el sitio ✓'); render();
      } catch (e) { toast(e.message, 'error'); saveBtn.disabled = false; }
    } }, 'Guardar cambios');
    saveEl = h('div', { class: 'savebar' }, h('span'), h('div', { class: 'acts' },
      h('button', { class: 'btn', onclick: () => { if (confirm('¿Descartar todos los cambios sin guardar?')) { state.dirty = {}; render(); } } }, 'Descartar'), saveBtn));
    app.append(h('div', { class: 'shell' }, navEl, mainEl), saveEl);

    if (state.view === 'artworks') mainEl.append(state.editing ? renderArtworkEditor() : renderArtworks());
    else if (state.view === 'account') mainEl.append(renderAccount());
    else mainEl.append(renderSection(state.sections.find((s) => s.id === state.view) || state.sections[0]));
    updateSavebar();
  }

  window.addEventListener('beforeunload', (e) => { if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });

  async function boot() {
    try {
      const d = await api('GET', '/api/admin/bootstrap');
      Object.assign(state, { user: d.user, sections: d.sections, artworkFields: d.artworkFields, values: d.values, artworks: d.artworks, dirty: {}, editing: null });
      if (!state.sections.some((s) => s.id === state.view) && !['artworks', 'account'].includes(state.view)) state.view = state.sections[0].id;
      render();
    } catch (e) { if (!document.querySelector('.login-wrap')) renderLogin(); }
  }
  boot();
})();
