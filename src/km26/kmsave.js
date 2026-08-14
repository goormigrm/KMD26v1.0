/* ─────────────────────────────────────────────────────────────
   KM26 세이브 파일 → KMD26 이 쓰는 명단·전술

   무엇을 하나
   -----------
   원본 개리그 매니저(KM26)에서 **세이브파일 저장**을 누르면 떨어지는
   `klm2026_<팀>_<시즌>_<날짜>.json` 을 읽어, 그 안의 29개 구단 명단과
   내가 짜 둔 전술을 KMD26 이 쓰는 모양으로 옮깁니다.

   ⚠ **KM26 을 고치지 않습니다.** 세이브 파일은 KM26 이 원래 내보내 주는 것이고,
     여기서는 읽기만 합니다.

   왜 되나 — 두 게임의 어휘가 같습니다
   -----------------------------------
   KMD26 의 표는 KM26 원본에서 뽑아 만든 것입니다. 실제로 대조해 보면
   포메이션 12종·슬라이더 8종·`rowSlots` 격자·역할 49종·`roleGrp` 이
   **이름까지 같습니다.** 그래서 옮겨 적을 것이 없고 골라 담기만 하면 됩니다.

   선수 객체도 KMD26 이 쓰는 18개 필드(`tools/gendata` 의 `playerKeep`)가
   KM26 선수에 **하나도 빠짐없이** 들어 있습니다 (2026-08-14 실측: 안양 38명 전원).

   무엇이 안 오나
   --------------
   · **선발 11명이 온전히 저장돼 있지 않습니다.** KM26 은 `bestXI()` 로 그때그때
     채우기 때문에, 세이브에는 손으로 정한 자리(`tactic.slot`)와 `G.userXI` 만
     남습니다. 실측에서 4-2-3-1 열한 자리 중 **아홉 자리 + 골키퍼**만 있었고
     `LDM` 이 비어 있었습니다.
   · **교체 명단이 없습니다** (`benchSel` 이 빈 배열).
   · 조건부 지시는 KM26 에 아예 없는 기능입니다.
   그래서 빈 자리와 교체 아홉 칸은 `autoLineup` 으로 채우고, 화면에서 고치게 합니다.

   ⚠ 이 파일은 커널을 부르지 않습니다 — 페이지에 올려도 무겁지 않습니다.
   ───────────────────────────────────────────────────────────── */

import { ctrLevel } from "../codec/duelcode.js?v=0631260f6e";

/** KMD26 이 선수에게서 쓰는 값 — `tools/gendata` 의 playerKeep 과 같아야 한다 */
export const PLAYER_KEEP = [
  "id", "name", "pos", "prefPos", "no", "by", "bd", "h", "w", "frn", "foot",
  "ovr", "pers", "traits", "attr", "gkA", "gk", "posFam",
];

/* 별점을 매길 때 쓰는 능력치 묶음 — `src/data/gen.js` 와 **같아야 한다.**
   여기만 고치면 가져온 선수의 별점이 기본 명단과 다른 잣대로 매겨진다. */
const MENT_ATTRS = ["agg", "ant", "bra", "cmp", "cnt", "dec", "det", "fla", "ldr", "otb", "pos", "tea", "vis", "wor"];
const PHYS_ATTRS = ["acc", "agi", "bal", "jum", "nat", "pac", "sta", "str"];

/**
 * 선수의 "수준" — `src/data/gen.js` · 커널의 playerLevel 과 같은 식이다.
 * 골키퍼는 필드 능력치가 원래 낮게 생성되므로 전용 능력치를 주로 본다.
 */
function playerLevel(p) {
  const a = p.attr;
  if (!a) return 62;
  if (p.pos === "GK" && p.gkA) {
    let g = 0, gn = 0;
    for (const k in p.gkA) if (typeof p.gkA[k] === "number") { g += p.gkA[k]; gn++; }
    let m = 0, mn = 0;
    for (const k of MENT_ATTRS.concat(PHYS_ATTRS)) if (typeof a[k] === "number") { m += a[k]; mn++; }
    return (gn ? g / gn : 62) * 0.75 + (mn ? m / mn : 62) * 0.25;
  }
  let s = 0, n = 0;
  for (const k in a) if (typeof a[k] === "number") { s += a[k]; n++; }
  return n ? s / n : 62;
}

/**
 * 별점 0.5~5 — **기본 명단과 같은 잣대**로 매긴다.
 * 기준(`starRange`)이 `data/meta.json` 에 실려 있어 새로 재지 않고 그 눈금에 대 본다.
 * 가져온 선수만 따로 재면 약팀 스쿼드의 후보가 5★ 로 뜨는 식이 된다.
 */
export function starOf(p, meta) {
  const r = (meta && meta.starRange) || [44.725, 73.575];
  const lo = +r[0], hi = +r[1];
  const span = Math.max(1, hi - lo);
  const v = 0.5 + ((playerLevel(p) - lo) / span) * 4.5;
  return Math.max(0.5, Math.min(5, Math.round(v * 2) / 2));
}

/* ── 세이브 읽기 ─────────────────────────────────────────────── */

/**
 * 세이브 파일 본문(글자) → 확인된 세이브 객체.
 * 조용히 엉뚱하게 읽히는 것이 최악이므로, 아니면 **왜 아닌지**를 돌려준다.
 * @returns {{ok:boolean, why?:string, G?:object}}
 */
export function readSave(text) {
  let G;
  try {
    G = JSON.parse(text);
  } catch (e) {
    return { ok: false, why: "JSON 을 읽지 못했습니다 — 세이브 파일이 아니거나 잘렸습니다." };
  }
  if (!G || typeof G !== "object") return { ok: false, why: "빈 파일입니다." };
  /* KM26 의 loadGame() 도 이 한 가지로 세이브인지 가린다 (index_new.html:9400 근처) */
  if (!G.teams) return { ok: false, why: "개리그 매니저(KM26) 세이브 파일이 아닙니다 — 구단 정보가 없습니다." };

  const teams = teamListOf(G);
  if (!teams.length) return { ok: false, why: "구단이 하나도 없습니다." };
  const withPlayers = teams.filter(t => Array.isArray(t.players) && t.players.length);
  if (!withPlayers.length) return { ok: false, why: "구단에 선수 명단이 없습니다." };

  return { ok: true, G };
}

/** `G.teams` 는 판에 따라 배열이거나 객체다 — 둘 다 받는다 */
export function teamListOf(G) {
  const t = G && G.teams;
  if (!t) return [];
  return Array.isArray(t) ? t : Object.keys(t).map(k => t[k]).filter(Boolean);
}

/** 세이브 한 줄 소개 — 화면에 "무엇을 불러왔는지" 보여 주려고 */
export function saveInfo(G) {
  const teams = teamListOf(G);
  const me = teams.find(t => t.id === G.userTeamId) || null;
  return {
    season: G.season || null,
    userTeamId: G.userTeamId || null,
    userTeamName: me ? (me.short || me.name || me.id) : null,
    teamCount: teams.length,
    playerCount: teams.reduce((n, t) => n + ((t.players || []).length), 0),
    /* 프리시즌인지 시즌 중인지 — 명단이 언제 것인지 알려 주는 표시 */
    phase: G.phase || null,
  };
}

/* ── 명단 ────────────────────────────────────────────────────── */

/**
 * 한 구단의 명단을 KMD26 모양으로. **필요한 값만 골라 담는다** —
 * 계약·사기·부상 같은 시즌 전용 값은 듀얼에서 쓰지 않으므로 버린다.
 *
 * ⚠ 선수 id 는 KM26 것을 그대로 쓴다. 실측에서 1~1033 이라 원정 쪽에 100000 을
 *   더하는 규칙(AWAY_ID_SHIFT)과 겹치지 않는다. 다만 **다른 세이브끼리 붙이면
 *   같은 번호가 서로 다른 선수일 수 있으므로**, 부르는 쪽에서 원정을 반드시
 *   옮겨야 한다(km-match 경로는 늘 옮긴다).
 */
export function squadOf(team, meta) {
  const out = [];
  for (const p of (team.players || [])) {
    if (!p || !p.attr) continue;
    const q = {};
    for (const k of PLAYER_KEEP) if (p[k] !== undefined) q[k] = p[k];
    q.star = starOf(p, meta);
    out.push(q);
  }
  return out;
}

/** 구단 겉면 — 색·이름. KMD26 화면이 그대로 쓰는 모양이다 */
export function metaOf(team) {
  return {
    id: team.id,
    name: team.name || team.short || team.id,
    short: team.short || team.name || team.id,
    col: team.col || "#888888",
    col2: team.col2 || "#333333",
    div: team.div || 1,
  };
}

/* ── 전술 ────────────────────────────────────────────────────── */

/**
 * 세이브의 전술을 KMD26 라인업 한 벌로 옮긴다.
 *
 * 자리는 `tactic.slot`(감독이 손으로 정한 것)을 **그대로 지키고**, 비는 자리와
 * 교체 아홉 칸은 부르는 쪽이 넘겨준 `fill()`(보통 autoLineup)로 채운다.
 *
 * @param {object} team   세이브의 구단 객체
 * @param {object} G      세이브 전체 (G.userXI 를 본다)
 * @param {object} tables data/teams.json 의 tables
 * @param {function} fill (roster, tables, formation) => {xi, bench}
 * @returns {{plan:object, note:object}} note 는 무엇을 자동으로 채웠는지
 */
export function planOf(team, G, tables, squad, fill) {
  const T = team.tactic || {};
  const formation = tables.formation[T.formation] ? T.formation : "4-3-3";
  const slots = ["GK", ...tables.formation[formation].map(s => s[1])];
  const have = new Set(squad.map(p => p.id));

  /* ① 손으로 정한 자리부터 — 이것이 "가져온다"의 핵심이다 */
  const xi = {};
  const used = new Set();
  for (const pid of Object.keys(T.slot || {})) {
    const id = +pid, slot = T.slot[pid];
    if (!have.has(id) || !slots.includes(slot) || xi[slot] != null || used.has(id)) continue;
    xi[slot] = id; used.add(id);
  }

  /* ② 골키퍼 — KM26 은 GK 를 slot 표에 넣지 않는다. userXI 에서 찾는다 */
  if (xi.GK == null) {
    const gk = (G.userXI || []).map(id => squad.find(p => p.id === id))
      .find(p => p && p.pos === "GK" && !used.has(p.id));
    if (gk) { xi.GK = gk.id; used.add(gk.id); }
  }

  /* ③ 그래도 비는 자리 — userXI 에 남은 사람 먼저, 그다음 자동 배치 */
  const kept = Object.keys(xi).length;
  for (const id of (G.userXI || [])) {
    const empty = slots.find(s => xi[s] == null);
    if (!empty) break;
    if (!have.has(id) || used.has(id)) continue;
    xi[empty] = id; used.add(id);
  }
  let autoXI = 0;
  if (slots.some(s => xi[s] == null)) {
    const rest = squad.filter(p => !used.has(p.id));
    const auto = fill(rest, tables, formation);
    for (const s of slots) {
      if (xi[s] != null || auto.xi[s] == null) continue;
      xi[s] = auto.xi[s]; used.add(auto.xi[s]); autoXI++;
    }
  }

  /* ④ 교체 아홉 칸 — 세이브에 없다(benchSel 이 비어 있다). 자동으로 채운다 */
  const bench = new Array(9).fill(null);
  const benchSel = Array.isArray(T.benchSel) ? T.benchSel : [];
  let bi = 0;
  for (const id of benchSel) {
    if (bi >= 9 || !have.has(id) || used.has(id)) continue;
    bench[bi++] = id; used.add(id);
  }
  const fromSave = bi;
  const rest2 = squad.filter(p => !used.has(p.id));
  const auto2 = fill(rest2, tables, formation);
  for (const id of auto2.bench) {
    if (bi >= 9) break;
    if (id == null || used.has(id)) continue;
    bench[bi++] = id; used.add(id);
  }

  /* ⑤ 역할 — KM26 은 선수 id 로 들고 있고 KMD26 도 그렇다. 그대로 옮긴다.
        다만 그 선수가 실제로 선 자리에서 맡을 수 있는 역할인지 걸러 준다. */
  const roles = {};
  let roleSkip = 0;
  const slotOf = {};
  for (const s of slots) if (xi[s] != null) slotOf[xi[s]] = s;
  for (const pid of Object.keys(T.role || {})) {
    const id = +pid, rd = T.role[pid];
    const slot = slotOf[id];
    if (!slot || !rd || !rd.r) continue;
    const grp = tables.roleGrp[slot];
    const R = tables.roles.find(r => r.k === rd.r);
    if (!R || !R.grp.includes(grp)) { roleSkip++; continue; }
    roles[id] = { r: R.k, d: (R.duty || []).includes(rd.d) ? rd.d : (R.duty || ["S"])[0] };
  }

  /* ⑥ 슬라이더 여덟 개 + 역습 단계.
        ⚠ 역습은 KM26 신판에서 0~4 단계다. 값이 **빠져 있을 때만** 2(보통)로 본다 —
          KM26 의 기본값이 2 이기 때문이다. KMD26 자체 기본값(끔=0)과 다른 자리다. */
  const tac = { formation };
  for (const k of tables.tacKeys) {
    const v = T[k];
    tac[k] = Number.isFinite(+v) ? Math.max(0, Math.min(4, Math.round(+v))) : 2;
  }
  tac.counter = T.counter == null ? 2 : ctrLevel(T.counter);

  return {
    plan: {
      id: team.id, name: team.short || team.id, formation,
      xi, bench, tac, roles,
      cond: [0, 0, 0, 0, 0, 0],       // KM26 에 없는 기능 — 화면에서 채운다
    },
    note: {
      keptSlots: kept,               // 세이브가 정해 준 자리 수
      autoXI,                        // 자동으로 채운 선발 자리 수
      benchFromSave: fromSave,       // 세이브에서 온 교체 인원
      benchAuto: bi - fromSave,      // 자동으로 채운 교체 인원
      roleSkip,                      // 그 자리에서 못 맡는 역할이라 버린 수
      counterFromSave: T.counter != null,
    },
  };
}

/* ── 명단 팩 (localStorage 에 두는 모양) ──────────────────────── */

export const PACK_KIND = "kmd26-km26pack";
export const PACK_VER = 1;

/**
 * 세이브에서 뽑은 것을 한 덩어리로 묶는다. 이 덩어리가 게시판에도 올라간다.
 * ⚠ 경기 두 벌이 같은 팩이면 같은 경기다 — 그래서 팩에 지문을 붙여 둔다.
 */
export function makePack(G, teamId, tables, meta, fill) {
  const team = teamListOf(G).find(t => t.id === teamId);
  if (!team) return { ok: false, why: `세이브에 ${teamId} 구단이 없습니다.` };
  const squad = squadOf(team, meta);
  if (squad.length < 11) return { ok: false, why: `선수가 ${squad.length}명뿐입니다 (11명 이상이어야 합니다).` };
  const { plan, note } = planOf(team, G, tables, squad, fill);
  return {
    ok: true,
    pack: {
      kind: PACK_KIND, ver: PACK_VER,
      from: "KM26", season: G.season || null,
      team: metaOf(team),
      squad,
      plan,
    },
    note,
  };
}

/* ── 게시판에 올릴 때는 줄인다 ────────────────────────────────
   팩을 그대로 올리면 한 건에 30KB 다(실측: 안양 38명). 경기에 나올 수 있는 사람은
   선발 열한 명 + 교체 아홉 명 **스무 명뿐**이고, 나머지는 아무 일도 하지 않는다.
   거기에 값이 뻔한 칸을 덜어 낸다.

   · **명단을 스무 명으로** — 나올 수 없는 사람은 담지 않는다
   · **0인 포지션 능숙도** — 열일곱 자리 중 대부분이 0 이다. 없으면 0 으로 읽는다

   ⚠ **겹치는 능력치 세 쌍은 덜어 내지 않는다.** `pace`/`pac` · `pass`/`pas` ·
     `pos_`/`pos` 는 원본의 구 호환 레이어라 한쪽만 담고 되살리면 될 것처럼 보인다.
     기본 명단(`data/players.json`) 1,024명은 실제로 짝이 전부 같다. 그런데 **KM26
     세이브에서는 다르다** — 시즌을 굴리며 훈련·성장으로 한쪽만 갱신된 선수가 있다
     (실측: 스무 명 중 48곳). 덜어 냈다가 되살리면 능력치가 조용히 달라진다.
     `kmcheck` 의 왕복 검사가 이걸 잡았다. 다시 덜어 내려 하지 말 것.

   ⚠ 되살리는 쪽(`fatten`)과 짝이다. 한쪽만 고치면 능력치가 조용히 비어 경기가 달라진다. */

/** 게시판에 올릴 모양으로 줄인다 */
export function slimPack(pack) {
  const p = pack.plan;
  const keep = new Set(Object.keys(p.xi).map(s => p.xi[s]).concat(p.bench).filter(v => v != null));
  const squad = pack.squad.filter(q => keep.has(q.id)).map(q => {
    const o = Object.assign({}, q);
    if (q.posFam) {
      o.posFam = {};
      for (const k of Object.keys(q.posFam)) if (q.posFam[k]) o.posFam[k] = q.posFam[k];
    }
    if (o.traits && !o.traits.length) delete o.traits;
    return o;
  });
  return { kind: PACK_KIND, ver: PACK_VER, from: pack.from, season: pack.season,
           slim: 1, team: pack.team, squad, plan: p };
}

/** 줄여 놓은 팩을 되살린다 — `slimPack` 과 짝이다 */
export function fatten(pack) {
  if (!pack || !pack.slim) return pack;
  const squad = pack.squad.map(q => {
    const o = Object.assign({}, q);
    const fam = {};
    for (const k of POS_FAM_KEYS) fam[k] = (q.posFam && q.posFam[k]) || 0;
    o.posFam = fam;
    if (!o.traits) o.traits = [];
    return o;
  });
  return Object.assign({}, pack, { slim: 0, squad });
}

/** 포지션 능숙도 열일곱 자리 — `data/players.json` 과 같은 목록이어야 한다 */
export const POS_FAM_KEYS = ["AMC", "AML", "AMR", "DC", "DL", "DM", "DR", "GK",
  "LW", "MC", "ML", "MR", "RW", "ST", "SW", "WBL", "WBR"];

/** 팩이 성한지 — 남이 올린 것을 받을 때 쓴다 */
export function checkPack(pack, tables) {
  if (!pack || pack.kind !== PACK_KIND) return "KM26 명단 팩이 아닙니다.";
  if (!pack.team || !pack.team.id) return "구단 정보가 없습니다.";
  if (!Array.isArray(pack.squad) || pack.squad.length < 11) return "선수 명단이 모자랍니다.";
  const p = pack.plan;
  if (!p || !tables.formation[p.formation]) return "모르는 포메이션입니다.";
  const slots = ["GK", ...tables.formation[p.formation].map(s => s[1])];
  const have = new Set(pack.squad.map(q => q.id));
  for (const s of slots) {
    if (p.xi[s] == null) return `${s} 자리가 비어 있습니다.`;
    if (!have.has(p.xi[s])) return `${s} 자리의 선수가 명단에 없습니다.`;
  }
  if (!pack.squad.some(q => q.pos === "GK")) return "골키퍼가 없습니다.";
  return null;
}
