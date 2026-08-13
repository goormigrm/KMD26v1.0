/* ─────────────────────────────────────────────────────────────
   경기 일꾼

   경기 한 판이 8초쯤 걸립니다. 화면에서 그대로 돌리면 그동안 아무것도 못 하므로
   따로 떼어 냅니다. 끝나면 결과 한 덩어리를 통째로 넘깁니다 —
   화면은 그걸 시간 순으로 "재생"만 합니다.

   ⚠ 경기를 실시간으로 한 틱씩 돌려 보여 주지 않는 이유:
     그렇게 하면 배속을 올릴 수 없고(엔진 속도가 상한이 된다), 중간에 되감을 수도 없습니다.
     먼저 다 돌린 뒤 재생하면 1·2·4배속도 되감기도 공짜입니다.
   ───────────────────────────────────────────────────────────── */

import { runHeadless, deriveSeed } from "./duel.js";
import { buildTeam, checkLineup, lineupSig } from "./teams.js";

self.onmessage = (e) => {
  const { teams, players, home, away } = e.data;
  try {
    const H = buildTeam(teams[home.id], players[home.id], home);
    const A = buildTeam(teams[away.id], players[away.id], away);

    for (const [side, t, plan] of [["홈", H, home], ["원정", A, away]]) {
      const bad = checkLineup(t, plan.xi);
      if (bad) throw new Error(`${side} 팀(${t.short}) 라인업 — ${bad}`);
    }

    /* 시드는 양쪽 라인업에서 함께 유도한다 (설계 결정 D-1).
       단계 5 의 대전 코드가 이 자리를 대신할 때까지, 성질만 미리 갖춰 둔다 —
       같은 라인업끼리 붙으면 언제 어디서 돌려도 같은 경기가 나온다. */
    const seed = deriveSeed(
      lineupSig(home.id, home.xiMap, home.bench, home.tac, home.roles),
      lineupSig(away.id, away.xiMap, away.bench, away.tac, away.roles));

    const r = runHeadless(H, A, {
      seed,
      homeXI: home.xi, awayXI: away.xi,
      homeBench: home.bench.filter(Boolean), awayBench: away.bench.filter(Boolean),
    });

    // 이름표를 붙여 넘긴다 — 화면이 선수 id 를 다시 뒤지지 않게
    const nameOf = {};
    for (const t of [H, A]) for (const p of t.players) nameOf[p.id] = p.name;

    /* 이벤트에 붙은 form(그 순간 22명 좌표)·scene 은 2D 재생용이라 지금은 안 쓴다.
       한 경기에 수십 개가 붙어 전송량이 커지므로 걷어낸다. 2D 를 붙일 때 되살린다. */
    const events = r.events.map(e =>
      ({ min: e.min, t: e.t, txt: e.txt, type: e.type, noTime: e.noTime,
         col: e.col, hg: e.hg, ag: e.ag }));

    self.postMessage({
      ok: true,
      seed, fp: r.fp,
      home: { id: H.id, name: H.name, short: H.short, col: H.col, goals: r.hg },
      away: { id: A.id, name: A.name, short: A.short, col: A.col, goals: r.ag },
      events, goalLine: r.goalLine, stats: r.stats,
      possession: r.possession, referee: r.referee,
      clock: r.clock, elapsedMs: r.elapsedMs, nameOf,
    });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
