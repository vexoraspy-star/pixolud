import type { ScriptData } from "./script";

/**
 * Le bac a sable des jeux Game Script.
 *
 * Le code d'un joueur est du code que PERSONNE n'a relu. Il tourne donc dans
 * une page isolee, construite ici, avec trois barrieres qui ne dependent pas
 * de ce que le code fait :
 *
 * 1. `sandbox="allow-scripts"` SANS `allow-same-origin` : la page a une
 *    origine opaque. Elle ne peut donc ni lire nos cookies, ni notre
 *    stockage, ni toucher au DOM du site, ni utiliser la session Supabase.
 *    C'est la barriere principale — tout le reste est du confort.
 * 2. Une politique de securite de contenu qui coupe le reseau
 *    (`default-src 'none'`) : pas d'appel vers l'exterieur, pas d'image
 *    distante, donc aucune fuite possible et aucun traceur.
 * 3. Un signal de vie : le jeu dit « je suis la » toutes les 700 ms. Quand
 *    le signal s'arrete, le site l'affiche et propose de relancer. Honnetete
 *    sur ce point : JavaScript ne permet pas d'interrompre une boucle
 *    infinie de l'exterieur. Selon le navigateur, le cadre bloque peut figer
 *    l'onglet entier — il faut alors le fermer. Le reste du site, lui, ne
 *    risque rien : le programme n'a acces a rien.
 *
 * Le code du joueur n'a JAMAIS acces a `window` en direct : il est appele
 * avec les seules fonctions de `pixo`.
 */

/** Le jeu envoie « je suis vivant » a cette cadence (millisecondes). */
export const HEARTBEAT_MS = 700;
/** Au-dela, on considere que le programme est bloque. */
export const HEARTBEAT_TIMEOUT_MS = 2500;

function echapper(code: string): string {
  // Le code part dans un attribut srcdoc : il ne doit jamais fermer la
  // balise <script> qui l'entoure.
  return code.replace(/<\/script/gi, "<\\/script");
}

/** La page complete du bac a sable, prete pour l'attribut srcdoc. */
export function sandboxHtml(data: ScriptData): string {
  const largeur = Math.round(data.width);
  const hauteur = Math.round(data.height);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval'; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<style>
  html, body { margin: 0; height: 100%; background: #05060a; overflow: hidden; }
  body { display: grid; place-items: center; }
  canvas { max-width: 100%; max-height: 100%; image-rendering: auto; touch-action: none; background: #05060a; }
  #erreur { position: fixed; inset: auto 0 0 0; padding: 10px 12px; font: 12px/1.5 ui-monospace, monospace; color: #ffb4bb; background: #40121a; white-space: pre-wrap; }
</style>
</head>
<body>
<canvas id="scene" width="${largeur}" height="${hauteur}"></canvas>
<div id="erreur" hidden></div>
<script>
(function () {
  var canvas = document.getElementById("scene");
  var ctx = canvas.getContext("2d");
  var boite = document.getElementById("erreur");
  var touches = Object.create(null);
  var debut = performance.now();
  var audio = null;

  function dire(type, texte) {
    try { window.parent.postMessage({ pixoscript: true, type: type, texte: String(texte).slice(0, 500) }, "*"); } catch (e) {}
  }
  function montrerErreur(e) {
    boite.hidden = false;
    boite.textContent = String((e && e.message) || e);
    dire("erreur", (e && e.message) || e);
  }

  // --- Les touches, en francais et en anglais ---
  var NOMS = { ArrowLeft: "gauche", ArrowRight: "droite", ArrowUp: "haut", ArrowDown: "bas", " ": "espace", Enter: "entree", Escape: "echap", Shift: "maj" };
  function nomTouche(e) { return NOMS[e.key] || String(e.key).toLowerCase(); }
  addEventListener("keydown", function (e) {
    touches[nomTouche(e)] = true;
    if (["gauche","droite","haut","bas","espace"].indexOf(nomTouche(e)) >= 0) e.preventDefault();
  });
  addEventListener("keyup", function (e) { touches[nomTouche(e)] = false; });
  addEventListener("blur", function () { touches = Object.create(null); pixo.clic = false; });

  // --- La souris et le doigt, ramenes aux coordonnees du jeu ---
  function place(e) {
    var r = canvas.getBoundingClientRect();
    var p = e.touches && e.touches[0] ? e.touches[0] : e;
    pixo.sourisX = (p.clientX - r.left) * (canvas.width / r.width);
    pixo.sourisY = (p.clientY - r.top) * (canvas.height / r.height);
  }
  canvas.addEventListener("mousemove", place);
  canvas.addEventListener("mousedown", function (e) { place(e); pixo.clic = true; });
  addEventListener("mouseup", function () { pixo.clic = false; });
  canvas.addEventListener("touchstart", function (e) { place(e); pixo.clic = true; e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchmove", function (e) { place(e); e.preventDefault(); }, { passive: false });
  addEventListener("touchend", function () { pixo.clic = false; });

  // --- La boite a outils du joueur : tout ce qu'il peut faire ---
  var pixo = {
    largeur: canvas.width,
    hauteur: canvas.height,
    sourisX: 0, sourisY: 0, clic: false, temps: 0,
    fond: function (c) { ctx.fillStyle = c || "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height); },
    rectangle: function (x, y, l, h, c) { ctx.fillStyle = c || "#fff"; ctx.fillRect(x, y, l, h); },
    cercle: function (x, y, r, c) { ctx.fillStyle = c || "#fff"; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, 6.2832); ctx.fill(); },
    ligne: function (x1, y1, x2, y2, c, e) { ctx.strokeStyle = c || "#fff"; ctx.lineWidth = e || 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
    texte: function (t, x, y, c, taille) { ctx.fillStyle = c || "#fff"; ctx.font = "bold " + (taille || 16) + "px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(t), x, y); },
    image: function (emoji, x, y, taille) { ctx.font = (taille || 32) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(emoji), x, y); },
    touche: function (nom) { return touches[String(nom).toLowerCase()] === true; },
    hasard: function (min, max) { return Math.random() * (max - min) + min; },
    distance: function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    collision: function (a, b) {
      if (!a || !b) return false;
      return a.x < b.x + b.l && a.x + a.l > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    },
    son: function (note, duree) {
      try {
        if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
        var o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = Math.max(40, Math.min(4000, note || 440));
        g.gain.setValueAtTime(0.0001, audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (duree || 0.12));
        o.connect(g); g.connect(audio.destination);
        o.start(); o.stop(audio.currentTime + (duree || 0.12) + 0.02);
      } catch (e) {}
    },
    ecrire: function (v) { dire("log", typeof v === "object" ? JSON.stringify(v) : v); }
  };
  window.pixo = pixo;

  // --- Le programme du joueur ---
  var demarrer = null, jouer = null, dessiner = null;
  try {
    // Appele avec « this » vide et seulement pixo : le code du joueur ne
    // recoit aucune reference au reste de la page.
    var source = ${echapper(JSON.stringify(data.code))};
    var fabrique = new Function(
      "pixo",
      '"use strict";\\n' + source +
        "\\nreturn { demarrer: typeof demarrer === 'function' ? demarrer : null," +
        " jouer: typeof jouer === 'function' ? jouer : null," +
        " dessiner: typeof dessiner === 'function' ? dessiner : null };"
    );
    var sorties = fabrique.call(null, pixo);
    demarrer = sorties.demarrer; jouer = sorties.jouer; dessiner = sorties.dessiner;
  } catch (e) { montrerErreur(e); }

  if (demarrer) { try { demarrer(); } catch (e) { montrerErreur(e); } }

  // --- La boucle, avec un plafond sur le temps ecoule ---
  // Sans plafond, revenir sur un onglet laisse en arriere-plan donne un dt
  // enorme : les personnages traversent les murs d'un coup.
  var precedent = performance.now();
  var mort = false;
  function image(maintenant) {
    if (mort) return;
    var dt = Math.min(0.1, (maintenant - precedent) / 1000);
    precedent = maintenant;
    pixo.temps = (maintenant - debut) / 1000;
    try {
      if (jouer) jouer(dt);
      if (dessiner) dessiner();
    } catch (e) {
      mort = true;
      montrerErreur(e);
      return;
    }
    requestAnimationFrame(image);
  }
  if (dessiner) requestAnimationFrame(image);
  else if (boite.hidden) montrerErreur("Il manque la fonction dessiner().");

  // --- Signal de vie : le parent sait si le jeu est bloque ---
  setInterval(function () { dire("vivant", ""); }, ${HEARTBEAT_MS});
  dire("pret", "");
  addEventListener("error", function (e) { montrerErreur(e.error || e.message); });
})();
</script>
</body>
</html>`;
}
