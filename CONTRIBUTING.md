# 고칠 때 지킬 것

> **PC 두 대에서 번갈아 작업합니다.** 한쪽에서 빠뜨리면 다른 쪽에서 조용히 깨집니다.
> 여기 적힌 것만 지키면 됩니다. 배경과 자세한 설명은 [DEVELOPMENT.md](DEVELOPMENT.md) 에 있습니다.

---

## 0. 작업을 시작하기 전에 — 다른 PC 가 밀어 둔 것을 먼저 받는다

**아무것도 고치기 전에** 이 네 줄부터 돌리세요. 순서가 중요합니다.

```bash
git fetch origin && git status -sb && git log --oneline HEAD..origin/main
```

| 나온 것 | 뜻 | 할 일 |
|---|---|---|
| `## main` 만 나옴 | 같다 | 그냥 시작 |
| `behind N` | 다른 PC 가 앞서 있다 | `git pull --ff-only origin main` |
| `ahead N` | 여기만 앞서 있다 | 밀지 않은 것이 있다. 확인 후 푸시 |
| `ahead M, behind N` | **갈라졌다** | 아래 "갈라졌을 때" |

받은 뒤에는 **무엇이 바뀌었는지**를 이 순서로 봅니다.

```bash
git log --oneline HEAD@{1}..HEAD
git diff --stat --ignore-cr-at-eol HEAD@{1}..HEAD
```

- `--ignore-cr-at-eol` 을 꼭 붙이세요. 안 붙이면 줄바꿈 차이 때문에 **파일 전체가 바뀐 것처럼**
  보입니다(1,184줄짜리가 2,663줄 바뀐 것으로 찍힌 적이 있습니다).
- 사람이 읽을 요약은 **[CHANGELOG.md](CHANGELOG.md)** 에 있습니다. 커밋 메시지보다 이걸 먼저 보세요.
- 엔진·데이터가 바뀌었으면 **아래 4번(확인)** 을 한 번 돌려 기준값을 새로 잡으세요.

### 갈라졌을 때

`main` 하나만 씁니다. 갈라졌으면 **받은 쪽 위에 다시 얹으세요.**

```bash
git pull --rebase origin main
```

⚠ 충돌이 `src/**/*.js` 의 `?v=` 줄에서만 났다면 **아무 쪽이나 골라 넘긴 뒤 다시 도장을 찍으면**
됩니다(2번). 그 값은 내용에서 다시 계산되는 것이라 손으로 맞출 필요가 없습니다.

---

## 1. 자동 생성되는 파일 — 손으로 고치지 않는다

| 파일 | 만드는 것 | 원본 |
|---|---|---|
| `src/engine/kernel.raw.js` | `tools/extract_engine.py` | `../km/index.html` (KM26 원본) |
| `src/engine/kernel.js` | `tools/patch_kernel.py` | `kernel.raw.js` + 패치 목록 |
| `src/data/gen.js` | `tools/extract_data.py` | `../km/index.html` |
| `data/*.json` | `tools/gendata` | `src/data/gen.js` |

커널을 고치고 싶으면 **`tools/patch_kernel.py` 에 패치를 추가**합니다. `kernel.js` 를 직접
고치면 다음 재생성에서 통째로 날아갑니다.

```bash
python tools/extract_engine.py "../km/index.html" src/engine/kernel.raw.js
python tools/patch_kernel.py src/engine/kernel.raw.js src/engine/kernel.js
```

> ⚠ **가끔 돌려서 앵커가 아직 맞는지 보세요.** `kernel.js` 는 이미 만들어져 커밋돼 있으므로,
> 앵커가 어긋나도 **다음에 커널을 고칠 때까지 아무도 모릅니다.** 실제로 `SUB-01` 의 앵커가
> 끝의 **빈 줄 하나** 때문에 깨진 채로 있었고, 새 패치를 넣으려는 순간에야 드러났습니다.
> 앵커 끝에 빈 줄을 넣지 마세요 — 원본이 한 줄만 두면 그대로 어긋납니다.

> ⚠ **재생성했으면 `git status` 로 `kernel.js` 가 스테이징됐는지 반드시 확인하세요.**
> 자동 생성 파일이라 `git add <경로>` 로 커밋할 때 자주 빠집니다.
> "고쳤는데 결과가 그대로다" 라고 두 번 헛짚은 원인이 둘 다 이것이었습니다.

---

## 2. 버전 도장 — 배포 전 **마지막에** 찍는다

GitHub Pages 는 응답 헤더를 정할 수 없어서, 브라우저에게 "이 파일 바뀌었다"고 알릴 방법이
**주소를 바꾸는 것**밖에 없습니다. `tools/stamp_version.py` 가 `src/**/*.js` 내용을 해시해
모든 모듈 주소에 `?v=<해시>` 를 박습니다(2026-08-14 기준 29곳).

> ⚠ **새 페이지를 만들었으면 `stamp_version.py` 의 `PAGES` 에 넣으세요.**
> 안 넣으면 그 페이지만 옛 `?v=` 를 든 채로 배포돼, 다른 화면과 **다른 모듈**을 씁니다.
> `board.html` 을 만들 때 실제로 한 번 빠뜨렸습니다.

```bash
python tools/stamp_version.py
```

### 지킬 것 세 가지

**① 순서 — 생성이 먼저, 도장이 나중.**
`patch_kernel.py`·`gendata` 를 돌렸으면 **그다음에** 도장을 찍으세요. 반대로 하면 도장이
낡습니다. 실제로 그런 커밋이 있었습니다(박힌 값 `c757310e91`, 실제 내용 `7640ec1658`).

**② 커밋 직전에 한 번 더 찍고 `git status` 를 본다.**

```bash
python tools/stamp_version.py && git status --short
```

아무것도 안 바뀌면 도장이 맞는 것입니다. 뭔가 바뀌면 **낡아 있었다는 뜻**이니 그대로 커밋에
포함하세요. 해시는 `?v=` 를 걷어낸 내용으로 계산해서 **몇 번을 찍어도 같은 값**이 나옵니다.

**③ 도장이 그대로인데 `src/**/*.js` 가 바뀐 커밋을 만들지 않는다.**
같은 `?v=` 주소로 다른 내용이 배포되면, 그 주소를 캐시한 브라우저는 **옛 코드를 계속 씁니다.**
실제로 `src/data/gen.js` 가 바뀌었는데 도장이 그대로인 커밋이 있었습니다
(`gen.js` 는 어디서도 import 하지 않는 빌드 전용 파일이라 실사용 영향은 없었습니다).

> 📌 해시는 **LF 로 맞춘 뒤** 계산합니다. git 이 `core.autocrlf` 설정에 따라 받아쓰기를
> 바꾸므로, 안 맞추면 **PC 마다 다른 값**이 나옵니다 — 코드가 한 글자도 안 바뀌었는데
> 다른 PC 에서 받아 도장을 찍는 순간 25곳이 통째로 갈립니다.

---

## 3. 선수 데이터를 고칠 때 — **이미 나눠 가진 대전 코드가 막힌다**

대전 코드에는 `data/*.json` **전체**로 계산한 해시가 16비트 박힙니다. 그래서 화면에 띄우는
표시값 하나만 고쳐도 값이 달라지고, 그 전에 발급된 코드가 전부 거부됩니다.

고쳤다면 **명단이 그대로인지** 확인하세요 — 구단별 선수 배열의 **순서 · id · ovr · attr**.
그대로라면 `src/codec/duelcode.js` 의 `DATA_COMPAT` 에 옛 해시를 추가해 옛 코드를 계속 읽게 합니다.

```js
export const DATA_COMPAT = [
  { hash: "847b18feb1dd419b", why: "선수들의 선호 포지션 표시 정정" },
];
```

> ⚠ **한 명이라도 달라졌으면 절대 넣지 마세요.** 조용히 다른 선수가 서는 것이 최악입니다.
> 해시는 16비트만 견주므로 목록이 길어질수록 엉뚱한 코드가 우연히 통과할 확률도 함께 오릅니다.

---

## 4. 확인 — 커밋 전에 돌린다

```bash
python tools/stamp_version.py
cd tools/jscheck   && go run . ../../src ../../index.html ../../lineup.html ../../match.html ../../squad.html
cd tools/codecheck && go run . -root ../..
cd tools/realmatch && go run . -root ../.. -home ulsan -away jeonbuk -record
```

| 도구 | 무엇을 보나 | 못 보는 것 |
|---|---|---|
| `jscheck` | 문법 (goja 로 컴파일만) | 동작 |
| `codecheck` | 대전 코드 규격 144건 (왕복·내용·손상 거부·길이) | 화면 |
| `realmatch` | 진짜 명단으로 90분이 끝까지 도는가 | 화면 |

> ⚠ **goja 도구 세 개는 `export` 누락을 못 잡습니다.** 모듈을 이어 붙이며 import/export 를
>걷어내기 때문입니다. 실제로 셋 다 통과했는데 **경기가 아예 시작되지 않는 상태로 배포**된
> 적이 있습니다(`reactions.js` 가 `import { F_ }` 하는데 `kernel.js` 가 안 내보냄).
> **화면을 건드렸으면 브라우저에서 한 판 돌리세요.**

```bash
python -m http.server 8123
```

→ `http://localhost:8123/match.html` 에서 한 경기 완주 · 콘솔 오류 0건 확인.

### 지문(fingerprint)을 기준값으로 쓸 때

`realmatch` 가 찍는 여덟 자리 지문은 **그 도구 안에서만** 재현됩니다.

- `tools/realmatch` 는 시드를 **라인업 지문(`planSig`)** 에서 뽑습니다.
- 경기 화면(`matchworker`) 은 시드를 **대전 코드 두 개**에서 뽑습니다.

일부러 다릅니다(도구는 코덱·데이터 해시를 들고 오지 않습니다). **두 값을 견주지 마세요.**
선수 데이터나 커널 패치를 바꾸면 지문도 당연히 달라지므로, 그때는 새 값을 기준으로 다시 잡으세요.

---

## 5. 새 엔진 모듈을 만들었다면

1. `tools/realmatch` 와 `tools/simcheck` **양쪽** `modules` 목록에 넣으세요.
   한쪽만 넣어서 `installOrders is not defined` 로 멈춘 적이 있습니다.
2. **파일마다 짧은 전역 이름을 두지 마세요.** goja 도구는 모듈을 이어 붙이므로
   `installed` 같은 이름이 충돌합니다(세 번 겪었습니다 — `ctxInstalled`·`rulesInstalled`·
   `ordersInstalled` 로 각각 개명).

---

## 6. 전술 게시판 (Supabase)

`src/board/board.js` 위쪽 두 줄(`URL`·`KEY`)이 비어 있으면 **게시판이 통째로 숨습니다.**
설정 전에도 게임은 그대로 돌아가므로, 켜지 않은 채로 배포해도 됩니다.
붙는 자리는 두 군데입니다 — 경기 화면 원정 칸(그 자리에서 바로 붙기)과
**`board.html`**(둘러보고 찾기). 둘 다 같은 `listPlans` 를 씁니다.

표는 **두 개**입니다.

| 표 | 무엇 | 없으면 |
|---|---|---|
| `plans` | 전술 게시판 — 라인업 코드 | 게시판이 통째로 숨는다 |
| `matches` | 듀얼 기록실 — 끝난 경기의 결과 링크 | 기록실만 "아직 준비 중"으로 뜬다 |

`matches` 는 나중에 붙여도 됩니다. SQL 은 설정 문서 **2-1** 절에 있습니다.

- 켜는 절차와 SQL 은 [docs/전술게시판-설정.md](docs/전술게시판-설정.md) 에 있습니다.
- ⛔ **`service_role` 키를 넣지 마세요.** 넣어야 하는 것은 `anon` `public` 입니다.
  anon 키는 브라우저에 내려가는 것이 정상이고, 할 수 있는 일은 표의 권한 정책이 정합니다.
- `URL`·`KEY` 를 넣었으면 **도장을 다시 찍으세요**(2번). 안 찍으면 옛 모듈이 계속 쓰입니다.
- `board.js` 는 **엔진 모듈이 아닙니다** — `realmatch`·`simcheck` 목록에 넣지 마세요(5번).
  경기 계산과 아무 상관이 없습니다.

## 7. 커밋 · 문서

- 브랜치는 `main` 하나입니다.
- 사용자에게 보일 변경은 **[CHANGELOG.md](CHANGELOG.md)** 에 씁니다(README 가 링크합니다).
  판 번호는 뼈대가 크게 달라질 때만 올리고, 버그 수정은 날짜로만 적습니다.
- 개발 기록·구조·측정치는 **[DEVELOPMENT.md](DEVELOPMENT.md)** 에 씁니다.
- 설계 결정의 정본은 저장소 밖 `../km/개리그매니저듀얼_설계서_v2.md` 입니다.
