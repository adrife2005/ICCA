// ====================================================
// 1. CLASE PARA ANIMAR LAS LETRAS "ICCA" EN EL NAVBAR
// ====================================================
class LetterAnimator {
  constructor(elementId, customColors = []) {
    this.container = document.getElementById(elementId);
    this.colors = customColors;
    this.init();
  }

  init() {
    if (!this.container) return;

    const text = this.container.textContent.trim();
    this.container.innerHTML = '';

    text.split('').forEach((char, index) => {
      const span = document.createElement('span');
      span.classList.add('letter');
      span.innerHTML = char === ' ' ? '&nbsp;' : char;

      let timeoutId = null;

      span.addEventListener('mouseenter', () => {
        const letterColor = this.colors.length > 0
          ? this.colors[index % this.colors.length]
          : '#8B0000';

        span.style.color = letterColor;
        span.style.textShadow = `0 0 12px ${letterColor}`;
        span.classList.add('active');

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          span.style.color = '';
          span.style.textShadow = '';
          span.classList.remove('active');
          timeoutId = null;
        }, 3000);
      });

      this.container.appendChild(span);
      
    });
  }
}

// ====================================================
// 2. LÓGICA DE INTERACCIÓN DE VOLTEO PARA CARTAS
// ====================================================
function initInfoCards() {
  const cards = document.querySelectorAll('.info-card');
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });
  });
}

// ====================================================
// 3. CLASE PARA LA EXPERIENCIA RASCA-RASCA (CANVAS)
// ====================================================
class ScratchCardExperience {
  constructor(cardId, canvasId) {
    this.card = document.getElementById(cardId);
    this.canvas = document.getElementById(canvasId);

    if (!this.card || !this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.lastX = 0;
    this.lastY = 0;

    this.init();
  }

  init() {
    this.resizeCanvas();
    this.setupEvents();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  resizeCanvas() {
    this.canvas.width = this.card.offsetWidth;
    this.canvas.height = this.card.offsetHeight;

    this.ctx.fillStyle = '#140508';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = 'rgba(139, 0, 0, 0.7)';
    this.ctx.font = 'bold 15px "Segoe UI", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('✦ DESLIZA AQUÍ ✦', this.canvas.width / 2, this.canvas.height / 2);
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  scratch(e) {
    const pos = this.getPos(e);

    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineWidth = 55;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();

    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  setupEvents() {
    this.canvas.addEventListener('mouseenter', (e) => {
      const pos = this.getPos(e);
      this.lastX = pos.x;
      this.lastY = pos.y;
    });

    this.canvas.addEventListener('mousemove', (e) => this.scratch(e));

    this.canvas.addEventListener('touchstart', (e) => {
      const pos = this.getPos(e);
      this.lastX = pos.x;
      this.lastY = pos.y;
      this.scratch(e);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      this.scratch(e);
      e.preventDefault();
    });
  }
}

// ====================================================
// 4. CAPA DE SEGURIDAD Y PROTECCIÓN DE DERECHOS DE AUTOR
// ====================================================
function initSecurityProtections() {
  const toast = document.getElementById('securityToast');
  let toastTimeout = null;

  function showToast(message) {
    if (!toast) return;
    toast.querySelector('span').textContent = message;
    toast.classList.add('active');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('active');
    }, 3000);
  }

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showToast('🔒 Clic derecho desactivado por derechos de autor.');
  });

  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      showToast('🔒 Las imágenes están protegidas contra descarga.');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') {
      e.preventDefault();
      showToast('🔒 Función restringida.');
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      showToast('🔒 Inspección de código desactivada.');
    }
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      showToast('🔒 Guardado de contenido desactivado.');
    }
  });
}

// ====================================================
// 5. INICIALIZACIÓN GENERAL AL CARGAR EL DOM
// ====================================================
document.addEventListener('DOMContentLoaded', () => {

  const misColores = ['#8B0000', '#800020', '#4A0E17', '#8B0000'];
  new LetterAnimator('word', misColores);

  initInfoCards();

  new ScratchCardExperience('scratchCard', 'scratchCanvas');

  initSecurityProtections();

  const navToggle = document.getElementById('navToggle');
  const navLinksContainer = document.getElementById('navLinks');
  const navLinks = document.querySelectorAll('.nav-links a');

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navLinksContainer.classList.toggle('active');
    });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', function () {
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');

      if (navLinksContainer.classList.contains('active')) {
        navLinksContainer.classList.remove('active');
      }
    });
  });

  const spotlightCard = document.getElementById('spotlightCard');
  if (spotlightCard) {
    spotlightCard.addEventListener('mousemove', (e) => {
      const rect = spotlightCard.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      spotlightCard.style.setProperty('--mouse-x', `${x}%`);
      spotlightCard.style.setProperty('--mouse-y', `${y}%`);
    });
  }

  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Enviando mensaje...</span>';
      formStatus.textContent = '✦ Procesando envío...';
      formStatus.className = 'form-status';
    });
  }

  const backToTopBtn = document.getElementById('backToTop');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ANIMACIONES GSAP CON CORRECCIÓN DE REINICIO (clearProps)
  if (typeof gsap !== 'undefined') {
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);

      gsap.from('.gallery-card', {
        scrollTrigger: {
          trigger: '.mini-gallery-section',
          start: 'top 80%',
        },
        y: 60,
        opacity: 0,
        duration: 1,
        stagger: 0.25,
        ease: 'power3.out',
        filter: 'blur(8px)',
        clearProps: 'all' // BAZOOKA ANTI-DESALINEACIÓN: Borra estilos en línea al terminar
      });

      gsap.from('.info-card', {
        scrollTrigger: {
          trigger: '.info-cards-section',
          start: 'top 80%',
        },
        scale: 0.88,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'back.out(1.2)',
        clearProps: 'all'
      });

      gsap.from('.scratch-container', {
        scrollTrigger: {
          trigger: '.scratch-section',
          start: 'top 80%',
        },
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        clearProps: 'all'
      });

      gsap.from('.contact-container', {
        scrollTrigger: {
          trigger: '.contact-section',
          start: 'top 80%',
        },
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        clearProps: 'all'
      });
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1 } });
    tl.from('.navbar', { y: -50, opacity: 0, duration: 0.8 })
      .from('.hero-tag', { scale: 0.8, opacity: 0, duration: 0.6 }, '-=0.3')
      .from('.reveal-line', { y: 40, opacity: 0, stagger: 0.2, filter: 'blur(10px)' }, '-=0.4')
      .from('.hero-description', { y: 20, opacity: 0, duration: 0.7 }, '-=0.4')
      .from('.btn-hero-primary', { scale: 0.9, opacity: 0, duration: 0.6 }, '-=0.5')
      .from('.artwork-card', { scale: 0.8, rotationY: 25, opacity: 0, duration: 1.2, ease: 'back.out(1.4)' }, '-=0.8');
  }

  if (typeof VanillaTilt !== 'undefined') {
    VanillaTilt.init(document.querySelectorAll('.artwork-card'), {
      max: 18,
      speed: 500,
      glare: true,
      'max-glare': 0.35,
      gyroscope: true
    });
  }

});

// GARANTIZAR RECALCULO DE POSICIONES AL CARGAR IMÁGENES AL REINICIAR LA PÁGINA
window.addEventListener('load', () => {
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
});