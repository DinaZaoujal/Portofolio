// Laadscherm: de balk loopt van 0 naar 100% terwijl de pagina laadt.
// Zolang de pagina nog laadt, kruipt de balk richting 90%; na het 'load'-event loopt hij door tot 100%.
(function () {
  // ===== Instellingen =====
  const CONFIG = {
    minTijd: 2000,   // de gif minstens zo lang tonen (ms), gerekend vanaf het moment dat hij geladen is
    maxTijd: 10000,  // nooit langer dan dit tonen (ms), ook als iets blijft hangen
    wachtStand: 90   // tot waar de balk mag lopen voor alles geladen is (%)
  };

  const scherm = document.getElementById('loader');
  if (!scherm) return;
  const vulling = scherm.querySelector('.loader-vulling');
  const getal = scherm.querySelector('.loader-getal');

  const start = performance.now();
  let procent = 0;
  let geladen = document.readyState === 'complete';
  window.addEventListener('load', () => { geladen = true; });

  // Tijdstip waarop de gif zichtbaar werd (null = nog niet geladen)
  const gif = scherm.querySelector('.loader-logo img');
  let gifSinds = gif && gif.complete && gif.naturalWidth ? performance.now() : null;
  if (gif && gifSinds === null) {
    gif.addEventListener('load', () => { gifSinds = performance.now(); });
    gif.addEventListener('error', () => { gifSinds = 0; });
  }

  document.documentElement.classList.add('is-laden');

  function zet(waarde) {
    procent = waarde;
    vulling.style.transform = 'scaleX(' + (waarde / 100) + ')';
    getal.textContent = Math.round(waarde) + '%';
    scherm.setAttribute('aria-valuenow', Math.round(waarde));
  }

  function verberg() {
    scherm.classList.add('is-klaar');
    document.documentElement.classList.remove('is-laden');
    setTimeout(() => scherm.remove(), 700);
  }

  function tick() {
    const tijd = performance.now() - start;
    const gifGezien = gifSinds !== null && performance.now() - gifSinds >= CONFIG.minTijd;
    const klaar = (geladen && gifGezien) || tijd >= CONFIG.maxTijd;

    // Doel: langzaam richting de wachtstand, of naar 100 als alles klaar is
    const doel = klaar ? 100 : CONFIG.wachtStand * (1 - Math.exp(-tijd / 1500));
    let volgende = procent + (doel - procent) * (klaar ? 0.12 : 0.08);
    if (klaar && volgende > 99.5) volgende = 100;
    zet(Math.max(procent, volgende));

    if (procent >= 100) {
      setTimeout(verberg, 250); // heel even 100% laten zien
      return;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
