// 헤드리스 경기 실행기
//
// 브라우저 없이 경기를 돌려 본다. 전술 슬라이더를 바꿨을 때 결과가 실제로
// 달라지는지 확인하는 용도다 — 고칠 때마다 사람에게 버튼을 누르라고 할 수는 없다.
//
// 엔진은 ESM 모듈 여러 개로 나뉘어 있는데 goja 는 ESM 을 모른다.
// 그래서 의존 순서대로 이어 붙이고 import/export 줄만 걷어낸다.
// (gendata 가 gen.js 를 돌릴 때 쓴 방법과 같다)
//
// ⚠ goja 는 V8 보다 훨씬 느리다. 확인이 목적이므로 경기 길이를 줄여서 돌린다.
//    "지문이 달라지는가"는 10분 경기로도 충분히 보인다.
//
// 사용: go run ./tools/simcheck -root ../.. -key pass -secs 900
package main

import (
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
	"src/engine/orders.js",   // 조건부 지시 (단계 8) — duel.js 가 부른다
	"src/engine/replay.js",
	"src/engine/duel.js",
	"test/fixture.js",
}

var (
	reImport = regexp.MustCompile(`(?m)^\s*import\s[^;]*;?\s*$`)
	reExport = regexp.MustCompile(`(?m)^\s*export\s+(?:\{[^}]*\}\s*;?\s*$)?`)
)

const driver = `
function runOne(key, val, seed, secs) {
  var tac = {}; if (key) tac[key] = val;
  var home = makeTeam("alpha", "알파 FC", "알파", 72, 11, tac);
  var away = makeTeam("bravo", "브라보 FC", "브라보", 72, 22);
  normalizeTeam(home); normalizeTeam(away);
  installEngineContext([home, away], seed & 0x7fff);
  seedRNG(seed);
  var M = makeMatch(home, away, {});
  var sim = new MatchSim(M, { live: true });
  sim.run(secs);                       // 길이를 줄여 돌린다 — 확인이 목적이다
  var r = {
    hg: M.hg, ag: M.ag, stats: sim.stats, events: M.events,
    goalLine: M.sc || [], clock: Math.round(sim.clock), done: M.done
  };
  return {
    fp: fingerprint(r), hg: M.hg, ag: M.ag,
    pass: sim.stats.h.pass, longPass: sim.stats.h.longPass,
    passLen: sim.stats.h.passLen, shot: sim.stats.h.shot,
    tackle: sim.stats.h.tackle, foul: sim.stats.h.foul,
    cross: sim.stats.h.cross, offsideOpp: sim.stats.a.offside,
    shotLong: sim.stats.h.shotLong
  };
}
`

func main() {
	root := flag.String("root", ".", "저장소 루트")
	key := flag.String("key", "pass", "바꿔 볼 전술 키 (빈 값이면 기본 전술로 한 판)")
	lo := flag.Int("lo", 0, "낮은 값")
	hi := flag.Int("hi", 4, "높은 값")
	secs := flag.Int("secs", 900, "경기 길이(초). 5400 이 정규 90분")
	pairs := flag.Int("pairs", 3, "비교 쌍 수")
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
	t0 := time.Now()
	if _, err := vm.RunString(sb.String()); err != nil {
		fail("엔진을 올리지 못했습니다: " + err.Error())
	}
	fmt.Printf("엔진 로드 %v\n", time.Since(t0).Round(time.Millisecond))

	run, ok := goja.AssertFunction(vm.Get("runOne"))
	if !ok {
		fail("runOne 을 찾지 못했습니다")
	}

	call := func(k string, v any, seed int) map[string]any {
		res, err := run(goja.Undefined(), vm.ToValue(k), vm.ToValue(v),
			vm.ToValue(seed), vm.ToValue(*secs))
		if err != nil {
			fail("경기 중 오류: " + err.Error())
		}
		return res.Export().(map[string]any)
	}

	num := func(m map[string]any, k string) float64 {
		switch v := m[k].(type) {
		case int64:
			return float64(v)
		case float64:
			return v
		}
		return 0
	}

	fmt.Printf("경기 길이 %d초 (정규 5400초) · %d쌍\n\n", *secs, *pairs)

	same, diff := 0, 0
	var loRatio, hiRatio, loDist, hiDist, loInd, hiInd float64
	for i := 0; i < *pairs; i++ {
		seed := 0x5EED0000 + i*7919
		m0 := time.Now()
		A := call(*key, *lo, seed)
		B := call(*key, *hi, seed)
		el := time.Since(m0)

		fpA, fpB := A["fp"].(string), B["fp"].(string)
		rA := pct(num(A, "longPass"), num(A, "pass"))
		rB := pct(num(B, "longPass"), num(B, "pass"))
		loRatio += rA
		hiRatio += rB
		if fpA == fpB {
			same++
		} else {
			diff++
		}
		// 평균 패스 거리 — 롱패스 비율(30m 이상)보다 훨씬 민감하다.
		// 0.01 아이소 단위가 약 0.67m 다 (ISO_TO_M ≈ 67).
		dA := num(A, "passLen") / max1(num(A, "pass")) * 67
		dB := num(B, "passLen") / max1(num(B, "pass")) * 67
		loDist += dA
		hiDist += dB

		// 그 슬라이더가 직접 건드리는 지표를 보여 준다.
		// (예전에는 무엇을 보든 패스 지표만 찍어서, 압박을 재는데 패스 거리를 읽고 있었다)
		ind := indicator(*key)
		iA, iB := ind.get(A, num), ind.get(B, num)
		loInd += iA
		hiInd += iB
		fmt.Printf("  시드 %08x  %s %s %s   %s %.1f → %.1f   평균 패스 %.1fm → %.1fm  %v\n",
			seed, fpA, arrow(fpA != fpB), fpB, ind.label, iA, iB, dA, dB,
			el.Round(time.Millisecond))
	}

	fmt.Printf("\n지문이 달라진 쌍 %d/%d\n", diff, *pairs)
	n := float64(*pairs)
	fmt.Printf("%s  %.1f (낮음) → %.1f (높음)\n", indicator(*key).label, loInd/n, hiInd/n)
	fmt.Printf("평균 패스 거리  %.1fm → %.1fm\n", loDist/n, hiDist/n)
	fmt.Printf("롱패스 비율     %.1f%% → %.1f%%\n", loRatio/n, hiRatio/n)
	if diff == 0 {
		fmt.Println("\n판정: 미반영 — 엔진이 이 값을 읽지 않습니다")
		os.Exit(1)
	}
	fmt.Println("\n판정: 반영됨")
}

/* 슬라이더별 직접 지표 — "이 값을 올리면 이게 움직여야 한다"
   test/tactics.html 의 SLIDERS 표와 같은 기준을 쓴다. 둘이 어긋나면 안 된다. */
type ind struct {
	label string
	get   func(m map[string]any, num func(map[string]any, string) float64) float64
}

func indicator(key string) ind {
	simple := func(label, field string) ind {
		return ind{label, func(m map[string]any, num func(map[string]any, string) float64) float64 {
			return num(m, field)
		}}
	}
	switch key {
	case "pass":
		return ind{"롱패스 비율(%)", func(m map[string]any, num func(map[string]any, string) float64) float64 {
			return pct(num(m, "longPass"), num(m, "pass"))
		}}
	case "tempo", "counter":
		return simple("패스 수", "pass")
	case "press":
		return simple("태클 시도", "tackle")
	case "line":
		return simple("상대 오프사이드", "offsideOpp")
	case "width":
		return simple("크로스", "cross")
	case "mentality":
		return simple("슈팅", "shot")
	case "tackle":
		return simple("파울", "foul")
	case "longShot":
		return simple("중거리 슛", "shotLong")
	}
	return simple("패스 수", "pass")
}

func max1(v float64) float64 {
	if v < 1 {
		return 1
	}
	return v
}

func pct(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b * 100
}

func arrow(diff bool) string {
	if diff {
		return "≠"
	}
	return "=="
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "중단: "+msg)
	os.Exit(1)
}
