/* ─────────────────────────────────────────────────────────────
   듀얼 고유 규칙 (설계 결정 D-3)

   커널은 손대지 않습니다. 여기서는 커널 메서드를 "감싸서"(wrap) 규칙을 더합니다.
   원본 동작을 그대로 부른 뒤 결과에만 손대므로, 원본이 갱신돼도 이 파일은 대개 그대로 삽니다.

     · 메서드 경계에서 표현되는 것  → 이 파일 (래퍼)
     · 함수 한복판이라 안 되는 것   → tools/patch_kernel.py (패치)

   ── 왜 필요한가 ────────────────────────────────────────────
   태클 슬라이더의 상한은 4로 유지하기로 했습니다(D-3). 대전 게임에서 선택지를
   깎는 건 마지막 수단이니까요. 대신 "거칠게 가면 대가를 치른다"를 세 갈래로 만듭니다.

     1. 누적 파울 엄격화 — 파울이 쌓일수록 주심이 카드를 아끼지 않는다
     2. 퇴장 페널티      — 열 명으로 뛰면 남은 선수가 더 지친다
     3. 심판 성향 비공개 — 킥오프 전까지 감춘다 ⚠ UI 규칙이라 단계 6·7에서 처리

   ⚠ 이 파일은 난수를 한 번도 뽑지 않습니다. 결정론(단계 2)에 영향이 없어야 하기 때문입니다.
   ───────────────────────────────────────────────────────────── */

import { MatchSim, onPitch } from "./kernel.js";

/* ── 1. 누적 파울 엄격화 ──────────────────────────────────────
   실제 주심도 그렇습니다. 전반에 파울 열 개를 본 주심은 같은 태클에 더 쉽게 카드를 꺼냅니다.
   태클을 4로 올려도 되지만, 경기가 길어질수록 그 대가가 커집니다.
   임계값은 높은 쪽부터 봅니다 (16개를 넘겼으면 8·12 조건도 참이므로). */
export const FOUL_ESCALATION = [
  [16, 1.60],
  [12, 1.35],
  [ 8, 1.15],
];

/** 파울 n 개를 저지른 팀에게 붙는 카드 배수 */
export function foulCardK(n) {
  for (const [threshold, k] of FOUL_ESCALATION) if (n >= threshold) return k;
  return 1;
}

/* ── 2. 퇴장 페널티 ───────────────────────────────────────────
   열 명이 열한 명을 상대하면 한 사람이 더 뛰어야 합니다. 원본 엔진은 이동 거리로
   체력을 깎지만(drainStamina), 그것만으로는 수적 열세의 무게가 잘 안 나타납니다.
   퇴장 한 명당 소모를 12% 늘립니다 — 두 명이면 24%. */
export const RED_STAMINA_PENALTY = 0.12;

/** 퇴장 수에 따른 체력 소모 배수 */
export function redStaminaK(reds) {
  return 1 + RED_STAMINA_PENALTY * Math.max(0, reds | 0);
}

/* ── 설치 ─────────────────────────────────────────────────── */

let installed = false;

/**
 * 커널 프로토타입에 듀얼 규칙을 입힌다.
 * 여러 번 불러도 한 번만 적용된다 (두 번 감싸면 배수가 제곱된다).
 */
export function installDuelRules() {
  if (installed) return;
  installed = true;

  /* 1. 누적 파울 → 카드 계수 */
  const _refCardK = MatchSim.prototype.refCardK;
  MatchSim.prototype.refCardK = function (side) {
    const fouls = (this.stats && this.stats[side] && this.stats[side].foul) || 0;
    return _refCardK.call(this, side) * foulCardK(fouls);
  };

  /* 2. 퇴장 → 체력 소모 가중
     원본을 그대로 돌린 뒤, 이번 호출에서 깎인 양만 다시 비율로 키운다.
     (원본은 분 경계를 넘을 때만 깎으므로, 안 깎인 틱에서는 차이가 0이라 아무 일도 없다) */
  const _drainStamina = MatchSim.prototype.drainStamina;
  MatchSim.prototype.drainStamina = function () {
    const sides = [["h", this.M.h], ["a", this.M.a]];

    const before = new Map();
    for (const [, sd] of sides) for (const x of onPitch(sd)) before.set(x, x.fit);

    _drainStamina.call(this);

    for (const [key, sd] of sides) {
      const reds = (this.stats && this.stats[key] && this.stats[key].red) || 0;
      if (!reds) continue;
      const k = redStaminaK(reds);
      for (const x of onPitch(sd)) {
        const b0 = before.get(x);
        if (b0 === undefined) continue;            // 이번 틱에 새로 들어온 선수
        x.fit = Math.max(25, b0 - (b0 - x.fit) * k);
      }
    }
  };
}

export function isInstalled() { return installed; }
