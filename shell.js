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
  var CSS = "/* ============================================================================\n   Design-Tokens der Compliance-Plattform-Shell.\n\n   Design-Umbau 2026-11-21 (D1): komplettes Token-Fundament für ein ruhiges,\n   präzises, premium B2B-Produkt (Linear/Stripe/Mercury/Ramp-Niveau). Light-Mode\n   ist Standard. Estate-Grün bleibt die Markenfarbe.\n\n   WICHTIG: Diese Datei wird vom Build (baueShellJs) zusammen mit shell.css als\n   String in dist/shell.js eingebettet und zur Laufzeit als <style id=\"ccShellStil\">\n   gesetzt. Der Shell-Selbstcheck verbietet darum http(s)://-URLs — es gibt hier\n   keine Remote-Fonts und keine url(http…). Inter lädt die Seite bereits selbst.\n   ============================================================================ */\n\n:root {\n  /* ---- Schrift ---------------------------------------------------------- */\n  --cc-font: 'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system,\n             'Segoe UI', Roboto, Arial, sans-serif;\n  --cc-font-num: var(--cc-font);\n  /* P1: GENAU drei Gewichte (400/500/600). Inter Variable kann Zwischenwerte,\n     aber die Skala bleibt bewusst auf den Standardstufen; --fw-bold ist nur ein\n     Alias auf 600 (Hierarchie kommt aus Groesse + Farbe, nicht aus 650). */\n  --fw-regular: 400;\n  --fw-medium:  500;\n  --fw-semi:    600;\n  --fw-bold:    600;\n\n  /* P1: GENAU sechs Schriftgroessen. Alles in shell.css nutzt NUR diese Tokens\n     (scripts/lint-tokens.mjs erzwingt das). Display ist fluid (24->28). */\n  --fs-meta:    12px;                      /* Uppercase-Labels, Hints, Fein-Meta */\n  --fs-klein:   13px;                      /* Zeilen-Meta, Chips, Nebentexte */\n  --fs-body:    14px;                      /* Flaechentext, Knoepfe, Formulare */\n  --fs-h3:      16px;                      /* Wortmarke, Kartentitel, Palette-Input */\n  --fs-titel:   18px;                      /* Abschnitts-/Leerzustand-Titel */\n  --fs-display: clamp(24px, 3vw, 28px);    /* Seitentitel + KPI-Zahlen */\n\n  /* P1: fluide Seitenabstaende (einzige Nicht-Raster-Abstaende, bewusst fluid). */\n  /* B5: Safe-Area unten (iPhone-Home-Balken) als Token, damit die Chat-Eingabe\n     nie vom Geraeterand verdeckt wird. */\n  --cc-pad-safe-unten: env(safe-area-inset-bottom, 0px);\n  --cc-pad-inhalt-y: clamp(20px, 3vw, 34px);\n  --cc-pad-inhalt-x: clamp(16px, 4vw, 36px);\n  --cc-pad-leiste-x: clamp(16px, 3vw, 32px);\n  --cc-pad-palette-oben: clamp(48px, 12vh, 140px);\n  --cc-leer-oben: 12vh;\n\n  /* ---- Marke (Estate-Grün, exakt — weißer Text erst ab 700) ------------- */\n  --brand-50:  #eefbee;  --cc-brand-50:  #eefbee;\n  --brand-100: #ddf6dd;  --cc-brand-100: #ddf6dd;\n  --brand-200: #bdeabf;  --cc-brand-200: #bdeabf;\n  --brand-300: #94da98;  --cc-brand-300: #94da98;\n  --brand-400: #6cc471;  --cc-brand-400: #6cc471;\n  --brand-500: #4caf50;  --cc-brand-500: #4caf50;\n  --brand-600: #36954d;  --cc-brand-600: #36954d;\n  --brand-700: #28773d;  --cc-brand-700: #28773d;\n  --brand-800: #1e5e31;  --cc-brand-800: #1e5e31;\n  --brand-900: #174825;  --cc-brand-900: #174825;\n  --brand-950: #092913;  --cc-brand-950: #092913;\n\n  /* ---- Ink (Text = ink-900, exakt) ------------------------------------- */\n  --ink-50:  #f8fbfb;  --cc-ink-50:  #f8fbfb;\n  --ink-100: #f0f5f6;  --cc-ink-100: #f0f5f6;\n  --ink-200: #e0e7e8;  --cc-ink-200: #e0e7e8;\n  --ink-300: #ced6d7;  --cc-ink-300: #ced6d7;\n  --ink-400: #99a3a5;  --cc-ink-400: #99a3a5;\n  --ink-500: #626e71;  --cc-ink-500: #626e71;\n  --ink-600: #4d595c;  --cc-ink-600: #4d595c;\n  --ink-700: #3b484a;  --cc-ink-700: #3b484a;\n  --ink-800: #2d393b;  --cc-ink-800: #2d393b;\n  --ink-900: #232e30;  --cc-ink-900: #232e30;\n  --ink-950: #101819;  --cc-ink-950: #101819;\n\n  /* ---- Ampel (Füllung / kräftiger Text) -------------------------------- */\n  --urgent:        #ff3b30;  --cc-urgent:       #ff3b30;\n  --urgent-strong: #c4170e;  --cc-urgent-text:  #c4170e;\n  --pending:        #ff9500;  --cc-pending:      #ff9500;\n  --pending-strong: #9a5200;  --cc-pending-text: #9a5200;\n  --ok:         #34c759;  --cc-ok:      #34c759;\n  --ok-strong:  #1a6e2e;  --cc-ok-text: #1a6e2e;\n\n  /* ---- Semantische Flächen / Text / Ränder ----------------------------- */\n  /* HELL-Lauf 21.11. (§3): App-Grund = sehr helles Off-White (#f7f8f7, Richtwert\n     aus dem Auftrag); Text strikt ink-900 / ink-600 / ink-500 (AA). */\n  --surface:         #f7f8f7;\n  --surface-raised:  #ffffff;\n  --surface-subtle:  #eef1ee;\n  --surface-sunken:  #e9ede9;\n  --text-primary:    var(--ink-900);\n  --text-secondary:  var(--ink-600);\n  /* P9: ink-500 statt #77827b – WCAG AA (>=4.8:1) auch auf surface-subtle;\n     vorher fielen saemtliche Meta-Texte/Badges im axe-Lauf durch (3.9:1). */\n  --text-muted:      var(--ink-500);\n  --border-subtle:   rgba(28, 55, 38, .09);\n  --border-strong:   rgba(28, 55, 38, .16);\n  --focus-ring:      #36954d;\n\n  /* ---- Glas (drei echte Stufen, Werte aus dem HELL-Auftrag §3) ----------\n     1 = Sidebar/Topbar · 2 = Karten · 3 = Overlays/Palette/Modals.\n     Jede Stufe: weißer Innenrand (--glass-N-border) + äußerer Haarstrich\n     (als 0-0-0-1px-Ring in --glass-N-shadow) + weiche Tiefe.\n     Fallback in shell.css über @supports (--glass-N-solid). */\n  --glass-haarstrich: rgba(15, 23, 20, .06);\n\n  --glass-1-bg:     rgba(255, 255, 255, .62);\n  --glass-1-blur:   blur(22px) saturate(170%);\n  --glass-1-border: rgba(255, 255, 255, .7);\n  --glass-1-shadow: 0 0 0 1px rgba(15,23,20,.06), 0 1px 2px rgba(16,24,20,.04), inset 0 1px 0 rgba(255,255,255,.8);\n\n  --glass-2-bg:     rgba(255, 255, 255, .72);\n  --glass-2-blur:   blur(16px) saturate(150%);\n  --glass-2-border: rgba(255, 255, 255, .7);\n  --glass-2-shadow: 0 0 0 1px rgba(15,23,20,.06), 0 1px 2px rgba(16,24,20,.04), 0 8px 24px rgba(16,24,20,.06), inset 0 1px 0 rgba(255,255,255,.85);\n\n  --glass-3-bg:     rgba(255, 255, 255, .82);\n  --glass-3-blur:   blur(28px) saturate(160%);\n  --glass-3-border: rgba(255, 255, 255, .75);\n  --glass-3-shadow: 0 0 0 1px rgba(15,23,20,.06), 0 12px 32px rgba(16,24,20,.10), 0 24px 64px rgba(16,24,20,.10), inset 0 1px 0 rgba(255,255,255,.9);\n\n  /* Opake Rückfallflächen, wenn backdrop-filter fehlt / reduzierte Transparenz */\n  --glass-1-solid: #f4f6f4;\n  --glass-2-solid: #f7f9f7;\n  --glass-3-solid: #fbfcfb;\n\n  /* ---- Szene (HELL §3): Off-White + 1–2 große, extrem weiche Verläufe in\n     Markengrün und einem kühlen Ton (Opazität <= .08), FEST (fixed), damit das\n     Glas etwas zum Durchscheinen hat. Kein Rauschen, keine Muster. Die Weichheit\n     kommt aus sehr langen Gradient-Rampen (Farbwert -> transparent über >=600px,\n     weicher als blur(80px)); echtes filter:blur braeuchte eine eigene Ebene mit\n     z-index ausserhalb der Registry. P2-Lehre bleibt beachtet: keine kleinen,\n     kantigen Glows – nur zwei riesige Randwolken. */\n  --scene-base:   #f7f8f7;\n  --scene-verlauf:\n    radial-gradient(1200px 800px at 10% -10%, rgba(76, 175, 80, .07), rgba(76, 175, 80, 0) 64%),\n    radial-gradient(1100px 760px at 92% 110%, rgba(93, 129, 170, .06), rgba(93, 129, 170, 0) 62%);\n\n  /* ---- D10 Semantische Schicht (EIN Umschaltpunkt für Hell/Dunkel) ------ */\n  /* Hell = heutige Rohwerte 1:1 (pixelgleich). Dunkel überschreibt sie unten in [data-cc-theme=\"dark\"].\n     shell.css nutzt ab D10 NUR diese Tokens (keine Rohwerte mehr für alles, was sich im Dunkeln ändert). */\n  --cc-hover:          rgba(28, 55, 38, .05);   /* Hover auf Leiste/Listen/leisen Knöpfen */\n  --cc-hover-stark:    rgba(28, 55, 38, .06);   /* etwas kräftiger (Collapse/Umschalter/Avatar-Kante) */\n  --cc-scrim:          rgba(16, 24, 19, .28);   /* Palette-Backdrop */\n  --cc-scrim-drawer:   rgba(16, 24, 19, .32);   /* Mobil-Drawer-Backdrop */\n  --cc-scrim-solid:    rgba(16, 24, 19, .42);   /* Backdrop bei reduzierter Transparenz */\n  --cc-trenner:        var(--ink-300);          /* feine Trenner (Brotkrume, Separatoren, Verlauf-grau) */\n  --cc-gesperrt:       var(--ink-400);          /* gesperrte Nav / Ampel-grau-Punkt */\n  --cc-leiste-leise:   var(--ink-500);          /* leise Leisten-Texte (Gruppentitel, Konto-Unterzeile) */\n  --cc-nav-text:       var(--ink-700);          /* Nav-Eintraege (P2: kraeftiger als text-secondary) */\n  --cc-toast-bg:       var(--ink-900);          /* Toast-Hintergrund */\n  --cc-toast-text:     #ffffff;                 /* Toast-Text */\n  --cc-pille-basis:    #ffffff;                 /* Mix-Basis der Ampel-Pillen/Platzhalter (hell = Weiß) */\n  --cc-auf-marke:      #ffffff;                 /* Text/Icon auf grüner Fläche (Buttons/Chips/Bubble) */\n  --cc-marke-weich:    var(--brand-50);         /* subtile grüne Fläche (Nav-aktiv, Chips, Karten-Icon) */\n  --cc-marke-akzent:   var(--brand-700);        /* grüner Akzent-Text/Icon auf heller Fläche */\n  --cc-marke-akzent-stark: var(--brand-800);    /* grüner Text auf heller grüner Fläche */\n  --cc-marke-leiste:   var(--brand-600);        /* aktiver Nav-Indikator / Nutzer-Sprechblase */\n\n  /* ---- Abstände (4px-Raster) ------------------------------------------- */\n  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;\n  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;\n  --space-12: 48px; --space-16: 64px; --space-20: 80px;\n\n  /* ---- Radien (P1: 4er-Schritte, kein 9px mehr) ------------------------- */\n  --radius-xs: 6px; --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;\n  --radius-xl: 20px; --radius-2xl: 24px; --radius-pill: 999px;\n\n  /* ---- Schatten (HELL §3: 3 Stufen, weich, niedrige Opazität) ----------- */\n  --shadow-1: 0 1px 2px rgba(16,24,20,.04), 0 2px 8px rgba(16,24,20,.04);\n  --shadow-2: 0 1px 2px rgba(16,24,20,.04), 0 8px 24px rgba(16,24,20,.06);\n  --shadow-3: 0 4px 12px rgba(16,24,20,.05), 0 24px 64px rgba(16,24,20,.13);\n  /* Alias: tiefste Ebene = Stufe 3 (das System hat GENAU drei Stufen). */\n  --shadow-4: var(--shadow-3);\n\n  /* ---- Bewegung (HELL §3; prefers-reduced-motion schaltet in shell.css ab)\n     dur-1 Hover/Press · dur-2 Ein-/Ausblenden · dur-3 Panels/Seiten/Sidebar.\n     ease-rein fuer Erscheinen/Zustandswechsel, ease-raus fuer Verschwinden. */\n  --dur-1: 120ms;\n  --dur-2: 200ms;\n  --dur-3: 320ms;\n  --ease-rein: cubic-bezier(.2, .8, .2, 1);\n  --ease-raus: cubic-bezier(.4, 0, 1, 1);\n  /* Rueckwaertskompatible Aliasse (shell.css nutzt die historischen Namen). */\n  --cc-dauer-kurz:   var(--dur-1);\n  --cc-dauer-mittel: var(--dur-2);\n  --cc-dauer-lang:   var(--dur-3);\n  --cc-ease-out: var(--ease-rein);\n\n  /* ---- Fokus / Touch --------------------------------------------------- */\n  --cc-fokus-breite:  2px;\n  --cc-fokus-farbe:   var(--focus-ring);\n  --cc-fokus-abstand: 2px;\n  --cc-fokus-schein:  0 0 0 3px color-mix(in srgb, var(--brand-500) 18%, transparent);\n  --cc-touch-min:     44px;\n\n  /* ---- Shell-Maße (B3: Auftragswerte 264/72) ---------------------------- */\n  --cc-shell-breite:    264px;   /* Seitenleiste ausgeklappt */\n  --cc-shell-schmal:    72px;    /* Seitenleiste eingeklappt (Desktop) */\n  --cc-topbar-h:        60px;    /* Topbar im Inhaltsbereich */\n  --cc-shell-mobil-bar: 56px;    /* Mobiler Kopfbalken */\n  --cc-inhalt-max:      1180px;  /* breite Tabellen-/Listenseiten */\n  --cc-lese-max:        660px;   /* Formular-/Leseseiten */\n  --cc-form-max:        640px;   /* Einstellungen-Formularspalte (Claude-Stil) */\n\n  /* z-index-Leiter (REGISTRY – die Literale stehen in shell.css und sind durch\n     tests/web/shell-vorschau.test.mjs (ERWARTET_NORMAL) + scripts/lint-tokens.mjs\n     festgeschrieben; neue Ebenen werden DORT registriert, nie ad hoc):\n       8000  Inhalt (.cc-shell-modul-wrap)\n       8900  Drawer-Scrim (body.cc-shell-auf .cc-shell-backdrop)\n       9000  Seitenleiste (.cc-shell)\n       9001  Mobil-Balken (body.cc-shell-an .cc-shell-balken)\n       9500  Schwebeknopf (.cc-zur-akte)\n       10000 Vorschau-Hub (--cc-z-vorschau). (Der fruehere #testEnvBanner auf\n             dieser Ebene ist seit dem HELL-Lauf 21.11. entfernt, B2.)\n       10050 Kommando-Palette (.cc-kbackdrop)\n       10060 Toasts (.cc-toasts) */\n}\n\n/* ============================================================================\n   D10 DARK MODE. Aktiv über [data-cc-theme=\"dark\"] auf <html> (shell.js setzt es\n   VOR dem ersten Paint, kein Aufblitzen). Überschreibt NUR die semantische Schicht\n   + Flächen/Text/Linie/Glas/Schatten/Szene/Ampel-Text – die Rohskalen (brand/ink)\n   bleiben, damit die Marke (Estate-Grün) erhalten bleibt. Niveau: Linear (sehr\n   dunkles, leicht grün-neutrales Grau, feine 1px-Linien), Vercel (hoher Kontrast),\n   Stripe dark (ruhige Flächen, lesbare Statusfarben). Light bleibt Standard.\n   ============================================================================ */\n[data-cc-theme=\"dark\"] {\n  /* Flächen 0..3 – Karten eine Stufe heller als die Szene */\n  --surface:         #0e1411;\n  --surface-raised:  #171f1b;\n  --surface-subtle:  #202a25;\n  --surface-sunken:  #0a0f0d;\n  --text-primary:    #e9efea;\n  --text-secondary:  #a8b6ad;\n  --text-muted:      #8b998f;\n  --border-subtle:   rgba(255, 255, 255, .09);\n  --border-strong:   rgba(255, 255, 255, .16);\n  --focus-ring:      #6cc471;\n  --cc-fokus-farbe:  #6cc471;\n\n  /* Szene dunkel: gleiche Logik wie hell – dunkle Leinwand + zwei riesige,\n     extrem weiche Randwolken (Marke + kuehler Ton), fest/fixed. */\n  --scene-base:   #0b110e;\n  --scene-verlauf:\n    radial-gradient(1200px 800px at 10% -10%, rgba(76, 175, 80, .10), rgba(76, 175, 80, 0) 64%),\n    radial-gradient(1100px 760px at 92% 110%, rgba(96, 140, 190, .08), rgba(96, 140, 190, 0) 62%);\n\n  /* Glas dunkel (gleiche 3 Stufen wie hell: 1 Leiste/Topbar, 2 Karten, 3 Overlays) */\n  --glass-haarstrich: rgba(0, 0, 0, .5);\n  --glass-1-bg:     rgba(23, 31, 27, .55);\n  --glass-1-blur:   blur(22px) saturate(140%);\n  --glass-1-border: rgba(255, 255, 255, .08);\n  --glass-1-shadow: 0 0 0 1px rgba(0,0,0,.35), 0 1px 2px rgba(0, 0, 0, .4), inset 0 1px 0 rgba(255, 255, 255, .05);\n  --glass-2-bg:     rgba(20, 27, 23, .66);\n  --glass-2-blur:   blur(16px) saturate(130%);\n  --glass-2-border: rgba(255, 255, 255, .10);\n  --glass-2-shadow: 0 0 0 1px rgba(0,0,0,.35), 0 10px 34px rgba(0, 0, 0, .46), inset 0 1px 0 rgba(255, 255, 255, .06);\n  --glass-3-bg:     rgba(26, 34, 29, .82);\n  --glass-3-blur:   blur(28px) saturate(140%);\n  --glass-3-border: rgba(255, 255, 255, .12);\n  --glass-3-shadow: 0 0 0 1px rgba(0,0,0,.4), 0 22px 60px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 255, 255, .08);\n  --glass-1-solid:  #141b17;\n  --glass-2-solid:  #161d19;\n  --glass-3-solid:  #1b231e;\n\n  /* Schatten dunkler/kräftiger (3 Stufen + Alias, wie hell) */\n  --shadow-1: 0 1px 2px rgba(0, 0, 0, .4);\n  --shadow-2: 0 4px 14px rgba(0, 0, 0, .44);\n  --shadow-3: 0 12px 32px rgba(0, 0, 0, .5), 0 24px 64px rgba(0, 0, 0, .4);\n  --shadow-4: var(--shadow-3);\n\n  /* Ampel: Füllung bleibt kräftig; Text/Icon heller für Kontrast auf Dunkel.\n     (Die Pillen tragen IMMER Text/Zahl + farbigen Punkt – nie nur Farbe.) */\n  --ok-strong:      #58d089;  --cc-ok-text:      #58d089;\n  --pending-strong: #ffb454;  --cc-pending-text: #ffb454;\n  --urgent-strong:  #ff8077;  --cc-urgent-text:  #ff8077;\n\n  /* Semantische Schicht – dunkle Werte */\n  --cc-hover:          rgba(255, 255, 255, .055);\n  --cc-hover-stark:    rgba(255, 255, 255, .08);\n  --cc-scrim:          rgba(0, 0, 0, .52);\n  --cc-scrim-drawer:   rgba(0, 0, 0, .58);\n  --cc-scrim-solid:    rgba(0, 0, 0, .70);\n  --cc-trenner:        rgba(255, 255, 255, .10);\n  --cc-gesperrt:       #6b7a71;\n  --cc-leiste-leise:   #9aab9f;   /* WCAG AA auf der Glas-Leiste */\n  --cc-nav-text:       #c3cfc6;   /* Nav-Eintraege dunkel */\n  --cc-toast-bg:       #2a3530;   /* eigenständig heller als die Szene (weißer Text lesbar) */\n  --cc-pille-basis:    #141b17;   /* Ampel-Pillen mischen mit dunkler Fläche statt Weiß */\n  --cc-marke-weich:    rgba(76, 175, 80, .16);   /* subtile grüne Fläche (Nav-aktiv, Chips, Karten-Icon) */\n  --cc-marke-akzent:   #78cf7d;   /* grüner Akzent-Text/Icon, hell genug auf Dunkel */\n  --cc-marke-akzent-stark: #9bdf9f;   /* grüner Text auf der dunkelgrünen Nav-aktiv-Fläche */\n  --cc-marke-leiste:   #4caf50;\n}\n\n/* ============================================================================\n   Shell-Stil der Compliance-Plattform. Design-Umbau 2026-11-21.\n\n   Nutzt die Tokens aus estate-tokens.css. Wird vom Build (baueShellJs) zusammen\n   mit den Tokens als String in dist/shell.js eingebettet und zur Laufzeit als\n   <style id=\"ccShellStil\"> gesetzt (der Dev-Server kennt .css nicht).\n\n   WICHTIG fuer Tests/Selbstcheck:\n   - KEINE http(s)://-URLs (der Shell-Selbstcheck scannt den eingebetteten String).\n   - FLACHES CSS (keine &-Verschachtelung): der z-index-Test liest Regeln mit einer\n     einfachen Klammer-Regex; Nesting wuerde sie brechen.\n   - z-index NUR an den registrierten Stellen (siehe shell-vorschau.test.mjs,\n     ERWARTET_NORMAL): 8000/8900/9000/9001/9500/10050/10060 + Vorschau-Hub 10000.\n   - Die Shell steuert sich nur ueber Klassen, nie ueber element.style.\n   - Glas: echte backdrop-filter mit opaker @supports-Rueckfallflaeche; unter\n     prefers-reduced-transparency wird das Glas opak.\n   ============================================================================ */\n\n/* ----------------------------------------------------------------- Basis -- */\n.cc-shell, .cc-shell-modul-wrap, .cc-shell-balken, .cc-kbackdrop, .cc-toasts, .cc-zur-akte {\n  font-family: var(--cc-font);\n  -webkit-font-smoothing: antialiased;\n  text-rendering: optimizeLegibility;\n}\n.cc-shell *, .cc-shell-modul-wrap *, .cc-shell-balken *, .cc-kbackdrop *, .cc-toasts * { box-sizing: border-box; }\n\n/* Die Shell ist standardmaessig unsichtbar; erst body.cc-shell-an zeigt sie. */\n.cc-shell { display: none; }\n.cc-shell-modul-wrap { display: none; }\n.cc-shell-balken { display: none; }\n.cc-shell-backdrop { display: none; }\n\n/* --------------------------------------------------------------- Szene --- */\n/* HELL §3: Off-White-Leinwand + zwei riesige, extrem weiche Farbwolken\n   (Markengrün + kühler Ton, Opazität <= .08), FEST im Viewport verankert\n   (background-attachment: fixed). Leiste (Glas) und Inhalt teilen dieselben\n   Viewport-Koordinaten -> nahtlos; das Glas hat etwas zum Durchscheinen. */\nbody.cc-shell-an {\n  background-color: var(--scene-base);\n  background-image: var(--scene-verlauf);\n  background-attachment: fixed;\n  background-repeat: no-repeat;\n  background-size: cover;\n}\n.cc-shell-modul-wrap {\n  background-color: var(--scene-base);\n  background-image: var(--scene-verlauf);\n  background-attachment: fixed;\n  background-repeat: no-repeat;\n  background-size: cover;\n}\n\n/* ---------------------------------------------- Glas-Klassen (HELL §3) --- */\n/* Drei wiederverwendbare Materialstufen: 1 Leiste/Topbar, 2 Karten, 3 Overlays.\n   Opaker Fallback ohne backdrop-filter; prefers-reduced-transparency schaltet\n   unten generell auf opak. */\n.cc-glass-1 { background: var(--glass-1-solid); border: 1px solid var(--border-subtle); }\n.cc-glass-2 { background: var(--glass-2-solid); border: 1px solid var(--border-subtle); }\n.cc-glass-3 { background: var(--glass-3-solid); border: 1px solid var(--border-subtle); }\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  .cc-glass-1 {\n    background: var(--glass-1-bg);\n    border: 1px solid var(--glass-1-border);\n    -webkit-backdrop-filter: var(--glass-1-blur);\n    backdrop-filter: var(--glass-1-blur);\n    box-shadow: var(--glass-1-shadow);\n  }\n  .cc-glass-2 {\n    background: var(--glass-2-bg);\n    border: 1px solid var(--glass-2-border);\n    -webkit-backdrop-filter: var(--glass-2-blur);\n    backdrop-filter: var(--glass-2-blur);\n    box-shadow: var(--glass-2-shadow);\n  }\n  .cc-glass-3 {\n    background: var(--glass-3-bg);\n    border: 1px solid var(--glass-3-border);\n    -webkit-backdrop-filter: var(--glass-3-blur);\n    backdrop-filter: var(--glass-3-blur);\n    box-shadow: var(--glass-3-shadow);\n  }\n}\n\n/* HELL-Lauf 21.11. (B2): Der TESTUMGEBUNG-Balken ist komplett entfernt (Julius\n   Punkt 2) – es gibt keinen #testEnvBanner und darum auch keinen Ausweich-\n   Abstand mehr. Die Shell-Ebenen sitzen buendig bei top:0. */\n\n/* --------------------------------------------------------- Desktop-Rahmen -- */\nbody.cc-shell-an .cc-shell { display: flex; }\n@media (min-width: 768px) {\n  body.cc-shell-an { padding-left: var(--cc-shell-breite); transition: padding-left var(--dur-3) var(--ease-rein); }\n  body.cc-shell-an.cc-shell-schmal { padding-left: var(--cc-shell-schmal); }\n}\n\n/* Seitenleiste (B3: Glas-1 nach §3) – rechter Haarstrich, leichter gruener Hauch\n   oben (<= .06), 320ms-Breiten-Uebergang. */\n.cc-shell {\n  position: fixed;\n  top: 0; left: 0; bottom: 0;\n  width: var(--cc-shell-breite);\n  flex-direction: column;\n  gap: var(--space-1);\n  box-sizing: border-box;\n  padding: var(--space-4) var(--space-3) var(--space-3);\n  /* H-19: Drawer-Fuss bleibt ueber der Geraete-Safe-Area (iPhone-Home-Balken). */\n  padding-bottom: calc(var(--space-3) + var(--cc-pad-safe-unten));\n  background-color: var(--glass-1-solid);\n  background-image: linear-gradient(180deg, color-mix(in srgb, var(--brand-500) 5%, transparent), transparent 160px);\n  border-right: 1px solid var(--border-subtle);\n  color: var(--text-primary);\n  z-index: 9000;\n  /* B3: overflow VISIBLE – gescrollt wird im inneren .cc-shell-scroll. Nur so\n     bleiben die fixed-positionierten Glas-Tooltips (deren Containing Block wegen\n     backdrop-filter die Leiste selbst ist) rechts neben der Leiste sichtbar. */\n  overflow: visible;\n  transition: width var(--dur-3) var(--ease-rein);\n}\n/* Scrollender Mittelteil (Nav-Gruppen); Logo/Suche/Fuss stehen fest. */\n.cc-shell-scroll {\n  flex: 1 1 auto;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-1);\n  overflow-y: auto;\n  overflow-x: hidden;\n  scrollbar-width: thin;\n}\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  .cc-shell {\n    background-color: transparent;\n    background-image: linear-gradient(180deg, color-mix(in srgb, var(--brand-500) 5%, transparent), transparent 160px),\n                      linear-gradient(var(--glass-1-bg), var(--glass-1-bg));\n    -webkit-backdrop-filter: var(--glass-1-blur);\n    backdrop-filter: var(--glass-1-blur);\n    box-shadow: var(--glass-1-shadow);\n  }\n}\n@media (min-width: 768px) { body.cc-shell-schmal .cc-shell { width: var(--cc-shell-schmal); } }\n\n/* B3 Logo-Zeile: echtes Logo links, Collapse-Knopf rechts. Eingeklappt wird die\n   Zeile zur Spalte (Bildzeichen oben, Collapse darunter, beides zentriert). */\n.cc-shell-marke {\n  display: flex;\n  align-items: center;\n  gap: var(--space-3);\n  padding: var(--space-1) var(--space-2) var(--space-3);\n  margin-bottom: var(--space-1);\n}\n/* overflow hidden: waehrend der Breiten-Transition darf die volle Wortmarke nie\n   ueber die (gerade schmalere) Leiste hinausragen (Leiste selbst clippt nicht mehr). */\n.cc-logo { display: flex; align-items: center; min-width: 0; flex: 1 1 auto; overflow: hidden; }\n.cc-logo-voll {\n  display: block;\n  height: 30px;\n  width: auto;\n  max-width: 100%;\n  object-fit: contain;\n  object-position: left center;\n}\n/* 28x28-Fenster fuers Bildzeichen (linker Logo-Teil, reiner CSS-Ausschnitt).\n   Gemessen (B3): bei Bildhoehe 30px endet die Flasche bei x=24, die Wortmarke\n   beginnt erst bei x=29 -> das 28er-Fenster schneidet exakt dazwischen. */\n.cc-logo-marke {\n  display: none;\n  width: 28px; height: 28px;\n  overflow: hidden;\n  flex: 0 0 auto;\n}\n.cc-logo-ausschnitt { display: block; height: 30px; width: auto; max-width: none; margin: -1px 0 0; } /* lint-ok: Bildzeichen vertikal zentriert (30px-Bild im 28px-Fenster) */\n/* Fallback-Kachel (nur ohne echtes Logo, z. B. Mini-DOM) */\n.cc-shell-logo {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 34px; height: 34px;\n  flex: 0 0 auto;\n  border-radius: var(--radius-md);\n  background: linear-gradient(145deg, var(--brand-500), var(--brand-700));\n  color: #fff;\n  box-shadow: 0 2px 8px rgba(40, 119, 61, .28), inset 0 1px 0 rgba(255,255,255,.4); /* lint-ok: Marken-Kachel-Glow */\n}\n.cc-shell-logo svg { width: 20px; height: 20px; }\n.cc-shell-marke-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.1; margin-left: var(--space-3); }\n/* B8 Dunkel: das volle Logo traegt eine dunkle Wortmarke -> im Dark Mode zeigt die\n   Leiste das (gruene) Bildzeichen als Ausschnitt + die Text-Wortmarke daneben. */\n[data-cc-theme=\"dark\"] .cc-logo-echt .cc-logo-voll { display: none; }\n[data-cc-theme=\"dark\"] .cc-logo-echt .cc-logo-marke { display: block; border-radius: var(--radius-sm); }\n/* Das Logo-PNG hat weissen Grund – im Dunkeln wird das Fenster damit bewusst ein\n   kleiner heller Marken-Chip (abgerundet), statt eines harten weissen Quadrats. */\n[data-cc-theme=\"dark\"] .cc-logo-echt + .cc-shell-marke-text { display: flex; }\n.cc-logo-echt + .cc-shell-marke-text { display: none; }\n@media (min-width: 768px) { [data-cc-theme=\"dark\"] body.cc-shell-schmal .cc-shell-marke-text { display: none; } }\n.cc-shell-wort { font-size: var(--fs-h3); font-weight: var(--fw-bold); letter-spacing: -0.01em; color: var(--text-primary); }\n.cc-shell-sub { font-size: var(--fs-meta); font-weight: var(--fw-semi); letter-spacing: .04em; color: var(--cc-marke-akzent); text-transform: uppercase; }\n/* Altes Punkt-Element bleibt kompatibel, aber unsichtbar (Markup-Sicherheit). */\n.cc-shell-punkt { display: none; }\n\n/* B3 Suchfeld (Linear-Stil): Knopf in Eingabefeld-Optik, oeffnet die Palette. */\n.cc-leiste-suche {\n  display: flex;\n  align-items: center;\n  gap: var(--space-2);\n  width: 100%;\n  min-height: 36px;\n  margin-bottom: var(--space-2);\n  padding: 0 var(--space-2) 0 var(--space-3);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-sm);\n  background: var(--surface-raised);\n  color: var(--text-muted);\n  font-family: var(--cc-font);\n  font-size: var(--fs-klein);\n  font-weight: var(--fw-medium);\n  cursor: pointer;\n  box-shadow: var(--shadow-1);\n  transition: border-color var(--dur-1) var(--ease-rein), color var(--dur-1) var(--ease-rein), background-color var(--dur-1) var(--ease-rein);\n}\n.cc-leiste-suche:hover { border-color: var(--border-strong); color: var(--text-secondary); }\n.cc-leiste-suche:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-leiste-suche svg { width: 16px; height: 16px; flex: 0 0 auto; opacity: .75; }\n.cc-leiste-suche .cc-kmd-label {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  white-space: nowrap;\n  text-align: left;\n  transition: opacity var(--dur-2) var(--ease-rein), max-width var(--dur-3) var(--ease-rein);\n}\n.cc-leiste-suche .cc-kbd { flex: 0 0 auto; transition: opacity var(--dur-2) var(--ease-rein); }\n\n.cc-shell-nav { display: flex; flex-direction: column; gap: var(--space-1); }\n\n/* Nav-Unterbereiche */\n.cc-nav-gruppe { display: flex; flex-direction: column; gap: var(--space-1); margin-top: var(--space-4); }\n.cc-nav-gruppe:first-of-type { margin-top: 0; }\n.cc-nav-gruppe-titel {\n  padding: var(--space-1) var(--space-3) var(--space-2);\n  font-size: var(--fs-meta);\n  font-weight: var(--fw-semi);\n  letter-spacing: .055em;\n  text-transform: uppercase;\n  /* a11y: ink-500 (#626e71 ~5.27:1) statt text-muted (#77827b ~3.9:1) für WCAG AA auf der Leiste. */\n  color: var(--cc-leiste-leise);\n}\n\n/* Nav-Eintrag (B3: 36px, Icon 18, 12px Icon-Text-Abstand ueber das Label-Margin –\n   das Margin kollabiert eingeklappt mit, damit das Icon EXAKT mittig steht). */\n.cc-nav-eintrag {\n  position: relative;\n  display: flex;\n  align-items: center;\n  width: 100%;\n  min-height: 36px;\n  padding: var(--space-2) var(--space-3);\n  border: 0;\n  border-radius: var(--radius-sm);\n  background: transparent;\n  color: var(--cc-nav-text);\n  font-family: var(--cc-font);\n  font-size: var(--fs-body);\n  font-weight: var(--fw-medium);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--dur-1) var(--ease-rein),\n              color var(--dur-1) var(--ease-rein);\n}\n.cc-nav-eintrag svg { width: 18px; height: 18px; flex: 0 0 auto; opacity: .85; transition: opacity var(--dur-1) var(--ease-rein); }\n/* Label: faedt beim Einklappen aus (opacity/translateX), bricht NIE um. overflow\n   liegt nur auf dem Label, nie auf dem Knopf (sonst wuerde der Fokusring kappen). */\n.cc-nav-label {\n  min-width: 0;\n  max-width: 180px;\n  margin-left: var(--space-3);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  transition: opacity var(--dur-2) var(--ease-rein),\n              transform var(--dur-3) var(--ease-rein),\n              max-width var(--dur-3) var(--ease-rein),\n              margin-left var(--dur-3) var(--ease-rein);\n}\n.cc-nav-eintrag:hover { background: var(--cc-hover); color: var(--text-primary); }\n.cc-nav-eintrag:hover svg { opacity: 1; }\n.cc-nav-eintrag[aria-current=\"page\"] {\n  background: var(--cc-marke-weich);\n  color: var(--cc-marke-akzent-stark);\n  font-weight: var(--fw-semi);\n}\n.cc-nav-eintrag[aria-current=\"page\"] svg { opacity: 1; color: var(--cc-marke-akzent); }\n.cc-nav-eintrag[aria-current=\"page\"]::before {\n  content: \"\";\n  position: absolute;\n  left: -2px; top: 50%;\n  transform: translateY(-50%);\n  width: 2px; height: 16px;\n  border-radius: var(--radius-pill);\n  background: var(--brand-600);\n}\n.cc-nav-eintrag:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\n.cc-nav-eintrag.cc-gesperrt { color: var(--cc-gesperrt); }\n\n/* Collapse-Umschalter (B3: sitzt IN der Logo-Zeile; eingeklappt darunter zentriert).\n   Trefferflaeche 32x32, Icon 18, nie abgeschnitten. */\n.cc-shell-collapse {\n  display: none;\n  align-items: center;\n  justify-content: center;\n  width: 32px; height: 32px;\n  flex: 0 0 auto;\n  margin-left: auto;\n  border: 0;\n  border-radius: var(--radius-sm);\n  background: transparent;\n  color: var(--text-muted);\n  cursor: pointer;\n  transition: background-color var(--dur-1) var(--ease-rein), color var(--dur-1) var(--ease-rein);\n}\n.cc-shell-collapse:hover { background: var(--cc-hover-stark); color: var(--text-primary); }\n.cc-shell-collapse:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-shell-collapse svg { width: 18px; height: 18px; transition: transform var(--dur-3) var(--ease-rein); }\n@media (min-width: 768px) { .cc-shell-collapse { display: inline-flex; } }\n\n/* B3 Glas-Tooltip (nur eingeklappt, Desktop): position:fixed OHNE left/top nutzt die\n   statische Position -> entkommt dem overflow der Leiste, bleibt aber am Eintrag.\n   120ms Verzoegerung, reine opacity (kein Layout-Sprung), pointer-events none. */\n.cc-nav-eintrag::after, .cc-konto-knopf::after {\n  /* Alt-Text \"\" haelt den Tooltip-Text aus dem Accessible Name des Knopfs heraus\n     (sonst laese ein Screenreader das Label doppelt). */\n  content: attr(data-cc-tip) / \"\";\n  position: fixed;\n  display: none;\n  align-self: center;\n  /* Horizontal fest rechts neben der schmalen Leiste verankert (left schlaegt die\n     statische Flex-Position); vertikal bleibt die statische Position = Eintragszeile. */\n  left: calc(var(--cc-shell-schmal) + var(--space-2));\n  padding: var(--space-1) var(--space-3);\n  border-radius: var(--radius-sm);\n  background: var(--glass-3-solid);\n  border: 1px solid var(--glass-3-border);\n  box-shadow: var(--shadow-2);\n  color: var(--text-primary);\n  font-size: var(--fs-klein);\n  font-weight: var(--fw-medium);\n  white-space: nowrap;\n  pointer-events: none;\n  opacity: 0;\n  transition: opacity var(--dur-2) var(--ease-rein);\n  transition-delay: 0ms;\n}\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  .cc-nav-eintrag::after, .cc-konto-knopf::after {\n    background: var(--glass-3-bg);\n    -webkit-backdrop-filter: var(--glass-3-blur);\n    backdrop-filter: var(--glass-3-blur);\n  }\n}\n\n/* Eingeklappte Seitenleiste (Desktop): Icons exakt mittig, Labels faden raus,\n   Abschnittstitel werden feine Trennlinien, Tooltips tragen die Labels. */\n@media (min-width: 768px) {\n  body.cc-shell-schmal .cc-shell-marke {\n    flex-direction: column;\n    gap: var(--space-2);\n    justify-content: center;\n    padding-left: 0; padding-right: 0;\n  }\n  body.cc-shell-schmal .cc-logo { flex: 0 0 auto; justify-content: center; }\n  body.cc-shell-schmal .cc-logo-voll { display: none; }\n  body.cc-shell-schmal .cc-logo-marke { display: block; }\n  body.cc-shell-schmal .cc-shell-marke-text { display: none; }\n  body.cc-shell-schmal .cc-shell-collapse { margin-left: 0; }\n  body.cc-shell-schmal .cc-shell-collapse svg { transform: rotate(180deg); }\n  body.cc-shell-schmal .cc-leiste-suche { justify-content: center; padding-left: 0; padding-right: 0; }\n  body.cc-shell-schmal .cc-leiste-suche .cc-kmd-label { max-width: 0; opacity: 0; }\n  body.cc-shell-schmal .cc-leiste-suche .cc-kbd { display: none; }\n  body.cc-shell-schmal .cc-nav-gruppe-titel { height: 1px; padding: 0; margin: var(--space-3) var(--space-3) var(--space-2); overflow: hidden; color: transparent; background: var(--border-subtle); }\n  body.cc-shell-schmal .cc-nav-eintrag { justify-content: center; padding-left: 0; padding-right: 0; }\n  body.cc-shell-schmal .cc-nav-label { max-width: 0; margin-left: 0; opacity: 0; transform: translateX(-6px); }\n  body.cc-shell-schmal .cc-konto-text { max-width: 0; margin-left: 0; opacity: 0; transform: translateX(-6px); }\n  body.cc-shell-schmal .cc-konto-paket { display: none; }\n  body.cc-shell-schmal .cc-konto-knopf { justify-content: center; padding-left: 0; padding-right: 0; }\n  /* Tooltips nur im eingeklappten Zustand aktivieren (display + verzoegerte opacity). */\n  body.cc-shell-schmal .cc-nav-eintrag[data-cc-tip]::after,\n  body.cc-shell-schmal .cc-konto-knopf[data-cc-tip]::after { display: block; }\n  body.cc-shell-schmal .cc-nav-eintrag[data-cc-tip]:hover::after,\n  body.cc-shell-schmal .cc-nav-eintrag[data-cc-tip]:focus-visible::after,\n  body.cc-shell-schmal .cc-konto-knopf[data-cc-tip]:hover::after,\n  body.cc-shell-schmal .cc-konto-knopf[data-cc-tip]:focus-visible::after { opacity: 1; transition-delay: 120ms; }\n}\n\n/* Konto-Fuss (B3: Nutzerkarte) */\n.cc-shell-fuss { margin-top: auto; padding-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-1); }\n.cc-shell-fuss-zeile { display: flex; align-items: center; }\n.cc-shell-fuss-zeile .cc-konto-knopf { flex: 1 1 auto; }\n.cc-konto-knopf {\n  display: flex;\n  align-items: center;\n  width: 100%;\n  min-height: 48px;\n  padding: var(--space-2);\n  border: 0;\n  border-radius: var(--radius-md);\n  background: transparent;\n  color: var(--text-primary);\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--dur-1) var(--ease-rein);\n}\n.cc-konto-knopf:hover { background: var(--cc-hover); }\n.cc-konto-knopf[aria-current=\"page\"] { background: var(--cc-marke-weich); }\n.cc-konto-knopf:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-konto-avatar {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 32px; height: 32px;\n  flex: 0 0 auto;\n  border-radius: var(--radius-pill);\n  background: linear-gradient(145deg, var(--brand-100), var(--brand-200));\n  color: var(--cc-marke-akzent-stark);\n  box-shadow: inset 0 0 0 1px var(--cc-hover-stark);\n}\n.cc-konto-avatar svg { width: 18px; height: 18px; }\n.cc-konto-text {\n  min-width: 0;\n  max-width: 160px;\n  margin-left: var(--space-3);\n  display: flex;\n  flex-direction: column;\n  line-height: 1.25;\n  overflow: hidden;\n  transition: opacity var(--dur-2) var(--ease-rein),\n              transform var(--dur-3) var(--ease-rein),\n              max-width var(--dur-3) var(--ease-rein),\n              margin-left var(--dur-3) var(--ease-rein);\n}\n.cc-konto-name { font-size: var(--fs-klein); font-weight: var(--fw-semi); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.cc-konto-unter { font-size: var(--fs-meta); color: var(--cc-leiste-leise); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n/* Paket-Label (nur wenn die App ein Paket liefert – read-only, S6) */\n.cc-konto-paket {\n  flex: 0 0 auto;\n  margin-left: auto;\n  padding: 0 var(--space-2);\n  min-height: 20px;\n  display: inline-flex;\n  align-items: center;\n  border-radius: var(--radius-pill);\n  background: var(--cc-marke-weich);\n  color: var(--cc-marke-akzent-stark);\n  font-size: var(--fs-meta);\n  font-weight: var(--fw-semi);\n}\n\n/* ------------------------------------------------------------ Inhalt --- */\nbody.cc-shell-an .cc-shell-modul-wrap[data-cc-sichtbar=\"1\"] { display: flex; }\n.cc-shell-modul-wrap {\n  position: fixed;\n  top: 0; right: 0; bottom: 0; left: 0;\n  z-index: 8000;\n  flex-direction: column;\n  color: var(--text-primary);\n  overflow: hidden;\n}\n@media (min-width: 768px) {\n  .cc-shell-modul-wrap { left: var(--cc-shell-breite); transition: left var(--dur-3) var(--ease-rein); }\n  body.cc-shell-schmal .cc-shell-modul-wrap { left: var(--cc-shell-schmal); }\n}\n\n/* Desktop-Topbar (B3: Glas-1 wie die Leiste) – Flex-Kopf im Inhalt, kein z-index.\n   Traegt nur noch die Brotkrume; die Suche lebt in der Seitenleiste. */\n.cc-topbar {\n  flex: 0 0 auto;\n  display: flex;\n  align-items: center;\n  gap: var(--space-3);\n  height: var(--cc-topbar-h);\n  padding: 0 var(--cc-pad-leiste-x);\n  border-bottom: 1px solid var(--border-subtle);\n  background: var(--glass-1-solid);\n}\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  .cc-topbar {\n    background: var(--glass-1-bg);\n    -webkit-backdrop-filter: var(--glass-1-blur);\n    backdrop-filter: var(--glass-1-blur);\n  }\n}\n.cc-brotkrumen { display: flex; align-items: center; gap: var(--space-2); min-width: 0; font-size: var(--fs-klein); }\n.cc-brotkrumen-wurzel { color: var(--text-muted); font-weight: var(--fw-medium); }\n.cc-brotkrumen-trenner { color: var(--cc-trenner); }\n.cc-brotkrumen-jetzt { color: var(--text-primary); font-weight: var(--fw-semi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.cc-topbar-rechts { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); }\n\n.cc-kbd {\n  display: inline-flex; align-items: center;\n  padding: 2px 6px; /* lint-ok: Badge-Feinmass (⌘K-Taste) */\n  border-radius: var(--radius-xs);\n  background: var(--surface-subtle);\n  color: var(--text-muted);\n  font-size: var(--fs-meta); font-weight: var(--fw-semi);\n  font-variant-numeric: tabular-nums;\n}\n\n/* ------------------------------------------- B4 Bewegung (rein UND raus) --- */\n/* Keyframes fuer die zentralen Helfer einblenden()/ausblenden() in shell.js.\n   Nur opacity + transform; prefers-reduced-motion schaltet unten alles ab. */\n@keyframes ccAnimEin  { from { opacity: 0; transform: translateY(6px); } }\n@keyframes ccAnimPop  { from { opacity: 0; transform: scale(.98); } }\n@keyframes ccAnimAus  { to   { opacity: 0; transform: translateY(4px); } }\n.cc-anim-ein      { animation: ccAnimEin var(--dur-2) var(--ease-rein) both; }\n.cc-anim-ein-kurz { animation: ccAnimEin var(--dur-1) var(--ease-rein) both; }\n.cc-anim-ein-pop  { animation: ccAnimPop var(--dur-2) var(--ease-rein) both; }\n.cc-anim-ein-lang { animation: ccAnimEin var(--dur-3) var(--ease-rein) both; }\n.cc-anim-aus      { animation: ccAnimAus var(--dur-2) var(--ease-raus) both; pointer-events: none; }\n\n/* Listen-Einstieg: sanfter Stagger (20ms-Schritte, ab der 8. Zeile gemeinsam). */\n.cc-partner-zeile, .cc-dash-bedarf-zeile, .cc-mon-zeile, .cc-ber-zeile, .cc-audit-zeile {\n  animation: ccAnimEin var(--dur-2) var(--ease-rein) backwards;\n}\n.cc-partner-zeile:nth-child(2), .cc-dash-bedarf-zeile:nth-child(2), .cc-mon-zeile:nth-child(2), .cc-ber-zeile:nth-child(2), .cc-audit-zeile:nth-child(2) { animation-delay: 20ms; }\n.cc-partner-zeile:nth-child(3), .cc-dash-bedarf-zeile:nth-child(3), .cc-mon-zeile:nth-child(3), .cc-ber-zeile:nth-child(3), .cc-audit-zeile:nth-child(3) { animation-delay: 40ms; }\n.cc-partner-zeile:nth-child(4), .cc-dash-bedarf-zeile:nth-child(4), .cc-mon-zeile:nth-child(4), .cc-ber-zeile:nth-child(4), .cc-audit-zeile:nth-child(4) { animation-delay: 60ms; }\n.cc-partner-zeile:nth-child(5), .cc-dash-bedarf-zeile:nth-child(5), .cc-mon-zeile:nth-child(5), .cc-ber-zeile:nth-child(5), .cc-audit-zeile:nth-child(5) { animation-delay: 80ms; }\n.cc-partner-zeile:nth-child(6), .cc-dash-bedarf-zeile:nth-child(6), .cc-mon-zeile:nth-child(6), .cc-ber-zeile:nth-child(6), .cc-audit-zeile:nth-child(6) { animation-delay: 100ms; }\n.cc-partner-zeile:nth-child(7), .cc-dash-bedarf-zeile:nth-child(7), .cc-mon-zeile:nth-child(7), .cc-ber-zeile:nth-child(7), .cc-audit-zeile:nth-child(7) { animation-delay: 120ms; }\n.cc-partner-zeile:nth-child(n+8), .cc-dash-bedarf-zeile:nth-child(n+8), .cc-mon-zeile:nth-child(n+8), .cc-ber-zeile:nth-child(n+8), .cc-audit-zeile:nth-child(n+8) { animation-delay: 140ms; }\n\n/* Scroll-Region (nimmt den Rest ein). position:relative traegt die Geist-Ebene. */\n.cc-inhalt { position: relative; flex: 1 1 auto; overflow-y: auto; scrollbar-width: thin; }\n/* B4 Geist-Ebene: der alte Seiteninhalt blendet hier weich aus (Crossfade). */\n.cc-inhalt-geist {\n  position: absolute;\n  top: 0; left: 0; right: 0; bottom: 0;\n  overflow: hidden;\n  pointer-events: none;\n}\n/* Spiegelt die Masse von .cc-inhalt-innen (eigene Klasse, damit es nur EINE echte\n   Inhalts-Ebene gibt – Locator/axe sehen den Geist nie als „die\" Inhaltsflaeche). */\n.cc-inhalt-geist-inhalt {\n  width: 100%;\n  margin: 0 auto;\n  padding: var(--cc-pad-inhalt-y) var(--cc-pad-inhalt-x) var(--space-16);\n  box-sizing: border-box;\n}\n.cc-inhalt-innen {\n  width: 100%;\n  margin: 0 auto;\n  padding: var(--cc-pad-inhalt-y) var(--cc-pad-inhalt-x) var(--space-16);\n  box-sizing: border-box;\n}\n.cc-breit .cc-inhalt-innen, .cc-inhalt-innen.cc-breit { max-width: var(--cc-inhalt-max); }\n/* Modul-Container (von shell.js gerendert) tragen die passende Max-Breite selbst. */\n\n/* ---------------------------------------------------------- Seitenkopf -- */\n/* Gemeinsamer Seitenkopf (greeting/H1/context) fuer Dashboard/KI/Einstellungen. */\n.cc-dash-kopf, .cc-partner-kopf { margin-bottom: var(--space-6); }\n.cc-dash-eyebrow {\n  margin: 0 0 var(--space-2);\n  font-size: var(--fs-meta); font-weight: var(--fw-semi); letter-spacing: .055em;\n  text-transform: uppercase; color: var(--cc-marke-akzent);\n}\n.cc-dash-titel, .cc-partner-titel, .cc-akte-name {\n  margin: 0;\n  font-size: var(--fs-display);\n  line-height: 1.18;\n  font-weight: var(--fw-bold);\n  letter-spacing: -0.03em;\n  color: var(--text-primary);\n}\n.cc-dash-unter, .cc-partner-unter { margin: var(--space-2) 0 0; font-size: var(--fs-body); line-height: 1.5; color: var(--text-secondary); }\n\n/* --------------------------------------------------------------- Karten -- */\n.cc-karte {\n  margin-bottom: var(--space-4);\n  padding: var(--space-5);\n  border-radius: var(--radius-lg);\n  /* B7: Karten = Glas-2-Material OHNE eigenen backdrop-filter (B8-Blur-Budget). */\n  background: var(--glass-2-bg);\n  border: 1px solid var(--glass-2-border);\n  box-shadow: var(--glass-2-shadow);\n}\n.cc-karte-titel {\n  margin: 0 0 var(--space-3);\n  font-size: var(--fs-meta); font-weight: var(--fw-semi); letter-spacing: .055em;\n  text-transform: uppercase; color: var(--text-muted);\n}\n\n/* -------------------------------------------------------------- Knoepfe -- */\n.cc-knopf {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: var(--space-2);\n  min-height: 40px;\n  padding: 0 var(--space-5);\n  border: 0;\n  border-radius: var(--radius-sm);\n  background: var(--brand-700);\n  color: #fff;\n  font-family: var(--cc-font);\n  font-size: var(--fs-body);\n  font-weight: var(--fw-semi);\n  cursor: pointer;\n  box-shadow: 0 1px 2px rgba(16,60,30,.18), inset 0 1px 0 rgba(255,255,255,.12); /* lint-ok: Primaerknopf-Praegung */\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out), transform var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-knopf svg { width: 17px; height: 17px; }\n.cc-knopf:hover { background: var(--brand-800); }\n.cc-knopf:active { transform: translateY(1px); }\n.cc-knopf:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-knopf:disabled { opacity: .5; cursor: not-allowed; }\n.cc-knopf-leise {\n  background: var(--surface-raised);\n  color: var(--text-primary);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n}\n.cc-knopf-leise:hover { background: var(--surface-subtle); border-color: var(--border-strong); }\n.cc-knopf-geist { background: transparent; color: var(--text-secondary); box-shadow: none; }\n.cc-knopf-geist:hover { background: var(--cc-hover); color: var(--text-primary); }\n\n/* --------------------------------------------------------- Ampel/Pillen -- */\n.cc-ampel {\n  display: inline-flex;\n  align-items: center;\n  gap: var(--space-2);\n  flex: 0 0 auto;\n  min-height: 26px;\n  padding: 0 var(--space-3) 0 var(--space-2);\n  border-radius: var(--radius-pill);\n  font-size: var(--fs-klein);\n  font-weight: var(--fw-bold);\n  font-variant-numeric: tabular-nums;\n  letter-spacing: -0.01em;\n}\n.cc-ampel-punkt { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; box-shadow: 0 0 0 3px rgba(255,255,255,.5); }\n.cc-ampel-ok      { background: color-mix(in srgb, var(--ok) 15%, var(--cc-pille-basis)); color: var(--ok-strong); }\n.cc-ampel-ok      .cc-ampel-punkt { background: var(--ok); }\n.cc-ampel-pending { background: color-mix(in srgb, var(--pending) 17%, var(--cc-pille-basis)); color: var(--pending-strong); }\n.cc-ampel-pending .cc-ampel-punkt { background: var(--pending); }\n.cc-ampel-urgent  { background: color-mix(in srgb, var(--urgent) 14%, var(--cc-pille-basis)); color: var(--urgent-strong); }\n.cc-ampel-urgent  .cc-ampel-punkt { background: var(--urgent); }\n.cc-ampel-grau    { background: var(--surface-subtle); color: var(--text-muted); }\n.cc-ampel-grau    .cc-ampel-punkt { background: var(--cc-gesperrt); box-shadow: none; }\n\n/* P4: Platzhalter zurueckhaltend (gestrichelte neutrale Pille statt Amber-Alarm);\n   die Bedeutung \"Julius legt fest\" bleibt im Text. */\n.cc-platzhalter {\n  display: inline-flex;\n  align-items: center;\n  min-height: 22px;\n  padding: 0 var(--space-2);\n  border-radius: var(--radius-xs);\n  background: var(--surface-subtle);\n  color: var(--text-secondary);\n  border: 1px dashed var(--border-strong);\n  font-size: var(--fs-meta); font-weight: var(--fw-medium);\n}\n\n/* --------------------------------------------------- Suche / Filterchips -- */\n.cc-partner-such { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; margin-bottom: var(--space-5); }\n.cc-such-feld {\n  flex: 1 1 240px;\n  min-height: 42px;\n  padding: var(--space-2) var(--space-4);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-sm);\n  background: var(--surface-raised);\n  box-shadow: var(--shadow-1);\n  font-family: var(--cc-font);\n  font-size: var(--fs-body);\n  color: var(--text-primary);\n  transition: border-color var(--cc-dauer-kurz) var(--cc-ease-out), box-shadow var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-such-feld::placeholder { color: var(--text-muted); }\n.cc-such-feld:focus-visible, .cc-such-feld:focus {\n  outline: none;\n  border-color: var(--brand-400);\n  box-shadow: var(--cc-fokus-schein);\n}\n.cc-ampel-filter { display: flex; flex-wrap: wrap; gap: var(--space-2); }\n.cc-chip {\n  min-height: 36px;\n  padding: var(--space-2) var(--space-4);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-sm);\n  background: var(--surface-raised);\n  color: var(--text-secondary);\n  font-family: var(--cc-font);\n  font-size: var(--fs-klein);\n  font-weight: var(--fw-semi);\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out), border-color var(--cc-dauer-kurz) var(--cc-ease-out), color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-chip:hover { background: var(--surface-subtle); color: var(--text-primary); }\n.cc-chip-an { background: var(--brand-700); border-color: var(--brand-700); color: #fff; }\n.cc-chip-an:hover { background: var(--brand-800); }\n.cc-chip:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n\n/* -------------------------------------------- Geschaeftspartner (Tabelle) -- */\n.cc-partner, .cc-akte { max-width: var(--cc-inhalt-max); margin: 0 auto; }\n.cc-partner-kopf {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: var(--space-4);\n  flex-wrap: wrap;\n}\n\n/* Tabellen-artige Liste: kein vertikales Gitter, ruhiger Hover. */\n.cc-partner-liste {\n  display: flex;\n  flex-direction: column;\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n  /* P8: KEIN overflow:hidden – es wuerde den sticky Tabellenkopf im Scrollport\n     einsperren. Die Ecken runden Kopf + letzte Zeile selbst. */\n}\n.cc-partner-tabkopf { border-top-left-radius: var(--radius-lg); border-top-right-radius: var(--radius-lg); }\n.cc-partner-liste > .cc-partner-zeile:last-of-type { border-bottom-left-radius: var(--radius-lg); border-bottom-right-radius: var(--radius-lg); }\n/* P4: Tabellen-Raster der Partner-Directory (Kopf + Zeilen teilen die Spalten). */\n.cc-partner-tabkopf, .cc-partner-zeile {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) 56px 88px 104px 88px;\n  align-items: center;\n  gap: var(--space-4);\n  width: 100%;\n  padding: var(--space-2) var(--space-5);\n}\n.cc-partner-tabkopf {\n  position: sticky;\n  top: 0;\n  background: var(--glass-1-solid);\n  min-height: 36px;\n  border-bottom: 1px solid var(--border-subtle);\n  font-size: var(--fs-meta);\n  font-weight: var(--fw-semi);\n  letter-spacing: .055em;\n  text-transform: uppercase;\n  color: var(--text-muted);\n}\n.cc-partner-zeile {\n  min-height: 52px;\n  border: 0;\n  border-top: 1px solid var(--border-subtle);\n  background: transparent;\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-partner-liste > .cc-partner-zeile:first-of-type { border-top: 0; }\n.cc-partner-zeile:hover { background: var(--surface-subtle); }\n.cc-partner-zeile:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: -2px; }\n.cc-pt-name { min-width: 0; }\n.cc-pt-name-text { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); overflow-wrap: anywhere; }\n.cc-pt-land { font-size: var(--fs-klein); color: var(--text-secondary); }\n.cc-pt-anzahl { font-size: var(--fs-klein); color: var(--text-secondary); text-align: right; font-variant-numeric: tabular-nums; }\n.cc-pt-datum { font-size: var(--fs-klein); color: var(--text-secondary); text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }\n.cc-pt-score { justify-self: end; }\n.cc-pt-mobilmeta { display: none; font-size: var(--fs-klein); color: var(--text-muted); font-variant-numeric: tabular-nums; }\n@media (max-width: 639.98px) {\n  .cc-partner-tabkopf { display: none; }\n  .cc-partner-zeile { grid-template-columns: minmax(0, 1fr) auto; min-height: var(--cc-touch-min); }\n  .cc-partner-zeile .cc-pt-land, .cc-partner-zeile .cc-pt-anzahl, .cc-partner-zeile .cc-pt-datum { display: none; }\n  .cc-pt-mobilmeta { display: block; margin-top: var(--space-1); }\n}\n.cc-partner-keine { margin: var(--space-3) 0; padding: var(--space-3) var(--space-5); font-size: var(--fs-klein); color: var(--text-muted); }\n\n/* ---- Akte ---- */\n.cc-akte-kopf { margin-bottom: var(--space-3); }\n.cc-akte-zurueck {\n  display: inline-flex;\n  align-items: center;\n  gap: var(--space-1);\n  min-height: 36px;\n  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-2);\n  border: 0;\n  border-radius: var(--radius-sm);\n  background: transparent;\n  color: var(--cc-marke-akzent-stark);\n  font-family: var(--cc-font);\n  font-size: var(--fs-klein);\n  font-weight: var(--fw-semi);\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-akte-zurueck svg { width: 16px; height: 16px; }\n.cc-akte-zurueck:hover { background: var(--cc-marke-weich); }\n.cc-akte-zurueck:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-akte-titelzeile { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); margin: var(--space-3) 0 var(--space-6); flex-wrap: wrap; }\n\n.cc-stamm-zeile { display: flex; justify-content: space-between; gap: var(--space-4); padding: var(--space-3) 0; border-top: 1px solid var(--border-subtle); }\n.cc-akte-stamm .cc-stamm-zeile:first-of-type { border-top: 0; }\n.cc-stamm-label { font-size: var(--fs-klein); color: var(--text-muted); }\n.cc-stamm-wert { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); text-align: right; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }\n\n/* Score-Verlauf (P4: Skala + Zeitachse) */\n/* B7/H-12: Das Verlaufs-SVG skaliert mit der Kartenbreite (viewBox), statt in\n   einem stummen Scroller abgeschnitten zu wirken; Details stehen in der Historie. */\n.cc-verlauf { overflow: visible; }\n.cc-verlauf-svg { display: block; width: auto; max-width: 100%; height: auto; }\n.cc-verlauf-gitter { stroke: var(--border-subtle); stroke-width: 1; stroke-dasharray: 2 3; }\n.cc-verlauf-achse { stroke: var(--border-strong); stroke-width: 1; }\n.cc-verlauf-skala { fill: var(--text-muted); font-size: 10px; font-family: var(--cc-font); font-variant-numeric: tabular-nums; } /* lint-ok: SVG-Achsenbeschriftung unter der Textskala */\n.cc-verlauf-datum { fill: var(--text-muted); font-size: 10px; font-family: var(--cc-font); font-variant-numeric: tabular-nums; } /* lint-ok: SVG-Achsenbeschriftung unter der Textskala */\n.cc-verlauf-bar.cc-ampel-ok { fill: var(--ok); }\n.cc-verlauf-bar.cc-ampel-pending { fill: var(--pending); }\n.cc-verlauf-bar.cc-ampel-urgent { fill: var(--urgent); }\n.cc-verlauf-bar.cc-ampel-grau { fill: var(--cc-trenner); }\n.cc-verlauf-zahl { fill: var(--text-secondary); font-size: var(--fs-meta); font-weight: var(--fw-semi); font-family: var(--cc-font); font-variant-numeric: tabular-nums; }\n\n.cc-aus { display: none !important; }\n\n/* Pruefhistorie */\n.cc-hist-liste { display: flex; flex-direction: column; }\n.cc-hist-zeile { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) 0; border-top: 1px solid var(--border-subtle); }\n.cc-hist-liste .cc-hist-zeile:first-child { border-top: 0; }\n.cc-hist-datum { flex: 0 0 96px; font-size: var(--fs-klein); font-weight: var(--fw-semi); color: var(--text-primary); font-variant-numeric: tabular-nums; }\n.cc-hist-pid { flex: 1 1 auto; text-align: right; font-size: var(--fs-klein); color: var(--text-muted); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }\n.cc-akte-aktion { margin-top: var(--space-2); }\n\n/* „Zur Akte\"-Schwebeknopf (app-only, in Vorschau versteckt) */\n.cc-zur-akte {\n  position: fixed;\n  right: 22px; bottom: 22px;\n  z-index: 9500;\n  display: inline-flex;\n  align-items: center;\n  gap: var(--space-2);\n  min-height: var(--cc-touch-min);\n  padding: var(--space-3) var(--space-5);\n  border: 0;\n  border-radius: var(--radius-pill);\n  background: var(--brand-700);\n  color: #fff;\n  font-family: var(--cc-font);\n  font-size: var(--fs-body);\n  font-weight: var(--fw-semi);\n  cursor: pointer;\n  box-shadow: var(--shadow-3);\n}\n.cc-zur-akte svg { width: 18px; height: 18px; }\n.cc-zur-akte:hover { background: var(--brand-800); }\n.cc-zur-akte:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n@media (min-width: 768px) { body.cc-shell-an .cc-zur-akte { right: 28px; bottom: 28px; } }\n\n/* --------------------------------------------------------- Leerzustand -- */\n.cc-leer {\n  max-width: 460px;\n  margin: var(--cc-leer-oben) auto 0;\n  padding: var(--space-10) var(--space-6);\n  text-align: center;\n}\n.cc-leer-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 60px; height: 60px;\n  margin-bottom: var(--space-5);\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-2);\n  color: var(--brand-600);\n}\n.cc-leer-icon svg { width: 28px; height: 28px; }\n.cc-leer-titel { margin: 0 0 var(--space-2); font-size: var(--fs-titel); font-weight: var(--fw-bold); letter-spacing: -0.02em; color: var(--text-primary); }\n.cc-leer-satz { margin: 0 auto var(--space-1); max-width: 40ch; font-size: var(--fs-body); line-height: 1.55; color: var(--text-secondary); }\n.cc-leer-bald {\n  display: inline-block;\n  margin-top: var(--space-4);\n  padding: var(--space-1) var(--space-3);\n  border-radius: var(--radius-pill);\n  background: var(--cc-marke-weich);\n  color: var(--cc-marke-akzent-stark);\n  font-size: var(--fs-meta); font-weight: var(--fw-semi);\n}\n.cc-leer-hinweis { margin-top: var(--space-5); font-size: var(--fs-klein); color: var(--text-muted); }\n.cc-leer .cc-knopf { margin-top: var(--space-5); }\n/* P7: kompakte Variante (gesperrte Module, Hinweise) – kleine Karte statt Leere. */\n.cc-leer-kompakt {\n  max-width: 440px;\n  margin: var(--space-10) auto 0;\n  padding: var(--space-6);\n  text-align: left;\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-lg);\n  box-shadow: var(--shadow-1);\n}\n.cc-leer-kopfzeile { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }\n.cc-leer-kompakt .cc-leer-icon {\n  width: 40px; height: 40px;\n  margin: 0;\n  box-shadow: none;\n  background: var(--surface-subtle);\n  border-color: var(--border-subtle);\n  color: var(--text-secondary);\n}\n.cc-leer-kompakt .cc-leer-icon svg { width: 20px; height: 20px; }\n.cc-leer-kompakt .cc-leer-titel { margin: 0; font-size: var(--fs-h3); }\n.cc-leer-kompakt .cc-leer-satz { margin: 0 0 var(--space-1); max-width: none; }\n.cc-leer-kompakt .cc-leer-hinweis { margin-top: var(--space-2); }\n\n/* ------------------------------------------------------- Mobiler Balken -- */\n@media (max-width: 767.98px) {\n  body.cc-shell-an .cc-shell-balken {\n    display: flex;\n    align-items: center;\n    gap: var(--space-3);\n    position: fixed;\n    top: 0; left: 0; right: 0;\n    height: var(--cc-shell-mobil-bar);\n    padding: 0 var(--space-3);\n    background: var(--glass-1-solid);\n    border-bottom: 1px solid var(--border-subtle);\n    font-family: var(--cc-font);\n    z-index: 9001;\n  }\n  body.cc-shell-an { padding-top: var(--cc-shell-mobil-bar); padding-left: 0; }\n  body.cc-shell-an.cc-shell-schmal { padding-left: 0; }\n  .cc-shell {\n    top: var(--cc-shell-mobil-bar);\n    width: min(86vw, 320px);\n    transform: translateX(-104%);\n    opacity: 0;\n    /* visibility erst NACH dem Raus-Fade schalten (wie bei der Palette): der\n       geschlossene Drawer ist damit fuer axe/Screenreader wirklich unsichtbar\n       (sonst rechnet axe die Textfarben gegen den Seitenhintergrund). */\n    visibility: hidden;\n    transition: transform var(--dur-3) var(--ease-raus), opacity var(--dur-2) var(--ease-raus), visibility 0s linear var(--dur-3);\n    box-shadow: var(--shadow-3);\n  }\n  body.cc-shell-auf .cc-shell { transform: translateX(0); opacity: 1; visibility: visible; transition: transform var(--dur-3) var(--ease-rein), opacity var(--dur-2) var(--ease-rein), visibility 0s; }\n  .cc-shell-modul-wrap { top: var(--cc-shell-mobil-bar); left: 0; }\n  body.cc-shell-schmal .cc-shell-modul-wrap { left: 0; }\n  .cc-topbar { display: none; }\n  .cc-shell-collapse { display: none; }\n  /* P2: der Balken traegt die Marke – im Drawer nicht doppeln; Touch-Ziele 44px. */\n  .cc-shell .cc-shell-marke { display: none; }\n  .cc-nav-eintrag { min-height: var(--cc-touch-min); }\n  .cc-set-tab { min-height: var(--cc-touch-min); }\n  /* Drawer-Backdrop (B4: faedt weich ein UND aus – display wechselt nie mehr,\n     geschlossen traegt visibility die Unsichtbarkeit). */\n  body.cc-shell-an .cc-shell-backdrop {\n    display: block;\n    position: fixed;\n    top: var(--cc-shell-mobil-bar); left: 0; right: 0; bottom: 0;\n    z-index: 8900;\n    background: var(--cc-scrim-drawer);\n    -webkit-backdrop-filter: blur(2px);\n    backdrop-filter: blur(2px);\n    opacity: 0;\n    visibility: hidden;\n    pointer-events: none;\n    transition: opacity var(--dur-2) var(--ease-raus), visibility 0s linear var(--dur-2);\n  }\n  body.cc-shell-auf .cc-shell-backdrop {\n    opacity: 1;\n    visibility: visible;\n    pointer-events: auto;\n    transition: opacity var(--dur-2) var(--ease-rein), visibility 0s;\n  }\n}\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  @media (max-width: 767.98px) {\n    body.cc-shell-an .cc-shell-balken {\n      background: var(--glass-1-bg);\n      -webkit-backdrop-filter: var(--glass-1-blur);\n      backdrop-filter: var(--glass-1-blur);\n    }\n  }\n}\n.cc-shell-umschalter, .cc-shell-balken-knopf {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: var(--cc-touch-min);\n  height: var(--cc-touch-min);\n  border: 0;\n  border-radius: var(--radius-sm);\n  background: transparent;\n  color: var(--text-primary);\n  cursor: pointer;\n}\n.cc-shell-umschalter:hover, .cc-shell-balken-knopf:hover { background: var(--cc-hover-stark); }\n.cc-shell-umschalter:focus-visible, .cc-shell-balken-knopf:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-shell-balken-marke { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }\n.cc-shell-balken-marke .cc-logo-voll { height: 24px; }\n.cc-shell-balken-marke .cc-logo-marke { display: none; }\n.cc-shell-balken-marke .cc-shell-logo { width: 28px; height: 28px; border-radius: var(--radius-sm); }\n.cc-shell-balken-marke .cc-shell-logo svg { width: 17px; height: 17px; }\n.cc-shell-balken-titel { font-weight: var(--fw-bold); font-size: var(--fs-h3); letter-spacing: -0.01em; color: var(--text-primary); }\n.cc-shell-balken-rechts { margin-left: auto; display: flex; align-items: center; gap: var(--space-1); }\n\n/* ====================================================== Kommando-Palette == */\n.cc-kbackdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 10050;\n  display: flex;\n  align-items: flex-start;\n  justify-content: center;\n  padding: var(--cc-pad-palette-oben) var(--space-4) var(--space-4);\n  background: var(--cc-scrim);\n  opacity: 0;\n  visibility: hidden;\n  pointer-events: none;\n  /* P6: visibility NICHT mitfaden – beim Oeffnen sofort sichtbar (sonst scheitert der\n     Autofokus im noch unsichtbaren Baum); beim Schliessen erst nach dem Fade hidden. */\n  transition: opacity var(--cc-dauer-mittel) var(--cc-ease-out), visibility 0s linear var(--cc-dauer-mittel);\n}\n/* B8: Palette-Scrim ohne eigenen Blur (Budget: max. 3 sichtbare Glas-Flaechen;\n   die Palette selbst blurt, der Scrim dunkelt nur). */\n.cc-kbackdrop.cc-auf { opacity: 1; visibility: visible; pointer-events: auto; transition: opacity var(--cc-dauer-mittel) var(--cc-ease-out), visibility 0s; }\n.cc-kpalette {\n  width: min(620px, 100%);\n  max-height: min(60vh, 520px);\n  display: flex;\n  flex-direction: column;\n  border-radius: var(--radius-xl);\n  background: var(--glass-3-solid);\n  border: 1px solid var(--glass-3-border);\n  box-shadow: var(--shadow-4);\n  overflow: hidden;\n  transform: translateY(-8px) scale(.99);\n  transition: transform var(--cc-dauer-mittel) var(--cc-ease-out);\n}\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  .cc-kpalette { background: var(--glass-3-bg); -webkit-backdrop-filter: var(--glass-3-blur); backdrop-filter: var(--glass-3-blur); }\n}\n.cc-kbackdrop.cc-auf .cc-kpalette { transform: translateY(0) scale(1); }\n.cc-kpalette-suchzeile { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border-subtle); }\n.cc-kpalette-suchzeile svg { width: 18px; height: 18px; color: var(--text-muted); flex: 0 0 auto; }\n.cc-kpalette-input {\n  flex: 1 1 auto;\n  min-width: 0;\n  border: 0;\n  background: transparent;\n  font-family: var(--cc-font);\n  font-size: var(--fs-h3);\n  color: var(--text-primary);\n}\n/* P6: Legacy input[type=text]:focus (0,1,1) wuerde Border/Glow hineindruecken –\n   gleiche Spezifitaet + spaetere Quelle neutralisiert das in Hell UND Dunkel. */\n.cc-kbackdrop .cc-kpalette-input:focus, .cc-kpalette-input:focus { outline: none; border: 0; box-shadow: none; background: transparent; }\n.cc-kpalette-input::placeholder { color: var(--text-muted); }\n.cc-kpalette-liste { overflow-y: auto; padding: var(--space-2); scrollbar-width: thin; }\n.cc-kpalette-gruppe { padding: var(--space-3) var(--space-3) var(--space-1); font-size: var(--fs-meta); font-weight: var(--fw-semi); letter-spacing: .055em; text-transform: uppercase; color: var(--text-muted); }\n.cc-kpalette-eintrag {\n  display: flex;\n  align-items: center;\n  gap: var(--space-3);\n  width: 100%;\n  padding: var(--space-3);\n  border: 0;\n  border-radius: var(--radius-sm);\n  background: transparent;\n  color: var(--text-primary);\n  font-family: var(--cc-font);\n  font-size: var(--fs-body);\n  text-align: left;\n  cursor: pointer;\n}\n.cc-kpalette-eintrag svg { width: 18px; height: 18px; color: var(--text-secondary); flex: 0 0 auto; }\n.cc-kpalette-eintrag .cc-kpalette-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.cc-kpalette-eintrag .cc-kpalette-hint { font-size: var(--fs-meta); color: var(--text-muted); }\n.cc-kpalette-eintrag.cc-aktiv, .cc-kpalette-eintrag:hover { background: var(--cc-marke-weich); }\n.cc-kpalette-eintrag.cc-aktiv { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand-500) 30%, transparent); }\n.cc-kpalette-eintrag.cc-aktiv svg, .cc-kpalette-eintrag.cc-aktiv .cc-kpalette-label { color: var(--cc-marke-akzent-stark); }\n.cc-kpalette-leer { padding: var(--space-6); text-align: center; font-size: var(--fs-klein); color: var(--text-muted); }\n.cc-kpalette-fuss {\n  flex: 0 0 auto;\n  display: flex;\n  align-items: center;\n  gap: var(--space-5);\n  padding: var(--space-3) var(--space-5);\n  border-top: 1px solid var(--border-subtle);\n  font-size: var(--fs-meta);\n  color: var(--text-muted);\n}\n.cc-kpalette-hinweis { display: inline-flex; align-items: center; gap: var(--space-1); }\n\n/* ============================================================== Toasts == */\n.cc-toasts {\n  position: fixed;\n  left: 50%;\n  bottom: calc(24px + var(--cc-pad-safe-unten));\n  transform: translateX(-50%);\n  z-index: 10060;\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  pointer-events: none;\n}\n.cc-toast {\n  display: inline-flex;\n  align-items: center;\n  gap: var(--space-2);\n  padding: var(--space-3) var(--space-4);\n  border-radius: var(--radius-sm);\n  background: var(--cc-toast-bg);\n  color: #fff;\n  font-size: var(--fs-klein);\n  font-weight: var(--fw-medium);\n  box-shadow: var(--shadow-3);\n  opacity: 0;\n  transform: translateY(8px);\n  transition: opacity var(--cc-dauer-mittel) var(--cc-ease-out), transform var(--cc-dauer-mittel) var(--cc-ease-out);\n}\n.cc-toast svg { width: 16px; height: 16px; color: var(--brand-300); }\n.cc-toast.cc-auf { opacity: 1; transform: translateY(0); }\n\n/* ============================================================= Dashboard == */\n.cc-dash { max-width: var(--cc-inhalt-max); margin: 0 auto; }\n.cc-dash-bereich { margin-bottom: var(--space-8); }\n.cc-dash-bereich-titel {\n  margin: 0 0 var(--space-3);\n  font-size: var(--fs-meta); font-weight: var(--fw-semi); letter-spacing: .055em;\n  text-transform: uppercase; color: var(--cc-leiste-leise);\n  display: flex; align-items: center; gap: var(--space-2);\n}\n\n/* B6: einzeiliger Assistenz-Einstieg (Avatar + Eingabe + Senden + Link zur Chat-Seite);\n   der Mini-Verlauf erscheint erst nach der ersten Frage (:empty aus). */\n.cc-ki-feld-kompakt { padding: var(--space-2) var(--space-3); gap: var(--space-2); margin-bottom: var(--space-8); }\n.cc-ki-feld-kompakt .cc-ki-eingabe { align-items: center; gap: var(--space-3); }\n.cc-ki-feld-kompakt .cc-ki-input { min-height: 40px; padding: var(--space-2) var(--space-3); border: 0; background: transparent; box-shadow: none; }\n.cc-ki-feld-kompakt .cc-ki-input:focus, .cc-ki-feld-kompakt .cc-ki-input:focus-visible { outline: none; border: 0; box-shadow: none; background: transparent; }\n.cc-ki-feld-kompakt:focus-within { border-color: var(--brand-400); box-shadow: var(--cc-fokus-schein); }\n.cc-ki-feld-kompakt .cc-ki-senden { min-height: 36px; padding: 0 var(--space-4); }\n.cc-ki-zum-chat { min-height: 36px; padding: 0 var(--space-3); font-size: var(--fs-klein); flex: 0 0 auto; }\n@media (max-width: 639.98px) { .cc-ki-zum-chat { display: none; } }\n.cc-ki-feld-kompakt .cc-ki-log:not(:empty) { margin-top: var(--space-2); padding: var(--space-2) var(--space-2) 0; border-top: 1px solid var(--border-subtle); }\n.cc-ki-log:empty { display: none; }\n\n/* B6 Kopfzeile: Begruessung + Datum links, Primaerknopf rechts. */\n.cc-dash-kopfzeile { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }\n.cc-dash-kopf-text { min-width: 0; }\n.cc-dash-primaer { flex: 0 0 auto; }\n\n/* KPI-Kacheln (Tages-Briefing). B6: klickbare Glas-Karten – transluzent OHNE\n   eigenen backdrop-filter (B8-Budget: Blur nur Leiste/Topbar/Overlays; ueber der\n   ruhigen Szene liest die 72%-Flaeche trotzdem als Glas). */\n.cc-dash-briefing { margin-bottom: var(--space-8); }\n.cc-dash-briefing > .cc-dash-bereich-titel { margin-bottom: var(--space-3); }\n.cc-dash-kennzahlen {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));\n  gap: var(--space-4);\n}\n.cc-dash-kennzahl {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-1);\n  padding: var(--space-4);\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n}\n.cc-dash-kpi {\n  background: var(--glass-2-bg);\n  border: 1px solid var(--glass-2-border);\n  box-shadow: var(--glass-2-shadow);\n  -webkit-backdrop-filter: none;\n  backdrop-filter: none;\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: transform var(--dur-1) var(--ease-rein), box-shadow var(--dur-1) var(--ease-rein), border-color var(--dur-1) var(--ease-rein);\n}\n.cc-dash-kpi:hover { transform: translateY(-1px); border-color: var(--brand-300); box-shadow: var(--shadow-2); }\n.cc-dash-kpi:active { transform: translateY(0); }\n.cc-dash-kpi:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-dash-kz-zahl { font-size: var(--fs-display); line-height: 1; font-weight: var(--fw-bold); letter-spacing: -0.03em; color: var(--text-primary); font-variant-numeric: tabular-nums; }\n.cc-dash-kz-text { font-size: var(--fs-klein); color: var(--text-secondary); }\n\n/* B6 Zweispaltiger Arbeitsbereich (>=1024). */\n.cc-dash-spalten { display: grid; grid-template-columns: 1fr; gap: var(--space-6); margin-bottom: var(--space-8); align-items: start; }\n.cc-dash-spalten .cc-dash-bereich { margin-bottom: 0; }\n.cc-dash-rechts { display: flex; flex-direction: column; gap: var(--space-6); min-width: 0; }\n@media (min-width: 1024px) {\n  .cc-dash-spalten { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }\n}\n.cc-dash-letzte {\n  display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);\n  width: 100%;\n  margin: 0;\n  padding: var(--space-3) var(--space-5);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  box-shadow: var(--shadow-1);\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--dur-1) var(--ease-rein), border-color var(--dur-1) var(--ease-rein);\n}\n.cc-dash-letzte:hover { background: var(--surface-subtle); border-color: var(--border-strong); }\n.cc-dash-letzte:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n/* Monitoring-Status-Karte (Klick -> Monitoring). */\n.cc-dash-mon {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-1);\n  width: 100%;\n  padding: var(--space-3) var(--space-5);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  box-shadow: var(--shadow-1);\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--dur-1) var(--ease-rein), border-color var(--dur-1) var(--ease-rein);\n}\n.cc-dash-mon:hover { background: var(--surface-subtle); border-color: var(--border-strong); }\n.cc-dash-mon:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-dash-mon-zeile { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); }\n.cc-dash-mon-meta { font-size: var(--fs-klein); color: var(--text-secondary); }\n.cc-dash-letzte-links { min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }\n.cc-dash-letzte-art { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); }\n.cc-dash-letzte-firma { font-size: var(--fs-klein); color: var(--text-secondary); overflow-wrap: anywhere; }\n.cc-dash-letzte-datum { font-size: var(--fs-klein); color: var(--text-muted); font-variant-numeric: tabular-nums; flex: 0 0 auto; }\n\n/* Handlungsbedarf (Ampel NUR hier) */\n.cc-dash-bedarf-liste {\n  display: flex;\n  flex-direction: column;\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n  overflow: hidden;\n}\n.cc-dash-bedarf-zeile {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: var(--space-4);\n  width: 100%;\n  min-height: 60px;\n  padding: var(--space-3) var(--space-5);\n  border: 0;\n  border-top: 1px solid var(--border-subtle);\n  background: transparent;\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-dash-bedarf-liste > .cc-dash-bedarf-zeile:first-child { border-top: 0; }\n.cc-dash-bedarf-zeile:hover { background: var(--surface-subtle); }\n.cc-dash-bedarf-zeile:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: -2px; }\n.cc-dash-bz-links { min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }\n.cc-dash-bz-name { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); overflow-wrap: anywhere; }\n.cc-dash-bz-meta { font-size: var(--fs-klein); color: var(--text-muted); font-variant-numeric: tabular-nums; }\n.cc-dash-ruhig {\n  margin: 0;\n  padding: var(--space-5);\n  display: flex; align-items: center; gap: var(--space-3);\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n  font-size: var(--fs-body);\n  color: var(--text-secondary);\n}\n.cc-dash-ruhig::before { content: \"\"; width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 20%, transparent); flex: 0 0 auto; }\n\n/* B6 Schnellzugriffe: kompakte, liegende Karten (Icon links, Text rechts). */\n.cc-dash-abteilungen {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));\n  gap: var(--space-3);\n}\n.cc-dash-karte {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  gap: var(--space-3);\n  min-height: 56px;\n  padding: var(--space-3) var(--space-4);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-md);\n  background: var(--surface-raised);\n  box-shadow: var(--shadow-1);\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: border-color var(--dur-1) var(--ease-rein), box-shadow var(--dur-1) var(--ease-rein), transform var(--dur-1) var(--ease-rein);\n}\n.cc-dash-karte:hover { border-color: var(--border-strong); box-shadow: var(--shadow-2); transform: translateY(-1px); }\n.cc-dash-karte:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-dash-karte-icon {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 32px; height: 32px;\n  flex: 0 0 auto;\n  border-radius: var(--radius-sm);\n  background: var(--cc-marke-weich);\n  color: var(--cc-marke-akzent);\n  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand-500) 14%, transparent);\n}\n.cc-dash-karte-icon svg { width: 18px; height: 18px; }\n.cc-dash-karte-text { min-width: 0; display: flex; flex-direction: column; }\n.cc-dash-karte-titel { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); }\n.cc-dash-karte-satz { margin: 0; font-size: var(--fs-klein); line-height: 1.45; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n/* ====================================================== KI-Assistent ======= */\n/* P6: gleiche Inhaltsbreite wie alle Module (rechte Kante = Rasterkante);\n   Lesbarkeit kommt ueber die gedeckelte Blasenbreite, nicht ueber eine Sonderspalte. */\n.cc-ki-ansicht { max-width: var(--cc-inhalt-max); margin: 0 auto; }\n@media (max-width: 639.98px) { .cc-ki-senden { padding: 0 var(--space-4); } }\n.cc-ki-feld {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-4);\n  padding: var(--space-5);\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n}\n/* (P3: Hero-Verlauf entfernt – der Dashboard-Assistent ist kompakt, der dunkle\n   Modus verliert damit auch den schlammigen Verlauf aus dem Audit.) */\n/* (B7: cc-ki-titel/-unter entfallen – das Kompaktfeld ist einzeilig (B6), die\n   Chat-Seite traegt ihren eigenen Kopf (B5).) */\n.cc-ki-log {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  max-height: 240px;\n  overflow-y: auto;\n  padding: var(--space-1);\n  scrollbar-width: thin;\n}\n.cc-ki-msg { display: flex; }\n.cc-ki-msg-nutzer { justify-content: flex-end; }\n.cc-ki-msg-assistent { justify-content: flex-start; }\n.cc-ki-blase {\n  max-width: min(85%, 640px);\n  padding: var(--space-2) var(--space-3);\n  border-radius: var(--radius-md);\n  font-size: var(--fs-body);\n  line-height: 1.5;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.cc-ki-msg-nutzer .cc-ki-blase { background: var(--brand-600); color: #fff; border-bottom-right-radius: var(--radius-xs); }\n.cc-ki-msg-assistent .cc-ki-blase { background: var(--surface-subtle); color: var(--text-primary); border-bottom-left-radius: var(--radius-xs); }\n.cc-ki-eingabe { display: flex; gap: var(--space-2); }\n.cc-ki-input {\n  flex: 1 1 auto;\n  min-height: var(--cc-touch-min);\n  padding: var(--space-3) var(--space-4);\n  font: inherit;\n  font-size: var(--fs-body);\n  color: var(--text-primary);\n  border: 1px solid var(--border-subtle);\n  border-radius: var(--radius-sm);\n  background: var(--surface-raised);\n  box-shadow: var(--shadow-1);\n  transition: border-color var(--cc-dauer-kurz) var(--cc-ease-out), box-shadow var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-ki-input::placeholder { color: var(--text-muted); }\n.cc-ki-input:focus-visible, .cc-ki-input:focus { outline: none; border-color: var(--brand-400); box-shadow: var(--cc-fokus-schein); }\n.cc-ki-senden {\n  flex: 0 0 auto;\n  min-height: var(--cc-touch-min);\n  padding: 0 var(--space-5);\n  font: inherit;\n  font-size: var(--fs-body);\n  font-weight: var(--fw-semi);\n  color: #fff;\n  background: var(--brand-700);\n  border: none;\n  border-radius: var(--radius-sm);\n  cursor: pointer;\n  box-shadow: 0 1px 2px rgba(16,60,30,.18); /* lint-ok: Primaerknopf-Praegung */\n  transition: background var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-ki-senden:hover:not(:disabled) { background: var(--brand-800); }\n.cc-ki-senden:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n/* B6/H-08: leeres Feld -> Senden sichtbar inaktiv (kein toter Klick mehr). */\n.cc-ki-senden:disabled { background: var(--surface-subtle); color: var(--cc-gesperrt); cursor: default; box-shadow: none; }\n.cc-ki-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }\n.cc-ki-chip {\n  padding: var(--space-2) var(--space-3);\n  font: inherit;\n  font-size: var(--fs-klein);\n  color: var(--cc-marke-akzent-stark);\n  background: var(--surface-raised);\n  border: 1px solid color-mix(in srgb, var(--brand-500) 22%, var(--border-subtle));\n  border-radius: var(--radius-pill);\n  cursor: pointer;\n  transition: background var(--cc-dauer-kurz) var(--cc-ease-out), border-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-ki-chip:hover { background: var(--cc-marke-weich); border-color: var(--brand-400); }\n.cc-ki-chip:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n/* Bestaetigungskarte (Schreiben nur nach „Ja, ausfuehren\") */\n.cc-ki-karte {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  padding: var(--space-4);\n  border-radius: var(--radius-md);\n  background: color-mix(in srgb, var(--pending) 10%, var(--surface-raised));\n  border: 1px solid color-mix(in srgb, var(--pending) 45%, transparent);\n  box-shadow: var(--shadow-1);\n}\n.cc-ki-karte-aus { display: none; }\n.cc-ki-karte-titel { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--pending-strong); display: flex; align-items: center; gap: var(--space-2); }\n.cc-ki-karte-liste { margin: 0; padding-left: var(--space-5); font-size: var(--fs-klein); line-height: 1.6; color: var(--text-primary); }\n.cc-ki-karte-knoepfe { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-1); }\n.cc-ki-ja { background: var(--brand-700); }\n.cc-ki-nein { }\n\n/* ================================= B5 Chat „wie Claude\" (KI-Seite) ========= */\n/* Vollhoehe: ist der Chat aktiv, scrollt NUR der Verlauf – nicht die Seite. */\n.cc-inhalt:has(.cc-chat) { overflow: hidden; }\n.cc-inhalt:has(.cc-chat) > .cc-inhalt-innen {\n  height: 100%;\n  max-width: none;\n  display: flex;\n  flex-direction: column;\n  padding-bottom: var(--space-4);\n}\n/* Die Chat-Ansicht fuellt die Flaeche (ueberschreibt die Karten-Optik von .cc-ki-feld). */\n.cc-ki-ansicht:has(.cc-chat) { max-width: none; margin: 0; flex: 1 1 auto; min-height: 0; display: flex; }\n.cc-chat {\n  position: relative;\n  flex: 1 1 auto;\n  min-height: 0;\n  width: 100%;\n  display: flex;\n  flex-direction: column;\n  gap: 0;\n  margin: 0;\n  padding: 0;\n  background: transparent;\n  border: 0;\n  box-shadow: none;\n}\n\n/* Kopf: Avatar + Name + Status + „Neuer Chat\" */\n.cc-chat-kopf {\n  flex: 0 0 auto;\n  display: flex;\n  align-items: center;\n  gap: var(--space-3);\n  padding: 0 0 var(--space-3);\n  border-bottom: 1px solid var(--border-subtle);\n}\n.cc-chat-kopf-text { min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }\n.cc-chat-name { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); }\n.cc-chat-status { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--fs-meta); color: var(--text-muted); }\n.cc-chat-status-punkt { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }\n.cc-chat-neu { margin-left: auto; min-height: 32px; padding: 0 var(--space-3); font-size: var(--fs-klein); }\n\n/* Avatare: kreisrund, Glas-Ring, CC-Bildzeichen auf hellem Markengruen-Verlauf. */\n.cc-chat-avatar {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 32px; height: 32px;\n  flex: 0 0 auto;\n  border-radius: var(--radius-pill);\n  background: linear-gradient(145deg, var(--brand-100), var(--brand-300));\n  color: var(--brand-800);\n  box-shadow: 0 0 0 1px rgba(255,255,255,.75), 0 0 0 2px rgba(15,23,20,.06); /* Glas-Ring */\n  overflow: hidden;\n}\n.cc-chat-avatar-nutzer { background: var(--surface-subtle); color: var(--text-secondary); }\n.cc-chat-avatar-fenster { display: block; width: 20px; height: 20px; overflow: hidden; }\n.cc-chat-avatar-bild { display: block; height: 21px; width: auto; max-width: none; }\n.cc-chat-avatar-gross { width: 56px; height: 56px; }\n.cc-chat-avatar-gross .cc-chat-avatar-fenster { width: 36px; height: 36px; }\n.cc-chat-avatar-gross .cc-chat-avatar-bild { height: 38px; }\n\n/* Verlauf: scrollende Mitte mit zentrierter Lesespalte (max. 760px). */\n.cc-chat-verlauf {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-y: auto;\n  scrollbar-width: thin;\n  padding: var(--space-6) var(--space-2);\n}\n.cc-chat-spalte { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; }\n.cc-chat .cc-ki-log { max-height: none; overflow: visible; padding: 0; gap: var(--space-5); }\n.cc-chat .cc-ki-msg { gap: var(--space-3); }\n.cc-chat .cc-ki-msg-assistent { align-items: flex-start; }\n.cc-chat .cc-ki-msg-nutzer { align-items: flex-end; }\n.cc-chat-koerper { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }\n.cc-chat .cc-ki-msg-nutzer .cc-chat-koerper { align-items: flex-end; }\n/* Assistent: ruhige Flaeche ohne harte Box; Nutzer: weiche Markengruen-Bubble. */\n.cc-chat .cc-ki-msg-assistent .cc-ki-blase {\n  max-width: none;\n  padding: var(--space-1) 0 0;\n  background: transparent;\n  border-radius: 0;\n  line-height: 1.6;\n  color: var(--text-primary);\n}\n.cc-chat .cc-ki-msg-nutzer .cc-ki-blase {\n  max-width: min(85%, 560px);\n  padding: var(--space-3) var(--space-4);\n  background: var(--cc-marke-weich);\n  color: var(--text-primary);\n  border-radius: var(--radius-xl);\n  border-bottom-right-radius: var(--radius-xs);\n}\n/* Zeitstempel: dezent, erst bei Hover der Nachricht sichtbar. */\n.cc-chat-zeit { font-size: var(--fs-meta); color: var(--text-muted); opacity: 0; transition: opacity var(--dur-1) var(--ease-rein); }\n.cc-chat .cc-ki-msg:hover .cc-chat-zeit { opacity: 1; }\n/* Im kompakten Dashboard-Feld: Avatare/Zeitstempel NUR in den Nachrichten aus\n   (die Eingabezeile traegt bewusst einen kleinen Assistenten-Avatar, B6). */\n.cc-ki-feld-kompakt .cc-ki-msg .cc-chat-avatar, .cc-ki-feld-kompakt .cc-chat-zeit { display: none; }\n\n/* Schreib-Indikator: drei weiche Punkte. */\n.cc-chat-tippt { display: inline-flex; align-items: center; gap: var(--space-1); padding: var(--space-2) 0; }\n.cc-chat-punkt { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-400); animation: ccPunkt 1.1s var(--ease-rein) infinite; }\n.cc-chat-punkt:nth-child(2) { animation-delay: 150ms; }\n.cc-chat-punkt:nth-child(3) { animation-delay: 300ms; }\n@keyframes ccPunkt {\n  0%, 60%, 100% { opacity: .35; transform: none; }\n  30% { opacity: 1; transform: translateY(-3px); }\n}\n\n/* Leerzustand: grosser Avatar, Begruessung, Vorschlags-Chips (bestehende Aktionen). */\n.cc-chat-leer {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  text-align: center;\n  gap: var(--space-3);\n  margin: var(--cc-leer-oben) auto var(--space-6);\n  max-width: 520px;\n}\n.cc-chat-leer-titel { margin: var(--space-2) 0 0; font-size: var(--fs-display); font-weight: var(--fw-bold); letter-spacing: -0.02em; color: var(--text-primary); }\n.cc-chat-leer-satz { margin: 0; max-width: 46ch; font-size: var(--fs-body); line-height: 1.6; color: var(--text-secondary); }\n.cc-chat-leer .cc-ki-chips { justify-content: center; margin-top: var(--space-2); }\n\n/* „Nach unten\"-Knopf: schwebt ueber der Eingabe, Glas. */\n.cc-chat-runter {\n  position: absolute;\n  left: 50%;\n  bottom: 128px;\n  transform: translateX(-50%);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px; height: 36px;\n  border: 1px solid var(--glass-3-border);\n  border-radius: var(--radius-pill);\n  background: var(--glass-3-solid);\n  color: var(--text-secondary);\n  cursor: pointer;\n  box-shadow: var(--shadow-2);\n  transition: opacity var(--dur-2) var(--ease-rein), transform var(--dur-1) var(--ease-rein);\n}\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  .cc-chat-runter { background: var(--glass-3-bg); -webkit-backdrop-filter: var(--glass-3-blur); backdrop-filter: var(--glass-3-blur); }\n}\n.cc-chat-runter:hover { color: var(--text-primary); }\n.cc-chat-runter:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-chat-runter svg { width: 18px; height: 18px; }\n\n/* Eingabe unten: grosse Glas-Karte, mitwachsende Textarea, runder Senden-Knopf. */\n.cc-chat-fuss { flex: 0 0 auto; padding: var(--space-3) var(--space-2) var(--cc-pad-safe-unten); }\n.cc-chat-eingabe {\n  max-width: 760px;\n  margin: 0 auto;\n  display: flex;\n  align-items: flex-end;\n  gap: var(--space-2);\n  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);\n  border-radius: var(--radius-2xl);\n  transition: border-color var(--dur-1) var(--ease-rein), box-shadow var(--dur-1) var(--ease-rein);\n}\n.cc-chat-eingabe:focus-within { border-color: var(--brand-400); box-shadow: var(--cc-fokus-schein), var(--glass-2-shadow); }\n.cc-chat-input {\n  flex: 1 1 auto;\n  min-width: 0;\n  border: 0;\n  background: transparent;\n  box-shadow: none;\n  resize: none;\n  font: inherit;\n  font-size: var(--fs-body);\n  line-height: 1.5;\n  color: var(--text-primary);\n  padding: var(--space-2) 0;\n  min-height: 24px;\n  max-height: 192px;              /* 8 Zeilen à 24px */\n  field-sizing: content;          /* waechst mit (1–8 Zeilen); ohne Support: scrollt innen */\n  overflow-y: auto;\n  scrollbar-width: thin;\n}\n.cc-chat-input::placeholder { color: var(--text-muted); }\n.cc-chat .cc-chat-input:focus, .cc-chat-input:focus { outline: none; border: 0; box-shadow: none; background: transparent; }\n.cc-chat-senden {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 40px; height: 40px;\n  min-height: 40px;\n  padding: 0;\n  border: 0;\n  border-radius: var(--radius-pill);\n  background: var(--brand-700);\n  color: var(--cc-auf-marke);\n  cursor: pointer;\n  box-shadow: var(--shadow-1);\n  transition: background-color var(--dur-1) var(--ease-rein), transform var(--dur-1) var(--ease-rein), color var(--dur-1) var(--ease-rein);\n}\n.cc-chat-senden svg { width: 18px; height: 18px; }\n.cc-chat-senden:hover:not(:disabled) { background: var(--brand-800); }\n.cc-chat-senden:active:not(:disabled) { transform: translateY(1px); }\n.cc-chat-senden:disabled { background: var(--surface-subtle); color: var(--cc-gesperrt); cursor: default; box-shadow: none; }\n.cc-chat-senden:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-chat-hinweis { max-width: 760px; margin: var(--space-2) auto 0; text-align: center; font-size: var(--fs-meta); color: var(--text-muted); }\n\n@media (max-width: 639.98px) {\n  .cc-chat-verlauf { padding: var(--space-4) var(--space-1); }\n  .cc-chat .cc-ki-msg-nutzer .cc-ki-blase { max-width: 90%; }\n  .cc-chat-runter { bottom: 120px; }\n}\n\n/* Tour */\n.cc-tour {\n  position: fixed;\n  left: 50%;\n  bottom: 24px;\n  transform: translateX(-50%);\n  width: min(380px, calc(100vw - 32px));\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  padding: var(--space-5);\n  border-radius: var(--radius-lg);\n  background: var(--glass-3-solid);\n  border: 1px solid var(--glass-3-border);\n  box-shadow: var(--shadow-4);\n}\n@supports ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {\n  .cc-tour { background: var(--glass-3-bg); -webkit-backdrop-filter: var(--glass-3-blur); backdrop-filter: var(--glass-3-blur); }\n}\n.cc-tour-schritt { font-size: var(--fs-meta); font-weight: var(--fw-semi); letter-spacing: .055em; text-transform: uppercase; color: var(--cc-marke-akzent); }\n.cc-tour-titel { font-size: var(--fs-h3); font-weight: var(--fw-semi); color: var(--text-primary); letter-spacing: -0.01em; }\n.cc-tour-text { margin: 0; font-size: var(--fs-body); line-height: 1.5; color: var(--text-secondary); }\n.cc-tour-knoepfe { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }\n.cc-tour-weiter { margin-left: auto; }\n.cc-tour-ziel { outline: 3px solid var(--brand-500); outline-offset: 3px; border-radius: var(--radius-xs); }\n\n/* =================================================== Berichte / Audit ===== */\n.cc-ber { max-width: var(--cc-inhalt-max); margin: 0 auto; }\n.cc-ber .cc-dash-briefing { margin-bottom: var(--space-8); }\n.cc-ber-liste, .cc-audit-liste {\n  display: flex;\n  flex-direction: column;\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n  overflow: hidden;\n}\n.cc-ber-zeile, .cc-audit-zeile, .cc-ber-tabkopf {\n  display: grid;\n  grid-template-columns: 96px minmax(0, 1fr) 88px;\n  align-items: center;\n  gap: var(--space-4);\n  padding: var(--space-3) var(--space-5);\n  border-top: 1px solid var(--border-subtle);\n  background: transparent;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-audit-zeile, .cc-audit-tabkopf { grid-template-columns: 128px minmax(0, 1fr) 88px; }\n.cc-ber-tabkopf {\n  border-top: 0;\n  background: var(--glass-1-solid);\n  border-bottom: 1px solid var(--border-subtle);\n  min-height: 36px;\n  padding-top: var(--space-2); padding-bottom: var(--space-2);\n  font-size: var(--fs-meta); font-weight: var(--fw-semi);\n  letter-spacing: .055em; text-transform: uppercase; color: var(--text-muted);\n}\n.cc-ber-tabkopf > div:last-child { justify-self: end; }\n.cc-ber-zeile > .cc-ampel, .cc-audit-zeile > .cc-ampel { justify-self: end; }\n.cc-ber-liste > .cc-ber-zeile:first-of-type, .cc-audit-liste > .cc-audit-zeile:first-of-type { border-top: 0; }\n.cc-ber-zeile:hover, .cc-audit-zeile:hover { background: var(--surface-subtle); }\n.cc-ber-datum { font-size: var(--fs-klein); color: var(--text-muted); font-variant-numeric: tabular-nums; }\n.cc-ber-tabkopf .cc-ber-datum, .cc-ber-tabkopf .cc-audit-zeit, .cc-ber-tabkopf .cc-ber-mitte, .cc-ber-tabkopf .cc-audit-mitte { font: inherit; color: inherit; letter-spacing: inherit; }\n.cc-ber-mitte, .cc-audit-mitte { min-width: 0; }\n@media (max-width: 639.98px) {\n  .cc-ber-zeile, .cc-ber-tabkopf { grid-template-columns: 88px minmax(0, 1fr) auto; }\n  .cc-audit-zeile, .cc-audit-tabkopf { grid-template-columns: 88px minmax(0, 1fr) auto; }\n}\n.cc-ber-firma { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); overflow-wrap: anywhere; }\n.cc-ber-meta { margin-top: var(--space-1); font-size: var(--fs-meta); color: var(--text-muted); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }\n.cc-audit-zeit { font-size: var(--fs-klein); color: var(--text-muted); font-variant-numeric: tabular-nums; }\n.cc-audit-aktion { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); }\n.cc-audit-firma { margin-top: var(--space-1); font-size: var(--fs-klein); color: var(--text-secondary); overflow-wrap: anywhere; }\n.cc-audit-meta { margin-top: var(--space-1); font-size: var(--fs-meta); color: var(--text-muted); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }\n\n/* ========================================================= Monitoring ===== */\n.cc-mon { max-width: var(--cc-inhalt-max); margin: 0 auto; }\n.cc-mon .cc-dash-briefing { margin-bottom: var(--space-8); }\n.cc-mon-liste {\n  display: flex;\n  flex-direction: column;\n  border-radius: var(--radius-lg);\n  background: var(--surface-raised);\n  border: 1px solid var(--border-subtle);\n  box-shadow: var(--shadow-1);\n  overflow: hidden;\n}\n.cc-mon-zeile {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: var(--space-4);\n  width: 100%;\n  min-height: 60px;\n  padding: var(--space-3) var(--space-5);\n  border: 0;\n  border-top: 1px solid var(--border-subtle);\n  background: transparent;\n  font-family: var(--cc-font);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-mon-liste > .cc-mon-zeile:first-child { border-top: 0; }\n.cc-mon-zeile:hover { background: var(--surface-subtle); }\n.cc-mon-zeile:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: -2px; }\n.cc-mon-links { min-width: 0; display: flex; flex-direction: column; gap: var(--space-1); }\n.cc-mon-name { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); overflow-wrap: anywhere; }\n.cc-mon-meta { font-size: var(--fs-klein); color: var(--text-muted); display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; font-variant-numeric: tabular-nums; }\n.cc-mon-meta > * + *::before { content: \"· \"; color: var(--cc-trenner); }\n.cc-mon-frist { color: var(--text-muted); }\n.cc-mon-frist.cc-frist-ueberfaellig { color: var(--urgent-strong); font-weight: var(--fw-semi); }\n.cc-mon-frist.cc-frist-faellig { color: var(--pending-strong); font-weight: var(--fw-semi); }\n\n/* ======================================================= Einstellungen ==== */\n/* P7: Einstellungen nutzen die volle Inhaltsbreite; der Umbruch richtet sich nach\n   der TATSAECHLICHEN Containerbreite (Leiste schmal/breit), nicht dem Viewport. */\n.cc-set { max-width: var(--cc-inhalt-max); margin: 0 auto; container-type: inline-size; }\n.cc-set-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: var(--space-8); align-items: start; margin-top: var(--space-6); }\n.cc-set-liste { display: flex; flex-direction: column; gap: var(--space-1); position: sticky; top: var(--space-4); }\n/* Fallback fuer Browser ohne Container-Queries (Viewport-Naeherung) */\n@media (max-width: 760px) { .cc-set-body { grid-template-columns: 1fr; gap: var(--space-4); } }\n@media (max-width: 760px) { .cc-set-liste { position: static; flex-direction: row; flex-wrap: wrap; } .cc-set-liste .cc-set-tab { width: auto; } }\n@container (max-width: 719.98px) {\n  .cc-set-body { grid-template-columns: 1fr; gap: var(--space-4); }\n  .cc-set-liste { position: static; flex-direction: row; flex-wrap: wrap; }\n  .cc-set-liste .cc-set-tab { width: auto; }\n}\n@container (max-width: 479.98px) {\n  .cc-set-zeile { flex-direction: column; align-items: flex-start; gap: var(--space-1); }\n  .cc-set-zeile-wert { text-align: left; }\n}\n.cc-set-tab {\n  display: flex;\n  align-items: center;\n  width: 100%;\n  min-height: 40px;\n  padding: var(--space-2) var(--space-3);\n  border: 0;\n  border-radius: var(--radius-sm);\n  background: transparent;\n  color: var(--text-secondary);\n  font-family: var(--cc-font);\n  font-size: var(--fs-body);\n  font-weight: var(--fw-medium);\n  text-align: left;\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out), color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-set-tab:hover { background: var(--cc-hover); color: var(--text-primary); }\n.cc-set-tab[aria-current=\"page\"] { background: var(--cc-marke-weich); color: var(--cc-marke-akzent-stark); font-weight: var(--fw-semi); }\n.cc-set-tab:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n.cc-set-inhalt { min-width: 0; display: flex; flex-direction: column; gap: var(--space-4); }\n.cc-set-abschnitt {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-3);\n  padding: var(--space-6);\n  border-radius: var(--radius-lg);\n  background: var(--glass-2-bg);\n  border: 1px solid var(--glass-2-border);\n  box-shadow: var(--glass-2-shadow);\n}\n.cc-set-titel { margin: 0; font-size: var(--fs-titel); font-weight: var(--fw-semi); letter-spacing: -0.01em; color: var(--text-primary); }\n.cc-set-text { margin: 0; font-size: var(--fs-klein); line-height: 1.55; color: var(--text-secondary); }\n.cc-set-zeile { display: flex; justify-content: space-between; gap: var(--space-4); padding: var(--space-3) 0; border-top: 1px solid var(--border-subtle); }\n.cc-set-zeile:first-of-type { border-top: 0; }\n.cc-set-zeile-label { font-size: var(--fs-body); color: var(--text-muted); }\n.cc-set-zeile-wert { font-size: var(--fs-body); font-weight: var(--fw-semi); color: var(--text-primary); min-width: 0; text-align: right; font-variant-numeric: tabular-nums; }\n.cc-set-abschnitt .cc-knopf { align-self: flex-start; margin-top: var(--space-1); }\n\n/* D10: Darstellung – segmentierte Knopfgruppe (Hell/Dunkel/System) */\n.cc-theme-seg {\n  display: inline-flex;\n  gap: var(--space-1);\n  padding: var(--space-1);\n  border-radius: var(--radius-sm);\n  background: var(--surface-subtle);\n  border: 1px solid var(--border-subtle);\n}\n.cc-theme-knopf {\n  min-height: 30px;\n  padding: 0 var(--space-3);\n  border: 0;\n  border-radius: var(--radius-xs);\n  background: transparent;\n  color: var(--text-secondary);\n  font-family: var(--cc-font);\n  font-size: var(--fs-klein);\n  font-weight: var(--fw-medium);\n  cursor: pointer;\n  transition: background-color var(--cc-dauer-kurz) var(--cc-ease-out), color var(--cc-dauer-kurz) var(--cc-ease-out);\n}\n.cc-theme-knopf:hover { color: var(--text-primary); }\n.cc-theme-an {\n  background: var(--surface-raised);\n  color: var(--text-primary);\n  box-shadow: var(--shadow-1);\n  font-weight: var(--fw-semi);\n}\n.cc-theme-knopf:focus-visible { outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe); outline-offset: var(--cc-fokus-abstand); }\n\n/* ====================================== Legacy-Ansichten scoped umstylen === */\n/* Nur wenn die Shell aktiv ist – die Legacy-HTML/JS bleiben byte-gleich. */\nbody.cc-shell-an .help-btn,\nbody.cc-shell-an .help-pop,\nbody.cc-shell-an .tr-toast,\nbody.cc-shell-an .chat-backdrop,\nbody.cc-shell-an .lang-btn { display: none !important; }\n\n/* Legacy „Neue Prüfung\" (#mainView), Historie (#historyView), Akte (#akteView),\n   Team (#teamView) erben die neue Typo, wenn die verbundene App-Ansicht sichtbar ist.\n   D6: defensives, gescopetes Angleichen NUR an Material/Typografie (keine Layout-Maße,\n   kein display/padding), damit nichts bricht. ACHTUNG: #mainView ist in der Vorschau\n   gesperrt und konnte offline NICHT visuell geprüft werden – finale Abstimmung braucht\n   einen echten Test-Login (siehe FEHLENDE-ZUGAENGE / D-DESIGN.md). */\nbody.cc-shell-an #mainView, body.cc-shell-an #historyView,\nbody.cc-shell-an #akteView, body.cc-shell-an #teamView { font-family: var(--cc-font); }\nbody.cc-shell-an #mainView .field-label {\n  font-weight: var(--fw-semi); color: var(--text-secondary); letter-spacing: -0.005em;\n}\nbody.cc-shell-an #mainView input:focus-visible,\nbody.cc-shell-an #mainView select:focus-visible,\nbody.cc-shell-an #mainView textarea:focus-visible {\n  outline: var(--cc-fokus-breite) solid var(--cc-fokus-farbe);\n  outline-offset: var(--cc-fokus-abstand);\n}\nbody.cc-shell-an #mainView .btn-action.primary,\nbody.cc-shell-an #mainView .btn-search {\n  border-radius: var(--radius-sm);\n  font-weight: var(--fw-semi);\n}\n\n/* ================================= P8: Legacy-Ladephase beruhigen =========== */\n/* Waehrend die App laedt (.loading.active aus der Legacy-App), lenken der\n   schwebende Sprach-Knopf und die Chat-Blase nur ab; die Shell ist noch nicht\n   sichtbar (kein body.cc-shell-an). Ausblenden + Ladekarte an die Shell-Typo\n   angleichen – OHNE Legacy-Dateien anzufassen. */\nbody.cc-shell-da:has(.loading.active) .lang-btn,\nbody.cc-shell-da:has(.loading.active) .help-btn,\nbody.cc-shell-da:has(.loading.active) .help-pop { display: none !important; }\nbody.cc-shell-da .loading, body.cc-shell-da .history-loading { font-family: var(--cc-font); }\n\n/* ====================================== Vorschau (nur test) – z-index-Hub == */\n/* Hebt Leiste/Inhalt/Balken/Backdrop ueber das Login-Gate (9999), unter die\n   App-Modals (10001+)/Banner (99999). Reihenfolge Leiste>Backdrop>Inhalt kommt\n   aus der DOM-Reihenfolge (shell.js), nicht aus hoeheren Zahlen. */\nbody.cc-shell-vorschau { --cc-z-vorschau: 10000; }\nbody.cc-shell-vorschau .cc-shell { z-index: var(--cc-z-vorschau); }\nbody.cc-shell-vorschau .cc-shell-modul-wrap { z-index: var(--cc-z-vorschau); }\nbody.cc-shell-vorschau .cc-shell-balken { z-index: var(--cc-z-vorschau); }\nbody.cc-shell-vorschau .cc-shell-backdrop { z-index: var(--cc-z-vorschau); }\n\n/* P2: Die Landingseite liegt in der Vorschau komplett unter der Shell und schien\n   an transparenten Stellen durch (Banner-Streifen, Glas-Leisten im Dunkeln).\n   Unsichtbar schalten – programmatische .click()-Ziele funktionieren weiter. */\nbody.cc-shell-vorschau #landingGate { visibility: hidden; }\n\n/* ===================================== D10 Dark – Legacy-Leak-Korrekturen === */\n/* Die Legacy-App stylt `input[type=text]` (Spezifität 0,1,1) global hell (#FCFEFD).\n   Das überschrieb schon immer die Shell-Eingabefelder (.cc-xxx = 0,1,0) – im Hellen\n   unsichtbar (≈ Weiß), im Dunkeln grell. NUR im Dark Mode mit höherer Spezifität\n   (0,2,0) auf die dunkle Fläche zwingen; Hell bleibt dadurch unverändert. */\n[data-cc-theme=\"dark\"] .cc-such-feld,\n[data-cc-theme=\"dark\"] .cc-ki-input {\n  background: var(--surface-raised);\n  color: var(--text-primary);\n  border-color: var(--border-subtle);\n}\n[data-cc-theme=\"dark\"] .cc-such-feld::placeholder,\n[data-cc-theme=\"dark\"] .cc-ki-input::placeholder { color: var(--text-muted); }\n[data-cc-theme=\"dark\"] .cc-kpalette-input { background: transparent; color: var(--text-primary); }\n[data-cc-theme=\"dark\"] .cc-kpalette-input::placeholder { color: var(--text-muted); }\n\n/* (B3: Die frueheren Dark-Overrides fuer Topbar/Balken sind entfallen – beide\n   Flaechen beziehen ihr Glas jetzt komplett aus den --glass-1-Tokens, die der\n   Dark-Satz in estate-tokens.css ueberschreibt.) */\n\n/* ===================================== Reduzierte Bewegung / Transparenz === */\n@media (prefers-reduced-motion: reduce) {\n  .cc-nav-eintrag, .cc-knopf, .cc-shell, .cc-dash-karte, .cc-kpalette, .cc-kbackdrop,\n  .cc-toast, .cc-partner-zeile, .cc-mon-zeile, .cc-dash-bedarf-zeile, .cc-shell-collapse svg,\n  body.cc-shell-an, .cc-such-feld, .cc-ki-input, .cc-chip, .cc-nav-label, .cc-konto-text,\n  .cc-leiste-suche, .cc-shell-modul-wrap, .cc-shell-backdrop { transition: none !important; }\n  /* B4: alle Ein-/Aus-Animationen + Listen-Stagger aus (nur Zustand, keine Bewegung). */\n  .cc-anim-ein, .cc-anim-ein-kurz, .cc-anim-ein-pop, .cc-anim-ein-lang, .cc-anim-aus,\n  .cc-partner-zeile, .cc-dash-bedarf-zeile, .cc-mon-zeile, .cc-ber-zeile, .cc-audit-zeile {\n    animation: none !important;\n  }\n}\n@media (prefers-reduced-transparency: reduce) {\n  .cc-glass-1 { background: var(--glass-1-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n  .cc-glass-2 { background: var(--glass-2-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n  .cc-glass-3 { background: var(--glass-3-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n  .cc-shell { background: var(--glass-1-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n  .cc-topbar { background: var(--glass-1-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n  .cc-shell-balken { background: var(--glass-1-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n  .cc-kpalette, .cc-tour { background: var(--glass-3-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n  .cc-kbackdrop { background: var(--cc-scrim-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }\n}\n";
  var VORSCHAU = (typeof window !== 'undefined' && !!window.location && window.location.search.indexOf('vorschau=shell') >= 0);
  var VORSCHAU_DATEN = [{"id":"vs1","pruef_id":"VS-1003","firmenname":"Nordlicht Handels GmbH (Fantasie)","land":"DE","ust_id":"DE900000001","score":84,"verdict":"ok","created_at":"2026-11-17T10:12:00Z","report_json":{"_email":"kontakt@nordlicht.example.invalid"}},{"id":"vs2","pruef_id":"VS-1002","firmenname":"Nordlicht Handels GmbH (Fantasie)","land":"DE","ust_id":"DE900000001","score":67,"verdict":"warn","created_at":"2026-08-04T10:12:00Z","report_json":{"_email":"kontakt@nordlicht.example.invalid"}},{"id":"vs3","pruef_id":"VS-1001","firmenname":"Alpenquell Mineral AG (Fantasie)","land":"AT","ust_id":"ATU90000001","score":52,"verdict":"warn","created_at":"2026-11-09T09:30:00Z","report_json":{"_email":"info@alpenquell.example.invalid"}},{"id":"vs4","pruef_id":"VS-1000","firmenname":"Mistral Trading Ltd (Fantasie)","land":"FR","ust_id":null,"score":38,"verdict":"bad","created_at":"2026-10-21T14:05:00Z","report_json":{"_email":"bonjour@mistral.example.invalid"}}];

  // Doppel-Init vermeiden (Script versehentlich zweimal geladen).
  if (document.getElementById('ccShell')) return;

  // ==========================================================================
  // D10 Theme (Hell/Dunkel/System). Wird so frueh wie moeglich angewandt (VOR dem
  // ersten Paint -> kein Aufblitzen): data-cc-theme auf <html>. Speicherung in
  // localStorage (Schluessel 'cc-shell-theme': 'hell'|'dunkel'|'system').
  // HELL-Lauf 21.11. (Julius 23:18 Punkt 1): OHNE gespeicherte Wahl ist der
  // Standard IMMER 'hell' – unabhaengig vom Betriebssystem. 'system' greift nur,
  // wenn der Nutzer es in den Einstellungen ausdruecklich waehlt.
  // themaAufgeloest ist REIN (von Tests per Regex aus dem Bundle gezogen + geprueft).
  // ==========================================================================
  var THEME_KEY = 'cc-shell-theme';
  function themaGespeichert() {
    try {
      var v = window.localStorage.getItem(THEME_KEY);
      return (v === 'hell' || v === 'dunkel' || v === 'system') ? v : null;
    } catch (e) { return null; }
  }
  function systemDunkel() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
    catch (e) { return false; }
  }
  // REIN: wahl ('hell'|'dunkel'|'system'|null/ungueltig) + systemDunkel-Flag -> 'light'|'dark'.
  // Ohne (gueltige) Wahl: IMMER 'light' (Julius 21.11. Punkt 1) – das System-Flag
  // zaehlt nur bei ausdruecklich gewaehltem 'system'.
  function themaAufgeloest(wahl, istSystemDunkel) {
    var w = (wahl === 'hell' || wahl === 'dunkel' || wahl === 'system') ? wahl : 'hell';
    if (w === 'dunkel') return 'dark';
    if (w === 'system') return istSystemDunkel ? 'dark' : 'light';
    return 'light';
  }
  function themaAnwenden(wahl) {
    var modus = themaAufgeloest(wahl === undefined ? themaGespeichert() : wahl, systemDunkel());
    try {
      var root = document.documentElement;
      if (root && root.setAttribute) root.setAttribute('data-cc-theme', modus);
    } catch (e) {}
    return modus;
  }
  function themaSetzen(wahl) {
    try { window.localStorage.setItem(THEME_KEY, wahl); } catch (e) {}
    return themaAnwenden(wahl);
  }
  // SOFORT anwenden (noch vor baueShell/stilEinspielen) -> erstes Paint ist bereits korrekt.
  themaAnwenden();
  // Auf System-Wechsel reagieren NUR bei ausdruecklich gewaehltem 'system'
  // (ohne Wahl bleibt es hell, ein OS-Wechsel aendert nichts).
  try {
    var themaMq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (themaMq) {
      var themaSysWechsel = function () { if (themaGespeichert() === 'system') themaAnwenden(); };
      if (themaMq.addEventListener) themaMq.addEventListener('change', themaSysWechsel);
      else if (themaMq.addListener) themaMq.addListener(themaSysWechsel);
    }
  } catch (e) {}

  // ==========================================================================
  // B3 Leisten-Zustand (offen/schmal). Wie das Theme eine reine UI-Einstellung im
  // localStorage (Schluessel 'cc-shell-leiste': 'breit'|'schmal') – KEINE App-Daten.
  // Ohne gespeicherte Wahl entscheidet weiter die Tablet-Rail-Logik (768–1023 schmal).
  // ==========================================================================
  var LEISTE_KEY = 'cc-shell-leiste';
  function leisteGespeichert() {
    try {
      var v = window.localStorage.getItem(LEISTE_KEY);   // nur UI-Zustand, Schluessel cc-shell-leiste
      return (v === 'breit' || v === 'schmal') ? v : null;
    } catch (e) { return null; }
  }
  function leisteSpeichern(wert) {
    try { window.localStorage.setItem(LEISTE_KEY, wert); } catch (e) {}   // cc-shell-leiste (UI)
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';   // XML-Namensraum fuer createElementNS, KEINE Netz-URL.

  // Konsistenter Icon-Satz (Lucide/Phosphor-nah, 1.5-px-Strich, 24er-Raster).
  // Jeder Eintrag ist ein 'd'-Attribut; icon() baut daraus ein <svg><path>.
  var ICON = {
    dashboard:     'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    partner:       'M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2 M2 13h20',
    pruefung:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 15l2 2 4-4',
    monitoring:    'M22 12h-4l-3 9L9 3l-3 9H2',
    ki:            'M12 3l1.8 4.6L18.5 9.4l-4.7 1.8L12 16l-1.8-4.8L5.5 9.4l4.7-1.8z M19 14.5v4 M17 16.5h4 M5 4v3 M3.5 5.5h3',
    berichte:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h6 M9 9H8',
    team:          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    einstellungen: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M2 14h4 M10 8h4 M18 16h4',
    schloss:       'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4',
    person:        'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    welt:          'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3a15 15 0 0 1 0 18 M12 3a15 15 0 0 0 0 18',
    menue:         'M3 6h18 M3 12h18 M3 18h18',
    logo:          'M12 3l7 2.8v5.2c0 4.3-2.9 7.3-7 8.6-4.1-1.3-7-4.3-7-8.6V5.8z M8.8 11.6l2.1 2.1 4.3-4.3',
    suche:         'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z M21 21l-5.2-5.2',
    pfeilLinks:    'M15 6l-6 6 6 6',
    pfeilRunter:   'M6 9l6 6 6-6',
    senden:        'M12 19V5 M5 12l7-7 7 7',
    haken:         'M5 13l4 4L19 7',
    design:        'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18'
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
  //                      Bereiche, Assistent oben). Daten nur lesend ueber brueckeZeilen(); klickt #historyBtn
  //                      NICHT und schreibt nie in den App-State.
  //   art 'ki'        -> S4a: von der Shell SELBST gerenderte Assistenz-Ansicht (dasselbe Feld wie oben im
  //                      Dashboard, als eigene Ansicht). Bedient die App ueber KI_AKTIONEN, schreibt nur
  //                      nach Bestaetigungskarte (Formular vorausfuellen), sonst nur lesen/navigieren.
  //   start:true      -> Startmodul (wird beim Erscheinen aktiv, ohne zu klicken). S3 (Zeus): Start = dashboard.
  var MODULE = [
    { id: 'dashboard', label: 'Dashboard', icon: ICON.dashboard, art: 'dashboard', start: true },
    { id: 'partner', label: 'Geschäftspartner', icon: ICON.partner, art: 'partner' },
    { id: 'pruefung', label: 'Neue Prüfung', icon: ICON.pruefung, art: 'verbunden',
      ziel: '.app header.header .logo-wrap', zielName: 'Neue Prüfung' },
    { id: 'monitoring', label: 'Monitoring', icon: ICON.monitoring, art: 'monitoring' },
    { id: 'ki', label: 'KI-Assistent', icon: ICON.ki, art: 'ki' },
    { id: 'berichte', label: 'Berichte & Audit', icon: ICON.berichte, art: 'berichte' },
    { id: 'team', label: 'Team', icon: ICON.team, art: 'verbunden',
      ziel: '#teamBtn', zielName: 'Team' },
    // S4c: einstellungen ist jetzt ein SHELL-GERENDERTES Pane „wie bei Claude" (Abschnitte links, Inhalt rechts);
    // Konto/Team/Sprache darin oeffnen die bestehenden Bedienelemente per .click() (#kontoBtn/#teamBtn/#langBtn).
    { id: 'einstellungen', label: 'Einstellungen', icon: ICON.einstellungen, art: 'einstellungen' }
  ];

  // S4c/B3: Navigation in Unterbereiche gruppiert (Linear-Stil). Die ids je Gruppe stehen in
  // MODULE-Reihenfolge, damit die Folge der data-cc-modul-Knoepfe stabil bleibt (Nav-Test S4c).
  // B3 (HELL-Lauf): Gruppen heissen Arbeiten/Werkzeuge/Organisation; das Modul FUSS_ID
  // (einstellungen) bleibt die Nutzerkarte unten im Fuss (Avatar + Konto, wie bei Claude).
  var NAV_GRUPPEN = [
    { titel: 'Arbeiten', ids: ['dashboard', 'partner', 'pruefung', 'monitoring'] },
    { titel: 'Werkzeuge', ids: ['ki', 'berichte'] },
    { titel: 'Organisation', ids: ['team'] }
  ];
  var FUSS_ID = 'einstellungen';

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
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (groesse) { svg.setAttribute('width', String(groesse)); svg.setAttribute('height', String(groesse)); }
    var p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', dPfad);
    svg.appendChild(p);
    return svg;
  }

  // ==========================================================================
  // B3 Logo: das ECHTE Compliance-Checker-Logo wiederverwenden (Julius Punkt 5).
  // Quelle ist das statische <img class="auth-logo"> der Legacy-App (Data-URI,
  // PNG 461x168: links das Bildzeichen/Flasche, rechts die Wortmarke) – dieselbe
  // Grafik, die auch die Landingseite kopiert. Die Shell liest nur das src-
  // Attribut (nur data:image/… wird akzeptiert, nie eine Netz-URL) und zeigt es
  // unveraendert: offen die volle Marke, eingeklappt ein sauberer 28x28-Ausschnitt
  // des Bildzeichens (CSS-Crop, kein Umfaerben, kein Verzerren). Fehlt die Quelle
  // (z. B. Mini-DOM der Tests), faellt die Marke auf die bisherige Icon-Kachel zurueck.
  // ==========================================================================
  function logoQuelle() {
    var img = document.querySelector('.auth-card .auth-logo');
    var src = img && img.getAttribute ? img.getAttribute('src') : null;
    return (src && src.indexOf('data:image/') === 0) ? src : null;
  }
  // Baut die Markenflaeche: echtes Logo (voll + Ausschnitt) oder Fallback-Kachel.
  // 'variante': 'leiste' (Seitenleiste) | 'balken' (mobiler Kopfbalken).
  function logoKnoten(variante) {
    var src = logoQuelle();
    var wrap = el('span', 'cc-logo' + (src ? ' cc-logo-echt' : ' cc-logo-ersatz') + ' cc-logo-' + variante);
    if (src) {
      var voll = el('img', 'cc-logo-voll');
      voll.setAttribute('src', src);
      voll.setAttribute('alt', 'Compliance Checker by Automati Labs');
      voll.setAttribute('decoding', 'async');
      wrap.appendChild(voll);
      var marke = el('span', 'cc-logo-marke');          // 28x28-Fenster, zeigt nur das Bildzeichen
      marke.setAttribute('aria-hidden', 'true');
      var ausschnitt = el('img', 'cc-logo-ausschnitt');
      ausschnitt.setAttribute('src', src);
      ausschnitt.setAttribute('alt', '');
      ausschnitt.setAttribute('decoding', 'async');
      marke.appendChild(ausschnitt);
      wrap.appendChild(marke);
    } else {
      var kachel = el('span', 'cc-shell-logo');
      kachel.appendChild(icon(ICON.logo, variante === 'balken' ? 17 : 20));
      wrap.appendChild(kachel);
    }
    return wrap;
  }

  // ==========================================================================
  // B4 Bewegungs-Helfer: JEDES sichtbare Erscheinen/Verschwinden laeuft weich
  // (Julius Punkt 7). einblenden() spielt eine Ein-Animation (CSS-Keyframes,
  // Klasse cc-anim-ein[-pop|-lang]); ausblenden() spielt die Aus-Animation und
  // loest ERST DANACH auf – nie mehr hartes remove()/display:none bei Sichtbarem.
  // Beide warten auf animationend MIT Sicherheits-Timeout (Dauer + 80ms, genau
  // eine Aufloesung); prefers-reduced-motion => Dauer 0, keine Bewegung.
  // Die Dauern spiegeln die Tokens --dur-2/--dur-3 (120/200/320).
  // ==========================================================================
  var ANIM_MS = { kurz: 120, fade: 200, pop: 200, lang: 320 };
  function motionReduziert() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  // Wartet auf animationend am Element ODER den Sicherheits-Timeout; genau EINE Aufloesung.
  function animWarte(elx, dauerMs) {
    return new Promise(function (fertig) {
      var erledigt = false;
      function schluss() {
        if (erledigt) return;
        erledigt = true;
        try { if (elx.removeEventListener) elx.removeEventListener('animationend', schluss); } catch (e) {}
        fertig(elx);
      }
      try { if (elx.addEventListener) elx.addEventListener('animationend', schluss); } catch (e) {}
      setTimeout(schluss, dauerMs + 80);
    });
  }
  function einblenden(elx, art) {
    if (!elx || !elx.classList) return Promise.resolve(elx);
    var a = ANIM_MS[art] ? art : 'fade';
    if (motionReduziert()) return Promise.resolve(elx);
    var klasse = 'cc-anim-ein' + (a === 'fade' ? '' : '-' + a);
    elx.classList.add(klasse);
    return animWarte(elx, ANIM_MS[a]).then(function () { elx.classList.remove(klasse); return elx; });
  }
  function ausblenden(elx, art) {
    if (!elx || !elx.classList) return Promise.resolve(elx);
    if (elx._ccAusP) return elx._ccAusP;          // laeuft schon -> dieselbe Zusage (kein Doppellauf)
    var a = ANIM_MS[art] ? art : 'fade';
    if (motionReduziert()) return Promise.resolve(elx);
    elx.classList.add('cc-anim-aus');
    elx._ccAusP = animWarte(elx, ANIM_MS[a]).then(function () {
      elx._ccAusP = null;
      elx.classList.remove('cc-anim-aus');
      return elx;
    });
    return elx._ccAusP;
  }
  function entfernen(elx) {
    if (elx && elx.parentNode) elx.parentNode.removeChild(elx);
    return elx;
  }
  // Aus-Animation + Abschluss-Schritt. Im echten Browser (rAF vorhanden) weich;
  // im Mini-DOM der Tests SOFORT (synchroner Vertrag der Alt-Tests bleibt exakt).
  function ausblendenDann(elx, art, dann) {
    if (typeof requestAnimationFrame !== 'function') { dann(elx); return; }
    ausblenden(elx, art).then(dann);
  }

  function stilEinspielen() {
    if (document.getElementById('ccShellStil')) return;
    var s = document.createElement('style');
    s.id = 'ccShellStil';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- Inhaltsflaeche (#ccShellModul): persistente Topbar + scrollender Innenbereich ----
  // Design-Umbau: #ccShellModul = [cc-topbar] + [cc-inhalt > cc-inhalt-innen]. zeigeInhalt/
  // versteckeInhalt tauschen NUR den Innenbereich (inhaltInnen); die Topbar bleibt stehen.
  // data-cc-sichtbar bleibt auf #ccShellModul (Tests pruefen das + suchen rekursiv nach dem Modul).
  var inhaltWrap = null;     // #ccShellModul
  var inhaltInnen = null;    // .cc-inhalt-innen (austauschbarer Modulinhalt)
  var inhaltScrollEl = null; // .cc-inhalt (Scrollport) – fuer Crossfade + Scroll-Reset
  var geistSchicht = null;   // .cc-inhalt-geist (Ebene fuer den ausblendenden Alt-Inhalt)
  var brotkrumeJetzt = null; // .cc-brotkrumen-jetzt (aktuelles Modul-Label in der Topbar)
  // B4 Seitenwechsel = Crossfade: der alte Inhalt wandert als „Geist" in eine eigene
  // Ebene und blendet weich aus (nie mehr hartes Verschwinden); der neue Inhalt steht
  // SOFORT im DOM (synchroner Vertrag fuer App + Tests) und blendet weich ein.
  // Geist nur, wenn der Scrollport oben steht (sonst zeigte er falschen Ausschnitt) –
  // beim Wechsel springt der Scrollport ohnehin an den Anfang der neuen Seite.
  function zeigeInhalt(knoten) {
    var ziel = inhaltInnen || inhaltWrap;
    var obenStand = !(inhaltScrollEl && inhaltScrollEl.scrollTop);
    // rAF-Faehigkeit = echter Browser; im Mini-DOM der Tests gibt es keinen Geist
    // (der synchrone Tausch-Vertrag bleibt dort exakt wie bisher).
    var echterBrowser = (typeof requestAnimationFrame === 'function');
    if (geistSchicht && ziel.firstChild && obenStand && echterBrowser && !motionReduziert()) {
      while (geistSchicht.firstChild) geistSchicht.removeChild(geistSchicht.firstChild);  // max. 1 Geist
      // BEWUSST ohne cc-inhalt-innen-Klasse: es darf immer nur EINE echte Inhalts-
      // Ebene geben (Locator/Tests), der Geist spiegelt die Masse per eigener Klasse.
      var geist = el('div', 'cc-inhalt-geist-inhalt');
      // inert: der ausblendende Alt-Inhalt darf weder Fokus noch Klicks fangen
      // (axe: aria-hidden-focus) – pointer-events none deckt nur die Maus ab.
      geist.setAttribute('inert', '');
      while (ziel.firstChild) geist.appendChild(ziel.removeChild(ziel.firstChild));
      geistSchicht.appendChild(geist);
      ausblenden(geist, 'fade').then(entfernen);
    } else {
      while (ziel.firstChild) ziel.removeChild(ziel.firstChild);
    }
    if (inhaltScrollEl) inhaltScrollEl.scrollTop = 0;
    ziel.appendChild(knoten);
    einblenden(knoten, 'fade');
    inhaltWrap.setAttribute('data-cc-sichtbar', '1');
  }
  function versteckeInhalt() {
    inhaltWrap.setAttribute('data-cc-sichtbar', '0');
    var ziel = inhaltInnen || inhaltWrap;
    while (ziel.firstChild) ziel.removeChild(ziel.firstChild);
    if (geistSchicht) { while (geistSchicht.firstChild) geistSchicht.removeChild(geistSchicht.firstChild); }
  }
  function setzeBrotkrume(text) {
    if (brotkrumeJetzt) brotkrumeJetzt.textContent = text || '';
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

  // P7: kompakter, bewusster Gesperrt-Zustand (kleine Karte statt riesiger Leerflaeche).
  function gesperrtKarte(mod) {
    var box = el('div', 'cc-leer cc-leer-kompakt');
    var kopfzeile = el('div', 'cc-leer-kopfzeile');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(ICON.schloss, 20));
    kopfzeile.appendChild(iconBox);
    kopfzeile.appendChild(el('h2', 'cc-leer-titel', mod.label));
    box.appendChild(kopfzeile);
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

  // P8 (NUR Vorschau/test): Zustands-Szenarien ueber die URL – zusaetzlich zu den festen
  // Fantasie-Daten. ?vorschau-daten=leer|viele|lang testet Leer-, Massen- (200 Partner)
  // und Langtext-Zustaende rein visuell. Im App-Modus und in live/leer-Builds laeuft
  // dieser Zweig nie (VORSCHAU=false bzw. VORSCHAU_DATEN=null). REIN + deterministisch.
  function vorschauSzenario(suche) {
    var m = /[?&]vorschau-daten=(leer|viele|lang)(&|$)/.exec(String(suche == null ? '' : suche));
    return m ? m[1] : 'normal';
  }
  function vorschauDatenFuer(szenario, basis) {
    if (szenario === 'leer') return [];
    var out = basis.slice();
    if (szenario === 'viele') {
      var laender = ['DE', 'AT', 'FR', 'IT', 'NL', 'ES'];
      for (var i = 0; i < 200; i++) {
        var score = (i * 37) % 101;
        var tag = ('0' + (1 + (i % 28))).slice(-2), monat = ('0' + (1 + (i % 12))).slice(-2);
        out.push({
          id: 'v' + i,
          pruef_id: 'VS-9' + ('00' + i).slice(-3),
          firmenname: 'Testpartner Nr. ' + (i + 1) + ' GmbH',
          land: laender[i % laender.length],
          ust_id: 'DE9' + ('00000000' + i).slice(-8),
          score: score,
          verdict: score >= 75 ? 'ok' : (score >= 50 ? 'warn' : 'bad'),
          created_at: '2026-' + monat + '-' + tag + 'T08:00:00Z',
          report_json: { _email: 'test' + i + '@beispiel.' + 'example' + '.invalid' }
        });
      }
    }
    if (szenario === 'lang') {
      var teil = 'Langnamen-Testfirmen-Kette-Nr1';   // 30 Zeichen, ohne Leerzeichen
      out.push({
        id: 'vlang',
        pruef_id: 'VS-9LANG-123456789-123456789',
        firmenname: teil + teil + teil + teil,        // 120 Zeichen am Stueck
        land: 'DE',
        ust_id: 'DE99999999999999999999999999',
        score: 61,
        verdict: 'warn',
        created_at: '2026-06-15T08:00:00Z',
        report_json: { _email: 'lang@beispiel.' + 'example' + '.invalid' }
      });
    }
    return out;
  }

  function brueckeZeilen() {
    // Vorschau nutzt NIE die Bruecke (Zeus): dort kommen die Fantasie-Daten (Block 6), sonst die Bruecke.
    if (VORSCHAU && typeof VORSCHAU_DATEN !== 'undefined' && Array.isArray(VORSCHAU_DATEN)) {
      var sz = vorschauSzenario(typeof window !== 'undefined' && window.location ? window.location.search : '');
      return sz === 'normal' ? VORSCHAU_DATEN : vorschauDatenFuer(sz, VORSCHAU_DATEN);
    }
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

  // S8 Saubere Pruef-ID: die Partner-Gruppe, die eine bestimmte Pruef-ID traegt (statt "neueste Zeile"-
  // Heuristik). Rein, testbar. Leere/unbekannte Pruef-ID -> null.
  function gruppeMitPruefId(zeilen, pruefId) {
    var pid = (pruefId == null) ? '' : String(pruefId).trim();
    if (!pid) return null;
    var gruppen = partnerGruppen(Array.isArray(zeilen) ? zeilen : []);
    for (var i = 0; i < gruppen.length; i++) {
      var zs = gruppen[i].zeilen;
      for (var j = 0; j < zs.length; j++) {
        if (zs[j] && zs[j].pruef_id != null && String(zs[j].pruef_id).trim() === pid) return gruppen[i];
      }
    }
    return null;
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

  // ==========================================================================
  // S5 Berichte & Audit – reine Funktion (kein DOM, kein Schreiben, kein Date.now()). Flache Audit-Liste:
  // JEDE Pruefung als eigener Eintrag (nicht nach Partner gruppiert), neueste zuerst, plus Kennzahlen.
  // ==========================================================================
  function berichteDaten(zeilen) {
    var rows = (Array.isArray(zeilen) ? zeilen : []).filter(function (z) { return !!z; });
    var eintraege = rows.map(function (z) {
      var score = (typeof z.score === 'number' && !isNaN(z.score)) ? z.score : null;
      return {
        firma: (z.firmenname != null && String(z.firmenname).trim()) ? String(z.firmenname) : null,
        land: (z.land != null && String(z.land).trim()) ? String(z.land) : null,
        score: score,
        klasse: ampelKlasse(score),
        pruefId: (z.pruef_id != null && String(z.pruef_id).trim()) ? String(z.pruef_id) : null,
        datum: zeitText(z.created_at),
        ms: Date.parse((z && z.created_at) || '') || 0
      };
    });
    eintraege.sort(function (a, b) { return b.ms - a.ms; });   // neueste zuerst
    var rot = 0, gelb = 0, ohneScore = 0;
    for (var i = 0; i < eintraege.length; i++) {
      var k = eintraege[i].klasse;
      if (k === 'urgent') rot++;
      else if (k === 'pending') gelb++;
      else if (k === 'grau') ohneScore++;
    }
    return { eintraege: eintraege, gesamt: eintraege.length, rotAnzahl: rot, gelbAnzahl: gelb, ohneScoreAnzahl: ohneScore };
  }

  // ==========================================================================
  // S8 Durchgaengiges Audit-Protokoll – reine Funktion (kein DOM, kein Schreiben, kein Date.now()). JEDE
  // Pruefung wird ein lueckenloser, zeitgestempelter, zuordenbarer Eintrag (wann / was / welcher Partner /
  // Ergebnis), neueste zuerst. "Wer" kommt aus einem echten Feld (z.geprueft_von / z.user_email), sobald die
  // App es liefert; sonst null (die Lese-Bruecke liefert nur die Historie des angemeldeten Kontos -> die View
  // zeigt dann "dieses Konto"). Forward-compatible: weitere Ereignistypen (z.typ) reihen sich ein; heute gibt
  // es nur Pruefungen.
  // ==========================================================================
  function zeitTextLang(iso) {   // dd.mm.yyyy, hh:mm (wie zeitText, zusaetzlich die Uhrzeit)
    if (!iso) return null;
    var tms = Date.parse(iso); if (isNaN(tms)) return null;
    var d = new Date(tms);
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear()
      + ', ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  }
  function auditProtokoll(zeilen) {
    var rows = (Array.isArray(zeilen) ? zeilen : []).filter(function (z) { return !!z; });
    var eintraege = rows.map(function (z) {
      var score = (typeof z.score === 'number' && !isNaN(z.score)) ? z.score : null;
      var akteur = (z.geprueft_von != null && String(z.geprueft_von).trim()) ? String(z.geprueft_von)
        : (z.user_email != null && String(z.user_email).trim()) ? String(z.user_email) : null;
      return {
        ms: Date.parse((z && z.created_at) || '') || 0,
        zeit: zeitTextLang(z.created_at),
        typ: (z.typ != null && String(z.typ).trim()) ? String(z.typ) : 'pruefung',
        aktion: 'Prüfung durchgeführt',
        firma: (z.firmenname != null && String(z.firmenname).trim()) ? String(z.firmenname) : null,
        land: (z.land != null && String(z.land).trim()) ? String(z.land) : null,
        pruefId: (z.pruef_id != null && String(z.pruef_id).trim()) ? String(z.pruef_id) : null,
        score: score, klasse: ampelKlasse(score), akteur: akteur
      };
    });
    eintraege.sort(function (a, b) { return b.ms - a.ms; });   // neueste zuerst, lueckenlos (jede Pruefung)
    return { eintraege: eintraege, gesamt: eintraege.length };
  }

  // ==========================================================================
  // S8 Fristen/Wiedervorlagen – reine Helfer (kein DOM, kein Date.now()). Die Pruefzeilen tragen kein
  // Fristdatum; die App nennt in v12.74 die Kadenz "alle drei Monate automatisch". Daraus leiten wir je
  // Partner eine Wiedervorlage ab (letzte Pruefung + Kadenz) und bestimmen den Status gegen ein INJIZIERTES
  // "heute" (heuteMs; nie Date.now() in der reinen Schicht). Reine Anzeige/Erinnerung – KEINE automatische
  // Pruefung, KEIN Limit/Preis/Credit (E7 = Julius). Ein echtes App-Feld (z.naechste_pruefung, ISO) gewinnt,
  // sobald vorhanden (forward-compatible).
  // ==========================================================================
  var WIEDERVORLAGE_MONATE = 3;   // spiegelt den Legacy-Text "alle drei Monate automatisch" (index v12.74); nur Anzeige.
  function fristMs(letztMs, naechsteIso) {
    if (naechsteIso != null && String(naechsteIso).trim()) {
      var t = Date.parse(String(naechsteIso)); if (!isNaN(t)) return t;
    }
    if (!letztMs) return null;
    var d = new Date(letztMs); d.setMonth(d.getMonth() + WIEDERVORLAGE_MONATE); return d.getTime();
  }
  function fristStatus(ms, heuteMs) {
    if (!ms || !heuteMs) return 'unbekannt';
    var tage = Math.floor((ms - heuteMs) / 86400000);
    if (tage < 0) return 'ueberfaellig';
    if (tage <= 14) return 'faellig';
    return 'geplant';
  }
  function datumMs(ms) {   // dd.mm.yyyy aus ms (wie zeitText, aber ab ms)
    if (!ms) return null;
    var d = new Date(ms);
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  // ==========================================================================
  // S7/S8 Monitoring – reine Funktion (kein DOM, kein Schreiben, kein Date.now()). Partner unter Beobachtung:
  // je Partner die neueste Ampel + letzte Pruefung; Handlungsbedarf (rot/gelb) zuerst (rot vor gelb, dann
  // neueste), danach der Rest nach letzter Pruefung. S8: je Partner eine Wiedervorlage/Frist (Datum + Status
  // gegen das injizierte heuteMs). Reihenfolge unveraendert (Handlungsbedarf zuerst) – die Frist ist Anzeige,
  // kein Rang.
  // ==========================================================================
  function monitoringDaten(zeilen, heuteMs) {
    var gruppen = partnerGruppen(Array.isArray(zeilen) ? zeilen : []);
    var partner = [];
    for (var i = 0; i < gruppen.length; i++) {
      var g = gruppen[i];
      var kl = ampelKlasse(g.letzterScore);
      var naechste = (g.zeilen && g.zeilen[0] && g.zeilen[0].naechste_pruefung) || null;   // forward-compatible
      var fMs = fristMs(g.letztMs, naechste);
      partner.push({ key: g.key, name: g.name, land: g.land, score: g.letzterScore, klasse: kl,
        letztePruefung: g.letztePruefung, letztMs: g.letztMs, bedarf: HANDLUNGSBEDARF_KLASSEN.indexOf(kl) >= 0,
        fristMs: fMs, fristText: datumMs(fMs), fristStatus: fristStatus(fMs, heuteMs) });
    }
    var rang = { urgent: 0, pending: 1, ok: 2, grau: 3 };
    partner.sort(function (a, b) {
      if (rang[a.klasse] !== rang[b.klasse]) return rang[a.klasse] - rang[b.klasse];
      return b.letztMs - a.letztMs;
    });
    var bedarfAnzahl = 0, ueberfaelligAnzahl = 0, faelligAnzahl = 0;
    for (var j = 0; j < partner.length; j++) {
      if (partner[j].bedarf) bedarfAnzahl++;
      if (partner[j].fristStatus === 'ueberfaellig') ueberfaelligAnzahl++;
      else if (partner[j].fristStatus === 'faellig') faelligAnzahl++;
    }
    return { partner: partner, beobachtet: partner.length, bedarfAnzahl: bedarfAnzahl,
      ueberfaelligAnzahl: ueberfaelligAnzahl, faelligAnzahl: faelligAnzahl };
  }

  // ==========================================================================
  // S4a KI-Assistent – REINE Schicht (kein DOM, kein Netz, keine echte KI).
  // kiVerstehe(text) deutet Deutsch (robust gegen Gross/Klein, Umlaute/ae, Satzzeichen)
  // in genau eine Aktion aus KI_AKTIONEN oder in eine ehrliche Antwort. Die Ausfuehrer
  // (KI_AKTIONEN[*].ausfuehren) sind vom DOM getrennt: sie arbeiten nur ueber die
  // injizierte 'umgebung' (daten/gruppen/navigiere/zeigeAkte/fuelleFormular/starteTour),
  // damit der Test sie rein pruefen kann. Zahlen kommen NUR aus dashboardDaten (ueber
  // umgebung.daten()), nie erfunden. 'schreiben'-Aktionen laufen NIE sofort – erst nach
  // einer Bestaetigungskarte (kiBestaetige), Abbrechen verwirft (kiAbbrechen).
  // ==========================================================================
  var KI_MAX_ZEICHEN = 500;   // Punkt 6: Eingabe max. 500 Zeichen.

  // Sprach-Normalisierung fuer das Erkennen (nur zum Matchen; der Original-Text bleibt fuer Namen erhalten).
  function kiNorm(text) {
    return String(text == null ? '' : text).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Bekannte Laendernamen (nur Sprachwortschatz fuers Parsen, KEINE Daten-Literale) – normalisiert (ae-Form).
  var KI_LAENDER = ['deutschland', 'oesterreich', 'frankreich', 'italien', 'spanien', 'schweiz',
    'niederlande', 'belgien', 'luxemburg', 'polen', 'portugal', 'daenemark', 'schweden', 'norwegen',
    'finnland', 'irland', 'tschechien', 'ungarn', 'griechenland', 'slowakei', 'slowenien', 'kroatien'];

  // Einen Firmennamen aus Nutzertext saeubern (fuehrender Artikel/Fuellwort, Satzzeichen, Schluss-Fuellwort weg).
  function kiNameSaeubern(s) {
    var t = String(s == null ? '' : s).replace(/["„“”'`.?!,:;()]+/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.replace(/^(die|der|das|den|dem|des|von|vom|für|fuer|firma)\s+/i, '');
    t = t.replace(/\s+(bitte|oeffnen|öffnen|anzeigen|zeigen|auf|jetzt|vor)$/i, '');
    return t.trim();
  }

  // Partnername aus „öffne Akte von X" / „Akte X" / „zeig X" ziehen (Original-Text, Gross/Klein bleibt).
  function kiPartnerName(roh) {
    var t = String(roh == null ? '' : roh).trim();
    var m = /akte\s+(?:von\s+|des\s+|der\s+|für\s+|fuer\s+)?(.+)$/i.exec(t);
    if (m) return kiNameSaeubern(m[1]);
    m = /partner\s+(?:von\s+)?(.+)$/i.exec(t);
    if (m) return kiNameSaeubern(m[1]);
    m = /(?:oeffne|öffne|zeige?|zeig mir)\s+(.+)$/i.exec(t);
    if (m) return kiNameSaeubern(m[1]);
    return '';
  }

  // Firma + (optional) Land aus „… vorbereiten für <Firma> in <Land>" ziehen.
  function kiFirmaLand(roh) {
    var t = String(roh == null ? '' : roh).trim();
    var rest = '';
    var m = /(?:für|fuer)\s+(.+)$/i.exec(t);
    if (m) rest = m[1];
    else { m = /(?:vorbereiten|vorbereite|vorzubereiten|ausfuellen|ausfüllen|vorausfuellen)\s+(.+)$/i.exec(t); if (m) rest = m[1]; }
    rest = rest.replace(/["„“”'`.?!,:;()]+/g, ' ').replace(/\s+/g, ' ').trim();
    rest = rest.replace(/\s+(vor|vorbereiten|vorbereite|bitte)$/i, '').trim();
    if (!rest) return { firma: '', land: null };
    var firma = rest, land = null;
    var mi = /^(.*\S)\s+(?:in|aus)\s+(\S.*)$/i.exec(rest);
    if (mi) { firma = mi[1].trim(); land = mi[2].trim(); }
    else {
      var worte = rest.split(' ');
      var letzte = worte[worte.length - 1];
      if (worte.length > 1 && KI_LAENDER.indexOf(kiNorm(letzte)) >= 0) {
        land = letzte; firma = worte.slice(0, -1).join(' ').trim();
      }
    }
    firma = firma.replace(/^(die|der|das|den|firma)\s+/i, '').trim();
    return { firma: firma, land: (land && land.trim()) ? land : null };
  }

  // S4b: Sprache aus dem (schon normalisierten) Text – 'en' bei englisch/english, sonst 'de' (Standard).
  function kiMailSprache(n) { return /\b(englisch|english)\b/.test(n) ? 'en' : 'de'; }
  // S4b: Ziel + Sprache aus „Entwurf/Anschreiben/Brief an <Firma> [auf Englisch]" ziehen. Rein, kein DOM.
  function kiMailZiel(roh) {
    var t = String(roh == null ? '' : roh).trim();
    var sprache = kiMailSprache(kiNorm(t));
    // „auf englisch/deutsch" entfernen, damit es nicht in den Namen rutscht.
    var ohneSprache = t.replace(/\b(auf\s+)?(englisch|english|deutsch|german)\b/ig, ' ').replace(/\s+/g, ' ').trim();
    var name = '';
    var m = /\ban\s+(.+)$/i.exec(ohneSprache);
    if (m) name = kiNameSaeubern(m[1]);
    else { m = /(?:für|fuer)\s+(.+)$/i.exec(ohneSprache); if (m) name = kiNameSaeubern(m[1]); }
    return { name: name, sprache: sprache };
  }

  // Passende Partner (nach Name) aus den gruppierten Zeilen. Normalisierter Teiltreffer; exakter Treffer
  // schlaegt Teiltreffer (verhindert unnoetige Mehrdeutigkeit). Gibt die Trefferliste (0/1/n) zurueck.
  function kiFindePartner(gruppen, name) {
    var q = kiNorm(name);
    if (!q) return [];
    var exakt = [], teil = [];
    for (var i = 0; i < (gruppen || []).length; i++) {
      var g = gruppen[i];
      var gn = kiNorm(g && g.name);
      if (!gn) continue;
      if (gn === q) exakt.push(g);
      else if (gn.indexOf(q) >= 0 || q.indexOf(gn) >= 0) teil.push(g);
    }
    return exakt.length ? exakt : teil;
  }

  // S4b: Mail-/Brief-Entwurf (rein, offline, KEINE Netz/KI). Baut aus den Brücken-Feldern eines Partners
  // (Name/Land/letzter Score) einen Klartext-Entwurf. Ton nach Score: < 75 oder ohne Score -> „Rückfragen/
  // Unterlagen offen", >= 75 -> „Bestätigung/unauffällig". Sprache 'de' (Standard) oder 'en'. Absender-/
  // Kontaktzeile ist PLATZHALTER (Julius legt fest). Rückgabe: ein mehrzeiliger String (nur textContent).
  function mailEntwurf(g, sprache) {
    var name = (g && g.name) ? String(g.name) : 'den Geschäftspartner';
    var land = (g && g.land) ? String(g.land) : null;
    var offen = !(g && typeof g.letzterScore === 'number' && g.letzterScore >= 75);
    var en = sprache === 'en';
    var zeilen = [];
    if (en) {
      zeilen.push('Subject: ' + (offen ? 'Follow-up on your compliance review' : 'Confirmation of your compliance review'));
      zeilen.push('');
      zeilen.push('Dear Sir or Madam,');
      zeilen.push('');
      if (offen) {
        zeilen.push('as part of our business relationship we have reviewed ' + name
          + (land ? ' (' + land + ')' : '') + ' for compliance purposes. A few points are still open.');
        zeilen.push('Please send us current documents (commercial register extract, beneficial owners, '
          + 'VAT-ID proof where applicable) so we can complete the review.');
      } else {
        zeilen.push('as part of our due-diligence obligations we have reviewed ' + name
          + (land ? ' (' + land + ')' : '') + '. The review did not reveal any findings.');
        zeilen.push('Thank you for the good cooperation.');
      }
      zeilen.push('');
      zeilen.push('Kind regards');
      zeilen.push('[Sender – PLATZHALTER, Julius legt fest]');
    } else {
      zeilen.push('Betreff: ' + (offen ? 'Rückfragen zu Ihrer Compliance-Prüfung' : 'Bestätigung Ihrer Compliance-Prüfung'));
      zeilen.push('');
      zeilen.push('Sehr geehrte Damen und Herren,');
      zeilen.push('');
      if (offen) {
        zeilen.push('im Rahmen unserer Geschäftsbeziehung haben wir ' + name
          + (land ? ' (' + land + ')' : '') + ' einer Compliance-Prüfung unterzogen. Dabei sind Punkte offen geblieben.');
        zeilen.push('Bitte lassen Sie uns hierzu aktuelle Unterlagen zukommen (Handelsregisterauszug, '
          + 'wirtschaftlich Berechtigte, ggf. USt-ID-Nachweis), damit wir die Prüfung abschließen können.');
      } else {
        zeilen.push('im Rahmen unserer Sorgfaltspflichten haben wir ' + name
          + (land ? ' (' + land + ')' : '') + ' geprüft. Die Prüfung ergab keine Auffälligkeiten.');
        zeilen.push('Wir danken für die gute Zusammenarbeit.');
      }
      zeilen.push('');
      zeilen.push('Mit freundlichen Grüßen');
      zeilen.push('[Absender – PLATZHALTER, Julius legt fest]');
    }
    return zeilen.join('\n');
  }

  // Ehrliche Antwort auf Unbekanntes: „Das kann ich noch nicht" + Liste, was geht (aus KI_AKTIONEN).
  function kiHilfeText() {
    var kann = [];
    for (var i = 0; i < KI_AKTIONEN.length; i++) kann.push('• ' + KI_AKTIONEN[i].beschreibung);
    return 'Das kann ich noch nicht. Das geht schon:\n' + kann.join('\n');
  }

  // Aktionsliste (benannte Konstante). Je Eintrag: id, art ('lesen'|'schreiben'), beschreibung, ausfuehren.
  // 'schreiben'-Eintraege haben zusaetzlich karte(parameter) (Klartext fuer die Bestaetigungskarte).
  var KI_AKTIONEN = [
    { id: 'dashboard', art: 'lesen', beschreibung: 'Zum Dashboard wechseln',
      ausfuehren: function (p, umg) { umg.navigiere('dashboard'); return { antwort: 'Ich öffne das Dashboard.' }; } },
    { id: 'partner-liste', art: 'lesen', beschreibung: 'Die Geschäftspartner öffnen',
      ausfuehren: function (p, umg) { umg.navigiere('partner'); return { antwort: 'Ich öffne die Geschäftspartner.' }; } },
    { id: 'partner-akte', art: 'lesen', beschreibung: 'Die Akte eines Partners öffnen (Name sagen)',
      ausfuehren: function (p, umg) {
        var treffer = kiFindePartner(umg.gruppen(), p && p.name);
        if (!treffer.length) {
          return { antwort: 'Einen Partner „' + (p && p.name) + '" kenne ich nicht. Nenn mir den genauen Firmennamen, '
            + 'oder frag „Wer braucht Handlungsbedarf?".' };
        }
        if (treffer.length > 1) {
          var namen = [];
          for (var i = 0; i < treffer.length; i++) namen.push(treffer[i].name || 'Unbenannt');
          return { antwort: 'Dazu passen mehrere Partner: ' + namen.join(', ') + '. Welchen meinst du genau?' };
        }
        umg.zeigeAkte(treffer[0].key);
        return { antwort: 'Ich öffne die Akte von ' + (treffer[0].name || 'diesem Partner') + '.' };
      } },
    { id: 'handlungsbedarf', art: 'lesen', beschreibung: 'Zeigen, wer Handlungsbedarf hat',
      ausfuehren: function (p, umg) {
        var d = umg.daten();
        if (!d.handlungsbedarf.length) return { antwort: 'Gerade braucht kein Partner Handlungsbedarf – alles im grünen Bereich.' };
        var namen = [];
        for (var i = 0; i < d.handlungsbedarf.length; i++) namen.push(d.handlungsbedarf[i].name || 'Unbenannt');
        return { antwort: (namen.length === 1 ? 'Ein Partner braucht' : namen.length + ' Partner brauchen')
          + ' Handlungsbedarf: ' + namen.join(', ') + '. (' + d.rotAnzahl + ' kritisch, ' + d.gelbAnzahl + ' zu prüfen.)' };
      } },
    { id: 'briefing', art: 'lesen', beschreibung: 'Das Tages-Briefing vorlesen',
      ausfuehren: function (p, umg) {
        var d = umg.daten();
        var satz = 'Tages-Briefing: ' + d.partnerAnzahl + ' Geschäftspartner, '
          + d.pruefAnzahl + (d.pruefAnzahl === 1 ? ' Prüfung, ' : ' Prüfungen, ')
          + d.rotAnzahl + ' kritisch (rot), ' + d.gelbAnzahl + ' zu prüfen (gelb).';
        if (d.letztePruefung && d.letztePruefung.firma) {
          satz += ' Letzte Prüfung: ' + d.letztePruefung.firma + (d.letztePruefung.datum ? ' am ' + d.letztePruefung.datum : '') + '.';
        }
        return { antwort: satz };
      } },
    { id: 'pruefung-neu', art: 'lesen', beschreibung: 'Die Maske „Neue Prüfung" öffnen',
      ausfuehren: function (p, umg) { umg.navigiere('pruefung'); return { antwort: 'Ich öffne „Neue Prüfung". Trag Firma und Land ein und klick selbst auf „Prüfen".' }; } },
    { id: 'tour', art: 'lesen', beschreibung: 'Eine geführte Tour durch die App starten',
      ausfuehren: function (p, umg) { umg.starteTour(); return { antwort: 'Ich starte die Tour. Mit „Weiter"/„Zurück" geht es durch, Esc beendet.' }; } },
    // S4b: Mail-/Brief-Entwurf an einen Partner (nur Text-Ausgabe, KEIN Senden, kein Schreiben in den App-State).
    { id: 'mail-entwurf', art: 'lesen', beschreibung: 'Ein Anschreiben an einen Partner entwerfen (Name sagen, optional „auf Englisch")',
      ausfuehren: function (p, umg) {
        var treffer = kiFindePartner(umg.gruppen(), p && p.name);
        if (!treffer.length) {
          return { antwort: 'Für einen Entwurf nenne mir den Firmennamen, z. B. „Entwurf an '
            + ((p && p.name) ? p.name : 'Muster GmbH') + '". Welchen Partner meinst du?' };
        }
        if (treffer.length > 1) {
          var namen = [];
          for (var i = 0; i < treffer.length; i++) namen.push(treffer[i].name || 'Unbenannt');
          return { antwort: 'Dazu passen mehrere Partner: ' + namen.join(', ') + '. Für welchen soll ich den Entwurf schreiben?' };
        }
        return { antwort: mailEntwurf(treffer[0], p && p.sprache) };
      } },
    // Einziger Schreib-Eintrag: fuellt NUR die Formularfelder (kein Absenden, kein Klick auf „Prüfen").
    { id: 'pruefung-vorbereiten', art: 'schreiben', beschreibung: 'Eine neue Prüfung vorbereiten (Formular vorausfüllen, ohne abzuschicken)',
      karte: function (p) {
        return { titel: 'Neue Prüfung vorbereiten?',
          zeilen: ['Firma: ' + (p && p.firma ? p.firma : '—'),
            'Land: ' + (p && p.land ? p.land : '(bleibt Deutschland)'),
            'Ich fülle nur die Felder aus. Es wird NICHTS abgeschickt – du klickst selbst auf „Prüfen".'] };
      },
      ausfuehren: function (p, umg) {
        umg.fuelleFormular(p && p.firma, p && p.land);
        return { antwort: 'Formular vorbereitet für ' + (p && p.firma ? p.firma : 'die Firma')
          + '. Bitte oben prüfen und selbst auf „Prüfen" klicken.' };
      } }
  ];

  function findeKiAktion(id) {
    for (var i = 0; i < KI_AKTIONEN.length; i++) if (KI_AKTIONEN[i].id === id) return KI_AKTIONEN[i];
    return null;
  }

  // Reiner Parser: Nutzertext -> { aktion, parameter, antwort }. aktion=null -> antwort traegt die ehrliche
  // Rueckmeldung (leer/zu lang/unbekannt/Rueckfrage). Reihenfolge wichtig: Schreib-Absicht VOR „neue Prüfung".
  function kiVerstehe(text) {
    var roh = String(text == null ? '' : text);
    if (!roh.trim()) return { aktion: null, parameter: null, antwort: 'Sag mir, was ich tun soll – zum Beispiel „Wer braucht Handlungsbedarf?" oder „Tour".' };
    if (roh.length > KI_MAX_ZEICHEN) return { aktion: null, parameter: null, antwort: 'Das ist zu lang (mehr als ' + KI_MAX_ZEICHEN + ' Zeichen). Bitte kürzer fragen.' };
    var n = kiNorm(roh);

    if (/\bvorbereit/.test(n) || /\bvorausfuell/.test(n) || (/\bfuelle?\b/.test(n) && /\baus\b/.test(n))) {
      var zu = kiFirmaLand(roh);
      if (!zu.firma) return { aktion: null, parameter: null, antwort: 'Für welche Firma soll ich die Prüfung vorbereiten? Zum Beispiel „Neue Prüfung vorbereiten für Muster GmbH in Deutschland".' };
      return { aktion: 'pruefung-vorbereiten', parameter: zu, antwort: null };
    }
    // S4b: Mail-/Brief-Entwurf. Erkennt „entwurf/anschreiben/brief/mail" oder „schreib/verfass/formulier … an …".
    // „briefing" bleibt unberuehrt (\bbrief\b trifft „briefing" nicht; die briefing-Weiche kommt ohnehin spaeter).
    if (/\b(entwurf|anschreiben)\b/.test(n) || /\bbrief\b/.test(n) || /\bmail\b/.test(n)
      || ((/\bschreib/.test(n) || /\bverfass/.test(n) || /\bformulier/.test(n)) && /\ban\b/.test(n))) {
      var ziel = kiMailZiel(roh);
      if (!ziel.name) return { aktion: null, parameter: null, antwort: 'An wen soll das Anschreiben gehen? Nenn mir den Firmennamen, z. B. „Entwurf an Nordlicht Handels GmbH" (optional „… auf Englisch").' };
      return { aktion: 'mail-entwurf', parameter: ziel, antwort: null };
    }
    if (/\bakte\b/.test(n) || (/\boeffne\b/.test(n) && /\bpartner\b/.test(n))) {
      var name = kiPartnerName(roh);
      if (!name) return { aktion: null, parameter: null, antwort: 'Welchen Partner soll ich öffnen? Nenn mir den Firmennamen, z. B. „Öffne die Akte von Muster GmbH".' };
      return { aktion: 'partner-akte', parameter: { name: name }, antwort: null };
    }
    if (/\bhandlungsbedarf\b/.test(n) || /\bwer braucht\b/.test(n) || /\bwer muss\b/.test(n)
      || (/\bkritisch\b/.test(n) && /\bwer\b/.test(n))) {
      return { aktion: 'handlungsbedarf', parameter: {}, antwort: null };
    }
    if (/\bbriefing\b/.test(n) || /\btagesbriefing\b/.test(n) || /\bzusammenfassung\b/.test(n)
      || (/\bueberblick\b/.test(n) && /\bheute\b/.test(n))) {
      return { aktion: 'briefing', parameter: {}, antwort: null };
    }
    if (/\bneue? pruefung\b/.test(n) || (/\bpruefung\b/.test(n) && /\b(oeffn|start|neu|maske)/.test(n))) {
      return { aktion: 'pruefung-neu', parameter: {}, antwort: null };
    }
    if (/\bgeschaeftspartner\b/.test(n) || /\bpartnerliste\b/.test(n)
      || (/\bpartner\b/.test(n) && /\b(liste|alle|zeig|oeffn)/.test(n))) {
      return { aktion: 'partner-liste', parameter: {}, antwort: null };
    }
    if (/\bdashboard\b/.test(n) || /\buebersicht\b/.test(n) || /\bstartseite\b/.test(n)) {
      return { aktion: 'dashboard', parameter: {}, antwort: null };
    }
    if (/\btour\b/.test(n) || /\bfuehrung\b/.test(n) || /\brundgang\b/.test(n) || /\brundfuehrung\b/.test(n)) {
      return { aktion: 'tour', parameter: {}, antwort: null };
    }
    return { aktion: null, parameter: null, antwort: kiHilfeText() };
  }

  // Controller (reine Zustands-Funktionen auf einem uebergebenen 'zustand' = { offeneKarte }). Der DOM-Teil
  // (Block 3) ruft diese und rendert nur. 'umgebung' kapselt alle Seiteneffekte.
  function kiFuehreAus(auftrag, umgebung) {
    var akt = findeKiAktion(auftrag.aktionId);
    if (!akt) return { art: 'antwort', antwort: 'Das kann ich noch nicht.' };
    var res = akt.ausfuehren(auftrag.parameter, umgebung) || {};
    return { art: 'antwort', antwort: res.antwort || 'Erledigt.' };
  }
  function kiAntwortAuf(zustand, text, umgebung) {
    var r = kiVerstehe(text);
    if (!r.aktion) return { art: 'antwort', antwort: r.antwort };
    var akt = findeKiAktion(r.aktion);
    if (!akt) return { art: 'antwort', antwort: kiHilfeText() };
    if (akt.art === 'schreiben') {        // schreiben NIE sofort – erst Bestaetigungskarte zeigen
      zustand.offeneKarte = { aktionId: r.aktion, parameter: r.parameter };
      return { art: 'karte', aktionId: r.aktion, karte: akt.karte(r.parameter) };
    }
    return kiFuehreAus({ aktionId: r.aktion, parameter: r.parameter }, umgebung);
  }
  function kiBestaetige(zustand, umgebung) {
    if (!zustand.offeneKarte) return { art: 'antwort', antwort: 'Es ist gerade nichts zu bestätigen.' };
    var auftrag = zustand.offeneKarte;
    zustand.offeneKarte = null;        // einmal: vor dem Ausfuehren leeren (Doppelklick fuehrt nicht zweimal aus)
    return kiFuehreAus(auftrag, umgebung);
  }
  function kiAbbrechen(zustand, umgebung) {   // umgebung nur fuer Symmetrie/Mutanten-Gegenprobe; echt ungenutzt
    if (!zustand.offeneKarte) return { art: 'antwort', antwort: 'Es ist gerade nichts offen.' };
    zustand.offeneKarte = null;        // abbrechen: Karte verwerfen, nie ausfuehren
    return { art: 'antwort', antwort: 'Abgebrochen, nichts geändert.' };
  }

  // B5 Avatar: Assistent = CC-Bildzeichen (echtes Logo, Ausschnitt wie B3) auf hellem
  // Markengruen-Verlauf mit Glas-Ring; Nutzer = neutrales Person-Symbol (es gibt keinen
  // Nutzernamen im Shell-State – Initialen waeren erfunden). gross=true fuer Kopf/Leerzustand.
  function kiAvatar(wer, gross) {
    var a = el('span', 'cc-chat-avatar cc-chat-avatar-' + (wer === 'nutzer' ? 'nutzer' : 'assistent') + (gross ? ' cc-chat-avatar-gross' : ''));
    a.setAttribute('aria-hidden', 'true');
    if (wer === 'nutzer') { a.appendChild(icon(ICON.person, 16)); return a; }
    var src = logoQuelle();
    if (src) {
      var fenster = el('span', 'cc-chat-avatar-fenster');
      var bild = el('img', 'cc-chat-avatar-bild');
      bild.setAttribute('src', src);
      bild.setAttribute('alt', '');
      bild.setAttribute('decoding', 'async');
      fenster.appendChild(bild);
      a.appendChild(fenster);
    } else {
      a.appendChild(icon(ICON.logo, gross ? 26 : 16));
    }
    return a;
  }
  function kiUhrzeit() {
    var d = new Date();
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  }

  // Eine Chat-Zeile (Nutzer oder Assistent). Nutzer-/Antworttext IMMER nur als textContent – nie innerHTML
  // (XSS-sicher; der Build-Selbstcheck verbietet innerHTML ohnehin). \n rendert ueber white-space:pre-wrap (CSS).
  // B5: Assistent links MIT Avatar und ohne harte Box; Nutzer rechts als weiche Bubble;
  // Zeitstempel dezent (sichtbar bei Hover, CSS).
  function kiNachrichtKnoten(wer, kiText) {
    var istNutzer = (wer === 'nutzer');
    var box = el('div', 'cc-ki-msg cc-ki-msg-' + (istNutzer ? 'nutzer' : 'assistent'));
    if (!istNutzer) box.appendChild(kiAvatar('assistent'));
    var koerper = el('div', 'cc-chat-koerper');
    var blase = el('div', 'cc-ki-blase');
    blase.textContent = String(kiText == null ? '' : kiText);
    koerper.appendChild(blase);
    koerper.appendChild(el('span', 'cc-chat-zeit', kiUhrzeit()));
    box.appendChild(koerper);
    if (istNutzer) box.appendChild(kiAvatar('nutzer'));
    return box;
  }

  // B5 Schreib-Indikator (drei Punkte). Nur im echten Browser zwischengeschaltet –
  // die Logik bleibt synchron, nur das RENDERN der Antwort atmet kurz (wie ein Chat).
  function kiTipptKnoten() {
    var box = el('div', 'cc-ki-msg cc-ki-msg-assistent cc-chat-tippt-zeile');
    box.setAttribute('aria-hidden', 'true');
    box.appendChild(kiAvatar('assistent'));
    var punkte = el('div', 'cc-chat-tippt');
    punkte.appendChild(el('span', 'cc-chat-punkt'));
    punkte.appendChild(el('span', 'cc-chat-punkt'));
    punkte.appendChild(el('span', 'cc-chat-punkt'));
    box.appendChild(punkte);
    return box;
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

  // (nutzt denselben kompakten Stil wie gesperrtKarte)
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

  // ---- Eine Partner-Zeile als Tabellenzeile (Knopf -> Akte). P4: echte Spalten
  // (Name | Land | Pruefungen | Zuletzt | Score); unter 640px traegt .cc-pt-mobilmeta
  // dieselben Angaben als Zeile unter dem Namen (Spaltenzellen dann per CSS aus). ----
  function partnerZeile(g) {
    var btn = el('button', 'cc-partner-zeile');
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-cc-such', ((g.name || '') + ' ' + (g.land || '') + ' ' + (g.ust || '')).toLowerCase());
    btn.setAttribute('data-cc-ampel-kl', ampelKlasse(g.letzterScore));
    var zelleName = el('div', 'cc-pt-name');
    var nameEl = el('div', 'cc-pt-name-text');
    if (g.name) nameEl.textContent = g.name; else nameEl.appendChild(platzhalter());
    zelleName.appendChild(nameEl);
    var mobil = el('div', 'cc-pt-mobilmeta');
    mobil.appendChild(el('span', null, (g.land || '—') + ' · ' + g.zeilen.length + (g.zeilen.length === 1 ? ' Prüfung' : ' Prüfungen')
      + (g.letztePruefung ? ' · zuletzt ' + g.letztePruefung : '')));
    zelleName.appendChild(mobil);
    btn.appendChild(zelleName);
    btn.appendChild(el('div', 'cc-pt-land', g.land || '—'));
    btn.appendChild(el('div', 'cc-pt-anzahl', String(g.zeilen.length)));
    btn.appendChild(el('div', 'cc-pt-datum', g.letztePruefung || '—'));
    var score = el('div', 'cc-pt-score');
    score.appendChild(ampelPille(g.letzterScore));
    btn.appendChild(score);
    btn.addEventListener('click', function () { zeigeInhalt(partnerAkteAnsicht(g.key)); });
    return btn;
  }

  // Tabellenkopf der Partner-Liste (reine Beschriftung, kein Knopf).
  function partnerTabKopf() {
    var kopf = el('div', 'cc-partner-tabkopf');
    kopf.setAttribute('aria-hidden', 'true');
    kopf.appendChild(el('div', 'cc-pt-name', 'Name'));
    kopf.appendChild(el('div', 'cc-pt-land', 'Land'));
    kopf.appendChild(el('div', 'cc-pt-anzahl', 'Prüfungen'));
    kopf.appendChild(el('div', 'cc-pt-datum', 'Zuletzt'));
    kopf.appendChild(el('div', 'cc-pt-score', 'Score'));
    return kopf;
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
    liste.appendChild(partnerTabKopf());
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
  // P4: Verlauf mit echter Skala (0-100), Schwellenlinien 50/75 (rot|gelb|gruen-Grenzen
  // der App) und Zeitachse. KEINE erfundenen Werte: nur die vorhandenen Pruefungen.
  function scoreVerlauf(zeilenNeuZuAlt) {
    var box = el('div', 'cc-verlauf');
    var reihe = zeilenNeuZuAlt.slice().reverse();
    if (!reihe.length) { box.appendChild(platzhalter('Noch kein Verlauf')); return box; }
    var n = reihe.length, bw = 28, gap = 48, h = 170, padT = 18, padB = 26, padL = 34, padR = 24;
    var plotB = n * bw + (n - 1) * gap;
    var breite = padL + plotB + padR;
    var nutzH = h - padT - padB;
    var svg = svgEl('svg');
    svg.setAttribute('class', 'cc-verlauf-svg');
    svg.setAttribute('viewBox', '0 0 ' + Math.max(breite, 1) + ' ' + h);
    svg.setAttribute('width', String(Math.max(breite, 1)));
    svg.setAttribute('height', String(h));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Score-Verlauf der Prüfungen (Skala 0 bis 100, Schwellen 50 und 75)');
    // Skala: Gitterlinien + Beschriftung bei 0/50/75/100 (50/75 = Ampelgrenzen).
    var stufen = [0, 50, 75, 100];
    for (var si = 0; si < stufen.length; si++) {
      var sw = stufen[si];
      var sy = padT + nutzH - Math.round(nutzH * sw / 100);
      var linie = svgEl('line');
      linie.setAttribute('class', sw === 0 ? 'cc-verlauf-achse' : 'cc-verlauf-gitter');
      linie.setAttribute('x1', String(padL));
      linie.setAttribute('x2', String(padL + plotB));
      linie.setAttribute('y1', String(sy));
      linie.setAttribute('y2', String(sy));
      svg.appendChild(linie);
      var sl = svgEl('text');
      sl.setAttribute('class', 'cc-verlauf-skala');
      sl.setAttribute('x', String(padL - 8));
      sl.setAttribute('y', String(sy + 3));
      sl.setAttribute('text-anchor', 'end');
      sl.textContent = String(sw);
      svg.appendChild(sl);
    }
    for (var i = 0; i < n; i++) {
      var z = reihe[i];
      var score = (typeof z.score === 'number' && !isNaN(z.score)) ? z.score : null;
      var x = padL + i * (bw + gap);
      var pct = score != null ? Math.max(0, Math.min(100, score)) : 0;
      var barH = score != null ? Math.max(3, Math.round(nutzH * pct / 100)) : 3;
      var rect = svgEl('rect');
      rect.setAttribute('class', 'cc-verlauf-bar cc-ampel-' + ampelKlasse(score));
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(padT + (nutzH - barH)));
      rect.setAttribute('width', String(bw));
      rect.setAttribute('height', String(barH));
      rect.setAttribute('rx', '3');
      var dt = zeitText(z.created_at);
      var titel = svgEl('title');
      titel.textContent = (score != null ? score : '–') + (dt ? ' · ' + dt : '');
      rect.appendChild(titel);
      svg.appendChild(rect);
      // Wert ueber dem Balken (tabellarisch, Teil der Daten – nicht erfunden).
      var txt = svgEl('text');
      txt.setAttribute('class', 'cc-verlauf-zahl');
      txt.setAttribute('x', String(x + bw / 2));
      txt.setAttribute('y', String(padT + (nutzH - barH) - 5));
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = score != null ? String(score) : '–';
      svg.appendChild(txt);
      // Zeitachse: Datum unter dem Balken (vorhandenes created_at).
      if (dt) {
        var dtx = svgEl('text');
        dtx.setAttribute('class', 'cc-verlauf-datum');
        dtx.setAttribute('x', String(x + bw / 2));
        dtx.setAttribute('y', String(h - 8));
        dtx.setAttribute('text-anchor', 'middle');
        dtx.textContent = dt;
        svg.appendChild(dtx);
      }
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
  // B6: Leerzustand (0 Partner) fuehrt zur ersten Pruefung – klare, eine Handlung.
  function dashboardLeer() {
    var box = el('div', 'cc-leer');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(ICON.dashboard, 30));
    box.appendChild(iconBox);
    box.appendChild(el('h2', 'cc-leer-titel', 'Noch keine Prüfungen'));
    box.appendChild(el('p', 'cc-leer-satz',
      'Starte deine erste Prüfung – danach siehst du hier Handlungsbedarf, Kennzahlen und Monitoring auf einen Blick.'));
    var start = el('button', 'cc-knopf', 'Erste Prüfung starten');
    start.setAttribute('type', 'button');
    start.addEventListener('click', function () { waehle('pruefung', false); });
    box.appendChild(start);
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) {
      var laden = el('button', 'cc-knopf cc-knopf-leise cc-leer-zweit', 'Akten laden („Akten & Ordner“)');
      laden.setAttribute('type', 'button');
      laden.addEventListener('click', oeffneBestehendeHistorie);
      box.appendChild(laden);
    } else {
      box.appendChild(el('p', 'cc-leer-hinweis', VORSCHAU
        ? 'In der Vorschau siehst du ein Beispiel-Dashboard; echte Daten gibt es nach dem Login.'
        : 'Nach dem Login erscheinen hier deine echten Daten.'));
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

  // Eine Kennzahl im Tages-Briefing (nicht klickbar – fuer Unterseiten wie Berichte/Monitoring).
  function dashKennzahl(zahl, text) {
    var box = el('div', 'cc-dash-kennzahl');
    box.appendChild(el('div', 'cc-dash-kz-zahl', String(zahl)));
    box.appendChild(el('div', 'cc-dash-kz-text', text));
    return box;
  }
  // B6: KPI-Karte auf dem Dashboard – IMMER klickbar mit sinnvollem Ziel (Julius
  // Punkt 10: keine toten Elemente). zielTun kapselt die Navigation; data-cc-kpi
  // benennt das Ziel fuer Tests/Protokoll.
  function dashKpi(zahl, text, zielId, zielTun) {
    var box = el('button', 'cc-dash-kennzahl cc-dash-kpi cc-glass-2');
    box.setAttribute('type', 'button');
    box.setAttribute('data-cc-kpi', zielId);
    box.appendChild(el('div', 'cc-dash-kz-zahl', String(zahl)));
    box.appendChild(el('div', 'cc-dash-kz-text', text));
    box.addEventListener('click', zielTun);
    return box;
  }
  // B6 Begruessung + Datum (reine Anzeige; Uhrzeit nur fuer die Ansprache).
  function dashBegruessung(stunde) {
    if (stunde < 5) return 'Guten Abend';
    if (stunde < 11) return 'Guten Morgen';
    if (stunde < 18) return 'Guten Tag';
    return 'Guten Abend';
  }
  var WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  function dashDatumText(d) {
    return WOCHENTAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()] + ' ' + d.getFullYear();
  }

  // Eine Bereichs-Karte (Klick ruft NUR waehle(id, false)); optional „Kommt in Sx".
  function dashBereich(modId, titel, satz, bald) {
    var mod = findeModul(modId);
    var karte = el('button', 'cc-dash-karte');
    karte.setAttribute('type', 'button');
    karte.setAttribute('data-cc-bereich', modId);
    var ikon = el('div', 'cc-dash-karte-icon');
    ikon.appendChild(icon(mod ? mod.icon : ICON.dashboard, 18));
    karte.appendChild(ikon);
    var ktext = el('div', 'cc-dash-karte-text');
    ktext.appendChild(el('div', 'cc-dash-karte-titel', titel));
    ktext.appendChild(el('p', 'cc-dash-karte-satz', satz));
    karte.appendChild(ktext);
    if (bald) karte.appendChild(el('span', 'cc-leer-bald', 'Kommt in ' + bald));
    karte.addEventListener('click', function () { waehle(modId, false); });
    return karte;
  }

  // B6 (HELL-Lauf, Julius Punkt 10): klarer Ueberblick, JEDES Element funktionsfaehig.
  // Aufbau: Kopf (Begruessung + Datum + Primaerknopf „Neue Pruefung") -> KPI-Reihe
  // (4 klickbare Glas-Karten, Zahlen NUR aus dashboardDaten) -> zweispaltig (links
  // Handlungsbedarf, rechts Letzte Pruefung + Monitoring-Status) -> einzeiliges
  // Assistenz-Feld -> kompakte Schnellzugriffe. Keine erfundenen Werte, keine toten
  // Karten; dashboardDaten()/monitoringDaten() bleiben unveraendert (nur lesend).
  function dashboardAnsicht() {
    var zeilen = brueckeZeilen();
    if (!zeilen.length) return dashboardLeer();
    var d = dashboardDaten(zeilen);
    var wrap = el('div', 'cc-dash');

    var jetzt = new Date();                       // nur Anzeige (Begruessung + Datum)
    var kopf = el('div', 'cc-dash-kopf cc-dash-kopfzeile');
    var kopfText = el('div', 'cc-dash-kopf-text');
    kopfText.appendChild(el('h2', 'cc-dash-titel', dashBegruessung(jetzt.getHours())));
    kopfText.appendChild(el('p', 'cc-dash-unter', dashDatumText(jetzt) + ' · Dein Überblick.'));
    kopf.appendChild(kopfText);
    var neuePruefung = el('button', 'cc-knopf cc-dash-primaer', 'Neue Prüfung');
    neuePruefung.setAttribute('type', 'button');
    neuePruefung.addEventListener('click', function () { waehle('pruefung', false); });
    kopf.appendChild(neuePruefung);
    wrap.appendChild(kopf);

    // KPI-Reihe: 4 klickbare Glas-Karten; Ziele = Modul oder GEFILTERTE Partner-Liste.
    var briefing = el('section', 'cc-dash-bereich cc-dash-briefing');
    briefing.appendChild(el('h3', 'cc-dash-bereich-titel', 'Tages-Briefing'));
    var kennzahlen = el('div', 'cc-dash-kennzahlen');
    function zuPartnern(ampel) {
      return function () { partnerAmpel = ampel; partnerSuche = ''; waehle('partner', false); };
    }
    kennzahlen.appendChild(dashKpi(d.partnerAnzahl, 'Geschäftspartner', 'partner', zuPartnern('alle')));
    kennzahlen.appendChild(dashKpi(d.pruefAnzahl, d.pruefAnzahl === 1 ? 'Prüfung' : 'Prüfungen', 'berichte',
      function () { waehle('berichte', false); }));
    kennzahlen.appendChild(dashKpi(d.rotAnzahl, 'Kritisch', 'partner-kritisch', zuPartnern('urgent')));
    kennzahlen.appendChild(dashKpi(d.gelbAnzahl, 'Zu prüfen', 'partner-pruefen', zuPartnern('pending')));
    if (d.ohneScoreAnzahl) kennzahlen.appendChild(dashKpi(d.ohneScoreAnzahl, 'Ohne Score', 'partner', zuPartnern('alle')));
    briefing.appendChild(kennzahlen);
    wrap.appendChild(briefing);

    // Zweispaltiger Arbeitsbereich (>=1024; darunter stapelt CSS).
    var spalten = el('div', 'cc-dash-spalten');

    // Links: Handlungsbedarf (Ampel NUR hier; Klick -> Akte). Leer -> ruhiger Satz.
    var bedarf = el('section', 'cc-dash-bereich cc-dash-bedarf');
    bedarf.appendChild(el('h3', 'cc-dash-bereich-titel', 'Handlungsbedarf'));
    if (d.handlungsbedarf.length) {
      var liste = el('div', 'cc-dash-bedarf-liste');
      for (var i = 0; i < d.handlungsbedarf.length; i++) liste.appendChild(dashBedarfZeile(d.handlungsbedarf[i]));
      bedarf.appendChild(liste);
    } else {
      bedarf.appendChild(el('p', 'cc-dash-ruhig', 'Kein offener Handlungsbedarf.'));
    }
    spalten.appendChild(bedarf);

    // Rechts: Letzte Pruefung (klickbar -> Akte des Partners) + Monitoring-Status.
    var rechts = el('div', 'cc-dash-rechts');
    var gruppen = partnerGruppen(zeilen);             // nur lesend; gleiche Quelle wie dashboardDaten
    if (d.letztePruefung) {
      var akt = el('section', 'cc-dash-bereich');
      akt.appendChild(el('h3', 'cc-dash-bereich-titel', 'Letzte Aktivität'));
      var aktZeile = el('button', 'cc-dash-letzte');
      aktZeile.setAttribute('type', 'button');
      var aktLinks = el('div', 'cc-dash-letzte-links');
      aktLinks.appendChild(el('div', 'cc-dash-letzte-art', 'Prüfung durchgeführt'));
      var fname = el('div', 'cc-dash-letzte-firma');
      if (d.letztePruefung.firma) fname.textContent = d.letztePruefung.firma; else fname.appendChild(platzhalter());
      aktLinks.appendChild(fname);
      aktZeile.appendChild(aktLinks);
      if (d.letztePruefung.datum) aktZeile.appendChild(el('span', 'cc-dash-letzte-datum', d.letztePruefung.datum));
      (function (schluessel) {
        aktZeile.addEventListener('click', function () {
          if (!schluessel) return;
          setzeAktiv('partner');
          setzeBrotkrume('Geschäftspartner');
          zeigeInhalt(partnerAkteAnsicht(schluessel));
        });
      })(gruppen.length ? gruppen[0].key : null);     // gruppen[0] = Partner der juengsten Pruefung
      akt.appendChild(aktZeile);
      rechts.appendChild(akt);
    }
    // Monitoring-Status (Zahlen aus monitoringDaten, Klick -> Monitoring).
    var m = monitoringDaten(zeilen, Date.now());
    var mon = el('section', 'cc-dash-bereich');
    mon.appendChild(el('h3', 'cc-dash-bereich-titel', 'Monitoring'));
    var monKarte = el('button', 'cc-dash-mon');
    monKarte.setAttribute('type', 'button');
    monKarte.appendChild(el('div', 'cc-dash-mon-zeile', m.beobachtet + (m.beobachtet === 1 ? ' Partner' : ' Partner') + ' unter Beobachtung'));
    var monMeta = [];
    if (m.ueberfaelligAnzahl) monMeta.push(m.ueberfaelligAnzahl + ' Wiedervorlage überfällig');
    if (m.faelligAnzahl) monMeta.push(m.faelligAnzahl + ' bald fällig');
    monKarte.appendChild(el('div', 'cc-dash-mon-meta', monMeta.length ? monMeta.join(' · ') : 'Alle Wiedervorlagen im Plan'));
    monKarte.addEventListener('click', function () { waehle('monitoring', false); });
    mon.appendChild(monKarte);
    rechts.appendChild(mon);
    spalten.appendChild(rechts);
    wrap.appendChild(spalten);

    // Einzeiliges Assistenz-Feld (P3-Vertrag bleibt: kompakt, voll funktional, nach dem Bedarf).
    wrap.appendChild(kiFeld('dashboard'));

    // Unten: kompakte Schnellzugriffe (Klick ruft NUR waehle(id, false)).
    var abt = el('section', 'cc-dash-bereich');
    abt.appendChild(el('h3', 'cc-dash-bereich-titel', 'Schnellzugriffe'));
    var karten = el('div', 'cc-dash-abteilungen');
    karten.appendChild(dashBereich('partner', 'Geschäftspartner', 'Alle geprüften Firmen mit Akte und Verlauf.', null));
    karten.appendChild(dashBereich('pruefung', 'Neue Prüfung', 'Eine neue Firmen-Prüfung starten.', null));
    karten.appendChild(dashBereich('monitoring', 'Monitoring', 'Laufende Überwachung deiner Partner.', null));
    karten.appendChild(dashBereich('berichte', 'Berichte & Audit', 'Berichte und ein Prüfprotokoll.', null));
    abt.appendChild(karten);
    wrap.appendChild(abt);

    return wrap;
  }

  // ==========================================================================
  // S5 Berichte & Audit – shell-gerenderte Ansicht (Prüfprotokoll + flache Audit-Liste je Prüfung). Nur
  // lesend ueber brueckeZeilen(); Export laeuft ueber die bestehende „Akten & Ordner"-Druckfunktion.
  // ==========================================================================
  function berichteLeer() {
    var box = el('div', 'cc-leer');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(ICON.berichte, 30));
    box.appendChild(iconBox);
    box.appendChild(el('h2', 'cc-leer-titel', 'Noch keine Berichte'));
    box.appendChild(el('p', 'cc-leer-satz',
      'Sobald Prüfungen geladen sind, erscheint hier jede Prüfung als nachvollziehbarer Protokoll-Eintrag.'));
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) {
      var laden = el('button', 'cc-knopf', 'Akten laden („Akten & Ordner“)');
      laden.setAttribute('type', 'button');
      laden.addEventListener('click', oeffneBestehendeHistorie);
      box.appendChild(laden);
    } else {
      box.appendChild(el('p', 'cc-leer-hinweis', VORSCHAU
        ? 'In der Vorschau siehst du Beispiel-Prüfungen; echte Berichte gibt es nach dem Login.'
        : 'Dafür ist eine Anmeldung nötig.'));
    }
    return box;
  }

  function berichtZeile(e) {
    var zeile = el('div', 'cc-ber-zeile');
    var dBox = el('div', 'cc-ber-datum');
    if (e.datum) dBox.textContent = e.datum; else dBox.appendChild(platzhalter('kein Datum'));
    zeile.appendChild(dBox);
    var mitte = el('div', 'cc-ber-mitte');
    var fname = el('div', 'cc-ber-firma');
    if (e.firma) fname.textContent = e.firma; else fname.appendChild(platzhalter());
    mitte.appendChild(fname);
    mitte.appendChild(el('div', 'cc-ber-meta', (e.land || '—') + (e.pruefId ? ' · ' + e.pruefId : '')));
    zeile.appendChild(mitte);
    zeile.appendChild(ampelPille(e.score));
    return zeile;
  }

  // S8 Audit-Zeile: Zeitstempel · Aktion · Partner (Land · Prüf-ID · Wer) · Ampel. Nur textContent.
  function auditZeile(e) {
    var zeile = el('div', 'cc-audit-zeile');
    var zBox = el('div', 'cc-audit-zeit');
    if (e.zeit) zBox.textContent = e.zeit; else zBox.appendChild(platzhalter('kein Datum'));
    zeile.appendChild(zBox);
    var mitte = el('div', 'cc-audit-mitte');
    mitte.appendChild(el('div', 'cc-audit-aktion', e.aktion));
    var fname = el('div', 'cc-audit-firma');
    if (e.firma) fname.textContent = e.firma; else fname.appendChild(platzhalter());
    mitte.appendChild(fname);
    mitte.appendChild(el('div', 'cc-audit-meta',
      (e.land || '—') + (e.pruefId ? ' · ' + e.pruefId : '') + ' · ' + (e.akteur || 'dieses Konto')));
    zeile.appendChild(mitte);
    zeile.appendChild(ampelPille(e.score));
    return zeile;
  }

  function berichteAnsicht() {
    var zeilen = brueckeZeilen();
    if (!zeilen.length) return berichteLeer();
    var d = berichteDaten(zeilen);
    var wrap = el('div', 'cc-ber');

    var kopf = el('div', 'cc-dash-kopf');
    kopf.appendChild(el('h2', 'cc-dash-titel', 'Berichte & Audit'));
    kopf.appendChild(el('p', 'cc-dash-unter', 'Jede Prüfung als nachvollziehbarer Eintrag – neueste zuerst.'));
    wrap.appendChild(kopf);

    var protokoll = el('section', 'cc-dash-briefing');
    protokoll.appendChild(el('h3', 'cc-dash-bereich-titel', 'Prüfprotokoll'));
    var kz = el('div', 'cc-dash-kennzahlen');
    kz.appendChild(dashKennzahl(d.gesamt, d.gesamt === 1 ? 'Prüfung' : 'Prüfungen'));
    kz.appendChild(dashKennzahl(d.rotAnzahl, 'Kritisch'));
    kz.appendChild(dashKennzahl(d.gelbAnzahl, 'Zu prüfen'));
    if (d.ohneScoreAnzahl) kz.appendChild(dashKennzahl(d.ohneScoreAnzahl, 'Ohne Score'));
    protokoll.appendChild(kz);
    wrap.appendChild(protokoll);

    var listeKarte = el('section', 'cc-dash-bereich');
    listeKarte.appendChild(el('h3', 'cc-dash-bereich-titel', 'Alle Prüfungen'));
    var liste = el('div', 'cc-ber-liste');
    var bkopf = el('div', 'cc-ber-tabkopf');
    bkopf.setAttribute('aria-hidden', 'true');
    bkopf.appendChild(el('div', 'cc-ber-datum', 'Datum'));
    bkopf.appendChild(el('div', 'cc-ber-mitte', 'Prüfung'));
    bkopf.appendChild(el('div', null, 'Score'));
    liste.appendChild(bkopf);
    for (var i = 0; i < d.eintraege.length; i++) liste.appendChild(berichtZeile(d.eintraege[i]));
    listeKarte.appendChild(liste);
    wrap.appendChild(listeKarte);

    // S8: durchgaengiges, zeitgestempeltes Audit-Protokoll (jede Pruefung ein Ereignis, neueste zuerst).
    var a = auditProtokoll(zeilen);
    var auditKarte = el('section', 'cc-dash-bereich');
    auditKarte.appendChild(el('h3', 'cc-dash-bereich-titel', 'Audit-Protokoll'));
    auditKarte.appendChild(el('p', 'cc-dash-unter',
      'Wer hat wann was geprüft – lückenlos, neueste zuerst (Ereignisse: ' + a.gesamt + ').'));
    var auditListe = el('div', 'cc-audit-liste');
    var akopf = el('div', 'cc-ber-tabkopf cc-audit-tabkopf');
    akopf.setAttribute('aria-hidden', 'true');
    akopf.appendChild(el('div', 'cc-audit-zeit', 'Zeit'));
    akopf.appendChild(el('div', 'cc-audit-mitte', 'Ereignis'));
    akopf.appendChild(el('div', null, 'Score'));
    auditListe.appendChild(akopf);
    for (var k = 0; k < a.eintraege.length; k++) auditListe.appendChild(auditZeile(a.eintraege[k]));
    auditKarte.appendChild(auditListe);
    wrap.appendChild(auditKarte);

    var aktion = el('div', 'cc-akte-aktion');
    var exp = el('button', 'cc-knopf', 'Bericht & PDF in „Akten & Ordner“ öffnen');
    exp.setAttribute('type', 'button');
    exp.addEventListener('click', oeffneBestehendeHistorie);
    aktion.appendChild(exp);
    aktion.appendChild(el('p', 'cc-leer-hinweis',
      'Das Audit-Protokoll zeigt jede Prüfung mit Zeit, Partner, Ergebnis und Prüf-ID. „Wer" ist das '
      + 'angemeldete Konto; sobald die App ein Prüfer-Feld liefert, erscheint es hier automatisch. Weitere '
      + 'Ereignisarten (z. B. Einstellungen) lassen sich später einreihen.'));
    wrap.appendChild(aktion);
    return wrap;
  }

  // ==========================================================================
  // S7 Monitoring – shell-gerenderte Ansicht (Partner unter Beobachtung, Handlungsbedarf zuerst, Ampel je
  // Partner). Nur lesend ueber brueckeZeilen(); Eintrag-Klick -> Partner-Akte. Fristen = PLATZHALTER (S8).
  // ==========================================================================
  function monitoringLeer() {
    var box = el('div', 'cc-leer');
    var iconBox = el('div', 'cc-leer-icon');
    iconBox.appendChild(icon(ICON.monitoring, 30));
    box.appendChild(iconBox);
    box.appendChild(el('h2', 'cc-leer-titel', 'Noch keine Partner unter Beobachtung'));
    box.appendChild(el('p', 'cc-leer-satz',
      'Sobald Prüfungen geladen sind, überwachst du hier alle Geschäftspartner – Handlungsbedarf zuerst.'));
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) {
      var laden = el('button', 'cc-knopf', 'Akten laden („Akten & Ordner“)');
      laden.setAttribute('type', 'button');
      laden.addEventListener('click', oeffneBestehendeHistorie);
      box.appendChild(laden);
    } else {
      box.appendChild(el('p', 'cc-leer-hinweis', VORSCHAU
        ? 'In der Vorschau siehst du Beispiel-Partner; echte Überwachung gibt es nach dem Login.'
        : 'Dafür ist eine Anmeldung nötig.'));
    }
    return box;
  }

  // S8 Frist-Beschriftung (View). Ohne berechenbare Frist -> "offen".
  var FRIST_WORT = { ueberfaellig: 'überfällig', faellig: 'bald fällig', geplant: 'im Plan', unbekannt: 'offen' };
  function fristLabel(p) {
    if (!p || !p.fristText) return 'Wiedervorlage: offen';
    var wort = FRIST_WORT[p.fristStatus] || '';
    return 'Wiedervorlage ' + p.fristText + (wort ? ' (' + wort + ')' : '');
  }

  function monitoringZeile(p) {
    var btn = el('button', 'cc-mon-zeile');
    btn.setAttribute('type', 'button');
    var links = el('div', 'cc-mon-links');
    var nameEl = el('div', 'cc-mon-name');
    if (p.name) nameEl.textContent = p.name; else nameEl.appendChild(platzhalter());
    links.appendChild(nameEl);
    // P5: keine eigenen "·"-Spans mehr – shell.css haengt den Trenner per ::before an
    // jedes Folgeelement (ein umgebrochener Eintrag endet damit nie auf einem Trenner).
    var meta = el('div', 'cc-mon-meta');
    meta.appendChild(el('span', null, p.land || '—'));
    if (p.letztePruefung) meta.appendChild(el('span', null, 'zuletzt ' + p.letztePruefung));
    var frist = el('span', 'cc-mon-frist cc-frist-' + (p.fristStatus || 'unbekannt'));
    frist.textContent = fristLabel(p);
    meta.appendChild(frist);
    links.appendChild(meta);
    btn.appendChild(links);
    btn.appendChild(ampelPille(p.score));
    btn.addEventListener('click', function () { setzeAktiv('partner'); zeigeInhalt(partnerAkteAnsicht(p.key)); });
    return btn;
  }

  function monitoringAnsicht() {
    var zeilen = brueckeZeilen();
    if (!zeilen.length) return monitoringLeer();
    var d = monitoringDaten(zeilen, Date.now());   // "heute" wird in die reine Schicht injiziert (nicht intern)
    var wrap = el('div', 'cc-mon');

    var kopf = el('div', 'cc-dash-kopf');
    kopf.appendChild(el('h2', 'cc-dash-titel', 'Monitoring'));
    kopf.appendChild(el('p', 'cc-dash-unter', 'Laufende Überwachung deiner Geschäftspartner – Handlungsbedarf zuerst.'));
    wrap.appendChild(kopf);

    var ueber = el('section', 'cc-dash-briefing');
    ueber.appendChild(el('h3', 'cc-dash-bereich-titel', 'Überblick'));
    var kz = el('div', 'cc-dash-kennzahlen');
    kz.appendChild(dashKennzahl(d.beobachtet, 'Partner beobachtet'));
    kz.appendChild(dashKennzahl(d.bedarfAnzahl, 'mit Handlungsbedarf'));
    if (d.ueberfaelligAnzahl) kz.appendChild(dashKennzahl(d.ueberfaelligAnzahl, 'Wiedervorlage überfällig'));
    if (d.faelligAnzahl) kz.appendChild(dashKennzahl(d.faelligAnzahl, 'bald fällig'));
    ueber.appendChild(kz);
    wrap.appendChild(ueber);

    var listeKarte = el('section', 'cc-dash-bereich');
    listeKarte.appendChild(el('h3', 'cc-dash-bereich-titel', 'Unter Beobachtung'));
    var liste = el('div', 'cc-mon-liste');
    for (var i = 0; i < d.partner.length; i++) liste.appendChild(monitoringZeile(d.partner[i]));
    listeKarte.appendChild(liste);
    wrap.appendChild(listeKarte);

    wrap.appendChild(el('p', 'cc-leer-hinweis',
      'Wiedervorlage = letzte Prüfung + ' + WIEDERVORLAGE_MONATE + ' Monate (die in der App genannte Kadenz). '
      + 'Reine Erinnerung/Anzeige – es wird nichts automatisch geprüft und nichts berechnet; die Kadenz legt Julius fest.'));
    return wrap;
  }

  // ==========================================================================
  // S4a KI-Assistent – DOM-Teil (Feld im Dashboard + eigene Ansicht + Bestaetigungskarte).
  // Baut sein DOM nur ueber el()/textContent/setAttribute (kein innerHTML, kein inline-Stil, keine
  // Inline-Handler). Jede Instanz hat ihren eigenen Zustand (offeneKarte) und ruft die reinen
  // Controller-Funktionen (kiAntwortAuf/kiBestaetige/kiAbbrechen). Seiteneffekte nur ueber kiUmgebung.
  // ==========================================================================
  // Kapselt alle Seiteneffekte, die die Ausfuehrer brauchen (lesen + navigieren + Formular vorausfuellen).
  function kiUmgebung() {
    return {
      daten: function () { return dashboardDaten(brueckeZeilen()); },
      gruppen: function () { return partnerGruppen(brueckeZeilen()); },
      navigiere: function (modId) { waehle(modId, false); },
      zeigeAkte: function (key) { setzeAktiv('partner'); zeigeInhalt(partnerAkteAnsicht(key)); },
      fuelleFormular: kiFuelleFormular,
      starteTour: function () { if (typeof kiStarteTour === 'function') kiStarteTour(); }   // Tour: Block 4
    };
  }

  // Fuellt NUR die Formularfelder der App (#nameInput/#landInput). KEIN Absenden, KEIN Klick auf #searchBtn,
  // KEIN input-Event. Sind die Felder nicht da (nicht eingeloggt), passiert nichts.
  function kiFuelleFormular(firma, land) {
    var name = document.querySelector('#nameInput');
    var landEl = document.querySelector('#landInput');
    if (name) name.value = String(firma == null ? '' : firma);
    if (land != null && String(land).trim() && landEl) landEl.value = String(land);
  }

  // Ans Ende scrollen. Im B5-Chat scrollt der Verlauf (.cc-chat-verlauf), nicht das Log.
  function kiLogAnsEnde(log) {
    var scroller = (log.closest && log.closest('.cc-chat-verlauf')) || log;
    scroller.scrollTop = scroller.scrollHeight || 0;    // Property, kein inline-Stil.
  }
  // B5: Antwort mit kurzem Schreib-Indikator rendern (nur echter Browser; im Mini-DOM
  // der Tests bleibt alles synchron). Die KI-Logik selbst laeuft weiter synchron.
  function kiZeigeMitTippen(log, r, zustand, umgebung) {
    if (typeof requestAnimationFrame !== 'function') { kiZeigeErgebnis(log, r, zustand, umgebung); return; }
    var tipp = kiTipptKnoten();
    log.appendChild(tipp);
    einblenden(tipp, 'kurz');
    kiLogAnsEnde(log);
    setTimeout(function () { entfernen(tipp); kiZeigeErgebnis(log, r, zustand, umgebung); }, 320);
  }

  // Bestaetigungskarte als DOM-Knoten (Titel, Klartext-Zeilen, „Ja, ausführen" / „Abbrechen").
  // Doppelklick-sicher: 'erledigt' in der UI + die Einmal-Leerung in kiBestaetige/kiAbbrechen.
  function kiKarteKnoten(karte, zustand, umgebung, log) {
    var box = el('div', 'cc-ki-karte');
    box.setAttribute('data-cc-ki-karte', '1');
    box.appendChild(el('div', 'cc-ki-karte-titel', karte.titel));
    var liste = el('ul', 'cc-ki-karte-liste');
    for (var i = 0; i < karte.zeilen.length; i++) liste.appendChild(el('li', 'cc-ki-karte-zeile', karte.zeilen[i]));
    box.appendChild(liste);
    var knoepfe = el('div', 'cc-ki-karte-knoepfe');
    var ja = el('button', 'cc-knopf cc-ki-ja', 'Ja, ausführen');
    ja.setAttribute('type', 'button');
    var nein = el('button', 'cc-knopf cc-knopf-leise cc-ki-nein', 'Abbrechen');
    nein.setAttribute('type', 'button');
    var erledigt = false;
    function abschliessen(res) {
      erledigt = true;
      // B4: Karte weich ausblenden, erst danach verstecken (cc-ki-karte-aus).
      ausblendenDann(box, 'fade', function () { box.classList.add('cc-ki-karte-aus'); });
      var antwort = kiNachrichtKnoten('assistent', res.antwort);
      log.appendChild(antwort);
      einblenden(antwort, 'kurz');
      kiLogAnsEnde(log);
    }
    ja.addEventListener('click', function () { if (erledigt) return; abschliessen(kiBestaetige(zustand, umgebung)); });
    nein.addEventListener('click', function () { if (erledigt) return; abschliessen(kiAbbrechen(zustand, umgebung)); });
    knoepfe.appendChild(ja);
    knoepfe.appendChild(nein);
    box.appendChild(knoepfe);
    return box;
  }

  // Ein Ergebnis von kiAntwortAuf in den Chat-Verlauf schreiben (Antwort-Blase oder Karte).
  function kiZeigeErgebnis(log, r, zustand, umgebung) {
    if (r.art === 'karte') {
      var karte = kiKarteKnoten(r.karte, zustand, umgebung, log);
      log.appendChild(karte);
      einblenden(karte, 'pop');            // B4: Karte poppt weich auf
      kiLogAnsEnde(log);
      return;
    }
    var antwort = kiNachrichtKnoten('assistent', r.antwort);
    log.appendChild(antwort);
    einblenden(antwort, 'kurz');           // B4: Chat-Nachrichten gleiten weich herein
    kiLogAnsEnde(log);
  }

  // Das kompakte Assistenz-Feld auf dem Dashboard (P3). Die grosse Chat-Ansicht ist
  // seit B5 kiChat() (eigene Seite „wie Claude").
  function kiFeld(kontext) {
    var zustand = { offeneKarte: null };
    var umgebung = kiUmgebung();
    var feld = el('section', 'cc-ki-feld cc-ki-feld-kompakt');
    feld.setAttribute('data-cc-ki', 'assistent');

    // B6: einzeilig – kleiner Avatar + Eingabe + Senden; Titel/Satz entfallen. Ein
    // Mini-Verlauf (Log) erscheint erst, wenn gefragt wurde (CSS: :empty aus).
    // Der Link rechts fuehrt zur grossen Chat-Seite.
    var log = el('div', 'cc-ki-log');
    log.setAttribute('data-cc-ki-log', '1');

    var zeile = el('div', 'cc-ki-eingabe');
    zeile.appendChild(kiAvatar('assistent'));
    var eingabe = el('input', 'cc-ki-input');
    eingabe.setAttribute('type', 'text');
    eingabe.setAttribute('maxlength', String(KI_MAX_ZEICHEN));
    eingabe.setAttribute('placeholder', 'Assistent fragen …');
    eingabe.setAttribute('aria-label', 'Frage an den Assistenten');
    var senden = el('button', 'cc-ki-senden', 'Senden');
    senden.setAttribute('type', 'button');
    senden.disabled = true;                 // B6/H-08: leeres Feld = nichts zu senden
    eingabe.addEventListener('input', function () { senden.disabled = !String(eingabe.value || '').trim(); });
    var zumChat = el('button', 'cc-knopf cc-knopf-geist cc-ki-zum-chat', 'Zum Assistenten');
    zumChat.setAttribute('type', 'button');
    zumChat.addEventListener('click', function () { waehle('ki', false); });
    zeile.appendChild(eingabe);
    zeile.appendChild(senden);
    zeile.appendChild(zumChat);
    feld.appendChild(zeile);
    feld.appendChild(log);

    function schicke(text) {
      var roh = String(text == null ? '' : text);
      if (!roh.trim()) return;
      var meine = kiNachrichtKnoten('nutzer', roh);
      log.appendChild(meine);
      einblenden(meine, 'kurz');
      kiZeigeMitTippen(log, kiAntwortAuf(zustand, roh, umgebung), zustand, umgebung);
      eingabe.value = '';
    }
    senden.addEventListener('click', function () { schicke(eingabe.value); });
    eingabe.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); schicke(eingabe.value); } });
    return feld;
  }

  // ==========================================================================
  // B5 KI-Assistent als Chatfenster „wie Claude" (Julius Punkte 8 + 9).
  // Volle Hoehe des Inhaltsbereichs; schlanker Kopf (Avatar, Name, Status, „Neuer
  // Chat"); scrollender Verlauf mit 760px-Lesespalte; Eingabe unten als Glas-Karte
  // (mitwachsende Textarea 1–8 Zeilen, Enter sendet, Shift+Enter neue Zeile, runder
  // Senden-Knopf, deaktiviert bei leerem Feld); Leerzustand mit grossem Avatar und
  // 4 Vorschlags-Chips aus den BESTEHENDEN KI_AKTIONEN. Logik unveraendert – nur
  // Darstellung; jede Antwort kommt weiter aus kiAntwortAuf/kiZeigeErgebnis.
  // ==========================================================================
  function kiChat() {
    var zustand = { offeneKarte: null };
    var umgebung = kiUmgebung();
    var chat = el('section', 'cc-ki-feld cc-chat');
    chat.setAttribute('data-cc-ki', 'assistent');

    // Kopf: Avatar + Name + Status-Punkt + „Neuer Chat".
    var kopf = el('header', 'cc-chat-kopf');
    kopf.appendChild(kiAvatar('assistent'));
    var kopfText = el('div', 'cc-chat-kopf-text');
    kopfText.appendChild(el('div', 'cc-chat-name', 'Compliance-Assistent'));
    var status = el('div', 'cc-chat-status');
    status.appendChild(el('span', 'cc-chat-status-punkt'));
    status.appendChild(el('span', null, 'Bereit'));
    kopfText.appendChild(status);
    kopf.appendChild(kopfText);
    var neu = el('button', 'cc-knopf cc-knopf-leise cc-chat-neu', 'Neuer Chat');
    neu.setAttribute('type', 'button');
    kopf.appendChild(neu);
    chat.appendChild(kopf);

    // Verlauf: scrollende Mitte, zentrierte Lesespalte.
    var verlauf = el('div', 'cc-chat-verlauf');
    var spalte = el('div', 'cc-chat-spalte');
    var leer = el('div', 'cc-chat-leer');
    leer.appendChild(kiAvatar('assistent', true));
    leer.appendChild(el('h3', 'cc-chat-leer-titel', 'Wobei kann ich helfen?'));
    leer.appendChild(el('p', 'cc-chat-leer-satz',
      'Ich bediene die App für dich – fragen, öffnen, vorbereiten. Etwas schreiben tue ich erst nach deiner Bestätigung.'));
    var chips = el('div', 'cc-ki-chips');
    var beispiele = ['Wer braucht Handlungsbedarf?', 'Briefing vorlesen', 'Neue Prüfung öffnen', 'Tour'];
    for (var i = 0; i < beispiele.length; i++) {
      var chip = el('button', 'cc-ki-chip', beispiele[i]);
      chip.setAttribute('type', 'button');
      chip.setAttribute('data-cc-ki-beispiel', beispiele[i]);
      chips.appendChild(chip);
    }
    leer.appendChild(chips);
    spalte.appendChild(leer);
    var log = el('div', 'cc-ki-log cc-chat-log');
    log.setAttribute('data-cc-ki-log', '1');
    spalte.appendChild(log);
    verlauf.appendChild(spalte);
    chat.appendChild(verlauf);

    // „Nach unten"-Knopf (erscheint, wenn der Verlauf hochgescrollt ist).
    var runter = el('button', 'cc-chat-runter cc-aus');
    runter.setAttribute('type', 'button');
    runter.setAttribute('aria-label', 'Zum Ende des Verlaufs springen');
    runter.appendChild(icon(ICON.pfeilRunter, 18));
    chat.appendChild(runter);

    // Eingabe unten: grosse Glas-Karte mit mitwachsender Textarea + rundem Senden-Knopf.
    var fuss = el('div', 'cc-chat-fuss');
    var eingabeKarte = el('div', 'cc-chat-eingabe cc-glass-2');
    var eingabe = el('textarea', 'cc-ki-input cc-chat-input');
    eingabe.setAttribute('rows', '1');
    eingabe.setAttribute('maxlength', String(KI_MAX_ZEICHEN));
    eingabe.setAttribute('placeholder', 'Frag den Assistenten …');
    eingabe.setAttribute('aria-label', 'Frage an den Assistenten');
    eingabeKarte.appendChild(eingabe);
    var senden = el('button', 'cc-ki-senden cc-chat-senden');
    senden.setAttribute('type', 'button');
    senden.setAttribute('aria-label', 'Senden');
    senden.disabled = true;                       // leer = nichts zu senden
    senden.appendChild(icon(ICON.senden, 18));
    eingabeKarte.appendChild(senden);
    fuss.appendChild(eingabeKarte);
    fuss.appendChild(el('p', 'cc-chat-hinweis',
      'Der Assistent bedient nur diese App. Enter sendet, Shift+Enter macht eine neue Zeile.'));
    chat.appendChild(fuss);

    var leerWeg = false;
    function schicke(text) {
      var roh = String(text == null ? '' : text);
      if (!roh.trim()) return;
      if (!leerWeg) { leerWeg = true; ausblendenDann(leer, 'fade', entfernen); }
      var meine = kiNachrichtKnoten('nutzer', roh);
      log.appendChild(meine);
      einblenden(meine, 'kurz');
      kiZeigeMitTippen(log, kiAntwortAuf(zustand, roh, umgebung), zustand, umgebung);
      eingabe.value = '';
      senden.disabled = true;
      kiLogAnsEnde(log);
    }
    senden.addEventListener('click', function () { schicke(eingabe.value); });
    eingabe.addEventListener('input', function () { senden.disabled = !String(eingabe.value || '').trim(); });
    eingabe.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); schicke(eingabe.value); }
      // Shift+Enter: Standardverhalten der Textarea = neue Zeile (nichts tun).
    });
    chips.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-cc-ki-beispiel]') : null;
      if (!t) return;
      schicke(t.getAttribute('data-cc-ki-beispiel'));
    });
    neu.addEventListener('click', function () {
      zustand.offeneKarte = null;
      ausblendenDann(log, 'fade', function () {
        while (log.firstChild) log.removeChild(log.firstChild);
        if (leerWeg) {
          leerWeg = false;
          spalte.appendChild(leer);               // Leerzustand kommt zurueck
          einblenden(leer, 'pop');
        }
        einblenden(log, 'fade');
      });
    });
    runter.addEventListener('click', function () { kiLogAnsEnde(log); });
    verlauf.addEventListener('scroll', function () {
      var weitOben = (verlauf.scrollHeight - verlauf.scrollTop - (verlauf.clientHeight || 0)) > 200;
      runter.classList.toggle('cc-aus', !weitOben);
    });
    return chat;
  }

  // Eigene Assistenz-Ansicht (Nav-Modul „ki", art 'ki') – B5: Chatfenster in voller Hoehe.
  function kiAnsicht() {
    var wrap = el('div', 'cc-ki-ansicht');
    wrap.appendChild(kiChat());
    return wrap;
  }

  // ==========================================================================
  // S4c Einstellungen – shell-gerendertes Pane „wie bei Claude" (Abschnittsliste links, Inhalt rechts).
  // KEIN Modal/neues z-index: liegt im #ccShellModul wie Dashboard/Partner/KI. Minimal-invasiv: Konto/Team
  // oeffnen die bestehenden Ansichten per .click() (#kontoBtn/#teamBtn); die Oberflaechensprache liest und
  // schaltet den bestehenden #langBtn (der frueher unten links schwebte und jetzt hier in den Einstellungen
  // sitzt). Nur el()/textContent/setAttribute, kein innerHTML, keine inline-Stile, keine App-Globals.
  // ==========================================================================
  // ==========================================================================
  // S6 Paket-Anzeige – NUR Anzeige, read-only. KEINE Durchsetzung, KEINE Preise/Limits. Pakete, Limits und
  // Preise aendert ausschliesslich Julius (E7) – die Shell liest den Paketnamen nur, WENN die App ihn in einem
  // stabilen Attribut bereitstellt (data-cc-paket / data-paket), und zeigt ihn an; sonst PLATZHALTER. paketRang
  // ist NUR die Anzeige-Reihenfolge (bronze<silber<gold<platinum), KEINE Limit-/Preis-Zahl.
  // ==========================================================================
  var PAKET_RANG = { bronze: 1, silber: 2, gold: 3, platinum: 4 };   // nur Anzeige-Reihenfolge, KEINE Limits
  function paketNorm(name) { return String(name == null ? '' : name).toLowerCase().replace(/[^a-z]+/g, ''); }
  function paketRang(name) { return PAKET_RANG[paketNorm(name)] || 0; }
  function paketLabel(name) {
    var n = paketNorm(name);
    if (PAKET_RANG[n]) return n.charAt(0).toUpperCase() + n.slice(1);
    var roh = String(name == null ? '' : name).trim();
    return roh ? roh : null;
  }
  // Best-effort read-only: nur ein stabiles Attribut, kein Scrapen von Fliesstext, kein App-Global. Fehlt die
  // Angabe (heute der Fall) -> null -> die Anzeige faellt auf PLATZHALTER zurueck.
  function paketLesen() {
    var q = document.querySelector('[data-cc-paket], [data-paket]');
    if (!q) return null;
    var v = q.getAttribute('data-cc-paket') || q.getAttribute('data-paket');
    return (v && String(v).trim()) ? String(v).trim() : null;
  }

  var SET_ABSCHNITTE = [
    { id: 'allgemein', label: 'Allgemein' },
    { id: 'sprache', label: 'Sprache' },
    { id: 'konto', label: 'Konto' },
    { id: 'team', label: 'Team' },
    { id: 'ueber', label: 'Über' }
  ];

  // Bestehendes Bedienelement per .click() oeffnen (nur wenn vorhanden + sichtbar); sonst Hinweis. Fuer
  // Konto (#kontoBtn) und Team (#teamBtn) aus den Einstellungen – derselbe minimal-invasive Weg wie sonst.
  function klickeZiel(sel) {
    var z = document.querySelector(sel);
    if (z && z.offsetParent !== null) { versteckeInhalt(); try { z.click(); } catch (e) {} }
    else {
      zeigeInhalt(hinweisKarte(VORSCHAU ? 'In der Vorschau gesperrt' : 'Anmeldung nötig',
        'Diese Ansicht öffnet sich nach dem Login.'));
    }
  }

  // Aktuelle Oberflaechensprache am bestehenden #langBtn ablesen: Text „🌐 EN" => aktuell Deutsch (bietet
  // Englisch an), „🌐 DE" => aktuell Englisch. Kein App-Global, nur DOM-Text. Fehlt der Knopf -> null.
  function spracheJetzt() {
    var lb = document.querySelector('#langBtn');
    if (!lb) return null;
    var t = String(lb.textContent || '');
    if (/\bDE\b/i.test(t)) return 'en';
    if (/\bEN\b/i.test(t)) return 'de';
    return null;
  }
  // Oberflaechensprache umschalten = den bestehenden #langBtn klicken (einzige App-Schreibstelle). Der Knopf
  // ist jetzt per shell.css versteckt, laesst sich aber weiter programmatisch klicken (darum KEIN offsetParent-Gate).
  function spracheUmschalten() {
    var lb = document.querySelector('#langBtn');
    if (lb) { try { lb.click(); } catch (e) {} }
  }

  function setZeile(label, wert) {
    var z = el('div', 'cc-set-zeile');
    z.appendChild(el('span', 'cc-set-zeile-label', label));
    if (wert != null && String(wert).trim()) z.appendChild(el('span', 'cc-set-zeile-wert', String(wert)));
    else z.appendChild(platzhalter());
    return z;
  }

  // D10: Umschalter Hell/Dunkel/System (segmentierte Knopfgruppe). Aktiv = gespeicherte Wahl (Default System).
  var THEMA_WAHL = [['hell', 'Hell'], ['dunkel', 'Dunkel'], ['system', 'System']];
  function setDarstellungZeile() {
    var z = el('div', 'cc-set-zeile');
    z.appendChild(el('span', 'cc-set-zeile-label', 'Darstellung'));
    var seg = el('div', 'cc-theme-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Darstellung wählen');
    // Ohne gespeicherte Wahl ist die App hell (Julius 21.11. Punkt 1) – der
    // Umschalter zeigt darum 'Hell' als aktiv, nicht 'System'.
    var aktuell = themaGespeichert() || 'hell';
    for (var i = 0; i < THEMA_WAHL.length; i++) {
      (function (wahl, label) {
        var b = el('button', 'cc-theme-knopf' + (wahl === aktuell ? ' cc-theme-an' : ''), label);
        b.setAttribute('type', 'button');
        b.setAttribute('data-cc-theme-wahl', wahl);
        if (wahl === aktuell) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', function () { themaSetzen(wahl); setRender('allgemein'); });
        seg.appendChild(b);
      })(THEMA_WAHL[i][0], THEMA_WAHL[i][1]);
    }
    z.appendChild(seg);
    return z;
  }
  function setInhaltAllgemein() {
    var box = el('div', 'cc-set-abschnitt');
    box.appendChild(el('h3', 'cc-set-titel', 'Allgemein'));
    box.appendChild(el('p', 'cc-set-text', 'Deine Einstellungen – übersichtlich an einem Ort, wie du es gewohnt bist.'));
    box.appendChild(setZeile('Umgebung', VORSCHAU ? 'Vorschau (Testumgebung)' : 'Testumgebung'));
    box.appendChild(setDarstellungZeile());
    return box;
  }
  function setInhaltSprache() {
    var box = el('div', 'cc-set-abschnitt');
    box.appendChild(el('h3', 'cc-set-titel', 'Sprache'));
    box.appendChild(el('p', 'cc-set-text',
      'Sprache der Oberfläche. Die Umschaltung gilt für die ganze App (vormals der Knopf unten links).'));
    var jetzt = spracheJetzt();
    if (jetzt == null) {
      box.appendChild(el('p', 'cc-leer-hinweis', 'Die Sprachumschaltung ist nach dem Login verfügbar.'));
      return box;
    }
    box.appendChild(setZeile('Aktuelle Sprache', jetzt === 'en' ? 'English' : 'Deutsch'));
    var um = el('button', 'cc-knopf cc-set-sprache-um', jetzt === 'en' ? 'Auf Deutsch umstellen' : 'Auf Englisch umstellen');
    um.setAttribute('type', 'button');
    um.addEventListener('click', function () { spracheUmschalten(); setRender('sprache'); });
    box.appendChild(um);
    return box;
  }
  function setInhaltKonto() {
    var box = el('div', 'cc-set-abschnitt');
    box.appendChild(el('h3', 'cc-set-titel', 'Konto'));
    box.appendChild(el('p', 'cc-set-text', 'Dein Konto, Paket und Abmelden findest du in der bestehenden Konto-Ansicht.'));
    box.appendChild(setZeile('Angemeldet als', null));
    // S6: Paket NUR anzeigen (read-only). paketLabel(paketLesen()) ist null, solange die App kein data-cc-paket
    // liefert -> Platzhalter. Die Shell aendert NICHTS an Paketen/Limits/Preisen (das macht Julius, E7).
    box.appendChild(setZeile('Dein Paket', paketLabel(paketLesen())));
    box.appendChild(el('p', 'cc-leer-hinweis',
      'Pakete, Limits und Preise werden in der Konto-Ansicht verwaltet. Die Plattform zeigt dein Paket nur an und ändert daran nichts.'));
    var btn = el('button', 'cc-knopf cc-set-konto-oeffnen', 'Konto öffnen');
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', function () { klickeZiel('#kontoBtn'); });
    box.appendChild(btn);
    return box;
  }
  function setInhaltTeam() {
    var box = el('div', 'cc-set-abschnitt');
    box.appendChild(el('h3', 'cc-set-titel', 'Team'));
    box.appendChild(el('p', 'cc-set-text', 'Teammitglieder und Rollen verwaltest du in der bestehenden Team-Ansicht.'));
    var btn = el('button', 'cc-knopf cc-set-team-oeffnen', 'Team öffnen');
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', function () { klickeZiel('#teamBtn'); });
    box.appendChild(btn);
    return box;
  }
  function setInhaltUeber() {
    var box = el('div', 'cc-set-abschnitt');
    box.appendChild(el('h3', 'cc-set-titel', 'Über'));
    box.appendChild(el('p', 'cc-set-text', 'Compliance-Plattform – Umbau. Diese Oberfläche ist neu und wird laufend erweitert.'));
    box.appendChild(setZeile('Stand', 'Testumgebung'));
    // HELL-Lauf 21.11. (B2): der fruehere Banner-Hinweis lebt jetzt NUR hier.
    // H10 (Julius 22.11.): Die Fortschrittsseite ist abgeschafft – hier steht
    // bewusst KEIN Link mehr, und es kommt auch keiner zurueck.
    box.appendChild(el('p', 'cc-leer-hinweis',
      'Du arbeitest in der Testumgebung – hier liegen nur Testdaten, nichts davon ist echt.'));
    box.appendChild(setZeile('Version', null));
    return box;
  }
  function setInhalt(id) {
    if (id === 'sprache') return setInhaltSprache();
    if (id === 'konto') return setInhaltKonto();
    if (id === 'team') return setInhaltTeam();
    if (id === 'ueber') return setInhaltUeber();
    return setInhaltAllgemein();
  }

  // Pane-Zustand (je Instanz): aktiver Abschnitt + die beiden Flaechen. setRender zeichnet nur neu.
  var setAktiv = 'allgemein';
  var setListeWrap = null, setInhaltWrap = null;
  function setRender(id) {
    setAktiv = id || setAktiv;
    if (setListeWrap) {
      var tabs = setListeWrap.childNodes;
      for (var i = 0; i < tabs.length; i++) {
        if (!tabs[i].getAttribute) continue;
        if (tabs[i].getAttribute('data-cc-set') === setAktiv) tabs[i].setAttribute('aria-current', 'page');
        else tabs[i].removeAttribute('aria-current');
      }
    }
    if (setInhaltWrap) {
      while (setInhaltWrap.firstChild) setInhaltWrap.removeChild(setInhaltWrap.firstChild);
      setInhaltWrap.appendChild(setInhalt(setAktiv));
    }
  }
  function einstellungenAnsicht() {
    setAktiv = 'allgemein';
    var wrap = el('div', 'cc-set');
    var kopf = el('div', 'cc-dash-kopf');
    kopf.appendChild(el('h2', 'cc-dash-titel', 'Einstellungen'));
    kopf.appendChild(el('p', 'cc-dash-unter', 'Alle Einstellungen an einem Ort.'));
    wrap.appendChild(kopf);

    var body = el('div', 'cc-set-body');
    setListeWrap = el('div', 'cc-set-liste');
    for (var i = 0; i < SET_ABSCHNITTE.length; i++) {
      var a = SET_ABSCHNITTE[i];
      var tab = el('button', 'cc-set-tab', a.label);
      tab.setAttribute('type', 'button');
      tab.setAttribute('data-cc-set', a.id);
      setListeWrap.appendChild(tab);
    }
    setListeWrap.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-cc-set]') : null;
      if (t) setRender(t.getAttribute('data-cc-set'));
    });
    body.appendChild(setListeWrap);
    setInhaltWrap = el('div', 'cc-set-inhalt');
    body.appendChild(setInhaltWrap);
    wrap.appendChild(body);

    setRender('allgemein');
    return wrap;
  }

  // ==========================================================================
  // S4a Tour – gefuehrte Rundreise auf echte UI-Elemente. Feste Schrittliste KI_TOUR; Weiter/Zurueck/
  // Beenden, Esc beendet; fehlt ein Ziel-Element -> Schritt ueberspringen (nicht abstuerzen). KEIN
  // Auto-Start, kein Browser-Speicher (kein Web-Storage). Die Karte haengt an der Leiste (#ccShell) und erbt deren
  // Stapel-Ebene (kein neues z-index); das jeweilige Ziel wird nur per CSS-Klasse umrandet (outline).
  // ==========================================================================
  var KI_TOUR = [
    { ziel: '#ccShell', titel: 'Deine Navigation', text: 'Links wechselst du zwischen Dashboard, Geschäftspartnern, Prüfung und mehr.' },
    { ziel: '.cc-dash-bedarf', titel: 'Handlungsbedarf', text: 'Diese Partner brauchen Aufmerksamkeit – rot ist kritisch, gelb zu prüfen.' },
    { ziel: '.cc-dash-briefing', titel: 'Tages-Briefing', text: 'Die wichtigsten Zahlen des Tages auf einen Blick.' },
    { ziel: '.cc-ki-feld', titel: 'Dein Assistent', text: 'Frag hier nach – er bedient die App und fragt vor jedem Schreiben nach.' },
    { ziel: '[data-cc-modul="pruefung"]', titel: 'Neue Prüfung', text: 'Hier startest du eine neue Firmen-Prüfung.' },
    { ziel: '[data-cc-modul="partner"]', titel: 'Geschäftspartner', text: 'Alle geprüften Firmen mit Akte und Verlauf.' }
  ];
  var kiTour = null;   // { index, karte, keydown } waehrend die Tour laeuft, sonst null.

  function kiTourZielEl(i) {
    var s = KI_TOUR[i];
    return (s && s.ziel) ? document.querySelector(s.ziel) : null;
  }
  function kiTourEntferneMarke() {
    var alt = document.querySelector('.cc-tour-ziel');
    if (alt) alt.classList.remove('cc-tour-ziel');
  }
  // Ab 'start' in Richtung +1/-1 den ersten Schritt mit vorhandenem Ziel finden; -1 wenn keiner.
  function kiTourNaechster(start, richtung) {
    for (var i = start; i >= 0 && i < KI_TOUR.length; i += richtung) if (kiTourZielEl(i)) return i;
    return -1;
  }
  function kiTourBaueKarte() {
    var s = KI_TOUR[kiTour.index];
    var karte = kiTour.karte;
    while (karte.firstChild) karte.removeChild(karte.firstChild);
    karte.appendChild(el('div', 'cc-tour-schritt', 'Schritt ' + (kiTour.index + 1) + ' von ' + KI_TOUR.length));
    karte.appendChild(el('div', 'cc-tour-titel', s.titel));
    karte.appendChild(el('p', 'cc-tour-text', s.text));
    var knoepfe = el('div', 'cc-tour-knoepfe');
    var beenden = el('button', 'cc-knopf cc-knopf-leise cc-tour-beenden', 'Beenden');
    beenden.setAttribute('type', 'button');
    beenden.addEventListener('click', kiTourBeenden);
    knoepfe.appendChild(beenden);
    if (kiTourNaechster(kiTour.index - 1, -1) >= 0) {
      var zur = el('button', 'cc-knopf cc-knopf-leise cc-tour-zurueck', 'Zurück');
      zur.setAttribute('type', 'button');
      zur.addEventListener('click', kiTourZurueck);
      knoepfe.appendChild(zur);
    }
    var weiterDa = kiTourNaechster(kiTour.index + 1, 1) >= 0;
    var weiter = el('button', 'cc-knopf cc-tour-weiter', weiterDa ? 'Weiter' : 'Fertig');
    weiter.setAttribute('type', 'button');
    weiter.addEventListener('click', weiterDa ? kiTourWeiter : kiTourBeenden);
    knoepfe.appendChild(weiter);
    karte.appendChild(knoepfe);
  }
  function kiTourZeige(index, richtung) {
    if (!kiTour) return;
    var i = kiTourNaechster(index, richtung);
    if (i < 0) { kiTourBeenden(); return; }
    kiTour.index = i;
    kiTourEntferneMarke();
    var ziel = kiTourZielEl(i);
    ziel.classList.add('cc-tour-ziel');
    if (ziel.scrollIntoView) { try { ziel.scrollIntoView({ block: 'center' }); } catch (e) {} }
    kiTourBaueKarte();
  }
  function kiTourWeiter() { if (kiTour) kiTourZeige(kiTour.index + 1, 1); }
  function kiTourZurueck() { if (kiTour) kiTourZeige(kiTour.index - 1, -1); }
  function kiTourBeenden() {
    if (!kiTour) return;
    kiTourEntferneMarke();
    // B4: Karte weich ausblenden, erst dann aus dem DOM (Mini-DOM: sofort).
    if (kiTour.karte) ausblendenDann(kiTour.karte, 'fade', entfernen);
    if (kiTour.keydown) document.removeEventListener('keydown', kiTour.keydown);
    kiTour = null;
  }
  function kiStarteTour() {
    if (kiTour) kiTourBeenden();                 // laufende Tour sauber beenden (kein Doppel-Overlay)
    var erste = kiTourNaechster(0, 1);
    if (erste < 0) return;                        // kein einziges Ziel da -> nichts tun, nicht abstuerzen
    var huelle = document.getElementById('ccShell') || document.body;   // erbt deren Stapel-Ebene
    var karte = el('aside', 'cc-tour');
    karte.setAttribute('data-cc-tour', '1');
    karte.setAttribute('role', 'dialog');
    karte.setAttribute('aria-label', 'Geführte Tour');
    huelle.appendChild(karte);
    einblenden(karte, 'pop');              // B4: Tour-Karte poppt weich auf
    function aufEsc(ev) { if (ev.key === 'Escape' || ev.key === 'Esc') { if (ev.preventDefault) ev.preventDefault(); kiTourBeenden(); } }
    document.addEventListener('keydown', aufEsc);
    kiTour = { index: 0, karte: karte, keydown: aufEsc };
    kiTourZeige(erste, 1);
  }

  // ---- „Zur Akte dieses Geschäftspartners" (erscheint, wenn #report aktiv ist) ----
  var zurAkteBtn = null;
  var AKTE_NACHZUG_MAX = 12;   // begrenzter Nachzug (~1.8 s) nach dem app-eigenen Laden, dann Schluss.

  // #report ist „aktiv", wenn es sichtbar ist und Inhalt hat (ein Bericht steht). Nur lesen, kein DOM-Text.
  function reportAktiv() {
    var r = document.getElementById('report');
    return !!(r && r.offsetParent !== null && r.childNodes && r.childNodes.length > 0);
  }
  // S8 Saubere Pruef-ID des gerade gezeigten Berichts: aus dem data-pid-Attribut der App (v12.74:
  // #monBereich .mon-btn[data-pid]), NICHT aus sichtbarem Text geschabt. Nicht vorhanden -> null.
  function pruefIdAusReport() {
    var r = document.getElementById('report');
    if (!r) return null;
    var knoten = r.querySelector('[data-pid]');
    var pid = knoten && knoten.getAttribute('data-pid');
    pid = (pid == null) ? '' : String(pid).trim();
    return pid ? pid : null;
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
  // S8 Zeigt die Akte zum Partner mit dieser Pruef-ID; ohne Treffer (oder ohne Pruef-ID) die neueste Akte.
  function zeigeAkteFuer(pruefId) {
    var zeilen = brueckeZeilen();
    var g = pruefId ? gruppeMitPruefId(zeilen, pruefId) : null;
    if (!g) g = partnerGruppen(zeilen)[0] || null;
    if (g) zeigeInhalt(partnerAkteAnsicht(g.key));
    else zeigeInhalt(partnerLeer());
  }
  // Nach dem app-eigenen (asynchronen) Laden kommt die frische Zeile verspaetet an: begrenzt oft nachsehen
  // und die Akte neu zeigen, sobald sich der Stempel aendert. Kein Dauerlauf (max. AKTE_NACHZUG_MAX).
  function akteNachzug(versuch, stempel, pruefId) {
    if (versuch >= AKTE_NACHZUG_MAX) return;
    setTimeout(function () {
      if (AKTIV !== 'partner') return;                 // Nutzer hat weitergeklickt -> aufhoeren
      var jetzt = akteStempel();
      if (jetzt !== stempel) { zeigeAkteFuer(pruefId); stempel = jetzt; }
      akteNachzug(versuch + 1, stempel, pruefId);
    }, 150);
  }
  // Zur Akte des zuletzt gepruefften Partners: die App frisch laden lassen (app-eigene Aenderung an
  // HISTORY_ROWS – die Shell schreibt nichts) und die Akte des Berichts zeigen. Der Partner kommt aus der
  // STABILEN Pruef-ID des Berichts (data-pid), sonst aus der neuesten Zeile der Bruecke – NIE aus DOM-Text.
  function zurAkte() {
    var pruefId = pruefIdAusReport();                  // stabile Pruef-ID des Berichts (data-pid)
    var btn = document.querySelector('#historyBtn');
    if (btn && btn.offsetParent !== null) { try { btn.click(); } catch (e) {} }   // App laedt die Historie neu
    setzeAktiv('partner');
    document.body.classList.remove('cc-shell-auf');
    aktualisiereZurAkte();                             // Knopf ausblenden (Partner-Modul aktiv)
    zeigeAkteFuer(pruefId);
    akteNachzug(0, akteStempel(), pruefId);
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
    // P6: Modulwechsel schliesst eine offene Kommando-Palette (egal von wo er kommt).
    if (kmdBackdrop && kmdBackdrop.classList.contains('cc-auf')) schliesseKommandoPalette();
    setzeAktiv(modId);
    setzeBrotkrume(mod.label);
    // Auf Mobil die ausgeklappte Leiste schliessen.
    document.body.classList.remove('cc-shell-auf');

    if (mod.art === 'leer') { zeigeInhalt(leerKarte(mod)); aktualisiereZurAkte(); return; }
    if (mod.art === 'dashboard') { zeigeInhalt(dashboardAnsicht()); aktualisiereZurAkte(); return; }
    if (mod.art === 'berichte') { zeigeInhalt(berichteAnsicht()); aktualisiereZurAkte(); return; }
    if (mod.art === 'monitoring') { zeigeInhalt(monitoringAnsicht()); aktualisiereZurAkte(); return; }
    if (mod.art === 'ki') { zeigeInhalt(kiAnsicht()); aktualisiereZurAkte(); return; }
    if (mod.art === 'einstellungen') { zeigeInhalt(einstellungenAnsicht()); aktualisiereZurAkte(); return; }
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

  // ==========================================================================
  // Kommando-Palette (⌘K) + Toasts. Globaler Einstieg: zu einem Modul wechseln,
  // Assistent, Tour. Reiner Shell-Einstieg – er umgeht KEINE Bestaetigung (jedes
  // Schreiben bleibt hinter der KI-Karte „Ja, ausfuehren"). Nur DOM-APIs, kein
  // innerHTML, keine Inline-Stile, kein Web-Storage. Interaktiv nur im Browser; im
  // Mini-DOM der Tests wird die Palette gebaut, aber nie geoeffnet.
  // ==========================================================================
  var kmdBackdrop = null, kmdInput = null, kmdListe = null, kmdEintraege = [], kmdAktiv = -1;
  var kmdOeffner = null;   // Element, das die Palette geoeffnet hat -> Fokus kehrt beim Schliessen dorthin zurueck (a11y).
  var toastWrap = null;

  function kmdBefehle() {
    var out = [];
    for (var i = 0; i < MODULE.length; i++) {
      (function (m) {
        out.push({ gruppe: 'Gehe zu', label: m.label, icon: m.icon, tun: function () { waehle(m.id, false); } });
      })(MODULE[i]);
    }
    out.push({ gruppe: 'Aktionen', label: 'Assistent fragen', icon: ICON.ki, tun: function () { waehle('ki', false); } });
    out.push({ gruppe: 'Aktionen', label: 'Tour starten', icon: ICON.welt, tun: function () { waehle('dashboard', false); kiStarteTour(); } });
    // D10: Design/Theme direkt aus der Palette umschalten.
    out.push({ gruppe: 'Design', label: 'Design: Hell', icon: ICON.design, tun: function () { themaSetzen('hell'); } });
    out.push({ gruppe: 'Design', label: 'Design: Dunkel', icon: ICON.design, tun: function () { themaSetzen('dunkel'); } });
    out.push({ gruppe: 'Design', label: 'Design: System', icon: ICON.design, tun: function () { themaSetzen('system'); } });
    return out;
  }

  // (B3: kmdKnopf() entfiel – der Palette-Oeffner ist jetzt das Suchfeld in der
  // Seitenleiste, gebaut direkt in baueShell.)

  function kmdMarkiere() {
    for (var i = 0; i < kmdEintraege.length; i++) {
      if (i === kmdAktiv) kmdEintraege[i].classList.add('cc-aktiv');
      else kmdEintraege[i].classList.remove('cc-aktiv');
    }
  }
  function kmdBewege(d) {
    if (!kmdEintraege.length) return;
    kmdAktiv = (kmdAktiv + d + kmdEintraege.length) % kmdEintraege.length;
    kmdMarkiere();
    var akt = kmdEintraege[kmdAktiv];
    if (akt && akt.scrollIntoView) akt.scrollIntoView({ block: 'nearest' });
  }
  function kmdFuehreAus(cmd) {
    schliesseKommandoPalette();
    if (cmd && typeof cmd.tun === 'function') cmd.tun();
    zeigeToast('→ ' + (cmd && cmd.label ? cmd.label : ''));
  }
  function kmdRender(filter) {
    var f = String(filter == null ? '' : filter).trim().toLowerCase();
    while (kmdListe.firstChild) kmdListe.removeChild(kmdListe.firstChild);
    kmdEintraege = [];
    var befehle = kmdBefehle().filter(function (c) { return !f || c.label.toLowerCase().indexOf(f) >= 0; });
    if (!befehle.length) {
      kmdListe.appendChild(el('div', 'cc-kpalette-leer', 'Nichts gefunden.'));
      kmdAktiv = -1;
      return;
    }
    var letzteGruppe = null;
    for (var i = 0; i < befehle.length; i++) {
      var c = befehle[i];
      if (c.gruppe !== letzteGruppe) { kmdListe.appendChild(el('div', 'cc-kpalette-gruppe', c.gruppe)); letzteGruppe = c.gruppe; }
      var row = el('button', 'cc-kpalette-eintrag');
      row.setAttribute('type', 'button');
      row.appendChild(icon(c.icon, 18));
      row.appendChild(el('span', 'cc-kpalette-label', c.label));
      (function (cmd) { row.addEventListener('click', function () { kmdFuehreAus(cmd); }); })(c);
      kmdListe.appendChild(row);
      kmdEintraege.push(row);
    }
    kmdAktiv = 0;
    kmdMarkiere();
  }

  function baueKommandoPalette() {
    kmdBackdrop = el('div', 'cc-kbackdrop');
    kmdBackdrop.setAttribute('role', 'dialog');
    kmdBackdrop.setAttribute('aria-modal', 'true');
    kmdBackdrop.setAttribute('aria-label', 'Befehle');
    var pal = el('div', 'cc-kpalette');
    var such = el('div', 'cc-kpalette-suchzeile');
    such.appendChild(icon(ICON.suche, 18));
    kmdInput = el('input', 'cc-kpalette-input');
    kmdInput.setAttribute('type', 'text');
    kmdInput.setAttribute('placeholder', 'Befehl oder Seite suchen …');
    kmdInput.setAttribute('aria-label', 'Befehl oder Seite suchen');
    such.appendChild(kmdInput);
    pal.appendChild(such);
    kmdListe = el('div', 'cc-kpalette-liste');
    pal.appendChild(kmdListe);
    // P6: sichtbare Tastatur-Hinweise (Fusszeile macht auch das Listenende eindeutig).
    var fuss = el('div', 'cc-kpalette-fuss');
    fuss.setAttribute('aria-hidden', 'true');
    var hintDefs = [['↑↓', 'wählen'], ['↵', 'öffnen'], ['esc', 'schließen']];
    for (var hi = 0; hi < hintDefs.length; hi++) {
      var hint = el('span', 'cc-kpalette-hinweis');
      hint.appendChild(el('span', 'cc-kbd', hintDefs[hi][0]));
      hint.appendChild(el('span', null, hintDefs[hi][1]));
      fuss.appendChild(hint);
    }
    pal.appendChild(fuss);
    kmdBackdrop.appendChild(pal);
    document.body.appendChild(kmdBackdrop);

    kmdInput.addEventListener('input', function () { kmdRender(kmdInput.value); });
    kmdInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { if (ev.preventDefault) ev.preventDefault(); kmdBewege(1); }
      else if (ev.key === 'ArrowUp') { if (ev.preventDefault) ev.preventDefault(); kmdBewege(-1); }
      else if (ev.key === 'Enter') { if (ev.preventDefault) ev.preventDefault(); if (kmdAktiv >= 0 && kmdEintraege[kmdAktiv]) kmdEintraege[kmdAktiv].click(); }
      else if (ev.key === 'Escape' || ev.key === 'Esc') { if (ev.preventDefault) ev.preventDefault(); schliesseKommandoPalette(); }
    });
    kmdBackdrop.addEventListener('click', function (ev) { if (ev.target === kmdBackdrop) schliesseKommandoPalette(); });
    // Globaler ⌘K/Strg+K-Umschalter (Dokument-Ebene; im Mini-DOM ein No-op-Listener).
    document.addEventListener('keydown', function (ev) {
      var k = ev.key;
      if ((ev.metaKey || ev.ctrlKey) && (k === 'k' || k === 'K')) {
        if (ev.preventDefault) ev.preventDefault();
        if (kmdBackdrop.classList.contains('cc-auf')) schliesseKommandoPalette(); else oeffneKommandoPalette();
      } else if ((k === 'Escape' || k === 'Esc') && kmdBackdrop.classList.contains('cc-auf')) {
        // Esc schliesst die Palette auch, wenn der Fokus (aus welchem Grund auch immer) nicht im Suchfeld liegt.
        if (ev.preventDefault) ev.preventDefault();
        schliesseKommandoPalette();
      }
    });
  }
  function oeffneKommandoPalette() {
    if (!kmdBackdrop) return;
    // a11y: das aktuell fokussierte Element merken, damit der Fokus beim Schliessen dorthin zurueckkehrt.
    var akt = document.activeElement;
    kmdOeffner = (akt && akt !== document.body && akt.focus) ? akt : null;
    kmdInput.value = '';
    kmdRender('');
    kmdBackdrop.classList.add('cc-auf');
    document.body.classList.remove('cc-shell-auf');
    // Fokus ins Suchfeld. Die Palette blendet per visibility/opacity-Transition ein; ruft man .focus()
    // im selben Tick, ist das Feld noch nicht „stabil" und der Fokus landet nicht zuverlaessig. Darum
    // sofort UND nach dem naechsten Frame fokussieren (wenn die Einblendung committed ist).
    // B3-Fix: nur fokussieren, solange die Palette WIRKLICH noch offen ist – ein sehr
    // schnelles Escape (Palette schon zu, Fokus beim Oeffner) darf vom nachlaufenden
    // rAF nicht wieder ins (unsichtbare) Suchfeld umgelenkt werden.
    var fokussiere = function () {
      if (kmdBackdrop && kmdBackdrop.classList.contains('cc-auf') && kmdInput && kmdInput.focus) kmdInput.focus();
    };
    fokussiere();
    // Doppel-rAF: erst wenn die Einblendung wirklich committed ist, haelt der Fokus
    // zuverlaessig (die visibility schaltet beim Oeffnen jetzt ohne Verzoegerung um).
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { fokussiere(); requestAnimationFrame(fokussiere); });
    }
  }
  function schliesseKommandoPalette() {
    if (!kmdBackdrop) return;
    var warOffen = kmdBackdrop.classList.contains('cc-auf');
    kmdBackdrop.classList.remove('cc-auf');
    // a11y: Fokus zurueck zum Oeffner (z. B. ⌘K-Knopf), nicht ins Leere.
    if (warOffen && kmdOeffner && kmdOeffner.focus) { try { kmdOeffner.focus(); } catch (e) {} }
    kmdOeffner = null;
  }

  function baueToasts() {
    toastWrap = el('div', 'cc-toasts');
    toastWrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastWrap);
  }
  function zeigeToast(text) {
    if (!toastWrap) return;
    var t = el('div', 'cc-toast');
    t.appendChild(icon(ICON.haken, 16));
    t.appendChild(el('span', null, String(text == null ? '' : text)));
    toastWrap.appendChild(t);
    if (typeof setTimeout === 'function') {
      setTimeout(function () { t.classList.add('cc-auf'); }, 20);
      // B4: weich raus – erst die Aus-Animation, DANN aus dem DOM (nie hart entfernen).
      setTimeout(function () { ausblendenDann(t, 'fade', entfernen); }, 2600);
    } else {
      t.classList.add('cc-auf');
    }
  }

  // ---- Aufbau der Shell-DOM (einmalig) ----
  function baueShell() {
    // Mobiler Kopfbalken: Umschalter + Marke + ⌘K/Suche.
    var balken = el('div', 'cc-shell-balken');
    var umschalter = el('button', 'cc-shell-umschalter');
    umschalter.setAttribute('type', 'button');
    umschalter.setAttribute('aria-label', 'Navigation umschalten');
    umschalter.setAttribute('data-cc-toggle', '1');
    umschalter.appendChild(icon(ICON.menue, 22));
    balken.appendChild(umschalter);
    var balkenMarke = el('div', 'cc-shell-balken-marke');
    balkenMarke.appendChild(logoKnoten('balken'));
    // Nur ohne echtes Logo braucht der Balken eine Text-Wortmarke (das echte Logo
    // traegt die Wortmarke bereits selbst).
    if (!logoQuelle()) balkenMarke.appendChild(el('span', 'cc-shell-balken-titel', 'Compliance'));
    balken.appendChild(balkenMarke);
    var balkenRechts = el('div', 'cc-shell-balken-rechts');
    var balkenSuche = el('button', 'cc-shell-balken-knopf');
    balkenSuche.setAttribute('type', 'button');
    balkenSuche.setAttribute('aria-label', 'Befehle und Suche öffnen');
    balkenSuche.appendChild(icon(ICON.suche, 22));
    balkenSuche.addEventListener('click', function () { oeffneKommandoPalette(); });
    balkenRechts.appendChild(balkenSuche);
    balken.appendChild(balkenRechts);

    // Seitenleiste.
    var nav = el('nav', 'cc-shell');
    nav.id = 'ccShell';
    nav.setAttribute('aria-label', 'Hauptnavigation');

    // B3 Logo-Zeile: echtes CC-Logo links, Collapse-Knopf rechts in derselben Zeile
    // (eingeklappt stellt CSS die Zeile untereinander und zentriert beides).
    var marke = el('div', 'cc-shell-marke');
    marke.appendChild(logoKnoten('leiste'));
    // Text-Wortmarke IMMER im DOM: beim echten Logo versteckt CSS sie im Hellen
    // (das Logo traegt die Worte selbst) und zeigt sie im Dunkeln neben dem
    // Bildzeichen (B8 – die dunkle PNG-Wortmarke waere auf Dunkel unsichtbar).
    var markeText = el('div', 'cc-shell-marke-text');
    markeText.appendChild(el('span', 'cc-shell-wort', 'Compliance'));
    markeText.appendChild(el('span', 'cc-shell-sub', 'Checker'));
    marke.appendChild(markeText);
    var collapse = el('button', 'cc-shell-collapse');
    collapse.setAttribute('type', 'button');
    collapse.setAttribute('aria-label', 'Seitenleiste ein- oder ausklappen');
    collapse.appendChild(icon(ICON.pfeilLinks, 18));
    collapse.addEventListener('click', function () {
      railWahl = true;
      var schmal = document.body.classList.toggle('cc-shell-schmal');
      leisteSpeichern(schmal ? 'schmal' : 'breit');   // B3: Wahl bleibt ueber Sitzungen erhalten
    });
    marke.appendChild(collapse);
    nav.appendChild(marke);

    // B3 Suche/⌘K-Feld wie bei Linear: ein Knopf in Eingabefeld-Optik, oeffnet die
    // Kommando-Palette. Traegt die bisherige Klasse cc-kmd-knopf (Palette-Oeffner,
    // Fokus-Rueckkehr-Ziel der Tests) – der fruehere Topbar-Knopf entfaellt dafuer.
    // a11y (WCAG 2.5.3 Label-in-Name): KEIN aria-label – der sichtbare Text
    // („Suchen" + ⌘K) ist der Accessible-Name.
    var suche = el('button', 'cc-kmd-knopf cc-leiste-suche');
    suche.setAttribute('type', 'button');
    suche.appendChild(icon(ICON.suche, 16));
    suche.appendChild(el('span', 'cc-kmd-label', 'Suchen'));
    suche.appendChild(el('span', 'cc-kbd', '⌘K'));
    suche.addEventListener('click', function () { oeffneKommandoPalette(); });
    nav.appendChild(suche);

    // S4c: Nav in Unterbereiche (NAV_GRUPPEN) gruppiert; Reihenfolge = MODULE-Reihenfolge. Ein normaler
    // Nav-Eintrag je Modul (data-cc-modul). Das Modul FUSS_ID (einstellungen) kommt NICHT in eine Gruppe,
    // sondern unten in den Konto-Fuss (Account unten links, wie bei Claude).
    // B3: kein title-Attribut mehr (es doppelte den neuen Glas-Tooltip als natives
    // Browser-Tooltip). Der Accessible-Name bleibt IMMER der Label-Text: das Label
    // wird eingeklappt nur per opacity/max-width versteckt (nie display:none) und
    // steht damit weiter im A11y-Baum. data-cc-tip speist den CSS-Tooltip.
    function navEintrag(mod) {
      var b = el('button', 'cc-nav-eintrag');
      b.setAttribute('type', 'button');
      b.setAttribute('data-cc-modul', mod.id);
      b.setAttribute('data-cc-tip', mod.label);
      b.appendChild(icon(mod.icon, 18));
      b.appendChild(el('span', 'cc-nav-label', mod.label));
      navKnoepfe[mod.id] = b;
      return b;
    }
    // B3: Die Gruppen leben in einem eigenen Scroll-Bereich; Logo-Zeile, Suche und
    // Nutzerkarte bleiben stehen (Linear-Muster). WICHTIG: .cc-shell selbst hat darum
    // overflow: visible – nur so entkommen die fixed-positionierten Glas-Tooltips dem
    // backdrop-filter-Containing-Block, ohne abgeschnitten zu werden.
    var scroll = el('div', 'cc-shell-scroll');
    for (var gi = 0; gi < NAV_GRUPPEN.length; gi++) {
      var grp = NAV_GRUPPEN[gi];
      var gbox = el('div', 'cc-nav-gruppe');
      gbox.appendChild(el('div', 'cc-nav-gruppe-titel', grp.titel));
      for (var mi = 0; mi < grp.ids.length; mi++) {
        var gm = findeModul(grp.ids[mi]);
        if (gm) gbox.appendChild(navEintrag(gm));
      }
      scroll.appendChild(gbox);
    }
    nav.appendChild(scroll);

    // B3 Nutzerkarte ganz unten: das einstellungen-Modul als Konto-Karte (Avatar +
    // Name + Unterzeile + Paket-Label, sofern die App eines liefert – nichts erfinden).
    // Traegt weiter data-cc-modul="einstellungen" (bleibt das 8. Modul, nur unten platziert).
    // a11y (WCAG 2.5.3): KEIN title/aria-label – der sichtbare Text („Konto" + Unterzeile)
    // IST der Accessible-Name; eingeklappt wird er nur per opacity/max-width versteckt
    // (bleibt im A11y-Baum). Der Avatar-SVG ist aria-hidden. Der Glas-Tooltip kommt wie
    // bei den Nav-Eintraegen aus data-cc-tip.
    var fuss = el('div', 'cc-shell-fuss');
    var fussZeile = el('div', 'cc-shell-fuss-zeile');
    var fussMod = findeModul(FUSS_ID);
    if (fussMod) {
      var kb = el('button', 'cc-konto-knopf');
      kb.setAttribute('type', 'button');
      kb.setAttribute('data-cc-modul', fussMod.id);
      kb.setAttribute('data-cc-tip', 'Konto – ' + fussMod.label);
      var avatar = el('div', 'cc-konto-avatar');
      avatar.appendChild(icon(ICON.person, 18));
      kb.appendChild(avatar);
      var ktext = el('div', 'cc-konto-text');
      ktext.appendChild(el('div', 'cc-konto-name', 'Konto'));
      ktext.appendChild(el('div', 'cc-konto-unter', fussMod.label));
      kb.appendChild(ktext);
      // S6-Paketanzeige (read-only): nur wenn die App das Paket in einem stabilen
      // Attribut bereitstellt; sonst KEIN Label (nichts erfinden, kein Platzhalter im Fuss).
      var paket = paketLabel(paketLesen());
      if (paket) kb.appendChild(el('span', 'cc-konto-paket', paket));
      navKnoepfe[fussMod.id] = kb;
      fussZeile.appendChild(kb);
    }
    fuss.appendChild(fussZeile);
    nav.appendChild(fuss);

    // Inhaltsflaeche: persistente Topbar (Brotkrume + ⌘K) + scrollender Innenbereich.
    inhaltWrap = el('div', 'cc-shell-modul-wrap');
    inhaltWrap.id = 'ccShellModul';
    inhaltWrap.setAttribute('data-cc-sichtbar', '0');
    var topbar = el('div', 'cc-topbar');
    var brot = el('div', 'cc-brotkrumen');
    brot.setAttribute('aria-hidden', 'true');   // reiner Kontext; das Modul traegt die H1
    brot.appendChild(el('span', 'cc-brotkrumen-wurzel', 'Compliance'));
    brot.appendChild(el('span', 'cc-brotkrumen-trenner', '/'));
    brotkrumeJetzt = el('span', 'cc-brotkrumen-jetzt', 'Dashboard');
    brot.appendChild(brotkrumeJetzt);
    topbar.appendChild(brot);
    // B3: Der ⌘K-Knopf ist aus der Topbar in die Seitenleiste gewandert (Suche wie
    // bei Linear). Die Topbar traegt nur noch die Brotkrume – ruhig und flach.
    inhaltWrap.appendChild(topbar);
    var inhaltScroll = el('div', 'cc-inhalt');
    inhaltInnen = el('div', 'cc-inhalt-innen');
    inhaltScroll.appendChild(inhaltInnen);
    // B4: Geist-Ebene fuer den Crossfade des Seitenwechsels (alter Inhalt blendet hier aus).
    geistSchicht = el('div', 'cc-inhalt-geist');
    geistSchicht.setAttribute('aria-hidden', 'true');
    inhaltScroll.appendChild(geistSchicht);
    inhaltScrollEl = inhaltScroll;
    inhaltWrap.appendChild(inhaltScroll);

    // Mobil-Drawer-Backdrop (schliesst die Leiste bei Tipp daneben; nur mobil sichtbar via CSS).
    var backdrop = el('div', 'cc-shell-backdrop');
    backdrop.addEventListener('click', function () { document.body.classList.remove('cc-shell-auf'); });

    // DOM-Reihenfolge fuer gleiche z-Ebene (Vorschau 10000): Inhalt < Backdrop < Leiste.
    // Im Normal-Betrieb entscheidet ohnehin der z-index (Leiste 9000 > Backdrop 8900 > Inhalt 8000).
    document.body.appendChild(balken);
    document.body.appendChild(inhaltWrap);
    document.body.appendChild(backdrop);
    document.body.appendChild(nav);
    baueKommandoPalette();
    baueToasts();

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
      var wirdOffen = !document.body.classList.contains('cc-shell-auf');
      document.body.classList.toggle('cc-shell-auf');
      // a11y: beim Oeffnen Fokus in die Leiste (erstes Nav-Element) setzen.
      if (wirdOffen) {
        var erstes = nav.querySelector('[data-cc-modul]');
        if (erstes && erstes.focus) { try { erstes.focus(); } catch (e) {} }
      }
    });

    // Mobil-Drawer a11y: Esc schliesst und gibt den Fokus an den Umschalter zurueck; Tab bleibt in der
    // Leiste (Fokus-Falle), solange der Drawer offen ist. Ist die ⌘K-Palette offen, macht die ihr Esc/Tab
    // selbst -> hier nichts tun. Nur Tastatur; auf Desktop ist der Drawer ohnehin nicht „auf".
    function drawerFokusierbare() {
      var alle = nav.querySelectorAll('button, [href], input, select, textarea, [tabindex]');
      var raus = [];
      for (var i = 0; i < alle.length; i++) {
        var e = alle[i];
        if (e.getAttribute && e.getAttribute('tabindex') === '-1') continue;
        if (e.disabled) continue;
        // sichtbar (im echten Browser offsetParent!=null; im Mini-DOM ist offsetParent undefined -> mitnehmen)
        if (e.offsetParent === null && e !== document.activeElement) continue;
        raus.push(e);
      }
      return raus;
    }
    document.addEventListener('keydown', function (ev) {
      if (!document.body.classList.contains('cc-shell-auf')) return;             // Drawer zu
      if (kmdBackdrop && kmdBackdrop.classList.contains('cc-auf')) return;        // Palette hat Vorrang
      var k = ev.key;
      if (k === 'Escape' || k === 'Esc') {
        if (ev.preventDefault) ev.preventDefault();
        document.body.classList.remove('cc-shell-auf');
        if (umschalter.focus) { try { umschalter.focus(); } catch (e) {} }
        return;
      }
      if (k === 'Tab') {
        var f = drawerFokusierbare();
        if (!f.length) return;
        var erst = f[0], letzt = f[f.length - 1];
        if (ev.shiftKey && document.activeElement === erst) { if (ev.preventDefault) ev.preventDefault(); if (letzt.focus) letzt.focus(); }
        else if (!ev.shiftKey && document.activeElement === letzt) { if (ev.preventDefault) ev.preventDefault(); if (erst.focus) erst.focus(); }
      }
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

  // P2: Tablet-Rail. Zwischen 768 und 1023 px startet die Leiste schmal (Icon-Rail),
  // damit der Inhalt nutzbare Breite behaelt. Klappt der Nutzer selbst (Collapse-
  // Knopf), gilt seine Wahl fuer die Sitzung (kein Web-Storage, B5-Regel).
  var railWahl = false;
  var railMq = null;
  try { railMq = window.matchMedia ? window.matchMedia('(min-width: 768px) and (max-width: 1023.98px)') : null; } catch (e) { railMq = null; }
  function railAnwenden() {
    // Nutzerwahl (Klick in dieser Sitzung ODER gespeicherte Wahl) schlaegt die Rail-Automatik.
    if (railWahl || leisteGespeichert() || !railMq) return;
    document.body.classList.toggle('cc-shell-schmal', !!railMq.matches);
  }
  // B3: beim Start zuerst die gespeicherte Wahl anwenden, sonst Rail-Automatik.
  function leisteAnwenden() {
    var gespeichert = leisteGespeichert();
    if (gespeichert) { document.body.classList.toggle('cc-shell-schmal', gespeichert === 'schmal'); return; }
    railAnwenden();
  }
  try {
    if (railMq) {
      if (railMq.addEventListener) railMq.addEventListener('change', railAnwenden);
      else if (railMq.addListener) railMq.addListener(railAnwenden);
    }
  } catch (e) {}

  function start() {
    stilEinspielen();
    // P8: Marker "Shell ist vorhanden" (unabhaengig von Sichtbarkeit) – shell.css kann
    // damit die Legacy-Ladephase beruhigen (schwebende Knoepfe aus), ohne Legacy-Edit.
    try { document.body.classList.add('cc-shell-da'); } catch (e) {}
    baueShell();
    leisteAnwenden();
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
