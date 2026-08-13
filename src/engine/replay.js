/* ─────────────────────────────────────────────────────────────
   2D 하이라이트 — 결정적 장면의 좌표를 모은다

   왜 90분 전체가 아닌가
   ---------------------
   엔진은 0.2초마다 22명의 좌표를 남깁니다(recordFrame). 90분이면 13,500장,
   선수 좌표만 60만 개입니다. 그런데 해설 재생은 90분을 1분에 흘려보내므로
   1분당 150장을 그려야 합니다 — 사람이 볼 수 있는 속도가 아닙니다.

   실제로 보고 싶은 건 "골이 어떻게 들어갔나"입니다. 원본 엔진도 그래서
   링버퍼(260장 ≈ 52초)에 최근 장면만 들고 다니고, markHighlight() 로
   "지금이 결정적 장면"이라고 표시해 둡니다. 그 표시를 따라가며 앞뒤를 잘라 냅니다.

   ⚠ 난수를 쓰지 않습니다. 경기 결과에 영향을 주면 안 됩니다.
   ───────────────────────────────────────────────────────────── */

import { MatchSim } from "./kernel.js";

// 프레임 단위(0.2초). 경기 시계는 두 배로 흐르므로 화면에서는 두 배로 보인다.
export const CLIP_PRE = 40;    // 장면 앞 — 8초(경기 시계 16초). 어떻게 만들어졌는지 보인다
export const CLIP_POST = 25;   // 장면 뒤 — 5초(경기 시계 10초). 공이 들어가고 나서까지
export const CLIP_MAX = 24;    // 한 경기에 담을 클립 수 상한 (전송량 때문)

/* 골 리플레이 구간 — KM26 의 HL_REPLAY_PRE/POST 를 프레임 수로 옮긴 것.
   한 프레임이 엔진 0.2초이므로 6.0초 = 30장, 2.5초 = 13장이다. */
export const REPLAY_PRE = 30;
export const REPLAY_POST = 13;

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

let installed = false;

/**
 * 커널에 얹어 하이라이트 앞뒤를 잘라 모은다.
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
    if (!sim._clips) { sim._clips = []; sim._pend = null; }
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
      this._pend.left = CLIP_POST;      // 뒷부분을 다시 늘려 준다
      return;
    }
    const pre = this.buf.slice(Math.max(0, this.buf.length - CLIP_PRE));
    const frames = pre.map(pack).filter(Boolean);
    this._pend = {
      kind, side, weight: w, startT: this.t,
      min: Math.max(0, Math.floor(this.clock / 60)),
      frames,
      trig: frames.length,             // 장면이 잡힌 지점 (리플레이 구간의 중심)
      left: CLIP_POST,
    };
    this._clips.push(this._pend);
  };

  /* 2) 매 틱 — 잡고 있는 장면의 뒷부분을 채운다 */
  const _record = MatchSim.prototype.recordFrame;
  MatchSim.prototype.recordFrame = function () {
    _record.call(this);
    /* ⚠ this.recording 은 읽기만 한다. 커널에 `if(this.recording && RNG()<…)` 가 있어서
       끄면 난수 흐름이 달라져 다른 경기가 된다. 켜고 끌 것은 _wantClips 뿐이다. */
    if (!this.recording || !this._wantClips) return;
    const last = this.buf[this.buf.length - 1];
    if (!last) return;                       // 하프타임에 버퍼를 비운 직후
    /* 킥오프 한 장은 따로 챙겨 둔다 — 장면이 하나도 없는 경기(0:0)에서도
       화면이 빈 캔버스가 아니라 "정지된 포메이션"을 보여줄 수 있어야 한다. */
    if (!this._frame0) this._frame0 = pack(last);
    if (!this._pend) return;
    this._pend.frames.push(pack(last));
    if (--this._pend.left <= 0) this._pend = null;
  };
}

/** 경기가 끝난 뒤 클립을 꺼낸다. 중요한 것부터 남기고 시간 순으로 돌려준다. */
export function takeClips(sim) {
  const all = (sim._clips || []).filter(c => c.frames.length > 8);
  all.sort((a, b) => (b.weight - a.weight) || (a.min - b.min));
  const keep = all.slice(0, CLIP_MAX);
  keep.sort((a, b) => a.min - b.min);
  for (const c of keep) { delete c.left; delete c.startT; }
  return keep;
}

/** 킥오프 한 장 — 장면이 없는 동안 화면에 세워 둘 정지 화면 */
export function frameZero(sim) {
  return sim._frame0 || null;
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
