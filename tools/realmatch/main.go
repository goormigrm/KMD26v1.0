// 실제 데이터로 경기 한 판 (단계 7 확인용)
//
// simcheck 는 합성 스쿼드로 전술 슬라이더를 본다. 이건 data/*.json 의 진짜 K리그 명단으로
// 경기가 끝까지 도는지를 본다 — 선수 항목이 하나라도 빠지면 여기서 걸린다.
// 브라우저를 열지 않고도 "경기 화면이 돌아갈까"를 미리 알 수 있다.
//
// 사용: go run ./tools/realmatch -root ../.. -home ulsan -away jeonbuk
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/dop251/goja"
)

// 의존 순서 — 이어 붙이는 순서가 곧 실행 순서다
var modules = []string{
	"src/engine/rng.js",
	"src/engine/kernel.js",
	"src/engine/stubs.js",
	"src/engine/rules.js",
	"src/engine/duel.js",
	"src/engine/teams.js",
}

var (
	reImport = regexp.MustCompile(`(?m)^\s*import\s[^;]*;?\s*$`)
	reExport = regexp.MustCompile(`(?m)^\s*export\s+(?:\{[^}]*\}\s*;?\s*$)?`)
)

const driver = `
function playReal(homeId, awayId) {
  var mk = function(id) {
    var lu = autoLineup(PLAYERS[id], TABLES, "4-3-3");
    var t = buildTeam(TEAMS[id], PLAYERS[id], {tac:{}, roles:{}});
    var bad = checkLineup(t, Object.keys(lu.xi).map(function(s){ return lu.xi[s]; }));
    if (bad) throw new Error(id + " 라인업 — " + bad);
    return {team:t, xi:lu.xi, bench:lu.bench};
  };
  var H = mk(homeId), A = mk(awayId);
  var seed = deriveSeed(
    lineupSig(homeId, H.xi, H.bench, {}, {}),
    lineupSig(awayId, A.xi, A.bench, {}, {}));

  var xiOf = function(o){ return Object.keys(o.xi).map(function(s){ return o.xi[s]; }); };
  var r = runHeadless(H.team, A.team, {
    seed: seed,
    homeXI: xiOf(H), awayXI: xiOf(A),
    homeBench: H.bench.filter(Boolean), awayBench: A.bench.filter(Boolean)
  });
  return {
    seed: seed, fp: r.fp, hg: r.hg, ag: r.ag, done: r.done, clock: r.clock,
    events: r.events.length, ref: r.referee,
    hShot: r.stats.h.shot, aShot: r.stats.a.shot,
    hPass: r.stats.h.pass, aPass: r.stats.a.pass,
    hFoul: r.stats.h.foul, aFoul: r.stats.a.foul,
    poss: r.possession.h,
    goals: (r.goalLine||[]).map(function(g){ return g.min + "' " + g.n + " (" + g.side + ")"; }).join(" · "),
    firstLines: r.events.slice(0, 3).map(function(e){ return e.min + "' " + e.txt; })
  };
}
`

func main() {
	root := flag.String("root", ".", "저장소 루트")
	home := flag.String("home", "ulsan", "홈 구단 id")
	away := flag.String("away", "jeonbuk", "원정 구단 id")
	n := flag.Int("n", 1, "몇 판")
	flag.Parse()

	var sb strings.Builder
	for _, m := range modules {
		b, err := os.ReadFile(filepath.Join(*root, m))
		if err != nil {
			fail("모듈을 읽지 못했습니다 " + m + ": " + err.Error())
		}
		s := reExport.ReplaceAllString(reImport.ReplaceAllString(string(b), ""), "")
		sb.WriteString("\n/* ===== " + m + " ===== */\n")
		sb.WriteString(s)
	}
	sb.WriteString(driver)

	vm := goja.New()
	if _, err := vm.RunString(sb.String()); err != nil {
		fail("엔진을 올리지 못했습니다: " + err.Error())
	}

	// data/*.json 을 그대로 전역에 얹는다 — 화면이 fetch 로 하는 일과 같다
	var teams struct {
		Teams  map[string]any `json:"teams"`
		Tables map[string]any `json:"tables"`
	}
	readJSON(filepath.Join(*root, "data", "teams.json"), &teams)
	var players map[string]any
	readJSON(filepath.Join(*root, "data", "players.json"), &players)
	vm.Set("TEAMS", teams.Teams)
	vm.Set("TABLES", teams.Tables)
	vm.Set("PLAYERS", players)

	play, ok := goja.AssertFunction(vm.Get("playReal"))
	if !ok {
		fail("playReal 을 찾지 못했습니다")
	}

	fmt.Printf("%s vs %s · %d판\n\n", *home, *away, *n)
	var fps []string
	for i := 0; i < *n; i++ {
		t0 := time.Now()
		v, err := play(goja.Undefined(), vm.ToValue(*home), vm.ToValue(*away))
		if err != nil {
			fail("경기 중 오류: " + err.Error())
		}
		r := v.Export().(map[string]any)
		fps = append(fps, str(r["fp"]))
		fmt.Printf("  %v : %v  (%.0f분 · 이벤트 %v건 · 주심 %v)  %v\n",
			r["hg"], r["ag"], num(r["clock"])/60, r["events"], r["ref"], time.Since(t0).Round(time.Millisecond))
		fmt.Printf("    슈팅 %v:%v · 패스 %v:%v · 파울 %v:%v · 점유 %v%%\n",
			r["hShot"], r["aShot"], r["hPass"], r["aPass"], r["hFoul"], r["aFoul"], r["poss"])
		if g := str(r["goals"]); g != "" {
			fmt.Printf("    득점: %s\n", g)
		}
		if i == 0 {
			if lines, ok := r["firstLines"].([]any); ok {
				for _, l := range lines {
					fmt.Printf("    │ %v\n", l)
				}
			}
		}
		if num(r["clock"]) < 5400 || r["done"] != true {
			fail("경기가 90분을 채우지 못했습니다")
		}
	}

	// 같은 라인업이면 같은 경기여야 한다 — 단계 2 의 성질이 실제 데이터에서도 지켜지는지
	for i := 1; i < len(fps); i++ {
		if fps[i] != fps[0] {
			fail(fmt.Sprintf("같은 라인업인데 지문이 갈렸습니다: %s ≠ %s", fps[0], fps[i]))
		}
	}
	fmt.Printf("\n결과 지문 %s — %d판 모두 동일\n", fps[0], len(fps))
}

func readJSON(path string, v any) {
	b, err := os.ReadFile(path)
	if err != nil {
		fail("읽지 못했습니다 " + path + ": " + err.Error())
	}
	if err := json.Unmarshal(b, v); err != nil {
		fail("JSON 이 아닙니다 " + path + ": " + err.Error())
	}
}

func num(v any) float64 {
	switch x := v.(type) {
	case int64:
		return float64(x)
	case float64:
		return x
	}
	return 0
}
func str(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
func fail(msg string) {
	fmt.Fprintln(os.Stderr, "중단: "+msg)
	os.Exit(1)
}
