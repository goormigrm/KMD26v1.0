/* ─────────────────────────────────────────────────────────────
   구단 전력 별점 — 세 화면이 **같은 값**을 보여야 한다

   왜 따로 떼어 놓나
   -----------------
   선수 눈금(별 하나로 1,024명을 줄 세운 것)을 열한 명 평균에 그대로 쓰면 안 된다.
   평균을 내면 값이 위로 몰려서 K리그1 이 전부 4.5~5★ 로 붙어 버린다 — 우승 후보와
   중위권이 같은 별로 보인다. 그래서 구단은 구단끼리 비교하는 별도 눈금을 쓴다.
   KM26 과 같은 구간이다: 주전 평균 능력치 60 이 0.5★, 77.5 가 5★.
   (실제 29개 구단은 63.5~75.3 에 깔려 1.5★~4.5★ 로 퍼진다.)

   ⚠ 이 함수는 **선수단 · 라인업 · 경기** 세 화면이 함께 쓴다. 같은 구단인데 화면마다
     다른 별이 뜨면 안 되므로, 각자 베껴 두지 말고 여기 하나만 고칠 것.
     (예전에는 선수단과 라인업에 같은 코드가 두 벌 있었다.)

   ⚠ 이것은 **엔진 모듈이 아니다.** `realmatch`·`simcheck` 의 modules 목록에 넣지 마세요 —
     경기 계산과 아무 상관이 없고 화면에만 쓴다(`src/board/board.js` 와 같은 부류).
   ───────────────────────────────────────────────────────────── */

export const TEAM_STAR_LO = 60, TEAM_STAR_HI = 77.5;

/**
 * 구단 전력 별점 (0.5 ~ 5, 0.5 단위)
 * @param {object} players data/players.json — 구단 id 로 찾는 명단 표
 * @param {string} id 구단 id
 */
export function teamStar(players, id) {
  const list = (players && players[id]) || [];
  const best11 = list.slice().sort((a, b) => (b.ovr || 0) - (a.ovr || 0)).slice(0, 11);
  if (!best11.length) return 0;
  const o = best11.reduce((s, p) => s + (p.ovr || 0), 0) / best11.length;
  const v = 0.5 + (o - TEAM_STAR_LO) / (TEAM_STAR_HI - TEAM_STAR_LO) * 4.5;
  return Math.max(0.5, Math.min(5, Math.round(v * 2) / 2));
}

/**
 * 별 다섯 개 — 회색 별 위에 금색 별을 비율만큼 덮어 반 개를 표현한다.
 * 화면마다 `.stars` CSS 를 두고 있으므로 여기서는 마크업만 낸다.
 */
export function starsHTML(v, cls) {
  const n = +v || 0;
  return `<span class="stars${cls ? " " + cls : ""}" style="--pct:${Math.round(n / 5 * 100)}%"
    title="${n}★">★★★★★</span>`;
}
