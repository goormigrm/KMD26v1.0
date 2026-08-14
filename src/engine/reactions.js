/* ─────────────────────────────────────────────────────────────
   경기 뒤 반응 — 소셜미디어 · FM코리아

   KM26 을 재미있게 만드는 큰 축입니다. 경기가 끝나면 팬들이 떠듭니다.
   문구·계정 이름·더비 표는 원본에서 그대로 가져왔고(data/reactions.json),
   여기서는 "이 경기에 어떤 반응이 어울리는가"만 고릅니다.

   ── 원본을 그대로 따라간 것 ─────────────────────────────────
   · 우리 팬(SOC/FMK)과 남의 팬(RIV/FRIV)의 표가 **아예 다릅니다.** 같은 경기를
     남의 눈으로 본 글은 결이 다르기 때문입니다. 한 피드에 섞여 올라옵니다.
   · 계정 이름은 이모지가 붙고, 일부 풀은 뒤에 숫자가 붙습니다(원정석구석4821).
     확률까지 원본 socHandle()/rivalHandle() 그대로입니다.
   · 펨코 글에는 추천·비추·조회수가 붙고, 나쁜 소식에는 상주 악플러가 따라옵니다.
   · 이름이 붙은 더비(슈퍼매치·동해안 더비…)는 반응의 양과 결이 모두 다릅니다.

   ── 듀얼에서 쓰지 않는 것 ───────────────────────────────────
   시즌이 없으므로 연승·순위·개막전·이적·구장 묶음은 쓰지 않습니다.
   ⚠ `goalHigh/goalOk/goalLow` 는 **시즌 목표 공약**에 대한 반응입니다(다득점이 아닙니다).
     예전에 이것을 "골이 많이 났다"로 쓰는 바람에 5골 경기에 "감독이 우승 얘기했다는데?"
     같은 줄이 올라왔습니다. 쓰지 않습니다.

   ⚠ 경기가 끝난 뒤 시드를 다시 심고 뽑습니다 — 두 사람이 같은 경기를 보면 반응도
     같아야 하기 때문입니다. 경기 결과에는 영향이 없습니다(이미 끝났으므로).
   ───────────────────────────────────────────────────────────── */

import { F_ } from "./kernel.js?v=df176035ce";
import { seedRNG, RNG } from "./rng.js?v=df176035ce";

// 커널에도 R() 이 있다 — 모듈을 이어 붙여 쓰는 도구(goja)에서 겹치므로 이름을 달리한다
const rnd = n => Math.floor(RNG() * n);
const one = list => list[rnd(list.length)];

/** 목록에서 n 개를 겹치지 않게 뽑는다 */
function sampleN(list, n) {
  if (!list || !list.length) return [];
  const idx = list.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  return idx.slice(0, Math.max(0, Math.min(n, list.length))).map(i => list[i]);
}

/* ── 계정 이름표 ───────────────────────────────────────────────
   원본 socHandle()/rivalHandle() 의 확률을 그대로 옮깁니다. 이름만 나열하면
   피드가 심심해집니다 — 이모지와 숫자가 붙어야 사람이 쓴 계정처럼 보입니다. */
const named = x => ({ nick: x[0], emoji: x[1] || "💬" });

function handle(tbl, rival) {
  const has = k => tbl[k] && tbl[k].length;
  if (rival) {
    // 타팬도 더러 평범한 계정이다 — 원본과 같은 순서·확률
    if (RNG() < 0.20 && has("socNick3")) return named(one(tbl.socNick3));
    if (RNG() < 0.25 && has("socNickExtra")) return named(one(tbl.socNickExtra));
    if (RNG() < 0.50 && has("rivalNick2")) return named(one(tbl.rivalNick2));
    if (has("rivalHandles")) { const h = one(tbl.rivalHandles); return { nick: h[0] + rnd(9999), emoji: h[1] }; }
    return { nick: "타팬" + rnd(9999), emoji: "🎭" };
  }
  if (RNG() < 0.26 && has("socNick3")) return named(one(tbl.socNick3));
  if (RNG() < 0.30 && has("socNickExtra")) return named(one(tbl.socNickExtra));
  if (RNG() < 0.45 && has("socNick2")) return named(one(tbl.socNick2));
  if (has("socHandles")) { const h = one(tbl.socHandles); return { nick: h[0] + rnd(9999), emoji: h[1] }; }
  return { nick: "팬" + rnd(9999), emoji: "💬" };
}

/* ── 차짬 (안양팬) ──────────────────────────────────────────────
   원본에 없는 KMD26 쪽 추가입니다. 안양이 나오는 경기에는 무슨 일이 있어도 안양을 편들고,
   안양이 없는 경기에는 무슨 일이 있어도 심드렁한 소리를 합니다.
   펨코에만 나타나고 한 경기에 한 번 옵니다. 글은 다른 사람 글과 똑같이 보입니다 —
   눈에 띄게 칠하지 않습니다.
   문구의 {an} 은 안양, {vs} 는 안양의 상대입니다 — 보는 쪽이 어디든 같은 말을 하게. */
const DEV = { nick: "차짬", label: "안양팬", team: "anyang" };

const DEV_ANYANG = [
  "안양 경기력 봤냐? 이게 축구지 ㅋㅋ 오늘 기분 좋다",
  "{vs} 팬들 미안하다 ㅋㅋ 안양은 원래 이런 팀이다",
  "안양 팬인 거 티나도 어쩔 수 없다 ㅇㅇ",
  "안양 선수들 몸 아끼지 말고 뛰어라 내가 다 보고 있다",
  "{vs} 상대로 이 정도면 잘한 거다. 인정할 건 인정하자 (안양 기준)",
  "안양 유니폼 오늘 왜 이렇게 잘생겼냐",
  "{vs} 얘기는 그만하고 안양 얘기 좀 하자",
  "심판 눈에 안양만 안 보이는 거 나만 느끼냐",
  "안양 지면 일주일 기분 안 좋다 ㅋㅋ",
  "안양 선수 이름 스물여섯 명 다 외운다 나는 ㅇㅇ",
  "{an} 화이팅. 올해는 다르다",
];

const DEV_OTHER = [
  "{t} {o} 경기 볼 시간에 안양 하이라이트 세 번 봤다",
  "이 경기 왜 봄? 안양 안 나오는데",
  "{t} 팬들 화이팅... 안양이랑 붙을 때 봅시다",
  "둘 다 안양한테는 못 이긴다 ㅇㅇ 내가 안다",
  "{o} 수비 저러면 안양이 다섯 골 넣는다",
  "재미없다 진짜. 안양 경기 다시보기 갈게요",
  "{t} 승점 3점 챙겼네. 안양은 6점 챙길 거다 (계산상)",
  "이 경기 하이라이트 30초로 요약된다 ㅋㅋ",
  "지금 이 시간에 안양 갤이 더 재밌다",
  "둘이 싸우는 거 구경만 하는 게 제일 편하다 🍿",
  "{t} 이겼다고 좋아하지 마라. 안양이 기다린다",
];

/** 그 팀에서 가장 많이 넣은 선수 — 문구의 {p} 자리에 들어간다 */
function topScorer(goalLine, side) {
  const c = {};
  for (const g of goalLine || []) if (g.side === side) c[g.n] = (c[g.n] || 0) + 1;
  let best = "", n = 0;
  for (const k in c) if (c[k] > n) { n = c[k]; best = k; }
  return best;
}

/** 앞서다 뒤집혔거나 뒤지다 뒤집었는가 — 득점 시각 순서로 본다 */
function hadComeback(goalLine, side) {
  let mine = 0, yours = 0, led = false, trailed = false;
  for (const g of goalLine || []) {
    if (g.side === side) mine++; else yours++;
    if (mine > yours) led = true;
    if (yours > mine) trailed = true;
  }
  return { comeback: mine > yours && trailed, blown: mine < yours && led };
}

/** 이름이 붙은 대결인가 — RIVALS 표 [구단A, 구단B, 이름, 등급] */
export function derbyOf(rivals, a, b) {
  for (const r of rivals || []) {
    if ((r[0] === a && r[1] === b) || (r[0] === b && r[1] === a)) return { n: r[2], tier: r[3] || 1 };
  }
  return null;
}

/**
 * @param {object} r  runHeadless 결과 + {home, away, homeId, awayId, seed}
 * @param {object} tbl data/reactions.json
 * @param {string} side "h" | "a" — 누구의 팬 시선으로 볼 것인가
 */
export function makeReactions(r, tbl, side = "h") {
  if (!tbl || !tbl.soc || !tbl.fmk) return { social: [], fmk: [], keys: [] };

  const us = side === "h" ? r.home : r.away;
  const them = side === "h" ? r.away : r.home;
  const gf = side === "h" ? r.hg : r.ag;
  const ga = side === "h" ? r.ag : r.hg;
  const st = side === "h" ? r.stats.h : r.stats.a;
  const ost = side === "h" ? r.stats.a : r.stats.h;

  /* 경기가 끝난 뒤 다시 심는다 — 같은 경기면 같은 반응이 나와야 한다.
     양쪽 시선이 같은 줄을 뽑지 않도록 시선마다 다른 값을 섞는다. */
  seedRNG((r.seed ^ (side === "h" ? 0x5EAC7 : 0xA1FA9)) >>> 0);

  const derby = derbyOf(tbl.rivals, r.homeId, r.awayId);
  const cb = hadComeback(r.goalLine, side);
  const myS = st ? st.shot : 0, myT = st ? st.shotOn : 0;

  /* 문구가 요구하는 자리를 전부 채운다. 하나라도 비면 "슈팅 개" 처럼 어색하게 찍힌다.
     (원본 표에 쓰인 키를 세어 맞춘 것: t · o · p · s · sh · sog · shO · d) */
  // 차짬이 편드는 팀이 이 경기에 나오는가 — 나오면 어느 쪽인지도 알아 둔다
  const devSide = r.homeId === DEV.team ? "h" : r.awayId === DEV.team ? "a" : null;
  const devTeam = devSide === "h" ? r.home : devSide === "a" ? r.away : "";
  const devOpp = devSide === "h" ? r.away : devSide === "a" ? r.home : "";

  const vars = {
    t: us, o: them,
    s: Math.abs(gf - ga), n: gf + ga,
    sh: myS, sog: myT, shO: ost ? ost.shot : 0,
    p: topScorer(r.goalLine, side) || topScorer(r.goalLine, side === "h" ? "a" : "h") || "우리 선수",
    d: derby ? derby.n : "",
    an: devTeam, vs: devOpp,
  };

  const social = [], board = [], keys = [];
  const bag = (t, k) => (t && t[k] && t[k].length) ? t[k] : null;

  /** 소셜 한 묶음 — rival 이면 남의 팬 표(RIV)에서 뽑고 이름표도 타팬 것으로 */
  function soc(key, n, tone, rival) {
    const list = bag(rival ? tbl.riv : tbl.soc, key);
    if (!list) return;
    keys.push((rival ? "riv." : "soc.") + key);
    for (const it of sampleN(list, n)) {
      const txt = Array.isArray(it) ? it[0] : it;
      const tn = Array.isArray(it) ? it[1] : tone;
      social.push(Object.assign({ txt: F_(txt, vars), tone: tn, rival: !!rival }, handle(tbl, rival)));
    }
  }

  /** 펨코 한 묶음 — 추천·비추·조회수가 붙는다 (원본 fmkPush 와 같은 폭) */
  function brd(key, n, rival) {
    const list = bag(rival ? tbl.friv : tbl.fmk, key);
    if (!list) return;
    keys.push((rival ? "friv." : "fmk.") + key);
    const nickPool = (rival ? tbl.rivalNick : tbl.nick) || ["ㅇㅇ"];
    for (const it of sampleN(list, n)) {
      const txt = Array.isArray(it) ? it[0] : it;
      const tone = Array.isArray(it) ? it[1] : 0;
      board.push({
        txt: F_(txt, vars), tone, rival: !!rival, nick: one(nickPool),
        up: tone > 0 ? 20 + rnd(400) : 5 + rnd(220), dn: rnd(60), views: 120 + rnd(4000),
      });
    }
  }

  /* 상주 악플러 — 원본과 같이 펨코에만, 나쁜 소식에만 나타난다.
     비추가 쏟아지지만 본인들은 개의치 않는다. */
  function troll() {
    if (!bag(tbl, "troll") || !bag(tbl, "trollSay")) return;
    const who = one(tbl.troll);
    board.push({
      txt: F_(one(tbl.trollSay), vars), tone: -1, nick: who[0], emoji: who[1], troll: true,
      up: rnd(25), dn: 120 + rnd(500), views: 800 + rnd(6000),
    });
  }

  // ── 결과 (원본 socialOnMatch 의 갈래·개수를 그대로) ──────────
  if (gf > ga) {
    if (gf - ga >= 3) { soc("winBig", 2 + rnd(2), 1); brd("bigWin", 3 + rnd(2)); soc("winBig", 2 + rnd(2), 1, true); brd("bigWin", 1 + rnd(2), true); }
    else { soc("win", 2 + rnd(2), 1); brd("win", 2 + rnd(2)); soc("win", 2 + rnd(2), 1, true); brd("win", 1 + rnd(2), true); }
  } else if (gf === ga) {
    soc("draw", 2 + rnd(2), 0); brd("draw", 2 + rnd(2));
    soc("draw", 2 + rnd(2), 0, true); brd("draw", 1 + rnd(2), true);
  } else {
    if (ga - gf >= 3) { soc("loseBig", 2 + rnd(2), -1); brd("bigLose", 3 + rnd(2)); soc("loseBig", 2 + rnd(2), -1, true); brd("bigLose", 2 + rnd(2), true); }
    else { soc("lose", 2 + rnd(2), -1); brd("lose", 2 + rnd(2)); soc("lose", 2 + rnd(2), -1, true); brd("lose", 1 + rnd(2), true); }
    if (RNG() < 0.55) troll();
  }

  /* 더비 — 이름이 붙은 경기는 반응의 양과 결이 모두 다르다.
     기존 rivalWin/rivalLose 위에 더비 전용 반응을 얹는다(원본과 같은 순서). */
  if (derby) {
    const big = derby.tier >= 2 ? 1 : 0;
    if (gf > ga) {
      soc("rivalWin", 2 + rnd(2), 1); brd("rivalWin", 2 + rnd(2));
      soc("derbyWin", 3 + rnd(2) + big, 1); brd("derbyWin", 3 + rnd(2) + big);
      soc("rivalWin", 1 + rnd(2), 1, true); soc("derbyWin", 2 + rnd(2), 0, true); brd("derbyWin", 1 + rnd(2) + big, true);
    } else if (gf < ga) {
      soc("rivalLose", 2 + rnd(2), -1); brd("rivalLose", 2 + rnd(2));
      soc("derbyLose", 3 + rnd(2) + big, -1); brd("derbyLose", 3 + rnd(2) + big);
      soc("rivalLose", 1 + rnd(2), -1, true); soc("derbyLose", 2 + rnd(2), 0, true); brd("derbyLose", 1 + rnd(2) + big, true);
    } else {
      soc("derbyDraw", 2 + rnd(2), 0); brd("derbyDraw", 2 + rnd(2));
      soc("derbyDraw", 1 + rnd(2), 0, true); brd("derbyDraw", 1 + rnd(2), true);
    }
  }

  // ── 그 경기만의 사정 — 역전, 무득점, 무실점 ─────────────────
  if (cb.comeback) { soc("comeback", 1 + rnd(2), 1); brd("comeback", 1 + rnd(2)); }
  if (cb.blown) { soc("blown", 1 + rnd(2), -1); brd("blown", 1 + rnd(2)); }
  if (gf === 0) {
    // 슈팅을 많이 하고도 못 넣은 날과, 아예 못 만든 날의 반응은 달라야 한다
    soc(myS >= 12 ? "blankMany" : myS <= 4 ? "blankFew" : "blank", 1 + rnd(2), -1);
    if (RNG() < 0.6) brd(myS >= 12 ? "blankMany" : "blank", 1 + rnd(2));
  }
  if (ga === 0 && gf > 0 && RNG() < 0.7) soc("clean", 1 + rnd(2), 1);

  /* 안양팬 — 한 경기에 한 번. 안양이 나오면 안양 편, 안 나오면 심드렁하게.
     어조는 "보고 있는 쪽에 좋은 소식인가"로 매긴다 — 안양 팬 시선에서는 좋은 글이고
     안양의 상대 팬 시선에서는 거슬리는 글이다. */
  {
    const forAnyang = devSide !== null;
    const txt = one(forAnyang ? DEV_ANYANG : DEV_OTHER);
    const tone = forAnyang ? (devSide === side ? 1 : -1) : -1;
    board.push({
      txt: F_(txt, vars), tone, nick: DEV.nick, label: DEV.label, always: true,
      up: 40 + rnd(600), dn: 10 + rnd(90), views: 500 + rnd(5000),
    });
  }

  /* 최신순처럼 보이게 섞는다 — 우리 팬 글만 위에 뭉쳐 있으면 피드로 안 읽힌다.
     안양팬 글은 상한에 걸려 잘려 나가면 안 되므로 따로 떼어 두고 마지막에 다시 섞어 넣는다. */
  const dev = board.filter(x => x.always);
  const rest = shuffle(board.filter(x => !x.always)).slice(0, 13);
  return { social: shuffle(social).slice(0, 16), fmk: shuffle(rest.concat(dev)), keys };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
