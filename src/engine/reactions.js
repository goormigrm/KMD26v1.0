/* ─────────────────────────────────────────────────────────────
   경기 뒤 반응 — 소셜미디어 · FM코리아

   KM26 을 재미있게 만드는 큰 축입니다. 경기가 끝나면 팬들이 떠듭니다.
   문구 표는 원본에서 그대로 가져왔고(data/reactions.json), 여기서는
   "이 경기에 어떤 반응이 어울리는가"만 고릅니다.

   ⚠ 두 사람이 같은 경기를 보면 반응도 같아야 합니다. 그래서 경기가 끝난 뒤
     시드를 다시 심고 뽑습니다 — 경기 결과에는 영향이 없습니다(이미 끝났으므로).
   ───────────────────────────────────────────────────────────── */

import { F_ } from "./kernel.js";
import { seedRNG, RNG } from "./rng.js";

// 커널에도 R() 이 있다 — 모듈을 이어 붙여 쓰는 도구(goja)에서 겹치므로 이름을 달리한다
const rnd = n => Math.floor(RNG() * n);

/** 목록에서 n 개를 겹치지 않게 뽑는다 */
function sampleN(list, n) {
  if (!list || !list.length) return [];
  const idx = list.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  return idx.slice(0, Math.max(0, Math.min(n, list.length))).map(i => list[i]);
}

/**
 * 이 경기에 어울리는 반응 묶음을 고른다.
 * 원본이 시즌 흐름(연승·라이벌·승격)까지 보는 것과 달리, 듀얼은 한 판뿐이라
 * 한 경기 안에서 읽을 수 있는 것만 씁니다 — 점수차·무득점·역전·다득점.
 */
function pickKeys(gf, ga, comeback) {
  const d = gf - ga, keys = [];
  if (d >= 3) keys.push("bigWin");
  else if (d > 0) keys.push("win");
  else if (d === 0) keys.push("draw");
  else if (d <= -3) keys.push("bigLose");
  else keys.push("lose");

  if (comeback && d > 0) keys.push("comeback");
  if (comeback && d < 0) keys.push("blown");
  if (gf === 0) keys.push("blank");
  if (gf + ga >= 5) keys.push("goalHigh");
  else if (gf + ga === 0) keys.push("goalLow");
  return keys;
}

/** 그 팀에서 가장 많이 넣은 선수 — 문구의 {p} 자리에 들어간다 */
function topScorer(goalLine, side) {
  const c = {};
  for (const g of goalLine || []) if (g.side === side) c[g.n] = (c[g.n] || 0) + 1;
  let best = "", n = 0;
  for (const k in c) if (c[k] > n) { n = c[k]; best = k; }
  return best;
}

/** 앞서다 뒤집혔거나 뒤지다 뒤집었는가 — 득점 시각 순서로 본다 */
function hadComeback(goalLine) {
  let h = 0, a = 0, leadH = false, leadA = false;
  for (const g of goalLine || []) {
    if (g.side === "h") h++; else a++;
    if (h > a) leadH = true;
    if (a > h) leadA = true;
  }
  return (leadH && a > h) || (leadA && h > a);
}

/**
 * @param {object} r  runHeadless 결과
 * @param {object} tbl data/reactions.json
 * @param {string} side "h" | "a" — 누구의 팬 시선으로 볼 것인가
 */
export function makeReactions(r, tbl, side = "h") {
  if (!tbl || !tbl.soc || !tbl.fmk) return { social: [], fmk: [] };

  const us = side === "h" ? r.home : r.away;
  const them = side === "h" ? r.away : r.home;
  const gf = side === "h" ? r.hg : r.ag;
  const ga = side === "h" ? r.ag : r.hg;

  // 경기가 끝난 뒤 다시 심는다 — 같은 경기면 같은 반응이 나와야 한다
  seedRNG((r.seed ^ 0x5EAC7) >>> 0);

  /* 문구가 요구하는 자리를 전부 채운다. 하나라도 비면 "슈팅 개" 처럼 어색하게 찍힌다.
     (실제로 그렇게 나와서 원본 표에 쓰인 키를 다시 세어 봤다: t · o · p · s · sh · sog · shO) */
  const st = side === "h" ? r.stats.h : r.stats.a;
  const vars = {
    t: us, o: them,
    s: Math.abs(gf - ga), n: gf + ga,
    sh: st ? st.shot : 0,
    sog: st ? st.shotOn : 0,
    shO: st ? st.shotOn : 0,
    p: topScorer(r.goalLine, side) || topScorer(r.goalLine, side === "h" ? "a" : "h") || "우리 선수",
  };
  const keys = pickKeys(gf, ga, hadComeback(r.goalLine));

  /* 원본 표는 시즌 게임용이라 한쪽에만 있는 항목이 있다(soc 에는 bigWin 이 없다).
     비어 있으면 한 칸 완만한 항목으로 대신한다 — 아무 반응도 안 나오는 것보다 낫다. */
  const FALL = { bigWin: "win", bigLose: "lose", goalHigh: "win", goalLow: "draw" };
  const rows = (bag, k) => (bag[k] && bag[k].length) ? bag[k] : (bag[FALL[k]] || []);

  const social = [], fmk = [];
  for (const k of keys) {
    for (const it of sampleN(rows(tbl.soc, k), 3 + rnd(2))) {
      const [txt, tone] = Array.isArray(it) ? it : [it, 0];
      social.push({ txt: F_(txt, vars), tone });
    }
    for (const it of sampleN(rows(tbl.fmk, k), 2 + rnd(2))) {
      const [txt, tone] = Array.isArray(it) ? it : [it, 0];
      fmk.push({ txt: F_(txt, vars), tone, nick: pickNick(tbl, tone) });
    }
  }
  return { social, fmk, keys };
}

/* 어조가 나쁜 글은 타팬 닉네임이 붙을 때가 많다 — 원본의 결을 따라간다 */
function pickNick(tbl, tone) {
  const pool = (tone < 0 && tbl.rivalNick && tbl.rivalNick.length && RNG() < 0.45)
    ? tbl.rivalNick : (tbl.nick || ["ㅇㅇ"]);
  return pool[rnd(pool.length)] || "ㅇㅇ";
}
