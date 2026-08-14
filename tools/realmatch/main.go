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
	"src/engine/orders.js",   // 조건부 지시 (단계 8) — duel.js 가 부른다
	"src/engine/replay.js",
	"src/engine/duel.js",
	"src/engine/reactions.js",
	"src/engine/teams.js",
}

var (
	reImport = regexp.MustCompile(`(?m)^\s*import\s[^;]*;?\s*$`)
	reExport = regexp.MustCompile(`(?m)^\s*export\s+(?:\{[^}]*\}\s*;?\s*$)?`)
)

const driver = `
/* -tac / -atac 로 넣은 전술을 그 팀에 얹는다 (없으면 기본값) */
function tacOf(id) {
  var raw = (id === HOMEID) ? HTAC : (id === AWAYID ? ATAC : "");
  var out = {};
  if (!raw) return out;
  raw.split(",").forEach(function(kv){
    var p = kv.split("=");
    if (p.length !== 2) return;
    var k = p[0].trim(), v = p[1].trim();
    out[k] = (k === "counter") ? (v === "1" || v === "true") : (+v);
  });
  return out;
}

/* 경기 화면(match.html)이 일꾼에게 넘기는 것과 **같은 모양**으로 라인업을 만든다.
   여기서 모양이 어긋나면 이 도구의 측정값이 실제 경기와 달라진다. */
function mkPlan(id, form) {
  var lu = autoLineup(PLAYERS[id], TABLES, form);
  // 골키퍼 역할을 바꿔 가며 볼 수 있게 — 스위퍼 키퍼 공격 임무는 키퍼를 크게 끌어낸다
  var rl = {};
  if (GKROLE) { rl[lu.xi.GK] = {r: GKROLE.split(":")[0], d: GKROLE.split(":")[1] || "D"}; }
  return {
    id: id, xiMap: lu.xi,
    xi: Object.keys(lu.xi).map(function(s){ return lu.xi[s]; }),
    bench: lu.bench, tac: Object.assign({formation: form}, tacOf(id)), roles: rl
  };
}

function playReal(homeId, awayId) {
  var hp = mkPlan(homeId, FORM), ap = mkPlan(awayId, AWAYFORM || FORM);
  var hSig = planSig(hp), aSig = planSig(ap);
  if (hSig === aSig) throw new Error("양 팀의 선수·전술이 완전히 같습니다 (-awayform 으로 갈라 주세요)");

  // 같은 구단끼리면 원정 쪽 선수 id·이름표·색을 갈라 놓는다
  var S = prepareSides(TEAMS, PLAYERS, hp, ap);
  var sides = [["홈", S.H, S.home], ["원정", S.A, S.away]];
  for (var i = 0; i < sides.length; i++) {
    var bad = checkLineup(sides[i][1], sides[i][2].xi);
    if (bad) throw new Error(sides[i][0] + " " + sides[i][1].short + " 라인업 — " + bad);
  }

  /* ⚠ 이 시드는 **게임 화면과 다르다.** 경기 화면(matchworker)은 대전 코드 두 개에서
     시드를 뽑는다 — 여기서는 코덱과 데이터 해시를 들고 오지 않으므로 라인업 지문으로
     대신한다. 이 도구의 목적은 "진짜 명단으로 경기가 끝까지 도는가"를 보는 것이라
     값이 도구 안에서 재현되기만 하면 된다. 실제 대전을 그대로 재현해야 할 때는
     경기 화면의 결과 링크를 쓸 것. */
  var seed = deriveSeed(hSig, aSig);
  var r = runHeadless(S.H, S.A, {
    seed: seed,
    homeXI: S.home.xi, awayXI: S.away.xi,
    homeBench: S.home.bench.filter(Boolean), awayBench: S.away.bench.filter(Boolean),
    record: RECORD
  });
  return {
    hName: S.H.short, aName: S.A.short,
    seed: seed, fp: r.fp, hg: r.hg, ag: r.ag, done: r.done, clock: r.clock,
    events: r.events.length, ref: r.referee,
    hShot: r.stats.h.shot, aShot: r.stats.a.shot,
    hPass: r.stats.h.pass, aPass: r.stats.a.pass,
    hFoul: r.stats.h.foul, aFoul: r.stats.a.foul,
    hOn: r.stats.h.shotOn, aOn: r.stats.a.shotOn,
    poss: r.possession.h,
    // 득점자별 골 수 — 한 명에게 몰리는지 보려면 이게 필요하다
    scorers: (r.goalLine||[]).reduce(function(o,g){ o[g.n]=(o[g.n]||0)+1; return o; }, {}),
    goals: (r.goalLine||[]).map(function(g){ return g.min + "' " + g.n + " (" + g.side + ")"; }).join(" · "),
    firstLines: r.events.slice(0, 3).map(function(e){ return e.min + "' " + e.txt; }),
    clipsIsArr: r.clips ? (r.clips.length===0 ? 'empty' : 'n='+r.clips.length) : 'undefined',
    react: (function(){
      if (!REACT) return [];
      var rr = makeReactions(Object.assign({}, r, {home:S.H.short, away:S.A.short, seed:seed}), REACT, "h");
      return rr.social.slice(0,2).map(function(x){ return "[소셜] " + x.txt; })
        .concat(rr.fmk.slice(0,3).map(function(x){ return "[FMK/" + x.nick + "] " + x.txt; }));
    })(),
    /* 같은 구단끼리 붙었을 때의 안전판 —
       커널은 양 팀 22명을 한 배열에 담고 id 로 찾으므로(byId), 원정 쪽 id 가 하나라도
       옮겨지지 않으면 홈 선수가 잘못 잡힌다. 명단 전체가 제 쪽에 있는지 세어 본다.
       (-record 로 돌릴 때만 r.roster 가 온다) */
    idCheck: (function(){
      if (!r.roster) return "";
      var n = 0, h = 0, a = 0, wrong = 0;
      for (var id in r.roster) {
        n++;
        var side = r.roster[id].side, shifted = (+id) >= 100000;
        if (side === "h") h++; else a++;
        if (shifted !== (side === "a")) wrong++;   // 옮긴 id 는 반드시 원정, 나머지는 홈
      }
      return "명단 " + n + "명 (홈 " + h + " · 원정 " + a + ")" +
             (S.same ? " · id 갈림 " + (wrong ? "어긋남 " + wrong + "건" : "정상") : " · 다른 구단");
    })(),
    /* ── 부상·퇴장·교체 감사 ────────────────────────────────────
       "부상인데 교체가 안 되고 열 명으로 뛰더라"는 제보를 **추측이 아니라 눈으로**
       확인하려고 둡니다. 두 가지를 함께 봅니다.

         subLog  — 🚑(부상) · 퇴장 · 🔁(교체) 줄만 시각순으로
         onPitch — 관전 트랙에서 **실제로 필드에 서 있는 사람 수**를 세어(홈v원정)
                   숫자가 바뀌는 순간만 남긴다. 열 명으로 뛴 구간이 그대로 드러난다.

       ⚠ onPitch 는 -record 로 돌려야 나옵니다 (관전 트랙이 그때만 옵니다).
       ⚠ 골키퍼는 부상 대상이 아닙니다 — 커널 hurt() 가 GK 를 건너뜁니다.
       ⚠ 이 문자열은 Go 의 backtick 리터럴 안에 있습니다. backtick 을 쓰지 마세요. */
    /* ⚠ 이모지로 거릅니다. "퇴장" 이라는 낱말로만 거르면 빠지는 문구가 있습니다 —
         "🟥 … 그라운드를 떠납니다!" 에는 그 낱말이 없어서, 사람이 사라졌는데 아무 줄도
         안 남은 것처럼 보였습니다(실제로는 레드카드였습니다). */
    subLog: (r.events||[]).filter(function(e){
      return /🚑|🔁|🟥/.test(e.txt||"");
    }).map(function(e){ return e.min + "' " + (e.t||"") + " " + e.txt; }),
    onPitch: (function(){
      if (!r.watch || !r.roster) return "";
      var W = r.watch, ST = WATCH_STRIDE, n = (W.length/ST)|0, out = [], prev = "";
      for (var i = 0; i < n; i++) {
        var A = i*ST, h = 0, a = 0;
        for (var q = 7; q < ST; q += 3) {
          var id = W[A+q]; if (!id) continue;
          var rr = r.roster[id]; if (!rr) continue;
          if (rr.side === "h") h++; else a++;
        }
        var key = h + "v" + a;
        if (key !== prev) { out.push(Math.floor(W[A]/60) + "'" + key); prev = key; }
      }
      return out.join("  ");
    })(),
    capCount: (r.caps||[]).length,
    capSample: (r.caps||[]).slice(20, 34).map(function(c){ return c.min + "' " + c.txt; }),
    clips: (r.clips||[]).length,
    clipFrames: (r.clips||[]).reduce(function(n,c){ return n + c.frames.length; }, 0),
    clipKinds: (r.clips||[]).map(function(c){ return c.min + "'" + c.kind; }).join(" "),
    bytes: r.clips ? JSON.stringify(r.clips).length : 0
  };
}
`

func main() {
	root := flag.String("root", ".", "저장소 루트")
	home := flag.String("home", "ulsan", "홈 구단 id")
	away := flag.String("away", "jeonbuk", "원정 구단 id")
	n := flag.Int("n", 1, "몇 판")
	all := flag.Bool("all", false, "여러 대진을 돌려 실제 축구와 견줘 본다")
	gkRole := flag.String("gkrole", "", "골키퍼 역할 (예: SK:A) — 비우면 기본값")
	record := flag.Bool("record", false, "2D 하이라이트 클립도 모은다")
	form := flag.String("form", "4-3-3", "포메이션")
	awayForm := flag.String("awayform", "", "원정 포메이션 — 비우면 -form 과 같게. 같은 구단끼리 붙일 때 필요하다")
	hTac := flag.String("tac", "", "홈 전술 (press=4,line=3,counter=1 …)")
	aTac := flag.String("atac", "", "원정 전술")
	series := flag.String("series", "", "이 구단을 여러 상대와 홈·원정으로 붙인다 (-tac 을 이 구단에 적용)")
	oppo := flag.String("oppo", "", "상대 목록 (쉼표) — 비우면 K리그1 앞 여섯 팀")
	audit := flag.Int("audit", 0, "이만큼의 대진을 돌려 부상·퇴장·교체만 감사한다 (-record 를 켠다)")
	flag.Parse()
	if *audit > 0 {
		*record = true // 필드 인원수는 관전 트랙에서 센다
	}

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
	vm.Set("GKROLE", *gkRole)
	vm.Set("RECORD", *record)
	vm.Set("FORM", *form)
	vm.Set("AWAYFORM", *awayForm)
	vm.Set("HTAC", *hTac)
	vm.Set("ATAC", *aTac)
	vm.Set("HOMEID", *home)
	vm.Set("AWAYID", *away)
	var react map[string]any
	if b, err := os.ReadFile(filepath.Join(*root, "data", "reactions.json")); err == nil {
		_ = json.Unmarshal(b, &react)
	}
	vm.Set("REACT", react)

	play, ok := goja.AssertFunction(vm.Get("playReal"))
	if !ok {
		fail("playReal 을 찾지 못했습니다")
	}

	/* ── 한 구단을 여러 상대와 붙여 성적을 낸다 ──────────────────
	   "이 전술이 나은가"를 보려면 한 판으로는 알 수 없다. 홈·원정 양쪽으로 돌려
	   승·무·패와 득실을 센다. -tac 을 그 구단에 얹는다. */
	if *series != "" {
		opps := []string{"ulsan", "jeonbuk", "daejeon", "gimcheon", "gangwon", "gwangju"}
		if *oppo != "" {
			opps = strings.Split(*oppo, ",")
		}
		w, d, l, gf, ga := 0, 0, 0, 0.0, 0.0
		fmt.Printf("%s · 전술 [%s]\n\n", *series, *hTac)
		for _, o := range opps {
			for side := 0; side < 2; side++ {
				h, a := *series, o
				if side == 1 {
					h, a = o, *series
				}
				// -tac 은 언제나 이 구단(series)에 붙는다
				vm.Set("HOMEID", *series)
				vm.Set("AWAYID", *series)
				v, err := play(goja.Undefined(), vm.ToValue(h), vm.ToValue(a))
				if err != nil {
					fail("경기 중 오류(" + h + " vs " + a + "): " + err.Error())
				}
				r := v.Export().(map[string]any)
				mine, theirs := num(r["hg"]), num(r["ag"])
				if side == 1 {
					mine, theirs = theirs, mine
				}
				gf += mine
				ga += theirs
				res := "무"
				if mine > theirs {
					w++
					res = "승"
				} else if mine < theirs {
					l++
					res = "패"
				} else {
					d++
				}
				where := "홈 "
				if side == 1 {
					where = "원정"
				}
				fmt.Printf("  %s %-9s %.0f:%-3.0f %s\n", where, o, mine, theirs, res)
			}
		}
		n := float64(w + d + l)
		fmt.Printf("\n%d경기 — %d승 %d무 %d패 (승점 %d · 승률 %.0f%%)  득실 %.1f:%.1f\n",
			int(n), w, d, l, w*3+d, float64(w)/n*100, gf/n, ga/n)
		return
	}

	/* ── 부상·퇴장·교체 감사 ─────────────────────────────────────
	   부상은 경기당 0.45명(양 팀 합계)쯤이라 한두 판으로는 아예 안 나옵니다.
	   대진을 바꿔 가며 여러 판 돌리고, 🚑/퇴장/🔁 줄과 **실제 필드 인원수**를
	   나란히 찍습니다. "몇 분에 몇 명으로 뛰었나"가 눈으로 보여야 합니다. */
	if *audit > 0 {
		var raw struct {
			Order struct {
				K1 []string `json:"k1"`
				K2 []string `json:"k2"`
			} `json:"order"`
		}
		readJSON(filepath.Join(*root, "data", "teams.json"), &raw)
		ids := append(append([]string{}, raw.Order.K1...), raw.Order.K2...)
		inj, red, sub, short := 0, 0, 0, 0
		for i := 0; i < *audit; i++ {
			h, a := ids[i%len(ids)], ids[(i+1)%len(ids)]
			v, err := play(goja.Undefined(), vm.ToValue(h), vm.ToValue(a))
			if err != nil {
				fail("경기 중 오류(" + h + " vs " + a + "): " + err.Error())
			}
			r := v.Export().(map[string]any)
			lines, _ := r["subLog"].([]any)
			pitch := str(r["onPitch"])
			/* 열한 명이 아닌 구간이 있었나.
			   ⚠ 11v11 토막까지 **함께** 남긴다 — 언제 다시 열한 명이 됐는지가 핵심이다.
			     (처음에는 11v11 을 걸러 냈다가 "부상 뒤 언제 채워졌나"를 못 봤다.) */
			segs := strings.Fields(pitch)
			odd := []string{}
			for i, seg := range segs {
				if !strings.HasSuffix(seg, "11v11") {
					odd = append(odd, seg)
					if i+1 < len(segs) {
						odd = append(odd, "→ "+segs[i+1]) // 되돌아온 시각
					}
				}
			}
			if len(odd) > 0 {
				short++
			}
			fmt.Printf("[%2d] %-9s vs %-9s  %v:%v\n", i+1, str(r["hName"]), str(r["aName"]), r["hg"], r["ag"])
			for _, l := range lines {
				s := fmt.Sprintf("%v", l)
				switch {
				case strings.Contains(s, "🚑"):
					inj++
				case strings.Contains(s, "🟥"):
					red++
				case strings.Contains(s, "🔁"):
					sub++
				}
				fmt.Printf("     %s\n", s)
			}
			if len(odd) > 0 {
				fmt.Printf("     ▸ 필드 인원 변화: %s\n", strings.Join(odd, "  "))
			}
		}
		fmt.Printf("\n%d판 — 부상 줄 %d · 퇴장 줄 %d · 교체 줄 %d · 인원이 11명이 아니었던 경기 %d\n",
			*audit, inj, red, sub, short)
		return
	}

	if *all {
		// K리그1 12개 구단을 한 바퀴 돌린다 (i번째 홈 vs i+1번째 원정)
		var raw struct {
			Order struct {
				K1 []string `json:"k1"`
				K2 []string `json:"k2"`
			} `json:"order"`
		}
		readJSON(filepath.Join(*root, "data", "teams.json"), &raw)
		ids := append(append([]string{}, raw.Order.K1...), raw.Order.K2[:4]...)
		pairs := [][2]string{}
		for i := 0; i < len(ids); i++ {
			pairs = append(pairs, [2]string{ids[i], ids[(i+1)%len(ids)]})
		}
		batch(vm, play, pairs)
		return
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
		if i == 0 {
			// 시드도 함께 — 브라우저 결과창의 시드와 맞춰 보면 라인업이 같은지 바로 안다
			fmt.Printf("  %s vs %s  (시드 %x)\n", str(r["hName"]), str(r["aName"]), int64(num(r["seed"])))
		}
		fmt.Printf("  %v : %v  (%.0f분 · 이벤트 %v건 · 주심 %v)  %v\n",
			r["hg"], r["ag"], num(r["clock"])/60, r["events"], r["ref"], time.Since(t0).Round(time.Millisecond))
		fmt.Printf("    슈팅 %v:%v · 패스 %v:%v · 파울 %v:%v · 점유 %v%%\n",
			r["hShot"], r["aShot"], r["hPass"], r["aPass"], r["hFoul"], r["aFoul"], r["poss"])
		if g := str(r["goals"]); g != "" {
			fmt.Printf("    득점: %s\n", g)
		}
		fmt.Printf("    클립 %v · 프레임 %.0f장 · %.0fKB\n      %s\n",
			r["clipsIsArr"], num(r["clipFrames"]), num(r["bytes"])/1024, str(r["clipKinds"]))
		// 부상·퇴장·교체는 한 판에서도 보고 싶다 (-audit 은 여러 판을 볼 때 쓴다)
		if lines, ok := r["subLog"].([]any); ok && len(lines) > 0 {
			for _, l := range lines {
				fmt.Printf("    · %v\n", l)
			}
		}
		fmt.Printf("    자막 %v줄 (문자중계 %v줄)\n", r["capCount"], r["events"])
		if cs, ok := r["capSample"].([]any); ok {
			for _, c := range cs {
				fmt.Printf("      · %v\n", c)
			}
		}
		if p := str(r["onPitch"]); p != "" && p != "11v11" {
			fmt.Printf("    필드 인원: %s\n", p)
		}
		if c := str(r["idCheck"]); c != "" {
			fmt.Printf("    %s\n", c)
			if strings.Contains(c, "어긋남") {
				fail("선수 id 가 상대 팀 쪽에 섞였습니다 — " + c)
			}
		}
		if rr, ok := r["react"].([]any); ok {
			for _, l := range rr {
				fmt.Printf("    %v\n", l)
			}
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

/* ── 여러 대진을 돌려 실제 축구와 견줘 본다 ─────────────────────
   K리그 실측 기준 (2023~2025 평균):
     경기당 골 2.6~2.8 · 팀당 슈팅 11~13 · 유효슈팅 비율 33% · 유효슈팅 대비 득점 30% */
func batch(vm *goja.Runtime, play goja.Callable, pairs [][2]string) {
	var g, sh, on, n float64
	hat, maxOne := 0, 0
	best := ""
	fmt.Printf("%-22s %-9s %s\n", "대진", "결과", "슈팅 · 유효 · 득점자")
	for _, p := range pairs {
		v, err := play(goja.Undefined(), vm.ToValue(p[0]), vm.ToValue(p[1]))
		if err != nil {
			fail("경기 중 오류: " + err.Error())
		}
		r := v.Export().(map[string]any)
		hg, ag := num(r["hg"]), num(r["ag"])
		g += hg + ag
		sh += num(r["hShot"]) + num(r["aShot"])
		on += num(r["hOn"]) + num(r["aOn"])
		n += 2

		top, topN := "", 0
		if sc, ok := r["scorers"].(map[string]any); ok {
			for who, c := range sc {
				if int(num(c)) > topN {
					topN, top = int(num(c)), who
				}
			}
		}
		if topN >= 3 {
			hat++
		}
		if topN > maxOne {
			maxOne, best = topN, top+" ("+p[0]+" vs "+p[1]+")"
		}
		fmt.Printf("%-22s %.0f : %-5.0f  %.0f/%.0f · %.0f/%.0f · 최다 %s %d골\n",
			p[0]+" vs "+p[1], hg, ag,
			num(r["hShot"]), num(r["aShot"]), num(r["hOn"]), num(r["aOn"]), top, topN)
	}
	m := n / 2
	fmt.Printf("\n── %d경기 합계 ──────────────────────────────\n", int(m))
	fmt.Printf("  경기당 골      %.2f   (K리그 실측 2.6~2.8)\n", g/m)
	fmt.Printf("  팀당 슈팅      %.1f    (11~13)\n", sh/n)
	fmt.Printf("  유효슈팅 비율  %.0f%%    (33%%)\n", on/sh*100)
	fmt.Printf("  유효슈팅→득점  %.0f%%    (30%%)\n", g/on*100)
	fmt.Printf("  해트트릭       %d경기 / %d   (실제로는 50~100경기에 한 번)\n", hat, int(m))
	fmt.Printf("  한 경기 최다   %s\n", best)
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
