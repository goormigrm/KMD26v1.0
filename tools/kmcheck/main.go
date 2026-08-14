// KM26 세이브 읽기 검사
//
// src/km26/kmsave.js 를 goja 로 그대로 돌려서, 진짜 KM26 세이브 파일이
// KMD26 명단·전술로 온전히 옮겨지는지 확인합니다. 규격을 Go 로 다시 옮겨 적지 않습니다.
//
//	① 세이브를 읽는가 · 구단 수·선수 수가 맞는가
//	② KMD26 이 쓰는 18개 필드가 한 명도 빠지지 않는가
//	③ 손으로 정한 자리(tactic.slot)가 그대로 살아 오는가
//	④ 선발 열한 자리가 다 차고 골키퍼가 있는가 · 교체 아홉 칸이 차는가
//	⑤ 역습 단계가 0~4 로 오는가
//	⑥ 팩 검사(checkPack)를 통과하는가
//
// 사용: go run . -root ../.. -save "C:\...\klm2026_안양_2026_20260814.json"
//
//	세이브는 저장소에 두지 않습니다(남의 시즌 기록입니다). -save 를 안 주면 건너뜁니다.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/dop251/goja"
)

// kmsave.js 는 duelcode.js 의 ctrLevel 을 쓴다. teams.js 는 autoLineup 을 준다.
var modules = []string{
	"src/codec/duelcode.js",
	"src/engine/teams.js",
	"src/km26/kmsave.js",
}

var (
	reImport = regexp.MustCompile(`(?m)^\s*import\s[^;]*;?\s*$`)
	reExport = regexp.MustCompile(`(?m)^\s*export\s+(?:\{[^}]*\}\s*;?\s*$)?`)
)

const driver = `
function run(text) {
  var r = readSave(text);
  if (!r.ok) return {ok:false, why:r.why};
  var G = r.G;
  var info = saveInfo(G);
  var teams = teamListOf(G);

  /* 모든 구단에서 필드가 빠지지 않았는지 */
  var missing = {}, thin = [];
  for (var i = 0; i < teams.length; i++) {
    var sq = squadOf(teams[i], META);
    if (sq.length < 11) thin.push(teams[i].id + "(" + sq.length + ")");
    for (var j = 0; j < sq.length; j++) {
      for (var k = 0; k < PLAYER_KEEP.length; k++) {
        var key = PLAYER_KEEP[k];
        /* gkA 는 골키퍼만 가진다 — 빠져도 정상이다 */
        if (key === "gkA" && sq[j].pos !== "GK") continue;
        if (sq[j][key] === undefined) missing[key] = (missing[key] || 0) + 1;
      }
      if (typeof sq[j].star !== "number") missing["star"] = (missing["star"] || 0) + 1;
    }
  }

  /* 유저 팀으로 팩을 만들어 본다 */
  var mk = makePack(G, G.userTeamId, TABLES, META, autoLineup);
  if (!mk.ok) return {ok:false, why:"팩을 못 만들었습니다 — " + mk.why};
  var bad = checkPack(mk.pack, TABLES);

  var slots = ["GK"];
  var fs = TABLES.formation[mk.pack.plan.formation];
  for (var s = 0; s < fs.length; s++) slots.push(fs[s][1]);
  var filled = 0, benchN = 0;
  for (var q = 0; q < slots.length; q++) if (mk.pack.plan.xi[slots[q]] != null) filled++;
  for (var b = 0; b < mk.pack.plan.bench.length; b++) if (mk.pack.plan.bench[b] != null) benchN++;

  /* 세이브의 tactic.slot 이 그대로 살아 있는가 */
  var me = null;
  for (var t2 = 0; t2 < teams.length; t2++) if (teams[t2].id === G.userTeamId) me = teams[t2];
  var wantSlot = me.tactic.slot || {}, keptOK = 0, keptAll = 0;
  for (var pid in wantSlot) {
    keptAll++;
    if (mk.pack.plan.xi[wantSlot[pid]] === +pid) keptOK++;
  }

  /* 모든 구단으로 팩을 만들 수 있는가 */
  var packFail = [];
  for (var z = 0; z < teams.length; z++) {
    var m2 = makePack(G, teams[z].id, TABLES, META, autoLineup);
    if (!m2.ok) { packFail.push(teams[z].id + ": " + m2.why); continue; }
    var b2 = checkPack(m2.pack, TABLES);
    if (b2) packFail.push(teams[z].id + ": " + b2);
  }

  return {
    ok: true, info: info, missing: missing, thin: thin.join(","),
    formation: mk.pack.plan.formation,
    xiFilled: filled, xiNeed: slots.length, benchN: benchN,
    counter: mk.pack.plan.tac.counter,
    keptOK: keptOK, keptAll: keptAll,
    note: mk.note, checkPack: bad || "", packFail: packFail.join(" | "),
    squadN: mk.pack.squad.length,
    packBytes: JSON.stringify(mk.pack).length,
    slimBytes: JSON.stringify(slimPack(mk.pack)).length,
    /* 줄였다 되살리면 원래대로 돌아오는가 — 한쪽만 고치면 능력치가 조용히 빈다 */
    slimRT: (function(){
      var back = fatten(slimPack(mk.pack));
      var keep = {};
      for (var s3 in mk.pack.plan.xi) keep[mk.pack.plan.xi[s3]] = 1;
      for (var b3 = 0; b3 < mk.pack.plan.bench.length; b3++)
        if (mk.pack.plan.bench[b3] != null) keep[mk.pack.plan.bench[b3]] = 1;
      var n = 0, diff = [];
      for (var i3 = 0; i3 < mk.pack.squad.length; i3++) {
        var a = mk.pack.squad[i3];
        if (!keep[a.id]) continue;
        n++;
        var c = null;
        for (var j3 = 0; j3 < back.squad.length; j3++) if (back.squad[j3].id === a.id) c = back.squad[j3];
        if (!c) { diff.push(a.name + ": 사라짐"); continue; }
        for (var ak in a.attr) if (a.attr[ak] !== c.attr[ak]) diff.push(a.name + ".attr." + ak);
        for (var fk in a.posFam) if ((a.posFam[fk] || 0) !== (c.posFam[fk] || 0)) diff.push(a.name + ".posFam." + fk);
        if ((a.traits || []).join() !== (c.traits || []).join()) diff.push(a.name + ".traits");
        if (a.star !== c.star || a.ovr !== c.ovr || a.pos !== c.pos) diff.push(a.name + ".기본값");
      }
      return {n: n, diff: diff.slice(0, 5).join(", "), diffN: diff.length};
    })()
  };
}
`

func main() {
	root := flag.String("root", ".", "저장소 루트")
	save := flag.String("save", "", "KM26 세이브 파일 경로 (없으면 건너뜀)")
	flag.Parse()

	if *save == "" {
		fmt.Println("세이브 파일을 안 줬습니다 — 건너뜁니다 (-save 로 지정)")
		return
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
		fail("모듈을 올리지 못했습니다: " + err.Error())
	}

	var teams struct {
		Tables map[string]any `json:"tables"`
	}
	readJSON(filepath.Join(*root, "data", "teams.json"), &teams)
	var meta map[string]any
	readJSON(filepath.Join(*root, "data", "meta.json"), &meta)
	vm.Set("TABLES", teams.Tables)
	vm.Set("META", meta)

	raw, err := os.ReadFile(*save)
	if err != nil {
		fail("세이브를 읽지 못했습니다: " + err.Error())
	}
	fmt.Printf("세이브 %s (%.1f KB)\n", filepath.Base(*save), float64(len(raw))/1024)

	run, ok := goja.AssertFunction(vm.Get("run"))
	if !ok {
		fail("run 을 찾지 못했습니다")
	}
	v, err := run(goja.Undefined(), vm.ToValue(string(raw)))
	if err != nil {
		fail("검사 중 오류: " + err.Error())
	}
	r := v.Export().(map[string]any)

	if r["ok"] != true {
		fail(fmt.Sprintf("%v", r["why"]))
	}

	bad := 0
	info := r["info"].(map[string]any)
	fmt.Printf("  시즌 %v · 내 구단 %v · 구단 %v개 · 선수 %v명 (%v)\n",
		info["season"], info["userTeamName"], info["teamCount"], info["playerCount"], info["phase"])

	miss := r["missing"].(map[string]any)
	if len(miss) == 0 {
		fmt.Println("  KMD26 이 쓰는 18개 필드 — 한 명도 안 빠짐 ✔")
	} else {
		bad++
		fmt.Printf("  ❌ 빠진 필드: %v\n", miss)
	}
	if s, _ := r["thin"].(string); s != "" {
		fmt.Printf("  ⚠ 선수가 11명 미만인 구단: %s\n", s)
	}

	note := r["note"].(map[string]any)
	fmt.Printf("  %v — 선발 %v/%v (세이브가 정한 자리 %v · 자동 %v) · 교체 %v칸 (세이브 %v · 자동 %v)\n",
		r["formation"], r["xiFilled"], r["xiNeed"], note["keptSlots"], note["autoXI"],
		r["benchN"], note["benchFromSave"], note["benchAuto"])
	if num(r["xiFilled"]) != num(r["xiNeed"]) {
		bad++
		fmt.Println("  ❌ 선발 자리가 다 안 찼습니다")
	}
	if num(r["benchN"]) != 9 {
		bad++
		fmt.Println("  ❌ 교체 아홉 칸이 다 안 찼습니다")
	}
	if num(r["keptAll"]) > 0 && num(r["keptOK"]) != num(r["keptAll"]) {
		bad++
		fmt.Printf("  ❌ 손으로 정한 자리 %v곳 중 %v곳만 살아왔습니다\n", r["keptAll"], r["keptOK"])
	} else {
		fmt.Printf("  손으로 정한 자리 %v곳 전부 그대로 ✔\n", r["keptAll"])
	}

	c := num(r["counter"])
	if c < 0 || c > 4 {
		bad++
		fmt.Printf("  ❌ 역습 단계가 %v 입니다 (0~4 여야 합니다)\n", r["counter"])
	} else {
		fmt.Printf("  역습 단계 %v (세이브에서 옴: %v) ✔\n", r["counter"], note["counterFromSave"])
	}
	if v, _ := r["roleSkip"].(int64); v > 0 {
		fmt.Printf("  ⚠ 그 자리에서 못 맡는 역할 %d개는 버렸습니다\n", v)
	}

	if s, _ := r["checkPack"].(string); s != "" {
		bad++
		fmt.Printf("  ❌ 팩 검사 실패: %s\n", s)
	}
	if s, _ := r["packFail"].(string); s != "" {
		bad++
		fmt.Printf("  ❌ 팩을 못 만든 구단: %s\n", s)
	} else {
		fmt.Println("  29개 구단 전부 팩으로 만들어짐 ✔")
	}

	fmt.Printf("  팩 크기 — 명단 전체(%v명) %.1f KB · 게시판용(스무 명·줄임) %.1f KB\n",
		r["squadN"], num(r["packBytes"])/1024, num(r["slimBytes"])/1024)

	rt := r["slimRT"].(map[string]any)
	if num(rt["diffN"]) > 0 {
		bad++
		fmt.Printf("  ❌ 줄였다 되살리니 %v곳이 다릅니다: %v\n", rt["diffN"], rt["diff"])
	} else {
		fmt.Printf("  줄였다 되살려도 스무 명 %v 값이 그대로 ✔\n", rt["n"])
	}

	if bad > 0 {
		fmt.Printf("검사 %d건 실패\n", bad)
		os.Exit(1)
	}
	fmt.Println("전부 통과")
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

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "중단: "+msg)
	os.Exit(1)
}
