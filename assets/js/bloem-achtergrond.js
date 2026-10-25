// Interactieve bloem-achtergrond in de hero van de homepagina (Three.js).
// Actief wanneer .hero-bg het woord "bloem" in data-effect heeft.
// Dit script zoekt zelf naar .hero-bg en volgt het thema via [data-dark] op .site,
// zodat het blijft werken wanneer de dc-runtime de pagina opnieuw rendert.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ===== Instellingen =====
const CONFIG = {
  afbeelding: 'assets/images/bloesem-achtergrond.jpeg', // bronafbeelding (pad t.o.v. de HTML)
  rand: 6,                  // snij zoveel px van elke rand af (de jpeg heeft bovenaan een zwarte lijn)
  spiegelen: false,         // horizontaal spiegelen (true = tak groeit vanuit de rechterrand)
  vasteKleurGebruiken: false, // true = alle puntjes in vasteKleur (licht thema)
  vasteKleur: '#E3A8CC',    // kleur als vasteKleurGebruiken aan staat
  kleurDonker: '#f2b8c6',   // kleur van de puntjes in het donkere thema
  kleurOvergang: 0.08,      // snelheid van de kleurwissel bij licht/donker (0–1)
  witDrempel: 235,          // pixels waarvan R, G en B allemaal boven deze waarde liggen, tellen als wit (0–255)
  stap: 3,                  // neem elke n-de pixel (hoger = minder puntjes, lichter)
  stapMobiel: 5,            // stapgrootte op mobiel / kleine schermen
  puntGrootte: 2.2,         // grootte van een puntje in px
  hoogte: 1.25,             // hoogte van de afbeelding t.o.v. de hoogte van de hero (1 = volledig, >1 = groter, bovenkant valt weg)
  uitlijning: 'left',       // 'right', 'left' of 'center' (altijd onderaan)
  muisStraal: 110,          // straal rond de cursor waarin puntjes wegduwen (px)
  kracht: 1.6,              // hoe hard de puntjes weggeduwd worden
  veer: 0.05,               // hoe sterk ze terugveren naar hun plek
  demping: 0.86,            // remt de beweging af (0–1, lager = sneller stil)
  windSterkte: 2.5,         // uitslag van de wind in px (bovenaan het sterkst)
  windSnelheid: 0.9,        // snelheid van de wind
  windSchaal: 0.006,        // golflengte van de wind over de afbeelding
  parallax: 18,             // max. verschuiving van de bloem met de muis (px)
  maxPixelRatio: 2          // devicePixelRatio wordt hierop afgetopt
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobiel = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

// ===== Three.js basis =====
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
renderer.setClearColor(0x000000, 0);
renderer.domElement.className = 'hero-bg-canvas';

const scene = new THREE.Scene();
// Orthografische camera in pixels: 1 eenheid = 1 px, (0,0) linksonder
const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTijd: { value: 0 },
    uGrootte: { value: CONFIG.puntGrootte },
    uPixelRatio: { value: 1 },
    uWind: { value: reduceMotion ? 0 : CONFIG.windSterkte },
    uWindSnelheid: { value: CONFIG.windSnelheid },
    uWindSchaal: { value: CONFIG.windSchaal },
    uHoogte: { value: 1 },
    uDonker: { value: 0 },
    uKleurDonker: { value: new THREE.Vector3(...hexNaarRgb(CONFIG.kleurDonker)) }
  },
  vertexShader: /* glsl */ `
    uniform float uTijd;
    uniform float uGrootte;
    uniform float uPixelRatio;
    uniform float uWind;
    uniform float uWindSnelheid;
    uniform float uWindSchaal;
    uniform float uHoogte;
    attribute vec3 aKleur;
    varying vec3 vKleur;

    void main() {
      vec3 p = position;
      // Wind: golf op basis van positie, sterker naar boven toe (de steel staat onderaan)
      float h = clamp(p.y / uHoogte, 0.0, 1.0);
      float golf = uTijd * uWindSnelheid + p.y * uWindSchaal + p.x * uWindSchaal * 0.5;
      p.x += sin(golf) * uWind * h;
      p.y += cos(golf * 1.3) * uWind * 0.4 * h;

      vKleur = aKleur;
      gl_PointSize = uGrootte * uPixelRatio;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uDonker;
    uniform vec3 uKleurDonker;
    varying vec3 vKleur;
    void main() {
      gl_FragColor = vec4(mix(vKleur, uKleurDonker, uDonker), 1.0);
    }
  `,
  depthTest: false
});

// ===== Status =====
let houder = null;     // het .hero-bg element
let afbeelding = null;
let points = null;
let thuis = null;      // rustposities
let verschuiving = null;
let snelheid = null;
let aantal = 0;
let zichtbaar = true;
let doelDonker = 0;
let fallback = null;

const pointer = { x: -1e5, y: -1e5 };
const parallax = { x: 0, y: 0, doelX: 0, doelY: 0 };

function hexNaarRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

// ===== Afbeelding laden =====
function laadAfbeelding(src) {
  const img = new Image();
  img.onload = () => {
    afbeelding = img;
    try {
      bouw();
      verbergFout();
    } catch (err) {
      // Bij file:// blokkeert de browser getImageData (SecurityError)
      console.error(err);
      afbeelding = null;
      toonFout('De afbeelding kon niet uitgelezen worden. Open de site via een lokale server (bv. Live Server) of kies zelf een afbeelding.');
    }
  };
  img.onerror = () => toonFout(`"${CONFIG.afbeelding}" kon niet geladen worden.`);
  img.src = src;
}

function toonFout(tekst) {
  if (!fallback) {
    fallback = document.createElement('div');
    fallback.className = 'hero-bg-fallback';
    fallback.innerHTML = '<p></p><label class="btn">Kies een afbeelding<input type="file" accept="image/*" hidden></label>';
    fallback.querySelector('input').addEventListener('change', (e) => {
      const bestand = e.target.files[0];
      if (bestand) laadAfbeelding(URL.createObjectURL(bestand));
    });
  }
  fallback.querySelector('p').textContent = tekst;
  if (houder) houder.appendChild(fallback);
}

function verbergFout() {
  if (fallback) fallback.remove();
}

// ===== Puntjes opbouwen =====
function bouw() {
  if (!houder || !afbeelding) return;
  const W = houder.clientWidth;
  const H = houder.clientHeight;
  if (!W || !H) return;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(W, H);
  camera.right = W;
  camera.top = H;
  camera.updateProjectionMatrix();

  // Uitsnede zonder de rand
  const rand = Math.min(CONFIG.rand, afbeelding.naturalWidth / 4, afbeelding.naturalHeight / 4);
  const bronW = afbeelding.naturalWidth - rand * 2;
  const bronH = afbeelding.naturalHeight - rand * 2;

  // Schaal naar de hoogte van de hero, maar nooit breder dan de hero
  const schaal = Math.min((H * CONFIG.hoogte) / bronH, W / bronW);
  const w = Math.max(1, Math.round(bronW * schaal));
  const h = Math.max(1, Math.round(bronH * schaal));

  // Verborgen canvas om de pixels uit te lezen
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (CONFIG.spiegelen) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(afbeelding, rand, rand, bronW, bronH, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const stap = isMobiel() ? CONFIG.stapMobiel : CONFIG.stap;
  const x0 = { left: 0, center: (W - w) / 2 }[CONFIG.uitlijning] ?? W - w;

  const vast = hexNaarRgb(CONFIG.vasteKleur);
  const posities = [];
  const kleuren = [];

  for (let y = 0; y < h; y += stap) {
    for (let x = 0; x < w; x += stap) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;
      if (r > CONFIG.witDrempel && g > CONFIG.witDrempel && b > CONFIG.witDrempel) continue;

      posities.push(x0 + x, h - y, 0); // y omdraaien: canvas begint bovenaan, camera onderaan
      if (CONFIG.vasteKleurGebruiken) kleuren.push(...vast);
      else kleuren.push(r / 255, g / 255, b / 255);
    }
  }

  // Oude puntjes opruimen
  if (points) {
    scene.remove(points);
    points.geometry.dispose();
  }

  aantal = posities.length / 3;
  thuis = new Float32Array(posities);
  verschuiving = new Float32Array(aantal * 2);
  snelheid = new Float32Array(aantal * 2);

  const geometry = new THREE.BufferGeometry();
  const positieAttr = new THREE.BufferAttribute(new Float32Array(posities), 3);
  positieAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positieAttr);
  geometry.setAttribute('aKleur', new THREE.BufferAttribute(new Float32Array(kleuren), 3));

  material.uniforms.uGrootte.value = CONFIG.puntGrootte * (stap / CONFIG.stap);
  material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  material.uniforms.uHoogte.value = h;

  points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  renderer.render(scene, camera);
}

// ===== Koppelen aan de pagina =====
let resizeTimer;
const resizeObserver = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    try {
      bouw();
    } catch (err) {
      console.error(err);
    }
  }, 200);
});

const zichtObserver = new IntersectionObserver((items) => {
  zichtbaar = items[0].isIntersecting;
});

// Zoekt de hero op (die verdwijnt/terugkomt bij paginawissels) en leest het thema
function synchroniseer() {
  const nieuw = document.querySelector('.hero-bg[data-effect~="bloem"]');
  if (nieuw !== houder) {
    resizeObserver.disconnect();
    zichtObserver.disconnect();
    houder = nieuw;
    if (houder) {
      houder.appendChild(renderer.domElement);
      if (fallback && !afbeelding) houder.appendChild(fallback);
      resizeObserver.observe(houder);
      zichtObserver.observe(houder);
      bouw();
    }
  }

  const site = document.querySelector('.site');
  const waarde = site ? site.getAttribute('data-dark') : null;
  doelDonker = waarde !== null && waarde !== 'null' && waarde !== 'false' ? 1 : 0;

  if (reduceMotion && points) {
    material.uniforms.uDonker.value = doelDonker;
    renderer.render(scene, camera);
  }
}

new MutationObserver(synchroniseer).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['data-dark']
});

// ===== Animatie =====
function tick(t) {
  requestAnimationFrame(tick);
  if (!points || !houder || !zichtbaar) return;

  material.uniforms.uTijd.value = t / 1000;

  // Kleur zacht laten overvloeien bij licht/donker
  const donker = material.uniforms.uDonker;
  donker.value += (doelDonker - donker.value) * CONFIG.kleurOvergang;

  // Parallax: zacht naar het doel toe schuiven
  parallax.x += (parallax.doelX - parallax.x) * 0.05;
  parallax.y += (parallax.doelY - parallax.y) * 0.05;
  points.position.set(parallax.x, parallax.y, 0);

  // Muis in het coördinatenstelsel van de puntjes
  const mx = pointer.x - parallax.x;
  const my = pointer.y - parallax.y;
  const r = CONFIG.muisStraal;
  const r2 = r * r;
  const pos = points.geometry.attributes.position.array;

  for (let i = 0; i < aantal; i++) {
    const i2 = i * 2;
    const i3 = i * 3;
    let ox = verschuiving[i2];
    let oy = verschuiving[i2 + 1];
    let vx = snelheid[i2];
    let vy = snelheid[i2 + 1];

    // Wegduwen binnen de muisstraal
    const dx = thuis[i3] + ox - mx;
    const dy = thuis[i3 + 1] + oy - my;
    const d2 = dx * dx + dy * dy;
    if (d2 < r2 && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const f = (1 - d / r) * CONFIG.kracht;
      vx += (dx / d) * f;
      vy += (dy / d) * f;
    }

    // Veer terug + demping
    vx = (vx - ox * CONFIG.veer) * CONFIG.demping;
    vy = (vy - oy * CONFIG.veer) * CONFIG.demping;
    ox += vx;
    oy += vy;

    verschuiving[i2] = ox;
    verschuiving[i2 + 1] = oy;
    snelheid[i2] = vx;
    snelheid[i2 + 1] = vy;
    pos[i3] = thuis[i3] + ox;
    pos[i3 + 1] = thuis[i3 + 1] + oy;
  }
  points.geometry.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
}

// ===== Muis & touch =====
function zetPointer(clientX, clientY) {
  if (!houder) return;
  const rect = houder.getBoundingClientRect();
  pointer.x = clientX - rect.left;
  pointer.y = rect.height - (clientY - rect.top);
  const nx = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const ny = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
  parallax.doelX = (nx - 0.5) * CONFIG.parallax;
  parallax.doelY = -(ny - 0.5) * CONFIG.parallax;
}

function pointerWeg() {
  pointer.x = -1e5;
  pointer.y = -1e5;
}

if (!reduceMotion) {
  window.addEventListener('pointermove', (e) => zetPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) zetPointer(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchend', pointerWeg, { passive: true });
  window.addEventListener('scroll', pointerWeg, { passive: true });
  document.documentElement.addEventListener('mouseleave', pointerWeg);
  window.addEventListener('blur', pointerWeg);
  requestAnimationFrame(tick);
}

synchroniseer();
laadAfbeelding(CONFIG.afbeelding);
