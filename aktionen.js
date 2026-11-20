// E4 Event-Delegation (ersetzt alle Inline-Handler, CLAUDE.md / strikte CSP).
// Pro Event-Typ EIN Listener am document. Dispatch ueber das Attribut data-act-<typ>
// an die Registry AKTIONEN { key: funktion }. Parameter kommen ausschliesslich ueber
// data-*-Attribute (dataset) – nie ueber zusammengesetzten Code. Kein eval, kein
// new Function, kein setTimeout mit String.
//
// Semantik-Treue zu Inline-Handlern:
//  - Der Handler laeuft mit this = dem Element, das data-act-<typ> traegt, und event = Event.
//  - Bubbling: vom Ziel aufwaerts wird der naechste Treffer je Ebene gefeuert (Bubble-
//    Reihenfolge); stopPropagation() (event.cancelBubble) stoppt die weitere Aufwaertssuche.
//  - return false  -> event.preventDefault() (wie "onclick=\"return f()\"").
//  - focus/blur laufen ueber focusin/focusout (die bubbeln); scroll/load ueber die
//    Capture-Phase (sie bubbeln nicht).
//
// Diese Datei wird als eigenes klassisches Script ausgeliefert (dist/aktionen.js) und VOR
// dist/app.js geladen. Sie definiert nur Globals (escapeAttr, registriere, AKTIONEN); die
// konkreten Registry-Eintraege erzeugt der Build aus den frueheren Inline-Handlern.
(function (global) {
  'use strict';

  // Attributsicheres Escapen fuer Werte, die als data-*-Attribut in JS-erzeugte HTML-Strings
  // fliessen. Deckt Anfuehrungszeichen, Winkel, kaufm. Und und Zeilenumbrueche ab, damit ein
  // Wert den Attributkontext nicht verlassen kann (XSS-Lehre K15-01/K15-02: der Wert darf
  // nirgends als ausfuehrbarer Code landen, nur als Daten im dataset).
  function escapeAttr(wert) {
    return String(wert == null ? '' : wert)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r/g, '&#13;')
      .replace(/\n/g, '&#10;')
      .replace(/\t/g, '&#9;');
  }

  var AKTIONEN = Object.create(null);
  function registriere(key, fn) { AKTIONEN[key] = fn; }

  // Event-Typ (= Attributsuffix) -> tatsaechlicher Listener-Name.
  var LISTENER = {
    click: 'click', change: 'change', input: 'input', keydown: 'keydown',
    mousedown: 'mousedown', dragover: 'dragover', dragleave: 'dragleave', drop: 'drop',
    focus: 'focusin', blur: 'focusout', scroll: 'scroll', load: 'load'
  };
  // Nicht-bubbelnde Events ueber die Capture-Phase einfangen.
  var CAPTURE = { scroll: true, load: true };

  function dispatch(typ, event) {
    var node = event.target;
    while (node && node.nodeType === 1) {
      var key = node.getAttribute ? node.getAttribute('data-act-' + typ) : null;
      if (key) {
        var fn = AKTIONEN[key];
        if (fn) {
          var r = fn.call(node, event);
          if (r === false && typeof event.preventDefault === 'function') event.preventDefault();
        }
      }
      if (event.cancelBubble) break;   // stopPropagation() – nicht weiter aufwaerts
      node = node.parentNode;
    }
  }

  function aktiviere(dok) {
    dok = dok || (typeof document !== 'undefined' ? document : null);
    if (!dok || !dok.addEventListener) return;
    Object.keys(LISTENER).forEach(function (typ) {
      dok.addEventListener(LISTENER[typ], function (event) { dispatch(typ, event); }, !!CAPTURE[typ]);
    });
  }

  // Globals bereitstellen (app.js und die generierte Registry greifen darauf zu).
  global.escapeAttr = escapeAttr;
  global.AKTIONEN = AKTIONEN;
  global.registriere = registriere;
  global.__aktionenDispatch = dispatch;        // nur fuer Tests
  global.__aktionenAktivieren = aktiviere;

  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { aktiviere(document); });
    } else {
      aktiviere(document);
    }
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
