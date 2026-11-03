/** Illustrated placeholder "job photos" uploaded to storage for seeded jobs (no binary assets in the repo). */

function frame(title: string, subtitle: string, body: string, hue: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 45% 92%)"/>
      <stop offset="1" stop-color="hsl(${hue + 20} 40% 82%)"/>
    </linearGradient>
  </defs>
  <rect width="960" height="720" fill="url(#bg)"/>
  ${body}
  <rect x="0" y="620" width="960" height="100" fill="rgba(15,23,42,0.72)"/>
  <text x="40" y="664" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff">${title}</text>
  <text x="40" y="700" font-family="Inter, Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.75)">${subtitle}</text>
  <text x="920" y="40" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="18" fill="rgba(15,23,42,0.45)">SAMPLE · Sejuk Ops</text>
</svg>`;
}

const indoorUnit = (dirty: boolean) => `
  <rect x="180" y="160" width="600" height="200" rx="28" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
  <rect x="220" y="300" width="520" height="34" rx="10" fill="${dirty ? "#94a3b8" : "#e2e8f0"}"/>
  ${Array.from({ length: 12 }, (_, i) => `<line x1="${240 + i * 42}" y1="306" x2="${240 + i * 42}" y2="328" stroke="${dirty ? "#475569" : "#cbd5e1"}" stroke-width="4"/>`).join("")}
  <circle cx="730" cy="200" r="8" fill="${dirty ? "#f59e0b" : "#22c55e"}"/>
  ${dirty ? Array.from({ length: 40 }, (_, i) => `<circle cx="${230 + ((i * 53) % 500)}" cy="${190 + ((i * 37) % 100)}" r="${3 + (i % 4)}" fill="rgba(71,85,105,0.35)"/>`).join("") : ""}
  ${dirty ? "" : `<path d="M300 400 q30 40 0 80 M400 400 q30 40 0 80 M500 400 q30 40 0 80 M600 400 q30 40 0 80" stroke="#38bdf8" stroke-width="8" fill="none" stroke-linecap="round"/>`}`;

export const SAMPLE_MEDIA_FILES: Record<string, string> = {
  "samples/indoor-before.svg": frame("Indoor unit — before service", "Dust build-up on coil and louvres", indoorUnit(true), 30),
  "samples/indoor-after.svg": frame("Indoor unit — after service", "Coil cleaned, airflow restored", indoorUnit(false), 200),
  "samples/filter.svg": frame("Air filter washed", "Filter mesh cleaned and dried", `
    <rect x="240" y="120" width="480" height="440" rx="20" fill="#fff" stroke="#94a3b8" stroke-width="6"/>
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${280 + i * 40}" y1="150" x2="${280 + i * 40}" y2="530" stroke="#cbd5e1" stroke-width="3"/>`).join("")}
    ${Array.from({ length: 9 }, (_, i) => `<line x1="270" y1="${170 + i * 42}" x2="690" y2="${170 + i * 42}" stroke="#cbd5e1" stroke-width="3"/>`).join("")}`, 180),
  "samples/gauge.svg": frame("Gas pressure reading", "R32 — 120 psi after top-up", `
    <circle cx="480" cy="330" r="210" fill="#fff" stroke="#1e293b" stroke-width="14"/>
    ${Array.from({ length: 13 }, (_, i) => {
      const a = (-210 + i * 20) * (Math.PI / 180);
      return `<line x1="${480 + Math.cos(a) * 170}" y1="${330 + Math.sin(a) * 170}" x2="${480 + Math.cos(a) * 195}" y2="${330 + Math.sin(a) * 195}" stroke="#334155" stroke-width="6"/>`;
    }).join("")}
    <line x1="480" y1="330" x2="${480 + Math.cos(-0.6) * 160}" y2="${330 + Math.sin(-0.6) * 160}" stroke="#ef4444" stroke-width="10" stroke-linecap="round"/>
    <circle cx="480" cy="330" r="18" fill="#1e293b"/>
    <text x="480" y="460" text-anchor="middle" font-family="Inter, Arial" font-size="44" font-weight="700" fill="#1e293b">120 psi</text>`, 210),
  "samples/outdoor-unit.svg": frame("Outdoor compressor unit", "Fan blade and mounting checked", `
    <rect x="220" y="130" width="520" height="420" rx="18" fill="#e2e8f0" stroke="#64748b" stroke-width="6"/>
    <circle cx="420" cy="340" r="150" fill="#cbd5e1" stroke="#475569" stroke-width="6"/>
    ${Array.from({ length: 4 }, (_, i) => `<ellipse cx="420" cy="270" rx="34" ry="70" fill="#64748b" transform="rotate(${i * 90} 420 340)"/>`).join("")}
    <circle cx="420" cy="340" r="20" fill="#334155"/>
    ${Array.from({ length: 8 }, (_, i) => `<line x1="610" y1="${190 + i * 40}" x2="710" y2="${190 + i * 40}" stroke="#94a3b8" stroke-width="6"/>`).join("")}`, 220),
  "samples/drain.svg": frame("Drain pipe flushed", "No blockage, water flowing freely", `
    <path d="M200 200 h360 a80 80 0 0 1 80 80 v260" stroke="#94a3b8" stroke-width="56" fill="none" stroke-linecap="round"/>
    <path d="M200 200 h360 a80 80 0 0 1 80 80 v260" stroke="#38bdf8" stroke-width="18" fill="none" stroke-dasharray="30 26" stroke-linecap="round"/>
    <circle cx="640" cy="580" r="14" fill="#38bdf8"/>`, 195),
};
