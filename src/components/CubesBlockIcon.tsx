const PALETTES: Record<number, [string, string, string]> = {
  0: ["#cbd5e1", "#94a3b8", "#64748b"],
  1: ["#98c95a", "#9a7045", "#735035"], 2: ["#ae8356", "#926441", "#714a32"],
  3: ["#a3b1ae", "#7c8c8a", "#586c6b"], 4: ["#b6c3bc", "#8a9e97", "#647f76"],
  5: ["#f3d99b", "#d4b87c", "#b19763"], 6: ["#e9d096", "#c6ab73", "#ab8e57"],
  7: ["#d5b17a", "#996b42", "#704a2d"], 8: ["#deb77b", "#ba8d56", "#916640"],
  9: ["#96c75d", "#609845", "#3b713a"], 10: ["#d5f5ef", "#a6d8d2", "#70b4b4"],
  11: ["#67c3dc", "#3d9bbd", "#2c718f"], 12: ["#cc8f73", "#aa6952", "#824b3d"],
  13: ["#7b8887", "#5b6b6d", "#394b50"], 14: ["#bdad9a", "#918d81", "#696f67"],
  15: ["#dfc572", "#ad9960", "#807c59"], 16: ["#8bdfcf", "#64afa4", "#447e79"],
  17: ["#615978", "#40394f", "#2b2939"], 18: ["#b6aea1", "#958c82", "#6e6c66"],
  19: ["#fff9eb", "#dce6df", "#b5ccc7"], 20: ["#c2e9ee", "#99cddf", "#78aecb"],
  21: ["#5f6c69", "#3e4e4c", "#293c3a"], 22: ["#8cc75d", "#5d9b49", "#39713f"],
  23: ["#fcf3da", "#dfd4bd", "#b8b49e"], 24: ["#e68b7d", "#c46458", "#9a4942"],
  25: ["#84adcd", "#5b87b6", "#426894"], 26: ["#f7dc79", "#dbb452", "#b68c38"],
  27: ["#b6cc7b", "#8ca35a", "#657d42"], 32: ["#fff1b3", "#e4b95d", "#c3903f"],
};

/** Petit bloc isometrique, sans texture chargee ni contexte WebGL. */
export default function CubesBlockIcon({ id, size = 36 }: { id: number; size?: number }) {
  if (id >= 28 && id <= 31) return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 44" fill="none">
    {id === 28 ? <><path d="m17 19 7 3-3 18-6-3z" fill="#ad7d45" /><path d="m17 19 3-10 6 5-2 8z" fill="#ffdb75" /><path d="m20 14 2 4-2 2-2-2z" fill="#fff4c1" /></> : <>
      <path d="M20 37V19m0 11-8-6m8 3 8-8" stroke="#79a755" strokeWidth="3" />
      {id !== 31 && <path d="M16 9h8v5h5v8h-5v5h-8v-5h-5v-8h5z" fill={id === 29 ? "#e38076" : "#edce65"} />}
      {id !== 31 && <path d="M17 15h6v6h-6z" fill="#ffebb7" />}
      {id === 31 && <path d="m19 32-6-20m7 20 6-23m-7 28-11-9m13 3 12-9" stroke="#91b960" strokeWidth="3" />}
    </>}
  </svg>;
  const [top, left, right] = PALETTES[id] ?? PALETTES[0];
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 44" fill="none">
    <path d="m20 2 18 10v21L20 43 2 33V12z" fill="#0d2524" fillOpacity=".2" />
    <path d="M2 12 20 22v20L2 32z" fill={left} />
    <path d="m20 22 18-10v20L20 42z" fill={right} />
    <path d="M20 2 38 12 20 22 2 12z" fill={top} />
    {id === 1 ? <><path d="m2 12 18 10v6l-5-3v-3l-5-2v3l-8-4z" fill="#729b45" /><path d="m20 22 18-10v6l-6 3v3l-6 3v-3l-6 4z" fill="#56883f" /><path d="m11 9 4 2-4 2-4-2 4-2m12 4 5 3-4 2-5-3z" fill="#c7e58a" fillOpacity=".55" /></>
      : id === 7 ? <><path d="m11 12 9-5 9 5-9 5z" stroke="#a37a49" strokeWidth="2" /><path d="m7 17 1 15m5-12 1 15m16-17-1 13" stroke="#5a412b" strokeOpacity=".45" strokeWidth="2" /></>
        : id === 8 || id === 12 || id === 4 ? <><path d="m2 19 18 10 18-10M2 26l18 10 18-10M11 17v7m17 1v7M10 30v6" stroke="#263b34" strokeOpacity=".22" strokeWidth="1.3" /></>
          : id === 10 || id === 20 ? <><path d="m5 16 11 6v14M24 25l10-6v11" stroke="#f4fffd" strokeWidth="1.7" /><path d="m11 12 7-4m5 10 7-4" stroke="white" strokeOpacity=".65" /></>
            : <><path d="m9 11 4 2 4-2-4-2zM23 13l5 3 4-2-5-3z" fill="white" fillOpacity=".2" /><path d="m6 23 4 2v4l-4-2zm20 9 5-3v4l-5 3z" fill="#132e2b" fillOpacity=".18" /></>}
    {id >= 13 && id <= 16 && <path d="m8 22 5 3v5l-5-3zm17 6 7-4v5l-7 4z" fill={["#293b3a", "#e4b99a", "#ffe58b", "#b2fff0"][id - 13]} />}
    <path d="M2 12 20 22 38 12M20 22v20" stroke="white" strokeOpacity=".15" />
  </svg>;
}
