/* ─────────────────────────────────────────────────────────────
   data/*.json → 엔진이 받는 팀 객체

   test/fixture.js 가 합성 스쿼드로 하던 일을, 실제 K리그 명단으로 합니다.
   화면(라인업 편집)이 만든 값 — 선발·교체·전술·역할 — 을 그대로 얹습니다.

   ⚠ 선수 객체는 반드시 복사합니다.
     엔진은 경기 중 선수 객체를 건드립니다(컨디션·경고·능숙도). 원본 JSON 을 그대로
     넘기면 두 번째 경기가 첫 경기의 흔적을 안고 시작해 재생이 갈라집니다.
   ───────────────────────────────────────────────────────────── */

/** 깊은 복사 — 능력치·능숙도까지 새 객체로 (JSON 데이터라 이걸로 충분합니다) */
const clone = o => JSON.parse(JSON.stringify(o));

/**
 * 전술판에서 감독이 끌어다 놓은 자리 → 커널이 읽는 모양(선수id → 자리).
 *
 * 커널 computeRenderSlots() 는 `t.tactic.slot` 을 **최우선으로** 지키고, 없는 선수만
 * 포메이션의 남은 자리에 자동 배치합니다. 여기서 빈 표를 넘기면 감독이 짠 배치가
 * 전부 자동 배치로 덮입니다 — "센터백을 최전방에" 같은 자유 배치(설계 결정)가 무의미해집니다.
 */
function slotMapOf(plan) {
  const out = {};
  // 라인업 화면은 자리→선수id 로 들고 있다 (xiMap, 저장 슬롯 파일에서는 xi)
  const bySlot = plan.xiMap || (Array.isArray(plan.xi) ? null : plan.xi);
  if (!bySlot) return out;
  for (const slot of Object.keys(bySlot)) if (bySlot[slot] != null) out[bySlot[slot]] = slot;
  return out;
}

/**
 * 엔진용 팀 객체를 만든다.
 * @param {object} meta   teams.json 의 구단 항목 {id,name,short,col,col2,div}
 * @param {Array}  roster players.json 의 그 구단 선수 배열
 * @param {object} plan   { tac, roles, xiMap, formation } — 라인업 화면이 만든 것
 */
export function buildTeam(meta, roster, plan = {}) {
  // 포메이션은 tac 안에 있을 수도(경기 화면), 한 칸 밖에 있을 수도(저장 슬롯 파일) 있다
  const formation = (plan.tac && plan.tac.formation) || plan.formation || "4-3-3";
  const tac = Object.assign(
    { mentality: 2, pass: 2, tempo: 2, press: 2,
      line: 2, width: 2, counter: false, tackle: 2, longShot: 2 },
    plan.tac || {},
    // 역할은 선수 id 로 저장된다 — 커널 getRole() 이 이 모양을 읽는다
    { formation, role: clone(plan.roles || {}), benchSel: [], slot: slotMapOf(plan), zone: {} }
  );

  return {
    id: meta.id, name: meta.name, short: meta.short,
    col: meta.col, col2: meta.col2, div: meta.div,
    players: clone(roster),
    fam: 100, morale: 75, isUser: false,
    W: 0, Dw: 0, L: 0, GF: 0, GA: 0, Pts: 0, form: [],
    tactic: tac,
  };
}

/**
 * 라인업이 경기를 치를 수 있는 상태인지 본다.
 * 화면에서 막아도 저장된 라인업이 낡았을 수 있으므로 여기서 한 번 더 본다.
 */
export function checkLineup(team, xiIds) {
  const has = id => team.players.some(p => p.id === id);
  const ids = (xiIds || []).filter(has);
  if (ids.length !== 11) return `선발이 ${ids.length}명입니다 (11명이어야 합니다)`;
  if (new Set(ids).size !== 11) return "같은 선수가 두 자리에 있습니다";
  const gk = ids.filter(id => team.players.find(p => p.id === id).pos === "GK");
  if (!gk.length) return "골키퍼가 없습니다";
  return null;
}

/**
 * 자동 라인업 — 자리마다 "능숙도 × 별점"이 가장 높은 선수부터 채운다.
 *
 * 라인업 화면과 경기 화면이 각자 구현하면 반드시 어긋난다(상대 팀만 다른 규칙으로
 * 짜이는 식으로). 한 곳에 둔다.
 *
 * @returns {{xi:Object, bench:Array}} xi 는 자리→선수id, bench 는 아홉 칸
 */
export function autoLineup(roster, tables, formation = "4-3-3") {
  const slots = ["GK", ...(tables.formation[formation] || []).map(s => s[1])];
  const famOf = (p, slot) => (p.posFam && p.posFam[tables.slotFam[slot]]) || 0;
  const score = (p, slot) => {
    // 자동은 "어울리는 선수"를 고른다. 손으로는 아무나 세울 수 있다.
    if ((slot === "GK") !== (p.pos === "GK")) return -1;
    return famOf(p, slot) / 100 * 1.1 + (p.star || 0) / 5;
  };

  const xi = {}, used = new Set();
  for (const slot of slots) {
    let best = null, bs = -1;
    for (const p of roster) {
      if (used.has(p.id)) continue;
      const s = score(p, slot);
      if (s > bs) { bs = s; best = p; }
    }
    if (best && bs >= 0) { xi[slot] = best.id; used.add(best.id); }
  }

  const bench = new Array(9).fill(null);
  const rest = roster.filter(p => !used.has(p.id));
  let i = 0;
  const gk = rest.find(p => p.pos === "GK");   // 키퍼가 다치면 필드 플레이어를 골문에 세워야 한다
  if (gk) { bench[i++] = gk.id; used.add(gk.id); }
  for (const p of rest.slice().sort((a, b) => (b.star || 0) - (a.star || 0))) {
    if (i >= 9) break;
    if (!used.has(p.id)) { bench[i++] = p.id; used.add(p.id); }
  }
  return { xi, bench };
}

/**
 * 라인업 한 벌을 한 줄로 만든다 — 시드를 뽑는 재료다.
 * 단계 5 에서 진짜 대전 코드가 이 자리를 대신한다. 지금은 "같은 라인업이면
 * 같은 경기"라는 성질만 미리 갖춰 둔다.
 */
export function lineupSig(teamId, xi, bench, tac, roles) {
  const slots = Object.keys(xi || {}).sort();
  return [
    teamId,
    slots.map(s => s + ":" + xi[s]).join(","),
    (bench || []).map(b => b ?? "-").join(","),
    ["formation", "mentality", "pass", "tempo", "press", "line", "width", "tackle", "longShot"]
      .map(k => (tac || {})[k]).join(",") + "," + ((tac || {}).counter ? 1 : 0),
    Object.keys(roles || {}).sort().map(id => id + ":" + roles[id].r + roles[id].d).join(","),
  ].join("|");
}

/** 라인업 한 벌의 지문 — 위 lineupSig 을 plan 한 덩어리로 부르는 것 */
export function planSig(plan) {
  return lineupSig(plan.id, plan.xiMap || plan.xi, plan.bench, plan.tac, plan.roles);
}

/* ── 같은 구단끼리의 대전 ────────────────────────────────────────
   "울산 vs 울산" 을 막을 이유는 없습니다 — 선수와 전술이 다르면 다른 팀입니다.
   다만 엔진과 화면에 두 군데 걸림돌이 있어 먼저 치워야 합니다.

   ① 선수 id 충돌 — 커널은 양 팀 22명을 한 배열(agents)에 담고 id 로 찾습니다.
        byId(id){ return this.agents.find(a=>a.id===id) }
      같은 구단을 양쪽에 세우면 원정 슈터를 찾을 때 홈 선수가 잡혀 경기가 엉킵니다.
      그래서 원정 쪽 선수 id 를 통째로 옮깁니다. 선수 id 는 1~1024 이므로 10만을
      더해도 겹치지 않습니다.
      ⚠ 옮긴 id 는 **엔진 안에서만** 삽니다. 시드(= 단계 5 의 대전 코드)는 반드시
        옮기기 전 id 로 뽑아야 두 사람의 코드가 같은 값을 냅니다.

   ② 이름·색 충돌 — 이름표가 같으면 해설도 팬 반응도 어느 쪽인지 알 수 없습니다.
      게다가 커널 ev() 는 "직전 줄과 같은 팀인가"를 이름표(short)로 판단해
      (`prev.t===t`) 시간 배지를 생략하므로, 이름이 같으면 상대 팀 줄이 우리 줄에
      이어 붙습니다. 원정 쪽에 (어웨이) 를 붙이고 원정 유니폼 색(col2)을 입힙니다.
   ──────────────────────────────────────────────────────────── */
export const AWAY_ID_SHIFT = 100000;

/** 선수 id 를 옮긴 명단 (얕은 복사 — buildTeam 이 다시 깊은 복사한다) */
export function shiftRoster(roster, shift = AWAY_ID_SHIFT) {
  return (roster || []).map(p => Object.assign({}, p, { id: p.id + shift }));
}

/** 라인업 한 벌의 선수 id 를 같은 만큼 옮긴다 (선발·교체·역할 모두) */
export function shiftPlan(plan, shift = AWAY_ID_SHIFT) {
  const s = id => (id == null ? id : id + shift);
  const bySlot = plan.xiMap || (Array.isArray(plan.xi) ? null : plan.xi) || {};
  const xiMap = {};
  for (const slot of Object.keys(bySlot)) xiMap[slot] = s(bySlot[slot]);
  const roles = {};
  // 역할 표의 키는 선수 id 다. 숫자가 아니면 옮기지 않고 그대로 둔다(조용히 잃지 않게)
  for (const k of Object.keys(plan.roles || {}))
    roles[Number.isFinite(+k) ? s(+k) : k] = plan.roles[k];
  return Object.assign({}, plan, {
    xiMap,
    // 선발 순서는 그대로 둔다 — 엔진이 명단 순서를 보는 곳이 있다
    xi: Array.isArray(plan.xi) ? plan.xi.map(s) : Object.values(xiMap),
    bench: (plan.bench || []).map(s),
    roles,
  });
}

/** 같은 구단끼리일 때 쓸 이름표·색 — 화면과 엔진이 같은 값을 쓰게 한곳에 둔다 */
export function sideLabels(meta) {
  return {
    h: { short: meta.short + " (홈)",   name: meta.name + " (홈)",   col: meta.col },
    a: { short: meta.short + " (어웨이)", name: meta.name + " (어웨이)", col: meta.col2 || meta.col },
  };
}

/**
 * 양 팀을 엔진에 넘길 모양으로 함께 갖춘다.
 * 같은 구단이면 원정 쪽 선수 id·이름표·색을 갈라 놓는다.
 *
 * @returns {{H:object, A:object, home:object, away:object, same:boolean}}
 *          home·away 는 **엔진에 넘길** 라인업(같은 구단이면 id 가 옮겨진 것).
 *          시드를 뽑을 때는 원본 plan 을 그대로 쓸 것.
 */
export function prepareSides(teamsMeta, playersDB, homePlan, awayPlan) {
  const same = homePlan.id === awayPlan.id;
  const home = homePlan;
  const away = same ? shiftPlan(awayPlan) : awayPlan;

  const H = buildTeam(teamsMeta[home.id], playersDB[home.id], home);
  const A = buildTeam(teamsMeta[away.id],
    same ? shiftRoster(playersDB[away.id]) : playersDB[away.id], away);

  if (same) {
    const L = sideLabels(teamsMeta[home.id]);
    Object.assign(H, L.h);
    Object.assign(A, L.a);
  }
  return { H, A, home, away, same };
}
