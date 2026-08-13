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

/** 커널의 프레임 기록에 얹어, 하이라이트 앞뒤를 잘라 모은다 */
export function installReplay() {
  if (installed) return;
  installed = true;

  const _record = MatchSim.prototype.recordFrame;
  MatchSim.prototype.recordFrame = function () {
    _record.call(this);
    /* ⚠ this.recording 은 읽기만 한다. 커널에 `if(this.recording && RNG()<…)` 가 있어서
       끄면 난수 흐름이 달라져 다른 경기가 된다. 켜고 끌 것은 _wantClips 뿐이다. */
    if (!this.recording || !this._wantClips) return;

    if (!this._clips) { this._clips = []; this._pend = null; this._hlT = -1; }
    const last = this.buf[this.buf.length - 1];
    if (!last) return;

    /* markHighlight 는 "지금까지 중 가장 중요한 장면" 하나만 들고 있고,
       킥오프마다 비워진다. 그래서 t 가 바뀌면 새 장면이라는 뜻이다. */
    const hl = this.hl;
    if (hl && hl.t !== this._hlT) {
      this._hlT = hl.t;
      const pre = this.buf.slice(Math.max(0, this.buf.length - CLIP_PRE));
      this._pend = {
        kind: hl.kind, side: hl.side, weight: hl.weight,
        min: Math.max(0, Math.floor(this.clock / 60)),
        frames: pre.map(pack).filter(Boolean),
        left: CLIP_POST,
      };
      this._clips.push(this._pend);
    } else if (this._pend) {
      this._pend.frames.push(pack(last));
      if (--this._pend.left <= 0) this._pend = null;
    }
  };
}

/** 경기가 끝난 뒤 클립을 꺼낸다. 중요한 것부터 남기고 시간 순으로 돌려준다. */
export function takeClips(sim) {
  const all = (sim._clips || []).filter(c => c.frames.length > 8);
  all.sort((a, b) => (b.weight - a.weight) || (a.min - b.min));
  const keep = all.slice(0, CLIP_MAX);
  keep.sort((a, b) => a.min - b.min);
  for (const c of keep) delete c.left;
  return keep;
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
