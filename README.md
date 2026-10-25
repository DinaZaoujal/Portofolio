# Portfolio · Dina Zaoujal

Persoonlijke portfoliowebsite: Digital Solutions Developer, UX/UI-designer en grafisch ontwerper uit Brussel.
De site is beschikbaar in het Nederlands, Engels en Frans.

## Mappenstructuur

```
index.html                 Startpagina (de volledige portfolio: home, projecten, over mij, contact)
404.html                   Foutpagina voor adressen die niet bestaan
.image-slots.state.json    Afbeeldingen in de fotovakken van index.html (moet naast index.html blijven)

assets/
  css/                     Stijlen (variables = kleuren/lettertypes, base, components, layout, animations, loader)
  js/                      Eigen scripts
    portfolio.js           Pagina-logica (navigatie, thema, taal, cookies, Dino-spel)
    vertalingen.js         Alle teksten in NL, EN en FR
    bloem-achtergrond.js   Interactieve bloesem-achtergrond (Three.js)
    water-achtergrond.js   Interactieve water-achtergrond (Three.js, optioneel)
    muziek.js              Achtergrondmuziek + visualizer
    cookies.js             Cookiekeuze
    loader.js              Laadscherm
    vendor/                Runtime- en hulpscripts die niet zelf geschreven zijn
  images/                  Logo, achtergrond, iconen en projectbeelden
  audio/                   Achtergrondmuziek
  documents/               Cv (pdf)
  models/                  3D-model van de hibiscus (OBJ)

projects/
  hibiscus-3d.html         3D-hibiscus (wordt ook in de projectenpagina getoond)

design/
  wireframes.dc.html             Wireframes van de site
  wireframes-presentatie.dc.html Presentatie van de wireframes
  references/                    Moodboard en inspiratiebeelden

experiments/
  bloem-test/              Eerste test van de bloesem-achtergrond (los van de site)

_ds/                       Design system (gegenereerd, niet aanpassen)
```

## Lokaal bekijken

Open de map in VS Code en start **Live Server**. Open de site niet door op `index.html` te dubbelklikken:
de bloesem-achtergrond, de muziek-visualizer en de 404-pagina werken alleen via een (lokale) server.

## Bronnen

- Muziek: "Piano Loops 213 Octave Down Long Loop 120 BPM" door josefpres op Freesound (geluid #871796).
- 3D en achtergrondeffecten: [Three.js](https://threejs.org).
- Lettertypes: Instrument Serif en Roboto via Google Fonts.
