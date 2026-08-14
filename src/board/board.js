/* ─────────────────────────────────────────────────────────────
   전술 게시판 — 닉네임과 대전 코드를 남기고, 남이 올린 것과 바로 붙는다

   왜 만드나
   ---------
   대전 코드를 주고받는 것 자체는 잘 돌아갑니다. 그런데 **상대를 구하는 일**이 번거롭습니다
   — 게시판에 글을 따로 쓰고, 댓글을 기다리고, 링크를 눌러 페이지를 옮겨야 합니다.
   "귀찮아서 아무도 안 한다"는 게 제보의 핵심이었습니다.
   그래서 **페이지를 옮기지 않고** 그 자리에서 올리고, 그 자리에서 골라 붙게 합니다.

   ⚠ 실시간이 아닙니다. 상대가 접속해 있을 필요가 없습니다 — 남겨 둔 라인업과 붙습니다.
     듀얼은 원래 그렇게 되는 게임입니다(코드 두 개만 있으면 경기가 성립).

   ── 열쇠에 대하여 ─────────────────────────────────────────
   아래 `KEY` 는 Supabase 의 **anon(공개) 키**입니다. 브라우저에 내려가는 것이 정상이고,
   그것만으로 할 수 있는 일은 표의 **권한 정책(RLS)이 허락한 것뿐**입니다.
   설정 문서(`docs/전술게시판-설정.md`)대로 하면 **등록과 조회만** 열리고
   고치기·지우기는 아무도 못 합니다.
   ⛔ `service_role` 키는 절대 여기에 넣지 마세요. 그건 모든 권한을 가진 열쇠입니다.
   ───────────────────────────────────────────────────────────── */

/* 여기 두 줄만 채우면 게시판이 켜집니다. 비어 있으면 화면에서 게시판이 통째로 숨습니다
   — 설정 전에도 게임은 그대로 돌아갑니다. */
export const BOARD = {
  URL: "https://duiarycgzctauyjhgoub.supabase.co",
  KEY: "sb_publishable_DJzf5YcGm-QDYDxVcDEDeA_XSGupTL4",   // publishable (공개용)
};

/** 게시판을 쓸 수 있는 상태인가 */
export const boardOn = () => !!(BOARD.URL && BOARD.KEY);

export const NICK_MAX = 12;
export const NOTE_MAX = 40;
const TABLE = "plans";

/* 같은 사람이 연달아 도배하지 못하게 하는 최소한의 장치.
   ⚠ 브라우저 쪽 장치라 마음먹으면 우회됩니다 — 진짜 방어는 표의 제약 조건과
     `code` 유일 제약입니다(같은 라인업을 두 번 못 올린다). 설정 문서 참고. */
const COOLDOWN_MS = 60 * 1000;
const LAST_KEY = "kmd26.board.last";

function headers(extra) {
  const h = { apikey: BOARD.KEY, "Content-Type": "application/json" };
  /* ⚠ 키가 두 종류다.
       옛 `anon` 키   — JWT(`eyJ…`) 라 Authorization: Bearer 로도 보낼 수 있다
       새 `publishable` 키(`sb_publishable_…`) — JWT 가 **아니다.** Bearer 로 보내면
         PostgREST 가 토큰을 해독하려다 거부한다. apikey 헤더만 보내야 한다.
     둘 다 받도록 생김새를 보고 정한다. */
  if (/^eyJ/.test(BOARD.KEY)) h.Authorization = "Bearer " + BOARD.KEY;
  return Object.assign(h, extra || {});
}

/** 남이 올린 라인업 목록 — 새것부터 */
export async function listPlans(limit = 40) {
  if (!boardOn()) return [];
  const q = "select=id,nick,note,team,code,created_at&order=created_at.desc&limit=" + (limit | 0);
  const r = await fetch(`${BOARD.URL}/rest/v1/${TABLE}?${q}`, { headers: headers() });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

/**
 * 내 라인업을 올린다.
 * @param {object} row {nick, note, team, code, dataHash}
 * ⚠ code 가 진짜 대전 코드인지는 **부르는 쪽에서 먼저 해독해** 확인하세요.
 *   여기서 검사하면 코덱을 게시판 모듈이 다시 들고 있어야 합니다.
 */
export async function postPlan(row) {
  if (!boardOn()) throw new Error("게시판이 아직 설정되지 않았습니다.");
  const left = cooldownLeft();
  if (left > 0) throw new Error(`잠시 뒤에 올려 주세요 — ${Math.ceil(left / 1000)}초 남았습니다.`);

  const nick = String(row.nick || "").trim().slice(0, NICK_MAX);
  const note = String(row.note || "").trim().slice(0, NOTE_MAX);
  if (!nick) throw new Error("닉네임을 적어 주세요.");

  const r = await fetch(`${BOARD.URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      nick, note: note || null,
      team: String(row.team || "").slice(0, 16),
      code: String(row.code || ""),
      data_hash: String(row.dataHash || "").slice(0, 24),
    }),
  });
  if (!r.ok) {
    const msg = await readErr(r);
    // 코드에 유일 제약이 걸려 있다 — 같은 라인업을 두 번 올릴 수는 없다
    if (/duplicate|unique/i.test(msg)) throw new Error("이미 올라와 있는 라인업입니다.");
    throw new Error(msg);
  }
  try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (e) { /* 사생활 모드 */ }
}

function cooldownLeft() {
  try {
    const t = +localStorage.getItem(LAST_KEY) || 0;
    return Math.max(0, t + COOLDOWN_MS - Date.now());
  } catch (e) { return 0; }
}

async function readErr(r) {
  try {
    const j = await r.json();
    return j.message || j.hint || j.error_description || `서버 오류 (${r.status})`;
  } catch (e) { return `서버 오류 (${r.status})`; }
}

/* ── 찾기 ──────────────────────────────────────────────────────
   닉네임 · 구단 · 한 줄 소개를 한꺼번에 봅니다.

   ⚠ **서버에 다시 묻지 않습니다.** 이미 받아 둔 목록을 그 자리에서 거릅니다 —
     한 글자 칠 때마다 요청을 보내면 무료 티어를 그것만으로 다 씁니다.
     그래서 한 글자("안")만 쳐도 바로 좁혀지고, 지웠다 다시 쳐도 기다림이 없습니다.

   초성만 쳐도 찾습니다("ㅇㅇ" → 안양). 폰에서 구단 이름을 다 치는 사람은 없습니다. */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 한글을 첫 자음만 남긴 줄로 — 한글이 아닌 글자는 그대로 둔다 */
export function chosung(s) {
  let out = "";
  for (const ch of String(s || "")) {
    const c = ch.charCodeAt(0);
    out += (c >= 0xac00 && c <= 0xd7a3) ? CHO[((c - 0xac00) / 588) | 0] : ch;
  }
  return out;
}

/** 이 줄이 찾는 말에 걸리는가 — 빈 말이면 전부 걸린다(거르지 않는다)
    ⚠ 칸을 **하나로 이어 붙여** 찾으면 안 된다. 닉네임 "철수" + 구단 "안양" 을 이으면
      "철수안양" 이 되어 있지도 않은 "수안" 이 걸린다. 칸마다 따로 본다. */
export function matchQuery(row, q) {
  const s = String(q || "").toLowerCase().replace(/\s+/g, "");
  if (!s) return true;
  // 초성만 친 경우에만 초성으로 견준다 — 안 그러면 "가"가 "각"에도 걸려 엉뚱하게 넓어진다
  const cho = /^[ㄱ-ㅎ]+$/.test(s);
  return [row && row.nick, row && row.team, row && row.note].some(v => {
    const t = String(v || "").toLowerCase().replace(/\s+/g, "");
    return t.includes(s) || (cho && chosung(t).includes(s));
  });
}

/** "3분 전" 처럼 — 목록에 붙일 상대 시각 */
export function ago(iso) {
  const t = Date.parse(iso);
  if (!isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return Math.floor(s / 60) + "분 전";
  if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  return Math.floor(s / 86400) + "일 전";
}
