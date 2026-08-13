/* ─────────────────────────────────────────────────────────────
   단계 1 테스트 픽스처 — 합성 스쿼드 2팀

   ⚠ 실제 선수 데이터가 아닙니다. 단계 1의 목표는 "엔진이 화면 없이
      90분을 완주하는가" 하나뿐이라, 데이터는 형태만 맞으면 됩니다.
      진짜 데이터(players.json)는 단계 4에서 만듭니다.
   ───────────────────────────────────────────────────────────── */

import { initPosFam } from "../src/engine/kernel.js";

const TECH = ["cor","crs","dri","fin","fir","fre","hea","lon","thr","mar","pas","pen","tck","tec"];
const MENT = ["agg","ant","bra","cmp","cnt","dec","det","fla","ldr","otb","pos","tea","vis","wor"];
const PHYS = ["acc","agi","bal","jum","nat","pac","sta","str"];
const GKA  = ["aer","cmd","com","ecc","han","kic","one","ref","tro","pun","tro2"];

/* 픽스처 전용 결정론 난수 (엔진 난수와 무관 — 단계 2에서 엔진에 시드를 붙입니다) */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 자리별 강조 능력치 — 합성 데이터가 그럴듯하게 굴러가도록 */
const EMPH = {
  GK: { han:12, ref:12, one:10, cmd:8, kic:6 },
  CB: { mar:12, tck:12, hea:10, str:8, pos:8, jum:8 },
  LB: { tck:8, crs:8, pac:10, sta:10, wor:8 },
  RB: { tck:8, crs:8, pac:10, sta:10, wor:8 },
  CM: { pas:12, vis:10, tec:8, dec:8, wor:10, sta:8 },
  LW: { dri:12, pac:12, crs:10, tec:8, otb:8 },
  RW: { dri:12, pac:12, crs:10, tec:8, otb:8 },
  ST: { fin:14, otb:10, cmp:8, hea:8, acc:8 },
};

function mkPlayer(id, name, pos, prefPos, base, rnd) {
  const attr = {};
  const e = EMPH[prefPos] || {};
  for (const k of [...TECH, ...MENT, ...PHYS]) {
    const v = base + (e[k] || 0) - 6 + Math.floor(rnd() * 12);
    attr[k] = Math.max(20, Math.min(99, v));
  }
  const p = {
    id, name, pos, prefPos,
    by: 1996 + Math.floor(rnd() * 8),
    h: 172 + Math.floor(rnd() * 20),
    w: 66 + Math.floor(rnd() * 18),
    no: id % 100,
    frn: 0,
    pers: Math.floor(rnd() * 4),
    traits: [],
    ovr: base,
    attr,
    cond: 100, morale: 75, inj: 0, ban: 0, sulk: 0, loan: null,
    apps: 0, goals: 0, assists: 0, seasonRating: 0,
  };
  if (pos === "GK") {
    p.gkA = {};
    for (const k of GKA) p.gkA[k] = Math.max(20, Math.min(99, base + (EMPH.GK[k] || 0) - 6 + Math.floor(rnd() * 12)));
  }
  p.posFam = initPosFam(p);
  return p;
}

/* 4-3-3 기준 선발 11 + 후보 9 */
const SHEET = [
  ["GK", "GK"], ["DF", "LB"], ["DF", "CB"], ["DF", "CB"], ["DF", "RB"],
  ["MF", "CM"], ["MF", "CM"], ["MF", "CM"],
  ["FW", "LW"], ["FW", "ST"], ["FW", "RW"],
  // 후보 9
  ["GK", "GK"], ["DF", "CB"], ["DF", "LB"], ["DF", "RB"],
  ["MF", "CM"], ["MF", "CM"], ["FW", "LW"], ["FW", "ST"], ["FW", "RW"],
];

export function makeTeam(id, name, short, base, seed, tactic = {}) {
  const rnd = rng(seed);
  const players = SHEET.map(([pos, pref], i) =>
    mkPlayer(seed * 1000 + i + 1, `${short}${String(i + 1).padStart(2, "0")}`, pos, pref,
             base + (i < 11 ? 0 : -3), rnd));
  return {
    id, name, short, col: "#2ea8ff", col2: "#ffffff", div: 1,
    players,
    fam: 100, morale: 75, isUser: false,
    W:0, Dw:0, L:0, GF:0, GA:0, Pts:0, form: [],
    tactic: Object.assign({
      formation: "4-3-3", mentality: 2, pass: 2, tempo: 2, press: 2,
      line: 2, width: 2, counter: false, tackle: 2, longShot: 2,
      benchSel: [], role: {}, slot: {}, zone: {},
    }, tactic),
  };
}

/** 단계 1 기본 대진 — 전력이 같은 두 팀 */
export function defaultPair() {
  return [
    makeTeam("alpha", "알파 FC", "알파", 72, 11),
    makeTeam("bravo", "브라보 FC", "브라보", 72, 22),
  ];
}
