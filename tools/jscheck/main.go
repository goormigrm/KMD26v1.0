// JS 문법 검사기
//
// 이 저장소에는 로컬 JS 런타임(Node 등)이 없습니다. 그래서 페이지를 고친 뒤
// "괄호가 안 맞는다" 같은 것을 브라우저를 열어야만 알 수 있었습니다.
// goja 로 **컴파일만** 해서 그걸 먼저 잡습니다. 실행은 하지 않습니다 —
// DOM 도 fetch 도 없으니 실행은 어차피 안 되고, 여기서 보려는 건 문법뿐입니다.
//
// .js 파일과 .html 안의 <script> 블록을 모두 봅니다.
// ESM(import/export)은 goja 가 모르므로 검사 전에 걷어냅니다.
//
// 사용: go run ./tools/jscheck ../../src ../../test ../../squad.html
package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/dop251/goja"
)

var (
	reScript = regexp.MustCompile(`(?is)<script([^>]*)>(.*?)</script>`)
	reSrc    = regexp.MustCompile(`(?i)\bsrc\s*=`)
	reImport = regexp.MustCompile(`(?m)^\s*import\s[^;]*;?\s*$`)
	reExport = regexp.MustCompile(`(?m)^\s*export\s+`)
)

func main() {
	targets := os.Args[1:]
	if len(targets) == 0 {
		targets = []string{"."}
	}
	bad := 0
	seen := 0

	for _, t := range targets {
		filepath.WalkDir(t, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d == nil || d.IsDir() {
				return nil
			}
			// 자동 생성물은 건너뛴다 — 커널은 6천 줄이고 추출기가 이미 검사한다
			if strings.Contains(filepath.ToSlash(p), "/data/gen.js") {
				return nil
			}
			switch strings.ToLower(filepath.Ext(p)) {
			case ".js":
				seen++
				if !check(p, "", read(p)) {
					bad++
				}
			case ".html":
				for i, m := range reScript.FindAllStringSubmatch(read(p), -1) {
					if reSrc.MatchString(m[1]) || strings.TrimSpace(m[2]) == "" {
						continue // 외부 스크립트 참조는 볼 것이 없다
					}
					seen++
					if !check(p, fmt.Sprintf(" <script> #%d", i+1), m[2]) {
						bad++
					}
				}
			}
			return nil
		})
	}

	if bad > 0 {
		fmt.Printf("\n실패 %d개 / 검사 %d개\n", bad, seen)
		os.Exit(1)
	}
	fmt.Printf("OK %d개 스크립트 문법 이상 없음\n", seen)
}

func read(p string) string {
	b, err := os.ReadFile(p)
	if err != nil {
		fmt.Fprintf(os.Stderr, "읽지 못함 %s: %v\n", p, err)
		return ""
	}
	return string(b)
}

func check(path, where, code string) bool {
	// ESM 은 goja 가 모른다. 문법만 볼 것이므로 걷어내도 검사 목적에는 지장이 없다.
	code = reImport.ReplaceAllString(code, "")
	code = reExport.ReplaceAllString(code, "")
	if _, err := goja.Compile(path, code, false); err != nil {
		fmt.Printf("✗ %s%s\n  %v\n", path, where, err)
		return false
	}
	return true
}
