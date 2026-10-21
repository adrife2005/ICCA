// Aplica el contenido editable (window.__CMS__, generado por el servidor desde la base de datos)
// al HTML. Todo se inserta con textContent / atributos => sin riesgo de inyección de HTML.
(function () {
  const data = window.__CMS__;
  if (!data) return;
  const c = data.content;

  const $$ = (sel) => document.querySelectorAll(sel);

  function applyImg(img, image, alt) {
    if (!image) { img.removeAttribute('src'); img.removeAttribute('srcset'); return; }
    img.src = image.src;
    img.srcset = image.srcset;
    if (img.dataset.sizes) img.sizes = img.dataset.sizes;
    if (image.w && image.h) { img.width = image.w; img.height = image.h; }
    if (alt) img.alt = alt;
  }

  // Textos
  $$('[data-cms]').forEach((el) => {
    const v = c[el.dataset.cms];
    if (typeof v === 'string' && v !== '') el.textContent = v;
  });

  // Letras animadas del logo en la galería (spans .letter)
  const word = document.getElementById('word');
  if (word && word.querySelector('.letter') && c.site_name) {
    word.textContent = '';
    for (const ch of c.site_name) {
      const s = document.createElement('span');
      s.className = 'letter';
      s.textContent = ch;
      word.appendChild(s);
    }
  }

  // Imágenes
  $$('[data-cms-img]').forEach((img) => {
    const altKey = img.dataset.alt;
    applyImg(img, c[img.dataset.cmsImg], altKey ? c[altKey] : null);
    // las imágenes con width/height fijos no deben deformar el diseño actual
    img.removeAttribute('width'); img.removeAttribute('height');
  });
  $$('[data-cms-bg]').forEach((el) => {
    const image = c[el.dataset.cmsBg];
    if (image) el.style.backgroundImage = `url("${image.src}")`;
  });

  // Franja en movimiento
  $$('[data-cms-marquee]').forEach((track) => {
    const t = c[track.dataset.cmsMarquee];
    if (!t) return;
    track.querySelectorAll('span').forEach((sp) => { sp.textContent = (t + '  ').repeat(6); });
  });

  // Cartas "Secretos y conceptos"
  $$('[data-cms-cards]').forEach((grid) => {
    const cards = c[grid.dataset.cmsCards] || [];
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    grid.textContent = '';
    cards.forEach((card) => {
      const root = el('div', 'info-card');
      const flip = el('div', 'card-flipper');
      const front = el('div', 'card-face card-front-side');
      front.append(el('div', 'card-logo-emblem', c.site_name || ''), el('div', 'card-hint', 'CLIC PARA VOLTEAR'));
      const back = el('div', 'card-face card-back-side');
      back.append(el('h3', 'card-back-title', card.title), el('span', 'card-back-subtitle', card.subtitle), el('p', 'card-back-text', card.text));
      flip.append(front, back);
      root.append(flip);
      grid.append(root);
    });
  });

  // Enlaces de contacto
  $$('[data-cms-href]').forEach((a) => { if (c[a.dataset.cmsHref]) a.href = c[a.dataset.cmsHref]; });
  $$('[data-cms-wa]').forEach((a) => { const n = c[a.dataset.cmsWa]; if (n) a.href = 'https://wa.me/' + n.replace(/\D/g, ''); });
  $$('[data-cms-form]').forEach((f) => { const m = c[f.dataset.cmsForm]; if (m) f.action = 'https://formsubmit.co/' + encodeURIComponent(m); });

  // Título de la pestaña
  if (c.site_name && document.body.dataset.title !== 'keep') {
    document.title = document.title.replace(/ICCA/g, c.site_name);
  }
})();
