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
import { checkLineup, planSig, prepareSides } from "./teams.js";
import { makeReactions } from "./reactions.js";

self.onmessage = (e) => {
  const { teams, players, home: homePlan, away: awayPlan, reactions } = e.data;
  try {
    /* 시드는 양쪽 라인업에서 함께 유도한다 (설계 결정 D-1).
       ⚠ 선수 id 를 옮기기 **전** 라인업으로 뽑는다 — 단계 5 의 대전 코드와 값이 어긋나면
         두 사람의 재생이 갈라진다. */
    const hSig = planSig(homePlan), aSig = planSig(awayPlan);

    /* 같은 구단끼리는 붙을 수 있다. 단, 선수·전술까지 한 글자도 다르지 않으면
       두 팀을 가릴 것이 없다(지문도 대칭이라 승자가 시드 운으로만 갈린다). */
    if (hSig === aSig) {
      throw new Error("양 팀의 선수·전술이 완전히 같습니다 — 한쪽 라인업을 바꿔 주세요.");
    }

    // 같은 구단이면 원정 쪽 선수 id·이름표·색을 갈라 놓는다 (teams.js 참고)
    const { H, A, home, away } = prepareSides(teams, players, homePlan, awayPlan);

    for (const [side, t, plan] of [["홈", H, home], ["원정", A, away]]) {
      const bad = checkLineup(t, plan.xi);
      if (bad) throw new Error(`${side} 팀(${t.short}) 라인업 — ${bad}`);
    }

    const seed = deriveSeed(hSig, aSig);

    const r = runHeadless(H, A, {
      seed, record: true,        // 2D 하이라이트 좌표를 함께 모은다
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
      clips: r.clips || [], roster: r.roster || {},
      // 장면이 없는 동안 화면에 세워 둘 킥오프 한 장 (0:0 경기에서도 필드가 보이게)
      form0: r.form0 || null,
      // 팬 반응 — 양쪽 시선 모두. 경기가 끝난 뒤에 뽑으므로 결과에 영향이 없다.
      react: {
        h: makeReactions(Object.assign({}, r, {home:H.short, away:A.short, seed}), reactions, "h"),
        a: makeReactions(Object.assign({}, r, {home:H.short, away:A.short, seed}), reactions, "a"),
      },
      possession: r.possession, referee: r.referee,
      clock: r.clock, elapsedMs: r.elapsedMs, nameOf,
    });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
