/* ─────────────────────────────────────────────────────────────
   경기 시뮬 일꾼 (Web Worker)

   경기 한 판이 8초쯤 걸립니다. 13,500틱 동안 22명이 각자 판단하니
   원래 무거운 일이고, 줄일 수 있는 종류의 비용이 아닙니다.
   그래서 여러 판을 돌려야 할 때는 코어를 나눠 씁니다.

   ⚠ 결정론은 그대로입니다. 일꾼마다 모듈이 따로 올라가므로 난수 상태도 따로 살고,
     한 일꾼 안에서는 경기가 순서대로 돌아갑니다. 시드가 같으면 어디서 돌리든 같은 경기입니다.
   ───────────────────────────────────────────────────────────── */

import { runHeadless } from "../src/engine/duel.js";
import { makeTeam } from "./fixture.js";

/** 홈 팀만 슬라이더 하나를 바꾼 대진 — 양 팀 선수·전력은 항상 같다 */
function play(key, val, seed) {
  const home = makeTeam("alpha", "알파 FC", "알파", 72, 11, { [key]: val });
  const away = makeTeam("bravo", "브라보 FC", "브라보", 72, 22);
  return runHeadless(home, away, { seed });
}

self.onmessage = (e) => {
  const j = e.data;
  try {
    const r = play(j.key, j.val, j.seed);
    // 통계 전부를 넘긴다 — 항목마다 보는 지표가 달라서 여기서 고르지 않는다
    self.postMessage({ i: j.i, fp: r.fp, hg: r.hg, ag: r.ag, h: r.stats.h, a: r.stats.a });
  } catch (err) {
    self.postMessage({ i: j.i, error: String(err && err.stack || err) });
  }
};
