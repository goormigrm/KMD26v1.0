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
    why="크로스 판단 문턱이 팀 '폭'을 읽지 않는다 — 폭은 자리만 벌리고 판단은 안 바꿨다",
    count=1,
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

]

raw = io.open(SRC, encoding="utf-8").read()
rawhash = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]

code = raw
applied = []
for p in PATCHES:
    n = code.count(p["find"])
    if n != p["count"]:
        sys.exit(
            "중단: 패치 %s 가 %d 곳에 걸렸습니다 (기대: %d).\n"
            "  원본이 갱신돼 해당 코드가 달라졌을 수 있습니다. 손으로 확인하고 find 를 고치세요.\n"
            "  대상: %s" % (p["id"], n, p["count"], p["why"])
        )
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
    + "".join("   · [%s] %-7s %s\n" % (p["kind"], p["id"], p["why"]) for p in applied)
    + "   ⚠ 듀얼 고유 규칙(파울 누적·퇴장 체력)은 여기가 아니라 src/engine/rules.js 에 있습니다.\n"
)
code = code[:i] + note + code[i:]

io.open(OUT, "w", encoding="utf-8").write(code)
print("OK %d patches applied -> %s" % (len(applied), OUT))
for p in applied:
    print("   [%s] %s  %s" % (p["kind"], p["id"], p["why"]))
