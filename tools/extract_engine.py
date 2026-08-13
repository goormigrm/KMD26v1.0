# -*- coding: utf-8 -*-
"""
KM26 v2.0 index.html -> KMD26 엔진 커널 추출기 (단계 1)

MatchSim 의존성 폐포를 계산해 원본 순서 그대로 뽑아낸다.
UI/달력 클러스터는 제외하고, 전역 상태(G)는 런타임 스텁으로 대체한다.

이 파일이 만드는 건 "원본 그대로"입니다. 듀얼용 버그 수정은 다음 단계에서 붙습니다.

    python tools/extract_engine.py <원본 index.html> src/engine/kernel.raw.js
    python tools/patch_kernel.py   src/engine/kernel.raw.js src/engine/kernel.js

사용: python extract_engine.py <원본 index.html> <출력 kernel.raw.js>
"""
import re, io, json, sys, hashlib

SRC = sys.argv[1] if len(sys.argv) > 1 else "KM26v2/new.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/engine/kernel.raw.js"

# 폐포 탐색을 멈출 지점 — 전역 상태·UI·시즌 누적값
STUB = set("""G userTeam saveGame addNews notify flash gameAlert showConfirm show refreshTactics
adjustTrust socialFill fmkFill rivalFill rivalFmk renewSocial loanSocial staffLog addMood
famK refBias teamOVR xiStrength matchBench bestXI ensureAIRoles stadOf attendanceFor
tfLogAdd devSnapshot armyAttach joinClub gainPosFam""".split())

# 폐포에 딸려 왔으나 엔진과 무관한 것 (오탐: 객체 리터럴 키 등)
EXCLUDE = set("""home nextOpponent staffOpt nextFriendly calOpenDate dateOfDay matchDayOf
tableOf isSellout attEstimate DOW_KR""".split())

BLOCK = re.compile(r'/\*.*?\*/', re.S); LINEC = re.compile(r'//[^\n]*')
TPL = re.compile(r'`(?:\\.|[^`\\])*`', re.S)
DQ = re.compile(r'"(?:\\.|[^"\\])*"'); SQ = re.compile(r"'(?:\\.|[^'\\])*'")
PROP = re.compile(r'\.\s*([A-Za-z_$][\w$]*)')
def clean(s):
    for r, x in ((BLOCK, ' '), (LINEC, ' '), (TPL, '""'), (DQ, '""'), (SQ, '""'), (PROP, ' ')):
        s = r.sub(x, s)
    return s

src = open(SRC, encoding="utf-8").read()
m = re.search(r'<script>(.*)</script>', src, re.S)
js = m.group(1); base = src[:m.start(1)].count("\n") + 1
L = js.split("\n")

DECL = re.compile(r'^(?:async\s+)?(function|class|const|let|var)\s+([A-Za-z_$][\w$]*)')
decls = []
for i, ln in enumerate(L):
    mm = DECL.match(ln)
    if mm: decls.append((mm.group(2), i))

body, start = {}, {}
for j, (nm, i) in enumerate(decls):
    end = decls[j + 1][1] if j + 1 < len(decls) else len(L)
    body[nm] = body.get(nm, "") + "\n".join(L[i:end]).rstrip() + "\n"
    start.setdefault(nm, i)

IDENT = re.compile(r'\b([A-Za-z_$][\w$]*)\b')
KW = set("""var let const function class return if else for while do switch case break continue new
typeof instanceof in of this null true false undefined try catch finally throw delete void
await async get set static extends super Math JSON Object Array String Number Boolean Date
Map Set Promise Error console window document parseInt parseFloat isNaN Infinity NaN""".split())

seen, stack = set(), ["MatchSim"]
while stack:
    n = stack.pop()
    if n in seen or n in STUB or n in EXCLUDE or n not in body: continue
    seen.add(n)
    for r in IDENT.findall(clean(body[n])):
        if r in body and r not in KW and r not in seen:
            stack.append(r)

order = sorted(seen, key=lambda x: start[x])
parts = [body[n] for n in order]
code = "\n".join(parts)

# ── 단계 2: 난수 시드화 ──────────────────────────────────────
# 두 사람이 같은 경기를 보려면 엔진 안의 모든 무작위가 하나의 시드에서 나와야 한다.
#   · 사전 검사에서 문자열·주석 안에는 한 건도 없음을 확인했으므로 단순 치환이 안전하다
#   · 괄호 없는 참조(Math.random 을 함수로 넘기는 형태)가 있으면 중단한다
bare = len(re.findall(r'Math\.random(?!\s*\()', code))
if bare:
    sys.exit("중단: 괄호 없는 Math.random 참조 %d건. 수동 확인 필요." % bare)
RNG_SITES = len(re.findall(r'Math\.random\(\)', code))
code = code.replace("Math.random()", "RNG()")
left = len(re.findall(r'Math\.random', code))
if left:
    sys.exit("중단: 치환 후에도 Math.random 이 %d건 남음." % left)

srchash = hashlib.sha256(src.encode("utf-8")).hexdigest()[:12]
hdr = (
    "/* ─────────────────────────────────────────────────────────────\n"
    "   KMD26 엔진 커널 — 자동 생성 파일. 직접 수정하지 마세요.\n"
    "   생성: tools/extract_engine.py\n"
    "   원본: KM26 v2.0 (KleagueM2026/KM26v2.0) — 원저작자 허락 하에 사용\n"
    "   원본 해시: sha256:%s\n"
    "   추출 선언 %d개 / %d줄\n"
    "   난수 시드화: Math.random() %d곳 → RNG()\n"
    "   ⚠ 전역 상태(G)·UI 함수는 src/engine/stubs.js 가 제공합니다.\n"
    "   ⚠ 이건 원본 그대로입니다. 듀얼 버그 수정은 tools/patch_kernel.py 가 붙입니다.\n"
    "   ───────────────────────────────────────────────────────────── */\n"
    'import { RNG } from "./rng.js";\n\n'
) % (srchash, len(order), code.count("\n"), RNG_SITES)

exports = ["MatchSim", "matchSkills", "TAC", "getPosFam", "initPosFam", "canonSlot",
           "computeFormationPositions", "computeRenderSlots", "FORMATION_SHAPE", "SLOT_FAM",
           "FAM_NEAR", "FAM_POS", "ROLES", "ROLE_BY_KEY", "TRAITS", "SIM_SECONDS", "SIM_DT",
           "MATCH_CLOCK_SCALE", "TAC_KEYS", "TAC_DEF", "SLOT_XY", "refCrewOf", "COMM", "onPitch"]
exports = [e for e in exports if e in seen]
tail = "\n\nexport {\n  " + ",\n  ".join(exports) + "\n};\n"

io.open(OUT, "w", encoding="utf-8").write(hdr + code + tail)

meta = {"srcHash": srchash, "declCount": len(order), "lineCount": code.count("\n"),
        "exports": exports, "excluded": sorted(EXCLUDE), "stubbed": sorted(STUB),
        "order": [{"name": n, "srcLine": start[n] + base} for n in order]}
io.open(OUT + ".meta.json", "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=1))
print("OK %d decls, %d lines -> %s" % (len(order), code.count("\n"), OUT))
