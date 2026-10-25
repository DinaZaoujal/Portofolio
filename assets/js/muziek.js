// Achtergrondmuziek + visualizer (strepen) op de homepagina.
// Browsers laten geen geluid toe voor de bezoeker iets doet, daarom start de muziek
// bij de eerste klik of toets, behalve als de bezoeker de muziek eerder uitzette.
// De knop in de nav roept window.Muziek.toggle() aan; de status gaat via het event 'muziek'.
(function () {
  // ===== Instellingen =====
  const CONFIG = {
    bestand: 'assets/audio/piano-loop-josefpres.wav',
    volume: 0.35,             // eindvolume (0–1)
    fadeTijd: 1.2,            // in- en uitfaden in seconden
    balkBreedte: 5,           // breedte van een streep in px
    balkTussenruimte: 4,      // ruimte tussen de strepen in px
    minFrequentie: 40,        // laagste frequentie die getoond wordt (Hz)
    maxFrequentie: 9000,      // hoogste frequentie die getoond wordt (Hz)
    stijgSnelheid: 0.45,      // hoe snel een streep omhoog schiet (0–1)
    zwaartekracht: 0.35,      // hoe snel een streep terugvalt (px per frame²)
    piekVal: 0.12,            // zwaartekracht voor de piekstreepjes erboven
    piekWacht: 18,            // frames dat een piek blijft hangen voor hij valt
    rustHoogte: 0.06,         // hoogte van de strepen zonder muziek (deel van de hoogte)
    dekking: 0.55             // doorzichtigheid van de strepen (0–1)
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Voorkeur onthouden: zette de bezoeker de muziek uit, dan start ze niet vanzelf
  function leesVoorkeur() {
    try { return localStorage.getItem('muziek') !== 'uit'; } catch (e) { return true; }
  }
  function bewaarVoorkeur(aan) {
    if (!window.Cookies || !window.Cookies.voorkeurenToegestaan()) return;
    try { localStorage.setItem('muziek', aan ? 'aan' : 'uit'); } catch (e) {}
  }

  // ===== Audio =====
  const audio = new Audio();
  audio.src = CONFIG.bestand;
  audio.loop = true;
  audio.preload = 'none';     // het bestand pas laden als de muziek start

  let ctx = null;
  let gain = null;
  let analyser = null;
  let data = null;
  let aan = false;
  let gekozen = false;        // true zodra de bezoeker zelf op de muziekknop drukte
  let pauzeTimer = null;

  function maakAudioGraaf() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const bron = ctx.createMediaElementSource(audio);
    gain = ctx.createGain();
    gain.gain.value = 0;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    data = new Uint8Array(analyser.frequencyBinCount);
    bron.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    bouwBalken(); // frequenties opnieuw verdelen met de echte samplerate
  }

  function meld() {
    window.dispatchEvent(new CustomEvent('muziek', { detail: { aan } }));
  }

  function start() {
    maakAudioGraaf();
    clearTimeout(pauzeTimer);
    ctx.resume();
    audio.play().catch(() => { aan = false; meld(); });
    const nu = ctx.currentTime;
    gain.gain.cancelScheduledValues(nu);
    gain.gain.setValueAtTime(gain.gain.value, nu);
    gain.gain.linearRampToValueAtTime(CONFIG.volume, nu + CONFIG.fadeTijd);
    aan = true;
    meld();
  }

  function stop() {
    aan = false;
    meld();
    if (!ctx) return;
    const nu = ctx.currentTime;
    gain.gain.cancelScheduledValues(nu);
    gain.gain.setValueAtTime(gain.gain.value, nu);
    gain.gain.linearRampToValueAtTime(0, nu + CONFIG.fadeTijd * 0.6);
    pauzeTimer = setTimeout(() => audio.pause(), CONFIG.fadeTijd * 600);
  }

  function toggle() {
    if (aan) stop(); else start();
    bewaarVoorkeur(aan);
    gekozen = true;
  }

  // Eerste interactie: muziek starten (niet als er op de muziekknop zelf geklikt wordt)
  function eersteInteractie(e) {
    document.removeEventListener('pointerdown', eersteInteractie, true);
    document.removeEventListener('keydown', eersteInteractie, true);
    // Klik op de muziekknop, de cookie-popup of het laadscherm start de muziek niet vanzelf
    if (e.target.closest && e.target.closest('.nav-muziek, .cookie-banner, .loader')) {
      document.addEventListener('pointerdown', eersteInteractie, true);
      document.addEventListener('keydown', eersteInteractie, true);
      return;
    }
    if (!gekozen && leesVoorkeur() && !aan) start();
  }
  document.addEventListener('pointerdown', eersteInteractie, true);
  document.addEventListener('keydown', eersteInteractie, true);

  // Muziek pauzeren als het tabblad verborgen is
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !aan) return;
    if (document.hidden) audio.pause(); else audio.play().catch(() => {});
  });

  window.Muziek = {
    toggle,
    get aan() { return aan; }
  };

  // ===== Visualizer =====
  let houder = null;
  let canvas = null;
  let teken = null;
  let breedte = 0;
  let hoogte = 0;
  let balken = [];            // per streep: { h, v, piek, piekV, wacht, van, tot }
  let kleur = '#7d1f38';
  let frame = 0;

  function bouwBalken() {
    if (!houder) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    breedte = houder.clientWidth;
    hoogte = houder.clientHeight;
    canvas.width = Math.round(breedte * dpr);
    canvas.height = Math.round(hoogte * dpr);
    teken.setTransform(dpr, 0, 0, dpr, 0, 0);

    const stap = CONFIG.balkBreedte + CONFIG.balkTussenruimte;
    const aantal = Math.max(8, Math.floor(breedte / stap));
    // Frequenties logaritmisch verdelen, zoals het oor ze hoort
    const nyquist = ctx ? ctx.sampleRate / 2 : 24000;
    const bins = 1024; // fftSize / 2
    const logMin = Math.log(CONFIG.minFrequentie);
    const logMax = Math.log(CONFIG.maxFrequentie);
    balken = [];
    for (let i = 0; i < aantal; i++) {
      const f1 = Math.exp(logMin + (logMax - logMin) * (i / aantal));
      const f2 = Math.exp(logMin + (logMax - logMin) * ((i + 1) / aantal));
      const van = Math.min(bins - 1, Math.floor((f1 / nyquist) * bins));
      const tot = Math.min(bins, Math.max(van + 1, Math.ceil((f2 / nyquist) * bins)));
      balken.push({ h: 0, v: 0, piek: 0, piekV: 0, wacht: 0, van, tot });
    }
    if (reduceMotion) tekenFrame(0);
  }

  function leesKleur() {
    const site = document.querySelector('.site') || document.documentElement;
    kleur = getComputedStyle(site).getPropertyValue('--wine').trim() || kleur;
  }

  function tekenFrame(t) {
    const stap = CONFIG.balkBreedte + CONFIG.balkTussenruimte;
    const speelt = aan && analyser && !audio.paused;
    if (speelt) analyser.getByteFrequencyData(data);

    if (frame++ % 30 === 0) leesKleur();
    teken.clearRect(0, 0, breedte, hoogte);
    teken.fillStyle = kleur;

    for (let i = 0; i < balken.length; i++) {
      const b = balken[i];

      // Doelhoogte: muziek, of een zachte golf in rust
      let doel;
      if (speelt) {
        let som = 0;
        for (let j = b.van; j < b.tot; j++) som += data[j];
        doel = (som / (b.tot - b.van) / 255) * hoogte;
      } else {
        const golf = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t / 700 + i * 0.35);
        doel = hoogte * CONFIG.rustHoogte * (0.4 + 0.6 * golf);
      }

      // Physics: snel omhoog, met zwaartekracht terug naar beneden
      if (doel > b.h) {
        b.h += (doel - b.h) * CONFIG.stijgSnelheid;
        b.v = 0;
      } else {
        b.v += CONFIG.zwaartekracht;
        b.h = Math.max(doel, b.h - b.v);
      }

      // Piekstreepje: blijft even hangen en valt dan
      if (b.h >= b.piek) {
        b.piek = b.h;
        b.piekV = 0;
        b.wacht = CONFIG.piekWacht;
      } else if (b.wacht > 0) {
        b.wacht--;
      } else {
        b.piekV += CONFIG.piekVal;
        b.piek = Math.max(b.h, b.piek - b.piekV);
      }

      const x = i * stap;
      teken.globalAlpha = CONFIG.dekking;
      teken.fillRect(x, hoogte - b.h, CONFIG.balkBreedte, b.h);
      if (b.piek > b.h + 3) {
        teken.globalAlpha = CONFIG.dekking * 0.9;
        teken.fillRect(x, hoogte - b.piek - 3, CONFIG.balkBreedte, 2);
      }
    }
    teken.globalAlpha = 1;
  }

  function lus(t) {
    requestAnimationFrame(lus);
    if (houder && breedte) tekenFrame(t);
  }

  // Zoekt .muziek-balk op (verdwijnt/komt terug bij paginawissels)
  let resizeTimer;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(bouwBalken, 150);
  });

  function synchroniseer() {
    const nieuw = document.querySelector('.muziek-balk');
    if (nieuw === houder) return;
    resizeObserver.disconnect();
    houder = nieuw;
    if (!houder) return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      teken = canvas.getContext('2d');
    }
    houder.appendChild(canvas);
    resizeObserver.observe(houder);
    bouwBalken();
  }

  function init() {
    new MutationObserver(synchroniseer).observe(document.body, { childList: true, subtree: true });
    synchroniseer();
    if (!reduceMotion) requestAnimationFrame(lus);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
