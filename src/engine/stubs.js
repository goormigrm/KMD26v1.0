/* ─────────────────────────────────────────────────────────────
   엔진 문맥 스텁

   KM26 원본 엔진은 전역 G(시즌 상태)와 몇몇 UI 함수를 참조합니다.
   듀얼에는 시즌이 없으므로, "경기 한 판에 필요한 최소 문맥"만
   같은 이름으로 만들어 줍니다. 커널(kernel.js)은 손대지 않습니다.

   커널이 실제로 참조하는 외부 이름은 다섯 개뿐입니다 (추출 시 실측):
     G(22회) · addNews(1) · adjustTrust(2) · famK(2) · refBias(2)
   ───────────────────────────────────────────────────────────── */

/* 시즌 누적값을 대체하는 고정치 — 설계서 제3부 3-3 */
export const DUEL_FIXED = {
  fam:    100,   // 팀 조직력: 양쪽 동일 (훈련 누적값 제거)
  morale:  75,   // 사기
  cond:   100,   // 컨디션
  season: 2026,
};

let ctxInstalled = false;

/**
 * 엔진이 참조하는 전역 문맥을 설치한다.
 * @param {Array} teams 이 경기에 나오는 팀 객체들
 * @param {number} refSeed 심판 배정 시드 (단계 2에서 경기 시드와 연결)
 */
export function installEngineContext(teams, refSeed = 0) {
  /* 커널은 G.teams 를 "리그 전체"로 보고 훑습니다(attrMeans·starRefLevel).
     같은 구단끼리 붙는 경기에서 id 로 덮어쓰면 한 팀만 남아 리그 평균이 반쪽이 되므로,
     키가 겹치면 뒤에 표를 붙여 둘 다 남깁니다. 커널은 이 키를 이름으로 쓰지 않고
     훑기만 합니다(G.teams[id] 로 특정 구단을 찾는 곳이 없습니다). */
  const map = {};
  for (const t of teams) {
    let k = t.id;
    while (map[k]) k += "#";
    map[k] = t;
  }

  globalThis.G = {
    season: DUEL_FIXED.season,
    day: refSeed | 0,          // refCrewOf 가 심판을 뽑는 데 쓰는 값
    teams: map,
    k1: Object.keys(map),
    k2: [],
    r1: 0, r2: 0,
    meTune: null,              // 엔진 에디터 보정 없음 → meTune() 이 1을 반환
    refNames: null,            // 기본 심판 이름표 사용
  };

  // 시즌 누적값 — 듀얼에서는 항상 중립
  globalThis.famK    = () => 0;   // 조직력 보정 없음 (양쪽 동일하므로)
  globalThis.refBias = () => 0;   // 감독-심판 관계 없음

  // 시즌 부수효과 — 듀얼에는 뉴스도 신뢰도도 없다
  globalThis.addNews     = () => {};
  globalThis.adjustTrust = () => {};

  ctxInstalled = true;
}

export function isContextInstalled() { return ctxInstalled; }

/** 팀 객체에 듀얼 고정치를 입힌다 (조직력·사기·컨디션) */
export function normalizeTeam(t) {
  t.fam = DUEL_FIXED.fam;
  t.morale = DUEL_FIXED.morale;
  t.isUser = false;
  for (const p of t.players) {
    p.cond = DUEL_FIXED.cond;
    p.morale = DUEL_FIXED.morale;
    p.inj = 0;
    p.ban = 0;
    p.sulk = 0;
    p.loan = null;
  }
  return t;
}
