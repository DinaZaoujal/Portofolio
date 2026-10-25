// Cookiekeuze van de bezoeker.
// 'alle'         = voorkeuren (taal, muziek aan/uit) mogen onthouden worden
// 'noodzakelijk' = alleen de cookiekeuze zelf wordt bewaard
// null           = nog geen keuze gemaakt -> de cookie-popup verschijnt
(function () {
  const SLEUTEL = 'cookies';
  const VOORKEUREN = ['taal', 'muziek'];

  function keuze() {
    try {
      const k = localStorage.getItem(SLEUTEL);
      return k === 'alle' || k === 'noodzakelijk' ? k : null;
    } catch (e) {
      return null;
    }
  }

  function zet(k) {
    try {
      localStorage.setItem(SLEUTEL, k);
      // Bij weigeren: eerder bewaarde voorkeuren wissen
      if (k !== 'alle') VOORKEUREN.forEach(v => localStorage.removeItem(v));
    } catch (e) {}
  }

  window.Cookies = {
    keuze,
    zet,
    voorkeurenToegestaan: () => keuze() === 'alle'
  };
})();
