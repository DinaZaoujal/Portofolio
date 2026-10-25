import * as THREE from 'three';

// ===== Instellingen =====
const CONFIG = {
  afbeelding: 'bloem.png',  // bronafbeelding (zelfde map)
  vasteKleurGebruiken: false, // true = alle puntjes in vasteKleur, false = kleuren uit de afbeelding
  vasteKleur: '#E3A8CC',    // kleur als vasteKleurGebruiken aan staat
  witDrempel: 235,          // pixels waarvan R, G en B allemaal boven deze waarde liggen, tellen als wit (0–255)
  stap: 3,                  // neem elke n-de pixel (hoger = minder puntjes, lichter)
  stapMobiel: 5,            // stapgrootte op mobiel / kleine schermen
  puntGrootte: 2.2,         // grootte van een puntje in px
  hoogte: 1,                // hoogte van de afbeelding t.o.v. de schermhoogte (1 = volledig)
  uitlijning: 'right',      // 'right', 'left' of 'center' (altijd onderaan)
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
renderer.setClearColor(0x000000, 0);
renderer.domElement.id = 'bloem-canvas';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
// Orthografische camera in pixels: 1 eenheid = 1 px, (0,0) linksonder
const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTijd: { value: 0 },
    uGrootte: { value: CONFIG.puntGrootte },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uWind: { value: reduceMotion ? 0 : CONFIG.windSterkte },
    uWindSnelheid: { value: CONFIG.windSnelheid },
    uWindSchaal: { value: CONFIG.windSchaal },
    uHoogte: { value: 1 }
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
    varying vec3 vKleur;
    void main() {
      gl_FragColor = vec4(vKleur, 1.0);
    }
  `,
  depthTest: false
});

// ===== Status =====
let afbeelding = null;
let points = null;
let thuis = null;      // rustposities
let verschuiving = null;
let snelheid = null;
let aantal = 0;
let animatieLoopt = false;

const pointer = { x: -1e5, y: -1e5 };
const parallax = { x: 0, y: 0, doelX: 0, doelY: 0 };

// ===== Afbeelding laden =====
function laadAfbeelding(src) {
  const img = new Image();
  img.onload = () => {
    afbeelding = img;
    try {
      bouw();
      verbergFout();
      start();
    } catch (err) {
      // Bij file:// blokkeert de browser getImageData (SecurityError)
      console.error(err);
      toonFout('De afbeelding kon niet uitgelezen worden. Open de site via een lokale server (bv. Live Server) of kies hieronder zelf een afbeelding.');
    }
  };
  img.onerror = () => toonFout(`"${CONFIG.afbeelding}" kon niet geladen worden.`);
  img.src = src;
}

function toonFout(tekst) {
  document.getElementById('bloem-fallback-tekst').textContent = tekst;
  document.getElementById('bloem-fallback').hidden = false;
}

function verbergFout() {
  document.getElementById('bloem-fallback').hidden = true;
}

document.getElementById('bloem-input').addEventListener('change', (e) => {
  const bestand = e.target.files[0];
  if (bestand) laadAfbeelding(URL.createObjectURL(bestand));
});

function hexNaarRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

// ===== Puntjes opbouwen =====
function bouw() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(W, H);
  camera.right = W;
  camera.top = H;
  camera.updateProjectionMatrix();

  // Schaal naar de schermhoogte, maar nooit breder dan het scherm
  const schaal = Math.min(
    (H * CONFIG.hoogte) / afbeelding.naturalHeight,
    W / afbeelding.naturalWidth
  );
  const w = Math.max(1, Math.round(afbeelding.naturalWidth * schaal));
  const h = Math.max(1, Math.round(afbeelding.naturalHeight * schaal));

  // Verborgen canvas om de pixels uit te lezen
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(afbeelding, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const stap = isMobiel() ? CONFIG.stapMobiel : CONFIG.stap;
  const x0 = CONFIG.uitlijning === 'left' ? 0
    : CONFIG.uitlijning === 'center' ? (W - w) / 2
    : W - w;

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

// ===== Animatie =====
function start() {
  if (reduceMotion || animatieLoopt) return;
  animatieLoopt = true;
  requestAnimationFrame(tick);
}

function tick(t) {
  requestAnimationFrame(tick);
  if (!points) return;

  material.uniforms.uTijd.value = t / 1000;

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
  const W = window.innerWidth;
  const H = window.innerHeight;
  pointer.x = clientX;
  pointer.y = H - clientY;
  parallax.doelX = (clientX / W - 0.5) * CONFIG.parallax;
  parallax.doelY = -(clientY / H - 0.5) * CONFIG.parallax;
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
  document.documentElement.addEventListener('mouseleave', pointerWeg);
  window.addEventListener('blur', pointerWeg);
}

// ===== Resize (met debounce) =====
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!afbeelding) return;
    try {
      bouw();
    } catch (err) {
      console.error(err);
    }
  }, 200);
});

laadAfbeelding(CONFIG.afbeelding);
