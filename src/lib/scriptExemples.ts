/**
 * Des jeux complets a copier, pour demarrer.
 *
 * Trois exemples courts et VRAIMENT jouables, dans cet ordre : on lit, on
 * lance, on change un chiffre, on comprend. Une page d'explications ne vaut
 * jamais un jeu qui marche et qu'on peut casser.
 */
export interface ExempleScript {
  nom: string;
  desc: string;
  width: number;
  height: number;
  code: string;
}

export const EXEMPLES: ExempleScript[] = [
  {
    nom: "Attrape le carré",
    desc: "Le tout premier : la souris, un score, du hasard.",
    width: 480,
    height: 360,
    code: `let x = 100, y = 100, score = 0, restant = 20;

function demarrer() {
  score = 0;
  restant = 20;
}

function jouer(dt) {
  restant = restant - dt;
  if (restant <= 0) return;
  if (pixo.clic && pixo.distance(pixo.sourisX, pixo.sourisY, x, y) < 28) {
    score = score + 1;
    pixo.son(660, 0.08);
    x = pixo.hasard(30, pixo.largeur - 30);
    y = pixo.hasard(30, pixo.hauteur - 30);
  }
}

function dessiner() {
  pixo.fond("#101423");
  if (restant > 0) {
    pixo.rectangle(x - 20, y - 20, 40, 40, "#ff4d5e");
    pixo.texte("Score : " + score, 16, 28, "#ffffff", 18);
    pixo.texte("Temps : " + Math.ceil(restant), 16, 52, "#8aa0c0", 14);
  } else {
    pixo.texte("Fini ! Score : " + score, 90, 180, "#ffffff", 26);
  }
}`,
  },
  {
    nom: "Esquive les rochers",
    desc: "Les flèches, des obstacles qui tombent, une collision.",
    width: 480,
    height: 360,
    code: `let joueur = { x: 220, y: 310, l: 40, h: 30 };
let rochers = [];
let vitesse = 120;
let points = 0;
let perdu = false;

function demarrer() {
  rochers = [];
  points = 0;
  vitesse = 120;
  perdu = false;
}

function jouer(dt) {
  if (perdu) {
    if (pixo.touche("espace")) demarrer();
    return;
  }
  if (pixo.touche("gauche")) joueur.x = joueur.x - 260 * dt;
  if (pixo.touche("droite")) joueur.x = joueur.x + 260 * dt;
  if (joueur.x < 0) joueur.x = 0;
  if (joueur.x > pixo.largeur - joueur.l) joueur.x = pixo.largeur - joueur.l;

  if (pixo.hasard(0, 1) < dt * 1.6) {
    rochers.push({ x: pixo.hasard(0, pixo.largeur - 30), y: -30, l: 30, h: 30 });
  }
  for (let i = rochers.length - 1; i >= 0; i = i - 1) {
    rochers[i].y = rochers[i].y + vitesse * dt;
    if (pixo.collision(joueur, rochers[i])) {
      perdu = true;
      pixo.son(120, 0.3);
    }
    if (rochers[i].y > pixo.hauteur) {
      rochers.splice(i, 1);
      points = points + 1;
      vitesse = vitesse + 2;
    }
  }
}

function dessiner() {
  pixo.fond("#0c1020");
  pixo.rectangle(joueur.x, joueur.y, joueur.l, joueur.h, "#45d6a0");
  for (const r of rochers) pixo.image("🪨", r.x + 15, r.y + 15, 28);
  pixo.texte("Esquivés : " + points, 14, 26, "#ffffff", 16);
  if (perdu) pixo.texte("Perdu ! Espace pour rejouer", 70, 190, "#ff8fa0", 20);
}`,
  },
  {
    nom: "Pong à un joueur",
    desc: "Une balle qui rebondit, une raquette, un score.",
    width: 480,
    height: 360,
    code: `let balle = { x: 240, y: 100, vx: 180, vy: 170, r: 9 };
let raquette = { x: 200, y: 330, l: 90, h: 12 };
let score = 0;
let vies = 3;

function demarrer() {
  score = 0;
  vies = 3;
  balle = { x: 240, y: 100, vx: 180, vy: 170, r: 9 };
}

function jouer(dt) {
  if (vies <= 0) {
    if (pixo.touche("espace")) demarrer();
    return;
  }
  // La raquette suit la souris, sans sortir de l'ecran.
  raquette.x = pixo.sourisX - raquette.l / 2;
  if (raquette.x < 0) raquette.x = 0;
  if (raquette.x > pixo.largeur - raquette.l) raquette.x = pixo.largeur - raquette.l;

  balle.x = balle.x + balle.vx * dt;
  balle.y = balle.y + balle.vy * dt;
  if (balle.x < balle.r || balle.x > pixo.largeur - balle.r) balle.vx = -balle.vx;
  if (balle.y < balle.r) balle.vy = -balle.vy;

  const boite = { x: balle.x - balle.r, y: balle.y - balle.r, l: balle.r * 2, h: balle.r * 2 };
  if (balle.vy > 0 && pixo.collision(boite, raquette)) {
    balle.vy = -Math.abs(balle.vy) * 1.03;
    // Renvoyer selon l'endroit touche : le bord de la raquette devie plus.
    balle.vx = balle.vx + (balle.x - (raquette.x + raquette.l / 2)) * 3;
    score = score + 1;
    pixo.son(520, 0.06);
  }
  if (balle.y > pixo.hauteur + 20) {
    vies = vies - 1;
    pixo.son(140, 0.2);
    balle = { x: pixo.largeur / 2, y: 80, vx: pixo.hasard(-180, 180), vy: 180, r: 9 };
  }
}

function dessiner() {
  pixo.fond("#090d18");
  pixo.rectangle(raquette.x, raquette.y, raquette.l, raquette.h, "#8b5cf6");
  pixo.cercle(balle.x, balle.y, balle.r, "#ffe07a");
  pixo.texte("Score : " + score, 14, 26, "#ffffff", 16);
  pixo.texte("Vies : " + vies, 380, 26, "#ff9fb0", 16);
  if (vies <= 0) pixo.texte("Perdu ! Espace pour rejouer", 78, 190, "#ffffff", 20);
}`,
  },
];
