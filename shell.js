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
// Der Build (baueShellJs) ersetzt genau drei markierte Code-Zeilen weiter unten:
//   die 'var CSS = ...'-Zeile           -> JSON-String aus estate-tokens.css + shell.css
//   die 'var VORSCHAU = ...'-Zeile      -> Vorschau-Erkennung nur auf test, sonst false
//   die 'var VORSCHAU_DATEN = ...'-Zeile-> Fantasie-Vorschaudaten nur auf test, sonst null
// Die Token-Namen stehen bewusst NUR auf diesen drei Code-Zeilen (nicht hier im
// Kommentar), damit der Build sie verankert an der ganzen Zeile ersetzt.
// ============================================================================
(function () {
  'use strict';

  // --- Vom Build eingesetzt (siehe oben) ---
  var CSS = "/* ============================================================================\n   Estate-Design-Tokens fuer die Compliance-Plattform-Shell (S1).\n\n   Quelle der Werte: automati-real-estate @ 86dd138, src/index.css (@theme).\n   Diese Datei liegt auf Julius' Mac, NICHT auf der Box. Die hier gesetzten\n   Werte sind 1:1 aus dem Prompt (Zeus-Vorgabe S1) uebernommen; sie koennen\n   spaeter gegen die Original-@theme-Quelle gegengeprueft werden.\n\n   Nur BELEGTE Werte stehen hier als feste Variablen. Alles, was in der\n   Estate-Quelle keine Entsprechung hat (Seitenleisten-Breite, Icon-Satz,\n   Shell-Abstaende, Mobil-Muster), ist unten als PLATZHALTER markiert, weil\n   Estate keine Seitenleiste kennt.\n   ============================================================================ */\n\n:root {\n  /* Schrift (Inter laedt die Seite bereits; kein neuer Font-Link). */\n  --cc-font: 'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system,\n             'Segoe UI', Roboto, Arial, sans-serif;\n\n  /* Flaeche / Szene */\n  --cc-scene: #f2f2f0;\n\n  /* Brand (weisser Text erst ab 700) */\n  --cc-brand-50:  #eefbee;\n  --cc-brand-100: #ddf6dd;\n  --cc-brand-200: #bdeabf;\n  --cc-brand-300: #94da98;\n  --cc-brand-400: #6cc471;\n  --cc-brand-500: #4caf50;\n  --cc-brand-600: #36954d;\n  --cc-brand-700: #28773d;\n  --cc-brand-800: #1e5e31;\n  --cc-brand-900: #174825;\n  --cc-brand-950: #092913;\n\n  /* Ink (Text = ink-900) */\n  --cc-ink-50:  #f8fbfb;\n  --cc-ink-100: #f0f5f6;\n  --cc-ink-200: #e0e7e8;\n  --cc-ink-300: #ced6d7;\n  --cc-ink-400: #99a3a5;\n  --cc-ink-500: #626e71;\n  --cc-ink-600: #4d595c;\n  --cc-ink-700: #3b484a;\n  --cc-ink-800: #2d393b;\n  --cc-ink-900: #232e30;\n  --cc-ink-950: #101819;\n\n  /* Ampel (Fuellung / Text) */\n  --cc-urgent:      #ff3b30;\n  --cc-urgent-text: #c4170e;\n  --cc-pending:      #ff9500;\n  --cc-pending-text: #9a5200;\n  --cc-ok:      #34c759;\n  --cc-ok-text: #1a6e2e;\n\n  /* Bewegung (prefers-reduced-motion schaltet sie in shell.css ab) */\n  --cc-dauer-kurz:   120ms;\n  --cc-dauer-mittel: 180ms;\n  --cc-dauer-lang:   260ms;\n  --cc-ease-out: cubic-bezier(0.16, 1, 0.3, 1);\n\n  /* Muster (belegt) */\n  --cc-karte-radius:   1rem;\n  --cc-karte-flaeche:  #ffffff;\n  --cc-karte-rahmen:   inset 0 0 0 1px var(--cc-ink-200);\n  --cc-nav-radius:     0.75rem;\n  --cc-fokus-breite:   2px;\n  --cc-fokus-farbe:    var(--cc-brand-600);\n  --cc-fokus-abstand:  2px;\n  --cc-touch-min:      44px;\n  --cc-popover-schatten: 0 20px 50px -20px rgba(0, 0, 0, 0.35);\n\n  /* ---- PLATZHALTER - aus Estate-Quelle uebernehmen (Estate hat keine Seitenleiste) ---- */\n  --cc-shell-breite: 248px;     /* PLATZHALTER - aus Estate-Quelle uebernehmen */\n  --cc-shell-abstand: 16px;     /* PLATZHALTER - aus Estate-Quelle uebernehmen */\n  --cc-shell-mobil-bar: 52px;   /* PLATZHALTER - aus Estate-Quelle uebernehmen */\n  /* Icon-Satz: bis zur Estate-Quelle schlichte Strich-SVGs (siehe shell.js). */\n}\n\n/* ============================================================================\n   Shell-Layout (S1) der Compliance-Plattform. Nutzt die Estate-Tokens aus\n   estate-tokens.css. Wird vom Build (apps/web/build.mjs -> baueShellJs) als\n   String in dist/shell.js eingebettet und zur Laufzeit als <style id=\"ccShellStil\">\n   eingespielt (der Dev-Server kennt .css nicht, darum kein .css-Artefakt).\n\n   Minimal-invasiv: die Shell legt sich NEBEN die bestehende App. Werte, die in\n   der Estate-Quelle nicht belegt sind (Seitenleisten-Breite, Abstaende, Mobil-\n   Muster), kommen aus den PLATZHALTER-Variablen in estate-tokens.css.\n   ============================================================================ */\n\n/* Die Shell ist standardmaessig unsichtbar; erst body.cc-shell-an zeigt sie. */\n.cc-shell { display: none; }\n.cc-shell-modul-wrap { display: none; }\n\n/* ---------------------------------------------------------------- Desktop -- */\nbody.cc-shell-an .cc-shell { display: flex; }\n\n/* Inhalt der bestehenden App nach rechts schieben, damit die feste Leiste\n   nichts verdeckt (\"nichts abgeschnitten\"). Nur ab Tablet-Breite. */\n@media (min-width: 768px) {\n  body.cc-shell-an { padding-left: var(--cc-shell-breite); }\n}\n\n/* Seitenleiste */\n.cc-shell {\n  position: fixed;\n  top: 0;\n  left: 0;\n  bottom: 0;\n  width: var(--cc-shell-breite);\n  flex-direction: column;\n  gap: 4px;\n  box-sizing: border-box;\n  padding: calc(var(--cc-shell-abstand) + 28px) 12px var(--cc-shell-abstand);\n  background: var(--cc-karte-flaeche);\n  box-shadow: inset -1px 0 0 0 var(--cc-ink-200);\n  font-family: var(--cc-font);\n  color: var(--cc-ink-900);\n  z-index: 9000;                 /* ueber App-Inhalt, unter App-Modals (10001+) und Banner (99999) */\n  overflow-y: auto;\n}\n\n.cc-shell-marke {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 6px 10px 14px;\n  font-weight: 700;\n  font-size: 15px;\n  letter-spacing: .2px;\n  color: var(--cc-ink-900);\n}\n.cc-shell-marke .cc-shell-punkt {\n  width: 10px; height: 10px; border-radius: 50%;\n  background: var(--cc-brand-500);\n  box-shadow: 0 0 0 4px var(--cc-brand-100);\n  flex: 0 0 auto;\n}\n\n.cc-shell-nav { display: flex; flex-direction: column; gap: 2px; }\n\n/* Nav-Eintrag */\n.cc-nav-eintrag {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  width: 100%;\n  min-height: var(--cc-touch-min);\n  padding: 9px 12px;\n  border: 0;\n  border-radius: var(--cc-nav-radius);\n  background: transparent;\n  color: var(--cc-ink-700);\n  font-family: var(--cc-font);\n  font-size: 14px;\n  font-weight: 500;\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out),\n              color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-nav-eintrag svg { width: 20px; height: 20px; flex: 0 0 auto; }\n.cc-nav-eintrag:hover { background: var(--cc-ink-100); color: var(--cc-ink-900); }\n.cc-nav-eintrag[aria-current=\"page\"] {\n  background: var(--cc-brand-50);\n  color: var(--cc-brand-800);\n  font-weight: 600;\n}\n.cc-nav-eintrag:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\n.cc-nav-eintrag.cc-gesperrt { color: var(--cc-ink-400); }\n\n/* Leerzustand-/Hinweis-Flaeche (rechts neben der Leiste) */\nbody.cc-shell-an .cc-shell-modul-wrap[data-cc-sichtbar=\"1\"] { display: block; }\n.cc-shell-modul-wrap {\n  position: fixed;\n  top: 0; right: 0; bottom: 0;\n  left: 0;\n  z-index: 8000;              /* unter der Leiste (9000), damit die Nav klickbar bleibt */\n  background: var(--cc-scene);\n  overflow-y: auto;\n  font-family: var(--cc-font);\n  color: var(--cc-ink-900);\n}\n@media (min-width: 768px) {\n  .cc-shell-modul-wrap { left: var(--cc-shell-breite); }\n}\n\n.cc-leer {\n  max-width: 460px;\n  margin: 14vh auto 0;\n  padding: 40px 28px;\n  text-align: center;\n}\n.cc-leer-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 64px; height: 64px;\n  margin-bottom: 20px;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n  color: var(--cc-brand-600);\n}\n.cc-leer-icon svg { width: 30px; height: 30px; }\n.cc-leer-titel { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: var(--cc-ink-900); }\n.cc-leer-satz { margin: 0 0 6px; font-size: 14px; line-height: 1.5; color: var(--cc-ink-600); }\n.cc-leer-bald {\n  display: inline-block;\n  margin-top: 14px;\n  padding: 5px 12px;\n  border-radius: 999px;\n  background: var(--cc-brand-50);\n  color: var(--cc-brand-800);\n  font-size: 12px;\n  font-weight: 600;\n}\n.cc-leer-hinweis {\n  margin-top: 18px;\n  font-size: 13px;\n  color: var(--cc-pending-text);\n}\n\n/* Primaer-Knopf (fuer \"Bisherige Ansicht oeffnen\", falls eine Funktion existiert) */\n.cc-knopf {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  min-height: var(--cc-touch-min);\n  margin-top: 18px;\n  padding: 10px 18px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--cc-brand-700);\n  color: #ffffff;\n  font-family: var(--cc-font);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-knopf:hover { background: var(--cc-brand-800); }\n.cc-knopf:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\n\n/* ----------------------------------------------------------------- Mobil -- */\n/* PLATZHALTER-Muster: unter 768px klappt die Leiste ein; ein Balken mit\n   Umschalter oben. Estate hat keine Seitenleiste -> spaeter gegenpruefen. */\n.cc-shell-balken { display: none; }\n@media (max-width: 767.98px) {\n  body.cc-shell-an .cc-shell-balken {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    position: fixed;\n    top: 0; left: 0; right: 0;\n    height: var(--cc-shell-mobil-bar);\n    padding: 0 12px;\n    background: var(--cc-karte-flaeche);\n    box-shadow: inset 0 -1px 0 0 var(--cc-ink-200);\n    font-family: var(--cc-font);\n    z-index: 9001;\n  }\n  body.cc-shell-an { padding-top: var(--cc-shell-mobil-bar); }\n  .cc-shell {\n    top: var(--cc-shell-mobil-bar);\n    width: min(84vw, var(--cc-shell-breite));\n    transform: translateX(-102%);\n    transition: transform var(--cc-dauer-mittel) var(--cc-ease-out);\n    box-shadow: var(--cc-popover-schatten);\n  }\n  body.cc-shell-auf .cc-shell { transform: translateX(0); }\n  .cc-shell-modul-wrap { top: var(--cc-shell-mobil-bar); }\n}\n.cc-shell-umschalter {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: var(--cc-touch-min);\n  height: var(--cc-touch-min);\n  border: 0;\n  border-radius: var(--cc-nav-radius);\n  background: transparent;\n  color: var(--cc-ink-800);\n  cursor: pointer;\n}\n.cc-shell-umschalter:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\n.cc-shell-balken-titel { font-weight: 700; font-size: 15px; color: var(--cc-ink-900); }\n\n/* Bewegung aus, wenn der Nutzer das will. */\n@media (prefers-reduced-motion: reduce) {\n  .cc-nav-eintrag, .cc-knopf, .cc-shell { transition: none; }\n}\n\n/* ------------------------------------------- S2 Geschäftspartner + Akte -- */\n/* Von der Shell selbst gerenderte Inhalte im .cc-shell-modul-wrap. Estate-Tokens,\n   kein neues Design: weisse Karten, Ampel aus --cc-ok/-pending/-urgent. */\n.cc-partner, .cc-akte {\n  max-width: 880px;\n  margin: 0 auto;\n  padding: clamp(18px, 4vw, 36px) clamp(14px, 4vw, 28px) 48px;\n  box-sizing: border-box;\n}\n.cc-partner-kopf {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 16px;\n  flex-wrap: wrap;\n  margin-bottom: 18px;\n}\n.cc-partner-titel { margin: 0; font-size: 22px; font-weight: 700; color: var(--cc-ink-900); }\n.cc-partner-unter { margin: 4px 0 0; font-size: 13px; color: var(--cc-ink-500); }\n\n.cc-partner-such { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }\n.cc-such-feld {\n  flex: 1 1 220px;\n  min-height: var(--cc-touch-min);\n  padding: 9px 14px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n  font-family: var(--cc-font);\n  font-size: 14px;\n  color: var(--cc-ink-900);\n}\n.cc-such-feld:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-ampel-filter { display: flex; flex-wrap: wrap; gap: 6px; }\n.cc-chip {\n  min-height: 36px;\n  padding: 6px 14px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--cc-ink-100);\n  color: var(--cc-ink-700);\n  font-family: var(--cc-font);\n  font-size: 13px;\n  font-weight: 600;\n  cursor: pointer;\n}\n.cc-chip:hover { background: var(--cc-ink-200); }\n.cc-chip-an { background: var(--cc-brand-700); color: #ffffff; }\n.cc-chip:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n\n.cc-partner-liste { display: flex; flex-direction: column; gap: 10px; }\n.cc-partner-zeile {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  width: 100%;\n  min-height: var(--cc-touch-min);\n  padding: 14px 18px;\n  border: 0;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: box-shadow var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-partner-zeile:hover { box-shadow: var(--cc-karte-rahmen), 0 6px 20px -12px rgba(0, 0, 0, 0.3); }\n.cc-partner-zeile:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-pz-links { min-width: 0; }\n.cc-pz-name { font-size: 15px; font-weight: 600; color: var(--cc-ink-900); overflow-wrap: anywhere; }\n.cc-pz-meta { margin-top: 4px; font-size: 12.5px; color: var(--cc-ink-500); display: flex; flex-wrap: wrap; gap: 6px; }\n.cc-pz-sep { opacity: .5; }\n.cc-partner-keine { margin: 10px 2px; font-size: 13px; color: var(--cc-ink-500); }\n\n/* Ampel-Pille */\n.cc-ampel {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  flex: 0 0 auto;\n  padding: 5px 12px 5px 10px;\n  border-radius: 999px;\n  font-size: 14px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n}\n.cc-ampel-punkt { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }\n.cc-ampel-ok      { background: rgba(52, 199, 89, 0.14);  color: var(--cc-ok-text); }\n.cc-ampel-ok      .cc-ampel-punkt { background: var(--cc-ok); }\n.cc-ampel-pending { background: rgba(255, 149, 0, 0.16);  color: var(--cc-pending-text); }\n.cc-ampel-pending .cc-ampel-punkt { background: var(--cc-pending); }\n.cc-ampel-urgent  { background: rgba(255, 59, 48, 0.14);  color: var(--cc-urgent-text); }\n.cc-ampel-urgent  .cc-ampel-punkt { background: var(--cc-urgent); }\n.cc-ampel-grau    { background: var(--cc-ink-100); color: var(--cc-ink-500); }\n.cc-ampel-grau    .cc-ampel-punkt { background: var(--cc-ink-400); }\n\n/* Platzhalter-Markierung */\n.cc-platzhalter {\n  display: inline-block;\n  padding: 2px 8px;\n  border-radius: 6px;\n  background: rgba(255, 149, 0, 0.12);\n  color: var(--cc-pending-text);\n  font-size: 12px;\n  font-weight: 600;\n}\n\n/* Knopf-Varianten */\n.cc-knopf-leise { background: var(--cc-ink-100); color: var(--cc-ink-800); margin-top: 0; }\n.cc-knopf-leise:hover { background: var(--cc-ink-200); }\n\n/* ---- Akte ---- */\n.cc-akte-kopf { margin-bottom: 10px; }\n.cc-akte-zurueck {\n  display: inline-flex;\n  align-items: center;\n  min-height: 40px;\n  padding: 6px 14px 6px 10px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: var(--cc-brand-800);\n  font-family: var(--cc-font);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n}\n.cc-akte-zurueck:hover { background: var(--cc-brand-50); }\n.cc-akte-zurueck:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-akte-titelzeile { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 4px 2px 18px; flex-wrap: wrap; }\n.cc-akte-name { margin: 0; font-size: 22px; font-weight: 700; color: var(--cc-ink-900); overflow-wrap: anywhere; }\n\n.cc-karte {\n  margin-bottom: 14px;\n  padding: 18px 20px;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n}\n.cc-karte-titel { margin: 0 0 12px; font-size: 13px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: var(--cc-ink-500); }\n\n.cc-stamm-zeile { display: flex; justify-content: space-between; gap: 14px; padding: 8px 0; border-top: 1px solid var(--cc-ink-100); }\n.cc-akte-stamm .cc-stamm-zeile:first-of-type { border-top: 0; }\n.cc-stamm-label { font-size: 13px; color: var(--cc-ink-500); }\n.cc-stamm-wert { font-size: 14px; font-weight: 600; color: var(--cc-ink-900); text-align: right; overflow-wrap: anywhere; }\n\n/* Score-Verlauf (SVG-Balken; Farbe per fill, keine inline styles) */\n.cc-verlauf { overflow-x: auto; }\n.cc-verlauf-svg { display: block; max-width: 100%; height: 120px; }\n.cc-verlauf-bar.cc-ampel-ok { fill: var(--cc-ok); }\n.cc-verlauf-bar.cc-ampel-pending { fill: var(--cc-pending); }\n.cc-verlauf-bar.cc-ampel-urgent { fill: var(--cc-urgent); }\n.cc-verlauf-bar.cc-ampel-grau { fill: var(--cc-ink-300); }\n.cc-verlauf-zahl { fill: var(--cc-ink-600); font-size: 12px; font-weight: 600; font-family: var(--cc-font); }\n\n/* Von der Shell per Klasse aus-/eingeblendet (statt inline-Stil) */\n.cc-aus { display: none !important; }\n\n/* S2: schwebender Knopf „Zur Akte dieses Geschäftspartners\" (nur bei aktivem #report) */\n.cc-zur-akte {\n  position: fixed;\n  right: 20px;\n  bottom: 20px;\n  z-index: 9500;                 /* über App-Inhalt, unter App-Modals (10001+) */\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  min-height: var(--cc-touch-min);\n  padding: 11px 18px;\n  border: 0;\n  border-radius: 999px;\n  background: var(--cc-brand-700);\n  color: #ffffff;\n  font-family: var(--cc-font);\n  font-size: 14px;\n  font-weight: 600;\n  cursor: pointer;\n  box-shadow: var(--cc-popover-schatten);\n}\n.cc-zur-akte svg { width: 18px; height: 18px; flex: 0 0 auto; }\n.cc-zur-akte:hover { background: var(--cc-brand-800); }\n.cc-zur-akte:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n@media (min-width: 768px) { body.cc-shell-an .cc-zur-akte { right: 24px; bottom: 24px; } }\n\n/* Prüfhistorie */\n.cc-hist-liste { display: flex; flex-direction: column; }\n.cc-hist-zeile { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-top: 1px solid var(--cc-ink-100); }\n.cc-hist-liste .cc-hist-zeile:first-child { border-top: 0; }\n.cc-hist-datum { flex: 0 0 96px; font-size: 13px; font-weight: 600; color: var(--cc-ink-800); font-variant-numeric: tabular-nums; }\n.cc-hist-pid { flex: 1 1 auto; text-align: right; font-size: 12.5px; color: var(--cc-ink-500); overflow-wrap: anywhere; }\n\n.cc-akte-aktion { margin-top: 8px; }\n\n/* ------------------------------------------------- Vorschau (nur test) -- */\n/* NUR additiv unter body.cc-shell-vorschau (gesetzt von shell.js, wenn\n   APP_ENV === 'test' UND der Vorschau-Schalter in der Adresse steht). Ohne\n   Login liegt sonst das Login-Gate (z-index 9999) ueber der Shell und man\n   sieht nur die Maske. Hier heben wir Leiste, Inhalt und Mobil-Balken auf\n   EINEN gemeinsamen Wert (--cc-z-vorschau = 10000): ueber das Login-Gate\n   (9999), aber unter den App-Modals/Knoepfen (10001+) und dem Testbanner\n   (99999). Die Reihenfolge Leiste > Inhalt kommt aus der DOM-Reihenfolge\n   (nav wird in shell.js NACH dem Inhalt angehaengt), nicht aus hoeheren Zahlen.\n   Das Start-Gate (10000) liegt im DOM vor der Shell und wird darum von ihr\n   ueberdeckt. Das ausgeklappte Mobil-Menue ist dieselbe .cc-shell und erbt den\n   Wert. Die Normal-Ansicht (9000/8000/9001) bleibt unberuehrt. */\nbody.cc-shell-vorschau { --cc-z-vorschau: 10000; }\nbody.cc-shell-vorschau .cc-shell { z-index: var(--cc-z-vorschau); }\nbody.cc-shell-vorschau .cc-shell-modul-wrap { z-index: var(--cc-z-vorschau); }\nbody.cc-shell-vorschau .cc-shell-balken { z-index: var(--cc-z-vorschau); }\n\n/* ---------------------------------------------------- S3 Dashboard (additiv) -- */\n/* NUR neue .cc-dash-*-Regeln; bestehende Regeln + alle z-index-Werte unveraendert (shell-vorschau C2).\n   Design folgt Estate (ruhige weisse Karten, vorhandene Tokens, Ampel aus den .cc-ampel-*-Regeln oben);\n   Struktur vor Optik. Kein neues z-index, keine neue Farbe ausserhalb der Tokens. Grundlayout bleibt\n   Claude-/ChatGPT-Stil (Leiste links, Inhalt hier rechts im #ccShellModul). */\n.cc-dash {\n  max-width: 880px;\n  margin: 0 auto;\n  padding: clamp(18px, 4vw, 36px) clamp(14px, 4vw, 28px) 56px;\n  box-sizing: border-box;\n}\n.cc-dash-kopf { margin-bottom: 20px; }\n.cc-dash-titel { margin: 0; font-size: 22px; font-weight: 700; color: var(--cc-ink-900); }\n.cc-dash-unter { margin: 4px 0 0; font-size: 13px; color: var(--cc-ink-500); }\n\n.cc-dash-bereich { margin-bottom: 22px; }\n.cc-dash-bereich-titel {\n  margin: 0 0 12px;\n  font-size: 13px;\n  font-weight: 700;\n  letter-spacing: .4px;\n  text-transform: uppercase;\n  color: var(--cc-ink-500);\n}\n\n/* Bereich 1: Handlungsbedarf – Ampel NUR hier. */\n.cc-dash-bedarf-liste { display: flex; flex-direction: column; gap: 10px; }\n.cc-dash-bedarf-zeile {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  width: 100%;\n  min-height: var(--cc-touch-min);\n  padding: 14px 18px;\n  border: 0;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: box-shadow var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-dash-bedarf-zeile:hover { box-shadow: var(--cc-karte-rahmen), 0 6px 20px -12px rgba(0, 0, 0, 0.3); }\n.cc-dash-bedarf-zeile:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-dash-bz-links { min-width: 0; }\n.cc-dash-bz-name { font-size: 15px; font-weight: 600; color: var(--cc-ink-900); overflow-wrap: anywhere; }\n.cc-dash-bz-meta { margin-top: 4px; font-size: 12.5px; color: var(--cc-ink-500); }\n/* Leer-Fall: ruhiger Satz OHNE Ampelfarbe. */\n.cc-dash-ruhig {\n  margin: 0;\n  padding: 16px 18px;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n  font-size: 14px;\n  color: var(--cc-ink-600);\n}\n\n/* Bereich 2: Tages-Briefing. */\n.cc-dash-briefing {\n  padding: 18px 20px;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n}\n.cc-dash-briefing .cc-dash-bereich-titel { margin-bottom: 14px; }\n.cc-dash-kennzahlen {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));\n  gap: 12px;\n}\n.cc-dash-kennzahl {\n  padding: 12px 14px;\n  border-radius: var(--cc-nav-radius);\n  background: var(--cc-scene);\n}\n.cc-dash-kz-zahl { font-size: 24px; font-weight: 700; color: var(--cc-ink-900); font-variant-numeric: tabular-nums; }\n.cc-dash-kz-text { margin-top: 2px; font-size: 12.5px; color: var(--cc-ink-500); }\n.cc-dash-letzte { margin: 14px 0 0; font-size: 13px; color: var(--cc-ink-600); }\n.cc-dash-letzte-label { color: var(--cc-ink-500); }\n.cc-dash-letzte-firma { font-weight: 600; color: var(--cc-ink-800); overflow-wrap: anywhere; }\n\n/* Bereich 3: Bereiche wie Estate – ruhige Karten. */\n.cc-dash-abteilungen {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n  gap: 12px;\n}\n.cc-dash-karte {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 8px;\n  min-height: var(--cc-touch-min);\n  padding: 16px 18px;\n  border: 0;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-karte-flaeche);\n  box-shadow: var(--cc-karte-rahmen);\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: box-shadow var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-dash-karte:hover { box-shadow: var(--cc-karte-rahmen), 0 6px 20px -12px rgba(0, 0, 0, 0.3); }\n.cc-dash-karte:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-dash-karte-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 40px; height: 40px;\n  border-radius: var(--cc-nav-radius);\n  background: var(--cc-brand-50);\n  color: var(--cc-brand-700);\n}\n.cc-dash-karte-icon svg { width: 22px; height: 22px; }\n.cc-dash-karte-titel { font-size: 15px; font-weight: 600; color: var(--cc-ink-900); }\n.cc-dash-karte-satz { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--cc-ink-500); }\n\n/* KI-Platz: zentrale Flaeche, nur Markierung (ab S4 der Assistent). */\n.cc-dash-ki {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  text-align: center;\n  gap: 12px;\n  margin-top: 6px;\n  padding: 32px 24px;\n  border-radius: var(--cc-karte-radius);\n  background: var(--cc-brand-50);\n  box-shadow: inset 0 0 0 1px var(--cc-brand-100);\n}\n.cc-dash-ki-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 56px; height: 56px;\n  border-radius: 50%;\n  background: var(--cc-karte-flaeche);\n  color: var(--cc-brand-600);\n  box-shadow: var(--cc-karte-rahmen);\n}\n.cc-dash-ki-icon svg { width: 30px; height: 30px; }\n.cc-dash-ki-satz { margin: 0; max-width: 420px; font-size: 14px; line-height: 1.5; color: var(--cc-brand-900); }\n";
  var VORSCHAU = (typeof window !== 'undefined' && !!window.location && window.location.search.indexOf('vorschau=shell') >= 0);
  var VORSCHAU_DATEN = [{"id":"vs1","pruef_id":"VS-1003","firmenname":"Nordlicht Handels GmbH (Fantasie)","land":"DE","ust_id":"DE900000001","score":84,"verdict":"ok","created_at":"2026-11-17T10:12:00Z","report_json":{"_email":"kontakt@nordlicht.example.invalid"}},{"id":"vs2","pruef_id":"VS-1002","firmenname":"Nordlicht Handels GmbH (Fantasie)","land":"DE","ust_id":"DE900000001","score":67,"verdict":"warn","created_at":"2026-08-04T10:12:00Z","report_json":{"_email":"kontakt@nordlicht.example.invalid"}},{"id":"vs3","pruef_id":"VS-1001","firmenname":"Alpenquell Mineral AG (Fantasie)","land":"AT","ust_id":"ATU90000001","score":52,"verdict":"warn","created_at":"2026-11-09T09:30:00Z","report_json":{"_email":"info@alpenquell.example.invalid"}},{"id":"vs4","pruef_id":"VS-1000","firmenname":"Mistral Trading Ltd (Fantasie)","land":"FR","ust_id":null,"score":38,"verdict":"bad","created_at":"2026-10-21T14:05:00Z","report_json":{"_email":"bonjour@mistral.example.invalid"}}];

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
  //   art 'partner'   -> S2: von der Shell SELBST gerenderte Geschaeftspartner-Liste + Akte, gespeist
  //                      NUR aus der Lese-Bruecke historieLesekopie() (tief gefrorene Kopie, je Anzeige
  //                      frisch). Die Shell schreibt nichts; "Bisherige Ansicht"/PDF gehen per .click()
  //                      auf #historyBtn. Vorschau nutzt statt der Bruecke die Fantasie-Daten (nur test).
  //   art 'dashboard' -> S3: von der Shell SELBST gerendertes Dashboard (Handlungsbedarf, Tages-Briefing,
  //                      Bereiche, KI-Platz). Daten nur lesend ueber brueckeZeilen(); klickt #historyBtn
  //                      NICHT und schreibt nie in den App-State.
  //   start:true      -> Startmodul (wird beim Erscheinen aktiv, ohne zu klicken). S3 (Zeus): Start = dashboard.
  var MODULE = [
    { id: 'dashboard', label: 'Dashboard', icon: ICON.dashboard, art: 'dashboard', start: true },
    { id: 'partner', label: 'Geschäftspartner', icon: ICON.partner, art: 'partner' },
    { id: 'pruefung', label: 'Neue Prüfung', icon: ICON.pruefung, art: 'verbunden',
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

  // ==========================================================================
  // S2 Geschaeftspartner: Liste + Akte, gespeist NUR aus der Lese-Bruecke.
  // Keine App-Funktion ausser historieLesekopie() (per Name, typeof-geprueft) und
  // .click() auf #historyBtn. Kein eigener Datencache: bei jedem Anzeigen frisch.
  // Zeigt nur Felder, die in den Zeilen schon stehen; fehlende -> PLATZHALTER.
  // ==========================================================================
  var partnerSuche = '';          // UI-Filtertext (KEIN Datencache)
  var partnerAmpel = 'alle';      // UI-Ampelfilter

  function brueckeZeilen() {
    // Vorschau nutzt NIE die Bruecke (Zeus): dort kommen die Fantasie-Daten (Block 6), sonst die Bruecke.
    if (VORSCHAU && typeof VORSCHAU_DATEN !== 'undefined' && Array.isArray(VORSCHAU_DATEN)) return VORSCHAU_DATEN;
    if (typeof historieLesekopie !== 'function') return [];
    var b = historieLesekopie();
    return Array.isArray(b) ? b : [];
  }

  // Partner-Schluessel: USt-ID (stark, je Firma eindeutig), sonst normalisierter Name + Land.
  function pNameKern(n) {
    return String(n == null ? '' : n).toLowerCase()
      .replace(/\b(gmbh|ag|kg|ohg|ug|mbh|se|gbr|ltd|limited|inc|corp|co|kgaa)\b/g, ' ')
      .replace(/[^a-z0-9äöüß]+/g, ' ').trim();
  }
  function partnerSchluessel(z) {
    var ust = (z && z.ust_id != null) ? String(z.ust_id).toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    if (ust) return 'ust:' + ust;
    var land = (z && z.land != null) ? String(z.land).trim().toLowerCase() : '';
    return 'nk:' + pNameKern(z && z.firmenname) + '|' + land;
  }
  // Bestehende Score-Grenzen (index.html Z.19436-38): gruen >=75, gelb 50-74, rot <50.
  function ampelKlasse(score) {
    if (typeof score !== 'number' || isNaN(score)) return 'grau';
    if (score >= 75) return 'ok';
    if (score >= 50) return 'pending';
    return 'urgent';
  }
  function zeitText(iso) {
    if (!iso) return null;
    var tms = Date.parse(iso);
    if (isNaN(tms)) return null;
    var d = new Date(tms);
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  // Gruppiert Zeilen zu Partnern; je Partner die neueste Pruefung oben, Partner nach letzter Pruefung.
  function partnerGruppen(zeilen) {
    var map = {};
    var reihenfolge = [];
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i];
      if (!z) continue;
      var k = partnerSchluessel(z);
      if (!map[k]) { map[k] = { key: k, zeilen: [] }; reihenfolge.push(k); }
      map[k].zeilen.push(z);
    }
    var gruppen = [];
    for (var j = 0; j < reihenfolge.length; j++) {
      var g = map[reihenfolge[j]];
      g.zeilen.sort(function (a, b) {
        return (Date.parse((b && b.created_at) || '') || 0) - (Date.parse((a && a.created_at) || '') || 0);
      });
      var neu = g.zeilen[0] || {};
      g.name = (neu.firmenname != null && String(neu.firmenname).trim()) ? String(neu.firmenname) : null;
      g.land = (neu.land != null && String(neu.land).trim()) ? String(neu.land) : null;
      g.ust = (neu.ust_id != null && String(neu.ust_id).trim()) ? String(neu.ust_id) : null;
      g.letzterScore = (typeof neu.score === 'number') ? neu.score : null;
      g.letztePruefung = zeitText(neu.created_at);
      g.letztMs = Date.parse((neu && neu.created_at) || '') || 0;
      gruppen.push(g);
    }
    gruppen.sort(function (a, b) { return b.letztMs - a.letztMs; });
    return gruppen;
  }

  // ==========================================================================
  // S3 Dashboard-Daten (reine Funktion, KEIN DOM, KEIN Schreiben, KEIN Date.now()).
  // ==========================================================================
  // Handlungsbedarf = Partner, deren NEUESTE Pruefung unter der gruenen Grenze liegt (Zeus: neueste
  // Pruefung < 75). 'urgent' = rot (<50), 'pending' = gelb (50-74). 'ok' (gruen, >=75) und 'grau'
  // (ohne Score) sind KEIN Handlungsbedarf – grau zaehlt nur als Zahl „ohne Score", nie mit Ampel.
  var HANDLUNGSBEDARF_KLASSEN = ['urgent', 'pending'];

  // Kennzahlen fuer das Dashboard aus den Zeilen; nutzt partnerGruppen (neueste Pruefung je Partner oben,
  // Partner nach letzter Pruefung) + ampelKlasse. Deterministisch (keine Zeitfenster). Gibt NUR Zahlen/Listen
  // zurueck, rendert nichts und schreibt nichts in den App-State.
  function dashboardDaten(zeilen) {
    var gruppen = partnerGruppen(Array.isArray(zeilen) ? zeilen : []);
    var pruefAnzahl = 0, rot = 0, gelb = 0, ohneScore = 0;
    var bedarf = [];
    for (var i = 0; i < gruppen.length; i++) {
      var g = gruppen[i];
      pruefAnzahl += g.zeilen.length;
      var kl = ampelKlasse(g.letzterScore);
      if (kl === 'urgent') rot++;
      else if (kl === 'pending') gelb++;
      else if (kl === 'grau') ohneScore++;
      if (HANDLUNGSBEDARF_KLASSEN.indexOf(kl) >= 0) {
        bedarf.push({ key: g.key, name: g.name, land: g.land, score: g.letzterScore,
          klasse: kl, letztePruefung: g.letztePruefung, letztMs: g.letztMs });
      }
    }
    // rot vor gelb, dann neueste zuerst.
    var rang = { urgent: 0, pending: 1 };
    bedarf.sort(function (a, b) {
      if (rang[a.klasse] !== rang[b.klasse]) return rang[a.klasse] - rang[b.klasse];
      return b.letztMs - a.letztMs;
    });
    // Letzte Pruefung = juengste Zeile ueber alle Partner. partnerGruppen sortiert Partner nach letztMs
    // absteigend -> gruppen[0] traegt die global juengste Zeile (Name + Datum daraus). Kein Datum -> null.
    var letzte = (gruppen.length && gruppen[0].letztMs)
      ? { firma: gruppen[0].name, datum: gruppen[0].letztePruefung }
      : null;
    return {
      partnerAnzahl: gruppen.length,
      pruefAnzahl: pruefAnzahl,
      handlungsbedarf: bedarf,
      rotAnzahl: rot,
      gelbAnzahl: gelb,
      ohneScoreAnzahl: ohneScore,
      letztePruefung: letzte
    };
  }

  // ---- kleine Bausteine ----
  function platzhalter(text) { return el('span', 'cc-platzhalter', text || 'PLATZHALTER – Julius legt fest'); }

  function ampelPille(score) {
    var kl = ampelKlasse(score);
    var pille = el('span', 'cc-ampel cc-ampel-' + kl);
    pille.appendChild(el('span', 'cc-ampel-punkt'));
    pille.appendChild(el('span', 'cc-ampel-zahl', (typeof score === 'number' && !isNaN(score)) ? String(score) : '–'));
    return pille;
  }

  function hinweisKarte(titel, satz) {
    var box = el('div', 'cc-leer');
    box.appendChild(el('h2', 'cc-leer-titel', titel));
    box.appendChild(el('p', 'cc-leer-satz', satz));
    return box;
  }

  // Oeffnet die bestehende Ansicht "Akten & Ordner" per .click() auf #historyBtn (einziger Weg; keine
  // App-Funktion). Ist der Knopf nicht da/verborgen (Vorschau, nicht eingeloggt) -> Hinweis.
  function oeffneBestehendeHistorie() {
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) {
      versteckeInhalt();
      try { btn.click(); } catch (e) {}
    } else {
      zeigeInhalt(hinweisKarte(
        VORSCHAU ? 'In der Vorschau gesperrt' : 'Anmeldung nötig',
        'Die bestehende Ansicht „Akten & Ordner“ öffnet sich nach dem Login.'));
    }
  }

  // ---- Leerzustand ----
  function partnerLeer() {
    var box = el('div', 'cc-leer');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(ICON.partner, 30));
    box.appendChild(iconBox);
    box.appendChild(el('h2', 'cc-leer-titel', 'Noch keine Akten geladen'));
    box.appendChild(el('p', 'cc-leer-satz',
      'Sobald Prüfungen geladen sind, erscheinen hier alle Geschäftspartner mit Score, Land und Verlauf.'));
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) {
      var laden = el('button', 'cc-knopf', 'Akten laden („Akten & Ordner“)');
      laden.setAttribute('type', 'button');
      laden.addEventListener('click', oeffneBestehendeHistorie);
      box.appendChild(laden);
    } else {
      box.appendChild(el('p', 'cc-leer-hinweis', VORSCHAU
        ? 'In der Vorschau siehst du Beispiel-Partner; echte Akten gibt es nach dem Login.'
        : 'Dafür ist eine Anmeldung nötig.'));
    }
    return box;
  }

  // ---- Eine Partner-Zeile in der Liste (Knopf -> Akte) ----
  function partnerZeile(g) {
    var btn = el('button', 'cc-partner-zeile');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-cc-such', ((g.name || '') + ' ' + (g.land || '') + ' ' + (g.ust || '')).toLowerCase());
    btn.setAttribute('data-cc-ampel-kl', ampelKlasse(g.letzterScore));
    var links = el('div', 'cc-pz-links');
    var nameEl = el('div', 'cc-pz-name');
    if (g.name) nameEl.textContent = g.name; else nameEl.appendChild(platzhalter());
    links.appendChild(nameEl);
    var meta = el('div', 'cc-pz-meta');
    meta.appendChild(el('span', 'cc-pz-land', g.land || '—'));
    meta.appendChild(el('span', 'cc-pz-sep', '·'));
    meta.appendChild(el('span', null, g.zeilen.length + (g.zeilen.length === 1 ? ' Prüfung' : ' Prüfungen')));
    if (g.letztePruefung) {
      meta.appendChild(el('span', 'cc-pz-sep', '·'));
      meta.appendChild(el('span', null, 'zuletzt ' + g.letztePruefung));
    }
    links.appendChild(meta);
    btn.appendChild(links);
    btn.appendChild(ampelPille(g.letzterScore));
    btn.addEventListener('click', function () { zeigeInhalt(partnerAkteAnsicht(g.key)); });
    return btn;
  }

  // ---- Such-/Ampelfilter auf die schon gerenderte Liste anwenden (ohne Neu-Lesen, Fokus bleibt) ----
  function filterAnwenden(wrap) {
    var such = partnerSuche.trim().toLowerCase();
    var zeilen = wrap.querySelectorAll('.cc-partner-zeile');
    var sichtbar = 0;
    for (var i = 0; i < zeilen.length; i++) {
      var z = zeilen[i];
      var ok = true;
      if (partnerAmpel !== 'alle' && z.getAttribute('data-cc-ampel-kl') !== partnerAmpel) ok = false;
      if (ok && such && (z.getAttribute('data-cc-such') || '').indexOf(such) < 0) ok = false;
      z.classList.toggle('cc-aus', !ok);     // CSS-Klasse statt inline-Stil (Shell-Invariante)
      if (ok) sichtbar++;
    }
    var keine = wrap.querySelector('.cc-partner-keine');
    if (keine) keine.classList.toggle('cc-aus', sichtbar > 0);
  }

  // ---- Listenansicht ----
  function partnerListeAnsicht(zeilen) {
    var gruppen = partnerGruppen(zeilen);
    var wrap = el('div', 'cc-partner');

    var kopf = el('div', 'cc-partner-kopf');
    var titelBox = el('div', null);
    titelBox.appendChild(el('h2', 'cc-partner-titel', 'Geschäftspartner'));
    titelBox.appendChild(el('p', 'cc-partner-unter',
      gruppen.length + (gruppen.length === 1 ? ' Partner aus deinen Prüfungen' : ' Partner aus deinen Prüfungen')));
    kopf.appendChild(titelBox);
    var bisher = el('button', 'cc-knopf cc-knopf-leise', 'Bisherige Ansicht (Akten & Ordner)');
    bisher.setAttribute('type', 'button');
    bisher.addEventListener('click', oeffneBestehendeHistorie);
    kopf.appendChild(bisher);
    wrap.appendChild(kopf);

    var suchBox = el('div', 'cc-partner-such');
    var sinput = el('input', 'cc-such-feld');
    sinput.setAttribute('type', 'search');
    sinput.setAttribute('placeholder', 'Partner suchen …');
    sinput.setAttribute('aria-label', 'Partner suchen');
    sinput.value = partnerSuche;
    sinput.addEventListener('input', function () { partnerSuche = sinput.value; filterAnwenden(wrap); });
    suchBox.appendChild(sinput);
    var chips = el('div', 'cc-ampel-filter');
    var chipDef = [['alle', 'Alle'], ['ok', 'Unauffällig'], ['pending', 'Zu prüfen'], ['urgent', 'Kritisch']];
    for (var c = 0; c < chipDef.length; c++) {
      var chip = el('button', 'cc-chip' + (partnerAmpel === chipDef[c][0] ? ' cc-chip-an' : ''), chipDef[c][1]);
      chip.setAttribute('type', 'button');
      chip.setAttribute('data-cc-ampel', chipDef[c][0]);
      chips.appendChild(chip);
    }
    chips.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-cc-ampel]') : null;
      if (!t) return;
      partnerAmpel = t.getAttribute('data-cc-ampel');
      var alle = chips.querySelectorAll('[data-cc-ampel]');
      for (var i = 0; i < alle.length; i++) alle[i].classList.toggle('cc-chip-an', alle[i] === t);
      filterAnwenden(wrap);
    });
    suchBox.appendChild(chips);
    wrap.appendChild(suchBox);

    var liste = el('div', 'cc-partner-liste');
    for (var g = 0; g < gruppen.length; g++) liste.appendChild(partnerZeile(gruppen[g]));
    liste.appendChild(el('p', 'cc-partner-keine', 'Kein Partner passt zu Suche/Filter.'));
    wrap.appendChild(liste);

    filterAnwenden(wrap);   // persistierten Filter/Suche anwenden
    return wrap;
  }

  // ---- Score-Verlauf (SVG-Balken, ohne Paket; alt -> neu von links nach rechts) ----
  // Bewusst SVG + setAttribute (wie die Icons), KEIN inline-Stil: die Shell steuert sich nur ueber
  // CSS-Klassen und Attribute und schreibt nirgends inline-Stile (Shell-Invariante, shell-vorschau B5).
  function svgEl(tag) { return document.createElementNS(SVG_NS, tag); }
  function scoreVerlauf(zeilenNeuZuAlt) {
    var box = el('div', 'cc-verlauf');
    var reihe = zeilenNeuZuAlt.slice().reverse();
    if (!reihe.length) { box.appendChild(platzhalter('Noch kein Verlauf')); return box; }
    var n = reihe.length, bw = 22, gap = 16, h = 120, padT = 8, padB = 22;
    var breite = n * bw + (n - 1) * gap;
    var nutzH = h - padT - padB;
    var svg = svgEl('svg');
    svg.setAttribute('class', 'cc-verlauf-svg');
    svg.setAttribute('viewBox', '0 0 ' + Math.max(breite, 1) + ' ' + h);
    svg.setAttribute('width', String(Math.max(breite, 1)));
    svg.setAttribute('height', String(h));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Score-Verlauf der Prüfungen');
    for (var i = 0; i < n; i++) {
      var z = reihe[i];
      var score = (typeof z.score === 'number' && !isNaN(z.score)) ? z.score : null;
      var x = i * (bw + gap);
      var pct = score != null ? Math.max(6, Math.min(100, score)) : 2;
      var barH = Math.max(3, Math.round(nutzH * pct / 100));
      var rect = svgEl('rect');
      rect.setAttribute('class', 'cc-verlauf-bar cc-ampel-' + ampelKlasse(score));
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(padT + (nutzH - barH)));
      rect.setAttribute('width', String(bw));
      rect.setAttribute('height', String(barH));
      rect.setAttribute('rx', '4');
      var dt = zeitText(z.created_at);
      var titel = svgEl('title');
      titel.textContent = (score != null ? score : '–') + (dt ? ' · ' + dt : '');
      rect.appendChild(titel);
      svg.appendChild(rect);
      var txt = svgEl('text');
      txt.setAttribute('class', 'cc-verlauf-zahl');
      txt.setAttribute('x', String(x + bw / 2));
      txt.setAttribute('y', String(h - 7));
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = score != null ? String(score) : '–';
      svg.appendChild(txt);
    }
    box.appendChild(svg);
    return box;
  }

  function stammZeile(label, wert) {
    var z = el('div', 'cc-stamm-zeile');
    z.appendChild(el('span', 'cc-stamm-label', label));
    if (wert != null && String(wert).trim()) z.appendChild(el('span', 'cc-stamm-wert', String(wert)));
    else z.appendChild(platzhalter());
    return z;
  }

  // ---- Akte eines Partners ----
  function partnerAkteAnsicht(key) {
    var gruppen = partnerGruppen(brueckeZeilen());
    var g = null;
    for (var i = 0; i < gruppen.length; i++) if (gruppen[i].key === key) { g = gruppen[i]; break; }

    var wrap = el('div', 'cc-akte');
    var kopf = el('div', 'cc-akte-kopf');
    var zurueck = el('button', 'cc-akte-zurueck', '← Geschäftspartner');
    zurueck.setAttribute('type', 'button');
    zurueck.addEventListener('click', function () { zeigeInhalt(partnerAnsicht()); });
    kopf.appendChild(zurueck);
    wrap.appendChild(kopf);

    if (!g) {
      wrap.appendChild(el('p', 'cc-partner-keine', 'Diese Akte ist nicht mehr geladen. Bitte die Liste neu öffnen.'));
      return wrap;
    }

    var titel = el('div', 'cc-akte-titelzeile');
    var h = el('h2', 'cc-akte-name');
    if (g.name) h.textContent = g.name; else h.appendChild(platzhalter());
    titel.appendChild(h);
    titel.appendChild(ampelPille(g.letzterScore));
    wrap.appendChild(titel);

    var stamm = el('div', 'cc-karte cc-akte-stamm');
    stamm.appendChild(el('h3', 'cc-karte-titel', 'Stammdaten'));
    stamm.appendChild(stammZeile('Name', g.name));
    stamm.appendChild(stammZeile('Land', g.land));
    stamm.appendChild(stammZeile('USt-ID', g.ust));
    stamm.appendChild(stammZeile('Status', null));   // Status-Namen: PLATZHALTER - Julius legt fest
    wrap.appendChild(stamm);

    var verlaufKarte = el('div', 'cc-karte');
    verlaufKarte.appendChild(el('h3', 'cc-karte-titel', 'Score-Verlauf'));
    verlaufKarte.appendChild(scoreVerlauf(g.zeilen));
    wrap.appendChild(verlaufKarte);

    var histKarte = el('div', 'cc-karte');
    histKarte.appendChild(el('h3', 'cc-karte-titel', 'Prüfhistorie'));
    var histListe = el('div', 'cc-hist-liste');
    for (var k = 0; k < g.zeilen.length; k++) {
      var z = g.zeilen[k];
      var zeile = el('div', 'cc-hist-zeile');
      var datum = zeitText(z.created_at);
      var dBox = el('div', 'cc-hist-datum');
      if (datum) dBox.textContent = datum; else dBox.appendChild(platzhalter('kein Datum'));
      zeile.appendChild(dBox);
      zeile.appendChild(ampelPille((typeof z.score === 'number' && !isNaN(z.score)) ? z.score : null));
      var pid = el('div', 'cc-hist-pid');
      if (z.pruef_id != null && String(z.pruef_id).trim()) pid.textContent = String(z.pruef_id);
      else pid.appendChild(platzhalter('keine Prüf-ID'));
      zeile.appendChild(pid);
      histListe.appendChild(zeile);
    }
    histKarte.appendChild(histListe);
    wrap.appendChild(histKarte);

    var aktion = el('div', 'cc-akte-aktion');
    var pdf = el('button', 'cc-knopf', 'Bericht & PDF in „Akten & Ordner“ öffnen');
    pdf.setAttribute('type', 'button');
    pdf.addEventListener('click', oeffneBestehendeHistorie);
    aktion.appendChild(pdf);
    aktion.appendChild(el('p', 'cc-leer-hinweis',
      'Der PDF-Bericht je Prüfung läuft über die vorhandene Druckfunktion in „Akten & Ordner“. '
      + 'Eine eigene PDF-Schaltfläche je Partner: PLATZHALTER – Julius legt fest.'));
    wrap.appendChild(aktion);
    return wrap;
  }

  // Einstieg ins Partner-Modul: immer die Liste (bzw. Leerzustand), frisch aus der Bruecke.
  function partnerAnsicht() {
    var zeilen = brueckeZeilen();
    if (!zeilen.length) return partnerLeer();
    return partnerListeAnsicht(zeilen);
  }

  // ==========================================================================
  // S3 Dashboard-Ansicht (shell-gerendert, Richtung „wie Automati Estate"; Grundlayout Claude-/ChatGPT-
  // Stil bleibt: Navigation links, Inhalt hier rechts). NUR el()/textContent/setAttribute – kein innerHTML,
  // keine inline-Stile, keine Inline-Handler. Daten nur lesend ueber brueckeZeilen() (frisch, kein Cache);
  // die Shell schreibt nie in den App-State und klickt hier #historyBtn NICHT. Ampel NUR im Handlungsbedarf.
  // ==========================================================================
  function dashboardLeer() {
    var box = el('div', 'cc-leer');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(ICON.dashboard, 30));
    box.appendChild(iconBox);
    box.appendChild(el('h2', 'cc-leer-titel', 'Dein Dashboard ist gleich da'));
    box.appendChild(el('p', 'cc-leer-satz',
      'Sobald Prüfungen geladen sind, siehst du hier Handlungsbedarf, ein Tages-Briefing und deine Bereiche.'));
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) {
      var laden = el('button', 'cc-knopf', 'Akten laden („Akten & Ordner“)');
      laden.setAttribute('type', 'button');
      laden.addEventListener('click', oeffneBestehendeHistorie);
      box.appendChild(laden);
    } else {
      box.appendChild(el('p', 'cc-leer-hinweis', VORSCHAU
        ? 'In der Vorschau siehst du ein Beispiel-Dashboard; echte Daten gibt es nach dem Login.'
        : 'Dafür ist eine Anmeldung nötig.'));
    }
    return box;
  }

  // Eine Zeile im Bereich „Handlungsbedarf" (Knopf -> Partner-Akte). Ampel NUR hier im Dashboard.
  function dashBedarfZeile(eintrag) {
    var btn = el('button', 'cc-dash-bedarf-zeile');
    btn.setAttribute('type', 'button');
    var links = el('div', 'cc-dash-bz-links');
    var nameEl = el('div', 'cc-dash-bz-name');
    if (eintrag.name) nameEl.textContent = eintrag.name; else nameEl.appendChild(platzhalter());
    links.appendChild(nameEl);
    links.appendChild(el('div', 'cc-dash-bz-meta', eintrag.land || '—'));
    btn.appendChild(links);
    btn.appendChild(ampelPille(eintrag.score));
    btn.addEventListener('click', function () { zeigeInhalt(partnerAkteAnsicht(eintrag.key)); });
    return btn;
  }

  // Eine Kennzahl im Tages-Briefing.
  function dashKennzahl(zahl, text) {
    var box = el('div', 'cc-dash-kennzahl');
    box.appendChild(el('div', 'cc-dash-kz-zahl', String(zahl)));
    box.appendChild(el('div', 'cc-dash-kz-text', text));
    return box;
  }

  // Eine Bereichs-Karte (Klick ruft NUR waehle(id, false)); optional „Kommt in Sx".
  function dashBereich(modId, titel, satz, bald) {
    var mod = findeModul(modId);
    var karte = el('button', 'cc-dash-karte');
    karte.setAttribute('type', 'button');
    karte.setAttribute('data-cc-bereich', modId);
    var ikon = el('div', 'cc-dash-karte-icon');
    ikon.appendChild(icon(mod ? mod.icon : ICON.dashboard, 22));
    karte.appendChild(ikon);
    karte.appendChild(el('div', 'cc-dash-karte-titel', titel));
    karte.appendChild(el('p', 'cc-dash-karte-satz', satz));
    if (bald) karte.appendChild(el('span', 'cc-leer-bald', 'Kommt in ' + bald));
    karte.addEventListener('click', function () { waehle(modId, false); });
    return karte;
  }

  function dashboardAnsicht() {
    var zeilen = brueckeZeilen();
    if (!zeilen.length) return dashboardLeer();
    var d = dashboardDaten(zeilen);
    var wrap = el('div', 'cc-dash');

    var kopf = el('div', 'cc-dash-kopf');
    kopf.appendChild(el('h2', 'cc-dash-titel', 'Dashboard'));
    kopf.appendChild(el('p', 'cc-dash-unter', 'Dein Überblick – was heute zu tun ist.'));
    wrap.appendChild(kopf);

    // Bereich 1: Handlungsbedarf (Ampel NUR hier). Leer -> ruhiger Satz ohne Ampelfarbe.
    var bedarf = el('section', 'cc-dash-bereich cc-dash-bedarf');
    bedarf.appendChild(el('h3', 'cc-dash-bereich-titel', 'Handlungsbedarf'));
    if (d.handlungsbedarf.length) {
      var liste = el('div', 'cc-dash-bedarf-liste');
      for (var i = 0; i < d.handlungsbedarf.length; i++) liste.appendChild(dashBedarfZeile(d.handlungsbedarf[i]));
      bedarf.appendChild(liste);
    } else {
      bedarf.appendChild(el('p', 'cc-dash-ruhig', 'Kein offener Handlungsbedarf.'));
    }
    wrap.appendChild(bedarf);

    // Bereich 2: Tages-Briefing (statisch aus den Zeilen, KEINE KI, KEIN Netz, kein Date.now()).
    var briefing = el('section', 'cc-dash-bereich cc-dash-briefing');
    briefing.appendChild(el('h3', 'cc-dash-bereich-titel', 'Tages-Briefing'));
    var kennzahlen = el('div', 'cc-dash-kennzahlen');
    kennzahlen.appendChild(dashKennzahl(d.partnerAnzahl, 'Geschäftspartner'));
    kennzahlen.appendChild(dashKennzahl(d.pruefAnzahl, d.pruefAnzahl === 1 ? 'Prüfung' : 'Prüfungen'));
    kennzahlen.appendChild(dashKennzahl(d.rotAnzahl, 'kritisch (rot)'));
    kennzahlen.appendChild(dashKennzahl(d.gelbAnzahl, 'zu prüfen (gelb)'));
    if (d.ohneScoreAnzahl) kennzahlen.appendChild(dashKennzahl(d.ohneScoreAnzahl, 'ohne Score'));
    briefing.appendChild(kennzahlen);
    var letzteZeile = el('p', 'cc-dash-letzte');
    if (d.letztePruefung) {
      letzteZeile.appendChild(el('span', 'cc-dash-letzte-label', 'Letzte Prüfung: '));
      var fname = el('span', 'cc-dash-letzte-firma');
      if (d.letztePruefung.firma) fname.textContent = d.letztePruefung.firma; else fname.appendChild(platzhalter());
      letzteZeile.appendChild(fname);
      if (d.letztePruefung.datum) letzteZeile.appendChild(el('span', null, ' · ' + d.letztePruefung.datum));
    } else {
      letzteZeile.textContent = 'Letzte Prüfung: noch keine.';
    }
    briefing.appendChild(letzteZeile);
    wrap.appendChild(briefing);

    // Bereich 3: Bereiche wie Estate – ruhige Karten, Klick ruft NUR waehle(id, false).
    var abt = el('section', 'cc-dash-bereich');
    abt.appendChild(el('h3', 'cc-dash-bereich-titel', 'Bereiche'));
    var karten = el('div', 'cc-dash-abteilungen');
    karten.appendChild(dashBereich('partner', 'Geschäftspartner', 'Alle geprüften Firmen mit Akte und Verlauf.', null));
    karten.appendChild(dashBereich('pruefung', 'Neue Prüfung', 'Eine neue Firmen-Prüfung starten.', null));
    karten.appendChild(dashBereich('monitoring', 'Monitoring', 'Laufende Überwachung deiner Partner.', 'S7'));
    karten.appendChild(dashBereich('berichte', 'Berichte & Audit', 'Berichte und ein Prüfprotokoll.', 'S5'));
    abt.appendChild(karten);
    wrap.appendChild(abt);

    // KI-Platz: NUR Markierung (kein Eingabefeld, kein Handler, kein Aufruf). KI kommt in S4.
    var ki = el('section', 'cc-dash-ki');
    ki.setAttribute('data-cc-ki-platz', 'S4');
    var kiIcon = el('div', 'cc-dash-ki-icon');
    kiIcon.appendChild(icon(ICON.ki, 30));
    ki.appendChild(kiIcon);
    ki.appendChild(el('p', 'cc-dash-ki-satz', 'Hier steht ab S4 der KI-Assistent im Mittelpunkt.'));
    wrap.appendChild(ki);

    return wrap;
  }

  // ---- „Zur Akte dieses Geschäftspartners" (erscheint, wenn #report aktiv ist) ----
  var zurAkteBtn = null;
  var AKTE_NACHZUG_MAX = 12;   // begrenzter Nachzug (~1.8 s) nach dem app-eigenen Laden, dann Schluss.

  // #report ist „aktiv", wenn es sichtbar ist und Inhalt hat (ein Bericht steht). Nur lesen, kein DOM-Text.
  function reportAktiv() {
    var r = document.getElementById('report');
    return !!(r && r.offsetParent !== null && r.childNodes && r.childNodes.length > 0);
  }
  function aktualisiereZurAkte() {
    if (!zurAkteBtn) return;
    zurAkteBtn.classList.toggle('cc-aus', !((AKTIV === 'pruefung') && reportAktiv()));
  }
  // Stempel der neuesten Akte (Partner-Key + neueste Prüf-ID + Anzahl) – erkennt frisch geladene Zeilen.
  function akteStempel() {
    var g = partnerGruppen(brueckeZeilen())[0];
    return g ? (g.key + '|' + ((g.zeilen[0] && g.zeilen[0].pruef_id) || '') + '|' + g.zeilen.length) : '';
  }
  function zeigeNeuesteAkte() {
    var gruppen = partnerGruppen(brueckeZeilen());
    if (gruppen.length) zeigeInhalt(partnerAkteAnsicht(gruppen[0].key));
    else zeigeInhalt(partnerLeer());
  }
  // Nach dem app-eigenen (asynchronen) Laden kommt die frische Zeile verspaetet an: begrenzt oft nachsehen
  // und die neueste Akte neu zeigen, sobald sich der Stempel aendert. Kein Dauerlauf (max. AKTE_NACHZUG_MAX).
  function akteNachzug(versuch, stempel) {
    if (versuch >= AKTE_NACHZUG_MAX) return;
    setTimeout(function () {
      if (AKTIV !== 'partner') return;                 // Nutzer hat weitergeklickt -> aufhoeren
      var jetzt = akteStempel();
      if (jetzt !== stempel) { zeigeNeuesteAkte(); stempel = jetzt; }
      akteNachzug(versuch + 1, stempel);
    }, 150);
  }
  // Zur Akte des zuletzt gepruefften Partners: die App frisch laden lassen (app-eigene Aenderung an
  // HISTORY_ROWS – die Shell schreibt nichts) und die neueste Partner-Akte zeigen. Der Partner kommt aus
  // der Bruecke (neueste Zeile), NICHT aus DOM-Text.
  function zurAkte() {
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) { try { btn.click(); } catch (e) {} }   // App laedt die Historie neu
    setzeAktiv('partner');
    document.body.classList.remove('cc-shell-auf');
    aktualisiereZurAkte();                             // Knopf ausblenden (Partner-Modul aktiv)
    zeigeNeuesteAkte();
    akteNachzug(0, akteStempel());
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

    if (mod.art === 'leer') { zeigeInhalt(leerKarte(mod)); aktualisiereZurAkte(); return; }
    if (mod.art === 'dashboard') { zeigeInhalt(dashboardAnsicht()); aktualisiereZurAkte(); return; }
    if (mod.art === 'partner') { zeigeInhalt(partnerAnsicht()); aktualisiereZurAkte(); return; }

    var ziel = mod.ziel ? document.querySelector(mod.ziel) : null;
    var verfuegbar = !!(ziel && ziel.offsetParent !== null);
    if (!verfuegbar) { zeigeInhalt(gesperrtKarte(mod)); aktualisiereZurAkte(); return; }

    versteckeInhalt();                       // Overlay weg -> echte App-Ansicht sichtbar
    if (!(initial && mod.start)) {           // Startmodul beim ersten Erscheinen nicht anklicken
      try { ziel.click(); } catch (e) {}
    }
    aktualisiereZurAkte();                   // im Modul 'pruefung' bei aktivem #report den Knopf zeigen
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

    // S2: schwebender Knopf „Zur Akte dieses Geschäftspartners" (startet versteckt; aktualisiereZurAkte
    // zeigt ihn nur im Modul 'pruefung' bei aktivem #report). Liegt in der Shell-Schicht, nicht in der App.
    zurAkteBtn = el('button', 'cc-zur-akte cc-aus');
    zurAkteBtn.setAttribute('type', 'button');
    zurAkteBtn.appendChild(icon(ICON.partner, 18));
    zurAkteBtn.appendChild(el('span', null, 'Zur Akte dieses Geschäftspartners'));
    zurAkteBtn.addEventListener('click', zurAkte);
    document.body.appendChild(zurAkteBtn);

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
      aktualisiereZurAkte();                 // App verborgen -> Knopf aus
      return;
    }
    // Bei (Wieder-)Erscheinen das aktive Modul (Default: Startmodul) rendern.
    if (AKTIV == null) {
      var start = MODULE[0];
      for (var i = 0; i < MODULE.length; i++) if (MODULE[i].start) { start = MODULE[i]; break; }
      waehle(start.id, true);
    }
    aktualisiereZurAkte();
  }

  function start() {
    stilEinspielen();
    baueShell();
    aktualisiereSichtbarkeit();
    var a = document.querySelector('.app');
    if (a && !VORSCHAU) {
      var mo = new MutationObserver(aktualisiereSichtbarkeit);
      mo.observe(a, { attributes: true, attributeFilter: ['style', 'class'] });
      // S2: #report beobachten -> Knopf „Zur Akte" erscheint/verschwindet, wenn ein Bericht steht.
      var rep = document.getElementById('report');
      if (rep) {
        var moR = new MutationObserver(aktualisiereZurAkte);
        moR.observe(rep, { childList: true, attributes: true, attributeFilter: ['style', 'class'] });
      }
    }
    aktualisiereZurAkte();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
