// Logica van de portfolio-pagina.
// De dc-runtime geeft zijn basisklasse (DCLogic) pas mee in de inline
// <script data-dc-script>, daarom bouwt deze functie de klasse op basis daarvan.
window.createPortfolio = function (DCLogic) {
  const TALEN = ['nl', 'en', 'fr'];

  // Gekozen taal onthouden in de browser (werkt ook als localStorage geblokkeerd is)
  function leesTaal() {
    try {
      const opgeslagen = localStorage.getItem('taal');
      if (TALEN.includes(opgeslagen)) return opgeslagen;
    } catch (e) {}
    const browser = (navigator.language || 'nl').slice(0, 2);
    return TALEN.includes(browser) ? browser : 'nl';
  }

  // Alleen bewaren als de bezoeker de cookies accepteerde (zie assets/js/cookies.js)
  function bewaarTaal(taal) {
    if (!window.Cookies.voorkeurenToegestaan()) return;
    try { localStorage.setItem('taal', taal); } catch (e) {}
  }

  return class Component extends DCLogic {
    // De site opent in het donkere thema
    state = { page: 'home', dark: true, sent: false, lang: leesTaal(), langOpen: false, menuOpen: false, dinoSpelen: false, muziekAan: false,
      cookieOpen: window.Cookies.keuze() === null, cookieDetails: false };

    componentDidMount() {
      this.observe();

      // De runtime kan de template na het laden opnieuw opbouwen; nieuwe elementen
      // missen dan .sh en blijven onzichtbaar. Daarom ook bij DOM-wijzigingen controleren.
      this.domObserver = new MutationObserver(() => requestAnimationFrame(this.sweep));
      this.domObserver.observe(document.body, { childList: true, subtree: true });
      document.documentElement.lang = this.state.lang;

      // Taalmenu sluiten bij een klik ernaast of op Escape; Escape sluit ook het hamburgermenu
      this.sluitMenu = (e) => {
        if (e.type === 'keydown' && e.key === 'Escape' && this.state.menuOpen) {
          this.setState({ menuOpen: false });
        }
        if (!this.state.langOpen) return;
        if (e.type === 'keydown' ? e.key === 'Escape' : !e.target.closest('.lang-switch')) {
          this.setState({ langOpen: false });
        }
      };
      document.addEventListener('click', this.sluitMenu);
      document.addEventListener('keydown', this.sluitMenu);

      // Muziekstatus volgen (zie assets/js/muziek.js)
      this.muziekStatus = (e) => this.setState({ muziekAan: e.detail.aan });
      window.addEventListener('muziek', this.muziekStatus);
    }
    componentDidUpdate() { this.observe(); }

    componentWillUnmount() {
      if (this.sweep) {
        window.removeEventListener('scroll', this.sweep);
        window.removeEventListener('resize', this.sweep);
      }
      document.removeEventListener('click', this.sluitMenu);
      document.removeEventListener('keydown', this.sluitMenu);
      window.removeEventListener('muziek', this.muziekStatus);
      if (this.domObserver) this.domObserver.disconnect();
    }

    // Voegt .sh toe aan .rv / .stg elementen zodra ze in beeld komen (zie css/animations.css)
    observe() {
      if (!this.sweep) {
        this.sweep = () => {
          const h = window.innerHeight || 800;
          document.querySelectorAll('.rv:not(.sh), .stg:not(.sh)').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.top < h * 0.94) el.classList.add('sh');
          });
        };
        window.addEventListener('scroll', this.sweep, { passive: true });
        window.addEventListener('resize', this.sweep, { passive: true });
      }
      requestAnimationFrame(this.sweep);
    }

    // Wissel van pagina en scroll naar boven
    go(p) {
      return () => {
        this.setState({ page: p, sent: false, langOpen: false, menuOpen: false, dinoSpelen: false });
        window.scrollTo(0, 0);
      };
    }

    // Wissel van taal
    kiesTaal(taal) {
      return () => {
        bewaarTaal(taal);
        document.documentElement.lang = taal;
        this.setState({ lang: taal, langOpen: false });
      };
    }

    // Cookiekeuze opslaan en de popup sluiten
    kiesCookies(k) {
      return () => {
        window.Cookies.zet(k);
        if (k === 'alle') bewaarTaal(this.state.lang);
        this.setState({ cookieOpen: false, cookieDetails: false });
      };
    }

    // Waarden voor de {{ ... }} placeholders in de HTML
    renderVals() {
      const s = this.state;
      const t = window.VERTALINGEN[s.lang];
      const actief = (voorwaarde, klasse) => (voorwaarde ? klasse + ' is-actief' : klasse);

      return {
        t,

        isHome: s.page === 'home',
        isProjects: s.page === 'projects',
        isAbout: s.page === 'about',
        isContact: s.page === 'contact',

        goHome: this.go('home'),
        goProjects: this.go('projects'),
        goAbout: this.go('about'),
        goContact: this.go('contact'),

        // Klasse voor de navigatieknoppen: de huidige pagina krijgt .is-actief
        navKlasse: {
          home: actief(s.page === 'home', 'nl nav-item'),
          projects: actief(s.page === 'projects', 'nl nav-item'),
          about: actief(s.page === 'about', 'nl nav-item'),
          contact: actief(s.page === 'contact', 'nl nav-item')
        },

        themeLabel: s.dark ? t.nav.licht : t.nav.donker,
        darkAttr: s.dark ? 'true' : null,
        toggleDark: () => this.setState(st => ({ dark: !st.dark })),

        taal: {
          code: s.lang.toUpperCase(),
          open: s.langOpen,
          toggle: () => this.setState(st => ({ langOpen: !st.langOpen })),
          naam: window.TAALNAMEN,
          kies: { nl: this.kiesTaal('nl'), en: this.kiesTaal('en'), fr: this.kiesTaal('fr') },
          klasse: {
            nl: actief(s.lang === 'nl', 'lang-optie'),
            en: actief(s.lang === 'en', 'lang-optie'),
            fr: actief(s.lang === 'fr', 'lang-optie')
          }
        },

        // Hamburgermenu op smalle schermen (zie assets/css/layout.css)
        menu: {
          open: s.menuOpen,
          label: s.menuOpen ? t.nav.menuSluiten : t.nav.menuOpenen,
          klasse: s.menuOpen ? 'nav-links is-open' : 'nav-links',
          toggle: () => this.setState(st => ({ menuOpen: !st.menuOpen, langOpen: false }))
        },

        muziek: {
          aan: s.muziekAan,
          label: s.muziekAan ? t.nav.muziekUit : t.nav.muziekAan,
          klasse: s.muziekAan ? 'nl nav-muziek speelt' : 'nl nav-muziek',
          toggle: () => window.Muziek && window.Muziek.toggle()
        },

        cookies: {
          toon: s.cookieOpen,
          details: s.cookieDetails,
          detailsLabel: s.cookieDetails ? t.cookies.minderInfo : t.cookies.meerInfo,
          accepteer: this.kiesCookies('alle'),
          weiger: this.kiesCookies('noodzakelijk'),
          toggleDetails: () => this.setState(st => ({ cookieDetails: !st.cookieDetails })),
          open: () => this.setState({ cookieOpen: true })
        },

        // Dino-spel in de projectenpagina: pas laden na een klik (webcam)
        dino: {
          spelen: s.dinoSpelen,
          start: () => this.setState({ dinoSpelen: true }),
          stop: () => this.setState({ dinoSpelen: false })
        },

        onSubmit: (e) => { e.preventDefault(); this.setState({ sent: true }); },
        sentNote: s.sent ? t.contact.verzonden : ''
      };
    }
  };
};
