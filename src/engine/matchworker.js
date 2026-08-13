/* ─────────────────────────────────────────────────────────────
   경기 일꾼

   경기 한 판이 8초쯤 걸립니다. 화면에서 그대로 돌리면 그동안 아무것도 못 하므로
   따로 떼어 냅니다. 끝나면 결과 한 덩어리를 통째로 넘깁니다 —
   화면은 그걸 시간 순으로 "재생"만 합니다.

   ⚠ 경기를 실시간으로 한 틱씩 돌려 보여 주지 않는 이유:
     그렇게 하면 배속을 올릴 수 없고(엔진 속도가 상한이 된다), 중간에 되감을 수도 없습니다.
     먼저 다 돌린 뒤 재생하면 1·2·4배속도 되감기도 공짜입니다.
   ───────────────────────────────────────────────────────────── */

import { runHeadless, deriveSeed } from "./duel.js?v=7640ec1658";
import { checkLineup, prepareSides, aiLineup, AI_PRESETS, counterPreset } from "./teams.js?v=7640ec1658";
import { encodePlan } from "../codec/duelcode.js?v=7640ec1658";
import { makeReactions } from "./reactions.js?v=7640ec1658";
import { slotRating } from "./kernel.js?v=7640ec1658";
import { installEngineContext } from "./stubs.js?v=7640ec1658";

/* 연습 모드의 상대를 여기서 짠다 — 화면이 아니라 일꾼에서.
   "어려움"이 쓰는 slotRating 은 커널 함수라 화면에 올릴 수 없다(6천 줄). */
function aiPlan(ai, teamsMeta, playersDB, myTac) {
  const level = ai.level || "normal";
  const key = level === "hard" ? counterPreset(myTac) : (ai.preset || "press");
  const P = AI_PRESETS[key] || AI_PRESETS.press;
  const form = ai.formation || "4-3-3";
  const lu = aiLineup(playersDB[ai.id], ai.tables, form, level, slotRating);
  return {
    id: ai.id, xiMap: lu.xi, xi: Object.values(lu.xi), bench: lu.bench,
    tac: Object.assign({ formation: form }, P.tac), roles: {},
    // 보통·어려움은 후반에 스스로 지시를 바꾼다 (쉬움은 가만히 있는다)
    autoTactic: level !== "easy",
    aiInfo: { level, preset: key, presetName: P.n, hint: P.hint, formation: form },
  };
}

self.onmessage = (e) => {
  const { teams, players, home: homePlan, reactions } = e.data;
  let awayPlan = e.data.away;
  try {
    // 연습 경기 — 상대 라인업·전술을 AI 감독이 짠다
    if (awayPlan && awayPlan.ai) {
      /* ⚠ "어려움"이 쓰는 slotRating 은 리그 평균(attrMeans)을 보고, 그 함수는 전역 G 를
         읽는다. runHeadless 가 문맥을 세우기 **전**이라 여기서 먼저 세워 준다.
         경기 시작 때 같은 두 팀으로 다시 세우므로 평균값은 달라지지 않는다. */
      installEngineContext([
        { id: homePlan.id, players: players[homePlan.id] },
        { id: awayPlan.id, players: players[awayPlan.id] },
      ], 0);
      awayPlan = aiPlan(Object.assign({ tables: awayPlan.tables }, awayPlan.ai),
                        teams, players, homePlan.tac);
    }
    const practice = !!(e.data.away && e.data.away.ai);

    /* ── 시드는 대전 코드 두 개에서 뽑는다 (설계 결정 D-1) ──────────────
       ⚠ 예전에는 planSig(라인업 **객체**)로 뽑았다. 그런데 화면이 세운 라인업과
         코드에서 되살린 라인업은 모양이 다르다 — 자동 라인업은 전술 슬라이더도 역할도
         비어 있고, 코드에서 되살리면 기본값(슬라이더 전부 2 · 자리별 기본 역할)이
         채워져 들어온다. 같은 라인업인데 지문이 갈리니 시드도 갈렸고,
         결과 링크를 열면 방금 본 경기와 전혀 다른 경기가 재생됐다.
         (제보: 같은 링크에서 시드 17f5f8c → 91363c5d)
         코드는 두 사람이 실제로 주고받는 바로 그 문자열이다. 시드를 여기서 뽑아야
         "코드가 같으면 같은 경기"가 성립한다 — 화면 문구도 그렇게 약속하고 있다.
       ⚠ 선수 id 를 옮기기 **전**에 뽑는다. prepareSides 가 같은 구단끼리 붙을 때
         원정 쪽 id 를 +100000 하므로, 그 뒤에 뽑으면 두 사람의 값이 어긋난다. */
    let codeA = null, codeB = null;
    if (!practice) {
      const cc = e.data.codeCtx;
      if (!cc) throw new Error("대전 코드 문맥이 없습니다 — 시드를 뽑을 수 없습니다");
      const ctx = { order: cc.order, tables: cc.tables, players, dataHash: cc.dataHash };
      codeA = encodePlan(homePlan, ctx);
      codeB = encodePlan(awayPlan, ctx);

      /* 같은 구단끼리는 붙을 수 있다. 단, 코드가 한 글자도 다르지 않으면 두 팀을 가릴
         것이 없다(지문도 대칭이라 승자가 시드 운으로만 갈린다). */
      if (codeA === codeB) {
        throw new Error("양 팀의 선수·전술이 완전히 같습니다 — 한쪽 라인업을 바꿔 주세요.");
      }
    }

    // 같은 구단이면 원정 쪽 선수 id·이름표·색을 갈라 놓는다 (teams.js 참고)
    const { H, A, home, away } = prepareSides(teams, players, homePlan, awayPlan);

    for (const [side, t, plan] of [["홈", H, home], ["원정", A, away]]) {
      const bad = checkLineup(t, plan.xi);
      if (bad) throw new Error(`${side} 팀(${t.short}) 라인업 — ${bad}`);
    }

    /* 연습은 매 판 새 시드다. 대전의 "같은 라인업이면 한 판만 성립"은 결과를 골라
       보낼 수 없게 하려는 규칙이라 대전에만 해당한다(설계서 단계 A). */
    const seed = practice ? ((e.data.seed >>> 0) || 1) : deriveSeed(codeA, codeB);

    // 연습 상대만 스스로 지시를 바꾼다 (rules.js 의 aiTacticCheck 래퍼가 이 스위치를 본다)
    A.autoTactic = !!awayPlan.autoTactic;
    H.autoTactic = false;

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

    const msg = {
      ok: true,
      seed, fp: r.fp,
      home: { id: H.id, name: H.name, short: H.short, col: H.col, goals: r.hg },
      away: { id: A.id, name: A.name, short: A.short, col: A.col, goals: r.ag },
      events, goalLine: r.goalLine, stats: r.stats,
      clips: r.clips || [], roster: r.roster || {},
      /* 장면과 장면 사이를 채우는 관전 트랙 — 평평한 Float32Array (replay.js 머리말 참고).
         예전에는 이 사이가 정지 화면이었다. */
      watch: r.watch || null,
      // 관전 트랙이 아직 비어 있는 첫 순간에 세워 둘 킥오프 한 장
      form0: r.form0 || null,
      /* 팬 반응 — 양쪽 시선 모두. 경기가 끝난 뒤에 뽑으므로 결과에 영향이 없다.
         구단 id 도 넘긴다 — 이름이 붙은 더비(슈퍼매치 등)를 가리는 데 쓴다. */
      react: (() => {
        const ctx = Object.assign({}, r,
          { home: H.short, away: A.short, homeId: H.id, awayId: A.id, seed });
        return { h: makeReactions(ctx, reactions, "h"), a: makeReactions(ctx, reactions, "a") };
      })(),
      practice, ai: awayPlan.aiInfo || null,
      possession: r.possession, referee: r.referee,
      clock: r.clock, elapsedMs: r.elapsedMs, nameOf,
    };
    /* 관전 트랙은 500KB 남짓이라 복사하면 아깝다 — 소유권을 넘긴다(transfer).
       넘긴 뒤에는 일꾼 쪽 버퍼가 비므로, 이 아래에서 다시 읽지 말 것. */
    self.postMessage(msg, msg.watch ? [msg.watch.buffer] : []);
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
