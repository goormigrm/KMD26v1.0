/* ─────────────────────────────────────────────────────────────
   시드 난수 — 듀얼의 심장

   두 사람이 각자의 브라우저에서 "완전히 같은 경기"를 봐야 하므로,
   엔진 안의 모든 무작위는 하나의 시드에서 나와야 합니다.
   커널의 Math.random() 127곳은 추출 단계에서 전부 RNG() 로 치환됩니다.

   ⚠ 이 파일의 알고리즘을 바꾸면 기존에 발급된 모든 대전 코드의
     재생 결과가 달라집니다. 바꿔야 한다면 엔진 버전을 올리세요.
   ───────────────────────────────────────────────────────────── */

let _s = 1;

/** mulberry32 — 32비트 상태, 빠르고 분포가 고르다 */
export function RNG() {
  _s = (_s + 0x6D2B79F5) >>> 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 시드를 심는다. 경기를 시작하기 직전에 반드시 호출할 것. */
export function seedRNG(seed) {
  _s = (seed >>> 0) || 1;
}

/** 현재 상태 — 재현성 디버깅용 (같은 지점에서 같은 값이어야 한다) */
export function rngState() { return _s; }

/**
 * 대전 코드 두 개에서 시드를 유도한다 (설계 결정 D-1).
 * 어느 쪽도 자기에게 유리한 시드를 고를 수 없다.
 * FNV-1a 32비트.
 */
export function deriveSeed(codeA, codeB) {
  const s = String(codeA) + "|" + String(codeB);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Math.random() 직접 호출을 막는다.
 * 치환이 빠진 곳이 있으면 조용히 결과가 갈라지는 대신 즉시 예외가 난다.
 * 테스트에서만 켜세요 — 서드파티 코드가 있으면 같이 터집니다.
 */
export function lockMathRandom() {
  if (Math.random.__locked) return;
  const f = () => {
    throw new Error(
      "Math.random() 이 직접 호출됐습니다. 시드 밖의 난수라 재생이 갈라집니다. " +
      "커널을 다시 추출하거나(tools/extract_engine.py) 해당 호출을 RNG() 로 바꾸세요."
    );
  };
  f.__locked = true;
  Math.random = f;
}
