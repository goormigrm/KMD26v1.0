/* ─────────────────────────────────────────────────────────────
   듀얼 경기 구동부

   KM26 의 createMatch() 는 시즌 상태(관중·순위·이적)를 끌어옵니다.
   듀얼에서는 그게 전부 불필요하므로, 엔진이 요구하는 M 구조만
   직접 만들어 넘깁니다.
   ───────────────────────────────────────────────────────────── */

import { MatchSim, SIM_SECONDS, MATCH_CLOCK_SCALE, onPitch } from "./kernel.js";
import { installEngineContext, normalizeTeam } from "./stubs.js";

/** 출전 기록 한 줄 — KM26 createMatch 의 mk() 와 같은 모양 */
function entry(p) {
  return { p, fit: p.cond, y: 0, red: false, goals: 0, assists: 0, on: 0, off: null };
}

/**
 * 경기 객체(M)를 만든다.
 * @param {object} home  홈 팀 (players 에 선발 11명이 앞쪽에 오도록 정렬돼 있어야 함)
 * @param {object} away  원정 팀
 * @param {object} opt   { homeXI, awayXI, homeBench, awayBench }
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
    events: [],
    att: 0,               // 관중 없음 — 듀얼은 중립 경기
  };
}

/**
 * 한 경기를 끝까지 돌리고 결과를 돌려준다 (화면 없음).
 * 단계 1에서는 결정론이 아직 없습니다 — 단계 2에서 시드를 붙입니다.
 */
export function runHeadless(home, away, opt = {}) {
  normalizeTeam(home);
  normalizeTeam(away);
  installEngineContext([home, away], opt.refSeed || 0);

  const M = makeMatch(home, away, opt);
  const sim = new MatchSim(M, { live: true });   // live:true 라야 해설 이벤트가 쌓인다
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
  sim.run();
  const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;

  const scorers = [];
  for (const [key, sd] of [["h", M.h], ["a", M.a]])
    for (const x of sd.list) if (x.goals) scorers.push({ side: key, name: x.p.name, goals: x.goals });

  const poss = (sim.stats.h.poss || 0) + (sim.stats.a.poss || 0);

  return {
    home: home.short || home.name,
    away: away.short || away.name,
    hg: M.hg, ag: M.ag,
    stats: sim.stats,
    possession: poss ? { h: Math.round(sim.stats.h.poss / poss * 100), a: Math.round(sim.stats.a.poss / poss * 100) } : { h: 50, a: 50 },
    events: M.events,
    scorers,
    goalLine: M.sc || [],          // 득점 시각 (recordGoal 이 채운다)
    referee: sim.refCrew && sim.refCrew.main ? sim.refCrew.main.n : null,
    cards: {
      h: M.h.list.filter(x => x.y > 0).length,
      a: M.a.list.filter(x => x.y > 0).length,
      red: sim.sentOff.length,
    },
    elapsedMs: Math.round(ms),
    clock: Math.round(sim.clock),
    done: M.done,
  };
}

export { SIM_SECONDS, MATCH_CLOCK_SCALE, onPitch };
