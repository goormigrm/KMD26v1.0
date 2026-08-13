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
# 패치 목록 — 전부 KM26 원본 버그. 듀얼 고유 규칙은 여기 넣지 않는다.
#   id     : 로그·헤더에 찍히는 식별자
#   why    : 무엇이 잘못됐는지 (한 줄)
#   find   : 원본에서 찾을 문자열 (정규식 아님 — 문자 그대로)
#   repl   : 바꿔 넣을 문자열
#   count  : 걸려야 하는 횟수. 다르면 중단한다.
# ─────────────────────────────────────────────────────────────
PATCHES = [

  dict(
    id="PK-01",
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
    why="PK 득점이 VAR 로 취소된다. PK 는 오프사이드도 빌드업 반칙도 있을 수 없다 (분 단위 엔진에는 isPen 가드가 있다)",
    count=1,
    find="        if(this.emitEvents && RNG()<VAR_CHECK_P){\n",
    repl="        if(this.emitEvents && !sh.isPen && RNG()<VAR_CHECK_P){   // [KMD26 PK-02] PK 골은 판독 대상이 아니다\n",
  ),

  dict(
    id="PK-03",
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
    + "".join("   · %s  %s\n" % (p["id"], p["why"]) for p in applied)
    + "   ⚠ 듀얼 고유 규칙(파울 누적·퇴장 체력)은 여기가 아니라 src/engine/rules.js 에 있습니다.\n"
)
code = code[:i] + note + code[i:]

io.open(OUT, "w", encoding="utf-8").write(code)
print("OK %d patches applied -> %s" % (len(applied), OUT))
for p in applied:
    print("   %s  %s" % (p["id"], p["why"]))
