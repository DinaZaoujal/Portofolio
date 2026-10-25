// Interactieve water-achtergrond in de hero van de homepagina (Three.js).
// Golf-simulatie op de GPU: elke frame wordt een hoogteveld bijgewerkt (golfvergelijking + demping),
// muis, vinger en klikken maken rimpelingen, en af en toe valt er een regendruppel.
// Actief wanneer .hero-bg het woord "water" in data-effect heeft.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ===== Instellingen =====
const CONFIG = {
  resolutie: 0.5,           // resolutie van de simulatie t.o.v. de hero (lager = lichter, grovere golven)
  resolutieMobiel: 0.35,    // idem op mobiel / kleine schermen
  stappenPerFrame: 2,       // simulatiestappen per frame (hoger = snellere golven)
  demping: 0.985,           // hoe lang golven blijven nadeinen (0–1, hoger = langer)
  muisStraal: 18,           // straal van een rimpeling onder de cursor (px)
  muisKracht: 0.35,         // kracht van de rimpeling bij bewegen
  klikStraal: 34,           // straal van een plons bij klikken / tikken (px)
  klikKracht: 1.4,          // kracht van een plons
  regen: true,              // af en toe vanzelf een druppel
  regenInterval: 900,       // gemiddelde tijd tussen druppels (ms)
  regenKracht: 0.5,         // kracht van een regendruppel
  regenStraal: 10,          // straal van een regendruppel (px)
  relief: 5,               // hoe sterk de golven licht en schaduw geven
  sterkte: 2.2,             // zichtbaarheid van de schaduw/lichtrand
  glans: 0.9,               // sterkte van de glinstering op de golven
  lichtKleur: '#ffffff',    // glans in het lichte thema
  schaduwKleur: '#7d1f38',  // schaduw in het lichte thema
  lichtKleurDonker: '#f2b8c6', // glans in het donkere thema
  schaduwKleurDonker: '#000000', // schaduw in het donkere thema
  kleurOvergang: 0.08,      // snelheid van de kleurwissel bij licht/donker (0–1)
  maxPixelRatio: 2          // devicePixelRatio wordt hierop afgetopt
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobiel = () => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

function hexNaarVec(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255);
}

// ===== Three.js basis =====
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
renderer.setClearColor(0x000000, 0);
renderer.domElement.className = 'hero-bg-water';

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const vlak = new THREE.PlaneGeometry(2, 2);

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Simulatie: r = hoogte nu, g = hoogte vorige stap
const simMateriaal = new THREE.ShaderMaterial({
  uniforms: {
    uState: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uGrootte: { value: new THREE.Vector2() },  // grootte van de hero in px
    uDrop: { value: new THREE.Vector4() },     // x, y (uv), straal (px), kracht
    uDemping: { value: CONFIG.demping }
  },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D uState;
    uniform vec2 uTexel;
    uniform vec2 uGrootte;
    uniform vec4 uDrop;
    uniform float uDemping;
    varying vec2 vUv;

    void main() {
      vec4 s = texture2D(uState, vUv);
      float l = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
      float r = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
      float d = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
      float u = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;

      // Golfvergelijking: gemiddelde van de buren x2 min de vorige hoogte, met demping
      float h = ((l + r + d + u) * 0.5 - s.g) * uDemping;

      // Druppel: zachte bult rond het punt
      if (uDrop.w != 0.0) {
        float afstand = length((vUv - uDrop.xy) * uGrootte);
        float t = clamp(afstand / uDrop.z, 0.0, 1.0);
        h += uDrop.w * (0.5 + 0.5 * cos(3.14159265 * t)) * step(afstand, uDrop.z);
      }

      gl_FragColor = vec4(h, s.r, 0.0, 1.0);
    }
  `
});

// Weergave: licht en schaduw op basis van de helling van het water
const toonMateriaal = new THREE.ShaderMaterial({
  uniforms: {
    uState: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRelief: { value: CONFIG.relief },
    uSterkte: { value: CONFIG.sterkte },
    uGlans: { value: CONFIG.glans },
    uLicht: { value: hexNaarVec(CONFIG.lichtKleur) },
    uSchaduw: { value: hexNaarVec(CONFIG.schaduwKleur) }
  },
  vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D uState;
    uniform vec2 uTexel;
    uniform float uRelief;
    uniform float uSterkte;
    uniform float uGlans;
    uniform vec3 uLicht;
    uniform vec3 uSchaduw;
    varying vec2 vUv;

    void main() {
      float l = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
      float r = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
      float d = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
      float u = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;

      vec3 n = normalize(vec3((l - r) * uRelief, (d - u) * uRelief, 1.0));
      vec3 lichtRichting = normalize(vec3(-0.4, 0.6, 1.0));

      // 0 bij vlak water, positief = belicht, negatief = schaduw
      float diffuus = dot(n, lichtRichting) - lichtRichting.z;
      float glinster = pow(max(dot(reflect(-lichtRichting, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
      glinster = max(glinster - 0.02, 0.0) * uGlans;

      vec3 kleur = diffuus > 0.0 ? uLicht : uSchaduw;
      kleur = mix(kleur, uLicht, clamp(glinster, 0.0, 1.0));
      float a = clamp(abs(diffuus) * uSterkte + glinster, 0.0, 1.0);

      // Premultiplied alpha, zodat het water over de achtergrondkleur van de pagina valt
      gl_FragColor = vec4(kleur * a, a);
    }
  `,
  blending: THREE.NoBlending
});

const simScene = new THREE.Scene();
simScene.add(new THREE.Mesh(vlak, simMateriaal));
const toonScene = new THREE.Scene();
toonScene.add(new THREE.Mesh(vlak, toonMateriaal));

// Doelkleuren per thema
const kleuren = {
  licht: [hexNaarVec(CONFIG.lichtKleur), hexNaarVec(CONFIG.lichtKleurDonker)],
  schaduw: [hexNaarVec(CONFIG.schaduwKleur), hexNaarVec(CONFIG.schaduwKleurDonker)]
};

// ===== Status =====
let houder = null;     // het .hero-bg element
let doelA = null;      // twee render targets om om beurten in te schrijven
let doelB = null;
let breedte = 0;
let hoogte = 0;
let zichtbaar = true;
let donker = 0;
let volgendeDruppel = 0;
const druppels = [];   // wachtrij: [x, y, straal, kracht] in uv / px

const pointer = { x: 0, y: 0, actief: false };

// ===== Opbouwen =====
function maakDoel(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false
  });
}

function bouw() {
  if (!houder) return;
  breedte = houder.clientWidth;
  hoogte = houder.clientHeight;
  if (!breedte || !hoogte) return;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(breedte, hoogte);

  const res = isMobiel() ? CONFIG.resolutieMobiel : CONFIG.resolutie;
  const sw = Math.max(16, Math.round(breedte * res));
  const sh = Math.max(16, Math.round(hoogte * res));

  if (doelA) doelA.dispose();
  if (doelB) doelB.dispose();
  doelA = maakDoel(sw, sh);
  doelB = maakDoel(sw, sh);

  // Begin met vlak water
  renderer.setRenderTarget(doelA);
  renderer.clear();
  renderer.setRenderTarget(doelB);
  renderer.clear();
  renderer.setRenderTarget(null);

  simMateriaal.uniforms.uTexel.value.set(1 / sw, 1 / sh);
  toonMateriaal.uniforms.uTexel.value.set(1 / sw, 1 / sh);
  simMateriaal.uniforms.uGrootte.value.set(breedte, hoogte);
}

function druppel(xPx, yPx, straal, kracht) {
  if (!breedte || !hoogte) return;
  druppels.push([xPx / breedte, 1 - yPx / hoogte, straal, kracht]);
  if (druppels.length > 12) druppels.shift();
}

// ===== Koppelen aan de pagina =====
let resizeTimer;
const resizeObserver = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(bouw, 200);
});

const zichtObserver = new IntersectionObserver((items) => {
  zichtbaar = items[0].isIntersecting;
});

// Zoekt de hero op (die verdwijnt/terugkomt bij paginawissels)
function synchroniseer() {
  const nieuw = document.querySelector('.hero-bg[data-effect~="water"]');
  if (nieuw === houder) return;
  resizeObserver.disconnect();
  zichtObserver.disconnect();
  houder = nieuw;
  if (houder) {
    houder.prepend(renderer.domElement);
    resizeObserver.observe(houder);
    zichtObserver.observe(houder);
    bouw();
  }
}

function isDonker() {
  const site = document.querySelector('.site');
  const waarde = site ? site.getAttribute('data-dark') : null;
  return waarde !== null && waarde !== 'null' && waarde !== 'false';
}

// ===== Animatie =====
function tick(t) {
  requestAnimationFrame(tick);
  if (!houder || !doelA || !zichtbaar) return;

  // Regen
  if (CONFIG.regen && t > volgendeDruppel) {
    druppel(Math.random() * breedte, Math.random() * hoogte, CONFIG.regenStraal, CONFIG.regenKracht * (0.5 + Math.random() * 0.5));
    volgendeDruppel = t + CONFIG.regenInterval * (0.4 + Math.random() * 1.2);
  }

  // Simulatiestappen, per stap hooguit één druppel uit de wachtrij
  for (let i = 0; i < CONFIG.stappenPerFrame; i++) {
    const d = druppels.shift();
    if (d) simMateriaal.uniforms.uDrop.value.set(d[0], d[1], d[2], d[3]);
    else simMateriaal.uniforms.uDrop.value.set(0, 0, 1, 0);

    simMateriaal.uniforms.uState.value = doelA.texture;
    renderer.setRenderTarget(doelB);
    renderer.render(simScene, camera);
    [doelA, doelB] = [doelB, doelA];
  }

  // Kleur zacht laten overvloeien bij licht/donker
  donker += ((isDonker() ? 1 : 0) - donker) * CONFIG.kleurOvergang;
  toonMateriaal.uniforms.uLicht.value.lerpVectors(kleuren.licht[0], kleuren.licht[1], donker);
  toonMateriaal.uniforms.uSchaduw.value.lerpVectors(kleuren.schaduw[0], kleuren.schaduw[1], donker);

  toonMateriaal.uniforms.uState.value = doelA.texture;
  renderer.setRenderTarget(null);
  renderer.render(toonScene, camera);
}

// ===== Muis & touch =====
// Geeft de positie in px binnen de hero terug, of null als de pointer erbuiten is
function inHero(clientX, clientY) {
  if (!houder) return null;
  const rect = houder.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  return { x, y };
}

function beweeg(clientX, clientY) {
  const p = inHero(clientX, clientY);
  if (!p) {
    pointer.actief = false;
    return;
  }
  if (pointer.actief) {
    const snelheid = Math.hypot(p.x - pointer.x, p.y - pointer.y);
    if (snelheid > 1) druppel(p.x, p.y, CONFIG.muisStraal, CONFIG.muisKracht * Math.min(snelheid / 20, 1));
  }
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.actief = true;
}

function plons(clientX, clientY) {
  const p = inHero(clientX, clientY);
  if (p) druppel(p.x, p.y, CONFIG.klikStraal, CONFIG.klikKracht);
}

if (!reduceMotion) {
  new MutationObserver(synchroniseer).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('pointermove', (e) => beweeg(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => plons(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) beweeg(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchend', () => { pointer.actief = false; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { pointer.actief = false; });

  synchroniseer();
  requestAnimationFrame(tick);
}
