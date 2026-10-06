/**
 * Serialise un objet pour un bloc <script type="application/ld+json">.
 *
 * JSON.stringify seul est dangereux ici : il n'echappe ni « < », ni « > », ni
 * « & ». Un titre de jeu, une description ou un pseudo contenant « </script> »
 * fermerait donc la balise, et le navigateur executerait ce qui suit — une
 * injection de code (XSS) stockee, declenchee chez chaque visiteur de la page
 * (et ces chaines viennent des joueurs). On remplace ces caracteres par leur
 * echappement \uXXXX : le JSON reste valide (Google le lit sans probleme),
 * mais plus rien ne peut sortir de la balise. Les deux separateurs de ligne
 * Unicode (U+2028 et U+2029) sont echappes en prime : ils cassent certains
 * analyseurs.
 */
const SEPARATEURS_LIGNE = new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(SEPARATEURS_LIGNE, (c) => "\\u" + c.charCodeAt(0).toString(16));
}
