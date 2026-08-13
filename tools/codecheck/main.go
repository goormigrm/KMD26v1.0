// 대전 코드 검사 (단계 5)
//
// 코드 규격을 Go 로 **다시 옮겨 적지 않습니다.** 두 벌을 유지하면 반드시 어긋나고,
// 어긋난 코드는 "조용히 다른 라인업으로 해석되는" 최악의 결과를 냅니다(설계서 4-2).
// 대신 goja 로 src/codec/duelcode.js 를 그대로 돌려서 규격이 지켜지는지 확인합니다.
//
//	① 왕복  — 라인업 → 코드 → 라인업 → 코드 가 한 글자도 다르지 않은가
//	② 규격  — 접두어 · 51자 · Base64url 글자만
//	③ 손상  — 한 글자를 바꾸면 반드시 거부되는가 (체크섬)
//	④ 벡터  — 정해진 라인업이 정해진 코드가 되는가 (규격이 조용히 바뀌는 것을 막는다)
//
// 사용: go run . -root ../..
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

// 코덱은 커널을 부르지 않는다 — 이어 붙일 것이 teams.js 뿐이다
var modules = []string{
	"src/codec/duelcode.js",
	"src/engine/teams.js",
}

var (
	reImport = regexp.MustCompile(`(?m)^\s*import\s[^;]*;?\s*$`)
	reExport = regexp.MustCompile(`(?m)^\s*export\s+(?:\{[^}]*\}\s*;?\s*$)?`)
)

const driver = `
/* 표는 Go 가 나중에 넣어 준다 — 불릴 때 묶는다 (올릴 때 묶으면 아직 없다) */
var CTX = null;
function ctx() {
  if (!CTX) CTX = {order: ORDER, tables: TABLES, players: PLAYERS, dataHash: DATAHASH};
  return CTX;
}

/* 검사용 라인업 한 벌 — 자동 배치에 역할·임무·슬라이더를 얹는다 */
function makePlan(teamId, form, roleShift) {
  var lu = autoLineup(PLAYERS[teamId], TABLES, form);
  var slots = slotOrder(ctx(), form);
  var roles = {};
  for (var i = 0; i < slots.length; i++) {
    var opts = rolesFor(ctx(), slots[i]);
    var R = opts[(i + roleShift) % opts.length];
    roles[lu.xi[slots[i]]] = {r: R.k, d: R.duty[(i + roleShift) % R.duty.length]};
  }
  var tac = {formation: form, counter: roleShift % 2 === 1};
  for (var k = 0; k < TABLES.tacKeys.length; k++) tac[TABLES.tacKeys[k]] = (k + roleShift) % 5;
  return {id: teamId, xiMap: lu.xi, bench: lu.bench, tac: tac, roles: roles,
          cond: [roleShift % 256, 0, 0, 0, 0, 0]};
}

function checkOne(teamId, form, roleShift) {
  var plan = makePlan(teamId, form, roleShift);
  var code = encodePlan(plan, ctx());
  var back = decodePlan(code, ctx());
  var again = encodePlan(back, ctx());
  /* ⚠ Base64url 글자에 - 가 있으므로 split("-") 로 자르면 몸통이 잘린다.
     첫 - 뒤 전부가 몸통이다. */
  var body = code.slice(code.indexOf("-") + 1);
  var out = {code: code, roundTrip: code === again, len: body.length};

  // 되돌린 라인업이 내용까지 같은가
  var same = back.id === plan.id && back.tac.formation === form;
  var slots = slotOrder(ctx(), form);
  for (var i = 0; i < slots.length; i++) if (back.xiMap[slots[i]] !== plan.xiMap[slots[i]]) same = false;
  for (var b = 0; b < 9; b++) if ((back.bench[b] || null) !== (plan.bench[b] || null)) same = false;
  for (var k = 0; k < TABLES.tacKeys.length; k++)
    if (back.tac[TABLES.tacKeys[k]] !== plan.tac[TABLES.tacKeys[k]]) same = false;
  if (back.tac.counter !== plan.tac.counter) same = false;
  for (var i2 = 0; i2 < slots.length; i2++) {
    var pid = plan.xiMap[slots[i2]];
    var a = plan.roles[pid], c = back.roles[pid];
    if (!c || a.r !== c.r || a.d !== c.d) same = false;
  }
  for (var c2 = 0; c2 < 6; c2++) if (plan.cond[c2] !== back.cond[c2]) same = false;
  out.same = same;

  // 한 글자를 바꾸면 거부되어야 한다
  var pos = 7 % body.length;
  var ch = body[pos] === "A" ? "B" : "A";
  var broken = code.slice(0, code.indexOf("-") + 1) + body.slice(0, pos) + ch + body.slice(pos + 1);
  out.rejects = false;
  try { decodePlan(broken, ctx()); } catch (err) { out.rejects = true; out.why = String(err.message || err); }
  return out;
}

/* 정해진 벡터 — 규격이 조용히 바뀌면 이 값이 달라진다 */
function vector() {
  return encodePlan(makePlan("ulsan", "4-3-3", 0), ctx());
}
`

func main() {
	root := flag.String("root", ".", "저장소 루트")
	vec := flag.String("vector", "", "이 코드와 같아야 한다 (비우면 값만 찍는다)")
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
		fail("코덱을 올리지 못했습니다: " + err.Error())
	}

	var teams struct {
		Order  map[string]any `json:"order"`
		Tables map[string]any `json:"tables"`
	}
	readJSON(filepath.Join(*root, "data", "teams.json"), &teams)
	var players map[string]any
	readJSON(filepath.Join(*root, "data", "players.json"), &players)
	var meta struct {
		DataHash string `json:"dataHash"`
	}
	readJSON(filepath.Join(*root, "data", "meta.json"), &meta)

	vm.Set("ORDER", teams.Order)
	vm.Set("TABLES", teams.Tables)
	vm.Set("PLAYERS", players)
	vm.Set("DATAHASH", meta.DataHash)

	check, ok := goja.AssertFunction(vm.Get("checkOne"))
	if !ok {
		fail("checkOne 을 찾지 못했습니다")
	}

	// 12개 포메이션 × 구단 몇 곳 × 역할 배치 몇 가지
	var forms []string
	if f, ok := teams.Tables["formation"].(map[string]any); ok {
		for k := range f {
			forms = append(forms, k)
		}
	}
	ids := []string{"ulsan", "anyang", "gimhae", "seoul"}
	n, bad := 0, 0
	for _, id := range ids {
		for _, f := range forms {
			for shift := 0; shift < 3; shift++ {
				v, err := check(goja.Undefined(), vm.ToValue(id), vm.ToValue(f), vm.ToValue(shift))
				if err != nil {
					fail("검사 중 오류(" + id + " " + f + "): " + err.Error())
				}
				r := v.Export().(map[string]any)
				n++
				if r["roundTrip"] != true || r["same"] != true || r["rejects"] != true ||
					int(num(r["len"])) != 51 {
					bad++
					fmt.Printf("  ❌ %s %s shift=%d  왕복=%v 내용=%v 손상거부=%v 길이=%v\n",
						id, f, shift, r["roundTrip"], r["same"], r["rejects"], r["len"])
				}
			}
		}
	}
	fmt.Printf("왕복·손상 검사 %d건 — %s\n", n, okMsg(bad))

	vf, _ := goja.AssertFunction(vm.Get("vector"))
	vv, err := vf(goja.Undefined())
	if err != nil {
		fail("벡터를 만들지 못했습니다: " + err.Error())
	}
	got := vv.String()
	fmt.Printf("테스트 벡터 (ulsan · 4-3-3 · shift 0)\n  %s\n", got)
	if *vec != "" && *vec != got {
		fail("벡터가 다릅니다 — 규격이 바뀌었습니다\n  기대 " + *vec + "\n  실제 " + got)
	}
	if bad > 0 {
		os.Exit(1)
	}
}

func okMsg(bad int) string {
	if bad == 0 {
		return "전부 통과"
	}
	return fmt.Sprintf("%d건 실패", bad)
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
