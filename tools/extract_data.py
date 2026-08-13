# -*- coding: utf-8 -*-
"""
KM26 v2.0 index.html -> 선수 생성기 추출 (단계 4)

왜 "데이터"가 아니라 "생성기"를 뽑는가
--------------------------------------
원본 index.html 안에 선수 능력치가 통째로 들어 있지는 않습니다.
들어 있는 건 세 가지 표뿐입니다.

  D1        K리그1 12개 구단 — 손으로 매긴 ovr 이 있는 명단
  D2        K리그2 17개 구단 — 팀 수준(base)과 간판 선수 몇 명
  ROSTER26  29개 구단 실제 등록 명단 1,024명 — 이름·포지션·생년월일·등번호·키·몸무게
            (능력치는 없다)

세부 능력치 40여 종은 `mkPlayer()` 가 ovr·포지션·나이·키를 근거로 **만들어 냅니다.**
그 안에 포지션 특화·나이 감쇠·신장 보정·특성 추첨이 겹겹이 들어 있어서,
다른 언어로 옮겨 적으면 반드시 어딘가 어긋납니다. KM26 화면과 값이 달라지면
"같은 선수"가 아니게 되고, 단계 4의 검토 기준 자체가 무너집니다.

그래서 옮겨 적지 않고 **원본 함수를 그대로 뽑아 한 번 돌립니다.**
엔진 커널을 뽑을 때 쓴 방법과 같습니다. 난수만 시드로 묶으면 결과가 고정됩니다.

    python tools/extract_data.py <원본 index.html> src/data/gen.js
    → tools/gendata.html 을 열어 버튼을 누르면 data/*.json 이 떨어집니다

사용: python extract_data.py <원본 index.html> <출력 gen.js>
"""
import io, json, sys, hashlib
import jsclosure as J

SRC = sys.argv[1] if len(sys.argv) > 1 else "index.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/data/gen.js"

# 뿌리 — 여기서 시작해 필요한 것만 따라간다.
# 표 세 개는 함수가 인자로 받으므로 참조 그래프에 안 걸린다. 직접 넣어 준다.
ROOTS = ["mkTeam", "D1", "D2", "ROSTER26", "PLAYER_TWEAK", "PREF_POS_OVERRIDE", "CUR_YEAR",
         # 화면에 쓸 이름표도 원본에서 가져온다 — 한글 라벨을 UI 에 베껴 두면 원본과 어긋난다
         "ATTR_LABEL_FM", "FAM_LABEL", "FAM_POS", "TRAITS",
         "TECH_ORDER", "MENT_ORDER", "PHYS_ORDER", "GK_ORDER"]

# 탐색을 멈출 지점 — 시즌 상태·UI·저장. 선수를 만드는 데는 필요 없다.
STUB = set("""G userTeam saveGame addNews notify flash gameAlert showConfirm show refreshTactics
adjustTrust socialFill fmkFill rivalFill rivalFmk renewSocial loanSocial staffLog addMood
famK refBias teamOVR xiStrength matchBench bestXI ensureAIRoles stadOf attendanceFor
tfLogAdd devSnapshot armyAttach joinClub gainPosFam slotRating""".split())

EXCLUDE = set("""home nextOpponent staffOpt nextFriendly calOpenDate dateOfDay matchDayOf
tableOf isSellout attEstimate DOW_KR""".split())

# ─────────────────────────────────────────────────────────────
# 듀얼 패치 — 설계 결정을 데이터에 반영한다.
# 패치기(patch_kernel.py)와 같은 규칙: 걸린 횟수를 못박고, 빗나가면 중단한다.
# ─────────────────────────────────────────────────────────────
PATCHES = [
  dict(
    id="D2-01",
    why="estimateOvr 의 ±3 난수 제거 — 대전에서 같은 선수가 판마다 다른 능력치면 성립하지 않는다 (설계 결정 D-2)",
    count=1,
    # R(7) 은 0~6 균등이므로 (R(7)-3) 의 기대값은 정확히 0이다. 그냥 빼면 기대값 고정이 된다.
    find="  const v = base + ageAdj + noAdj + (frn?3:0) + (R(7)-3);\n",
    repl="  const v = base + ageAdj + noAdj + (frn?3:0);   // [KMD26 D-2] (R(7)-3) 제거 — 기대값 0\n",
  ),
]

src, js, base = J.read_script(SRC)
body, start = J.collect_decls(js)

missing = [r for r in ROOTS if r not in body]
if missing:
    sys.exit("중단: 뿌리 선언을 찾지 못했습니다 — %s" % ", ".join(missing))

seen = J.closure(body, ROOTS, STUB, EXCLUDE)
order, code = J.emit(body, start, seen)

code, applied = J.apply_patches(code, PATCHES, "데이터 패치")
code, RNG_SITES = J.seed_random(code, "생성기")

srchash = hashlib.sha256(src.encode("utf-8")).hexdigest()[:12]
hdr = (
    "/* ─────────────────────────────────────────────────────────────\n"
    "   KMD26 선수 생성기 — 자동 생성 파일. 직접 수정하지 마세요.\n"
    "   생성: tools/extract_data.py\n"
    "   원본: KM26 v2.0 (KleagueM2026/KM26v2.0) — 원저작자 허락 하에 사용\n"
    "   원본 해시: sha256:%s\n"
    "   추출 선언 %d개 / %d줄\n"
    "   난수 시드화: Math.random() %d곳 → RNG()\n"
    "\n"
    "   ── 듀얼 패치 ─────────────────────────────────────────────\n"
    % (srchash, len(order), code.count("\n"), RNG_SITES)
    + "".join("   · %s  %s\n" % (p["id"], p["why"]) for p in applied)
    + "   ⚠ 이 파일을 직접 부르지 마세요. tools/gendata.html 이 한 번만 돌려 JSON 을 만듭니다.\n"
    "   ───────────────────────────────────────────────────────────── */\n"
    'import { RNG } from "../engine/rng.js";\n\n'
)

exports = ["mkTeam", "D1", "D2", "ROSTER26", "PLAYER_TWEAK", "PREF_POS_OVERRIDE", "CUR_YEAR",
           "ATTR_LABEL_FM", "FAM_LABEL", "FAM_POS", "TRAITS",
           "TECH_ORDER", "MENT_ORDER", "PHYS_ORDER", "GK_ORDER"]
exports = [e for e in exports if e in seen]
tail = "\n\nexport {\n  " + ",\n  ".join(exports) + "\n};\n"

io.open(OUT, "w", encoding="utf-8").write(hdr + code + tail)

meta = {"srcHash": srchash, "declCount": len(order), "lineCount": code.count("\n"),
        "rngSites": RNG_SITES, "exports": exports,
        "patches": [{"id": p["id"], "why": p["why"]} for p in applied],
        "order": [{"name": n, "srcLine": start[n] + base} for n in order]}
io.open(OUT + ".meta.json", "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=1))

print("OK %d decls, %d lines, RNG %d곳 -> %s" % (len(order), code.count("\n"), RNG_SITES, OUT))
for p in applied:
    print("   %s  %s" % (p["id"], p["why"]))
