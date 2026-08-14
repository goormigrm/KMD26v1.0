/* ─────────────────────────────────────────────────────────────
   대전 코드 (단계 5)

   라인업 한 벌을 **300비트 = 38바이트 = Base64url 51자**로 담습니다.
   설계서 제4부 4-1 의 비트 배분을 그대로 따릅니다.

   | 항목 | 비트 | 담는 것 |
   |---|---|---|
   | 엔진 버전 | 6 | 규격이 바뀌면 올린다. 다르면 "상대와 버전이 다릅니다" |
   | 데이터 해시 | 16 | `meta.dataHash` 앞 16비트 — 명단이 다르면 경기가 성립하지 않는다 |
   | 구단 | 5 | 29개 |
   | 포메이션 | 4 | 12종 |
   | 선발 11명 | 66 | 11 × 6비트 — **자리 순서대로** 나열하므로 자리는 담지 않는다 |
   | 후보 9명 | 54 | 9 × 6비트 (빈 칸은 63) |
   | 역할 | 44 | 11 × 4비트 — 그 자리의 역할 묶음 안에서의 번호 |
   | 임무 | 22 | 11 × 2비트 — 그 역할이 고를 수 있는 임무 안에서의 번호 |
   | 슬라이더 | 24 | 8 × 3비트 (0~4) |
   | 역습 | 1 | |
   | 조건부 지시 | 48 | 6개 × 8비트 (단계 8) |
   | 체크섬 | 10 | 나머지 290비트의 FNV-1a 하위 10비트 |

   ── 왜 선수 id 가 아니라 명단 번호인가 ─────────────────────────
   선수 id 는 1~1024 라 10비트가 필요합니다. 한 구단 명단은 최대 51명이므로
   **그 구단 명단에서 몇 번째인가**로 담으면 6비트로 줄어듭니다. 구단이 코드 안에
   있으니 되돌릴 수 있고, 명단이 바뀌면 데이터 해시가 먼저 걸립니다.

   ⚠ 이 파일은 **화면과 일꾼이 함께** 씁니다. 커널을 부르지 않으므로 페이지에 올려도
     무겁지 않습니다(6천 줄짜리 커널을 끌고 오지 않습니다).
   ───────────────────────────────────────────────────────────── */

export const CODE_VER = 1;          // 규격 판 번호 (6비트)
export const CODE_PREFIX = "KM26D"; // 채팅에서 바로 알아보게 (설계서 4-2)
export const CODE_BITS = 300;
export const CODE_BYTES = 38;       // 300비트 → 38바이트 (뒤 4비트는 0)
export const CODE_CHARS = 51;       // Base64url 51자
const BENCH_EMPTY = 63;             // 빈 교체 칸 (명단이 51명이라 63과 겹치지 않는다)
export const COND_SLOTS = 6;        // 조건부 지시 칸 수 (단계 8)

/* ── 비트 쓰기·읽기 ─────────────────────────────────────────── */
class BitOut {
  constructor(n) { this.b = new Uint8Array(n); this.i = 0; }
  put(v, bits) {
    v = v >>> 0;
    for (let k = bits - 1; k >= 0; k--) {
      if ((v >>> k) & 1) this.b[this.i >> 3] |= 0x80 >> (this.i & 7);
      this.i++;
    }
  }
}
class BitIn {
  constructor(b) { this.b = b; this.i = 0; }
  get(bits) {
    let v = 0;
    for (let k = 0; k < bits; k++) {
      v = (v << 1) | ((this.b[this.i >> 3] >> (7 - (this.i & 7))) & 1);
      this.i++;
    }
    return v >>> 0;
  }
}

/* ── Base64url ───────────────────────────────────────────────
   표준 btoa 를 쓰지 않습니다 — 일꾼·Node·goja 어디서나 같아야 하고,
   패딩(=)과 +/ 문자가 링크에서 깨지기 때문입니다. */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64R = (() => { const m = {}; for (let i = 0; i < 64; i++) m[B64[i]] = i; return m; })();

function toB64(bytes) {
  let out = "", bit = 0;
  const total = bytes.length * 8;
  while (bit < total) {
    let v = 0;
    for (let k = 0; k < 6; k++) {
      const p = bit + k;
      v = (v << 1) | (p < total ? ((bytes[p >> 3] >> (7 - (p & 7))) & 1) : 0);
    }
    out += B64[v]; bit += 6;
  }
  return out;
}

function fromB64(str, nbytes) {
  const b = new Uint8Array(nbytes);
  let bit = 0;
  for (const ch of str) {
    const v = B64R[ch];
    if (v === undefined) throw new Error(`코드에 쓸 수 없는 글자가 있습니다 — "${ch}"`);
    for (let k = 5; k >= 0; k--) {
      if (bit >= nbytes * 8) break;
      if ((v >> k) & 1) b[bit >> 3] |= 0x80 >> (bit & 7);
      bit++;
    }
  }
  return b;
}

/** FNV-1a 32비트 — 시드 유도(rng.js)와 같은 방식. 여기서는 하위 10비트만 쓴다 */
function fnv(bytes) {
  let h = 0x811c9dc5;
  for (const v of bytes) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/* ── 규격이 쓰는 표 ─────────────────────────────────────────── */
/** 구단 번호 — k1 다음 k2 순서. data/teams.json 의 order 를 그대로 쓴다 */
export function teamList(ctx) { return ctx.order.k1.concat(ctx.order.k2); }
/** 포메이션 번호 — 이름 순으로 고정한다(표 순서가 바뀌어도 코드가 안 흔들리게) */
export function formationList(ctx) { return Object.keys(ctx.tables.formation).sort(); }
/** 그 포메이션의 자리 순서 — 선발을 이 순서로 나열한다 */
export function slotOrder(ctx, formation) {
  return ["GK", ...(ctx.tables.formation[formation] || []).map(s => s[1])];
}
/** 그 자리에서 맡을 수 있는 역할 목록 (lineup.html 의 rolesFor 와 같은 판정) */
export function rolesFor(ctx, slot) {
  const g = ctx.tables.roleGrp[slot];
  return ctx.tables.roles.filter(r => r.grp.includes(g));
}

/** 데이터 해시 문자열 앞 16비트 */
function hash16(dataHash) {
  const h = String(dataHash || "").slice(0, 4);
  const v = parseInt(h, 16);
  return Number.isFinite(v) ? (v & 0xffff) : 0;
}

/* ── 옛 판 데이터와의 호환 ─────────────────────────────────────
   코드에 박히는 데이터 해시는 data/*.json **전체**로 계산한다. 그래서 화면에 띄우는
   표시값 하나만 고쳐도 값이 달라진다 — 정작 코드가 기대고 있는 것(구단별 선수 배열의
   순서·id·능력치)이 그대로여도 마찬가지다. 실제로 선호 포지션 표시를 고쳤을 뿐인데
   이미 나눠 가진 코드가 전부 막히는 일이 있었다.

   아래는 "명단이 그대로였음을 확인한" 이전 판 해시다. 여기 적힌 판에서 발급된 코드는
   지금 데이터로 읽어도 **같은 선수가 선다**.

   ⚠ 새 항목을 적기 전에 반드시 확인할 것 — 구단별 선수 배열의 순서·id·ovr·attr 이
     한 명이라도 다르면 절대 넣으면 안 된다. 조용히 다른 선수가 서는 것이 최악이다
     (설계서 4-2). 해시는 16비트만 견주므로 목록이 길어질수록 엉뚱한 코드가 우연히
     통과할 확률도 같이 오른다 — 명단이 진짜로 달라진 판은 여기 두지 말고 버릴 것. */
export const DATA_COMPAT = [
  { hash: "847b18feb1dd419b",
    why: "선수들의 선호 포지션 표시 정정 (좌·우 풀백이 센터백으로 잡히던 문제)" },
  { hash: "21edfc69c1b97ca5",
    why: "골키퍼 선호 자리 고정 (골키퍼 10명이 CM·ST 같은 필드 자리로 잡히던 문제)" },
];

/**
 * 라인업 한 벌 → 대전 코드
 * @param {object} plan {id, xiMap, bench, tac, roles, cond?}
 * @param {object} ctx  {order, tables, players, dataHash}
 */
export function encodePlan(plan, ctx) {
  const teams = teamList(ctx);
  const ti = teams.indexOf(plan.id);
  if (ti < 0) throw new Error(`모르는 구단입니다 — ${plan.id}`);

  const forms = formationList(ctx);
  const form = (plan.tac && plan.tac.formation) || plan.formation || "4-3-3";
  const fi = forms.indexOf(form);
  if (fi < 0) throw new Error(`모르는 포메이션입니다 — ${form}`);

  const squad = ctx.players[plan.id] || [];
  const idxOf = id => squad.findIndex(p => p.id === id);
  const slots = slotOrder(ctx, form);
  const xiMap = plan.xiMap || plan.xi || {};

  const w = new BitOut(CODE_BYTES);
  w.put(CODE_VER, 6);
  w.put(hash16(ctx.dataHash), 16);
  w.put(ti, 5);
  w.put(fi, 4);

  // 선발 — 자리 순서대로. 자리가 비어 있으면 코드를 만들 수 없다
  for (const slot of slots) {
    const id = xiMap[slot];
    const i = id == null ? -1 : idxOf(id);
    if (i < 0) throw new Error(`${slot} 자리가 비어 있거나 명단에 없는 선수입니다`);
    if (i > 62) throw new Error("명단이 63명을 넘습니다 — 코드에 담을 수 없습니다");
    w.put(i, 6);
  }
  // 후보 아홉 칸 — 빈 칸은 63
  for (let k = 0; k < 9; k++) {
    const id = (plan.bench || [])[k];
    const i = id == null ? BENCH_EMPTY : idxOf(id);
    w.put(i < 0 ? BENCH_EMPTY : i, 6);
  }
  // 역할·임무 — 자리 순서대로, 그 자리에서 고를 수 있는 목록 안의 번호
  const eff = [];
  for (const slot of slots) {
    const opts = rolesFor(ctx, slot);
    const g = ctx.tables.roleGrp[slot];
    const cur = (plan.roles || {})[xiMap[slot]];
    let ri = cur ? opts.findIndex(r => r.k === cur.r) : -1;
    if (ri < 0) {
      const d = ctx.tables.roleDef[g] || [];
      ri = Math.max(0, opts.findIndex(r => r.k === d[0]));
    }
    const R = opts[ri] || opts[0];
    const duties = (R && R.duty) || ["S"];
    let di = cur ? duties.indexOf(cur.d) : -1;
    if (di < 0) {
      const d = ctx.tables.roleDef[g] || [];
      di = Math.max(0, duties.indexOf(d[1]));
    }
    eff.push([ri, di]);
  }
  for (const [ri] of eff) w.put(ri & 15, 4);
  for (const [, di] of eff) w.put(di & 3, 2);

  // 슬라이더 여덟 개 · 역습
  for (const k of ctx.tables.tacKeys) {
    const v = (plan.tac || {})[k];
    w.put(Math.max(0, Math.min(7, v == null ? 2 : v | 0)), 3);
  }
  w.put((plan.tac || {}).counter ? 1 : 0, 1);

  // 조건부 지시 (단계 8) — 여섯 칸 × 8비트
  const cond = plan.cond || [];
  for (let k = 0; k < COND_SLOTS; k++) w.put((cond[k] | 0) & 0xff, 8);

  // 체크섬 — 여기까지(290비트)를 담은 바이트열에서 뽑는다
  w.put(fnv(w.b) & 0x3ff, 10);
  return CODE_PREFIX + CODE_VER + "-" + toB64(w.b);
}

/**
 * 대전 코드 → 라인업 한 벌
 * 조용히 다른 라인업으로 해석되는 것이 최악이므로(설계서 4-2), 어긋나면 반드시 던진다.
 */
export function decodePlan(code, ctx) {
  let s = String(code || "").trim();
  // 링크째로 붙여 넣어도 알아본다
  const m = /(?:#|[?&])c=([^&#\s]+)/.exec(s);
  if (m) s = m[1];
  s = s.replace(/\s+/g, "");
  const px = new RegExp("^" + CODE_PREFIX + "(\\d+)-", "i").exec(s);
  if (!px) throw new Error(`${CODE_PREFIX} 로 시작하는 코드가 아닙니다`);
  const ver = +px[1];
  s = s.slice(px[0].length);
  if (s.length !== CODE_CHARS) {
    throw new Error(`코드가 잘렸거나 손상되었습니다 — ${CODE_CHARS}자여야 하는데 ${s.length}자입니다`);
  }

  const b = fromB64(s, CODE_BYTES);
  /* 체크섬은 290~299비트다 — 36번 바이트의 아래 6비트 + 37번 바이트의 위 4비트.
     그 자리를 0으로 되돌려 다시 계산한다 (만들 때도 0인 상태에서 뽑았다). */
  const chk = ((b[36] & 0x3f) << 4) | (b[37] >> 4);
  const b2 = b.slice(); b2[36] &= 0xc0; b2[37] = 0;
  if ((fnv(b2) & 0x3ff) !== (chk & 0x3ff)) {
    throw new Error("코드가 잘렸거나 손상되었습니다 (체크섬 불일치)");
  }

  const r = new BitIn(b);
  const vBits = r.get(6);
  if (vBits !== CODE_VER || ver !== CODE_VER) {
    throw new Error(`상대와 버전이 다릅니다 — 코드는 v${vBits}, 이 화면은 v${CODE_VER} 입니다`);
  }
  const dh = r.get(16);
  // 지금 판이 아니면 호환 목록을 본다 (명단이 그대로였음을 확인해 둔 옛 판)
  const oldData = dh === hash16(ctx.dataHash) ? null
    : DATA_COMPAT.find(c => hash16(c.hash) === dh) || null;
  if (dh !== hash16(ctx.dataHash) && !oldData) {
    throw new Error("선수 명단이 서로 다릅니다 — 같은 판의 데이터로 맞춰야 경기가 성립합니다");
  }
  const teams = teamList(ctx), forms = formationList(ctx);
  const id = teams[r.get(5)];
  if (!id) throw new Error("코드가 가리키는 구단이 없습니다");
  const formation = forms[r.get(4)];
  if (!formation) throw new Error("코드가 가리키는 포메이션이 없습니다");

  const squad = ctx.players[id] || [];
  const slots = slotOrder(ctx, formation);
  const xiMap = {};
  for (const slot of slots) {
    const i = r.get(6);
    const p = squad[i];
    if (!p) throw new Error(`${slot} 자리의 선수를 명단에서 찾지 못했습니다 (${i}번)`);
    xiMap[slot] = p.id;
  }
  const bench = [];
  for (let k = 0; k < 9; k++) {
    const i = r.get(6);
    bench.push(i === BENCH_EMPTY ? null : (squad[i] ? squad[i].id : null));
  }
  const ris = [], dis = [];
  for (let k = 0; k < slots.length; k++) ris.push(r.get(4));
  for (let k = 0; k < slots.length; k++) dis.push(r.get(2));
  const roles = {};
  slots.forEach((slot, k) => {
    const opts = rolesFor(ctx, slot);
    const R = opts[ris[k]] || opts[0];
    if (!R) return;
    const duties = R.duty || ["S"];
    roles[xiMap[slot]] = { r: R.k, d: duties[dis[k]] || duties[0] };
  });

  const tac = { formation };
  for (const k of ctx.tables.tacKeys) tac[k] = r.get(3);
  tac.counter = !!r.get(1);

  const cond = [];
  for (let k = 0; k < COND_SLOTS; k++) cond.push(r.get(8));

  /* oldData — 옛 판에서 발급된 코드를 읽었다는 표시. 화면이 그렇다고 알려 줄 수 있게
     남긴다(라인업은 그대로지만 어디서 온 코드인지는 보여야 한다). 지금 판이면 null. */
  return { id, formation, xiMap, xi: Object.values(xiMap), bench, tac, roles, cond,
           oldData: oldData && oldData.why };
}

/** 초대 링크 — 코드를 붙여 넣기 어려운 폰을 위해 링크를 기본으로 둔다 (설계서 4-2) */
export function inviteLink(code, base) {
  const b = base || (typeof location !== "undefined" ? location.origin + location.pathname : "");
  return `${b}#c=${encodeURIComponent(code)}`;
}
/** 결과 링크 — 코드 두 개면 누구나 같은 경기를 재현할 수 있다 */
export function resultLink(codeA, codeB, base) {
  const b = base || (typeof location !== "undefined" ? location.origin + location.pathname : "");
  return `${b}#m=${encodeURIComponent(codeA)}.${encodeURIComponent(codeB)}`;
}
/** 결과 링크에서 코드 두 개를 꺼낸다 */
export function parseResultLink(hash) {
  const m = /[#&]m=([^&#\s]+)\.([^&#\s]+)/.exec(String(hash || ""));
  return m ? { a: decodeURIComponent(m[1]), b: decodeURIComponent(m[2]) } : null;
}
