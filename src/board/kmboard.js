/* ─────────────────────────────────────────────────────────────
   KM26 갈래 게시판·기록실 — `plans_km` · `matches_km`

   기본 갈래(`src/board/board.js`)와 **표가 다릅니다.** 왜 갈랐는지는
   `docs/KM26게시판-설정.md` 에 있습니다 — 한 줄로 줄이면, 기존 표가
   `code ~ '^KM26D1-…'` 로 51자 코드를 **DB 수준에서 강제**하고 있어서
   명단 팩(약 15KB)이 들어갈 수 없기 때문입니다.

   ⚠ Supabase 프로젝트와 열쇠는 **기본 갈래 것을 그대로** 씁니다. 새로 만들지 않습니다.
     그래서 `BOARD` 를 가져다 쓰고, 여기서는 표 이름과 칸 모양만 다릅니다.

   ⚠ 표가 없으면 화면에서 KM26 게시판만 조용히 꺼집니다 — 게임의 나머지는 그대로입니다.
   ───────────────────────────────────────────────────────────── */

import { BOARD, boardOn, NICK_MAX, NOTE_MAX, myNick, rememberNick } from "./board.js?v=0631260f6e";

export { NICK_MAX, NOTE_MAX, myNick, rememberNick };

const PLANS = "plans_km";
const MATCHES = "matches_km";

/** KM26 게시판을 쓸 수 있는 상태인가 — 열쇠는 기본 갈래와 같은 것을 본다 */
export const kmBoardOn = () => boardOn();

/* 도배 방지 — 기본 갈래와 **따로** 센다. 한쪽을 올렸다고 다른 쪽이 막히면 헷갈린다 */
const COOLDOWN_MS = 60 * 1000;
const LAST_KEY = "kmd26.kmboard.last";

function cooldownLeft() {
  try {
    const t = +(localStorage.getItem(LAST_KEY) || 0);
    return Math.max(0, COOLDOWN_MS - (Date.now() - t));
  } catch (e) { return 0; }
}
function markPosted() {
  try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (e) { /* 사생활 모드 */ }
}

function headers(extra) {
  const h = { apikey: BOARD.KEY, "Content-Type": "application/json" };
  /* 열쇠가 두 종류다 — 옛 anon 키(JWT)만 Bearer 로 보낸다. 새 publishable 키를
     Bearer 로 보내면 PostgREST 가 토큰을 해독하려다 거부한다. */
  if (/^eyJ/.test(BOARD.KEY)) h.Authorization = "Bearer " + BOARD.KEY;
  return Object.assign(h, extra || {});
}

async function readErr(r) {
  let body = "";
  try { body = await r.text(); } catch (e) { /* 본문이 없을 수도 있다 */ }
  /* 표가 없을 때가 가장 흔하다 — 설정 문서를 가리켜 준다 */
  if (r.status === 404 || /relation .* does not exist|Could not find the table/i.test(body)) {
    return "KM26 게시판 표가 아직 없습니다 (docs/KM26게시판-설정.md 의 SQL 을 한 번 돌려 주세요).";
  }
  if (r.status === 401 || r.status === 403) return "게시판 권한이 없습니다 — 열쇠나 정책을 확인해 주세요.";
  if (r.status === 413) return "명단이 너무 큽니다.";
  return `게시판이 응답하지 않습니다 (${r.status}).`;
}

/* ── 전술 게시판 ─────────────────────────────────────────────── */

/** 올라온 KM26 라인업 목록 — 새것부터. `pack` 이 커서 필요한 칸만 받는다 */
export async function listKmPlans(limit = 40) {
  if (!kmBoardOn()) return [];
  const q = `select=id,created_at,nick,note,team,season,sig&order=created_at.desc&limit=${limit | 0}`;
  const r = await fetch(`${BOARD.URL}/rest/v1/${PLANS}?${q}`, { headers: headers() });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

/** 글 하나의 명단 팩을 받아 온다 — 붙기로 정했을 때만 부른다(15KB 짜리다) */
export async function getKmPack(id) {
  if (!kmBoardOn()) throw new Error("KM26 게시판이 아직 설정되지 않았습니다.");
  const q = `select=id,nick,team,season,pack&id=eq.${id | 0}`;
  const r = await fetch(`${BOARD.URL}/rest/v1/${PLANS}?${q}`, { headers: headers() });
  if (!r.ok) throw new Error(await readErr(r));
  const rows = await r.json();
  if (!rows.length) throw new Error("그 글을 찾지 못했습니다 (감춰졌을 수 있습니다).");
  const row = rows[0];
  try { row.pack = JSON.parse(row.pack); } catch (e) { throw new Error("올라온 명단을 읽지 못했습니다."); }
  return row;
}

/**
 * 내 KM26 라인업을 올린다.
 * @param {object} row {nick, note, team, season, sig, pack}
 * ⚠ `sig` 는 **라인업 + 명단**의 지문이어야 한다. 라인업만으로는 같은 글인지 가릴 수 없다 —
 *   같은 포메이션·같은 자리라도 선수 능력치가 사람마다 다르기 때문이다.
 * @returns {{ok:boolean, dup?:boolean, why?:string}}
 */
export async function kmPostPlan(row) {
  if (!kmBoardOn()) return { ok: false, why: "KM26 게시판이 아직 설정되지 않았습니다." };
  const left = cooldownLeft();
  if (left > 0) return { ok: false, why: `잠시 뒤에 올려 주세요 — ${Math.ceil(left / 1000)}초 남았습니다.` };

  const nick = String(row.nick || "").trim().slice(0, NICK_MAX);
  if (!nick) return { ok: false, why: "닉네임을 적어 주세요." };
  const packText = JSON.stringify(row.pack);
  if (packText.length > 200000) return { ok: false, why: "명단이 너무 큽니다." };

  let r;
  try {
    r = await fetch(`${BOARD.URL}/rest/v1/${PLANS}`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        nick,
        note: String(row.note || "").trim().slice(0, NOTE_MAX) || null,
        team: String(row.team || "").slice(0, 16),
        season: Number.isFinite(+row.season) ? +row.season : null,
        sig: String(row.sig || "").slice(0, 64),
        pack: packText,
      }),
    });
  } catch (e) {
    return { ok: false, why: "게시판에 닿지 못했습니다 — 인터넷 연결을 확인해 주세요." };
  }
  if (!r.ok) {
    const msg = await readErr(r);
    /* sig 에 유일 제약이 걸려 있다 — 같은 라인업·같은 명단은 두 번 올릴 수 없다 */
    if (r.status === 409 || /duplicate key|unique/i.test(msg)) return { ok: true, dup: true };
    return { ok: false, why: msg };
  }
  markPosted();
  return { ok: true };
}

/* ── 듀얼 기록실 ─────────────────────────────────────────────── */

/** KM26 명단으로 붙은 경기 목록 — 새것부터 */
export async function listKmMatches(limit = 60) {
  if (!kmBoardOn()) return [];
  const q = `select=id,created_at,fp,h_plan,a_plan,h_nick,h_team,a_nick,a_team,hg,ag`
          + `&order=created_at.desc&limit=${limit | 0}`;
  const r = await fetch(`${BOARD.URL}/rest/v1/${MATCHES}?${q}`, { headers: headers() });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

/**
 * 붙은 경기를 남긴다.
 * ⚠ 결과 링크가 없다 — 대신 **글 두 개**를 가리킨다. 그 둘이면 경기를 다시 만들 수 있다.
 * @param {object} row {fp, hPlan, aPlan, hNick, hTeam, aNick, aTeam, hg, ag}
 */
export async function kmPostMatch(row) {
  if (!kmBoardOn()) return { ok: false, why: "off" };
  if (!row.hPlan || !row.aPlan) return { ok: false, why: "게시판에 올라온 글끼리 붙은 경기만 남습니다." };
  let r;
  try {
    r = await fetch(`${BOARD.URL}/rest/v1/${MATCHES}`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        fp: String(row.fp || "").slice(0, 24),
        h_plan: row.hPlan | 0, a_plan: row.aPlan | 0,
        h_nick: row.hNick ? String(row.hNick).slice(0, NICK_MAX) : null,
        a_nick: row.aNick ? String(row.aNick).slice(0, NICK_MAX) : null,
        h_team: String(row.hTeam || "").slice(0, 16),
        a_team: String(row.aTeam || "").slice(0, 16),
        hg: Math.max(0, Math.min(30, row.hg | 0)),
        ag: Math.max(0, Math.min(30, row.ag | 0)),
      }),
    });
  } catch (e) {
    return { ok: false, why: "기록실에 닿지 못했습니다." };
  }
  if (!r.ok) {
    const msg = await readErr(r);
    if (r.status === 409 || /duplicate key|unique/i.test(msg)) return { ok: true, dup: true };
    return { ok: false, why: msg };
  }
  return { ok: true };
}

/* ── 전적 ────────────────────────────────────────────────────
   기본 갈래와 같은 판단이다 — 집계 칸을 따로 두지 않고 경기 목록으로 **그 자리에서** 센다.
   따로 두면 경기를 감췄을 때 숫자가 어긋나고, 그걸 맞추는 코드가 또 필요하다. */

/** 글 번호별 승·무·패 (홈·원정 따로) */
export function kmRecordsByPlan(matches) {
  const out = {};
  const get = id => (out[id] = out[id] || { h: { w: 0, d: 0, l: 0 }, a: { w: 0, d: 0, l: 0 } });
  for (const m of matches || []) {
    const H = get(m.h_plan).h, A = get(m.a_plan).a;
    if (m.hg > m.ag) { H.w++; A.l++; }
    else if (m.hg < m.ag) { H.l++; A.w++; }
    else { H.d++; A.d++; }
  }
  return out;
}

/** 경기당 승점 — 한 판 이긴 라인업이 9승 1패보다 위로 오지 않게 평균 쪽으로 당긴다 */
const PRIOR_N = 1, PRIOR_PTS = 1.5;
export function kmPlanScore(rec) {
  if (!rec) return PRIOR_PTS;
  const w = rec.h.w + rec.a.w, d = rec.h.d + rec.a.d, l = rec.h.l + rec.a.l;
  const n = w + d + l;
  return (w * 3 + d + PRIOR_N * PRIOR_PTS) / (n + PRIOR_N);
}
