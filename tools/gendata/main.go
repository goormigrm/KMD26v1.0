// KMD26 데이터 파이프라인 (단계 4)
//
// src/data/gen.js (KM26 선수 생성기 추출본) 를 그대로 실행해 data/*.json 을 만든다.
//
// 왜 JS 를 Go 안에서 돌리는가
// ---------------------------
// 선수 세부 능력치는 원본 함수가 ovr·나이·키를 근거로 만들어 낸다. 그 규칙을 Go 로
// 옮겨 적으면 반드시 어딘가 어긋나고, 그러면 KM26 화면과 다른 선수가 된다.
// 그래서 옮겨 적지 않고 원본 함수를 그대로 돌린다 (goja). 난수는 시드로 묶는다.
//
// Go 가 맡는 일은 "돌리고 · 고르고 · 검증하고 · 저장하는" 쪽이다.
//
// 사용: go run ./tools/gendata            (저장소 루트에서)
//       go run ./tools/gendata -seed 123  (시드를 바꿔 보고 싶을 때)
package main

import (
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/dop251/goja"
)

// 데이터 시드. 바꾸면 추정 능력치(estimateOvr 밖의 난수)가 전부 달라진다.
// "KMD2" 를 그대로 숫자로 쓴 값 — 기억하기 쉬우라고.
const defaultSeed = 0x4B4D4432

// 시드 난수. src/engine/rng.js 의 mulberry32 와 **한 글자도 다르면 안 된다.**
// 엔진과 데이터가 같은 난수를 써야 한다는 뜻이 아니라, 데이터 생성이 재현돼야 한다는 뜻이다.
const rngShim = `
var __s = 1;
function seedRNG(s){ __s = (s >>> 0) || 1; }
function RNG(){
  __s = (__s + 0x6D2B79F5) >>> 0;
  var t = Math.imul(__s ^ (__s >>> 15), 1 | __s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
`

// 듀얼이 쓰는 선수 항목만 남긴다. 시즌 전용(계약·사기·부상·이적)은 전부 버린다.
// 여기 없는 값이 필요해지면 이 목록에 이름을 더하면 된다.
var playerKeep = []string{
	"id", "name", "pos", "prefPos", "no", "by", "bd", "h", "w", "frn", "foot",
	"ovr", "pers", "traits", "attr", "gkA", "gk", "posFam",
	"star", // 화면에 띄우는 별점 — 숫자 대신 이걸 보여 준다 (눈금은 하나뿐, 은색 없음)
}

var teamKeep = []string{"id", "name", "short", "col", "col2", "div"}

var (
	reImport = regexp.MustCompile(`(?m)^import\s.*$`)
	reExport = regexp.MustCompile(`(?s)\nexport\s*\{.*?\};\s*$`)
)

func main() {
	seed := flag.Int("seed", defaultSeed, "데이터 생성 시드")
	root := flag.String("root", ".", "저장소 루트")
	flag.Parse()

	genPath := filepath.Join(*root, "src", "data", "gen.js")
	outDir := filepath.Join(*root, "data")

	raw, err := os.ReadFile(genPath)
	check(err, "gen.js 를 읽지 못했습니다. 먼저 tools/extract_data.py 를 돌리세요")

	// ESM 문법은 goja 가 모른다 — import/export 줄만 걷어낸다.
	src := reExport.ReplaceAllString(reImport.ReplaceAllString(string(raw), ""), "")

	vm := goja.New()
	mustRun(vm, rngShim, "rng")
	mustRun(vm, src, "gen.js")

	// 시드를 심고 29개 구단을 만든다. 순서가 곧 선수 id(PID) 순서라 절대 바꾸면 안 된다.
	//
	// G 는 시즌 상태 전역이다. 생성기가 쓰는 건 G.season 하나뿐이고(통산 출장 추정·나이 감쇠),
	// 한 곳은 typeof 가드가 없어 아예 없으면 터진다. 연도만 든 최소 문맥을 세워 준다 —
	// 엔진 쪽 src/engine/stubs.js 가 하는 일과 같은 성격이다.
	driver := fmt.Sprintf(`
    var G = { season: CUR_YEAR };
    seedRNG(%d);
    var _k1 = D1.map(function(d){ return mkTeam(d, 1); });
    var _k2 = D2.map(function(d){ return mkTeam(d, 2); });

    /* 별점 — 화면에 능력치 숫자를 그대로 띄우면 라인업을 짤 때 고민이 사라진다.
       기준(starRefLevel)이 **리그 전체 평균**이라 29개 구단이 다 만들어진 뒤에 매긴다. */
    G.teams = {};
    _k1.concat(_k2).forEach(function(t){ G.teams[t.id] = t; });
    var _ref = starRefLevel();
    var _all = [];
    _k1.concat(_k2).forEach(function(t){ t.players.forEach(function(p){ _all.push(p); }); });

    /* ── 눈금은 하나만 쓴다 (KM26 의 은색 눈금을 걷어냈다) ─────────────────
       KM26 은 1군 수준에 못 미치는 선수를 "은색" 눈금으로 갈아태운다. 시즌 게임에서는
       유스와 1군을 갈라 보여 주는 장치라 뜻이 있지만, 듀얼에서는 해롭다.
       금색 2.5개짜리 주전보다 은색 3.5개짜리 후보가 **별이 많아 보인다** —
       실제로는 한참 아래인데도. 라인업만 짜는 게임에서 이건 그냥 거짓 정보다.

       듀얼은 육성도 잠재력도 없고 오로지 지금 실력으로 겨루므로, 눈금을 하나로 합친다.
       리그 전체 실력 분포의 2%~98% 구간을 0.5★~5★ 에 펼친다 — 양 끝의 극단값 몇 명 때문에
       가운데가 뭉개지지 않게 백분위를 쓴다. */
    var _lv = _all.map(playerLevel).sort(function(a,b){ return a-b; });
    var _q = function(f){ return _lv[Math.min(_lv.length-1, Math.max(0, Math.round((_lv.length-1)*f)))]; };
    var _lo = _q(0.02), _hi = _q(0.98);
    var _span = Math.max(1, _hi - _lo);
    _all.forEach(function(p){
      var t = (playerLevel(p) - _lo) / _span;              // 0(하위 2%) ~ 1(상위 2%)
      var v = 0.5 + t * 4.5;
      p.star = Math.max(0.5, Math.min(5, Math.round(v * 2) / 2));
    });

    JSON.stringify({
      starRef: _ref,
      starLo: _lo, starHi: _hi,
      k1: _k1,
      k2: _k2,
      // 화면이 쓸 이름표 — 한글 라벨을 UI 에 베껴 두면 원본이 바뀔 때 어긋난다
      labels: {
        attr: ATTR_LABEL_FM, fam: FAM_LABEL, famOrder: FAM_POS,
        tech: TECH_ORDER, ment: MENT_ORDER, phys: PHYS_ORDER, gk: GK_ORDER,
        // 특성은 선수 항목에 키만 저장된다("looksForPass"). 읽을 이름은 여기서 온다.
        trait: TRAITS.reduce(function(o, t){ o[t.k] = t.n; return o; }, {})
      },
      // 전술판이 쓸 표 — 화면에 베껴 두면 원본이 바뀔 때 어긋난다
      tables: {
        formation: FORMATION_SHAPE,  // 포메이션 → 자리 10개 (골키퍼는 늘 있으므로 빠져 있다)
        slotXY: SLOT_XY,             // 자리 → 전술판 좌표 (0~1)
        slotFam: SLOT_FAM,           // 자리 → 능숙도 항목
        famLv: FAM_LV,               // 능숙도 → 이름·색
        tacDef: TAC_DEF,             // 전술 기본값
        tacKeys: TAC_KEYS,           // 슬라이더 8종의 순서
        // KM26 전술판은 자유 배치가 아니라 "한 줄 5칸"의 고정 격자다.
        // 이미 KM26 을 하던 사람들이 오므로 그 형태를 그대로 쓴다.
        rowSlots: ROW_SLOTS,         // 줄 → 5칸 (없는 자리는 null)
        roleGrp: ROLE_GRP,           // 자리 → 역할 묶음
        roleDef: ROLE_DEFAULT,       // 역할 묶음 → [역할키, 임무]
        dutyN: DUTY_N,               // 임무 키 → 이름
        roleN: ROLES.reduce(function(o, r){ o[r.k] = r.n; return o; }, {}),
        // 역할 목록 — grp 가 그 역할을 맡을 수 있는 자리 묶음, duty 가 고를 수 있는 임무다.
        // fx(효과 함수)는 엔진 쪽 일이라 넘기지 않는다.
        roles: ROLES.map(function(r){ return {k:r.k, n:r.n, grp:r.grp, duty:r.duty}; })
      },
      /* 경기 뒤 반응 — 소셜미디어와 FM코리아 문구.
         [문구, 어조] 짝이고 어조는 -1/0/1 이다. {t}{o}{p}{s} 같은 자리는 경기 결과로 채운다.
         한글 조사는 "이/가" 처럼 마커로 들어 있어 F_() 가 앞 글자 받침을 보고 고른다. */
      reactions: {
        soc: SOC, fmk: FMK,
        // 타구단 팬 — 같은 경기를 남의 눈으로 본 글. 우리 팬 표와 섞이지 않는다
        riv: RIV, friv: FRIV,
        nick: FMK_NICK, rivalNick: FMK_RIVAL_NICK,
        /* 소셜 계정 이름 — 원본 socHandle()/rivalHandle() 이 쓰는 풀을 그대로 나눠 담는다.
           handles 쪽은 뒤에 숫자를 붙여 쓰고(원정석구석4821), nick 쪽은 그대로 쓴다.
           [이름, 이모지] 짝이다. */
        socHandles: SOC_HANDLES, socNick2: SOC_NICK2, socNick3: SOC_NICK3,
        socNickExtra: SOC_NICK_EXTRA,
        rivalHandles: RIVAL_HANDLES, rivalNick2: RIVAL_NICK2,
        // 상주 악플러 — 원본과 같이 펨코에만 세운다
        troll: SOC_TROLL, trollSay: TROLL_SAY,
        // 더비 표 [구단A, 구단B, 이름, 등급] — 등급 2가 대형 더비다
        rivals: RIVALS
      }
    });
  `, *seed)
	v, err := vm.RunString(driver)
	check(err, "구단 생성 중 오류")

	var built struct {
		K1      []map[string]any `json:"k1"`
		K2      []map[string]any `json:"k2"`
		Labels  map[string]any   `json:"labels"`
		Tables  map[string]any   `json:"tables"`
		React   map[string]any   `json:"reactions"`
		StarRef float64          `json:"starRef"`
		StarLo  float64          `json:"starLo"`
		StarHi  float64          `json:"starHi"`
	}
	check(json.Unmarshal([]byte(v.String()), &built), "생성 결과를 읽지 못했습니다")

	teams := map[string]any{}
	players := map[string]any{}
	order := struct {
		K1 []string `json:"k1"`
		K2 []string `json:"k2"`
	}{}
	total := 0

	for _, grp := range []struct {
		list []map[string]any
		ids  *[]string
	}{{built.K1, &order.K1}, {built.K2, &order.K2}} {
		for _, t := range grp.list {
			id, _ := t["id"].(string)
			if id == "" {
				fail("구단 id 가 비어 있습니다")
			}
			teams[id] = pick(t, teamKeep)
			ps, _ := t["players"].([]any)
			out := make([]any, 0, len(ps))
			for _, p := range ps {
				pm, ok := p.(map[string]any)
				if !ok {
					fail("선수 항목이 객체가 아닙니다 — " + id)
				}
				out = append(out, pick(pm, playerKeep))
			}
			players[id] = out
			total += len(out)
			*grp.ids = append(*grp.ids, id)
		}
	}

	// 별점 기준선이 말이 되는지 본다. 캐시가 빈 리그로 잡혔거나 순서가 틀어지면 여기서 걸린다.
	if built.StarRef < 55 || built.StarRef > 85 {
		fail(fmt.Sprintf("별점 기준선이 %.1f 입니다 — 리그 전체가 아니라 빈 목록으로 계산됐을 수 있습니다", built.StarRef))
	}

	verify(players, total)

	check(os.MkdirAll(outDir, 0o755), "data 폴더를 만들지 못했습니다")
	teamsB := writeJSON(filepath.Join(outDir, "teams.json"),
		map[string]any{"order": order, "teams": teams,
			"labels": built.Labels, "tables": built.Tables})
	reactB := writeJSON(filepath.Join(outDir, "reactions.json"), built.React)
	playersB := writeJSON(filepath.Join(outDir, "players.json"), players)

	// 데이터 해시 — 단계 5 에서 대전 코드에 박아, 서로 다른 명단으로 재생하는 사고를 막는다.
	sum := sha256.Sum256(append(append(append([]byte{}, teamsB...), playersB...), reactB...))
	dataHash := fmt.Sprintf("%x", sum)[:16]

	writeJSON(filepath.Join(outDir, "meta.json"), map[string]any{
		"source":     "KM26 v2.0 (KleagueM2026/KM26v2.0)",
		"genFrom":    "src/data/gen.js",
		"seed":       *seed,
		"teamCount":  len(teams),
		"playerCount": total,
		"starRef":    built.StarRef,
		"starRange":  []float64{built.StarLo, built.StarHi},
		"dataHash":   dataHash,
		"note": "tools/gendata 가 만든 파일입니다. 손으로 고치지 마세요 — " +
			"원본이 갱신되면 extract_data.py 를 다시 돌린 뒤 이 도구를 실행하세요.",
	})

	fmt.Printf("OK %d개 구단 / %d명 -> %s\n", len(teams), total, outDir)
	fmt.Printf("   데이터 해시 %s (시드 %d)\n", dataHash, *seed)
}

// 필요한 항목만 골라 담는다 — 없는 항목은 조용히 건너뛴다(GK 가 아니면 gkA 가 없다).
func pick(src map[string]any, keys []string) map[string]any {
	out := make(map[string]any, len(keys))
	for _, k := range keys {
		if v, ok := src[k]; ok && v != nil {
			out[k] = v
		}
	}
	return out
}

// 데이터가 말이 되는지 본다. 여기서 걸러야 화면에서 이상한 걸 보고 원인을 찾아 헤매지 않는다.
func verify(players map[string]any, total int) {
	if total < 900 {
		fail(fmt.Sprintf("선수가 %d명뿐입니다. 원본 명단(약 1,024명)을 다 읽지 못했습니다", total))
	}
	seen := map[float64]string{}
	var problems []string
	ids := make([]string, 0, len(players))
	for id := range players {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	for _, tid := range ids {
		list, _ := players[tid].([]any)
		gk := 0
		for _, p := range list {
			pm := p.(map[string]any)
			pid, _ := pm["id"].(float64)
			if prev, dup := seen[pid]; dup {
				problems = append(problems, fmt.Sprintf("선수 id %d 중복 (%s ↔ %s)", int(pid), prev, tid))
			}
			seen[pid] = tid
			if pm["pos"] == "GK" {
				gk++
				if _, ok := pm["gkA"]; !ok {
					problems = append(problems, fmt.Sprintf("%s 의 골키퍼에게 gkA 가 없습니다", tid))
				}
			}
			if _, ok := pm["attr"]; !ok {
				problems = append(problems, fmt.Sprintf("%s 의 선수에게 attr 이 없습니다", tid))
			}
			if _, ok := pm["posFam"]; !ok {
				problems = append(problems, fmt.Sprintf("%s 의 선수에게 posFam 이 없습니다", tid))
			}
		}
		if len(list) < 12 {
			problems = append(problems, fmt.Sprintf("%s 인원이 %d명 — 경기를 치를 수 없습니다", tid, len(list)))
		}
		if gk == 0 {
			problems = append(problems, tid+" 에 골키퍼가 없습니다")
		}
	}
	if len(problems) > 0 {
		fail("데이터 검증 실패:\n  - " + strings.Join(problems, "\n  - "))
	}
}

func writeJSON(path string, v any) []byte {
	b, err := json.MarshalIndent(v, "", " ")
	check(err, "JSON 으로 만들지 못했습니다 — "+path)
	check(os.WriteFile(path, b, 0o644), "저장하지 못했습니다 — "+path)
	return b
}

func mustRun(vm *goja.Runtime, code, what string) {
	if _, err := vm.RunString(code); err != nil {
		fail(what + " 실행 중 오류: " + err.Error())
	}
}

func check(err error, msg string) {
	if err != nil {
		fail(msg + ": " + err.Error())
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "중단: "+msg)
	os.Exit(1)
}
