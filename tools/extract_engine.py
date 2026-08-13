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
import io, json, sys, hashlib
import jsclosure as J

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

src, js, base = J.read_script(SRC)
body, start = J.collect_decls(js)

seen = J.closure(body, ["MatchSim"], STUB, EXCLUDE)
order, code = J.emit(body, start, seen)

# ── 단계 2: 난수 시드화 ──────────────────────────────────────
# 두 사람이 같은 경기를 보려면 엔진 안의 모든 무작위가 하나의 시드에서 나와야 한다.
#   · 사전 검사에서 문자열·주석 안에는 한 건도 없음을 확인했으므로 단순 치환이 안전하다
#   · 괄호 없는 참조(Math.random 을 함수로 넘기는 형태)가 있으면 중단한다
code, RNG_SITES = J.seed_random(code, "커널")

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
           "MATCH_CLOCK_SCALE", "TAC_KEYS", "TAC_DEF", "SLOT_XY", "refCrewOf", "COMM", "onPitch",
           "slotRating", "ovrStarVal", "playerLevel"]
exports = [e for e in exports if e in seen]
tail = "\n\nexport {\n  " + ",\n  ".join(exports) + "\n};\n"

io.open(OUT, "w", encoding="utf-8").write(hdr + code + tail)

meta = {"srcHash": srchash, "declCount": len(order), "lineCount": code.count("\n"),
        "exports": exports, "excluded": sorted(EXCLUDE), "stubbed": sorted(STUB),
        "order": [{"name": n, "srcLine": start[n] + base} for n in order]}
io.open(OUT + ".meta.json", "w", encoding="utf-8").write(json.dumps(meta, ensure_ascii=False, indent=1))
print("OK %d decls, %d lines -> %s" % (len(order), code.count("\n"), OUT))
