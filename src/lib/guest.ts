/**
 * Les joueurs sans compte ont un numero a eux, garde dans le navigateur :
 * « Joueur 482193 » partout sur le site (groupes des Backrooms, parties a
 * plusieurs, liste des joueurs en ligne du panneau admin).
 */
const KEY = "pixolud-invite";

export function guestNumber(): string {
  try {
    let n = localStorage.getItem(KEY);
    if (!n || !/^\d{6}$/.test(n)) {
      n = String(Math.floor(100000 + Math.random() * 900000));
      localStorage.setItem(KEY, n);
    }
    return n;
  } catch {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}

export function guestName(): string {
  return `Joueur ${guestNumber()}`;
}
