/* ─────────────────────────────────────────────────────────────
   듀얼 경기 구동부

   KM26 의 createMatch() 는 시즌 상태(관중·순위·이적)를 끌어옵니다.
   듀얼에서는 그게 전부 불필요하므로, 엔진이 요구하는 M 구조만
   직접 만들어 넘깁니다.

   단계 2부터 모든 경기는 시드를 받습니다. 같은 시드 = 같은 경기.
   ───────────────────────────────────────────────────────────── */

import { MatchSim, SIM_SECONDS, MATCH_CLOCK_SCALE, onPitch } from "./kernel.js?v=0631260f6e";
import { installEngineContext, normalizeTeam } from "./stubs.js?v=0631260f6e";
import { seedRNG, deriveSeed } from "./rng.js?v=0631260f6e";
import { installDuelRules } from "./rules.js?v=0631260f6e";
import { installOrders } from "./orders.js?v=0631260f6e";
import { installReplay, takeClips, takeWatch, rosterOf, frameZero, takeCaps } from "./replay.js?v=0631260f6e";

// 듀얼 규칙(D-3)은 커널을 감싸는 방식이라, 경기를 만들기 전에 한 번 입혀 둔다
installDuelRules();
installOrders();     // 조건부 지시 (단계 8) — 분 경계에서 판정한다
installReplay();

/** 출전 기록 한 줄 — KM26 createMatch 의 mk() 와 같은 모양 */
function entry(p) {
  return { p, fit: p.cond, y: 0, red: false, goals: 0, assists: 0, on: 0, off: null };
}

/**
 * 경기 객체(M)를 만든다.
 * @param {object} opt { homeXI, awayXI, homeBench, awayBench }
 */
export function makeMatch(home, away, opt = {}) {
  const pick = (t, ids) =>
    ids ? ids.map(id => t.players.find(p => p.id === id)).filter(Boolean)
        : t.players.slice(0, 11);
  const benchOf = (t, ids, xi) =>
    ids ? ids.map(id => t.players.find(p => p.id === id)).filter(Boolean)
        : t.players.filter(p => !xi.includes(p)).slice(0, 9);

  const hXI = pick(home, opt.homeXI), aXI = pick(away, opt.awayXI);

  return {
    home, away, opts: { duel: true },
    min: 0, half: 1, hg: 0, ag: 0, done: false,
    addedTotal: 3, xiDirty: true,
    h: { team: home, list: hXI.map(entry), bench: benchOf(home, opt.homeBench, hXI), subs: 0, red: 0 },
    a: { team: away, list: aXI.map(entry), bench: benchOf(away, opt.awayBench, aXI), subs: 0, red: 0 },
    st: { hS:0, aS:0, hT:0, aT:0, hF:0, aF:0, hC:0, aC:0, hY:0, aY:0, hR:0, aR:0 },
    needsSubPause: false, pauseReason: null, pauseEntryId: null,
    pendingQueue: { h: [], a: [] },
    events: [], sc: [],
    att: 0,               // 관중 없음 — 듀얼은 중립 경기
  };
}

/**
 * 경기 결과의 지문. 두 사람의 재생이 같은지 한 값으로 비교한다.
 * 스코어·득점 시각·이벤트 전문·카드까지 전부 반영한다.
 */
export function fingerprint(r) {
  const s = [
    r.hg, ":", r.ag,
    "|", (r.goalLine || []).map(g => `${g.min}${g.side}${g.n}`).join(","),
    "|", (r.events || []).map(e => `${e.min}${e.txt || ""}`).join("~"),
    "|", r.stats.h.shot, r.stats.a.shot, r.stats.h.foul, r.stats.a.foul,
    r.stats.h.yellow, r.stats.a.yellow, r.stats.h.red, r.stats.a.red,
  ].join("");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * 한 경기를 끝까지 돌린다 (화면 없음).
 * @param {number} opt.seed 32비트 시드. 같은 시드 = 완전히 같은 경기.
 */
export function runHeadless(home, away, opt = {}) {
  const seed = (opt.seed >>> 0) || 1;

  normalizeTeam(home);
  normalizeTeam(away);
  // 심판 배정도 같은 시드에서 나와야 한다 (refCrewOf 가 G.day 를 쓴다)
  installEngineContext([home, away], seed & 0x7fff);
  seedRNG(seed);                     // ⚠ MatchSim 생성 직전에 심는다

  const M = makeMatch(home, away, opt);
  const sim = new MatchSim(M, { live: true });   // live:true 라야 해설 이벤트가 쌓인다
  /* 2D 하이라이트를 모을지 여부.
     ⚠ sim.recording 은 절대 건드리지 않는다 — 커널에 `if(this.recording && RNG()<…)` 가 있어
       끄는 순간 난수 흐름이 달라져 **다른 경기**가 된다. 켜고 끌 것은 클립 수집뿐이다. */
  sim._wantClips = !!opt.record;
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  sim.run();
  const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;

  const poss = (sim.stats.h.poss || 0) + (sim.stats.a.poss || 0);
  const r = {
    seed,
    home: home.short || home.name,
    away: away.short || away.name,
    hg: M.hg, ag: M.ag,
    stats: sim.stats,
    possession: poss
      ? { h: Math.round(sim.stats.h.poss / poss * 100), a: Math.round(sim.stats.a.poss / poss * 100) }
      : { h: 50, a: 50 },
    events: M.events,
    goalLine: M.sc || [],
    referee: sim.refCrew && sim.refCrew.main ? sim.refCrew.main.n : null,
    elapsedMs: Math.round(ms),
    clock: Math.round(sim.clock),
    done: M.done,
  };
  if (opt.record) {
    r.clips = takeClips(sim); r.roster = rosterOf(M); r.form0 = frameZero(sim);
    // 장면과 장면 사이를 채울 관전 트랙 (replay.js 머리말 참고)
    r.watch = takeWatch(sim);
    // 버려지던 실시간 해설 자막 — 화면이 문자중계 사이에 끼워 넣는다 (replay.js takeCaps)
    r.caps = takeCaps(sim);
  }
  r.fp = fingerprint(r);
  return r;
}

export { SIM_SECONDS, MATCH_CLOCK_SCALE, onPitch, deriveSeed };
