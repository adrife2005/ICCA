/*==================================================================
  1. BASE DE DATOS DE OBRAS DE ARTE DIDÁCTICAS
===================================================================*/
// Las obras vienen del dashboard (base de datos) a través de /cms-data.js
const ARTWORKS = ((window.__CMS__ && window.__CMS__.artworks) || []).map((a) => ({
  id: a.id,
  title: a.title,
  artist: (window.__CMS__.content.artist_name) || '',
  year: a.year,
  movement: a.category,
  location: a.location,
  img: a.image ? a.image.full : '',
  thumb: a.image ? a.image.thumb : '',
  context: a.context,
  technique: a.technique,
  symbolism: a.symbolism,
  secrets: a.secrets,
  audioText: a.audioText || a.title,
}));

// Escapa texto antes de meterlo en innerHTML (el contenido lo edita una persona, no es de confianza)
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));


 

/*==================================================================
  2. ESTADO GLOBAL Y REFERENCIAS DEL DOM
===================================================================*/
let exploredSet = new Set();
let currentArtworkIndex = 0;
let highestZIndex = 100;
let activeFilter = 'all';
let isGridView = false;
let isSpeaking = false;

// Referencias DOM
const galleryViewport = document.getElementById('galleryViewport');
const artContainer = document.getElementById('artContainer');
const exploredCounter = document.getElementById('exploredCounter');
const artModal = document.getElementById('artModal');
const modalImg = document.getElementById('modalImg');
const modalTitle = document.getElementById('modalTitle');
const modalArtist = document.getElementById('modalArtist');
const modalYear = document.getElementById('modalYear');
const modalMovement = document.getElementById('modalMovement');
const modalLocation = document.getElementById('modalLocation');
const tabContent = document.getElementById('tabContent');
const btnAudioPlay = document.getElementById('btnAudioPlay');
const audioStatus = document.getElementById('audioStatus');
const eqVisualizer = document.getElementById('eqVisualizer');
const wordLogo = document.getElementById('word');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const mainNavbar = document.getElementById('mainNavbar');
const zoomLens = document.getElementById('zoomLens');
const imgWrapper = document.getElementById('imgWrapper');

/*==================================================================
  3. INTERACTIVIDAD DEL NAV Y LOGO ICCA
===================================================================*/
const letters = wordLogo.querySelectorAll('.letter');
letters.forEach(letter => {
  letter.addEventListener('mouseenter', () => {
    letter.classList.add('active');
    setTimeout(() => letter.classList.remove('active'), 800);
  });
  letter.addEventListener('click', () => {
    letters.forEach(l => l.classList.add('active'));
    setTimeout(() => letters.forEach(l => l.classList.remove('active')), 1000);
  });
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('show');
});

/*==================================================================
  4. RENDERIZADO Y DISTRIBUCIÓN EN LIENZO EXTENDIDO
===================================================================*/
function getNavBoundaryLimit() {
  const navHeight = mainNavbar ? mainNavbar.offsetHeight : 80;
  return navHeight + 15; // Límite para no tapar el nav
}

function renderArtworks() {
  artContainer.innerHTML = '';
  
  const filtered = ARTWORKS.filter(art => activeFilter === 'all' || art.movement === activeFilter);
  const navLimit = getNavBoundaryLimit();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'position:absolute;top:45%;left:0;right:0;text-align:center;color:#888;letter-spacing:3px;';
    empty.textContent = 'PRÓXIMAMENTE';
    artContainer.appendChild(empty);
    return;
  }

  filtered.forEach((art, idx) => {
    const frame = document.createElement('div');
    frame.className = 'art-frame';
    frame.id = `art-card-${art.id}`;
    frame.dataset.id = art.id;

    const isExplored = exploredSet.has(art.id);

    frame.innerHTML = `
      ${isExplored ? '<span class="badge-explored"><i class="fa-solid fa-check"></i> Visto</span>' : ''}
      <div class="art-image-container">
        <img src="${esc(art.thumb)}" alt="${esc(art.title)}" class="art-img" decoding="async">
      </div>
      <div class="art-caption">
        <div class="art-title-tag">${esc(art.title)}</div>
        <div class="art-artist-tag">${esc(art.artist)}</div>
      </div>
    `;

    // Posicionamiento en el lienzo extendido
    if (isGridView) {
      applyGridLayout(frame, idx, filtered.length);
    } else {
      applyRandomScatter(frame, navLimit);
    }

    // Eventos Drag & Drop
    makeDraggable(frame);

    artContainer.appendChild(frame);
  });
}

function applyRandomScatter(frame, navLimit) {
  const frameWidth = 160;
  const frameHeight = 220;

  const viewportW = galleryViewport.clientWidth || window.innerWidth;
  const viewportH = galleryViewport.clientHeight || 2200; // Recorre todo el canvas vertical

  const minTop = navLimit + 10;
  const maxTop = viewportH - frameHeight - 80; // Espaciado inferior
  const minLeft = 20;
  const maxLeft = Math.max(minLeft + 50, viewportW - frameWidth - 30);

  const randomTop = Math.floor(Math.random() * (maxTop - minTop)) + minTop;
  const randomLeft = Math.floor(Math.random() * (maxLeft - minLeft)) + minLeft;
  const randomRotate = (Math.random() * 14 - 7).toFixed(1);

  frame.style.top = `${randomTop}px`;
  frame.style.left = `${randomLeft}px`;
  frame.style.transform = `rotate(${randomRotate}deg)`;
}

function applyGridLayout(frame, index, total) {
  const navLimit = getNavBoundaryLimit();
  const viewportW = galleryViewport.clientWidth || window.innerWidth;
  
  // Ajuste de columnas según el ancho de pantalla
  const cols = viewportW > 1024 ? 5 : (viewportW > 640 ? 3 : 2);
  const cardW = 160;
  const cardH = 220;
  const gapX = 25;
  const gapY = 25;

  const col = index % cols;
  const row = Math.floor(index / cols);

  const startLeft = Math.max(20, (viewportW - (cols * (cardW + gapX) - gapX)) / 2);
  const startTop = navLimit + 40;

  frame.style.top = `${startTop + row * (cardH + gapY)}px`;
  frame.style.left = `${startLeft + col * (cardW + gapX)}px`;
  frame.style.transform = 'rotate(0deg)';
}

/*==================================================================
  5. SISTEMA DRAG AND DROP CON RESTRICCIÓN Y SCROLL COMPATIBLE
===================================================================*/
function makeDraggable(element) {
  let isDragging = false;
  let startX, startY;
  let initialLeft, initialTop;
  let hasMoved = false;

  const onStart = (e) => {
    isDragging = true;
    hasMoved = false;
    element.classList.add('is-dragging');

    highestZIndex++;
    element.style.zIndex = highestZIndex;

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    initialLeft = parseFloat(element.style.left) || element.offsetLeft;
    initialTop = parseFloat(element.style.top) || element.offsetTop;

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
  };

  const onMove = (e) => {
    if (!isDragging) return;

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMoved = true;
    }

    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;

    // LÍMITES DENTRO DEL LIENZO SCROLLEABLE
    const minTopBoundary = getNavBoundaryLimit(); // No invadir el nav arriba
    const maxTopBoundary = galleryViewport.clientHeight - element.offsetHeight - 20; // Hasta el final del lienzo
    const maxLeftBoundary = galleryViewport.clientWidth - element.offsetWidth;

    if (newTop < minTopBoundary) newTop = minTopBoundary;
    if (newTop > maxTopBoundary) newTop = maxTopBoundary;
    if (newLeft < 0) newLeft = 0;
    if (newLeft > maxLeftBoundary) newLeft = maxLeftBoundary;

    element.style.top = `${newTop}px`;
    element.style.left = `${newLeft}px`;

    if (e.cancelable) e.preventDefault();
  };

  const onEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    element.classList.remove('is-dragging');

    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchend', onEnd);

    if (!hasMoved) {
      const artId = parseInt(element.dataset.id, 10);
      openModal(artId);
    }
  };

  element.addEventListener('mousedown', onStart);
  element.addEventListener('touchstart', onStart, { passive: false });
}

/*==================================================================
  6. BOTONES DE ACCIÓN: ESPARCIR, GRILLA Y FILTROS
===================================================================*/
document.getElementById('btnScatter').addEventListener('click', () => {
  isGridView = false;
  renderArtworks();
});

document.getElementById('btnGrid').addEventListener('click', () => {
  isGridView = true;
  renderArtworks();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeFilter = e.target.dataset.filter;
    renderArtworks();
  });
});

/*==================================================================
  7. MODAL DIDÁCTICO E INSPECTOR DE DETALLES (LUPA)
===================================================================*/
function openModal(id) {
  const index = ARTWORKS.findIndex(a => a.id === id);
  if (index === -1) return;

  currentArtworkIndex = index;
  const art = ARTWORKS[currentArtworkIndex];

  exploredSet.add(art.id);
  updateExploredCounter();

  modalImg.src = art.img;
  modalTitle.textContent = art.title;
  modalArtist.textContent = art.artist;
  modalYear.textContent = art.year;
  modalMovement.textContent = art.movement;
  modalLocation.textContent = art.location;

  activateTab('tab-context');
  stopAudioGuide();

  artModal.classList.add('open');
  renderArtworks();
}

function closeModal() {
  artModal.classList.remove('open');
  stopAudioGuide();
}

document.getElementById('btnCloseModal').addEventListener('click', closeModal);
artModal.addEventListener('click', (e) => {
  if (e.target === artModal) closeModal();
});

function updateExploredCounter() {
  exploredCounter.innerHTML = `<i class="fa-solid fa-compass text-xs mr-1"></i> Exploradas: ${exploredSet.size} / ${ARTWORKS.length}`;
}

/*==================================================================
  8. PESTAÑAS DIDÁCTICAS Y NAVEGACIÓN ENTRE OBRAS
===================================================================*/
const tabButtons = document.querySelectorAll('.tab-btn');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activateTab(btn.dataset.tab);
  });
});

function activateTab(tabKey) {
  const art = ARTWORKS[currentArtworkIndex];
  let content = '';

  switch (tabKey) {
    case 'tab-context':
      content = `<p><strong class="text-amber-400">Contexto Histórico:</strong> ${esc(art.context)}</p>`;
      break;
    case 'tab-technique':
      content = `<p><strong class="text-amber-400">Técnica Pictórica:</strong> ${esc(art.technique)}</p>`;
      break;
    case 'tab-symbolism':
      content = `<p><strong class="text-amber-400">Simbolismo Oculto:</strong> ${esc(art.symbolism)}</p>`;
      break;
    case 'tab-secrets':
      content = `<p><strong class="text-amber-400">Secretos Curiosos:</strong> ${esc(art.secrets)}</p>`;
      break;
  }

  tabContent.innerHTML = content;
}

document.getElementById('btnPrevArt').addEventListener('click', () => {
  currentArtworkIndex = (currentArtworkIndex - 1 + ARTWORKS.length) % ARTWORKS.length;
  openModal(ARTWORKS[currentArtworkIndex].id);
});

document.getElementById('btnNextArt').addEventListener('click', () => {
  currentArtworkIndex = (currentArtworkIndex + 1) % ARTWORKS.length;
  openModal(ARTWORKS[currentArtworkIndex].id);
});

/*==================================================================
  9. LUPA DE AUMENTO EN LA IMAGEN DEL MODAL
===================================================================*/
modalImg.addEventListener('mousemove', (e) => {
  const rect = modalImg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  zoomLens.style.display = 'block';
  zoomLens.style.left = `${e.clientX - imgWrapper.getBoundingClientRect().left - 65}px`;
  zoomLens.style.top = `${e.clientY - imgWrapper.getBoundingClientRect().top - 65}px`;

  const zoomFactor = 2.5;
  zoomLens.style.backgroundImage = `url('${modalImg.src}')`;
  zoomLens.style.backgroundSize = `${modalImg.width * zoomFactor}px ${modalImg.height * zoomFactor}px`;
  zoomLens.style.backgroundPosition = `-${x * zoomFactor - 65}px -${y * zoomFactor - 65}px`;
});

modalImg.addEventListener('mouseleave', () => {
  zoomLens.style.display = 'none';
});

/*==================================================================
  10. REPRODUCTOR DE AUDIOGUÍA CON SÍNTESIS DE VOZ
===================================================================*/
btnAudioPlay.addEventListener('click', () => {
  if (isSpeaking) {
    stopAudioGuide();
  } else {
    playAudioGuide();
  }
});

function playAudioGuide() {
  if (!('speechSynthesis' in window)) {
    audioStatus.textContent = "Navegador no soporta audio";
    return;
  }

  window.speechSynthesis.cancel();

  const art = ARTWORKS[currentArtworkIndex];
  const utterance = new SpeechSynthesisUtterance(art.audioText);
  utterance.lang = 'es-ES';
  utterance.rate = 0.95;

  utterance.onstart = () => {
    isSpeaking = true;
    audioStatus.textContent = "Reproduciendo...";
    btnAudioPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
    document.querySelectorAll('.eq-bar').forEach(b => b.classList.add('playing'));
  };

  utterance.onend = () => {
    stopAudioGuide();
  };

  utterance.onerror = () => {
    stopAudioGuide();
  };

  window.speechSynthesis.speak(utterance);
}

function stopAudioGuide() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  audioStatus.textContent = "Listo para reproducir";
  btnAudioPlay.innerHTML = '<i class="fa-solid fa-play ml-0.5"></i>';
  document.querySelectorAll('.eq-bar').forEach(b => b.classList.remove('playing'));
}

/*==================================================================
  11. INICIALIZACIÓN
===================================================================*/
window.addEventListener('resize', () => {
  if (isGridView) renderArtworks();
});

renderArtworks();