# -*- coding: utf-8 -*-
"""
KM26 index.html 에서 "필요한 선언만" 뽑아내는 공용 도구

엔진 추출기(extract_engine.py)와 데이터 추출기(extract_data.py)가 같이 씁니다.
손으로 고르면 반드시 빠지므로, 뿌리에서 시작해 **의존성 폐포**를 계산합니다.

원리
----
1. 최상위 선언(function/class/const/let/var)을 줄 단위로 잘라 이름 → 본문으로 모은다
2. 뿌리(root)에서 시작해 본문에 나오는 식별자를 따라간다
3. STUB 에 걸리면 거기서 멈춘다 — 전역 상태·UI 는 런타임에서 대신 준다

⚠ 2번에서 주석·문자열·`.프로퍼티명`을 먼저 지워야 합니다.
  안 그러면 주석 속 단어까지 식별자로 잡혀 파일 전체가 딸려 옵니다 (실제로 겪었습니다).
"""
import re

BLOCK = re.compile(r'/\*.*?\*/', re.S)
LINEC = re.compile(r'//[^\n]*')
TPL   = re.compile(r'`(?:\\.|[^`\\])*`', re.S)
DQ    = re.compile(r'"(?:\\.|[^"\\])*"')
SQ    = re.compile(r"'(?:\\.|[^'\\])*'")
PROP  = re.compile(r'\.\s*([A-Za-z_$][\w$]*)')
DECL  = re.compile(r'^(?:async\s+)?(function|class|const|let|var)\s+([A-Za-z_$][\w$]*)')
IDENT = re.compile(r'\b([A-Za-z_$][\w$]*)\b')

KW = set("""var let const function class return if else for while do switch case break continue new
typeof instanceof in of this null true false undefined try catch finally throw delete void
await async get set static extends super Math JSON Object Array String Number Boolean Date
Map Set Promise Error console window document parseInt parseFloat isNaN Infinity NaN""".split())


def strip_noise(s):
    """식별자 스캔 전에 주석·문자열·프로퍼티명을 지운다."""
    for r, x in ((BLOCK, ' '), (LINEC, ' '), (TPL, '""'), (DQ, '""'), (SQ, '""'), (PROP, ' ')):
        s = r.sub(x, s)
    return s


def read_script(path):
    """index.html 에서 <script> 본문과 그 시작 줄 번호를 꺼낸다."""
    src = open(path, encoding="utf-8").read()
    m = re.search(r'<script>(.*)</script>', src, re.S)
    if not m:
        raise SystemExit("중단: <script> 블록을 찾지 못했습니다 — %s" % path)
    return src, m.group(1), src[:m.start(1)].count("\n") + 1


def collect_decls(js):
    """최상위 선언을 이름 → 본문 / 이름 → 시작줄 로 모은다."""
    L = js.split("\n")
    decls = []
    for i, ln in enumerate(L):
        mm = DECL.match(ln)
        if mm:
            decls.append((mm.group(2), i))
    body, start = {}, {}
    for j, (nm, i) in enumerate(decls):
        end = decls[j + 1][1] if j + 1 < len(decls) else len(L)
        body[nm] = body.get(nm, "") + "\n".join(L[i:end]).rstrip() + "\n"
        start.setdefault(nm, i)
    return body, start


def closure(body, roots, stub=(), exclude=()):
    """뿌리에서 시작한 의존성 폐포. STUB·EXCLUDE 에서 탐색을 멈춘다."""
    stub, exclude = set(stub), set(exclude)
    seen, stack = set(), list(roots)
    while stack:
        n = stack.pop()
        if n in seen or n in stub or n in exclude or n not in body:
            continue
        seen.add(n)
        for r in IDENT.findall(strip_noise(body[n])):
            if r in body and r not in KW and r not in seen:
                stack.append(r)
    return seen


def emit(body, start, names):
    """원본에 나온 순서 그대로 이어 붙인다 — 선언 순서가 곧 실행 순서다."""
    order = sorted(names, key=lambda x: start[x])
    return order, "\n".join(body[n] for n in order)


def seed_random(code, label="추출본"):
    """Math.random() 을 시드 난수 RNG() 로 바꾼다. 빠지면 재현이 깨지므로 엄격하게 센다."""
    bare = len(re.findall(r'Math\.random(?!\s*\()', code))
    if bare:
        raise SystemExit("중단: %s 에 괄호 없는 Math.random 참조 %d건. 수동 확인 필요." % (label, bare))
    n = len(re.findall(r'Math\.random\(\)', code))
    code = code.replace("Math.random()", "RNG()")
    left = len(re.findall(r'Math\.random', code))
    if left:
        raise SystemExit("중단: 치환 후에도 Math.random 이 %d건 남음." % left)
    return code, n


def apply_patches(code, patches, label="패치"):
    """
    문자 그대로 찾아 바꾸되, 걸린 횟수를 못박는다.
    원본이 갱신돼 문구가 달라지면 조용히 건너뛰는 대신 즉시 멈춘다 —
    안 걸린 패치를 모르고 지나가는 게 제일 위험하다.
    """
    applied = []
    for p in patches:
        n = code.count(p["find"])
        if n != p["count"]:
            raise SystemExit(
                "중단: %s %s 가 %d 곳에 걸렸습니다 (기대: %d).\n  대상: %s"
                % (label, p["id"], n, p["count"], p["why"])
            )
        code = code.replace(p["find"], p["repl"])
        applied.append(p)
    return code, applied
