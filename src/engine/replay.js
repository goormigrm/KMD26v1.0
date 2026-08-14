/* ─────────────────────────────────────────────────────────────
   2D 화면에 넘길 좌표 — 관전 트랙 + 결정적 장면

   두 벌을 만드는 이유
   -------------------
   엔진은 0.2초마다 22명의 좌표를 남깁니다(recordFrame). 90분이면 13,500장,
   선수 좌표만 60만 개입니다. 그대로 넘기면 전송량이 감당이 안 됩니다.

   그렇다고 결정적 장면만 잘라 두면 **그 사이가 정지 화면**이 됩니다.
   KM26 은 하이라이트가 없는 동안 시뮬을 계속 돌리며 화면을 어둡게 덮어
   "빨리 감는 중"을 보여 줍니다(`drawSimWatch` + 55% 검은 덮개).
   듀얼은 경기를 먼저 다 돌려 놓으므로 그 방식을 그대로 쓸 수 없습니다.
   대신 **띄엄띄엄(8장에 한 장) 좌표를 모은 관전 트랙**을 함께 넘기고,
   화면이 경기 시계에 맞춰 그 사이를 보간해 흘립니다.

   | 트랙 | 촘촘함 | 쓰임 |
   |---|---|---|
   | 관전(watch) | 1.6초에 한 장 | 장면과 장면 사이 — 어둡게, 계속 움직인다 |
   | 관전 — 초반   | 0.2초에 한 장 | 처음 몇 분(WATCH_FULL_UNTIL)은 빨리 감지 않는다 |
   | 장면(clip)  | 0.2초에 한 장 | 골·선방·PK·퇴장 — 밝게, 시계를 멈추고 본다 |

   ⚠ 난수를 쓰지 않습니다. 경기 결과에 영향을 주면 안 됩니다.
   ───────────────────────────────────────────────────────────── */

import { MatchSim } from "./kernel.js?v=04894c7433";

/* ── 장면(clip) 규격 — KM26 의 HL_* 상수를 프레임 수로 옮긴 것 ──────────
   한 프레임이 엔진 0.2초다. 경기 시계는 두 배로 흐르므로 화면에서는 두 배로 보인다. */
export const CLIP_PRE = 55;      // 앞 — 11초 (KM26 HL_LEAD 11.0). 어떻게 만들어졌는지 보인다
export const CLIP_MAX = 24;      // 한 경기에 담을 클립 수 상한 (전송량 때문)

/* 뒷부분은 길이를 고정하지 않는다. 공이 잠잠해질 때까지 본다 —
   5장 고정이던 예전에는 슛이 튀어나온 뒤가 잘려 "무슨 일이 있었는지" 가 안 보였다. */
export const TAIL_MIN = 13;      // 최소 2.6초는 무조건 본다 (KM26 HL_TAIL_MIN 2.5)
export const TAIL_MAX = 50;      // 최대 10초. KM26 은 16초지만 재생 시간이 너무 늘어난다
export const TAIL_SETTLE = 11;   // 공이 2.2초 죽어 있으면 끊는다 (KM26 HL_SETTLE)
export const TAIL_CELEB = 45;    // 골은 세리머니 9초까지 본다 (KM26 HL_CELEB)

/* 골 리플레이 구간 — KM26 의 HL_REPLAY_PRE/POST. 6.0초 = 30장, 2.5초 = 13장 */
export const REPLAY_PRE = 30;
export const REPLAY_POST = 13;

/* ── 관전(watch) 트랙 규격 ────────────────────────────────────────
   1분(경기 시계)은 엔진 150장이다. 8장에 한 장이면 1분에 19장 —
   화면이 1분을 800ms 에 흘리므로 42ms 에 한 장이고, 사이를 보간하면 부드럽다.
   90분이면 1,688장 × 73칸 × 4바이트 ≈ 490KB 로, 장면 클립과 비슷한 무게다. */
export const WATCH_EVERY = 8;
export const WATCH_SLOTS = 22;                        // 한 장에 담는 선수 자리 수
export const WATCH_STRIDE = 7 + WATCH_SLOTS * 3;      // clock,bx,by,bz,owner,rx,ry + 22×(id,x,y)

/* 경기 초반은 **한 장도 빠뜨리지 않고** 담는다 (경기 시계 기준 초).
   결정적 장면이 없는 구간이라 화면이 빨리 감겨, 시작하자마자 죽은 화면처럼 보였다.
   여기만큼은 장면 클립과 같은 촘촘함으로 담아 두고, 화면도 같은 속도로 흘린다
   (match.html 의 OPEN_MINUTES 와 **같은 값이어야 한다**).
   3분이면 450장(≈130KB)이 더 든다 — 첫인상을 사는 값으로는 싸다. */
export const WATCH_FULL_UNTIL = 180;

const r3 = v => Math.round(v * 1000) / 1000;

/** 한 장면을 숫자 배열로 눌러 담는다 — 객체 그대로면 전송량이 몇 배가 된다 */
function pack(f) {
  if (!f) return null;
  const a = [];
  // 선수는 교체·퇴장으로 바뀌므로 id 를 함께 담는다 (자리만 담으면 뒤섞인다)
  for (const g of f.a) a.push(g.id, r3(g.x), r3(g.y));
  return {
    c: Math.round(f.clock),
    b: [r3(f.bx), r3(f.by), r3(f.bz || 0)],
    o: f.oi || 0,                       // 이 순간 공을 가진 선수
    r: [r3(f.rx), r3(f.ry)],            // 주심
    a,
  };
}

/** 관전 트랙 한 줄 — 평평한 숫자 열에 그대로 밀어 넣는다 (뒤에서 Float32Array 로 굳힌다) */
function pushWatch(w, f) {
  w.push(f.clock, f.bx, f.by, f.bz || 0, f.oi || 0, f.rx, f.ry);
  const n = Math.min(f.a.length, WATCH_SLOTS);
  for (let i = 0; i < n; i++) { const g = f.a[i]; w.push(g.id, g.x, g.y); }
  // 퇴장으로 22명이 안 되면 빈 자리를 0 으로 채운다 — 줄 길이가 일정해야 자리를 셀 수 있다
  for (let i = n; i < WATCH_SLOTS; i++) w.push(0, 0, 0);
}

let installed = false;

/**
 * 커널에 얹어 관전 트랙과 하이라이트 앞뒤를 모은다.
 *
 * ⚠ sim.hl 을 쫓아가면 안 된다. markHighlight 는 "한 하프에 가장 중요한 장면" 하나만
 *   들고 있어서, 같은 무게의 두 번째 골은 아예 기록되지 않는다
 *   (`if(this.hl && weight <= this.hl.weight) return`).
 *   그래서 **호출 자체**를 가로챈다.
 */
export function installReplay() {
  if (installed) return;
  installed = true;

  const init = (sim) => {
    if (!sim._clips) { sim._clips = []; sim._pend = null; sim._watch = []; sim._wn = 0; }
    if (!sim._caps) sim._caps = [];
  };

  /* ── 0) 실시간 해설 자막을 주워 담는다 ────────────────────────
     커널에는 해설 줄이 **두 갈래**로 흐릅니다.

       say()  → M.events   문자중계 로그. 90분에 70~90줄쯤 (골·카드·교체·코너 …)
       cap()  → sim.caps   방송 자막용. **훨씬 촘촘한데** 링버퍼(최대 90줄)라
                            지나가면 버려지고, 듀얼은 여태 한 줄도 쓰지 않았다

     2D 는 움직이는데 해설만 멈춰 있던 원인이 이것입니다 — 한 분에 한 줄뿐이라
     장면 재생(수 초)이나 초반 구간(1분에 7.5초) 동안 글자가 안 바뀝니다.
     그래서 버려지던 자막을 **분과 함께** 따로 쌓아 둡니다.

     ⚠ 원래 cap() 을 먼저 부르고 **결과만 읽습니다.** 난수를 새로 쓰지 않습니다
       (문장을 고르는 F_ 는 원래 호출 안에서 이미 돌았습니다).
     ⚠ 링버퍼가 밀려 나가기 전에 가로채야 하므로 여기서 바로 복사합니다. */
  const _cap = MatchSim.prototype.cap;
  MatchSim.prototype.cap = function (side, pool, vars) {
    const prev = (this.caps && this.caps.length) ? this.caps[this.caps.length - 1] : null;
    _cap.call(this, side, pool, vars);
    const now = (this.caps && this.caps.length) ? this.caps[this.caps.length - 1] : null;
    if (!now || now === prev) return;        // 커널이 걸러 아무것도 안 쌓였다
    init(this);
    /* ⚠ **분이 아니라 초**로 남깁니다. 장면 클립의 프레임에도 같은 시계(`c`)가 박혀 있어서,
         화면이 지금 몇 초를 그리고 있는지에 맞춰 자막을 띄울 수 있습니다 —
         그래야 "골!!" 자막이 공이 들어가기 전에 뜨는 일이 없습니다. */
    this._caps.push({ sec: Math.max(0, Math.round(this.clock)), side: now.side, txt: now.txt });
  };

  /* 1) 장면이 잡히는 순간 — 앞부분을 링버퍼에서 떠 온다 */
  const _mark = MatchSim.prototype.markHighlight;
  MatchSim.prototype.markHighlight = function (kind, side, weight) {
    _mark.call(this, kind, side, weight);
    if (!this.recording || !this._wantClips) return;
    init(this);
    const w = weight || 1;

    // 같은 장면이 이어지는 중이면(슛 → 골) 새로 만들지 않고 이름표만 승격한다
    if (this._pend && this.t - this._pend.startT < 6) {
      if (w > this._pend.weight) {
        this._pend.kind = kind; this._pend.side = side; this._pend.weight = w;
        this._pend.min = Math.max(0, Math.floor(this.clock / 60));
        // 리플레이는 "골이 들어간 순간"을 가운데 두고 잘라야 한다 — 승격된 지점으로 옮긴다
        this._pend.trig = this._pend.frames.length;
      }
      this._pend.n = 0; this._pend.calm = 0;   // 뒷부분을 처음부터 다시 본다
      return;
    }
    const pre = this.buf.slice(Math.max(0, this.buf.length - CLIP_PRE));
    const frames = pre.map(pack).filter(Boolean);
    this._pend = {
      kind, side, weight: w, startT: this.t,
      min: Math.max(0, Math.floor(this.clock / 60)),
      frames,
      trig: frames.length,             // 장면이 잡힌 지점 (리플레이 구간의 중심)
      n: 0,                            // 장면이 잡힌 뒤 지나간 장 수
      calm: 0,                         // 공이 죽어 있는 장이 몇 개 이어졌나
    };
    this._clips.push(this._pend);
  };

  /* 2) 도움 준 선수 — 득점 기록에 이름을 함께 남긴다.
     커널은 `M.sc` 에 {n, side, min} 만 담고, 도움은 해설 문장 안에만 들어간다
     (`{p}의 골! 도움은 {a}`). 화면이 문장을 되짚어 이름을 뽑아내는 건 깨지기 쉬우므로,
     메서드 경계에서 받아 적는다 — recordGoal 이 끝나면 goalTag.aid 에 도움 준 선수 id 가 있다.
     ⚠ 커널은 손대지 않는다(설계 원칙). 난수도 쓰지 않으므로 경기 결과에 영향이 없다. */
  const _recordGoal = MatchSim.prototype.recordGoal;
  MatchSim.prototype.recordGoal = function (side, sh) {
    _recordGoal.call(this, side, sh);
    try {
      const sc = this.M && this.M.sc;
      if (!sc || !sc.length) return;
      const last = sc[sc.length - 1];
      const aid = this.goalTag && this.goalTag.sid === sh.shooterId ? this.goalTag.aid : null;
      const ap = aid != null ? this.byId(aid) : null;
      if (ap && ap.p) last.a = ap.p.name;
    } catch (e) { /* 이름표가 없어도 경기는 그대로 간다 */ }
  };

  /* 3) 매 틱 — 관전 트랙을 채우고, 잡고 있는 장면의 뒷부분을 이어 간다 */
  const _record = MatchSim.prototype.recordFrame;
  MatchSim.prototype.recordFrame = function () {
    _record.call(this);
    /* ⚠ this.recording 은 읽기만 한다. 커널에 `if(this.recording && RNG()<…)` 가 있어서
       끄면 난수 흐름이 달라져 다른 경기가 된다. 켜고 끌 것은 _wantClips 뿐이다. */
    if (!this.recording || !this._wantClips) return;
    const last = this.buf[this.buf.length - 1];
    if (!last) return;                       // 하프타임에 버퍼를 비운 직후
    init(this);
    /* 킥오프 한 장은 따로 챙겨 둔다 — 관전 트랙이 아직 비어 있는 첫 순간에 세워 둘 화면 */
    if (!this._frame0) this._frame0 = pack(last);

    // 관전 트랙 — 경기 내내 끊기지 않는다. 초반만 촘촘히, 그 뒤로는 띄엄띄엄
    this._wn++;
    if (last.clock < WATCH_FULL_UNTIL || this._wn % WATCH_EVERY === 0) {
      pushWatch(this._watch, last);
    }

    const p = this._pend;
    if (!p) return;
    p.frames.push(pack(last));
    if (++p.n < TAIL_MIN) return;                       // 최소한 이만큼은 본다
    /* 골 세리머니는 조금 더 본다 — 공이 들어간 순간 끊으면 얼싸안는 데가 잘린다.
       cg(celebrate) 는 커널이 프레임에 새겨 둔 세리머니 상태다. */
    if (last.cg) {
      p.calm = 0;
      if (p.n < TAIL_CELEB) return;
      this._pend = null; return;
    }
    // 공이 살아 있으면 계속 보고, 죽어 있으면(세트피스·정지) 잠잠한 장을 센다
    p.calm = last.st === "PLAYING" ? 0 : p.calm + 1;
    if (p.calm >= TAIL_SETTLE || p.n >= TAIL_MAX) this._pend = null;
  };
}

/** 경기가 끝난 뒤 클립을 꺼낸다. 중요한 것부터 남기고 시간 순으로 돌려준다. */
export function takeClips(sim) {
  const all = (sim._clips || []).filter(c => c.frames.length > 8);
  all.sort((a, b) => (b.weight - a.weight) || (a.min - b.min));
  const keep = all.slice(0, CLIP_MAX);
  keep.sort((a, b) => a.min - b.min);
  for (const c of keep) { delete c.startT; delete c.n; delete c.calm; }
  return keep;
}

/**
 * 관전 트랙을 하나의 Float32Array 로 굳힌다.
 * 평평한 숫자 열이라 일꾼에서 화면으로 **복사 없이** 넘길 수 있다(transfer).
 * 선수 id 는 최대 여섯 자리라 Float32 로도 정확히 담긴다(2^24 까지 정수 오차 없음).
 */
export function takeWatch(sim) {
  const w = sim._watch;
  if (!w || !w.length) return null;
  return Float32Array.from(w);
}

/** 킥오프 한 장 — 관전 트랙이 아직 비어 있는 첫 순간에 세워 둘 화면 */
export function frameZero(sim) {
  return sim._frame0 || null;
}

/**
 * 실시간 해설 자막 — 분 오름차순으로.
 * 화면은 이걸 문자중계(M.events) 사이에 끼워 넣어, 2D 가 움직이는 동안 글자도 함께 흐르게 한다.
 * ⚠ **기록이 아니다.** 아래 해설 로그에는 쌓지 말 것 — 시즌 기록에 남지 않는 문장들이고,
 *   결과(골·카드)를 말하는 줄은 say() 쪽에 이미 있다.
 */
export function takeCaps(sim) {
  return (sim._caps || []).slice();
}

/** 화면이 선수를 그릴 때 필요한 것만 — 이름·등번호·어느 팀인지 */
export function rosterOf(M) {
  const out = {};
  for (const [side, sd] of [["h", M.h], ["a", M.a]]) {
    for (const x of sd.list.concat(sd.bench.map(p => ({ p })))) {
      const p = x.p; if (!p) continue;
      out[p.id] = { n: p.name, no: p.no ?? "", side, gk: p.pos === "GK" };
    }
  }
  return out;
}
