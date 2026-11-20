// ============================================================================
// Compliance-Plattform-Shell (S1) - Seitennavigation mit 8 Modulen.
//
// Klassisches Script (IIFE), KEIN import/export. Wird vom Build als 4. <script>
// nach app.js eingehaengt (apps/web/build.mjs -> baueShellJs). Die Shell ist
// bewusst MINIMAL-INVASIV:
//   - sie ruft KEINE App-Funktion direkt und liest KEINE App-Globals,
//   - bestehende Ansichten oeffnet sie nur per .click() auf das vorhandene
//     Bedienelement; ist das ausgeblendet (Rang/Rolle), bleibt das Modul
//     gesperrt (Hinweis), nie umgangen,
//   - sichtbar nur, wenn die .app sichtbar ist (MutationObserver); Gates,
//     Login, Session, sb bleiben unberuehrt,
//   - kein Hash-Routing, kein pushState (die App nutzt location.hash selbst).
//
// Der Build (baueShellJs) ersetzt genau zwei markierte Code-Zeilen weiter unten:
//   die 'var CSS = ...'-Zeile       -> JSON-String aus estate-tokens.css + shell.css
//   die 'var VORSCHAU = ...'-Zeile  -> Vorschau-Erkennung nur auf test, sonst false
// Die Token-Namen stehen bewusst NUR auf diesen beiden Code-Zeilen (nicht hier im
// Kommentar), damit der Build sie verankert an der ganzen Zeile ersetzt.
// ============================================================================
(function () {
  'use strict';

  // --- Vom Build eingesetzt (siehe oben) ---
  var CSS = "/* ============================================================================\n   Estate-Design-Tokens fuer die Compliance-Plattform-Shell (S1).\n\n   Quelle der Werte: automati-real-estate @ 86dd138, src/index.css (@theme).\n   Diese Datei liegt auf Julius' Mac, NICHT auf der Box. Die hier gesetzten\n   Werte sind 1:1 aus dem Prompt (Zeus-Vorgabe S1) uebernommen; sie koennen\n   spaeter gegen die Original-@theme-Quelle gegengeprueft werden.\n\n   Nur BELEGTE Werte stehen hier als feste Variablen. Alles, was in der\n   Estate-Quelle keine Entsprechung hat (Seitenleisten-Breite, Icon-Satz,\n   Shell-Abstaende, Mobil-Muster), ist unten als PLATZHALTER markiert, weil\n   Estate keine Seitenleiste kennt.\n   ============================================================================ */\n\n:root {\n  /* Schrift (Inter laedt die Seite bereits; kein neuer Font-Link). */\n  --cc-font: 'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system,\n             'Segoe UI', Roboto, Arial, sans-serif;\n\n  /* Flaeche / Szene */\n  --cc-scene: #f2f2f0;\n\n  /* Brand (weisser Text erst ab 700) */\n  --cc-brand-50:  #eefbee;\n  --cc-brand-100: #ddf6dd;\n  --cc-brand-200: #bdeabf;\n  --cc-brand-300: #94da98;\n  --cc-brand-400: #6cc471;\n  --cc-brand-500: #4caf50;\n  --cc-brand-600: #36954d;\n  --cc-brand-700: #28773d;\n  --cc-brand-800: #1e5e31;\n  --cc-brand-900: #174825;\n  --cc-brand-950: #092913;\n\n  /* Ink (Text = ink-900) */\n  --cc-ink-50:  #f8fbfb;\n  --cc-ink-100: #f0f5f6;\n  --cc-ink-200: #e0e7e8;\n  --cc-ink-300: #ced6d7;\n  --cc-ink-400: #99a3a5;\n  --cc-ink-500: #626e71;\n  --cc-ink-600: #4d595c;\n  --cc-ink-700: #3b484a;\n  --cc-ink-800: #2d393b;\n  --cc-ink-900: #232e30;\n  --cc-ink-950: #101819;\n\n  /* Ampel (Fuellung / Text) */\n  --cc-urgent:      #ff3b30;\n  --cc-urgent-text: #c4170e;\n  --cc-pending:      #ff9500;\n  --cc-pending-text: #9a5200;\n  --cc-ok:      #34c759;\n  --cc-ok-text: #1a6e2e;\n\n  /* Bewegung (prefers-reduced-motion schaltet sie in shell.css ab) */\n  --cc-dauer-kurz:   120ms;\n  --cc-dauer-mittel: 180ms;\n  --cc-dauer-lang:   260ms;\n  --cc-ease-out: cubic-bezier(0.16, 1, 0.3, 1);\n\n  /* Muster (belegt) */\n  --cc-karte-radius:   1rem;\n  --cc-karte-flaeche:  #ffffff;\n  --cc-karte-rahmen:   inset 0 0 0 1px var(--cc-ink-200);\n  --cc-nav-radius:     0.75rem;\n  --cc-fokus-breite:   2px;\n  --cc-fokus-farbe:    var(--cc-brand-600);\n  --cc-fokus-abstand:  2px;\n  --cc-touch-min:      44px;\n  --cc-popover-schatten: 0 20px 50px -20px rgba(0, 0, 0, 0.35);\n\n  /* ---- PLATZHALTER - aus Estate-Quelle uebernehmen (Estate hat keine Seitenleiste) ---- */\n  --cc-shell-breite: 248px;     /* PLATZHALTER - aus Estate-Quelle uebernehmen */\n  --cc-shell-abstand: 16px;     /* PLATZHALTER - aus Estate-Quelle uebernehmen */\n  --cc-shell-mobil-bar: 52px;   /* PLATZHALTER - aus Estate-Quelle uebernehmen */\n  /* Icon-Satz: bis zur Estate-Quelle schlichte Strich-SVGs (siehe shell.js). */\n}\n\n/* ============================================================================\n   Shell-Layout (S1) der Compliance-Plattform. Nutzt die Estate-Tokens aus\n   estate-tokens.css. Wird vom Build (apps/web/build.mjs -> baueShellJs) als\n   String in dist/shell.js eingebettet und zur Laufzeit als <style id=\"ccShellStil\">\n   eingespielt (der Dev-Server kennt .css nicht, darum kein .css-Artefakt).\n\n   Minimal-invasiv: die Shell legt sich NEBEN die bestehende App. Werte, die in\n   der Estate-Quelle nicht belegt sind (Seitenleisten-Breite, Abstaende, Mobil-\n   Muster), kommen aus den PLATZHALTER-Variablen in estate-tokens.css.\n   ============================================================================ */\n\n/* Die Shell ist standardmaessig unsichtbar; erst body.cc-shell-an zeigt sie. */\n.cc-shell { display: none; }\n.cc-shell-modul-wrap { display: none; }\n\n/* ---------------------------------------------------------------- Desktop -- */\nbody.cc-shell-an .cc-shell { display: flex; }\n\n/* Inhalt der bestehenden App nach rechts schieben, damit die feste Leiste\n   nichts verdeckt (\"nichts abgeschnitten\"). Nur ab Tablet-Breite. */\n@media (min-width: 768px) {\n  body.cc-shell-an { padding-left: var(--cc-shell-breite); }\n}\n\n/* Seitenleiste */\n.cc-shell {\n  position: fixed;\n  top: 0;\n  left: 0;\n  bottom: 0;\n  width: var(--cc-shell-breite);\n  flex-direction: column;\n  gap: 4px;\n  box-sizing: border-box;\n  padding: calc(var(--cc-shell-abstand) + 28px) 12px var(--cc-shell-abstand);\n  background: var(--cc-karte-flaeche);\n  box-shadow: inset -1px 0 0 0 var(--cc-ink-200);\n  font-family: var(--cc-font);\n  color: var(--cc-ink-900);\n  z-index: 9000;                 /* ueber App-Inhalt, unter App-Modals (10001+) und Banner (99999) */\n  overflow-y: auto;\n}\n\n.cc-shell-marke {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 6px 10px 14px;\n  font-weight: 700;\n  font-size: 15px;\n  letter-spacing: .2px;\n  color: var(--cc-ink-900);\n}\n.cc-shell-marke .cc-shell-punkt {\n  width: 10px; height: 10px; border-radius: 50%;\n  background: var(--cc-brand-500);\n  box-shadow: 0 0 0 4px var(--cc-brand-100);\n  flex: 0 0 auto;\n}\n\n.cc-shell-nav { display: flex; flex-direction: column; gap: 2px; }\n\n/* Nav-Eintrag */\n.cc-nav-eintrag {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  width: 100%;\n  min-height: var(--cc-touch-min);\n  padding: 9px 12px;\n  border: 0;\n  border-radius: var(--cc-nav-radius);\n  background: transparent;\n  color: var(--cc-ink-700);\n  font-family: var(--cc-font);\n  font-size: 14px;\n  font-weight: 500;\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out),\n              color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-nav-eintrag svg { width: 20px; height: 20px; flex: 0 0 auto; }\n.cc-nav-eintrag:hover { background: var(--cc-ink-100); color: var(--cc-ink-900); }\n.cc-nav-eintrag[aria-current=\"page\"] {\n  background: var(--cc-brand-50);\n  color: var(--cc-brand-800);\n  font-weight: 600;\n}\n.cc-nav-eintrag:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\n.cc-nav-eintrag.cc-gesperrt { color: var(--cc-ink-400); }\n\n/* Leerzustand-/Hinweis-Flaeche (rechts neben der Leiste) */\nbody.cc-shell-an .cc-shell-modul-wrap[data-cc-sichtbar=\"1\"] { display: block; }\n.cc-shell-modul-wrap {\n  position: fixed;\n  top: 0; right: 0; bottom: 0;\n  left: 0;\n  z-index: 8000;              /* unter der Leiste (9000), damit die Nav klickbar bleibt */\n  background: var(--cc-scene);\n  overflow-y: auto;\n  font-family: var(--cc-font);\n  color: var(--cc-ink-900);\n}\n@media (min-width: 768px) {\n  .cc-shell-modul-wrap { left: var(--cc-shell-breite); }\n}\n\n.cc-leer {\n  max-width: 460px;\n  margin: 14vh auto 0;\n  padding: 40px 28px;\n  text-align: center;\n}\n.cc-leer-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 64px; height: 64px;\n  margin-bottom: 20px;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n  color: var(--cc-brand-600);\n}\n.cc-leer-icon svg { width: 30px; height: 30px; }\n.cc-leer-titel { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: var(--cc-ink-900); }\n.cc-leer-satz { margin: 0 0 6px; font-size: 14px; line-height: 1.5; color: var(--cc-ink-600); }\n.cc-leer-bald {\n  display: inline-block;\n  margin-top: 14px;\n  padding: 5px 12px;\n  border-radius: 999px;\n  background: var(--cc-brand-50);\n  color: var(--cc-brand-800);\n  font-size: 12px;\n  font-weight: 600;\n}\n.cc-leer-hinweis {\n  margin-top: 18px;\n  font-size: 13px;\n  color: var(--cc-pending-text);\n}\n\n/* Primaer-Knopf (fuer \"Bisherige Ansicht oeffnen\", falls eine Funktion existiert) */\n.cc-knopf {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  min-height: var(--cc-touch-min);\n  margin-top: 18px;\n  padding: 10px 18px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--cc-brand-700);\n  color: #ffffff;\n  font-family: var(--cc-font);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-knopf:hover { background: var(--cc-brand-800); }\n.cc-knopf:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\n\n/* ----------------------------------------------------------------- Mobil -- */\n/* PLATZHALTER-Muster: unter 768px klappt die Leiste ein; ein Balken mit\n   Umschalter oben. Estate hat keine Seitenleiste -> spaeter gegenpruefen. */\n.cc-shell-balken { display: none; }\n@media (max-width: 767.98px) {\n  body.cc-shell-an .cc-shell-balken {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    position: fixed;\n    top: 0; left: 0; right: 0;\n    height: var(--cc-shell-mobil-bar);\n    padding: 0 12px;\n    background: var(--cc-karte-flaeche);\n    box-shadow: inset 0 -1px 0 0 var(--cc-ink-200);\n    font-family: var(--cc-font);\n    z-index: 9001;\n  }\n  body.cc-shell-an { padding-top: var(--cc-shell-mobil-bar); }\n  .cc-shell {\n    top: var(--cc-shell-mobil-bar);\n    width: min(84vw, var(--cc-shell-breite));\n    transform: translateX(-102%);\n    transition: transform var(--cc-dauer-mittel) var(--cc-ease-out);\n    box-shadow: var(--cc-popover-schatten);\n  }\n  body.cc-shell-auf .cc-shell { transform: translateX(0); }\n  .cc-shell-modul-wrap { top: var(--cc-shell-mobil-bar); }\n}\n.cc-shell-umschalter {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: var(--cc-touch-min);\n  height: var(--cc-touch-min);\n  border: 0;\n  border-radius: var(--cc-nav-radius);\n  background: transparent;\n  color: var(--cc-ink-800);\n  cursor: pointer;\n}\n.cc-shell-umschalter:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\n.cc-shell-balken-titel { font-weight: 700; font-size: 15px; color: var(--cc-ink-900); }\n\n/* Bewegung aus, wenn der Nutzer das will. */\n@media (prefers-reduced-motion: reduce) {\n  .cc-nav-eintrag, .cc-knopf, .cc-shell { transition: none; }\n}\n\n/* ------------------------------------------------- Vorschau (nur test) -- */\n/* NUR additiv unter body.cc-shell-vorschau (gesetzt von shell.js, wenn\n   APP_ENV === 'test' UND der Vorschau-Schalter in der Adresse steht). Ohne\n   Login liegt sonst das Login-Gate (z-index 9999) ueber der Shell und man\n   sieht nur die Maske. Hier heben wir Leiste, Inhalt und Mobil-Balken auf\n   EINEN gemeinsamen Wert (--cc-z-vorschau = 10000): ueber das Login-Gate\n   (9999), aber unter den App-Modals/Knoepfen (10001+) und dem Testbanner\n   (99999). Die Reihenfolge Leiste > Inhalt kommt aus der DOM-Reihenfolge\n   (nav wird in shell.js NACH dem Inhalt angehaengt), nicht aus hoeheren Zahlen.\n   Das Start-Gate (10000) liegt im DOM vor der Shell und wird darum von ihr\n   ueberdeckt. Das ausgeklappte Mobil-Menue ist dieselbe .cc-shell und erbt den\n   Wert. Die Normal-Ansicht (9000/8000/9001) bleibt unberuehrt. */\nbody.cc-shell-vorschau { --cc-z-vorschau: 10000; }\nbody.cc-shell-vorschau .cc-shell { z-index: var(--cc-z-vorschau); }\nbody.cc-shell-vorschau .cc-shell-modul-wrap { z-index: var(--cc-z-vorschau); }\nbody.cc-shell-vorschau .cc-shell-balken { z-index: var(--cc-z-vorschau); }\n";
  var VORSCHAU = (typeof window !== 'undefined' && !!window.location && window.location.search.indexOf('vorschau=shell') >= 0);

  // Doppel-Init vermeiden (Script versehentlich zweimal geladen).
  if (document.getElementById('ccShell')) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';   // XML-Namensraum fuer createElementNS, KEINE Netz-URL.

  // Schlichte Strich-SVGs als PLATZHALTER (bis der Estate-Icon-Satz vorliegt).
  // Jeder Eintrag ist ein 'd'-Attribut fuer 24x24.
  var ICON = {
    dashboard:     'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    partner:       'M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
    pruefung:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v6 M9 14h6',
    monitoring:    'M22 12h-4l-3 9L9 3l-3 9H2',
    ki:            'M12 3a9 9 0 0 0-9 9 8.9 8.9 0 0 0 .9 3.9L3 21l5.1-.9A9 9 0 1 0 12 3z M8 12h.01 M12 12h.01 M16 12h.01',
    berichte:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    team:          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    einstellungen: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
    schloss:       'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4',
    menue:         'M3 12h18 M3 6h18 M3 18h18'
  };

  // Module (Reihenfolge = Navigationsreihenfolge).
  //   art 'leer'      -> Leerzustand (Icon, Titel, Satz, "Kommt in Sx").
  //   art 'verbunden' -> oeffnet eine bestehende Ansicht per .click() auf 'ziel';
  //                      ist 'ziel' ausgeblendet -> gesperrt (Hinweis, kein Klick).
  //   start:true      -> Startmodul (wird beim Erscheinen aktiv, ohne zu klicken).
  var MODULE = [
    { id: 'dashboard', label: 'Dashboard', icon: ICON.dashboard, art: 'leer', bald: 'S3',
      satz: 'Dein Überblick über alle Prüfungen und Fristen entsteht hier.' },
    { id: 'partner', label: 'Geschäftspartner', icon: ICON.partner, art: 'verbunden',
      ziel: '#historyBtn', zielName: 'Akten & Ordner' },
    { id: 'pruefung', label: 'Neue Prüfung', icon: ICON.pruefung, art: 'verbunden', start: true,
      ziel: '.app header.header .logo-wrap', zielName: 'Neue Prüfung' },
    { id: 'monitoring', label: 'Monitoring', icon: ICON.monitoring, art: 'leer', bald: 'S7',
      satz: 'Die laufende Überwachung deiner Partner bekommt hier einen eigenen Platz.' },
    { id: 'ki', label: 'KI-Assistent', icon: ICON.ki, art: 'leer', bald: 'S4',
      satz: 'Ein Assistent, der dir bei Prüfungen und Fragen hilft, folgt hier.' },
    { id: 'berichte', label: 'Berichte & Audit', icon: ICON.berichte, art: 'leer', bald: 'S5',
      satz: 'Berichte und ein nachvollziehbares Prüfprotokoll findest du später hier.' },
    { id: 'team', label: 'Team', icon: ICON.team, art: 'verbunden',
      ziel: '#teamBtn', zielName: 'Team' },
    { id: 'einstellungen', label: 'Einstellungen', icon: ICON.einstellungen, art: 'verbunden',
      ziel: '#kontoBtn', zielName: 'Einstellungen' }
  ];

  var AKTIV = null;
  var navKnoepfe = {};   // id -> <button>

  // ---- kleine DOM-Helfer (kein innerHTML, keine Variablen-Injektion) ----
  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(dPfad, groesse) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (groesse) { svg.setAttribute('width', String(groesse)); svg.setAttribute('height', String(groesse)); }
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', dPfad);
    svg.appendChild(p);
    return svg;
  }

  function stilEinspielen() {
    if (document.getElementById('ccShellStil')) return;
    var s = document.createElement('style');
    s.id = 'ccShellStil';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- Inhaltsflaeche (#ccShellModul): Leerzustand / Gesperrt ----
  var inhaltWrap = null;
  function zeigeInhalt(knoten) {
    while (inhaltWrap.firstChild) inhaltWrap.removeChild(inhaltWrap.firstChild);
    inhaltWrap.appendChild(knoten);
    inhaltWrap.setAttribute('data-cc-sichtbar', '1');
  }
  function versteckeInhalt() {
    inhaltWrap.setAttribute('data-cc-sichtbar', '0');
    while (inhaltWrap.firstChild) inhaltWrap.removeChild(inhaltWrap.firstChild);
  }

  function leerKarte(mod) {
    var box = el('div', 'cc-leer');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(mod.icon, 30));
    box.appendChild(iconBox);
    box.appendChild(el('h2', 'cc-leer-titel', mod.label));
    box.appendChild(el('p', 'cc-leer-satz', mod.satz));
    box.appendChild(el('span', 'cc-leer-bald', 'Kommt in ' + mod.bald));
    return box;
  }

  function gesperrtKarte(mod) {
    var box = el('div', 'cc-leer');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(ICON.schloss, 30));
    box.appendChild(iconBox);
    box.appendChild(el('h2', 'cc-leer-titel', mod.label));
    box.appendChild(el('p', 'cc-leer-satz',
      'Dieser Bereich öffnet die bestehende Ansicht „' + mod.zielName + '".'));
    box.appendChild(el('p', 'cc-leer-hinweis',
      VORSCHAU ? 'In der Vorschau gesperrt – dafür ist eine Anmeldung nötig.'
               : 'Gerade gesperrt – für deine Rolle oder ohne Anmeldung nicht verfügbar.'));
    return box;
  }

  // ---- Modulwahl ----
  function setzeAktiv(modId) {
    AKTIV = modId;
    for (var id in navKnoepfe) {
      if (id === modId) navKnoepfe[id].setAttribute('aria-current', 'page');
      else navKnoepfe[id].removeAttribute('aria-current');
    }
  }

  function findeModul(modId) {
    for (var i = 0; i < MODULE.length; i++) if (MODULE[i].id === modId) return MODULE[i];
    return null;
  }

  function waehle(modId, initial) {
    var mod = findeModul(modId);
    if (!mod) return;
    setzeAktiv(modId);
    // Auf Mobil die ausgeklappte Leiste schliessen.
    document.body.classList.remove('cc-shell-auf');

    if (mod.art === 'leer') { zeigeInhalt(leerKarte(mod)); return; }

    var ziel = mod.ziel ? document.querySelector(mod.ziel) : null;
    var verfuegbar = !!(ziel && ziel.offsetParent !== null);
    if (!verfuegbar) { zeigeInhalt(gesperrtKarte(mod)); return; }

    versteckeInhalt();                       // Overlay weg -> echte App-Ansicht sichtbar
    if (!(initial && mod.start)) {           // Startmodul beim ersten Erscheinen nicht anklicken
      try { ziel.click(); } catch (e) {}
    }
  }

  // ---- Aufbau der Shell-DOM (einmalig) ----
  function baueShell() {
    // Mobiler Kopfbalken mit Umschalter.
    var balken = el('div', 'cc-shell-balken');
    var umschalter = el('button', 'cc-shell-umschalter');
    umschalter.setAttribute('type', 'button');
    umschalter.setAttribute('aria-label', 'Navigation umschalten');
    umschalter.setAttribute('data-cc-toggle', '1');
    umschalter.appendChild(icon(ICON.menue, 22));
    balken.appendChild(umschalter);
    balken.appendChild(el('span', 'cc-shell-balken-titel', 'Compliance'));

    // Seitenleiste.
    var nav = el('nav', 'cc-shell');
    nav.id = 'ccShell';
    nav.setAttribute('aria-label', 'Hauptnavigation');

    var marke = el('div', 'cc-shell-marke');
    marke.appendChild(el('span', 'cc-shell-punkt'));
    marke.appendChild(el('span', null, 'Compliance'));
    nav.appendChild(marke);

    var liste = el('div', 'cc-shell-nav');
    for (var i = 0; i < MODULE.length; i++) {
      var mod = MODULE[i];
      var b = el('button', 'cc-nav-eintrag');
      b.setAttribute('type', 'button');
      b.setAttribute('data-cc-modul', mod.id);
      b.appendChild(icon(mod.icon, 20));
      b.appendChild(el('span', null, mod.label));
      liste.appendChild(b);
      navKnoepfe[mod.id] = b;
    }
    nav.appendChild(liste);

    // Inhaltsflaeche fuer Leerzustaende.
    inhaltWrap = el('div', 'cc-shell-modul-wrap');
    inhaltWrap.id = 'ccShellModul';
    inhaltWrap.setAttribute('data-cc-sichtbar', '0');

    // DOM-Reihenfolge: Inhalt VOR der Leiste anhaengen, damit die Leiste bei
    // gleichem z-index zuletzt gemalt wird (Leiste > Inhalt). Im Normal-Betrieb
    // entscheidet ohnehin der z-index (Leiste 9000 > Inhalt 8000); erst in der
    // Vorschau liegen beide auf demselben Wert (--cc-z-vorschau), dort traegt
    // die Reihenfolge. Der Balken (oben) ueberlappt beide nicht.
    document.body.appendChild(balken);
    document.body.appendChild(inhaltWrap);
    document.body.appendChild(nav);

    // Event-Delegation: ein Listener fuer die ganze Navigation.
    // Enter/Leertaste waehlen ueber die native <button>-Aktivierung (loest 'click' aus).
    nav.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-cc-modul]') : null;
      if (!t) return;
      waehle(t.getAttribute('data-cc-modul'), false);
    });
    // Pfeil hoch/runter bewegt nur den Fokus in der Navigation (Roving-Fokus, ARIA-Muster).
    nav.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      var reihe = [];
      for (var i = 0; i < MODULE.length; i++) reihe.push(navKnoepfe[MODULE[i].id]);
      var idx = reihe.indexOf(document.activeElement);
      if (idx < 0) return;
      ev.preventDefault();
      var nxt = ev.key === 'ArrowDown' ? idx + 1 : idx - 1;
      if (nxt < 0) nxt = reihe.length - 1;
      if (nxt >= reihe.length) nxt = 0;
      reihe[nxt].focus();
    });
    umschalter.addEventListener('click', function () {
      document.body.classList.toggle('cc-shell-auf');
    });
  }

  // ---- Sichtbarkeit an .app koppeln ----
  function appSichtbar() {
    var a = document.querySelector('.app');
    if (!a) return false;
    var st = window.getComputedStyle(a);
    return st.display !== 'none' && st.visibility !== 'hidden' && a.offsetParent !== null;
  }

  function aktualisiereSichtbarkeit() {
    var zeigen = VORSCHAU ? true : appSichtbar();
    document.body.classList.toggle('cc-shell-an', zeigen);
    // Nur in der Vorschau (test + Vorschau-Schalter): zusaetzliche Klasse, die in
    // shell.css additiv Leiste/Inhalt/Balken ueber das Login-Gate (9999) hebt.
    // Ohne VORSCHAU wird die Klasse nie gesetzt (live/leer-Build: VORSCHAU=false).
    if (VORSCHAU) document.body.classList.add('cc-shell-vorschau');
    if (!zeigen) {
      document.body.classList.remove('cc-shell-auf');
      return;
    }
    // Bei (Wieder-)Erscheinen das aktive Modul (Default: Startmodul) rendern.
    if (AKTIV == null) {
      var start = MODULE[0];
      for (var i = 0; i < MODULE.length; i++) if (MODULE[i].start) { start = MODULE[i]; break; }
      waehle(start.id, true);
    }
  }

  function start() {
    stilEinspielen();
    baueShell();
    aktualisiereSichtbarkeit();
    var a = document.querySelector('.app');
    if (a && !VORSCHAU) {
      var mo = new MutationObserver(aktualisiereSichtbarkeit);
      mo.observe(a, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
