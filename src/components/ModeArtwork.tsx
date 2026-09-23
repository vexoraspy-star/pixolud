/** Illustrations originales, statiques et purement decoratives. */
export function ScriptArtwork() {
  return <svg viewBox="0 0 520 340" className="mode-artwork" aria-hidden="true">
    <rect x="30" y="24" width="362" height="268" rx="22" fill="#171e34" stroke="#475071" />
    <path d="M30 68H392" stroke="#475071" />
    <circle cx="54" cy="47" r="4" fill="#e0ad90" /><circle cx="70" cy="47" r="4" fill="#e4ce8b" /><circle cx="86" cy="47" r="4" fill="#91d7bd" />
    <text x="110" y="51" fill="#aab5d3" fontSize="12" fontFamily="monospace">mon-premier-jeu.js</text>
    <g fontFamily="monospace" fontSize="16">
      <text x="54" y="108" fill="#a597ec">function <tspan fill="#dbe5ef">dessiner() {'{'}</tspan></text>
      <text x="72" y="146" fill="#93d8c5">pixo.fond(<tspan fill="#edc991">&quot;#171e34&quot;</tspan>);</text>
      <text x="72" y="184" fill="#93d8c5">pixo.rectangle(</text>
      <text x="90" y="218" fill="#edc991">x, y, 32, 32</text>
      <text x="72" y="250" fill="#dbe5ef">); {'}'}</text>
    </g>
    <rect x="276" y="146" width="218" height="172" rx="20" fill="#0d1423" stroke="#6777a3" strokeWidth="2" />
    <path d="M292 287H478M315 170V299M347 170V299M379 170V299M411 170V299M443 170V299M292 191H478M292 223H478M292 255H478" stroke="#25354c" />
    <path d="M292 285H353V262H413V239H478" fill="none" stroke="#8dd7b5" strokeWidth="10" strokeLinejoin="round" />
    <rect x="366" y="222" width="23" height="23" rx="5" fill="#baa6ff" /><path d="M426 187l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" fill="#eed08b" />
    <circle cx="472" cy="57" r="28" fill="#bba8f6" /><path d="M461 57l8 8 14-17" fill="none" stroke="#29213d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function CallArtwork() {
  return <svg viewBox="0 0 260 150" className="call-artwork" aria-hidden="true">
    <circle cx="130" cy="75" r="66" fill="none" stroke="currentColor" opacity=".12" />
    <circle cx="130" cy="75" r="47" fill="none" stroke="currentColor" opacity=".25" />
    <rect x="119" y="46" width="22" height="43" rx="11" fill="currentColor" />
    <path d="M109 77v3a21 21 0 0042 0v-3M130 101v13m-12 0h24" stroke="currentColor" fill="none" strokeWidth="4" strokeLinecap="round" />
    <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".55"><path d="M24 67v16m13-27v38m13-24v10m160-21v32m13-39v46m13-28v10" /></g>
  </svg>;
}
