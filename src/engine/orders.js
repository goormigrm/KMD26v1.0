/* ─────────────────────────────────────────────────────────────
   조건부 지시 (단계 8)

   듀얼에는 **경기 중 개입이 없습니다.** 코드를 주고받은 뒤에는 아무도 버튼을 누르지
   못하므로, "이렇게 되면 이렇게 하라"를 미리 적어 두는 것이 전략의 핵심이 됩니다.

   한 칸 = 조건 하나 + 행동 하나. 여섯 칸을 코드의 48비트에 담습니다
   (칸마다 8비트 — 조건 4비트 · 행동 4비트). 코드 규격은 단계 5에서 이미 이 자리를
   비워 뒀으므로, 이 단계가 와도 코드 길이는 그대로입니다.

   ── 지켜야 할 것 ───────────────────────────────────────────
   ⚠ **난수를 뽑지 않습니다.** 판정에 난수가 끼면 같은 코드가 다른 경기를 냅니다(D-1).
   ⚠ 한 칸은 **한 번만** 발동합니다. 분마다 다시 걸리면 같은 지시가 90번 나갑니다.
   ⚠ 발동은 분 경계에서만 봅니다 — 커널 aiTacticCheck 를 붙인 자리와 같습니다.
   ───────────────────────────────────────────────────────────── */

import { MatchSim } from "./kernel.js?v=0631260f6e";

/* 조건 — 4비트(0~15). 0 은 "빈 칸"이라 쓰지 않습니다. */
export const CONDS = [
  { k: 0,  n: "(비어 있음)", test: null },
  { k: 1,  n: "15분이 지나면",        test: (c) => c.min >= 15 },
  { k: 2,  n: "30분이 지나면",        test: (c) => c.min >= 30 },
  { k: 3,  n: "전반이 끝나면",        test: (c) => c.min >= 45 },
  { k: 4,  n: "60분이 지나면",        test: (c) => c.min >= 60 },
  { k: 5,  n: "75분이 지나면",        test: (c) => c.min >= 75 },
  { k: 6,  n: "지고 있으면",          test: (c) => c.gd < 0 },
  { k: 7,  n: "이기고 있으면",        test: (c) => c.gd > 0 },
  { k: 8,  n: "비기고 있으면",        test: (c) => c.gd === 0 },
  { k: 9,  n: "60분에 지고 있으면",   test: (c) => c.min >= 60 && c.gd < 0 },
  { k: 10, n: "60분에 이기고 있으면", test: (c) => c.min >= 60 && c.gd > 0 },
  { k: 11, n: "75분에 지고 있으면",   test: (c) => c.min >= 75 && c.gd < 0 },
  { k: 12, n: "75분에 이기고 있으면", test: (c) => c.min >= 75 && c.gd > 0 },
  { k: 13, n: "두 골 이상 앞서면",    test: (c) => c.gd >= 2 },
  { k: 14, n: "두 골 이상 뒤지면",    test: (c) => c.gd <= -2 },
  { k: 15, n: "퇴장이 나오면",        test: (c) => c.myRed > 0 },
];

/* 행동 — 4비트(0~15). 슬라이더를 건드리는 것만 담습니다.
   선수 교체는 커널이 알아서 하므로(체력·부상) 여기서는 다루지 않습니다. */
export const ACTS = [
  { k: 0,  n: "(아무것도)",        apply: null },
  { k: 1,  n: "총공세",            say: "총공세로 나섭니다",
    /* 역습은 0~4 단계다(예전에는 켬/끔). 옛 false = 0, 옛 true = 3 — 같은 세기다 */
    apply: (T) => ({ mentality: 4, line: 4, press: 4, tempo: 4, counter: 0 }) },
  { k: 2,  n: "공격적으로",        say: "공격적으로 전환합니다",
    apply: (T) => ({ mentality: Math.min(4, num(T.mentality) + 1), line: Math.min(4, num(T.line) + 1) }) },
  { k: 3,  n: "잠근다",            say: "완전히 내려앉습니다",
    apply: (T) => ({ mentality: 0, line: 0, press: 1, counter: 3 }) },
  { k: 4,  n: "실리로",            say: "무게중심을 뒤로 옮깁니다",
    apply: (T) => ({ mentality: Math.max(0, num(T.mentality) - 1), line: Math.max(0, num(T.line) - 1), counter: 3 }) },
  { k: 5,  n: "압박을 올린다",      say: "압박을 끌어올립니다",
    apply: (T) => ({ press: Math.min(4, num(T.press) + 2) }) },
  { k: 6,  n: "압박을 내린다",      say: "압박을 내려 체력을 아낍니다",
    apply: (T) => ({ press: Math.max(0, num(T.press) - 2) }) },
  { k: 7,  n: "템포를 올린다",      say: "템포를 올립니다",
    apply: (T) => ({ tempo: Math.min(4, num(T.tempo) + 2) }) },
  { k: 8,  n: "템포를 내린다",      say: "속도를 줄여 경기를 식힙니다",
    apply: (T) => ({ tempo: Math.max(0, num(T.tempo) - 2) }) },
  { k: 9,  n: "길게 찬다",          say: "패스를 길게 가져갑니다",
    apply: (T) => ({ pass: 4 }) },
  { k: 10, n: "짧게 돌린다",        say: "짧은 패스로 돌립니다",
    apply: (T) => ({ pass: 0 }) },
  { k: 11, n: "측면을 벌린다",      say: "측면을 넓게 벌립니다",
    apply: (T) => ({ width: 4 }) },
  { k: 12, n: "중앙에 모인다",      say: "중앙으로 좁힙니다",
    apply: (T) => ({ width: 0 }) },
  { k: 13, n: "거칠게 간다",        say: "수비를 거칠게 갑니다",
    apply: (T) => ({ tackle: Math.min(4, num(T.tackle) + 2) }) },
  { k: 14, n: "카드를 아낀다",      say: "신중하게 수비합니다",
    apply: (T) => ({ tackle: Math.max(0, num(T.tackle) - 2) }) },
  { k: 15, n: "역습을 켠다",        say: "역습을 노립니다",
    /* 옛 true 와 같은 세기(3단계). 더 세게 걸려면 라인업에서 미리 4로 둘 것 */
    apply: (T) => ({ counter: 3 }) },
];

const num = v => (typeof v === "number" ? v : 2);
const condOf = k => CONDS.find(c => c.k === (k & 15)) || CONDS[0];
const actOf = k => ACTS.find(a => a.k === (k & 15)) || ACTS[0];

/** 한 칸을 8비트로 (조건 4비트 · 행동 4비트) */
export const packOrder = (cond, act) => (((cond & 15) << 4) | (act & 15)) & 0xff;
export const unpackOrder = (b) => ({ cond: (b >> 4) & 15, act: b & 15 });

/** 화면에 적어 줄 한 줄 — "60분에 지고 있으면 → 총공세" */
export function orderText(b) {
  const { cond, act } = unpackOrder(b);
  if (!cond || !act) return "";
  return `${condOf(cond).n} → ${actOf(act).n}`;
}

/* ⚠ 짧은 전역 이름을 파일마다 두면 goja 로 이어 붙일 때 부딪힌다 —
   replay.js 에도 installed 가 있어서 세 번째로 여기 걸렸다. 파일마다 다른 이름을 쓴다. */
let ordersInstalled = false;

/**
 * 커널에 조건부 지시를 얹는다.
 * 지시는 팀 객체의 `team.orders`(8비트 여섯 개)에 담아 두면 된다.
 */
export function installOrders() {
  if (ordersInstalled) return;
  ordersInstalled = true;

  /* 분 경계에서만 본다 — syncClock 이 그 자리다(rules.js 의 aiTacticCheck 와 같은 지점).
     ⚠ 난수를 뽑지 않으므로 지시가 없는 팀에게는 경기가 한 글자도 달라지지 않는다. */
  const _syncClock = MatchSim.prototype.syncClock;
  MatchSim.prototype.syncClock = function () {
    _syncClock.call(this);
    try { this.checkOrders(); } catch (e) { /* 지시가 실패해도 경기는 계속된다 */ }
  };

  MatchSim.prototype.checkOrders = function () {
    if (!this.M) return;
    const min = Math.floor(this.clock / 60);
    if (min === this._ordMin) return;          // 한 분에 한 번만
    this._ordMin = min;

    for (const key of ["h", "a"]) {
      const sd = this.rec(key), t = sd && sd.team;
      if (!t || !t.orders || !t.orders.length) continue;
      const st = this.stats && this.stats[key];
      const ctx = {
        min,
        gd: key === "h" ? this.M.hg - this.M.ag : this.M.ag - this.M.hg,
        myRed: (st && st.red) || 0,
      };
      if (!t._ordDone) t._ordDone = {};
      for (let i = 0; i < t.orders.length; i++) {
        if (t._ordDone[i]) continue;           // 한 칸은 한 번만 발동한다
        const { cond, act } = unpackOrder(t.orders[i] | 0);
        const C = condOf(cond), A = actOf(act);
        if (!C.test || !A.apply || !C.test(ctx)) continue;
        const want = A.apply(t.tactic);
        let changed = false;
        for (const k in want) if (t.tactic[k] !== want[k]) { t.tactic[k] = want[k]; changed = true; }
        t._ordDone[i] = true;
        if (!changed) continue;                // 이미 그 상태였다 — 해설까지 낼 일은 아니다
        /* ⚠ 종류를 "order" 로 둔다 — 화면이 이걸 보고 **해설이 아닌 카드**로 세운다.
           예전에는 "info" 였는데 회색으로 흘러가, 듀얼의 유일한 경기 중 개입 수단인
           조건부 지시가 발동했는지조차 모르겠다는 제보를 받았다.
           ⚠ 문구는 건드리지 말 것. 결과 지문이 이벤트 **본문**을 먹으므로
             한 글자만 바꿔도 이미 나눠 가진 결과 링크의 지문이 달라진다. */
        if (this.emitEvents) {
          this.say(key, `📋 ${t.short}, 미리 적어 둔 지시 — ${A.say || A.n}. (${C.n})`, "order");
        }
      }
    }
  };
}

export function areOrdersInstalled() { return ordersInstalled; }

/* 초보자용 프리셋 — 슬라이더 여덟 개도 부담인데 조건까지 짜라면 아무도 안 씁니다.
   설계서가 "초보자용 프리셋을 꼭 넣으세요"라고 못박은 자리입니다. */
export const ORDER_PRESETS = {
  "기본기": [packOrder(9, 2), packOrder(12, 4), 0, 0, 0, 0],
  "끝까지 밀어붙인다": [packOrder(9, 1), packOrder(11, 1), packOrder(14, 9), 0, 0, 0],
  "지키는 축구": [packOrder(10, 4), packOrder(12, 3), packOrder(13, 3), 0, 0, 0],
};
