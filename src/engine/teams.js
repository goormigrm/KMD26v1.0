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
 * 엔진용 팀 객체를 만든다.
 * @param {object} meta   teams.json 의 구단 항목 {id,name,short,col,col2,div}
 * @param {Array}  roster players.json 의 그 구단 선수 배열
 * @param {object} plan   { tac, roles } — 라인업 화면이 만든 전술·역할
 */
export function buildTeam(meta, roster, plan = {}) {
  const tac = Object.assign(
    { formation: "4-3-3", mentality: 2, pass: 2, tempo: 2, press: 2,
      line: 2, width: 2, counter: false, tackle: 2, longShot: 2 },
    plan.tac || {},
    // 역할은 선수 id 로 저장된다 — 커널 getRole() 이 이 모양을 읽는다
    { role: clone(plan.roles || {}), benchSel: [], slot: {}, zone: {} }
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
