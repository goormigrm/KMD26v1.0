# -*- coding: utf-8 -*-
"""
KMD26 커널 패치기 (단계 3)

kernel.raw.js (추출 원본) → kernel.js (엔진이 실제로 쓰는 파일)

왜 따로 있나
------------
설계 원칙상 커널은 손으로 고치지 않는다. 원본 KM26 이 갱신되면 다시 뽑아야 하기 때문이다.
그런데 KM26 원본 버그 중 일부는 "메서드 경계"가 아니라 함수 한복판에 있어서
프로토타입 래핑(src/engine/rules.js)으로는 손이 닿지 않는다. 그것만 여기서 처리한다.

  · 메서드 경계에서 표현되는 것  → src/engine/rules.js (래퍼)
  · 함수 한복판이라 안 되는 것   → 이 파일 (패치)

패치는 전부 "몇 군데에 걸리는지"를 못박아 둔다. 원본이 갱신돼 문구가 달라지면
조용히 건너뛰는 대신 즉시 중단된다 — 안 걸린 패치를 모르고 지나가는 게 제일 위험하다.

사용: python tools/patch_kernel.py [입력 kernel.raw.js] [출력 kernel.js]
"""
import io, sys, hashlib

SRC = sys.argv[1] if len(sys.argv) > 1 else "src/engine/kernel.raw.js"
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/engine/kernel.js"

# ─────────────────────────────────────────────────────────────
# 패치 목록 — "함수 한복판이라 밖에서 감쌀 수 없는 것"만 여기 온다.
# 메서드 경계에서 표현되는 건 전부 src/engine/rules.js 로 간다.
#   id     : 로그·헤더에 찍히는 식별자
#   kind   : 버그 = KM26 원본 결함 / 전술 = 듀얼에 필요한데 원본에 없는 연결
#   why    : 무엇이 잘못됐는지 (한 줄)
#   find   : 원본에서 찾을 문자열 (정규식 아님 — 문자 그대로)
#   repl   : 바꿔 넣을 문자열
#   count  : 걸려야 하는 횟수. 다르면 중단한다.
#   off    : True 면 **적용하지 않는다.** 효과가 확인되지 않은 수정을 지우는 대신 꺼 둔다 —
#            무엇을 왜 손대려 했는지가 코드에 남아 있어야 나중에 다시 볼 수 있다.
#            꺼 둔 것도 앵커는 그대로 검사하므로, 원본이 갱신되면 여기서 걸린다.
# ─────────────────────────────────────────────────────────────
PATCHES = [

  # ── 전술 ────────────────────────────────────────────────────
  # 단계 3 측정에서 "패스 길이" 슬라이더가 **미반영**으로 잡혔다.
  # 같은 시드로 짧게(0)와 길게(4)를 돌렸는데 결과 지문이 한 글자도 안 달랐다.
  #
  # 확인해 보니 2D 엔진은 T.pass 를 한 번도 읽지 않는다. 커널 안의 유일한 참조는
  # tacticSig()(전술이 바뀌었는지 감지하는 서명 문자열)뿐이고, 경기 계산에는 안 쓰인다.
  # 원본에서 T.pass 를 읽는 곳은 분 단위 엔진(tacticAtkBonus)과 AI 역할 배정(aiRoleTacFit)인데,
  # 둘 다 듀얼의 2D 경기 경로가 아니다.
  #
  # 화면에 슬라이더를 띄워 놓고 아무 일도 안 일어나면 그건 거짓말이다. 연결해 준다.
  dict(
    id="PASS-01",
    kind="전술",
    why="2D 엔진이 팀 전술 '패스 길이'를 읽지 않는다 — 패스 목표 선택에 연결",
    count=1,
    find=(
      "function evaluatePassOptions(carrier, mates, opps, ctx){\n"
      "  const dir=ctx.dir, out=[];\n"
    ),
    repl=(
      "function evaluatePassOptions(carrier, mates, opps, ctx){\n"
      "  const dir=ctx.dir, out=[];\n"
      "  /* [KMD26 PASS-01] 팀 전술 '패스 길이'. tacVal 로 0~2 스케일이므로 가운데가 1이다.\n"
      "     짧게(-1) 이면 거리 부담을 키우고 전진 이득을 깎아 가까운 연결을 고르게 하고,\n"
      "     길게(+1) 이면 반대로 해서 앞으로 길게 붙이게 한다.\n"
      "     ⚠ 난수를 쓰지 않는다 — 결정론에 영향이 없어야 한다. */\n"
      "  const _pd = ((carrier && carrier.team) ? TAC(carrier.team).pass : 1) - 1;\n"
      "  const _progK = 1 + _pd*0.45, _distK = 1 - _pd*0.30;\n"
    ),
  ),

  dict(
    id="PASS-02",
    kind="전술",
    why="같은 슬라이더를 패스 실행(길게 띄우는 문턱)에도 연결 — 목표만 바꾸면 걷어차는 모양이 안 따라온다",
    count=1,
    find="    let score = prog*1.35 - distPen - recvPress*(0.55+recvOwn*2.4) - blocked*1.2\n",
    repl="    let score = prog*1.35*_progK - distPen*_distK - recvPress*(0.55+recvOwn*2.4) - blocked*1.2\n",
  ),

  dict(
    id="PASS-03",
    kind="전술",
    why="'몇 m부터 길게 차는가' 문턱도 팀 전술을 따르게 — 원본은 선수 특성만 읽는다",
    count=1,
    find="  const longGate = PASS_LONG_M*clamp(1 - lpF*0.38 + spF*0.45, 0.55, 1.85);\n",
    repl=(
      "  /* [KMD26 PASS-03] 원본은 여기서 선수 특성(lpF/spF)만 봤다. 팀 지시도 같이 읽는다 —\n"
      "     짧게 가는 팀은 문턱이 올라가 웬만하면 붙여 주고, 길게 가는 팀은 내려가 띄워 보낸다. */\n"
      "  const _pdT = ((carrier && carrier.team) ? TAC(carrier.team).pass : 1) - 1;\n"
      "  const longGate = PASS_LONG_M*clamp(1 - lpF*0.38 + spF*0.45 - _pdT*0.30, 0.55, 1.85);\n"
    ),
  ),

  # ── 압박 ────────────────────────────────────────────────────
  # 측정에서 태클 시도가 17.4 → 17.4 로 꿈쩍도 안 했고, 방향은 오히려 5/16(31%)이었다.
  # 두 가지가 겹쳐 있었다.
  dict(
    id="PRESS-01",
    kind="버그",
    why="압박 계수가 '압박당하는 쪽'의 지시로 계산된다 — 압박을 올리면 우리 선수가 더 눌린 것처럼 나온다",
    count=1,
    # pressureOn(선수, 상대들, 압박지시) 의 세 번째 인자에 호출부가 전부
    # "볼 소유자 자기 팀"의 T.press 를 넘기고 있었다. 압박은 상대가 하는 것이므로
    # 계수도 상대 팀 지시를 따라야 한다. 호출부를 다 고치는 대신 여기서 바로잡는다.
    find="  return s*(0.8+((pressTac===undefined?1:pressTac))*0.25);\n",
    repl=(
      "  /* [KMD26 PRESS-01] 압박 계수는 **압박하는 쪽**의 지시를 따라야 한다.\n"
      "     호출부가 전부 '압박당하는 팀'의 값을 넘기고 있어서, 압박을 올리면\n"
      "     우리 선수가 더 눌린 것처럼 계산돼 오히려 안전하게 돌렸다. */\n"
      "  const _pk = (opponents && opponents.length && opponents[0].team)\n"
      "            ? TAC(opponents[0].team).press\n"
      "            : (pressTac===undefined?1:pressTac);\n"
      "  return s*(0.8+_pk*0.25);\n"
    ),
  ),

  dict(
    id="PRESS-02",
    kind="전술",
    why="압박이 태클 시도 빈도에 연결돼 있지 않다 — 높은 압박은 더 자주 달려드는 것이다",
    count=1,
    # tryTackle 은 T.tackle 만 읽는다. 여기 T 는 수비(태클하는) 팀이라 자리는 맞다.
    # 특성 aggPress 는 이미 markEdge 로 들어와 있는데, 팀 지시는 빠져 있었다.
    find="      if(RNG() > (slide?0.006:0.009)*markEdge/(TEMPO*1.5)*(0.8+T.tackle*0.2)) continue;",
    repl=(
      "      // [KMD26 PRESS-02] 팀 압박 지시도 읽는다 — 높은 압박은 더 자주 발을 뻗는 것이다\n"
      "      if(RNG() > (slide?0.006:0.009)*markEdge/(TEMPO*1.5)*(0.8+T.tackle*0.2)*(0.75+T.press*0.25)) continue;"
    ),
  ),

  # ── 폭 ──────────────────────────────────────────────────────
  # 크로스가 16.4 → 19.0 으로 평균은 올랐지만 쌍별 방향은 9/16(56%) — 사실상 잡음이었다.
  # evaluateCross 의 문턱을 선수 특성(cf)만 낮추고 팀 폭은 안 읽는다. 패스 길이와 같은 구멍이다.
  dict(
    id="WIDTH-01",
    kind="전술",
    off=True,   # ⛔ 보류 — 아래 "측정" 참고. 켜면 오히려 나빠진다.
    why="크로스 판단 문턱이 팀 '폭'을 읽지 않는다 (수정안이 역효과라 보류)",
    count=1,
    # ── 측정 (2026-08-13, tools/simcheck, 45분 10쌍) ────────────────────
    #   패치 없음 : 크로스 16.4 → 19.0 (16쌍, 방향 일치 9/16 = 사실상 잡음)
    #   이 패치   : 크로스 11.6 →  8.5 (10쌍, 9쌍 중 6쌍 감소) ← 거꾸로 갔다
    #
    # 문턱만 낮추는 걸로는 안 된다. 폭에는 서로 맞서는 두 힘이 있다고 본다.
    #   (+) 넓게 서면 측면 깊숙이 자리 잡는 선수가 늘어 올릴 기회가 는다
    #   (−) 넓게 서면 **박스 안에 댈 사람이 준다** — inBoxMates 가 비면 크로스는 통째로 취소된다
    # 문턱을 낮추면 (+)만 커지는데, 정작 막고 있는 건 (−) 쪽이라 효과가 없거나 뒤집힌다.
    #
    # 다음에 볼 곳 — 문턱이 아니라 "박스에 누가 들어가는가"다.
    #   · assignOffRoles 가 폭을 읽게 해서, 넓은 팀일수록 중앙 공격수·미드필더를 박스로 밀어 넣기
    #   · tacticalAnchorXY 의 wScale(0.72+width*0.28)이 최전방까지 똑같이 벌리는지 확인
    #     (측면을 벌리는 것과 스트라이커를 벌리는 것은 다른 이야기다)
    find=(
      "  const wide=Math.abs(carrier.y-0.5) > 0.21-cf*0.055;\n"
      "  if(!wide || cx < 0.56-cf*0.075) return null;\n"
    ),
    repl=(
      "  /* [KMD26 WIDTH-01] 팀 폭 지시. 넓게 서는 팀은 각이 덜 열려도 올려 보고,\n"
      "     좁게 서는 팀은 어지간해서는 안 올리고 안으로 파고든다. */\n"
      "  const _wd = ((carrier && carrier.team) ? TAC(carrier.team).width : 1) - 1;\n"
      "  const wide=Math.abs(carrier.y-0.5) > 0.21-cf*0.055-_wd*0.030;\n"
      "  if(!wide || cx < 0.56-cf*0.075-_wd*0.040) return null;\n"
    ),
  ),

  # ── 멘탈리티 ────────────────────────────────────────────────
  # 슈팅이 14.3 → 12.3 으로 **거꾸로** 갔다 (6/16, 38%).
  # 멘탈리티는 자리를 앞으로 밀어 주지만(fbPush·phaseShift), 앞으로 나간 만큼 뺏기고
  # 역습을 맞아서 결국 슛이 줄었다. 슛을 때릴지 말지에 붙는 항이 ±0.06 뿐이라
  # 슛 점수 척도(SHOT_GAIN 2.70, 중거리 성향 -0.62~+1.05)에 견주면 없는 거나 마찬가지였다.
  dict(
    id="MENT-01",
    kind="전술",
    why="공격적 멘탈리티인데 슈팅이 오히려 줄었다 — 슛 판단에 붙는 항이 ±0.06 으로 사실상 없었다",
    count=1,
    find="+ trShot + ((ctx.mentality||1)-1)*0.06;\n",
    repl="+ trShot + ((ctx.mentality||1)-1)*0.30;   // [KMD26 MENT-01] 0.06 → 0.30. 자리만 밀지 말고 '때린다'는 판단도 바뀌어야 한다\n",
  ),

  # ── 템포 ────────────────────────────────────────────────────
  dict(
    id="TEMPO-01",
    kind="버그",
    why="전술이 3단계에서 5단계로 바뀔 때 tempoK 계수가 안 따라왔다 — 폭도 절반, 중립점도 어긋나 있었다",
    count=1,
    # T.tempo 는 tacVal 을 거쳐 0~2 로 들어온다. 그런데 계수는 옛 0~4 눈금에 맞춰져 있다.
    #   지금:   1.12 - 0~2 * 0.06 = 1.12 ~ 1.00   (중립 1.06 · clamp 하한 0.85 는 영영 못 닿음)
    #   고친 뒤: 1.12 - 0~2 * 0.12 = 1.12 ~ 0.88   (중립 1.00 · clamp 0.85~1.15 와 정확히 맞음)
    # null 기본값이 2 인 것도 옛 눈금의 흔적이다(0~4 의 가운데). tacVal 기준으로는 1 이 맞다.
    find="    try{ const T=TAC(this.rec(side).team); return clamp(1.12-(T.tempo!=null?T.tempo:2)*0.06, 0.85, 1.15); }\n",
    repl=(
      "    /* [KMD26 TEMPO-01] T.tempo 는 tacVal 을 거쳐 0~2 로 들어오는데 계수가 옛 0~4 눈금에 맞춰져\n"
      "       있었다. 그래서 폭이 절반(1.12~1.00)이고 중립점도 1.06 으로 어긋나 있었다.\n"
      "       0.12 로 두면 1.12~0.88 이 되어 아래 clamp(0.85~1.15) 와 정확히 맞고 중립이 1.00 이 된다. */\n"
      "    try{ const T=TAC(this.rec(side).team); return clamp(1.12-(T.tempo!=null?T.tempo:1)*0.12, 0.85, 1.15); }\n"
    ),
  ),

  # ── 버그 ────────────────────────────────────────────────────
  dict(
    id="PK-01",
    kind="버그",
    why="kickoff() 이 b.isPenalty 를 지우지 않아, PK 다음 킥오프가 센터서클에서 '페널티킥'이 된다",
    count=1,
    find=(
      "    b.setPiece=null; b.shot=null; b.celebrate=null; b.foulScene=null;\n"
    ),
    repl=(
      "    b.setPiece=null; b.shot=null; b.celebrate=null; b.foulScene=null;\n"
      "    b.isPenalty=false;   // [KMD26 PK-01] 플레이가 새로 시작되면 PK 플래그도 죽는다\n"
    ),
  ),

  dict(
    id="PK-02",
    kind="버그",
    why="PK 득점이 VAR 로 취소된다. PK 는 오프사이드도 빌드업 반칙도 있을 수 없다 (분 단위 엔진에는 isPen 가드가 있다)",
    count=1,
    find="        if(this.emitEvents && RNG()<VAR_CHECK_P){\n",
    repl="        if(this.emitEvents && !sh.isPen && RNG()<VAR_CHECK_P){   // [KMD26 PK-02] PK 골은 판독 대상이 아니다\n",
  ),

  dict(
    id="PK-03",
    kind="버그",
    why="90분이 되는 순간 루프가 끝나 버려, 종료 직전에 선언된 PK 가 실행되지 않는다",
    count=1,
    find=(
      "    let guard=0;\n"
      "    while(this.clock<end && guard++<200000){\n"
    ),
    repl=(
      "    let guard=0;\n"
      "    /* [KMD26 PK-03] 경기는 PK 가 끝나야 끝난다.\n"
      "       실제 축구도 종료 직전 PK 가 선언되면 그 킥이 마무리될 때까지 시간을 연장한다.\n"
      "       판정 대기 → 세트피스 준비 → 슛이 날아가는 구간까지가 '아직 안 끝난 PK'다.\n"
      "       키퍼가 쳐낸 뒤의 세컨볼은 연장 대상이 아니다 (경기규칙과 같다). */\n"
      "    const penPending=()=>{ const b=this.ball||{};\n"
      "      return !!(b.isPenalty\n"
      "             || (b.foulScene && b.foulScene.pen)\n"
      "             || (b.setPiece && b.setPiece.kind===\"penalty\")\n"
      "             || (b.shot && b.shot.isPen)); };\n"
      "    while((this.clock<end || penPending()) && guard++<200000){\n"
    ),
  ),

  # ── 교체 ────────────────────────────────────────────────────
  # 교체 선수는 나간 선수의 자리를 그대로 물려받는다(subIn). 그런데 들어올 사람을 고르는
  # 기준이 '포지션 묶음(DF/MF/FW)이 같은 사람 중 능력치 최고' 뿐이라, 실제 경기에서
  # 지고 있는 울산이 센터백을 빼고 스트라이커를 넣어 그 스트라이커가 센터백 자리에 섰다.
  # 화면이 벤치에 붙여 놓은 S1~S9 번호도 엔진은 한 번도 보지 않았다.
  # 부상으로 비운 자리는 onPitch 후보에 아예 없어서 끝까지 열 명으로 뛰었다.
  dict(
    id="SUB-01",
    kind="버그",
    why="교체 투입이 벤치 순서(S1~S9)와 자리 능숙도를 무시한다 — 스트라이커가 센터백 자리에 서고, 부상으로 빈 자리는 끝까지 안 채워진다",
    count=1,
    find=r"""
function aiSubs(M, minNow){
  const m = (minNow!=null) ? minNow : M.min;
  if(AI_SUB_WINDOWS.indexOf(m)<0) return;
  for(const [sd,key,myG,opG] of [[M.h,"h",M.hg,M.ag],[M.a,"a",M.ag,M.hg]]){
    if(sd.team.isUser) continue;
    if(!sd.bench || !sd.bench.length) continue;
    if(RNG()<0.18) continue;          // 이번 창은 그냥 지켜본다
    let made=0;
    const cap = RNG()<0.30 ? 2 : 1;    // 한 번에 둘을 바꾸는 건 가끔이다
    while(sd.subs<5 && made<cap && aiSubOnce(M, sd, key, myG-opG, m)) made++;
  }
}
/* 한 명만 바꾼다. 바꿨으면 true. */

function aiSubOnce(M, sd, key, diff, m){
  const pitch=onPitch(sd).filter(x=>x.p.pos!=="GK" && !x.red);
  if(pitch.length<8) return false;                       // 이미 수적 열세면 더 빼지 않는다
  const bench=sd.bench.filter(p=>p.pos!=="GK");
  if(!bench.length) return false;
  // 이 팀의 기둥 — 웬만해선 빼지 않는다
  const core=[...pitch].sort((a,b)=>b.p.ovr-a.p.ovr).slice(0,2).map(x=>x.p.id);
  const protectedOut=x=>core.indexOf(x.p.id)>=0 && x.fit>=AI_SUB_URGENT;
  const best=(list,f)=>{ const c=list.filter(f||(()=>true)); return c.length?c.sort((a,b)=>b.ovr-a.ovr)[0]:null; };
  const tryPair=(outX, inP)=>{
    if(!outX||!inP) return false;
    if(!canEnter(sd, outX, inP)) return false;
    subIn(M, sd, key, outX, inP);
    return true;
  };
  // ① 경고 + 피로 — 퇴장 나기 전에 뺀다
  const risky=pitch.filter(x=>x.y>0 && x.fit<72 && !protectedOut(x)).sort((a,b)=>a.fit-b.fit)[0];
  if(risky){
    const inP=best(bench, p=>p.pos===risky.p.pos) || best(bench, p=>p.pos!=="GK");
    if(tryPair(risky, inP)) return true;
  }
  // ② 체력이 무너진 선수
  const tired=pitch.filter(x=>x.fit<AI_SUB_TIRED && (!protectedOut(x)||x.fit<AI_SUB_URGENT))
                   .sort((a,b)=>a.fit-b.fit)[0];
  if(tired){
    const inP=best(bench, p=>p.pos===tired.p.pos) || best(bench, p=>p.pos!=="GK");
    if(tryPair(tired, inP)) return true;
  }
  // ③ 지고 있다 — 수비를 하나 줄이고 공격 자원을 넣는다
  if(diff<0 && m>=58){
    const df=pitch.filter(x=>x.p.pos==="DF");
    const outX=df.length>3 ? df.sort((a,b)=>(a.p.ovr+a.fit*0.3)-(b.p.ovr+b.fit*0.3))[0]
                           : pitch.filter(x=>x.p.pos==="MF").sort((a,b)=>a.fit-b.fit)[0];
    const inP=best(bench, p=>p.pos==="FW") || best(bench, p=>p.pos==="MF");
    if(outX && !protectedOut(outX) && tryPair(outX, inP)) return true;
  }
  // ④ 이기고 있다 — 문을 닫는다. 공격수를 빼고 수비·중원을 채운다
  if(diff>0 && m>=73){
    const fw=pitch.filter(x=>x.p.pos==="FW");
    const outX=fw.length>1 ? fw.sort((a,b)=>a.fit-b.fit)[0] : null;
    const inP=best(bench, p=>p.pos==="DF") || best(bench, p=>p.pos==="MF");
    if(outX && !protectedOut(outX) && tryPair(outX, inP)) return true;
  }
  // ⑤ 그 밖에는 확실한 업그레이드가 있을 때만 (벤치가 더 좋고, 나갈 선수는 지쳐 있을 때)
  if(m>=66){
    for(const outX of [...pitch].sort((a,b)=>a.fit-b.fit)){
      if(protectedOut(outX)) continue;
      const inP=best(bench, p=>p.pos===outX.p.pos && p.ovr>outX.p.ovr+2 && outX.fit<78);
      if(inP && tryPair(outX, inP)) return true;
    }
  }
  return false;
}
""",  # ⚠ 끝에 빈 줄을 붙이지 않는다 — 원본이 여기 한 줄만 두어 앵커가 어긋났었다
    repl=r"""
function aiSubs(M, minNow){
  const m = (minNow!=null) ? minNow : M.min;
  const win = AI_SUB_WINDOWS.indexOf(m)>=0;
  for(const [sd,key,myG,opG] of [[M.h,"h",M.hg,M.ag],[M.a,"a",M.ag,M.hg]]){
    if(sd.team.isUser) continue;
    if(!sd.bench || !sd.bench.length) continue;
    /* [KMD26 SUB-01] 부상으로 비운 자리는 교체 창을 기다리지 않는다.
       KM26 은 이 순간 감독에게 물어보지만(needsSubPause) 듀얼에는 물어볼 사람이 없어,
       20분에 다치면 남은 70분을 열 명으로 뛰었다. 난수를 쓰지 않으므로 재생도 안 갈린다. */
    while(sd.subs<5 && aiFillGap(M, sd, key)) ;
    if(!win) continue;
    if(RNG()<0.18) continue;          // 이번 창은 그냥 지켜본다
    let made=0;
    const cap = RNG()<0.30 ? 2 : 1;    // 한 번에 둘을 바꾸는 건 가끔이다
    while(sd.subs<5 && made<cap && aiSubOnce(M, sd, key, myG-opG, m)) made++;
  }
}
/* ── [KMD26 SUB-01] 누구를 넣을 것인가 ──────────────────────────────
   교체 선수는 나간 선수의 자리를 그대로 물려받는다(subIn). 그러므로 "누구를 빼는가"가
   곧 "누가 어느 자리에 서는가"다. 원본은 들어올 사람을 '포지션 묶음(DF/MF/FW)이 같은
   사람 중 능력치 최고'로 골랐는데, 듀얼에서는 두 군데가 어긋난다.
     · 화면은 벤치에 S1~S9 번호를 붙여 놓고, 엔진은 그 순서를 하나도 쓰지 않았다
     · 지고 있을 때 수비수를 빼고 공격수를 넣으면 그 공격수가 센터백 자리에 선다
   그래서 "그 자리를 볼 수 있는가"(자리 능숙도)를 먼저 보고, 그중에서 감독이 매겨 둔
   벤치 순서를 따른다. */
const AI_SUB_FAM_MIN=50;      // 이 아래면 그 자리를 소화한다고 보지 않는다

const AI_POS_FWD={DF:0, MF:1, FW:2};

function subSlotOf(sd, x){
  const t=sd.team;
  return (t && t.tactic && t.tactic.slot && t.tactic.slot[x.p.id]) || null;
}
/* 나갈 자리에 세울 사람 — 그 자리를 볼 수 있는 사람 중 벤치 번호가 빠른 순.
   strict 면 아무도 그 자리를 못 볼 때 아예 넣지 않는다(굳이 안 해도 되는 교체용). */
function subPickIn(sd, outX, extra, strict){
  const cand=sd.bench.filter(p=>p.pos!=="GK" && canEnter(sd, outX, p) && (!extra||extra(p)));
  if(!cand.length) return null;
  const slot=subSlotOf(sd, outX);
  if(!slot) return strict ? null : cand[0];
  const fit=cand.filter(p=>getPosFam(p, slot)>=AI_SUB_FAM_MIN);
  if(fit.length) return fit[0];                          // 벤치 순서 그대로
  if(strict) return null;
  // 아무도 그 자리를 못 보면 그나마 나은 사람 — 열한 명은 채워야 한다
  return cand.slice().sort((a,b)=>getPosFam(b,slot)-getPosFam(a,slot))[0];
}
/* 부상으로 비운 자리 하나를 채운다. 채웠으면 true. */
function aiFillGap(M, sd, key){
  const gap=sd.list.find(x=>x.injGap && x.off!==null && !x.red);
  if(!gap) return false;
  const inP=subPickIn(sd, gap);
  if(!inP){ gap.injGap=false; return false; }   // 채울 사람이 없다 — 다시 보지 않는다
  /* injGap 은 subIn **뒤에** 내린다. 먼저 내리면 subIn 의 '이미 나간 선수를 또 빼는가'
     가드(outX.off!==null && !outX.injGap)에 걸려 교체가 조용히 실패한다. */
  const ok=!!subIn(M, sd, key, gap, inP);
  gap.injGap=false;
  return ok;
}
/* 한 명만 바꾼다. 바꿨으면 true. */

function aiSubOnce(M, sd, key, diff, m){
  const pitch=onPitch(sd).filter(x=>x.p.pos!=="GK" && !x.red);
  if(pitch.length<8) return false;                       // 이미 수적 열세면 더 빼지 않는다
  const bench=sd.bench.filter(p=>p.pos!=="GK");
  if(!bench.length) return false;
  // 이 팀의 기둥 — 웬만해선 빼지 않는다
  const core=[...pitch].sort((a,b)=>b.p.ovr-a.p.ovr).slice(0,2).map(x=>x.p.id);
  const protectedOut=x=>core.indexOf(x.p.id)>=0 && x.fit>=AI_SUB_URGENT;
  const tryPair=(outX, extra, strict)=>{
    if(!outX || protectedOut(outX)) return false;
    const inP=subPickIn(sd, outX, extra, strict);
    return !!(inP && subIn(M, sd, key, outX, inP));
  };
  // ① 경고 + 피로 — 퇴장 나기 전에 뺀다
  const risky=pitch.filter(x=>x.y>0 && x.fit<72 && !protectedOut(x)).sort((a,b)=>a.fit-b.fit)[0];
  if(risky && tryPair(risky)) return true;
  // ② 체력이 무너진 선수
  const tired=pitch.filter(x=>x.fit<AI_SUB_TIRED && (!protectedOut(x)||x.fit<AI_SUB_URGENT))
                   .sort((a,b)=>a.fit-b.fit)[0];
  if(tired && tryPair(tired)) return true;
  /* ③ 지고 있다 — 앞으로 민다. 뒷선 자리 가운데 "그 자리를 볼 수 있으면서 더 공격적인"
       자원이 벤치에 있는 자리를 바꾼다. 원본처럼 수비수를 빼고 무조건 공격수를 넣으면
       그 공격수가 수비 자리를 물려받아, 지고 있는 팀이 오히려 약해졌다. */
  if(diff<0 && m>=58){
    const back=pitch.filter(x=>x.p.pos!=="FW")
                    .sort((a,b)=>(a.p.ovr+a.fit*0.3)-(b.p.ovr+b.fit*0.3));
    for(const outX of back)
      if(tryPair(outX, p=>(AI_POS_FWD[p.pos]||1)>(AI_POS_FWD[outX.p.pos]||1), true)) return true;
  }
  // ④ 이기고 있다 — 문을 닫는다. 같은 요령으로 앞선 자리를 더 수비적인 자원으로.
  if(diff>0 && m>=73){
    const front=pitch.filter(x=>x.p.pos!=="DF").sort((a,b)=>a.fit-b.fit);
    for(const outX of front)
      if(tryPair(outX, p=>(AI_POS_FWD[p.pos]||1)<(AI_POS_FWD[outX.p.pos]||1), true)) return true;
  }
  // ⑤ 그 밖에는 확실한 업그레이드가 있을 때만 (벤치가 더 좋고, 나갈 선수는 지쳐 있을 때)
  if(m>=66){
    for(const outX of [...pitch].sort((a,b)=>a.fit-b.fit)){
      if(outX.fit>=78) continue;
      if(tryPair(outX, p=>p.ovr>outX.p.ovr+2, true)) return true;
    }
  }
  return false;
}
""",  # find 와 짝을 맞춘다 — 여기서 줄 수가 달라지면 원본 구조가 흐트러진다
  ),

  dict(
    id="SUB-02",
    kind="버그",
    why="부상으로 빈 자리를 45분 전에는 아예 보지 않는다 — 전반에 다치면 남은 시간을 열 명으로 뛴다",
    count=1,
    find=(
      "    this._subMin=m;\n"
      "    if(m<45) return;\n"
      "    this.syncClock();\n"
      "    aiSubs(this.M, m);\n"
    ),
    repl=(
      "    this._subMin=m;\n"
      "    this.syncClock();\n"
      "    // [KMD26 SUB-02] 45분 전에도 부른다 — 부상으로 빈 자리는 교체 창을 기다리지 않는다\n"
      "    aiSubs(this.M, m);\n"
    ),
  ),

  dict(
    id="SUB-03",
    kind="버그",
    why="부상 교체가 다음 '분'까지 밀린다 — 실려 나간 뒤 최대 1분을 열 명으로 뛴다",
    count=1,
    find=(
      "      this.agents=this.agents.filter(z=>z.id!==a.id);\n"
      "      const nm=a.p?a.p.name:\"선수\";\n"
      "      this.say(a.side, `🚑 ${nm} 선수, 더 이상 뛸 수 없습니다. (약 ${wks}주 결장 예상)`, \"warn\");\n"
    ),
    repl=(
      "      this.agents=this.agents.filter(z=>z.id!==a.id);\n"
      "      const nm=a.p?a.p.name:\"선수\";\n"
      "      this.say(a.side, `🚑 ${nm} 선수, 더 이상 뛸 수 없습니다. (약 ${wks}주 결장 예상)`, \"warn\");\n"
      "      /* [KMD26 SUB-03] 빈 자리를 **그 자리에서** 채운다.\n"
      "         subCheck() 는 분이 바뀔 때 한 번만 도므로(this._subMin), 실려 나간 뒤\n"
      "         다음 분까지 최대 1분을 열 명으로 뛰었다. 실측: 72분 부상 → 73분 교체.\n"
      "         재생 화면에서 그 구간에 결정적 장면이 걸리면 열 명이 한참 보인다.\n"
      "         ⚠ 난수를 쓰지 않는 경로만 부른다(aiFillGap → subPickIn 은 벤치 순서·자리\n"
      "           능숙도만 본다). 창(AI_SUB_WINDOWS) 교체는 여기서 건드리지 않는다 —\n"
      "           그건 aiSubs 가 분 경계에서 하던 대로 한다.\n"
      "         ⚠ 감독이 사람인 팀(isUser)은 손대지 않는다. 아래에서 물어본다. */\n"
      "      const _sd=this.rec(a.side);\n"
      "      if(!_sd.team.isUser){\n"
      "        while(_sd.subs<5 && aiFillGap(this.M, _sd, a.side)) ;\n"
      "        if(this.M.subQueue && this.M.subQueue.length) this.resyncSquads();\n"
      "      }\n"
    ),
  ),

]

raw = io.open(SRC, encoding="utf-8").read()
rawhash = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]

code = raw
applied = []
skipped = []
for p in PATCHES:
    # 꺼 둔 패치도 앵커는 검사한다 — 원본이 갱신되면 여기서 알아차려야 한다
    n = code.count(p["find"])
    if n != p["count"]:
        sys.exit(
            "중단: 패치 %s 가 %d 곳에 걸렸습니다 (기대: %d).\n"
            "  원본이 갱신돼 해당 코드가 달라졌을 수 있습니다. 손으로 확인하고 find 를 고치세요.\n"
            "  대상: %s" % (p["id"], n, p["count"], p["why"])
        )
    if p.get("off"):
        skipped.append(p)
        continue
    code = code.replace(p["find"], p["repl"])
    applied.append(p)

# 헤더 한 줄 뒤에 패치 내역을 끼워 넣는다 — 파일만 열어도 무엇이 손대졌는지 보이게
mark = "   ───────────────────────────────────────────────────────────── */\n"
i = code.find(mark)
if i < 0:
    sys.exit("중단: 커널 헤더를 찾지 못했습니다. 추출기 헤더 형식이 바뀌었나요?")
note = (
    "\n   ── 듀얼 패치 (tools/patch_kernel.py) ─────────────────────────\n"
    "   원본(kernel.raw.js) 해시: sha256:%s\n" % rawhash
    + "".join("   · [%s] %-9s %s\n" % (p["kind"], p["id"], p["why"]) for p in applied)
    + ("".join("   · [보류] %-9s %s\n" % (p["id"], p["why"]) for p in skipped) if skipped else "")
    + "   ⚠ 듀얼 고유 규칙(파울 누적·퇴장 체력)은 여기가 아니라 src/engine/rules.js 에 있습니다.\n"
)
code = code[:i] + note + code[i:]

io.open(OUT, "w", encoding="utf-8").write(code)
print("OK %d patches applied -> %s" % (len(applied), OUT))
for p in applied:
    print("   [%s] %s  %s" % (p["kind"], p["id"], p["why"]))
for p in skipped:
    print("   [보류] %s  %s" % (p["id"], p["why"]))
