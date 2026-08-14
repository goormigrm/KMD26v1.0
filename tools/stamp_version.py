# -*- coding: utf-8 -*-
"""배포용 버전 도장 — 모듈 주소에 ?v=<해시> 를 박는다.

── 왜 필요한가 ────────────────────────────────────────────────
`data/*.json` 은 화면이 `?v=<dataHash>` 를 붙여 받으므로 데이터가 바뀌면 자동으로 새로
받습니다. 그런데 **엔진·화면 스크립트에는 그런 장치가 없어서**, 새로 배포해도 브라우저가
옛 모듈을 그대로 쓰는 일이 생깁니다. 실제로 이 프로젝트에서 여러 번 겪었습니다
(고친 코드가 반영되지 않아 한참 헤맴). GitHub Pages 는 응답 헤더를 우리가 정할 수 없으니
**주소를 바꾸는 것**이 유일한 방법입니다.

── 무엇을 하는가 ──────────────────────────────────────────────
`src/**/*.js` 내용으로 짧은 해시를 만들고, 다음 자리의 주소에 `?v=<해시>` 를 붙입니다.

  · HTML 안 `import … from "./src/…js"`      (화면이 모듈을 처음 불러오는 자리)
  · 모듈 안 `import … from "./x.js"`          (모듈끼리 서로 부르는 자리 — 여기가 핵심)
  · `new Worker("src/engine/matchworker.js")` (일꾼)
  · 동적 `import("…js")`

⚠ 해시는 **`?v=` 를 모두 걷어낸 내용**으로 계산합니다. 그래야 몇 번 돌려도 같은 값이 나옵니다
  (도장을 찍은 결과로 해시가 또 바뀌면 영원히 끝나지 않습니다).

사용: python tools/stamp_version.py            (저장소 루트에서)
      python tools/stamp_version.py --strip    (도장을 걷어낸다)
"""
import hashlib
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ["index.html", "lineup.html", "match.html", "board.html", "record.html", "squad.html",
         # KM26 갈래 — 세이브에서 가져온 명단으로 붙는 화면들
         # ⚠ km-board.html 은 왼쪽 바에 없지만(라인업 안으로 들어갔다) 직접 주소로 열리므로 함께 찍는다
         "km-lineup.html", "km-match.html", "km-record.html", "km-board.html"]

# 도장을 찍을 자리 — 상대 주소로 끝나는 .js 만 (남의 서버 주소는 건드리지 않는다)
PATTERNS = [
    # import … from "…js"  /  export … from "…js"
    re.compile(r'((?:from|import)\s*\(?\s*["\'])((?:\./|\.\./|/|src/)[^"\']+?\.js)((?:\?v=[0-9a-f]+)?)(["\'])'),
    # new Worker("…js")
    re.compile(r'(new\s+Worker\s*\(\s*["\'])((?:\./|\.\./|/|src/)[^"\']+?\.js)((?:\?v=[0-9a-f]+)?)(["\'])'),
]

STRIP = re.compile(r'((?:\./|\.\./|/|src/)[^"\']+?\.js)\?v=[0-9a-f]+')


def js_files():
    out = []
    for base, _dirs, files in os.walk(os.path.join(ROOT, "src")):
        for f in sorted(files):
            if f.endswith(".js"):
                out.append(os.path.join(base, f))
    return sorted(out)


def read(p):
    return io.open(p, encoding="utf-8", newline="").read()


def write(p, s):
    io.open(p, "w", encoding="utf-8", newline="").write(s)


def version():
    """src/**/*.js 의 내용으로 짧은 해시. ?v= 는 걷어내고 계산한다(멱등).

    ⚠ 줄바꿈을 LF 로 맞춘 뒤 해시한다. git 이 `core.autocrlf` 설정에 따라 받아쓰기를
      바꾸므로, 안 맞추면 **PC 마다 다른 값**이 나온다 — 코드는 한 글자도 안 바뀌었는데
      다른 PC 에서 받아 도장을 찍는 순간 박힌 곳이 통째로 갈린다.
      (실제로 겪었다: 같은 커밋에서 c757310e91 ↔ 914b21cf31)
      쓸 때는 맞추지 않는다(`write` 는 newline="") — 도장이 파일의 줄바꿈까지
      바꿔 버리면 diff 가 통째로 뒤집힌다."""
    h = hashlib.sha256()
    for p in js_files():
        h.update(os.path.relpath(p, ROOT).replace("\\", "/").encode("utf-8"))
        body = STRIP.sub(r"\1", read(p)).replace("\r\n", "\n").replace("\r", "\n")
        h.update(body.encode("utf-8"))
    return h.hexdigest()[:10]


def stamp(text, ver):
    n = 0

    def sub(m):
        nonlocal n
        n += 1
        tail = "" if ver is None else "?v=" + ver
        return m.group(1) + m.group(2) + tail + m.group(4)

    for pat in PATTERNS:
        text = pat.sub(sub, text)
    return text, n


def main():
    strip = "--strip" in sys.argv
    ver = None if strip else version()
    total = 0
    targets = [os.path.join(ROOT, p) for p in PAGES] + js_files()
    for p in targets:
        s = read(p)
        out, n = stamp(s, ver)
        if out != s:
            write(p, out)
        total += n
    print("%s %d곳%s" % ("걷어냄" if strip else "도장", total,
                         "" if strip else "  버전 " + ver))


if __name__ == "__main__":
    main()
