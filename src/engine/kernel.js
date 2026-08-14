/* ─────────────────────────────────────────────────────────────
   KMD26 엔진 커널 — 자동 생성 파일. 직접 수정하지 마세요.
   생성: tools/extract_engine.py
   원본: KM26 v2.0 (KleagueM2026/KM26v2.0) — 원저작자 허락 하에 사용
   원본 해시: sha256:d18fe0dfc09c
   추출 선언 347개 / 6103줄
   난수 시드화: Math.random() 127곳 → RNG()
   ⚠ 전역 상태(G)·UI 함수는 src/engine/stubs.js 가 제공합니다.
   ⚠ 이건 원본 그대로입니다. 듀얼 버그 수정은 tools/patch_kernel.py 가 붙입니다.

   ── 듀얼 패치 (tools/patch_kernel.py) ─────────────────────────
   원본(kernel.raw.js) 해시: sha256:47ccdcb1e19e
   · [전술] PASS-01   2D 엔진이 팀 전술 '패스 길이'를 읽지 않는다 — 패스 목표 선택에 연결
   · [전술] PASS-02   같은 슬라이더를 패스 실행(길게 띄우는 문턱)에도 연결 — 목표만 바꾸면 걷어차는 모양이 안 따라온다
   · [전술] PASS-03   '몇 m부터 길게 차는가' 문턱도 팀 전술을 따르게 — 원본은 선수 특성만 읽는다
   · [버그] PRESS-01  압박 계수가 '압박당하는 쪽'의 지시로 계산된다 — 압박을 올리면 우리 선수가 더 눌린 것처럼 나온다
   · [전술] PRESS-02  압박이 태클 시도 빈도에 연결돼 있지 않다 — 높은 압박은 더 자주 달려드는 것이다
   · [전술] MENT-01   공격적 멘탈리티인데 슈팅이 오히려 줄었다 — 슛 판단에 붙는 항이 ±0.06 으로 사실상 없었다
   · [버그] TEMPO-01  전술이 3단계에서 5단계로 바뀔 때 tempoK 계수가 안 따라왔다 — 폭도 절반, 중립점도 어긋나 있었다
   · [버그] PK-01     kickoff() 이 b.isPenalty 를 지우지 않아, PK 다음 킥오프가 센터서클에서 '페널티킥'이 된다
   · [버그] PK-02     PK 득점이 VAR 로 취소된다. PK 는 오프사이드도 빌드업 반칙도 있을 수 없다 (분 단위 엔진에는 isPen 가드가 있다)
   · [버그] PK-03     90분이 되는 순간 루프가 끝나 버려, 종료 직전에 선언된 PK 가 실행되지 않는다
   · [버그] SUB-01    교체 투입이 벤치 순서(S1~S9)와 자리 능숙도를 무시한다 — 스트라이커가 센터백 자리에 서고, 부상으로 빈 자리는 끝까지 안 채워진다
   · [버그] SUB-02    부상으로 빈 자리를 45분 전에는 아예 보지 않는다 — 전반에 다치면 남은 시간을 열 명으로 뛴다
   · [보류] WIDTH-01  크로스 판단 문턱이 팀 '폭'을 읽지 않는다 (수정안이 역효과라 보류)
   ⚠ 듀얼 고유 규칙(파울 누적·퇴장 체력)은 여기가 아니라 src/engine/rules.js 에 있습니다.
   ───────────────────────────────────────────────────────────── */
import { RNG } from "./rng.js?v=8becaaf894";

const R = (n)=>Math.floor(RNG()*n);

const pick = (a)=>a[R(a.length)];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const FORMATION_SHAPE={
  "4-3-3":   [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["FW","LW"],["FW","ST"],["FW","RW"]],
  "4-4-2":   [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["FW","LS"],["FW","RS"]],
  "4-2-3-1": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["DM","LDM"],["DM","RDM"],["AM","LAM"],["AM","CAM"],["AM","RAM"],["FW","ST"]],
  "4-1-4-1": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["DM","DM"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["FW","ST"]],
  "4-2-2-2": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["DM","LDM"],["DM","RDM"],["AM","LAM"],["AM","RAM"],["FW","LS"],["FW","RS"]],
  "4-3-1-2": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["AM","CAM"],["FW","LS"],["FW","RS"]],
  "4-4-1-1": [["DF","LB"],["DF","LCB"],["DF","RCB"],["DF","RB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["AM","CAM"],["FW","ST"]],
  "3-5-2":   [["DF","LCB"],["DF","CB"],["DF","RCB"],["WB","LWB"],["WB","RWB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["FW","LS"],["FW","RS"]],
  "5-3-2":   [["DF","LB"],["DF","LCB"],["DF","CB"],["DF","RCB"],["DF","RB"],["MF","LCM"],["MF","CM"],["MF","RCM"],["FW","LS"],["FW","RS"]],
  "5-2-1-2": [["DF","LB"],["DF","LCB"],["DF","CB"],["DF","RCB"],["DF","RB"],["DM","LDM"],["DM","RDM"],["AM","CAM"],["FW","LS"],["FW","RS"]],
  "3-4-3":   [["DF","LCB"],["DF","CB"],["DF","RCB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["FW","LW"],["FW","ST"],["FW","RW"]],
  "3-4-2-1": [["DF","LCB"],["DF","CB"],["DF","RCB"],["MF","LM"],["MF","LCM"],["MF","RCM"],["MF","RM"],["AM","LAM"],["AM","RAM"],["FW","ST"]]
};
/* 포메이션을 팀에 적용한다 — 선발 11명을 뽑고, 각자 어울리는 라인·슬롯에 앉힌다. */

const MENT_ATTRS=["agg","ant","bra","cmp","cnt","dec","det","fla","ldr","otb","pos","tea","vis","wor"];

const PHYS_ATTRS=["acc","agi","bal","jum","nat","pac","sta","str"];

function attr20(raw){ return clamp(Math.round((raw||0)/5), 1, 20); }
/* 사기·컨디션처럼 내부적으로는 소수로 굴러가는 값을 화면에 찍을 때 쓴다 */

const ROLE_GRP={ GK:"GK", SW:"SW", LCB:"CB", RCB:"CB", CB:"CB",
                 LB:"FB", RB:"FB", LWB:"WB", RWB:"WB",
                 LDM:"CM", DM:"CM", RDM:"CM",
                 LCM:"CM", RCM:"CM", CM:"CM", LM:"WIDE", RM:"WIDE",
                 LAM:"AM", CAM:"AM", RAM:"AM",
                 LW:"WIDE", RW:"WIDE", LS:"ST", RS:"ST", ST:"ST" };

const ROLES=[
 // ── 골키퍼
 {k:"G",  n:"골키퍼", e:"Goalkeeper", grp:["GK"], duty:["D"],
  key:["ref","one","han","cmd","pos","cnt","dec","agi"],
  fx:()=>({sweep:-0.35})},
 {k:"SK", n:"스위퍼 키퍼", e:"Sweeper Keeper", grp:["GK"], duty:["D","S","A"],
  key:["ref","one","cmd","kic","pas","fir","vis","cmp","acc"],
  fx:d=>({sweep: d==="A"?0.85 : d==="S"?0.50 : 0.22, killer: d==="A"?0.35:0.15})},
 // ── 스위퍼 (최후방 단독)
 {k:"SWP", n:"스위퍼", e:"Sweeper", grp:["SW"], duty:["D","S"],
  key:["pos","ant","cnt","dec","mar","tck","cmp","pac","acc"],
  fx:d=>({fwd: d==="S"?0.25:-0.20, roam: d==="S"?0.35:0.15,
          sweepBack:1, tightMark:-1, killer: d==="S"?0.30:0.05, press:-0.25})},
 {k:"LSW",n:"리베로", e:"Libero", grp:["SW"], duty:["D","S","A"],
  key:["pos","ant","dec","pas","fir","tec","cmp","dri","tck"],
  fx:d=>({fwd: d==="A"?0.75 : d==="S"?0.45:0.10, roam: d==="A"?0.85:0.55,
          sweepBack:1, pm:0.55, dribble:0.35, killer:0.40, press:-0.15})},
 {k:"BPS",n:"볼 플레잉 스위퍼", e:"Ball Playing Sweeper", grp:["SW"], duty:["D","S"],
  key:["pos","ant","pas","fir","vis","tec","cmp","dec"],
  fx:d=>({fwd: d==="S"?0.25:-0.10, sweepBack:1, pm:0.65, killer:0.55, longPass:1, press:-0.2})},
 {k:"NSW",n:"안정형 스위퍼", e:"No-Nonsense Sweeper", grp:["SW"], duty:["D"],
  key:["pos","ant","mar","tck","hea","str","cnt","bra"],
  fx:()=>({fwd:-0.30, sweepBack:1, killer:-0.8, clearFirst:1, press:-0.1})},
 // ── 중앙 수비
 {k:"CD", n:"중앙 수비수", e:"Central Defender", grp:["CB"], duty:["D","St","Cv"],
  key:["mar","tck","hea","pos","str","jum","cnt","bra"],
  fx:d=>({fwd: d==="St"?0.18 : d==="Cv"?-0.18 : 0, press: d==="St"?0.35:0, tightMark:d==="St"?1:0})},
 {k:"BPD",n:"공격형 수비수", e:"Ball Playing Defender", grp:["CB"], duty:["D","St","Cv"],
  key:["mar","tck","hea","pos","pas","fir","vis","tec"],
  fx:d=>({fwd: d==="St"?0.15 : d==="Cv"?-0.15 : 0, killer:0.45, pm:0.5})},
 {k:"NCB",n:"안정형 수비수", e:"No-Nonsense Centre-Back", grp:["CB"], duty:["D","St","Cv"],
  key:["mar","tck","hea","pos","str","jum","bra"],
  fx:d=>({fwd: d==="St"?0.15:0, killer:-0.9, shortPass:1, clearFirst:1})},
 {k:"L",  n:"리베로", e:"Libero", grp:["CB"], duty:["D","S"],
  key:["mar","tck","pos","pas","fir","tec","vis","cmp","dri"],
  fx:d=>({fwd: d==="S"?0.55:0.30, roam:0.6, dribble:0.35, pm:0.4})},
 {k:"WCB",n:"와이드 센터백", e:"Wide Centre-Back", grp:["CB"], duty:["D","S","A"],
  key:["mar","tck","hea","pos","crs","dri","sta","pac"],
  fx:d=>({fwd: d==="A"?0.55 : d==="S"?0.30 : 0.05, wide:0.55, cross:0.4})},
 // ── 측면 수비
 {k:"FB", n:"풀백", e:"Full-Back", grp:["FB"], duty:["D","S","A"],
  key:["mar","tck","pos","crs","pac","sta","wor","tea"],
  fx:d=>({fwd: d==="A"?0.55 : d==="S"?0.25 : -0.05, wide:0.35, cross: d==="A"?0.35:0.15})},
 {k:"WB", n:"윙백", e:"Wing-Back", grp:["WB"], duty:["D","S","A"],
  key:["crs","dri","pac","sta","wor","tck","otb","tec"],
  fx:d=>({fwd: d==="A"?0.85 : d==="S"?0.55 : 0.20, wide:0.60, cross:0.45, dribble:0.25})},
 {k:"NFB",n:"안정형 풀백", e:"No-Nonsense Full-Back", grp:["FB"], duty:["D"],
  key:["mar","tck","pos","str","cnt","bra"],
  fx:()=>({fwd:-0.25, killer:-0.8, clearFirst:1, tightMark:1})},
 {k:"CWB",n:"완성형 윙백", e:"Complete Wing-Back", grp:["WB"], duty:["S","A"],
  key:["crs","dri","tec","pac","sta","wor","otb","fla"],
  fx:d=>({fwd: d==="A"?1.0:0.70, wide:0.65, cross:0.55, dribble:0.5, roam:0.35})},
 {k:"IWB",n:"인버티드 윙백", e:"Inverted Wing-Back", grp:["FB","WB"], duty:["D","S","A"],
  key:["pas","fir","tec","tck","pos","dec","vis"],
  fx:d=>({fwd: d==="A"?0.55 : d==="S"?0.30:0.05, wide:-0.55, pm:0.35, killer:0.2})},
 {k:"IFB",n:"인버티드 풀백", e:"Inverted Full-Back", grp:["FB"], duty:["D"],
  key:["mar","tck","pos","hea","str","cnt","dec"],
  fx:()=>({fwd:-0.20, wide:-0.70, killer:-0.4, tightMark:1, clearFirst:1})},
 // ── 중앙 미드필드
 {k:"DM", n:"수비형 미드필더", e:"Defensive Midfielder", grp:["CM"], duty:["D","S"],
  key:["tck","mar","pos","ant","cnt","tea","wor","str"],
  fx:d=>({fwd: d==="S"?0.10:-0.35, press:0.35, tightMark:1})},
 {k:"DLP",n:"딥라잉 플레이메이커", e:"Deep Lying Playmaker", grp:["CM"], duty:["D","S"],
  key:["pas","fir","vis","dec","tea","cmp","ant","tec"],
  fx:d=>({fwd: d==="S"?0.05:-0.30, pm:1.0, killer:0.45, longPass:1, deep:1})},
 {k:"BWM",n:"볼 위닝 미드필더", e:"Ball Winning Midfielder", grp:["CM"], duty:["D","S"],
  key:["tck","mar","agg","bra","wor","sta","tea","str"],
  fx:d=>({fwd: d==="S"?0.15:-0.20, press:0.85, slide:0.45, tightMark:1, killer:-0.3})},
 {k:"A",  n:"앵커", e:"Anchor Man", grp:["CM"], duty:["D"],
  key:["pos","ant","cnt","tck","mar","dec","tea","hea"],
  fx:()=>({fwd:-0.50, roam:-0.6, press:-0.25, shortPass:1, killer:-0.6})},
 {k:"HB", n:"하프백", e:"Half Back", grp:["CM"], duty:["D"],
  key:["pos","ant","tck","mar","pas","fir","cmp","tea"],
  fx:()=>({fwd:-0.70, roam:-0.4, pm:0.4, shortPass:1})},
 {k:"RGA",n:"레지스타", e:"Regista", grp:["CM"], duty:["S"],
  key:["pas","vis","fla","tec","dec","fir","wor","sta"],
  fx:()=>({fwd:0.10, roam:0.85, pm:1.0, killer:0.7, hold:0.4, press:-0.2})},
 {k:"RPM",n:"로밍 플레이메이커", e:"Roaming Playmaker", grp:["CM"], duty:["S"],
  key:["pas","dri","tec","vis","wor","sta","otb","dec"],
  fx:()=>({fwd:0.35, roam:1.0, pm:0.9, dribble:0.55, killer:0.35})},
 {k:"VOL",n:"세군도 볼란테", e:"Segundo Volante", grp:["CM"], duty:["S","A"],
  key:["tck","wor","sta","pac","lon","otb","str"],
  fx:d=>({fwd: d==="A"?0.60:0.25, roam:0.35, dribble:0.25, longShot:0.35})},
 {k:"CM", n:"중앙 미드필더", e:"Central Midfielder", grp:["CM"], duty:["D","S","A"],
  key:["pas","fir","tec","dec","tea","wor","sta","tck"],
  fx:d=>({fwd: d==="A"?0.45 : d==="S"?0.10 : -0.25, press: d==="D"?0.25:0})},
 {k:"BBM",n:"박스 투 박스 미드필더", e:"Box To Box Midfielder", grp:["CM"], duty:["S"],
  key:["wor","sta","pac","tck","pas","lon","otb","tea"],
  fx:()=>({fwd:0.45, roam:0.55, lateRun:1, longShot:0.4, press:0.3})},
 {k:"AP", n:"전진형 플레이메이커", e:"Advanced Playmaker", grp:["CM","WIDE","ST","AM"], duty:["S","A"],
  key:["pas","fir","tec","vis","dec","otb","cmp","fla"],
  fx:d=>({fwd: d==="A"?0.65:0.40, pm:1.0, killer:0.65, oneTwo:1})},
 {k:"MEZ",n:"메짤라", e:"Mezzala", grp:["CM","AM"], duty:["S","A"],
  key:["dri","pas","tec","otb","fla","wor","acc"],
  fx:d=>({fwd: d==="A"?0.60:0.35, wide:0.40, roam:0.5, dribble:0.4, killer:0.3})},
 {k:"CAR",n:"카릴레로", e:"Carrilero", grp:["CM"], duty:["S"],
  key:["tea","wor","sta","pas","pos","tck","dec"],
  fx:()=>({fwd:0.05, wide:0.35, roam:-0.3, press:0.25})},
 // ── 측면
 {k:"WM", n:"측면 미드필더", e:"Wide Midfielder", grp:["WIDE"], duty:["D","S","A"],
  key:["crs","pas","tec","wor","sta","tea","tck"],
  // 측면 미드필더도 임무로 크로스가 갈려야 한다 — 예전에는 cross 0.35로 셋 다 같았다
  fx:d=>({fwd: d==="A"?0.45 : d==="S"?0.15 : -0.15, wide:0.45,
          cross: d==="A"?0.55 : d==="S"?0.30 : 0.15})},
 {k:"W",  n:"윙", e:"Winger", grp:["WIDE","AM"], duty:["S","A"],
  key:["crs","dri","tec","pac","acc","agi","otb"],
  /* 임무로 크로스가 갈린다. 예전에는 두 임무의 cross 가 0.65로 같아서 측정해 보면
     지원·공격 모두 크로스 비율 33.3%로 완전히 똑같았다. earlyCross 는 "크로스를 올릴지"가
     아니라 "어떤 크로스를 올릴지"만 바꾸므로 임무 차이를 만들지 못했다.
     지원은 뒤에서 일찍 올리고, 공격은 엔드라인까지 파고들어 더 자주 올린다. */
  fx:d=>({fwd: d==="A"?0.60:0.35, wide:0.75, cross: d==="A"?0.95:0.35,
          dribble: d==="A"?0.60:0.50, earlyCross: d==="A"?0:0.70})},
 {k:"DW", n:"수비형 윙", e:"Defensive Winger", grp:["WIDE","WB"], duty:["D","S"],
  key:["wor","sta","tck","tea","crs","pos","agg"],
  /* 이름은 "수비형 윙"인데 측정해 보니 자기 진영 체류 40.5%로 평범한 윙(40.3%)과 같았고,
     임무 수비·지원이 fwd 하나(-0.25 / 0.10)만 달라 수비 지표에서 구분이 되지 않았다.
     수비 임무는 확실히 내려앉아 풀백과 두 겹으로 서고(밀착 마크),
     지원 임무는 앞에서 물어뜯는다(압박)로 성격을 갈라 놓는다. */
  fx:d=>({fwd: d==="S"?0.20:-0.75, wide:0.40,
          press: d==="S"?1.05:0.55, cross: d==="S"?0.30:0.15,
          tightMark: d==="S"?0.30:0.85})},
 {k:"WP", n:"와이드 플레이메이커", e:"Wide Playmaker", grp:["WIDE"], duty:["S","A"],
  key:["pas","fir","tec","vis","dri","dec","fla"],
  fx:d=>({fwd: d==="A"?0.45:0.25, wide:0.25, pm:1.0, killer:0.55, dribble:0.3})},
 {k:"IW", n:"인버티드 윙어", e:"Inverted Winger", grp:["WIDE","AM"], duty:["S","A"],
  key:["crs","dri","pas","tec","otb","agi","fla"],
  fx:d=>({fwd: d==="A"?0.55:0.30, wide:-0.35, cutIn:1, dribble:0.45, cross:0.35, curl:1})},
 {k:"IF", n:"인사이드 포워드", e:"Inside Forward", grp:["WIDE","AM"], duty:["S","A"],
  key:["fin","dri","tec","otb","acc","pac","agi","fla"],
  fx:d=>({fwd: d==="A"?0.75:0.50, wide:-0.55, cutIn:1, dribble:0.55, shoot:0.35, curl:1})},
 {k:"WT", n:"와이드 타깃 포워드", e:"Wide Target Forward", grp:["WIDE"], duty:["S","A"],
  key:["hea","str","jum","bal","tea","fir"],
  fx:d=>({fwd: d==="A"?0.55:0.30, wide:0.60, hold:0.7, aerialTarget:1})},
 {k:"RMD",n:"라움도이터", e:"Raumdeuter", grp:["WIDE","AM"], duty:["A"],
  key:["otb","ant","fin","cnt","dec","acc"],
  fx:()=>({fwd:0.85, wide:0.25, roam:0.8, boxPlayer:1, breakLine:1, press:-0.4})},
 // ── 중앙 공격
 {k:"AM", n:"공격형 미드필더", e:"Attacking Midfielder", grp:["ST","CM","AM"], duty:["S","A"],
  key:["pas","fir","tec","otb","fin","vis","fla"],
  fx:d=>({fwd: d==="A"?0.75:0.50, killer:0.4, shoot:0.2})},
 {k:"T",  n:"트레콰르티스타", e:"Trequartista", grp:["ST","CM","AM"], duty:["A"],
  key:["fin","fir","tec","vis","fla","dri","cmp"],
  fx:()=>({fwd:0.70, roam:1.0, pm:0.9, killer:0.6, press:-0.7, dribble:0.4})},
 {k:"EG", n:"엔간체", e:"Enganche", grp:["ST","CM","AM"], duty:["S"],
  key:["pas","vis","tec","fir","dec","cmp","fla"],
  fx:()=>({fwd:0.45, roam:-0.7, pm:1.0, killer:0.7, hold:0.6, press:-0.6})},
 {k:"SS", n:"쉐도우 스트라이커", e:"Shadow Striker", grp:["ST","AM"], duty:["A"],
  key:["fin","otb","ant","dri","acc","cmp","fir"],
  fx:()=>({fwd:0.90, shoot:0.45, breakLine:1, oneTwo:1, press:0.3})},
 {k:"DLF",n:"딥라잉 포워드", e:"Deep Lying Forward", grp:["ST"], duty:["S","A"],
  key:["fir","pas","tec","cmp","tea","str","otb"],
  fx:d=>({fwd: d==="A"?0.55:0.25, deep:1, hold:0.7, pm:0.6, killer:0.35})},
 {k:"AF", n:"전진형 포워드", e:"Advanced Forward", grp:["ST"], duty:["A"],
  key:["fin","dri","fir","otb","acc","pac","cmp"],
  fx:()=>({fwd:0.95, shoot:0.4, dribble:0.35, breakLine:1})},
 {k:"TF", n:"타깃 포워드", e:"Target Forward", grp:["ST"], duty:["S","A"],
  key:["hea","str","jum","bra","bal","fin","fir"],
  fx:d=>({fwd: d==="A"?0.70:0.40, hold:0.8, aerialTarget:1, boxPlayer: d==="A"?1:0})},
 {k:"P",  n:"포처", e:"Poacher", grp:["ST"], duty:["A"],
  key:["fin","otb","ant","cmp","acc"],
  fx:()=>({fwd:1.0, boxPlayer:1, shoot:0.5, press:-0.7, killer:-0.6, roam:-0.4})},
 {k:"CF", n:"완성형 포워드", e:"Complete Forward", grp:["ST"], duty:["S","A"],
  key:["fin","dri","fir","tec","hea","str","otb","pas"],
  fx:d=>({fwd: d==="A"?0.85:0.55, shoot:0.3, dribble:0.35, killer:0.3, hold:0.35, roam:0.4})},
 {k:"PF", n:"압박형 포워드", e:"Pressing Forward", grp:["ST"], duty:["D","S","A"],
  key:["wor","sta","agg","bra","tea","acc","fin"],
  fx:d=>({fwd: d==="A"?0.70 : d==="S"?0.45:0.25, press:1.0, aggPress:1})},
 {k:"F9", n:"폴스 나인", e:"False Nine", grp:["ST"], duty:["S"],
  key:["pas","fir","tec","vis","otb","dri","cmp"],
  fx:()=>({fwd:0.25, deep:1, roam:0.8, pm:0.9, killer:0.6, dribble:0.35})}
];

const ROLE_BY_KEY={}; for(const r of ROLES) ROLE_BY_KEY[r.k]=r;

const ROLE_DEFAULT={GK:["G","D"], SW:["SWP","D"], CB:["CD","D"], FB:["FB","S"], WB:["WB","S"], CM:["CM","S"], WIDE:["W","S"], AM:["AM","S"], ST:["AF","A"]};

function getRole(t, p, slot){
  const map=(t&&t.tactic&&t.tactic.role)||{};
  const cur=map[p.id];
  const g=ROLE_GRP[slot]||"CM";
  if(cur && ROLE_BY_KEY[cur.r] && ROLE_BY_KEY[cur.r].grp.includes(g)) return cur;
  const d=ROLE_DEFAULT[g]||["CM","S"];
  return {r:d[0], d:d[1]};
}
/* 역할 적합도 — 그 역할이 요구하는 능력치로만 매긴다 (0~5) */
/* 역할 적합도 — 그 역할이 요구하는 능력치에서 리그 평균보다 얼마나 앞서는가.
   단순 평균을 쓰면 좋은 선수는 모든 역할이 4~4.5로 뭉개져 역할을 바꿔도 티가 안 난다.
   포지션 적합도와 같은 방식(수준 + 모양 분리)으로 계산한다. */

function roleFit(p, roleKey){
  const R=ROLE_BY_KEY[roleKey]; if(!R||!p) return 0;
  const a=p.attr||{}, g=p.gkA||{}, fb=p.ovr||65;
  const MM=attrMeans();
  const lvAbs=(p.pos==="GK") ? 0 : (playerLevel(p)-leagueLevel());
  const lv   =(p.pos==="GK") ? (playerLevel(p)-starRefLevel()) : (playerLevel(p)-starRefLevel());
  let shape=0, n=0;
  for(const k of R.key){
    const raw=(typeof g[k]==="number")?g[k]:(typeof a[k]==="number"?a[k]:fb);
    const mean=(MM.gm[k]!==undefined?MM.gm[k]:(MM.m[k]!==undefined?MM.m[k]:62));
    shape += (raw-mean) - lvAbs;
    n++;
  }
  // FM처럼 "실력이 먼저, 역할 적성은 보정"이다.
  // 모양에 큰 가중치를 주면 능력 56짜리가 포처 4.5★를 받는 일이 생긴다.
  // ovrStarVal 은 58~92 구간용이라 그대로 쓰면 하위 선수가 전부 바닥(0.5★)에 깔린다.
  // 역할 적합도는 자체 구간으로 매핑해 위아래 모두 변별력을 남긴다.
  /* 별점 기준선을 리그 전체로 옮기면서 역할 적합도만 후해졌다(측정: 4★ 이상이 리그의 56%).
     능력 별점과 눈금을 맞춘다 — 두 별이 어긋나면 어느 쪽을 믿어야 할지 알 수 없다. */
  const score = 62 + lv*ROLEFIT_Q + (n?shape/n:0)*ROLEFIT_S - ROLEFIT_LEAGUE_OFF;
  return starValFromScore(score);
}

function roleFx(t, p, slot){
  const rd=getRole(t,p,slot); const R=ROLE_BY_KEY[rd.r];
  if(!R) return {};
  const fx=R.fx(rd.d)||{};
  // 적합도가 낮으면 역할을 제대로 소화하지 못한다 (FM 설명 그대로)
  const fit=roleFit(p, rd.r);
  const eff=clamp(0.45+fit/5*0.70, 0.45, 1.15);
  const out={};
  for(const k in fx) out[k]=fx[k]*eff;
  normalizeFx(out);
  out._role=rd.r; out._duty=rd.d; out._fit=fit;
  return out;
}
/* ── 선호 플레이 (Player Traits / Preferred Moves) ─────────────────────
   FM처럼 "능력치를 더 주는 게 아니라, 선택지 결정을 바꾸는" 성향이다.
   req(a,p) 가 부여 가능 조건, w 가 그 조건을 만족했을 때의 상대 가중치.
   fx 는 매치엔진이 읽는 효과 플래그(agent.tr 에 합산되어 들어간다). */

const TRAITS=[
// ── 온 더 볼
{k:"cutsInside", n:"양쪽 측면에서 중앙으로 침투", e:"Cuts Inside From Both Wings", c:"온 더 볼",
 req:(a,p)=>["LW","RW","LM","RM","LB","RB"].includes(p.prefPos)&&a.dri>=68&&a.tec>=65, w:3, fx:{cutIn:1}},
{k:"knocksPast", n:"공을 차놓고 상대를 제치는 것을 선호", e:"Knocks Ball Past Opponent", c:"온 더 볼",
 req:(a)=>a.pac>=78&&a.acc>=75, w:3, fx:{knockPast:1}},
{k:"runsRarely", n:"공을 드물게 드리블", e:"Runs With Ball Rarely", c:"온 더 볼",
 req:(a)=>a.dri<=48, w:2, fx:{dribble:-0.55}},
{k:"runsOften", n:"공을 자주 드리블", e:"Runs With Ball Often", c:"온 더 볼",
 req:(a)=>a.dri>=72&&a.tec>=68, w:4, fx:{dribble:0.55}},
{k:"runsLeft", n:"왼쪽 측면 돌파 선호", e:"Runs With Ball Down Left", c:"온 더 볼",
 req:(a,p)=>["LW","LM","LB"].includes(p.prefPos)&&a.dri>=65, w:2, fx:{wide:1}},
{k:"runsRight", n:"오른쪽 측면 돌파 선호", e:"Runs With Ball Down Right", c:"온 더 볼",
 req:(a,p)=>["RW","RM","RB"].includes(p.prefPos)&&a.dri>=65, w:2, fx:{wide:1}},
{k:"runsCentre", n:"경기장 중앙으로 드리블함", e:"Runs With Ball Through The Center", c:"온 더 볼",
 req:(a,p)=>a.dri>=72&&a.bal>=70&&["ST","CM","LW","RW"].includes(p.prefPos), w:2, fx:{cutIn:1}},
{k:"stopsPlay", n:"공을 가지면 잠시 멈추는 플레이 선호", e:"Stops Play", c:"온 더 볼",
 req:(a)=>a.str>=68&&a.bal>=68&&a.tea>=68, w:2, fx:{hold:0.9}},
{k:"crossEarly", n:"얼리 크로스", e:"Crosses Early", c:"온 더 볼",
 req:(a,p)=>a.crs>=70&&["LB","RB","LM","RM","LW","RW"].includes(p.prefPos), w:3, fx:{earlyCross:1}},
// ── 공격시 위치 선정 (오프 더 볼)
{k:"arrivesLate", n:"페널티 박스에 한 박자 늦게 침투", e:"Arrives Late In Opposition Area", c:"공격시 위치 선정",
 req:(a,p)=>["CM"].includes(p.prefPos)&&a.otb>=68&&a.fin>=60, w:2, fx:{lateRun:1}},
{k:"comesDeep", n:"공을 받기 위해 포지션보다 내려옴", e:"Comes Deep To Get Ball", c:"공격시 위치 선정",
 req:(a,p)=>a.pas>=72&&a.vis>=70&&p.pos!=="DF", w:3, fx:{deep:1}},
{k:"getsForward", n:"가능할 때마다 최전방으로 침투 선호", e:"Gets Forward Whenever Possible", c:"공격시 위치 선정",
 req:(a,p)=>a.otb>=66&&a.wor>=68&&p.pos!=="GK", w:3, fx:{forward:0.55}},
{k:"getsIntoArea", n:"페널티 박스 안으로 침투 선호", e:"Gets Into Opposition Area", c:"공격시 위치 선정",
 req:(a,p)=>a.otb>=72&&(p.pos==="FW"||p.pos==="MF"), w:3, fx:{forward:0.75}},
{k:"hugsLine", n:"터치라인을 따라 움직이는 것을 선호", e:"Hugs Line", c:"공격시 위치 선정",
 req:(a,p)=>["LW","RW","LM","RM"].includes(p.prefPos)&&a.crs>=65, w:3, fx:{hugLine:1}},
{k:"breaksOffside", n:"오프사이드 트랩 돌파를 선호", e:"Likes To Try To Break Offside Trap", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.otb>=70&&a.pac>=72, w:3, fx:{breakLine:1}},
{k:"movesChannels", n:"수비수와 풀백 사이로 침투", e:"Moves Into Channels", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.otb>=68&&a.pac>=68, w:3, fx:{channels:1}},
{k:"boxPlayer", n:"페널티 지역 선수", e:"Penalty Box Player", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.fin>=72&&a.str>=65&&a.dri<=72, w:3, fx:{boxPlayer:1}},
{k:"oneTwos", n:"2대1 패스 선호", e:"Plays One-Twos", c:"공격시 위치 선정",
 req:(a)=>a.pas>=68&&a.tea>=70&&a.acc>=68, w:2, fx:{oneTwo:1}},
{k:"backToGoal", n:"골문을 등지는 것을 선호", e:"Plays With Back To Goal", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="FW"&&a.str>=72&&a.fir>=68, w:2, fx:{hold:0.6}},
{k:"staysBack", n:"항상 후방에 있는 것을 선호", e:"Stays Back At All Times", c:"공격시 위치 선정",
 req:(a,p)=>p.pos==="DF"&&a.pos>=70, w:3, fx:{forward:-0.7}},
// ── 패스
{k:"dictatesTempo", n:"템포 조절 선호", e:"Dictates Tempo", c:"패스",
 req:(a)=>a.dec>=75&&a.vis>=75&&a.pas>=72, w:2, fx:{hold:0.5, killer:0.2}},
{k:"switchFlank", n:"공을 반대편 측면으로 보내는 것을 선호", e:"Likes To Switch Ball To Other Flank", c:"패스",
 req:(a)=>a.pas>=72&&a.vis>=72, w:2, fx:{switchPlay:1}},
{k:"looksForPass", n:"득점보다는 패스하는 것을 선호", e:"Looks For Pass Rather Than Attempting To Score", c:"패스",
 req:(a)=>a.dec>=74&&a.fin<=52, w:1, fx:{shoot:-0.35}},
{k:"noThroughBalls", n:"스루 패스하지 않는 것을 선호", e:"Plays No Through Balls", c:"패스",
 req:(a)=>a.vis<=48&&a.pas<=52, w:1, fx:{killer:-0.6}},
{k:"shortSimple", n:"짧고 간단한 패스 선호", e:"Plays Short Simple Passes", c:"패스",
 req:(a)=>a.pas>=60&&a.vis<=66, w:1, fx:{shortPass:1}},
{k:"killerBalls", n:"스루 패스를 자주 시도", e:"Tries Killer Balls Often", c:"패스",
 req:(a)=>a.vis>=72&&a.pas>=70, w:3, fx:{killer:0.7}},
{k:"longPasses", n:"긴 패스를 자주 시도", e:"Tries Long Range Passes", c:"패스",
 req:(a)=>a.pas>=72&&a.vis>=68, w:2, fx:{longPass:1}},
{k:"longThrowCounter", n:"역습 시 장거리 스로인 사용", e:"Uses Long Throw To Start Counter Attacks", c:"패스",
 req:(a)=>a.thr>=75, w:2, fx:{longThrow:1}},
// ── 골 결정력
{k:"overhead", n:"오버헤드킥을 시도", e:"Attempts Overhead Kicks", c:"골 결정력",
 req:(a)=>a.fin>=70&&a.fla>=72&&a.agi>=70&&a.bra>=70, w:1, fx:{overhead:1}},
{k:"fkPower", n:"프리킥시 강력한 슛 선호", e:"Hits Free Kicks With Power", c:"골 결정력",
 req:(a)=>a.fre>=72&&a.lon>=70, w:2, fx:{fkPower:1}},
{k:"lobKeeper", n:"골키퍼를 넘기는 로빙 슛 선호", e:"Likes To Lob Keeper", c:"골 결정력",
 req:(a)=>a.fin>=70&&a.cmp>=68&&a.tec>=68, w:2, fx:{lob:1}},
{k:"roundKeeper", n:"골키퍼를 제치는 것을 선호", e:"Likes To Round Keeper", c:"골 결정력",
 req:(a)=>a.dri>=72&&a.cmp>=70&&a.pac>=70, w:2, fx:{round:1}},
{k:"placesShots", n:"정확한 슛 선호", e:"Places Shots", c:"골 결정력",
 req:(a)=>a.fin>=68&&a.cmp>=68, w:3, fx:{place:1}},
{k:"noLongShots", n:"중거리 슛 자제", e:"Refrains From Taking Long Shots", c:"골 결정력",
 req:(a)=>a.lon<=48, w:1, fx:{longShot:-0.55}},
{k:"shootsDistance", n:"중거리 슛 선호", e:"Shoots From Distance", c:"골 결정력",
 req:(a)=>a.lon>=72, w:3, fx:{longShot:0.8}},
{k:"shootsPower", n:"강력한 슛 선호", e:"Shoots With Power", c:"골 결정력",
 req:(a)=>a.lon>=68&&a.str>=68, w:2, fx:{power:1}},
{k:"firstTime", n:"빠른 박자에 슛을 자주 시도", e:"Tries First Time Shots", c:"골 결정력",
 req:(a)=>a.fin>=68&&a.ant>=70&&a.tec>=68, w:2, fx:{firstTimeShot:1}},
{k:"longFK", n:"먼 거리에서 프리킥 시 슛을 자주 시도", e:"Tries Long Range Free Kicks", c:"골 결정력",
 req:(a)=>a.fre>=70&&a.lon>=70, w:1, fx:{longFK:1}},
// ── 규율
{k:"windsUp", n:"상대 선수를 거칠게 대하는 것을 선호", e:"Winds Up Opponents", c:"규율",
 req:(a)=>a.agg>=75, w:2, fx:{cardRisk:0.35}},
{k:"crowdGoing", n:"관중들을 열광시키는 행동 선호", e:"Gets Crowd Going", c:"규율",
 req:(a)=>a.fla>=72&&a.ldr>=65, w:1, fx:{}},
{k:"arguesRef", n:"심판과 언쟁하는 것을 선호", e:"Argues With Officials", c:"규율",
 req:(a)=>a.agg>=70&&a.cmp<=62, w:2, fx:{cardRisk:0.45}},
// ── 수비
{k:"divesIn", n:"슬라이딩 태클 선호", e:"Dives Into Tackles", c:"수비",
 req:(a,p)=>p.pos!=="GK"&&a.agg>=70&&a.bra>=70, w:3, fx:{slide:0.7}},
{k:"noDiveIn", n:"슬라이딩 태클을 하지 않는 것을 선호", e:"Does Not Dive Into Tackles", c:"수비",
 req:(a,p)=>p.pos!=="GK"&&a.dec>=72&&a.agg<=62, w:3, fx:{slide:-0.7}},
{k:"marksTight", n:"상대 선수를 단단히 마크", e:"Marks Opponent Tightly", c:"수비",
 req:(a,p)=>p.pos==="DF"&&a.mar>=72&&a.ant>=68, w:3, fx:{tightMark:1}},
// ── 개인기
/* 약발 관련 특성 두 개는 삭제했다. 약발(p.weak)이 화면 표시 말고는 아무 데도 쓰이지 않았고,
   weakFoot 효과 역시 매치엔진이 읽지 않아 "복잡하기만 하고 아무 일도 안 하는" 항목이었다. */
{k:"curls", n:"휘어차는 슛 선호", e:"Curls Ball", c:"개인기",
 req:(a)=>a.tec>=72&&a.fin>=65, w:2, fx:{curl:1}},
{k:"dwells", n:"공을 오래 소유하는 것을 선호", e:"Dwells On Ball", c:"개인기",
 req:(a)=>a.tec>=68&&a.cmp>=68&&a.dec<=68, w:2, fx:{hold:0.7}},
{k:"flatThrow", n:"빠르고 낮게 깔리는 스로인 구사", e:"Possesses Long Flat Throw", c:"개인기",
 req:(a)=>a.thr>=70, w:1, fx:{longThrow:1}},
{k:"playsOutTrouble", n:"위기 상황을 벗어나기 위해 개인기를 자주 시도", e:"Tries To Play Way Out Of Trouble", c:"개인기",
 req:(a)=>a.tec>=72&&a.cmp>=70, w:2, fx:{escape:1}},
{k:"bringsOut", n:"수비 진영에서 드리블하기", e:"Brings Ball Out Of Defence", c:"개인기",
 req:(a,p)=>p.pos==="DF"&&a.dri>=62&&a.cmp>=68, w:2, fx:{carryOut:1}},
{k:"beatsRepeatedly", n:"상대를 여러 차례 속이는 것을 선호", e:"Likes To Beat Opponent Repeatedly", c:"개인기",
 req:(a)=>a.dri>=75&&a.tec>=72&&a.fla>=70, w:2, fx:{dribble:0.45, repeatBeat:1}},
{k:"tricks", n:"현란한 개인기를 자주 시도", e:"Tries Tricks", c:"개인기",
 req:(a)=>a.fla>=75&&a.tec>=72, w:2, fx:{dribble:0.35}},
{k:"ballToFeet", n:"패스를 발밑으로 받는 것을 선호", e:"Likes Ball Played Into Feet", c:"개인기",
 req:(a)=>a.fir>=72, w:2, fx:{toFeet:1}},
{k:"outsideFoot", n:"아웃프론트킥 선호", e:"Uses Outside Of Foot", c:"개인기",
 req:(a)=>a.tec>=75&&a.fla>=70, w:1, fx:{curl:1}},
{k:"gkFeet", n:"발로 공을 다룸", e:"Plays Ball With Feet", c:"개인기",
 req:(a,p)=>p.pos==="GK"&&a.pas>=55, w:3, fx:{gkSweeper:1}}
];

const TRAIT_BY_KEY={}; for(const t of TRAITS) TRAIT_BY_KEY[t.k]=t;
/* 서로 모순되는 특성은 같이 붙지 않는다 */

function FX(a, k){ return (((a&&a.tr)||{})[k]||0) + (((a&&a.role)||{})[k]||0); }
/* 특성이 경기에서 갖는 무게.
   훈련으로 직접 골라 붙이는 것이 된 이상, 하나 붙였을 때 "달라졌다"는 느낌이 있어야 한다.
   역할(role) 효과와 같은 축에 더해지므로 과하게 올리면 역할이 묻힌다 — 25%만 올린다. */

const TRAIT_FX_K=1.25;

function traitFx(keys){
  const fx={};
  for(const k of (keys||[])){
    const t=TRAIT_BY_KEY[k]; if(!t) continue;
    /* 🎛️ 에디터의 특성 계수 튠 — 매치엔진에서 특성이 플레이에 얼마나 세게 묻어나는가 */
    const K=TRAIT_FX_K * (typeof meTune==="function" ? meTune("trait") : 1);
    for(const f in t.fx) fx[f]=(fx[f]||0)+t.fx[f]*K;
  }
  return normalizeFx(fx);
}
/* 이름만 다른 같은 축을 합친다. 이걸 안 하면 특성의 forward 가 역할의 fwd 와 따로 놀아 무시된다. */

function normalizeFx(fx){
  const add=(k,v)=>{ if(v) fx[k]=(fx[k]||0)+v; };
  add("fwd", fx.forward||0);            delete fx.forward;
  add("wide", -(fx.cutIn||0)*0.45);     // 안으로 파고들기 → 좌우 축 음수
  add("wide", (fx.hugLine||0)*0.50);    // 터치라인 붙기 → 좌우 축 양수
  add("fwd", -(fx.deep||0)*0.40);       // 내려와서 받기
  add("fwd", (fx.boxPlayer||0)*0.18);   // 박스 안에 머물기
  add("wide", -(fx.boxPlayer||0)*0.30);
  add("sweep", (fx.gkSweeper||0)*0.55); // 발로 공을 다루는 키퍼
  add("fwd", (fx.lateRun||0)*0.20);
  return fx;
}
/* 통산 출장 추정 — 게임을 시작하는 순간 30세 베테랑에게도 "지난 커리어"가 있어야 한다.
   0이면 아직 프로 데뷔를 하지 않은 선수(유스·신인)이고, 첫 출전이 곧 데뷔전 기사가 된다. */

function canonSlot(slot){
  if(slot==="LCB"||slot==="RCB") return "CB";
  if(slot==="LCM"||slot==="RCM") return "CM";
  if(slot==="LS"||slot==="RS") return "ST";
  return slot;
}

const FAM_POS=["GK","SW","DC","DL","DR","WBL","WBR","DM","MC","ML","MR","AMC","AML","AMR","LW","RW","ST"];

const SLOT_FAM={GK:"GK", SW:"SW", LCB:"DC",CB:"DC",RCB:"DC", LB:"DL",RB:"DR", LWB:"WBL",RWB:"WBR",
  LDM:"DM",DM:"DM",RDM:"DM", LCM:"MC",CM:"MC",RCM:"MC", LM:"ML",RM:"MR",
  LAM:"AML",CAM:"AMC",RAM:"AMR", LW:"LW",RW:"RW", LS:"ST",ST:"ST",RS:"ST"};
/* 가까운 자리끼리는 처음부터 어느 정도 익숙하다 */

const FAM_NEAR={
  SW:{DC:75,DM:40},
  DC:{SW:70,DL:45,DR:45,DM:50,WBL:30,WBR:30}, DL:{DC:45,WBL:80,ML:55,DR:30}, DR:{DC:45,WBR:80,MR:55,DL:30},
  WBL:{DL:80,ML:65,AML:40}, WBR:{DR:80,MR:65,AMR:40},
  DM:{MC:75,DC:50}, MC:{DM:75,AMC:65,ML:45,MR:45},
  ML:{MR:35,AML:70,WBL:55,MC:45,LW:55}, MR:{ML:35,AMR:70,WBR:55,MC:45,RW:55},
  AMC:{MC:65,ST:55,AML:75,AMR:75}, AML:{AMR:35,ML:70,ST:45,LW:85,AMC:62}, AMR:{AML:35,MR:70,ST:45,RW:85,AMC:62},   // 같은 AM 라인 — CAM이 초록인데 LAM/RAM이 빨간 건 웃기다
  LW:{AML:85,ML:80,ST:55,RW:35}, RW:{AMR:85,MR:80,ST:55,LW:35},   // 윙어에게 LM/RM 은 같은 윙 한 칸 아래일 뿐 — 노랑(무난함)은 말이 안 된다
  ST:{AMC:55,AML:45,AMR:45,LW:50,RW:50}
};
/* 능숙도 눈금 — 위 세 칸이 전부 초록 계열이라 화면에서 구분이 안 갔다.
   초록 → 연두 → 노랑 → 주황 → 빨강으로 색상환을 따라 내려가게 다시 짰다. */

function initPosFam(p){
  const home = SLOT_FAM[p.prefPos] || (p.pos==="GK"?"GK":p.pos==="DF"?"DC":p.pos==="MF"?"MC":"ST");
  const f={};
  // 아예 해본 적 없는 자리는 0 — 화면에도 표시하지 않는다
  for(const k of FAM_POS) f[k]=0;
  if(p.pos==="GK"){ f.GK=100; }
  else {
    f[home]=100;
    const near=FAM_NEAR[home]||{};
    for(const k in near) f[k]=Math.max(f[k], near[k]);
  }
  return f;
}

function getPosFam(p, slot){
  if(!p) return 0;
  if(!p.posFam) p.posFam=initPosFam(p);
  const k=SLOT_FAM[canonSlot(slot)]||SLOT_FAM[slot];
  if(!k) return 50;
  return clamp(Math.round(p.posFam[k]||0), 0, 100);
}
/* 경기를 뛰면 그 자리 능숙도가 오른다 — 어릴수록, 팀워크·판단력이 좋을수록 빨리 배운다.
   FM처럼 100(자연스러움)에 가까워질수록 느려지고, 안 뛴 자리는 아주 천천히 잊는다. */

function frnQ(p){ return !!(p && p.frn && !p.hg); }   // "쿼터를 차지하는 외국인"인가

function pickEmergencyGK(list){
  if(!list||!list.length) return null;
  const sc=(p)=>(p.h||178)*0.5 + ((p.attr&&p.attr.bra)||50)*0.3 + ((p.attr&&p.attr.agi)||50)*0.2 + (p.pos==="DF"?8:0);
  return list.slice().sort((a,b)=>sc(b)-sc(a))[0];
}

function slotPickScore(p, slot){
  if(!p) return -1;
  if((slot==="GK") !== (p.pos==="GK")) return -1;     // 골키퍼와 필드 플레이어는 섞지 않는다
  const raw=ovrStarVal(slotRating(p, slot));          // 그 자리 기준 별점
  const v=raw*famStarMul(getPosFam(p, slot));         // 자리 능숙도로 깎는다
  // 같은 별점이면 능력치가 높은 쪽 — 결정적으로 정해야 캐시가 유효하다
  return v*1000 + (p.ovr||65)*0.4;
}

function formationSlots(fname){
  const shape=FORMATION_SHAPE[fname]||FORMATION_SHAPE["4-3-3"];
  return shape.map(x=>x[1]);
}
/* {xi, slotOf} — 자리 배정까지 함께 돌려준다 */
/* 캐시 키 — 스쿼드 구성(출전 가능 선수 + 능력치)과 포메이션만 본다.
   ⚠ 컨디션을 키에 넣었더니 날짜가 하루 지날 때마다 29개 팀 전부의 캐시가 깨져서
      시즌 진행이 눈에 띄게 느려졌다. 컨디션은 어차피 동점자 처리용이라 뺐다. */

const TAC_KEYS=["pass","tempo","press","line","width","mentality","tackle","longShot"];

const TAC_STEPS=5;                    // 0,1,2,3,4

const TAC_DEF={pass:2,tempo:2,press:2,line:2,width:2,counter:false,mentality:2,tackle:2,longShot:2};

function tacVal(v){ return clamp((v==null?2:+v),0,TAC_STEPS-1)/2; }   // 0~4 → 0.0~2.0
/* 팀(또는 tactic 객체)의 전술을 엔진용 실수 스케일로 변환 */

function TAC(src){
  const raw=Object.assign({}, TAC_DEF, (src && src.tactic) ? src.tactic : (src||{}));
  const o={counter:!!raw.counter, formation:raw.formation, raw};
  for(const k of TAC_KEYS) o[k]=tacVal(raw[k]);
  return o;
}

function getZone(t,p){
  if(p.pos==="GK") return "GK";
  const z=t&&t.tactic&&t.tactic.zone;
  return (z&&z[p.id]) || p.pos;
}

function setZone(t,pid,zone){
  if(!t.tactic.zone) t.tactic.zone={};
  t.tactic.zone[pid]=zone;
}
/* ── 세부 위치(slot) 시스템: 각 라인을 FM처럼 5개 세부 지역으로 나눈다.
   zone(DF/MF/FW)은 매치엔진 계산(가중치·수비두께 등)에 쓰이는 대분류 그대로 유지하고,
   slot은 화면 표시·포지션별 별점 계산 전용 세부 좌표다. ── */
/* 전술판 라인 — FM처럼 세분화한다. 한 줄은 항상 5칸이고, 그 라인에 없는 자리는 null(빈 칸).
   위(공격)에서 아래(수비) 순서: FW → AM → MF → DM → WB → DF */

const ROW_SLOTS={
  SW:[null,null,"SW",null,null],
  DF:["LB","LCB","CB","RCB","RB"],
  WB:["LWB",null,null,null,"RWB"],
  DM:[null,"LDM","DM","RDM",null],
  MF:["LM","LCM","CM","RCM","RM"],
  AM:[null,"LAM","CAM","RAM",null],
  FW:["LW","LS","ST","RS","RW"]
};
/* 자리 → 라인 역인덱스 (자동 배치가 어느 줄에 속하는지 판단할 때 쓴다) */

const SLOT_BAND=(function(){ const m={}; for(const b in ROW_SLOTS) for(const s of ROW_SLOTS[b]) if(s) m[s]=b; return m; })();

const BANDS=["SW","DF","WB","DM","MF","AM","FW"];         // 뒤에서 앞 순서

const SLOT_XY={
  GK:{x:0.04,y:0.5},
  LB:{x:0.20,y:0.10}, LCB:{x:0.16,y:0.32}, CB:{x:0.14,y:0.5}, RCB:{x:0.16,y:0.68}, RB:{x:0.20,y:0.90},
  SW:{x:0.09,y:0.5},
  LWB:{x:0.25,y:0.06}, RWB:{x:0.25,y:0.94},
  LDM:{x:0.29,y:0.36}, DM:{x:0.27,y:0.5}, RDM:{x:0.29,y:0.64},
  LM:{x:0.46,y:0.12}, LCM:{x:0.42,y:0.34}, CM:{x:0.40,y:0.5}, RCM:{x:0.42,y:0.66}, RM:{x:0.46,y:0.88},
  LAM:{x:0.60,y:0.28}, CAM:{x:0.60,y:0.5}, RAM:{x:0.60,y:0.72},
  LW:{x:0.72,y:0.15}, LS:{x:0.76,y:0.36}, ST:{x:0.80,y:0.5}, RS:{x:0.76,y:0.64}, RW:{x:0.72,y:0.85}
};

function mirrorXY(pos){ return {x:1-pos.x, y:1-pos.y}; }
/* 현재 그라운드 위에 있는 22명 + 공의 "쉬는 자세(idle)" 좌표를 계산한다.
   home은 SLOT_XY를 그대로, away는 mirrorXY로 180도 점대칭 이동해서 서로 마주보게 배치한다. */

function computeFormationPositions(M){
  const build=(sd, isHome)=>{
    const xi=onPitch(sd).map(x=>x.p);
    const slotOf=computeRenderSlots(sd.team, xi);
    return onPitch(sd).map(x=>{
      /* ⚠ 예전에는 pos 가 GK 면 무조건 골문에 세웠다. 어쩌다 GK가 둘 올라오면 둘 다 골대 앞에 섰다.
         배정된 자리가 있으면 그 자리를 따른다. */
      const slot = slotOf[x.p.id] || (x.p.pos==="GK" ? "GK" : "CM");
      const base = SLOT_XY[slot] || SLOT_XY.CM;
      const pos = isHome ? base : mirrorXY(base);
      return {id:x.p.id, name:x.p.name, pos:x.p.pos, slot, x:pos.x, y:pos.y, side:isHome?"h":"a"};
    });
  };
  // 코멘터리에서 팀 이름·색을 쓰기 위해 스냅샷에 함께 저장한다(이벤트가 나중에 재생돼도 그때의 정보가 남는다)
  return { h: build(M.h, true), a: build(M.a, false), ball:{x:0.5,y:0.5},
           hShort:M.home.short, aShort:M.away.short, hCol:M.home.col, aCol:M.away.col };
}
/* 특정 선수 id의 idle 좌표만 빠르게 찾을 때 쓰는 헬퍼 (씬 애니메이션의 시작/종료 좌표 계산용) */

const DEFAULT_SPREAD={
  DF:{0:[],1:[2],2:[1,3],3:[1,2,3],4:[0,1,3,4],5:[0,1,2,3,4]},
  MF:{0:[],1:[2],2:[1,3],3:[1,2,3],4:[0,1,3,4],5:[0,1,2,3,4]},
  FW:{0:[],1:[2],2:[1,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4]},
  SW:{0:[],1:[2]},
  WB:{0:[],1:[0],2:[0,4]},
  DM:{0:[],1:[2],2:[1,3],3:[1,2,3]},
  AM:{0:[],1:[2],2:[1,3],3:[1,2,3]}
};
// 세부 지역별 참고 능력치 가중치 — 공격수가 CB로 가면 대인수비·태클 등 수비 스탯 기준으로 별점이 다시 매겨진다
/* ── 포지션별 주요 능력치 가중치 (FM 기준표) ─────────────────────────
   값은 0~100. 그 포지션에서 "얼마나 중요한가"를 뜻하며, 적합도 별점은
   이 가중치로 능력치를 가중평균해서 매긴다.
   CM 은 원표에 없어 DM 과 AM 의 중간으로 둔다. */

const FMW={
 CD:{tec:35,fin:10,dri:40,mar:55,thr:5,lon:10,cor:5,crs:1,tck:40,pas:30,fir:35,pen:10,fre:10,hea:55,
     bra:30,ldr:10,det:20,vis:50,ant:50,otb:10,pos:55,agg:40,cnt:50,fla:10,cmp:80,tea:10,dec:50,wor:55,
     acc:90,bal:35,str:50,agi:60,jum:65,pac:90,sta:30,nat:10},
 FB:{tec:45,fin:10,dri:50,mar:45,thr:30,lon:10,cor:25,crs:45,tck:50,pas:45,fir:35,pen:10,fre:10,hea:20,
     bra:20,ldr:10,det:20,vis:25,ant:45,otb:70,pos:30,agg:45,cnt:45,fla:20,cmp:30,tea:10,dec:45,wor:90,
     acc:100,bal:25,str:25,agi:60,jum:40,pac:100,sta:100,nat:10},
 DM:{tec:50,fin:10,dri:45,mar:20,thr:5,lon:40,cor:10,crs:10,tck:35,pas:65,fir:50,pen:10,fre:30,hea:10,
     bra:30,ldr:15,det:20,vis:55,ant:55,otb:45,pos:65,agg:50,cnt:50,fla:50,cmp:60,tea:10,dec:65,wor:90,
     acc:65,bal:35,str:35,agi:45,jum:15,pac:70,sta:70,nat:10},
 W: {tec:50,fin:15,dri:55,mar:35,thr:10,lon:10,cor:30,crs:65,tck:35,pas:30,fir:30,pen:15,fre:10,hea:10,
     bra:15,ldr:10,det:20,vis:35,ant:45,otb:40,pos:35,agg:35,cnt:35,fla:20,cmp:30,tea:10,dec:35,wor:75,
     acc:100,bal:15,str:30,agi:30,jum:30,pac:100,sta:75,nat:10},
 AM:{tec:65,fin:65,dri:65,mar:1,thr:1,lon:20,cor:5,crs:15,tck:15,pas:50,fir:40,pen:15,fre:30,hea:10,
     bra:20,ldr:10,det:20,vis:30,ant:70,otb:35,pos:10,agg:50,cnt:25,fla:35,cmp:35,tea:10,dec:40,wor:80,
     acc:100,bal:50,str:30,agi:30,jum:30,pac:80,sta:80,nat:10},
 ST:{tec:65,fin:80,dri:75,mar:1,thr:1,lon:25,cor:5,crs:5,tck:5,pas:40,fir:50,pen:20,fre:5,hea:60,
     bra:20,ldr:10,det:20,vis:20,ant:65,otb:45,pos:5,agg:50,cnt:5,fla:25,cmp:45,tea:10,dec:45,wor:60,
     acc:100,bal:50,str:25,agi:30,jum:30,pac:70,sta:65,nat:10}
};
/* 스위퍼 — 중앙 수비 기준에서 위치선정·예측력·판단력을 크게, 대인마크를 조금 낮춘다.
   최후방에서 혼자 읽고 정리하는 자리라 몸싸움보다 머리가 중요하다. */
FMW.SWP=(function(){ const o=Object.assign({},FMW.CD);
  o.pos=85; o.ant=80; o.dec=70; o.cnt=65; o.cmp=85;
  o.mar=40; o.tck=45; o.hea=45; o.pas=45; o.fir=45; o.tec=45;
  o.pac=75; o.acc=75; o.jum=45;
  return o; })();
// CM 은 원표에 없으므로 DM·AM 의 평균으로 만든다
FMW.CM=(function(){
  // 단순 평균이면 공격 능력치(골결정력·드리블) 비중이 커져 공격수가 CM 상위에 오른다.
  const o={}; for(const k in FMW.DM) o[k]=Math.round(FMW.DM[k]*0.65+FMW.AM[k]*0.35);
  o.pas=70; o.fir=60; o.tec=55; o.dec=65; o.tea=45; o.vis=55; o.wor=85; o.sta=80;
  o.fin=20; o.dri=45; o.tck=45; o.pos=55; o.mar=30;
  return o;
})();
/* 원표는 측면 수비의 신체 능력치(가속·주력·지구력 100)가 압도적이라, 빠른 공격수가
   수비수보다 풀백 적합도가 높게 나온다. 수비를 가르는 항목을 올려 균형을 맞춘다. */
FMW.FB.mar=75; FMW.FB.tck=75; FMW.FB.pos=60; FMW.FB.cnt=55; FMW.FB.ant=55;
FMW.FB.fin=5;  FMW.FB.dri=35; FMW.FB.tec=35;
/* 측면 공격수도 마찬가지 — 크로스·드리블 비중을 올려 순수 스피드만으로 오르지 않게 한다 */
FMW.W.crs=80; FMW.W.dri=70; FMW.W.tec=60; FMW.W.otb=55;
/* 슬롯 → 가중치 그룹 */

const SLOT_FMW={
  SW:"SWP", LCB:"CD", CB:"CD", RCB:"CD",
  LB:"FB", RB:"FB", LWB:"FB", RWB:"FB",
  LDM:"DM", DM:"DM", RDM:"DM",
  LCM:"CM", CM:"CM", RCM:"CM",
  LM:"W", RM:"W", LW:"W", RW:"W",
  LAM:"AM", CAM:"AM", RAM:"AM",
  LS:"ST", ST:"ST", RS:"ST"
};
/* 골키퍼는 별도 표 — 필드 능력치가 아니라 GK 전용 능력치로 매긴다 */

const FMW_GK={ ref:100,one:90,han:85,cmd:80,aer:75,com:65,kic:55,pun:35,tro:30,tro2:30,ecc:10,
               cnt:60,dec:55,cmp:55,pos:50,ant:45,bra:35,agi:45,jum:40,acc:20,pac:20,str:25,bal:25 };
// 세부 지역별 슈팅 관여도 — 스트라이커가 가장 많이 쏘고, 측면 공격수·중앙 미드필더가 그 다음,
// 측면 미드필더·풀백은 드물게, 센터백은 세트피스에서나(아주 가끔), 골키퍼는 0(항상 제외).

let ATTR_MEAN=null, ATTR_MEAN_AT=-1;

function attrMeans(){
  // 시즌이 바뀌거나 선수단이 크게 달라지면 다시 계산한다
  if(ATTR_MEAN && ATTR_MEAN_AT===G.season) return ATTR_MEAN;
  const sum={}, cnt={}, gsum={}, gcnt={};
  for(const id in G.teams) for(const q of G.teams[id].players){
    if(q.attr) for(const k in q.attr){ sum[k]=(sum[k]||0)+q.attr[k]; cnt[k]=(cnt[k]||0)+1; }
    if(q.gkA)  for(const k in q.gkA){ gsum[k]=(gsum[k]||0)+q.gkA[k]; gcnt[k]=(gcnt[k]||0)+1; }
  }
  const m={}, gm={};
  for(const k in sum) m[k]=sum[k]/Math.max(1,cnt[k]);
  for(const k in gsum) gm[k]=gsum[k]/Math.max(1,gcnt[k]);
  ATTR_MEAN={m, gm}; ATTR_MEAN_AT=G.season;
  return ATTR_MEAN;
}

const ROLEFIT_Q=1.45;  // 역할 적합도에서 "선수의 전반적 실력"이 차지하는 비중

const ROLEFIT_S=1.35;  // "그 역할다운 능력치 배분인가"가 차지하는 비중

const FIT_BASE=62;    // 리그 평균 선수가 자기 포지션에서 받는 기준 점수

const FIT_Q=0.95;     // 선수의 전반적인 수준이 반영되는 정도

const FIT_S=2.6;      // "그 포지션에 맞는 모양인가"가 반영되는 정도
/* 선수 자신의 평균 능력치 — 이걸 빼면 "잘하는 선수는 뭐든 잘한다"는 성분이 사라지고
   그 자리에 필요한 것들을 상대적으로 잘하는지(모양)만 남는다. */

function playerLevel(p){
  const a=p.attr; if(!a) return 62;
  // 골키퍼는 필드 능력치가 원래 낮게 생성된다. 그걸로 수준을 재면 최고의 키퍼도
  // 후보 수준으로 깔려버리므로, GK 는 전용 능력치를 주로 보고 정신·신체를 곁들인다.
  if(p.pos==="GK" && p.gkA){
    let g=0,gn=0; for(const k in p.gkA){ if(typeof p.gkA[k]==="number"){ g+=p.gkA[k]; gn++; } }
    let m=0,mn=0;
    for(const k of MENT_ATTRS.concat(PHYS_ATTRS)){ if(typeof a[k]==="number"){ m+=a[k]; mn++; } }
    const gv=gn?g/gn:62, mv=mn?m/mn:62;
    return gv*0.75 + mv*0.25;
  }
  let s=0,n=0; for(const k in a){ if(typeof a[k]==="number"){ s+=a[k]; n++; } }
  return n?s/n:62;
}
/* ── 별점의 기준선 ────────────────────────────────────────────────
   FM처럼 별점은 절대 기준이 아니다. "우리 팀 수준"과 "우리가 뛰는 리그 수준"을
   섞은 값을 기준으로, 그보다 얼마나 나은 선수인지를 보여준다.
   그래서 같은 선수라도 강팀에서 보면 별이 적고, 약팀에서 보면 많다. */
/* FM은 "우리 팀 주전 XI 평균"을 기준으로 본다. 주전들이 평균 3~3.5★가 되도록 맞추고,
   그보다 처지는 후보는 2★ 이하, 핵심은 4★ 이상으로 나오게 한다.
   월드클래스를 영입해 주전 수준이 올라가면 기존 후보들의 별은 자동으로 떨어진다. */

const STAR_MID=3.25;      // 주전 평균 선수가 받는 별

const STAR_SPAN=13.2;     // 별 한 칸에 해당하는 실력 차이
/* 기량 차이를 별점 점수로 바꾸는 배율.
   이 값이 곧 "은색이 언제 뜨는가"를 정한다 — 주전 평균보다 약 13.5 낮으면 1군 눈금(금색 0.5)의
   바닥에 닿고, 그 아래부터 은색이다. 우리 리그 기준으로는 유스 콜업과 하부 리그 하위권이 여기 걸린다. */

const STAR_LEAGUE_OFF=7.6;

const ROLEFIT_LEAGUE_OFF=10;  // 역할 적합도 별점의 같은 보정

let STAR_CTX=null, STAR_CTX_KEY="";

function starRefLevel(){
  const key="LEAGUE|"+G.season+"|"+(G.r1||0)+"_"+(G.r2||0);
  if(STAR_CTX && STAR_CTX_KEY===key) return STAR_CTX;
  let s=0,n=0;
  for(const id in G.teams){ const t=G.teams[id];
    for(const q of (t.players||[])){ s+=playerLevel(q); n++; } }
  STAR_CTX = n ? s/n + STAR_LEAGUE_OFF : leagueLevel();
  STAR_CTX_KEY = key;
  return STAR_CTX;
}

function leagueLevel(){
  const MM=attrMeans();
  if(MM.lv!==undefined) return MM.lv;
  let s=0,n=0; for(const k in MM.m){ s+=MM.m[k]; n++; }
  MM.lv = n? s/n : 62;
  return MM.lv;
}
/* ⚠ slotRating 은 가중합이 여러 번 도는 무거운 함수다. bestXI 가 (선수 × 자리) 전 조합을
   훑기 때문에 캐시가 없으면 한 번 부를 때마다 수백 번 계산된다(실측: 라운드당 20초 추가).
   능력치가 바뀌지 않는 한 값도 그대로이므로 선수 객체에 붙여 둔다. */
/* 캐시는 선수 객체가 아니라 바깥 Map 에 둔다 — 객체에 붙이면 세이브(JSON)에 딸려 나가고,
   그걸 막으려고 저장 직전에 지우면 매 라운드 전부 다시 계산하게 된다(실측: 경기당 2.4초). */

const _SR_CACHE=new Map();

function slotRating(p, slot){
  const ck=(p.ovr||65)+"|"+((p.attr&&p.attr.sta)||0)+"|"+((p.attr&&p.attr.fin)||0);
  let e=_SR_CACHE.get(p.id);
  if(!e || e.k!==ck){ e={k:ck, v:{}}; _SR_CACHE.set(p.id, e); }
  const hit=e.v[slot];
  if(hit!==undefined) return hit;
  return (e.v[slot]=slotRatingCalc(p, slot));
}

function slotRatingCalc(p, slot){
  const fb=p.ovr||65, MM=attrMeans();
  const isGK = (slot==="GK");
  // 골키퍼 자리에 필드 플레이어를 놓거나 그 반대면 애초에 말이 안 된다
  if(isGK && p.pos!=="GK") return 24;
  if(!isGK && p.pos==="GK") return 24;
  if(isGK){
    const g=p.gkA, a0=p.attr||{};
    if(!g) return p.gk?(p.gk.shot+p.gk.cmd+p.gk.gkp)/3:fb;
    let d=0,w=0;
    for(const k in FMW_GK){
      const v=(typeof g[k]==="number")?g[k]:(typeof a0[k]==="number"?a0[k]:fb);
      const mean=(MM.gm[k]!==undefined?MM.gm[k]:(MM.m[k]!==undefined?MM.m[k]:62));
      d+=(v-mean)*FMW_GK[k]; w+=FMW_GK[k];
    }
    return clamp(FIT_BASE + (w?d/w:0)*1.9, 20, 99);
  }
  const W=FMW[SLOT_FMW[slot]||"CM"], a=p.attr;
  if(!W||!a) return fb;
  // 모양(shape)은 전체 평균 기준으로 재고, 수준(quality)은 "우리 팀·리그" 기준으로 잰다
  const lvAbs = playerLevel(p) - leagueLevel();      // 능력치 배분을 볼 때 쓰는 절대 기준
  const lv    = playerLevel(p) - starRefLevel();     // 별점에 반영되는 상대 수준
  let shape=0, w=0;
  for(const k in W){
    const v=(typeof a[k]==="number")?a[k]:fb;
    const mean=(MM.m[k]!==undefined?MM.m[k]:62);
    // 전반적 수준(lv)을 빼서, 그 능력치가 "이 선수 기준으로도" 두드러지는지만 본다
    shape += ((v-mean) - lvAbs)*W[k]; w+=W[k];
  }
  return clamp(FIT_BASE + lv*FIT_Q + (w?shape/w:0)*FIT_S, 20, 99);
}
/* 칩에 보이는 별 — 그 자리에 지정된 "역할"의 적합도다.
   포지션 적합도만 보여주면 역할을 바꿔도 별이 그대로라 무엇이 바뀌었는지 알 수 없다. */
/* 포지션 능숙도가 별에 미치는 영향.
   FM처럼 능력치가 좋아도 그 자리를 못 하면 별이 확 줄어든다 — 빨간색(0)이면 반 개까지. */

function famStarMul(fam){
  const f=clamp(fam/100, 0, 1);
  return FAMSTAR_MIN + (1-FAMSTAR_MIN)*Math.pow(f, FAMSTAR_POW);
}

const FAMSTAR_MIN=0.10;   // 능숙도 0 일 때 남는 비율

const FAMSTAR_POW=0.75;   // 곡선 — 낮은 구간에서 더 가파르게 떨어진다

function prefSlotOf(p){
  if(!p) return "CM";
  if(p.pos==="GK") return "GK";
  const s=p.prefPos && canonSlot(p.prefPos);
  if(s && SLOT_FAM[s]) return s;
  return p.pos==="DF" ? "CB" : p.pos==="MF" ? "CM" : "ST";
}
/* ── 자리마다 다른 "점수 인심"을 걷어내기 ──────────────────────────
   slotRating은 자리별로 다른 가중치표를 쓰기 때문에, 같은 수준의 선수라도 자리에 따라
   점수가 통째로 달라진다(예: 스트라이커는 후하고 센터백은 짜다). 그대로 별로 바꾸면
   66짜리 공격수가 73짜리 센터백보다 별을 더 받는 이상한 일이 생긴다.
   그래서 "그 자리 리그 평균"을 먼저 빼서 자리별 인심을 없앤 다음, 팀 주전 평균과 비교한다. */

function setSlot(t,pid,slot){ if(!t.tactic.slot) t.tactic.slot={}; t.tactic.slot[pid]=slot; }
/* 현재 선발 XI 전체를 놓고 각 선수의 세부 슬롯을 계산한다 — 사용자가 직접 지정한 슬롯은 그대로 쓰고,
   아직 지정되지 않은 선수만 같은 라인 내 빈 자리에 자동 배치한다. 자동 배치된 자리는 즉시 t.tactic.slot에
   "고정(sticky)"으로 저장해 둔다 — 그래야 나중에 다른 선수가 같은 라인으로 들어오거나 나가서 인원수가
   바뀌어도, 이미 자리 잡은 선수들은 절대 다시 계산되어 밀려나지 않는다(= "주변 선수가 따라 이동" 버그 방지). */

function computeRenderSlots(t, xi){
  const slotOf={};
  // 골문에 설 선수 — 정식 키퍼가 없으면(전원 부상) 비상 키퍼를 세운다.
  let gkP=xi.find(p=>p.pos==="GK") || pickEmergencyGK(xi);
  if(gkP) slotOf[gkP.id]="GK";
  if(t && !t.tactic.slot) t.tactic.slot={};
  const savedSlot=(t&&t.tactic&&t.tactic.slot)||{};
  /* ── 배치는 "지금 고른 포메이션"을 따른다 ─────────────────────────
     예전에는 선수의 타고난 포지션(DF/MF/FW)으로 줄을 나눴다. 그래서 선발을 손으로 바꿔
     수비수를 한 명 더 넣으면, 포메이션은 4-3-3인데 화면은 5-2-3으로 그려졌다.
     이제는 ① 감독이 직접 끌어다 놓은 자리(t.tactic.slot)를 최우선으로 지키고,
     ② 남은 선수는 그 포메이션이 요구하는 남은 자리에 별점 순으로 앉힌다.
     그래서 선발을 어떻게 바꾸든 화면 모양은 고른 포메이션과 항상 일치한다. */
  const fname=(t&&t.tactic&&t.tactic.formation)||"4-3-3";
  const shapeSlots=formationSlots(fname);
  // ⚠ "골키퍼 포지션이 아닌 선수"가 아니라 "골문에 선 그 한 명을 뺀 전원"이어야 한다.
  //    예비 키퍼가 선발에 끼면 그 선수는 어느 쪽에도 안 들어가 자리를 못 받는다.
  const outfield=xi.filter(p=>p!==gkP);
  const pinned={}, freeMen=[];
  const takenSlots=new Set();
  for(const p of outfield){
    const s=savedSlot[p.id];
    if(s && SLOT_BAND[s] && !takenSlots.has(s)){ pinned[p.id]=s; takenSlots.add(s); }
    else freeMen.push(p);
  }
  // 포메이션이 요구하는 자리 중 아직 비어 있는 곳
  let openSlots=shapeSlots.filter(s=>!takenSlots.has(s));
  // 고정된 선수가 포메이션 밖 자리에 서 있으면(자유 배치) 자리 수가 모자랄 수 있다 —
  // 그럴 땐 아무 라인의 빈 자리라도 내준다.
  if(openSlots.length<freeMen.length){
    for(const b of BANDS) for(const s of ROW_SLOTS[b])
      if(s && !takenSlots.has(s) && openSlots.indexOf(s)<0) openSlots.push(s);
  }
  const autoAssign={};
  const pairs=[];
  for(const p of freeMen) for(const s of openSlots) pairs.push({p, s, v:slotPickScore(p, s)});
  pairs.sort((a,b)=>b.v-a.v);
  const doneP=new Set(), doneS=new Set();
  for(const c of pairs){
    if(doneP.size>=freeMen.length) break;
    if(doneP.has(c.p.id)||doneS.has(c.s)) continue;
    doneP.add(c.p.id); doneS.add(c.s); autoAssign[c.p.id]=c.s;
  }
  const slotFor=(p)=> pinned[p.id] || autoAssign[p.id] || null;
  const bands={}; for(const b of BANDS) bands[b]=[];
  for(const p of xi){
    if(p===gkP) continue;
    const sl=slotFor(p);
    let b = (sl && SLOT_BAND[sl]) || getZone(t,p);
    if(!ROW_SLOTS[b]) b=p.pos;
    (bands[b]=bands[b]||(bands[b]=[])).push(p);
  }
  for(const band of BANDS){
    const members=bands[band]||[];
    // 이미 이 라인에 유효한(현재 밴드와 일치하는) 저장 슬롯을 가진 선수는 그대로 고정 — 재계산하지 않는다.
    // 혹시 저장값이 겹치는 경우(과거 세이브 등)는 먼저 처리되는 선수가 그 자리를 갖고, 나머지는 새로 배치된다.
    const taken=new Set();
    const sticky=[], needsPlacement=[];
    for(const p of members){
      const s=slotFor(p);
      if(s && ROW_SLOTS[band].indexOf(s)>=0 && !taken.has(s)){ taken.add(s); sticky.push(p); slotOf[p.id]=s; }
      else needsPlacement.push(p);
    }
    const freeSlots=ROW_SLOTS[band].filter(s=>s&&!taken.has(s));
    const n=needsPlacement.length;
    const pattern=(DEFAULT_SPREAD[band][Math.min(n,5)]||[]).map(i=>ROW_SLOTS[band][i]).filter(s=>s&&freeSlots.includes(s));
    const chosen = pattern.length>=n ? pattern.slice(0,n) : [...pattern, ...freeSlots.filter(s=>!pattern.includes(s))];
    needsPlacement.sort((a,b)=>a.id-b.id);
    needsPlacement.forEach((p,i)=>{
      const s=chosen[i] || freeSlots[i] || ROW_SLOTS[band].filter(Boolean)[i%ROW_SLOTS[band].filter(Boolean).length];
      slotOf[p.id]=s;
      // ⚠ 여기서 t.tactic.slot 에 되받아 쓰면 안 된다. 자동 배치가 "감독이 직접 옮긴 자리"로
      //    둔갑해 굳어버리고, 나중에 포메이션을 바꿔도 옛 자리가 남아 모양이 어긋난다.
      //    배치는 매번 같은 입력에서 같은 결과가 나오므로 저장하지 않아도 흔들리지 않는다.
    });
  }
  return slotOf;
}

function condFactor(t){ const T=TAC(t); return 1+(T.press-1)*0.35+(T.tempo-1)*0.25; }

const COMM={
 ko:["📢 킥오프! 경기가 시작됩니다.","📢 심판의 휘슬! 경기 시작입니다.",
     "📢 {r} 주심의 휘슬과 함께 경기가 시작됩니다!","📢 오늘의 주심은 {r}. 킥오프!"],
 shotOn:["{p}, 슈팅 자세를 잡습니다!","{p}의 슛!","{p}, 강력하게 때립니다!","{p}, 침착하게 슈팅을 노립니다!","{p}의 과감한 슈팅 시도!","{p}, 골문을 향해 강하게 찝니다!","{p}, 골키퍼와 1대1 찬스! 슈팅!","{p}, 컷백을 받아 그대로 때립니다!","{p}, 반박자 빠른 슈팅!","{p}, 페널티 박스 바깥에서 중거리포를 노립니다!"],
 miss:["골대를 살짝 벗어납니다.","아깝게 빗나갑니다.","골대 위로 뜹니다.","옆그물을 때립니다.","크로스바를 강타합니다!","임팩트가 흔들리며 완전히 빗나갑니다.","슈팅 타이밍을 놓치며 애매하게 흐릅니다."],
 save:["{p}의 슈팅! 골키퍼 {g} 선수, 슈퍼 세이브!","{p}, 강력한 슛— 골키퍼 {g} 선수가 쳐냅니다!","{p}의 헤더, 골키퍼 {g} 선수 정면입니다.","{p}의 낮은 슛, 골키퍼 {g} 선수가 몸을 날려 막아냅니다!"],
 saveReflex:["{p}의 날카로운 슛! 골키퍼 {g} 선수가 반사신경으로 쳐냅니다!","{p}의 슈팅, 골키퍼 {g} 선수가 순간적으로 손끝에 걸어냅니다!","{p}의 임팩트 좋은 슛이었지만, 골키퍼 {g} 선수의 놀라운 반응 속도에 막힙니다!"],
 saveCommand:["{p}의 슈팅을 골키퍼 {g} 선수가 안정적으로 정면에서 캐치합니다.","{p}의 슛, 골키퍼 {g} 선수가 침착하게 몸으로 감싸안습니다.","{p}의 슈팅, 노련한 골키퍼 {g} 선수가 미리 각도를 좁혀 손쉽게 막아냅니다."],
 block:["{p}, 몸을 던져 극적으로 블록해냅니다!","{p}의 결정적인 클리어링!","{p}, 슈팅 코스에 정확히 몸을 갖다 대며 막아냅니다!","{p}, 마지막 순간 발을 뻗어 막아냅니다!"],
 goal:["⚽ 고오오올!! {p}의 득점!","⚽ {p}!! 네트가 출렁입니다!","⚽ 골입니다! {p}이/가 해냈습니다!","⚽ {p}, 완벽한 마무리!","⚽ 터졌습니다! {p}의 득점!"],
 goalA:["⚽ 고오오올!! {a}의 패스를 {p}이/가 침착하게 마무리!","⚽ {p} 득점! {a}의 환상적인 도움이었습니다!","⚽ {a}이/가 열어준 찬스, {p}이/가 놓치지 않습니다!"],
 ownGoal:["😱 아, 이럴 수가... {p}의 클리어링이 그대로 자책골이 되고 맙니다!","😱 {p}, 걷어내려던 공이 불행히도 자기 골문으로 빨려 들어갑니다... 자책골!","😱 {p}의 몸에 맞고 굴절된 공이 골키퍼를 완전히 속이며 자책골이 됩니다!"],
 pen:["📣 페널티킥! {p}이/가 박스 안에서 쓰러졌습니다!",
   "📣 {r} 주심, 지체 없이 스팟을 가리킵니다! 페널티킥!",
   "📣 박스 안 접촉 — 휘슬! {p}이/가 얻어낸 페널티킥입니다!"],
 offside:["🚩 {p}, 오프사이드 깃발이 올라갑니다.","🚩 부심의 깃발 — {p}이/가 한 발 앞서 나갔습니다.","🚩 오프사이드입니다. {p}의 타이밍이 빨랐습니다."],
 /* ── 하이라이트 자막용 실시간 해설 (LIVE) ────────────────────────
    화면에서 벌어지는 동작 하나하나를 따라가는 문장들이다. 문자중계 로그와 달리
    하이라이트 재생 중 하단 패널에만 흐르고, 시즌 기록에는 남지 않는다. */
 lvPass:["{p}, {q}에게 연결합니다.","{p}이/가 {q}에게 붙여 줍니다.","{p}의 패스, {q}이/가 받습니다.","{p} — {q}, 간결하게 이어 갑니다.","{p}, 지체 없이 {q}에게 내줍니다."],
 lvPassLong:["{p}, 크게 방향을 전환합니다! {q}을/를 향합니다.","{p}의 롱패스가 {q}에게 향합니다.","{p}, 단번에 전방으로 띄웁니다 — {q}!"],
 lvThrough:["{p}, 수비 뒷공간으로 찔러 줍니다! {q}이/가 달려 들어갑니다!","{p}의 스루패스! {q}이/가 침투합니다!","{p}, 라인 사이를 갈랐습니다 — {q}!"],
 lvCross:["{p}, 크로스를 올립니다!","{p}의 크로스가 문전으로 향합니다!","{p}, 감아 올립니다 — 박스 안이 붐빕니다!"],
 lvCutback:["{p}, 뒤로 낮게 빼줍니다!","{p}의 컷백! 문전으로 흘러 들어갑니다!"],
 lvDrib:["{p}, 몰고 들어갑니다.","{p}이/가 공을 끌고 전진합니다.","{p}, 속도를 올립니다!"],
 lvTakeOnWin:["{p}, 제쳤습니다! 그대로 파고듭니다!","{p}의 돌파! 수비수를 벗겨냈습니다!","{p}, 방향 전환 한 번에 수비를 지나칩니다!","아! {p}, 완전히 따돌렸습니다!"],
 lvTakeOnLose:["{p}, 막힙니다. 뚫지 못했습니다.","{p}의 돌파 시도— 수비가 잘 버텨냅니다.","{p}, 각을 못 찾고 걸립니다."],
 lvTackle:["아! {p}의 태클! 볼을 빼앗습니다!","{p}, 정확한 태클로 끊어냅니다!","{p}이/가 발을 뻗어 걷어냅니다!"],
 lvSlide:["{p}, 몸을 던진 슬라이딩 태클!","{p}의 슬라이딩! 아슬아슬하게 걷어냅니다!"],
 lvItc:["{p}, 패스 길목을 읽었습니다! 가로챕니다!","{p}이/가 중간에서 잘라냅니다!","{p}, 미리 읽고 있었습니다 — 인터셉트!"],
 lvClear:["{p}, 일단 크게 걷어냅니다.","{p}이/가 지체 없이 걷어냅니다."],
 lvShot:["{p}, 때립니다!","{p}의 슛!","{p}, 주저 없이 감아 찹니다!","{p}이/가 왼발을 휘두릅니다!","{p}, 한 박자 빠르게 때립니다!"],
 lvShotLong:["{p}, 중거리에서 노려 봅니다!","{p}, 멀리서 강하게 때립니다!"],
 lvHead:["{p}, 머리로 방향을 바꿉니다!","{p}의 헤더!"],
 lvSave:["{g} 골키퍼! 막아냅니다!","{g}, 손끝으로 걷어냅니다!","{g}의 선방! 소리가 터져 나옵니다!","{g}이/가 반응합니다 — 막아냅니다!"],
 lvCatch:["{g}, 안정적으로 품에 안습니다."],
 lvParry:["{g}이/가 쳐냈습니다! 아직 살아 있습니다!","{g}, 앞으로 쳐냅니다 — 위험합니다!"],
 lvTip:["{g}, 손끝에 걸었습니다! 코너킥!"],
 lvPunch:["{g}, 주먹으로 멀리 걷어냅니다!"],
 lvBlock:["{p}, 몸을 던져 막아냅니다!","{p}이/가 슈팅 코스를 막습니다!"],
 lvMiss:["빗나갑니다! 아깝습니다!","골문을 살짝 벗어납니다.","크로스바를 넘어갑니다!","옆그물을 때립니다. 아쉽습니다."],
 lvPost:["아! 골포스트를 때립니다!","크로스바 강타! 믿기지 않습니다!"],
 lvGoalLive:["⚽ 들어갔습니다!! {p}!!","⚽ 골!! {p}의 득점입니다!!","⚽ {p}!!! 그물이 흔들립니다!!","⚽ 터졌습니다! {p}!!"],
 lvGoalA:["⚽ {a}의 패스, {p}이/가 마무리합니다!!","⚽ {a}이/가 내준 공을 {p}이/가 밀어 넣습니다!!"],
 /* ── 골 종류별 첫 마디 ─────────────────────────────────────── */
 gHeader:["⚽ 헤더 골!! {p}, 완벽한 타이밍이었습니다!!","⚽ {p}의 머리!! 그대로 꽂힙니다!!","⚽ 솟아올랐습니다 — {p}의 헤더 골!!"],
 gVolley:["⚽ 발리 슛!! {p}, 이걸 그대로 때립니다!!","⚽ {p}의 논스톱 발리!! 환상적입니다!!","⚽ 떨어지는 공을 {p}이/가 그대로 감아 찼습니다!!"],
 gLong:["⚽ 중거리포!! {p}, 엄청난 슛입니다!!","⚽ {p}, 먼 거리에서 그대로 꽂아 넣습니다!!","⚽ 이건 대포알입니다! {p}의 중거리 골!!"],
 gFinesse:["⚽ 감아 찼습니다!! {p}, 구석으로 정확하게!!","⚽ {p}의 감아차기!! 골키퍼 손이 닿지 않습니다!!","⚽ 완벽한 궤적입니다 — {p}!!"],
 gChip:["⚽ 로빙 슛!! {p}, 골키퍼 머리 위를 넘겼습니다!!","⚽ {p}, 침착하게 띄워 넣습니다!!"],
 gPower:["⚽ 강슛!! {p}, 그물을 찢을 기세입니다!!","⚽ {p}의 강력한 슛이 그대로 들어갑니다!!"],
 gTap:["⚽ {p}, 밀어 넣기만 하면 됐습니다!!","⚽ 문전에서 {p}이/가 놓치지 않습니다!!","⚽ {p}, 침착하게 마무리합니다!!"],
 gPen:["⚽ 페널티킥 성공!! {p}, 흔들리지 않았습니다!!","⚽ {p}, 스팟에서 침착하게 넣습니다!!"],
 gFK:["⚽ 프리킥 골!!! {p}, 벽을 넘겨 그대로 꽂았습니다!!","⚽ {p}의 프리킥이 그대로 골문으로!!"],
 gSolo:["⚽ 단독 돌파에 이은 마무리!! {p}, 혼자 다 했습니다!!","⚽ {p}, 제치고 또 제치고— 그대로 골!!"],
 /* ── 세리머니 중 이어지는 리액션 ───────────────────────────── */
 celA:["와... 정말 멋진 골입니다.","이건 다시 봐야 합니다. 대단한 마무리였어요.","경기장이 완전히 폭발했습니다!","{p}, 두 팔을 벌리고 달려갑니다!","동료들이 {p}에게 몰려듭니다!"],
 celKeeper:["골키퍼도 막을 수 없는 슛이었습니다.","골키퍼는 그저 지켜볼 수밖에 없었습니다.","저건 어떤 골키퍼라도 어렵습니다."],
 celScore:["{t} {h} : {a} — 스코어가 바뀌었습니다.","이제 {h} 대 {a}입니다."],
 goalOffText:["🚩 골이 취소됩니다! {p}의 득점, 오프사이드 판정입니다.","🚩 {p}의 골— 부심의 깃발이 올라갑니다. 노골!"],
 lvOffFlag:["...그런데 부심의 깃발이 올라가 있습니다!","아, 잠깐— 깃발입니다!","부심이 깃발을 들고 있습니다!"],
 lvOffCancel:["🚩 오프사이드! {p}의 골이 취소됩니다!","🚩 노골입니다. {p}이/가 한 발 앞서 있었습니다.","🚩 득점 취소— 아슬아슬했습니다."],
 lvOffAfter:["선수들이 주심에게 항의합니다.","벤치에서 거세게 항의합니다.","리플레이로는 정말 종이 한 장 차이였습니다."],
 lvVarWait:["📺 판독이 길어집니다... 양 팀 선수들이 주심 주변에 모여 있습니다.","📺 관중석도 숨을 죽입니다. 전광판만 쳐다봅니다.","📺 주심이 손가락으로 귀를 누른 채 움직이지 않습니다."],
 lvVarOk:["📺 골 인정! {p}, 이제야 마음껏 웃습니다!","📺 주심이 센터서클을 가리킵니다 — 골입니다!"],
 lvVarNo:["📺 골 취소! {p}, 믿을 수 없다는 표정입니다.","📺 판독 결과 노골 — 벤치가 폭발합니다!"],
 celTeam:["{t} 벤치가 들썩입니다!","{t}, 분위기를 완전히 가져왔습니다!"],
 celEqual:["{t}, 승부를 다시 원점으로 돌립니다!","동점입니다! {t}이/가 균형을 맞췄습니다.","{t}, 기어이 따라붙었습니다!"],
 celLead:["{t}, 경기를 뒤집었습니다!","역전입니다! {t} 벤치가 뛰쳐나옵니다!","{t}이/가 앞서 나갑니다!"],
 celExtra:["{t}, 한 골 더 달아납니다.","{t}이/가 격차를 벌립니다.","쐐기를 박는 분위기입니다.","{t}, 이제 여유가 생겼습니다."],
 celRout:["{t}, 완전히 경기를 지배하고 있습니다.","이제는 일방적인 흐름입니다.","{t} 팬들은 축제 분위기입니다."],
 celChase:["{t}, 아직 포기하지 않았습니다!","한 골 따라붙습니다! 시간은 남아 있습니다.","{t} 벤치가 선수들을 재촉합니다."],
 lvFoulLive:["{p}, 반칙입니다. 휘슬이 울립니다.","{p}의 파울 — 주심이 경기를 끊습니다.","{p}, 늦었습니다. 반칙 선언입니다."],
 lvYellowLive:["🟨 {p}, 경고를 받습니다."],
 lvRedLive:["🟥 {p}, 퇴장입니다! 경기장이 술렁입니다!"],
 lvPenLive:["🅿️ 주심이 스팟을 가리킵니다! 페널티킥입니다!"],
 lvOffLive:["🚩 오프사이드! {p}이/가 먼저 나갔습니다."],
 lvCornerLive:["코너킥입니다. {t}의 기회입니다.","{t}, 코너킥을 얻어냅니다."],
 lvFKLive:["프리킥입니다. 벽이 세워집니다.","위험한 위치의 프리킥— 수비벽이 섭니다."],
 lvAerial:["{p}, 공중볼을 따냅니다!","{p}이/가 높이 솟아 머리에 맞힙니다!"],
 lvInjury:["아... {p}이/가 쓰러져 있습니다. 괜찮을까요?","{p}, 그라운드에 주저앉습니다. 부상인가요?"],
 lvGKrush:["{g} 골키퍼가 뛰쳐나옵니다!","{g}, 박스 밖까지 나와 처리합니다!"],
 penGiven:["🅿️ 페널티킥이 선언됩니다! {t}에게 절호의 기회!","🅿️ 주심이 스팟을 가리킵니다 — {t}의 페널티킥!"],
 fkSpot:["{t}, 슈팅 각도에서 프리킥을 얻어냅니다. 벽이 세워집니다."],
 penGoal:["⚽ {p}, 페널티킥을 침착하게 성공시킵니다!"],
 penMiss:["{p}의 페널티킥... 골키퍼 {g} 선수 선방!! 믿을 수 없습니다!","{p}의 페널티킥을 골키퍼 {g} 선수가 정확히 예측하고 막아냅니다!"],
 foul:["{p}의 파울. 프리킥이 주어집니다.","{p}, 다소 거친 태클. 휘슬이 울립니다.",
   "{p}의 반칙 — {r} 주심, 어드밴티지 없이 바로 끊습니다.","{p}, 상대 유니폼을 잡아챕니다. 휘슬.",
   "{r} 주심이 {p}을/를 불러 짧게 주의를 줍니다.","{p}의 파울. 카드는 아낍니다."],
 yellow:["🟨 {p}, 경고를 받습니다.","🟨 {p}에게 옐로카드가 나옵니다.",
   "🟨 {r} 주심, 망설임 없이 카드를 꺼냅니다 — {p} 경고.","🟨 {p}, 전술적인 파울. 대가는 옐로카드입니다.",
   "🟨 {r} 주심이 {p}을/를 불러 세웁니다. 경고입니다.","🟨 {p}, 항의해 보지만 카드는 이미 나왔습니다."],
 second:["🟥 {p}, 두 번째 경고!! 퇴장입니다! 팀이 10명으로 싸웁니다!",
   "🟥 {r} 주심, 옐로 그리고 레드!! {p}, 경고 누적 퇴장입니다!",
   "🟥 {p}, 알고도 갔습니다 — 두 번째 옐로카드, 퇴장!"],
 red:["🟥 {p}, 다이렉트 퇴장!!! 심각한 반칙이었습니다!",
   "🟥 {r} 주심, 곧바로 레드카드!! {p}, 그라운드를 떠납니다!",
   "🟥 {p}!! 변명의 여지가 없는 태클 — 다이렉트 퇴장입니다!",
   "🟥 레드카드!! {p}의 항의도 소용없습니다. {r} 주심의 판정은 단호합니다."],
 dissentYellow:["🟨 실점 직후 흥분한 {p}, 주심에게 거칠게 항의하다 경고를 받습니다.","🟨 {p}, 판정에 격하게 항의하며 경고를 자초합니다.",
   "🟨 {p}, {r} 주심 면전까지 다가가 소리칩니다 — 바로 카드가 나옵니다."],
 dissentRed:["🟥 {p}, 흥분을 참지 못하고 주심에게 거칠게 항의하다 곧바로 퇴장당합니다!","🟥 실점에 격분한 {p}, 도를 넘는 항의로 다이렉트 퇴장!"],
 dissentSecond:["🟥 {p}, 항의로 두 번째 경고!! 흥분을 이기지 못하고 결국 퇴장당합니다.","🟥 이미 경고가 있던 {p}, 격분한 항의로 두 번째 옐로— 퇴장입니다!"],
 varCheck:["📺 골이 터진 듯했지만... 주심이 헤드셋에 손을 얹습니다. VAR 확인에 들어갑니다!","📺 {p}의 득점 장면, VAR 판독실에서 확인을 요청합니다. 경기가 잠시 중단됩니다.","📺 골 셀레브레이션이 채 끝나기도 전에 VAR 확인 사인이 떨어집니다!",
   "📺 {r} 주심이 귀에 손을 댑니다 — 판독실의 {v} 심판과 교신 중입니다.","📺 {r} 주심, 사각형을 그립니다. 온에어 리뷰!"],
 varConfirm:["📺 길었던 VAR 확인이 끝났습니다 — 골 인정!","📺 주심이 그라운드로 돌아와 골을 선언합니다. 판독 결과 이상 없음!",
   "📺 {v} 심판의 확인 끝 — {r} 주심이 센터서클을 가리킵니다. 골입니다!"],
 varOverturnOffside:["📺 판독 결과 — 오프사이드! {p}의 득점이 최종 취소됩니다.","📺 라인 판독 결과 미세한 오프사이드가 확인되며 골이 취소됩니다."],
 varOverturnFoul:["📺 판독 결과 — 빌드업 과정에서 파울이 확인되어 골이 취소됩니다.","📺 {p}의 골이 만들어지기 직전 handball 파울이 확인되며 취소됩니다."],
 corner:["{t}, 코너킥을 얻어냅니다.","{t}의 코너킥 찬스."],
 inj:["🚑 {p}, 그라운드에 쓰러집니다. 부상인 것 같습니다."],
 ht:["⏸️ 전반 종료. 라커룸으로 향합니다.","⏸️ 전반이 끝났습니다.","⏸️ {r} 주심의 휘슬 — 전반 45분이 끝났습니다."],
 ft:["📢 경기 종료!","📢 {r} 주심의 긴 휘슬! 경기가 끝났습니다.","📢 끝났습니다! 90분의 승부가 마무리됩니다."]
};
/* 받침이 있는 글자인가 — 조사(이/가, 은/는, 을/를)를 고르는 기준 */

function hasJong(ch){
  if(!ch) return false;
  const c=ch.charCodeAt(0);
  if(c<0xAC00 || c>0xD7A3) return /[0-9a-zA-Z]/.test(ch) ? /[lmnr1360-9]/i.test(ch) : false;
  return ((c-0xAC00)%28)!==0;
}
/* 해설 문장 만들기.
   {p}{q}{a}{t}{g} 를 채우고, 바로 뒤에 오는 조사를 이름의 받침에 맞춰 고른다.
   ("맹성웅가" → "맹성웅이", "야고이" → "야고가") */

const JOSA={"이/가":["이","가"], "은/는":["은","는"], "을/를":["을","를"],
            "과/와":["과","와"], "와/과":["과","와"], "으로/로":["으로","로"]};

function fixJosa(s){
  return s.replace(/(.)(이\/가|은\/는|을\/를|과\/와|와\/과|으로\/로)/g,
    (m,ch,j)=> ch + JOSA[j][hasJong(ch)?0:1]);
}

const F_=(a,o)=>{
  o=o||{};
  let s=(typeof a==="string")?a:pick(a);
  // ⚠ \w 는 한글을 포함하지 않는다. timeVars() 가 주는 {개막D}·{시기}·{계절} 같은 한글 키가
  //    치환되지 않고 그대로 화면에 찍히던 버그가 있어, 한글 음절도 키로 받도록 넓혔다.
  s=s.replace(/\{([\w가-힣]+)\}/g, (m,k)=> (o[k]!==undefined && o[k]!==null) ? String(o[k]) : (k==="g"?"골키퍼":k==="r"?"주심":""));
  return fixJosa(s);
};
/* ---------- 매치 엔진 (분 단위) ---------- */
/* 관중이 많을수록 홈 이점이 커진다. 넓은 경기장에 반만 찬 것보다, 작은 전용구장이
   꽉 찬 쪽이 훨씬 시끄럽다 — 절대 인원과 좌석 점유율을 함께 본다. */

function ev(M, side, txt, type, noTime, scene){
  const t=side?side.team.short:"";
  // noTime(시간 배지 없이 "이어지는 줄"처럼 보이게 하는 연출)은 바로 앞 줄이 "같은 팀"의 이벤트일 때만 허용한다.
  // 그렇지 않으면(직전 줄이 다른 팀 이벤트) — 예: A팀 선수 슛 액션 줄 바로 다음에 B팀의 (한 템포 늦게 공개되는)
  // 슛 결과가 나오는 경우 — 시간 배지 없이 붙어 나와서 마치 A팀 슛이 B팀 결과로 이어진 것처럼 오해를 산다.
  // 이런 경우엔 강제로 시간 배지를 붙여 "다른 순간의 다른 팀 이야기"라는 걸 명확히 한다.
  const prev=M.events.length?M.events[M.events.length-1]:null;
  const effNoTime = !!noTime && (!prev || prev.t===t);
  // scene: 2D 매치엔진(바둑알 시각화)이 이 이벤트를 어떻게 애니메이션으로 재현할지 알려주는 메타데이터.
  // {kind, side:'h'|'a', ...관련 선수 id} 형태 — 없으면(scene:null) 2D 화면은 정지된 포메이션 위에 자막만 띄운다.
  // scene이 있을 때만 "지금 이 순간" 22명의 좌표 스냅샷(form)을 함께 저장해 둔다 — 실제 2D 화면에는
  // 이벤트가 한 템포(혹은 그 이상) 늦게 재생되므로, 재생 시점에 M을 다시 조회하면 그 사이 교체·퇴장 등으로
  // 선수가 그라운드에 없어져 애니메이션이 깨질 수 있다. 이벤트 발생 "그 순간"의 좌표를 박제해 두면 안전하다.
  const form = scene ? computeFormationPositions(M) : null;
  M.events.push({min:M.min>90?"90+"+(M.min-90):M.min, t, txt, type:type||"txt", noTime:effNoTime, col:(side&&side.team)?side.team.col:null, scene:scene||null, form,
                 hg:M.hg, ag:M.ag});   // 이 줄이 공개될 때의 스코어 — 전광판이 골보다 먼저 올라가지 않게 한다
}

function onPitch(sd){ return sd.list.filter(x=>x.off===null); }

function refVars(M){
  try{ const c=refCrewOf(M); return {r:c.main.n, v:c.var_.n, rt:(c.main.t||{}).n||""}; }
  catch(e){ return {r:"주심", v:"VAR", rt:""}; }
}

function banMatches(second){ return second ? 1 : (2 + (RNG()<0.3?1:0)); }

function freezeLiveSlots(sd){
  const t=sd&&sd.team;
  if(!t || !t.isUser || !t.tactic) return;
  const xi=onPitch(sd).map(x=>x.p);
  if(xi.length<3) return;
  let slotOf; try{ slotOf=computeRenderSlots(t, xi); }catch(e){ return; }
  if(!t.tactic.slot) t.tactic.slot={};
  for(const q of xi){
    const sl=slotOf[q.id];
    if(sl && sl!=="GK" && SLOT_BAND[sl]) t.tactic.slot[q.id]=sl;
  }
}

function subIn(M, sd, key, outX, inP, silent){
  /* ⚠ 마지막 방어선 — 호출부(UI·AI)가 각자 검사하지만, 어느 경로가 놓쳐도 여섯 장째는 없다 */
  if(sd.subs>=5) return null;
  if(!inP || !outX || outX.off!==null && !outX.injGap) return null;   // 이미 나간 선수를 또 빼는 사고 방지
  freezeLiveSlots(sd);                 // ⚠ 교체로 사람이 바뀌기 전에 현재 진영을 굳힌다
  outX.off=M.min;
  // 교체 투입 선수는 "최적 포지션"으로 자동 재배치되는 게 아니라, 나간 선수가 있던 자리(zone+slot)를
  // 정확히 그대로 물려받는다 — 실제 축구에서 교체 선수가 나간 선수 자리로 들어가는 것과 동일하게.
  const t=sd.team;
  let _oldSlot=null;
  if(inP.pos!=="GK" && outX.p.pos!=="GK" && t && t.tactic){
    const oldZone=getZone(t, outX.p);
    const oldSlot=(t.tactic.slot && t.tactic.slot[outX.p.id]) || null;
    _oldSlot=oldSlot;
    setZone(t, inP.id, oldZone);
    if(oldSlot) setSlot(t, inP.id, oldSlot);
  }
  /* 역할·임무도 함께 물려받는다.
     ⚠ 역할은 선수 id 로 저장된다(t.tactic.role[pid]). 그래서 교체로 사람이 바뀌면 그 자리에
        지정해 둔 역할이 사라지고 슬롯 기본 역할로 되돌아갔다 — 라움도이터로 세워 둔 왼쪽 윙어가
        교체 한 번에 그냥 '윙'이 되는 식이다. 카드에 찍힌 역할 이름이 전부 바뀌니
        감독 눈에는 "교체했더니 전술이 통째로 갈렸다"로 보인다.
        나간 선수가 맡던 역할을 그대로 넘겨준다. 그 자리에서 맡을 수 없는 역할이면 넘기지 않는다. */
  if(t && t.tactic){
    const rMap = t.tactic.role || (t.tactic.role={});
    const oldRole = rMap[outX.p.id];
    if(oldRole && ROLE_BY_KEY[oldRole.r]){
      const slotKey = _oldSlot || (outX.p.pos==="GK" ? "GK" : null);
      const grp = slotKey ? ROLE_GRP[slotKey] : null;
      if(!grp || ROLE_BY_KEY[oldRole.r].grp.includes(grp)) rMap[inP.id]={r:oldRole.r, d:oldRole.d};
    }
  }
  const nx={p:inP, fit:inP.cond, y:0, red:false, goals:0, assists:0, on:M.min, off:null};
  sd.list.push(nx);
  sd.bench.splice(sd.bench.indexOf(inP),1);
  sd.subs++; M.xiDirty=true;
  if(!silent){
    /* ⚠ 예전에는 F_(COMM.sub,{}) 로 부른 뒤 replace 로 이름을 끼워 넣었다. F_ 가 {o}/{i} 를
       먼저 빈 문자열로 지워 버려서, 문자중계에 "🔁 교체:  OUT →  IN" 처럼 이름 없이 찍혔다. */
    ev(M, sd, F_(COMM.sub,{o:outX.p.name, i:inP.name}), "sub", false, {kind:"sub", atkSide:key, outId:outX.p.id, inId:inP.id});
    /* 중계 화면이 잠깐 멈추고 해설이 읽어 줄 거리 — 양 팀 모두 남긴다.
       ⚠ 예전에는 한 변수(M.subShow)에 덮어썼다. 한 창에서 두 명을 바꾸면 뒤엣것이 앞엣것을
          지워 버려서 해설이 한 번만 나왔다. 큐에 쌓아 하나씩 읽는다. */
    if(!M.subQueue) M.subQueue=[];
    M.subQueue.push({out:outX.p.name, in:inP.name, side:key, min:M.min,
               team:t?t.short:"", isUser:!!(t&&t.isUser), col:(t&&t.col)||null, shown:false});
  }
  return nx;
}
COMM.sub=["🔁 교체: {o} OUT → {i} IN"];
/* 교체 순간 해설 — 우리 팀과 상대 팀의 말투가 다르다 */
COMM.subOur=["🔁 {t}, 선수를 바꿉니다. {o} 나가고 {i} 들어갑니다.",
  "🔁 {t} 벤치가 움직입니다 — {o} 대신 {i}입니다.",
  "🔁 교체입니다. {o}이/가 벤치로, {i}이/가 그라운드로 들어섭니다.",
  "🔁 {t}의 카드. {o} 빠지고 {i} 투입됩니다.",
  "🔁 {o}, 박수를 받으며 나갑니다. 자리는 {i}이/가 채웁니다."];
COMM.subMore=["🔁 {t}, 한 번에 둘을 바꿉니다 — 먼저 {o} 나가고 {i}입니다.",
  "🔁 {t} 벤치가 두 장을 씁니다. {o} 대신 {i}, 그리고 한 명 더 있습니다.",
  "🔁 {t}의 이중 교체. 우선 {o}과/와 {i}이/가 교대합니다."];
COMM.subOpp=["🔁 {t} 벤치가 움직입니다 — {o} 나가고 {i} 들어갑니다.",
  "🔁 {t} 벤치, {o}을/를 불러들이고 {i}을/를 넣습니다.",
  "🔁 {t}의 교체. {i}이/가 몸을 다 풀었습니다. {o}과/와 교대합니다.",
  "🔁 {t}, {i}을/를 투입하며 흐름을 바꾸려 합니다.",
  "🔁 {t} 감독이 {o}을/를 부릅니다. {i} 투입."];
/* 우리가 먼저 바꾼 직후의 상대 교체 — 이때만 "맞대응" 뉘앙스가 성립한다 */
COMM.subOppReact=["🔁 {t}도 곧바로 손을 씁니다 — {o} 나가고 {i} 들어갑니다.",
  "🔁 우리 교체를 보고 {t} 벤치가 반응합니다. {o} 아웃, {i} 인.",
  "🔁 맞교체입니다. {t}, {i}을/를 꺼내 듭니다."];
/* 전반 이른 교체 — 대개 좋은 신호가 아니다 */
COMM.subEarly=["🔁 이른 시간의 교체입니다 — {t}, {o} 대신 {i}. 몸 상태가 좋지 않아 보였습니다.",
  "🔁 벌써 카드를 씁니다. {t}의 {o}, 아쉬운 표정으로 나옵니다. {i} 투입."];
/* 종반 승부수 */
COMM.subLate=["🔁 {t}의 마지막 카드 — {o} 나가고 {i}. 이 교체가 승부를 가를 수 있습니다.",
  "🔁 종료가 머지않았습니다. {t}, {i}을/를 넣으며 마지막 승부수를 던집니다."];

function canEnter(sd, outX, p){ // 외국인 동시 출전 한도 + 골키퍼 중복 검사 (홈그로운은 쿼터 미적용)
  /* 골키퍼를 넣으려면 지금 골문에 선 선수가 나가야 한다 — 안 그러면 키퍼가 둘이 된다 */
  if(p.pos==="GK" && onPitch(sd).some(x=>x!==outX && x.p.pos==="GK")) return false;
  if(!frnQ(p)) return true;
  const lim=sd.team.div===1?5:4;
  return onPitch(sd).filter(x=>x!==outX&&frnQ(x.p)).length+1<=lim;
}

const AI_SUB_WINDOWS=[46,58,66,73,80,86];

const AI_SUB_TIRED=64;        // 이 밑이면 피로 교체 후보

const AI_SUB_URGENT=54;       // 이 밑이면 최고 선수라도 뺀다

function aiSubs(M, minNow){
  const m = (minNow!=null) ? minNow : M.min;
  const win = AI_SUB_WINDOWS.indexOf(m)>=0;
  for(const [sd,key,myG,opG] of [[M.h,"h",M.hg,M.ag],[M.a,"a",M.ag,M.hg]]){
    if(sd.team.isUser) continue;
    if(!sd.bench || !sd.bench.length) continue;
    /* [KMD26 SUB-01] 부상으로 비운 자리는 교체 창을 기다리지 않는다.
       KM26 은 이 순간 감독에게 물어보지만(needsSubPause) 듀얼에는 물어볼 사람이 없어,
       20분에 다치면 남은 70분을 열 명으로 뛰었다. 난수를 쓰지 않으므로 재생도 안 갈린다. */
    while(sd.subs<5 && aiFillGap(M, sd, key)) ;
    if(!win) continue;
    if(RNG()<0.18) continue;          // 이번 창은 그냥 지켜본다
    let made=0;
    const cap = RNG()<0.30 ? 2 : 1;    // 한 번에 둘을 바꾸는 건 가끔이다
    while(sd.subs<5 && made<cap && aiSubOnce(M, sd, key, myG-opG, m)) made++;
  }
}
/* ── [KMD26 SUB-01] 누구를 넣을 것인가 ──────────────────────────────
   교체 선수는 나간 선수의 자리를 그대로 물려받는다(subIn). 그러므로 "누구를 빼는가"가
   곧 "누가 어느 자리에 서는가"다. 원본은 들어올 사람을 '포지션 묶음(DF/MF/FW)이 같은
   사람 중 능력치 최고'로 골랐는데, 듀얼에서는 두 군데가 어긋난다.
     · 화면은 벤치에 S1~S9 번호를 붙여 놓고, 엔진은 그 순서를 하나도 쓰지 않았다
     · 지고 있을 때 수비수를 빼고 공격수를 넣으면 그 공격수가 센터백 자리에 선다
   그래서 "그 자리를 볼 수 있는가"(자리 능숙도)를 먼저 보고, 그중에서 감독이 매겨 둔
   벤치 순서를 따른다. */
const AI_SUB_FAM_MIN=50;      // 이 아래면 그 자리를 소화한다고 보지 않는다

const AI_POS_FWD={DF:0, MF:1, FW:2};

function subSlotOf(sd, x){
  const t=sd.team;
  return (t && t.tactic && t.tactic.slot && t.tactic.slot[x.p.id]) || null;
}
/* 나갈 자리에 세울 사람 — 그 자리를 볼 수 있는 사람 중 벤치 번호가 빠른 순.
   strict 면 아무도 그 자리를 못 볼 때 아예 넣지 않는다(굳이 안 해도 되는 교체용). */
function subPickIn(sd, outX, extra, strict){
  const cand=sd.bench.filter(p=>p.pos!=="GK" && canEnter(sd, outX, p) && (!extra||extra(p)));
  if(!cand.length) return null;
  const slot=subSlotOf(sd, outX);
  if(!slot) return strict ? null : cand[0];
  const fit=cand.filter(p=>getPosFam(p, slot)>=AI_SUB_FAM_MIN);
  if(fit.length) return fit[0];                          // 벤치 순서 그대로
  if(strict) return null;
  // 아무도 그 자리를 못 보면 그나마 나은 사람 — 열한 명은 채워야 한다
  return cand.slice().sort((a,b)=>getPosFam(b,slot)-getPosFam(a,slot))[0];
}
/* 부상으로 비운 자리 하나를 채운다. 채웠으면 true. */
function aiFillGap(M, sd, key){
  const gap=sd.list.find(x=>x.injGap && x.off!==null && !x.red);
  if(!gap) return false;
  const inP=subPickIn(sd, gap);
  if(!inP){ gap.injGap=false; return false; }   // 채울 사람이 없다 — 다시 보지 않는다
  /* injGap 은 subIn **뒤에** 내린다. 먼저 내리면 subIn 의 '이미 나간 선수를 또 빼는가'
     가드(outX.off!==null && !outX.injGap)에 걸려 교체가 조용히 실패한다. */
  const ok=!!subIn(M, sd, key, gap, inP);
  gap.injGap=false;
  return ok;
}
/* 한 명만 바꾼다. 바꿨으면 true. */

function aiSubOnce(M, sd, key, diff, m){
  const pitch=onPitch(sd).filter(x=>x.p.pos!=="GK" && !x.red);
  if(pitch.length<8) return false;                       // 이미 수적 열세면 더 빼지 않는다
  const bench=sd.bench.filter(p=>p.pos!=="GK");
  if(!bench.length) return false;
  // 이 팀의 기둥 — 웬만해선 빼지 않는다
  const core=[...pitch].sort((a,b)=>b.p.ovr-a.p.ovr).slice(0,2).map(x=>x.p.id);
  const protectedOut=x=>core.indexOf(x.p.id)>=0 && x.fit>=AI_SUB_URGENT;
  const tryPair=(outX, extra, strict)=>{
    if(!outX || protectedOut(outX)) return false;
    const inP=subPickIn(sd, outX, extra, strict);
    return !!(inP && subIn(M, sd, key, outX, inP));
  };
  // ① 경고 + 피로 — 퇴장 나기 전에 뺀다
  const risky=pitch.filter(x=>x.y>0 && x.fit<72 && !protectedOut(x)).sort((a,b)=>a.fit-b.fit)[0];
  if(risky && tryPair(risky)) return true;
  // ② 체력이 무너진 선수
  const tired=pitch.filter(x=>x.fit<AI_SUB_TIRED && (!protectedOut(x)||x.fit<AI_SUB_URGENT))
                   .sort((a,b)=>a.fit-b.fit)[0];
  if(tired && tryPair(tired)) return true;
  /* ③ 지고 있다 — 앞으로 민다. 뒷선 자리 가운데 "그 자리를 볼 수 있으면서 더 공격적인"
       자원이 벤치에 있는 자리를 바꾼다. 원본처럼 수비수를 빼고 무조건 공격수를 넣으면
       그 공격수가 수비 자리를 물려받아, 지고 있는 팀이 오히려 약해졌다. */
  if(diff<0 && m>=58){
    const back=pitch.filter(x=>x.p.pos!=="FW")
                    .sort((a,b)=>(a.p.ovr+a.fit*0.3)-(b.p.ovr+b.fit*0.3));
    for(const outX of back)
      if(tryPair(outX, p=>(AI_POS_FWD[p.pos]||1)>(AI_POS_FWD[outX.p.pos]||1), true)) return true;
  }
  // ④ 이기고 있다 — 문을 닫는다. 같은 요령으로 앞선 자리를 더 수비적인 자원으로.
  if(diff>0 && m>=73){
    const front=pitch.filter(x=>x.p.pos!=="DF").sort((a,b)=>a.fit-b.fit);
    for(const outX of front)
      if(tryPair(outX, p=>(AI_POS_FWD[p.pos]||1)<(AI_POS_FWD[outX.p.pos]||1), true)) return true;
  }
  // ⑤ 그 밖에는 확실한 업그레이드가 있을 때만 (벤치가 더 좋고, 나갈 선수는 지쳐 있을 때)
  if(m>=66){
    for(const outX of [...pitch].sort((a,b)=>a.fit-b.fit)){
      if(outX.fit>=78) continue;
      if(tryPair(outX, p=>p.ovr>outX.p.ovr+2, true)) return true;
    }
  }
  return false;
}
/* ── 경기 결과에 따른 구단주·팬 신뢰도 변화 (FM 스타일) ──
   단순히 "이기면 +, 지면 -"가 아니라, 상대와의 전력차·기대치 대비 결과로 판단한다:
   약팀 상대로 이기는 건 당연하니 소폭만 오르고, 강팀을 잡는 이변엔 크게 오른다.
   반대로 약팀에게 지면 팬·구단주 모두 크게 실망하고, 강팀에게 지는 건 어느 정도 이해받는다.
   점수차(마진)가 클수록 임팩트가 더 커지도록 배율을 곱한다. */

function tacticSig(t){
  const T=TAC(t);
  return [T.formation,T.mentality,T.pass,T.tempo,T.press,T.line,T.width,T.tackle,T.longShot,T.counter?1:0].join("|");
}

const FAM_PENALTY={formation:20, mentality:5, pass:6, tempo:4, press:5, line:5, width:4, tackle:3, longShot:2, counter:4};

function noteTacticChange(t, scale){
  if(!t) return;
  const sig=tacticSig(t);
  if(t._sig===undefined){ t._sig=sig; return; }
  if(t._sig===sig) return;
  const old=t._sig.split("|"), now=sig.split("|");
  const keys=["formation","mentality","pass","tempo","press","line","width","tackle","longShot","counter"];
  let pen=0;
  for(let i=0;i<keys.length;i++){
    if(old[i]===now[i]) continue;
    const k=keys[i];
    // 슬라이더는 한 칸만 밀 수도, 끝에서 끝까지 밀 수도 있다. 움직인 칸 수에 비례해서 깎는다.
    if(k==="formation"||k==="counter"){ pen+=FAM_PENALTY[k]; continue; }
    const d=Math.abs((+now[i]||0)-(+old[i]||0));
    pen += FAM_PENALTY[k] * clamp(d/2, 0.5, 2);
  }
  t._sig=sig;
  if(pen>0) t.fam=clamp(famOf(t)-pen*(scale===undefined?1:scale), 0, 100);
}

function famOf(t){ return t && t.fam!=null ? t.fam : 70; }
/* 조직력은 위로 갈수록 더디게 오른다. 58에서 시작해 5주면 '매우 익숙함',
   시즌 중반에 95 근처로 수렴한다. 포메이션을 갈아엎으면(-20) 다시 5주가 든다. */

let simPick=null;
/* 색이 밝은지 — 밝은 유니폼 위에는 검은 등번호를 써야 읽힌다 */

function starValFromScore(score){
  return clamp(Math.round((STAR_MID + (score-62)/STAR_SPAN)*2)/2, 0.5, 5);
}

function ovrStarVal(o){ return starValFromScore(o); }
/* ── 팀 전력 별점 ──────────────────────────────────────────────
   선수 눈금(starValFromScore)을 팀 평균에 그대로 쓰면 안 된다. 11명을 평균 내면 값이 가운데로
   몰려서 리그 전체가 3~4.5★ 안에 뭉개진다 — 최하위와 우승 후보가 별 한 개 차이로 보인다.
   그래서 팀은 팀끼리 비교하는 별도 눈금을 쓴다. K리그 팀 평균은 대략 61~77 사이에 깔린다. */

function lerp(a,b,t){ return a+(b-a)*t; }

const PITCH_AR=(640-36)/(420-36); // 캔버스 가로/세로 비 (패딩 18px 제외)

function clamp01(v){ return v<0?0:v>1?1:v; }
/* 하이라이트가 "인플레이 공격 장면"인지 구분한다 — 이 종류일 때만 22명 전체가 움직이고, 카드/파울/부상/
   교체/VAR/킥오프처럼 경기가 멈춘 상황에서는 실제 축구처럼 선수들도 제자리에 서 있는다. */

const SPD={ SPRINT:0.078, RUN:0.064, DRIBBLE:0.050, JOG:0.040, GK:0.030 };
/* ── 주력·가속도를 화면에서 느끼게 하는 두 배수 ──────────────────────
   예전에는 최고 속도 배수가 0.89~1.11밖에 안 돼서, 주력 5인 노장과 주력 18인 윙어가
   사실상 같은 속도로 뛰었다. 축구에서 스피드는 그렇게 작은 차이가 아니다.
   리그 평균(≈0.60)이 정확히 1.00이 되도록 맞추고, 위아래로 ±20% 남짓 벌린다.
   · paceMul  — 길게 달릴 때의 최고 속도. 뒷공간 경쟁·역습 상황을 지배한다.
   · accMul   — 첫 몇 걸음. 세컨볼 다툼, 압박 도달, 돌파 직후 이탈이 여기서 갈린다.
   둘을 나눈 이유는 "느리지만 순간적인" 선수와 "굼뜨지만 최고속이 높은" 선수가
   서로 다른 장면에서 강해야 하기 때문이다. */

const SPD_A=0.533, SPD_B=0.780, SPD_LO=0.76, SPD_HI=1.22;

const ACC_A=0.300, ACC_B=1.170, ACC_LO=0.62, ACC_HI=1.52;

function paceMul(a){
  const v=(a && a.topSpeed!=null) ? a.topSpeed : ((a && a.paceSkill) || 0.6);
  return clamp(SPD_A+v*SPD_B, SPD_LO, SPD_HI);
}

function accMul(a){
  const v=(a && a.accelSkill!=null) ? a.accelSkill : ((a && a.paceSkill) || 0.6);
  return clamp(ACC_A+v*ACC_B, ACC_LO, ACC_HI);
}

const SIM_DT=0.2;          // 시뮬레이션 한 스텝(초)

const SIM_SECONDS=5400;    // 정규 시간 90분 — 데드볼·세리머니까지 포함한 실제 경기 시간
// 경기 시계는 시뮬레이션 시간(this.t)보다 빠르게 흐른다. 선수·공의 움직임 속도는 그대로 두고
// 시계만 2배로 돌려, 90분이 절반의 플레이로 채워지게 한다 — 게임이니까 축약하는 쪽이 낫다.

const MATCH_CLOCK_SCALE=2;

const TEMPO=1.60;          // 90분으로 늘린 만큼 판단 간격을 늘려, 경기당 이벤트 총량을 실제 수준으로 유지한다

const PASS_SPEED=0.42;     // 패스 기본 속도(정규화 단위/초)

const CTRL_RADIUS=0.030;   // 이 반경 안에 들어오면 볼을 잡는다

const TACKLE_RANGE=0.028;  // 서서 하는 태클 사거리

const SLIDE_RANGE=0.050;   // 슬라이딩 태클 사거리 (더 멀리 닿지만 실패하면 벗겨진다)

const SLIDE_COMMIT=1.3;    // 슬라이딩 후 다시 일어나기까지 걸리는 시간(초)

const STAM_PER_MIN=0.28;

const STAM_REF_RUN=1.30;   // "평균적인 1분 이동량" 기준값

const SP_ARRIVE=0.006;     // 세트피스 배치 자리 도착 판정 반경(약 0.4m) — 이 안에 들면 발을 멈춘다

const AERIAL_RANGE=0.055;  // 공중볼 경합 반경

const BOX_X=0.83, BOX_Y0=0.21, BOX_Y1=0.79;

/* ── 슈팅 ─────────────────────────────────────────────────────────────────
   슛은 "때렸다/안 때렸다"가 아니라 다섯 단계를 순서대로 통과한다.
     블록 → 굴절 → 유효슈팅 판정 → 골키퍼(선방/캐치/쳐냄) → 골
   각 단계는 앞 단계에서 살아남은 슛만 받는다. 그래서 몸을 던진 수비수 앞에서는
   애초에 유효슈팅이 나올 수 없고, 굴절된 슛은 키퍼가 손을 못 쓰게 된다.        */
/* 슛의 종류 — 상황이 종류를 정하고, 종류가 공의 물리(속도·높이·회전)를 정한다.
     HEADER  머리로 아래로 찍는다        VOLLEY  뜬 공을 땅에 닿기 전 다이렉트로
     FINESSE 측면에서 구석으로 감아찬다   CHIP    전진한 키퍼 키를 넘긴다
     POWER   박스 밖에서 낮고 빠르게      PLACED  박스 안에서 코스를 노린다        */

const SHOT_TYPE={HEADER:"HEADER", VOLLEY:"VOLLEY", FINESSE:"FINESSE",
                 CHIP:"CHIP", POWER:"POWER", PLACED:"PLACED"};

const CURVE_MAX=0.055;           // 감아차기의 최대 휨(경로 중간에서 옆으로 벌어지는 거리)

/* 상황을 보고 어떤 슛을 때릴지 정한다.
   opt.clear 는 "앞을 막은 수비수가 없다"(키퍼와 사실상 1대1)는 뜻이다. */

function chooseShotType(shooter, g, ball, gk, opt){
  const o = opt||{};
  const fin = shooter.finSkill||0.6;
  const z = ball ? (ball.z||0) : 0;
  const inFlight = ball && (ball.state==="PASS" || ball.state==="LOOSE");
  if(inFlight && z>=HEAD_Z0 && z<=HEAD_Z1) return SHOT_TYPE.HEADER;   // 머리 높이로 온 공
  if(inFlight && z>=VOLLEY_Z)             return SHOT_TYPE.VOLLEY;   // 아직 떠 있는 공
  // 키퍼와 단둘이 남았다 — 넘겨 차거나(로빙), 구석으로 감아 찬다.
  // 이런 상황에서 매번 똑같이 정직하게 때리면 마무리가 단조로워진다.
  const TT=shooter.tr||{};
  if(o.clear && g.distM<20){
    const r=RNG();
    // 특성: 로빙 슛 선호 / 키퍼 제치기 / 휘어차기
    if(r < 0.22+fin*0.16+(TT.lob?0.34:0))            return SHOT_TYPE.CHIP;      // 키퍼 키를 넘긴다
    if(TT.round && r < 0.60)                          return SHOT_TYPE.PLACED;    // 제치고 밀어 넣는다
    // 감아차기는 특성뿐 아니라 역할(인사이드 포워드·인버티드 윙어)도 부여한다.
    // TT.curl 만 읽던 시절에는 역할이 준 curl 값이 통째로 버려졌다 — FX로 둘을 합쳐 읽는다.
    if(r < 0.48+fin*0.18+Math.min(0.34, FX(shooter,"curl")*0.26) && fin>0.45) return SHOT_TYPE.FINESSE;  // 반대편 구석으로 감아 찬다
  }
  // 키퍼가 골라인에서 많이 나와 있으면 넘겨 찬다
  if(gk){
    const off = Math.abs(gk.x-g.gx)*PITCH_AR;
    if(off>GK_OFFLINE && g.distM>9 && g.distM<26 && RNG()<0.30+fin*0.35)
      return SHOT_TYPE.CHIP;
  }
  // 측면에서의 감아차기 — 박스 밖에서도 각을 세워 감아 올린다
  const wide=Math.abs(shooter.y-0.5)>0.10;
  if(wide && g.distM<30 && RNG()<0.24+fin*0.45) return SHOT_TYPE.FINESSE;
  // 박스 밖 정면 — 감아 차거나, 힘으로 때린다
  if(g.distM>17 && RNG()<0.16+fin*0.30) return SHOT_TYPE.FINESSE;
  if(g.distM>19) return SHOT_TYPE.POWER;
  return SHOT_TYPE.PLACED;
}

const GOAL_HALF=0.054;      // 골문 반폭 (7.32m / 68m)

const SHOT_MAX_M=31;        // 이 거리 밖에서는 슛을 시도하지 않는다
/* ── 중거리 슛 성향 (전술 지시: 0 적게 / 1 보통 / 2 많이) ──────
   박스 밖에서 때릴지 한 번 더 만들지를 가르는 값이다. 이게 없으면 거리 감점에 눌려
   박스 밖 슛이 전체의 10%밖에 안 나온다(실제 축구는 35~45%). */

const LS_PREF=[-0.62, 0.34, 1.05];    // 성향별 기본 가산점 (0=자제 · 1=보통 · 2=적극)

const LS_SKILL=[0.25, 0.70, 1.15];    // 중거리 능력치가 얹어 주는 몫
/* ⚠ 전술이 3단계에서 5단계 슬라이더로 바뀌면서 이 값이 0.5·1.5 같은 소수로 들어온다.
   배열을 그대로 인덱싱하면 undefined → 점수가 NaN → 비교가 전부 false 가 되어
   그 선수는 영영 슛을 때리지 않는다. 세 지점 사이를 이어서 읽는다. */

function lsLerp(arr, v){
  const x=clamp(v==null?1:v, 0, 2), i=Math.floor(x), f=x-i;
  return i>=2 ? arr[2] : arr[i]+(arr[i+1]-arr[i])*f;
}

const SHOT_GAIN=2.70;       // 슛 기대값 → 패스와 겨루는 점수로 바꾸는 배율.
                            // 이 값이 작으면 q(상황의 좋고 나쁨)가 BIAS 에 묻혀버려,
                            // 결국 "보너스 조건에 딱 맞는 상황"에서만 슛이 나오는 이분법이 된다.

const BLOCK_P=0.95;

const BLOCK_CORNER_P=0.52;   // 골문 앞에서 막힌 슛이 골라인을 넘어갈 확률

const CROSS_CORNER_P=0.52;   // 바이라인 근처에서 막힌 크로스가 골라인을 넘어갈 확률         // 최적 위치에서 몸을 던져 막을 확률의 상한

const ACC_BASE=0.07;        // 유효슈팅 기준선

const SAVE_BASE=0.475;       // 선방 기준선

const SHOT_DIV=46;          // 거리 감쇠 분모 — 작을수록 먼 거리 슛이 줄어든다

const SHOT_BIAS=-2.58;      // 낮출수록 슛이 줄어든다 (실제 K리그 팀당 11~13회에 맞춘 값)

const BLOCK_W=GOAL_HALF*0.55+0.022;   // 수비수가 몸으로 가릴 수 있는 폭

const SHOT_SPEED=0.25;      // 슛한 공의 비행 속도 (패스보다 빠르다)

const SHOT_MIN_TICKS=5;     // 아무리 가까워도 이만큼은 날아간다 — 순간이동하지 않게
/* 📺 VAR — 연속 엔진의 온필드 리뷰. 골이 들어간 뒤 낮은 확률로 판독에 들어간다. */

const VAR_CHECK_P=0.085;        // 골당 판독 확률 (K리그 실측: 경기당 0.2~0.3회 수준)

const VAR_DECIDE_SECS=6.5;      // 판독에 걸리는 시간

const VAR_CONFIRM_P=0.62;       // 판독 후 골 인정 비율

const CELEBRATE_OFF_SECS=8;   // 취소된 골 — 환호가 짧게 끊긴다

const CELEBRATE_SECS=16;    // 골 세리머니 — 득점자에게 몰려갔다가 하프라인으로 돌아온다

const ISO_TO_M=67;         // 등방 좌표 1단위가 실제 몇 m인가 (피치 105m / 1.573)
/* ── 공의 물리 ──────────────────────────────────────────────────────────────
   공은 위치만 있는 점이 아니라 속도(vx,vy)와 높이(z,vz)를 가진 물체다.
   · 잔디 위를 구를 때는 매 틱 마찰을 곱해 부드럽게 감속하고, 거의 멈추면 속도를 0으로 끊는다.
   · 떠 있을 때는 중력이 vz를 끌어내리고 공기 저항이 수평 속도를 조금씩 깎는다.
   · 땅에 닿으면 반발계수만큼 튀어오르고, 튈 때마다 수평 속도도 잃는다.
   속도 단위는 "iso/초"(1 iso ≈ 67m), 높이 z 도 같은 iso 단위다.                    */

const GRAVITY = 9.81/ISO_TO_M;      // 중력 가속도 (iso/s²)

const GRASS_FRICTION = 0.82;        // 잔디 마찰 (틱당 · 60fps 프레임 환산 약 0.984)

const AIR_DRAG = 0.994;             // 떠 있을 때의 공기 저항 (틱당)

const BOUNCE = 0.50;                // 반발계수 — 튀어오를 때 남는 수직 속도

const BOUNCE_GRIP = 0.74;           // 바운스 순간 잔디에 먹히는 수평 속도

const BALL_STOPV = 0.0016;          // 이 아래 속도는 0으로 끊는다 (소수점 연산 낭비 방지)

const BALL_MINBOUNCE = 0.03;        // 이보다 약한 낙하는 튀지 않고 그대로 구른다
/* 공중으로 걷어낸 공은 착지 뒤에도 튀며 굴러간다.
   launchLoose 에 넘기는 거리는 "최종적으로 멈추는 곳"이므로, 첫 비행은 그 일부만 담당한다. */

const AERIAL_ROLLOUT = 2.9;
/* 부심이 깃발을 늦게 드는 비율 — 이 경우 플레이가 흘러가고, 골이 들어가면 그때 취소된다 */

const OFFSIDE_LATE_P = 0.30;

const OFFSIDE_LATE_WIN = 12;   // 깃발이 유효한 시간(초) — 이 안에 골이 나면 취소

const CTRL_Z = 1.0/ISO_TO_M;        // 이보다 높이 뜬 공은 발로 잡을 수 없다

const GOAL_POST = 0.0022;           // 골포스트 반경 + 공 반경 (약 0.15m)

const CROSSBAR_Z = 2.44/ISO_TO_M;   // 크로스바 높이

const VOLLEY_Z = 0.35/ISO_TO_M;     // 이 높이 이상으로 떠 있는 공은 발리로 때린다

const HEAD_Z0 = 1.5/ISO_TO_M, HEAD_Z1 = 2.6/ISO_TO_M;   // 머리 높이

const GK_OFFLINE = 4.0/ISO_TO_M;    // 키퍼가 이만큼 나와 있으면 로빙슛이 보인다

const GK_SWEEP_X=0.30;      // 공이 우리 골문에서 이 안쪽(약 20m)에 떨어질 때만 스위핑을 고려

const GK_SWEEP_EDGE=0.045;  // 상대보다 이만큼 멀어도 감행한다 (돌진 빈도로 배수)

const GK_CLAIM_P=0.085;      // 박스로 떨어지는 크로스에 나가는 기본 확률

const GK_SUPPORT_X=0.20;    // 빌드업 시 올라오는 기본 위치 (골라인에서 약 13m)

const GK_SWEEP_MIN=0.48;    // 이 값을 넘는 스위퍼 성향부터 박스 밖으로 나간다

const GK_SWEEP_PUSH=0.30;   // 최상급 스위퍼가 추가로 전진하는 거리 (약 27m)

const GK_TURN_DIST=0.10;    // 목표가 이보다 멀면 몸을 돌려 달린다(스위핑), 가까우면 볼을 보며 스텝

const POST_BOUNCE = 0.62;           // 골대를 맞고 튕겨 나가는 정도

const NET_DRAG = 0.28;              // 그물에 걸린 공 — 급격히 감속하며 흔들린다

function stepBallPhysics(b){
  b.x += b.vx*SIM_DT/PITCH_AR;
  b.y += b.vy*SIM_DT;
  if(b.z>0 || b.vz>0){                       // 공중
    const z0=b.z, vz0=b.vz;                  // 이번 틱 시작 시점
    b.z += b.vz*SIM_DT;
    b.vz -= GRAVITY*SIM_DT;
    b.vx *= AIR_DRAG; b.vy *= AIR_DRAG;
    if(b.z<=0){                              // 이번 틱 도중에 땅에 닿았다
      // 틱이 굵어서 틱 끝의 속도를 그대로 뒤집으면 중력분이 얹혀 오히려 더 세게 튄다.
      // 땅에 "언제" 닿았는지를 풀어서, 그 순간의 하강 속도로 반사해야 바운스가 제대로 잦아든다.
      const tHit = vz0<0 ? clamp(-z0/vz0, 0, SIM_DT) : 0;
      const vHit = vz0 - GRAVITY*tHit;       // 닿는 순간의 하강 속도(음수)
      const rest = SIM_DT - tHit;            // 닿은 뒤 남은 시간
      if(Math.abs(vHit) > BALL_MINBOUNCE){
        const up = Math.abs(vHit)*BOUNCE;    // 튀어오르는 속도
        b.vz = up - GRAVITY*rest;
        b.z  = Math.max(0, up*rest - 0.5*GRAVITY*rest*rest);
        b.vx *= BOUNCE_GRIP; b.vy *= BOUNCE_GRIP;
        b.bounced=(b.bounced||0)+1;
      } else { b.z=0; b.vz=0; }
    }
  } else {                                   // 잔디 위를 구른다
    b.z=0; b.vz=0;
    const f = b.inNet ? NET_DRAG : GRASS_FRICTION;
    b.vx *= f; b.vy *= f;
  }
  if(Math.hypot(b.vx, b.vy) < BALL_STOPV && b.z<=0){ b.vx=0; b.vy=0; }
}
/* 마찰로 감속하는 이동 곡선. 진행률 p(0~1)를 "이미 간 거리 비율"로 바꾼다.
   처음에 훅 나갔다가 점점 느려지는 실제 공의 모양이다. (등속 lerp 는 공이 밀려가는 느낌이 안 난다) */

const FRIC_EASE=0.45;

function frictionEase(p){ return (1-Math.pow(FRIC_EASE,p))/(1-FRIC_EASE); }
/* 체공 시간 T 동안 중력만 받는 공의 최고 높이 */

function loftPeak(T){ return GRAVITY*T*T/8; }
/* 공을 출발시킨다.
     loft>0 이면 그 시간(초)만큼 체공하는 포물선 — vz 는 왕복 시간에서 역산한다.
     loft=0 이면 지면을 구르는 공 — speed 를 그대로 초기 속도로 쓴다. */

const LOOSE_STOP=0.0016;      // 이 속도 아래면 멈춘 것으로 본다

const LOOSE_PICKUP=0.024;     // 굴러가는 공을 이 거리 안에서 잡는다

const LOOSE_MAXT=6.0;         // 아무도 못 잡으면 이 시간 뒤 가장 가까운 선수에게

const LOOSE_GRACE=1.0;        // 튄 직후 — 공이 빠르고 몸이 흐트러져 아무도 잡지 못한다

const LOOSE_CATCH_V=0.011;    // 이보다 빠른 공은 발에 걸리지 않고 지나간다
/* 골키퍼의 선방 종류 */

const SAVE_TYPE={CATCH:"CATCH", PARRY:"PARRY", PUNCH:"PUNCH", TIP:"TIP"};

const DIVE_HOLD=1.1;          // 몸을 날린 뒤 일어나기까지
/* 순간 전력질주 — 평소 달리기보다 잠깐 더 빠르게 치고 나간다.
   공간으로 찔러준 패스를 쫓아갈 때, 침투할 때, 뒤에서 따라붙을 때 쓴다.
   한 번 쓰면 잠시 쓸 수 없다(체력). 빠른 선수일수록 오래·자주 쓴다. */

const BURST_MUL=1.36;        // 전력질주 배수

const BURST_DUR=2.2;         // 지속 시간(초, 능력치로 가감)

const BURST_COOL=6.5;        // 다시 쓸 수 있을 때까지

const CHASE_MAXT=4.0;

const SWEEP_EDGE=0.35;       // 스위퍼가 뒷공간 경합에서 먼저 반응하는 정도

const REACT_MIN=0.20;        // 수비 반응 지연 최소(초) — 판단력이 좋은 선수

const REACT_MAX=0.50;        // 수비 반응 지연 최대(초) — 판단력이 나쁜 선수        // 공간 패스를 쫓아가는 최대 시간
/* 몸싸움 — 선수는 점이 아니라 몸을 가진 물체다. 겹치면 서로 밀어내고,
   힘이 센 쪽이 덜 밀린다. 볼을 지키는 선수는 몸으로 버티므로 더 안 밀린다. */

const BOOKED_CAUTION=0.18;   // 경고 1장 받은 뒤의 파울 성향 배수
/* ═══════════════════════════════════════════════════════════════
   🎛️ 매치엔진 튠 — 에디터에서 조정하는 전역 배수
   1.0 = 기본. 세이브에 저장되고 에디터 데이터 파일에도 실린다.
═══════════════════════════════════════════════════════════════ */

function meTune(k){
  if(!G || !G.meTune) return 1;
  const v=G.meTune[k];
  return (typeof v==="number" && isFinite(v)) ? clamp(v, 0.25, 4) : 1;
}

const AERIAL_FOUL_P=0.42;    // 공중볼 경합에서 파울이 날 확률

const SHIRT_FOUL_P=0.0110;   // 제쳐진 수비수가 잡아챌 틱당 확률

const TAKEON_RANGE=0.042;    // 이 거리(약 2.8m) 안에서 앞을 막고 있으면 돌파 대상

const TAKEON_TRY=0.040;       // 드리블 중 틱당 돌파 시도 확률

const TAKEON_COOL=1.1;       // 같은 선수의 연속 돌파 쿨다운(초)

const TAKEON_POW=3.2;        // 능력치 차이를 증폭하는 지수 — 클수록 슈퍼스타가 더 압도적

const TAKEON_STAGGER=1.5;

const TAKEON_FAIL_LOSS=0.72;  // 돌파 실패 시 볼을 잃을 확률

const TAKEON_GREED=0.80;      // 실력 우위를 돌파 시도로 바꾸는 계수  // 돌파 실패 시 볼을 잃을 확률    // 제쳐진 수비수가 역동작에 걸려 있는 시간(초)

const ROLE_FWD_X=0.135;     // 전진 성향 1.0 이 앵커를 앞으로 밀어내는 거리 (약 9m)

const ROLE_WIDE_Y=0.115;    // 측면 치우침 1.0 이 앵커를 좌우로 옮기는 거리
/* ── 안으로 파고드는 드리블 (cut inside) ──────────────────────────────
   여태 볼 잡은 선수는 역할과 상관없이 전부 자기 앞으로만 몰고 갔다(ty=a.y 고정).
   그래서 인사이드 포워드를 세워도 드리블은 터치라인과 나란히 흘렀고,
   "오른쪽에서 안으로 접어 왼발 각을 만드는" 장면이 아예 나오지 않았다.
   cutIn 성향이 있는 선수는 전진 벡터에 안쪽 성분을 섞는다. 다만
   ① 어느 정도 전진했을 때만 ② 아직 측면에 있을 때만 ③ 안쪽 레인이 비어 있을 때만 접는다.
   중앙에 다 들어오면 offset 이 0에 수렴하므로 저절로 직진으로 돌아온다. */

const CUTIN_FROM=0.44;      // 이만큼 전진해야 접기 시작한다 (하프라인 조금 못 미쳐)

const CUTIN_FULL=0.86;      // 여기서 최대치 — 박스 모서리 부근

const CUTIN_MIN_OFF=0.085;  // 중앙에서 이 정도(약 5.8m)는 벗어나 있어야 접을 의미가 있다

const CUTIN_ANGLE=0.80;     // 전진 대비 안쪽 성분의 비 (약 39도까지)

const CUTIN_LOOK=0.11;      // 안쪽 레인을 살피는 전방 거리 (약 11m)

const CUTIN_LANE=0.13;      // 이 폭 안에 상대가 있으면 레인이 막힌 것으로 본다

const ROLE_PM_BONUS=0.42;

const ROLE_SPOT_W=9.0;      // 역할 전진 성향이 빈 공간 선택에 주는 가중치   // 플레이메이커에게 붙는 패스 우선순위 가점

const BODY_R=0.0128;         // 몸 반경 (지름 약 1.7m — 어깨 폭 + 여유)
// ── 팀 모양(shape) 튜닝 ──────────────────────────────────────────
// DISCIPLINE_SOFT : 앵커에서 이 거리(약 7m)를 넘으면 자기 자리로 되당기기 시작
// DISCIPLINE_MAX  : 되당기는 최대 비율
// DEF_DISC        : 수비 시 규율 완화 배수 (낮을수록 볼 쪽으로 모여 블록이 촘촘해진다)
// COMPACT_MAX     : 볼이 우리 박스 앞까지 왔을 때의 좌우 압축 상한

const DISCIPLINE_SOFT=0.105;  // 앵커에서 이 거리(약 7m)를 넘으면 자기 자리로 되당기기 시작

const DISCIPLINE_MAX=0.78;    // 되당기는 최대 비율

const DEF_DISC=0.80;          // 수비 시 규율 완화 배수 (낮을수록 블록이 촘촘해진다)

const COMPACT_MAX=0.76;       // 볼이 우리 박스 앞까지 왔을 때의 좌우 압축 상한

const ITC_MUL=0.62;           // 패스 길목 차단 반경 배수

const SHOT_BIAS_ADJ=0.16;   // 시계가 2배로 흐르는 만큼 슛 빈도를 올려 90분 기록을 채운다    // 슛 남발 억제 (1대1 하한선은 그대로 유지된다)

const CROSS_ADJ=0.05;         // 크로스 남발 억제   // 포지션 규율 (테스트에서 조정 가능)

const SPACING_R=0.055;       // 같은 팀끼리 유지하려는 간격 (약 3.7m) — 서로 겹쳐 뛰지 않게

const SPACING_PUSH=0.006;    // 그 간격을 지키려 목표를 옆으로 미는 힘

const PUSH_MAX=0.011;        // 한 틱에 밀려나는 최대 거리 (약 0.75m)

const SHIELD_BONUS=1.45;     // 볼을 지키는 선수가 버티는 힘

const JOSTLE_ITER=2;         // 분리 반복 횟수 — 세 명 이상 뭉쳤을 때를 풀어준다
/* 수비 AI — 능력치가 움직임의 질을 가른다.
     Positioning 낮으면 대기 상태에서 자리를 잘못 잡고,
     Decisions  낮으면 상태를 바꿀 때 멈칫하며(역동작),
     Pace       는 최고 속도와 가속에 그대로 비례한다.                       */

const ACCEL_BASE=0.18;       /* 최고 속도까지 붙는 가속 (iso/s²) — 가속도(acc)로 가감.
   예전 값(0.62)은 최고 속도까지 0.12초, 즉 한 틱(0.2초)도 안 걸렸다. 그래서 가속도 능력치가
   움직임에 아무런 영향을 주지 못했다 — 모든 선수가 출발과 동시에 최고 속도였다.
   0.18이면 평균 선수가 최고 속도에 붙기까지 약 0.4초가 걸린다. 짧은 거리 경합에서
   "먼저 튀어나가는 선수"가 실제로 먼저 닿는다. */

const DECEL_MUL=1.8;         // 감속은 가속보다 빠르다
/* 골키퍼의 공중볼 처리 범위 — 자기 골문에서 이만큼 안쪽으로 떨어지는 뜬 공에만 나온다.
   0.20 은 약 21m 로 페널티 박스(16.5m)보다 조금 넓다. */

const GK_CATCH_X=0.20;

const GK_CATCH_R=0.085;      // 손이 닿는 기본 반경 (약 5.8m) — 공중 장악력으로 ±30%

const GK_CATCH_P=0.62;       // 나올지 말지의 기본 적극성

const POS_ERR_MAX=0.055;     // 위치 선정이 최악일 때 벌어지는 오차 (약 3.7m)

const POS_ERR_DRIFT=0.9;     // 오차가 새로 바뀌는 주기(초)

const HESITATE_MAX=1.0;      // 판단력이 최악일 때 멈칫하는 시간(초)

const LINE_SYNC=0.55;        // 센터백끼리 깊이를 맞추는 정도 (1이면 완전히 일자)
/* 센터백 존 마킹 — 라인을 지키면서 자기 구역에 들어온 공격수를 잡는다 */
/* 부상 — 틱마다 뽑는 기본 확률. 자연 발생 0.2 + 태클 0.25 ≈ 경기당 0.45명(양 팀 합계).
   실제로도 경기당 강제 교체는 한 경기 걸러 한 번꼴이다. 더 올리면 스쿼드가 남아나지 않는다. */

const INJ_TICK_P=0.000022;

const INJ_TACKLE_P=0.010;   // 거친 태클을 당했을 때 다칠 확률

const INJ_DOWN_SECS=6.0;    // 쓰러져 있다가 실려 나가기까지

const CB_ZONE_X=34;          // 우리 골문에서 이 거리(m) 안으로 들어온 상대만 담당한다

const CB_ZONE_Y=0.19;        // 좌우로 이만큼(약 15m) 안쪽이면 내 구역

const CB_MARK_Y=0.52;        // 담당 공격수 쪽으로 붙는 정도 (1이면 완전히 따라간다) — 0.34는 스트라이커가 반쯤 열려 있었다

const CB_MARK_X=0.32;        // 골사이드로 파고드는 정도 — 등 뒤로 슝 지나가는 장면을 줄인다

const CB_MARK_GOALSIDE=0.026;// 담당보다 이만큼(약 2.7m) 골문 쪽에 선다

const CB_MARK_LEASH=1.35;     // 담당을 잡으러 갈 때 규율 반경을 이만큼 늘린다

const CB_ZONE_NEAR=13;       // 담당까지 이 거리(m) 안이어야 실제로 잡으러 간다 — 11m는 한 발 늦었다

const TARGET_SMOOTH=0.16;    // 목표 위치를 따라가는 속도 — 낮을수록 부드럽고 덜 떤다

const TARGET_JUMP=0.30;      // 목표가 이만큼(약 20m) 넘게 튀면 스무딩을 포기하고 즉시 따라간다

const TARGET_DEAD=0.011;     // 이보다 가까우면 미세 조정을 하지 않는다 (약 0.7m)
/* ── 도착 감속 ──────────────────────────────────────────────
   예전에는 목표에 닿는 순간 a.spd 를 0 으로 내리쳤다. 0.2초 틱이라 조깅 중이던 선수가
   한 틱 만에 3m/s → 0 이 되고, 다음 틱에 앵커가 조금 움직이면 다시 0 에서 가속한다.
   그래서 "가다 서다 가다 서다"가 선수당 분당 30번 가까이 나왔다.
   이제는 남은 거리에 비례해 목표 속도를 낮추고(=감속해서 도착), 멈출 때도 서서히 죽인다. */

const ARRIVE_R=0.045;        // 이 거리(약 3m)부터 속도를 줄이기 시작한다

const ARRIVE_MIN=0.18;       // 다 와서도 이만큼은 남겨 둔다 (완전히 얼어붙지 않게)
/* 자리를 잡은 뒤에는 목표가 조금 흔들려도 따라가지 않는다.
   앵커는 공을 따라 매 틱 조금씩 움직이므로, 이게 없으면 제자리에서 몸만 빙글빙글 돈다. */

const TARGET_HOLD=0.026;     // 자리 잡은 뒤 이 거리(약 1.7m) 안에서는 버틴다

const TURN_RATE=6.0;         // 몸이 돌아가는 속도(rad/s) — 순간적으로 방향을 꺾을 수는 없다

const DRIB_TOUCH=0.8;        // 드리블 터치 간격(초) — 이때마다 공을 앞으로 툭 차 놓는다

const DRIB_LEAD=0.026;       // 툭 찬 공이 앞서 나가는 거리 (약 1.7m)

const BALL_ROLL_FRICTION=0.88;

const CROSS_BLOCK_R=0.055;  // 이 거리 안의 수비수는 크로스를 발로 막을 수 있다

const CROSS_BLOCK_P=0.72;   // 코앞에 붙었을 때의 차단 확률

/* 슈터에서 본 골문 — 거리와 "골문이 열려 보이는 각도"를 함께 구한다.
   각도는 정면 가까이일수록 넓고, 골라인 옆으로 밀려날수록 0에 수렴한다. */

function shotGeom(a){
  const gx = a.dir>0 ? 1 : 0;
  const dx = (gx-a.x)*PITCH_AR, dy = 0.5-a.y;
  const dist = Math.hypot(dx, dy);
  // 각도는 "골문까지의 거리"로만 결정된다. dx 의 부호(공격 방향)를 그대로 넣으면
  // 왼쪽으로 공격하는 팀에서 atan2 가 ±π 를 넘나들며 각이 5.7rad 같은 값으로 망가진다.
  const fwd = Math.max(1e-6, Math.abs(dx));
  const a1 = Math.atan2((0.5-GOAL_HALF)-a.y, fwd);
  const a2 = Math.atan2((0.5+GOAL_HALF)-a.y, fwd);
  return {dist, distM:dist*ISO_TO_M, gx, angle:Math.abs(a2-a1)};
}

/* 슛 경로를 막고 선 상대 — 슈터와 골문을 잇는 통로 안에 있는 선수만 센다.
   경로상의 진행률(t)로 그 지점의 통로 중심을 구하고, 거기서 얼마나 벗어났는지를 본다. */

function shotLaneBlockers(a, opps, g){
  const list=[]; let near=0, far=0;
  const span=(g.gx-a.x)*a.dir;
  if(span<=1e-6) return {near, far, list};
  for(const o of opps){
    if(o.slot==="GK") continue;
    const along=(o.x-a.x)*a.dir;
    if(along<=-0.012 || along>=span) continue;         // 슈터 뒤 또는 골라인 너머 (바로 앞에 붙은 수비수는 포함)
    const t=along/span;
    const ly=a.y+(0.5-a.y)*t;
    const off=Math.abs(o.y-ly);
    if(off>BLOCK_W) continue;
    const d=Math.hypot((o.x-a.x)*PITCH_AR, o.y-a.y);
    list.push({o, d, off});
    if(d<0.09) near++; else far++;
  }
  list.sort((x,y)=>x.d-y.d);
  return {near, far, list};
}

/* 슛을 때릴 만한 상황인지 — 패스·크로스와 같은 점수 척도로 돌려준다.
   각이 열려 있고, 가깝고, 앞을 막은 사람이 없고, 마무리가 좋을수록 점수가 높다. */

function evaluateShot(a, opps, ctx){
  if(a.slot==="GK") return null;
  const g=shotGeom(a);
  if(g.distM>SHOT_MAX_M || (g.gx-a.x)*a.dir<=0.01) return null;
  const blk=shotLaneBlockers(a, opps, g);
  // 몸에 붙은 상대까지의 실제 거리. pressureOn 은 6.7m 밖까지 압박으로 세기 때문에
  // "눈에는 여유로운데 코드는 압박 심함"으로 판단하는 어긋남이 생긴다.
  let nearOpp=9;
  for(const o of opps){
    if(o.slot==="GK") continue;
    const d=Math.hypot((o.x-a.x)*PITCH_AR, o.y-a.y);
    if(d<nearOpp) nearOpp=d;
  }
  const skill = g.distM>20 ? (a.lngSkill||0.6) : (a.finSkill||0.6);
  // 천재성이 높으면 먼 거리에서도 과감하게 때린다 (FM: Flair → 중거리·과감한 시도 성향)
  const flairBonus = g.distM>20 ? ((a.flair||0.6)-0.6)*0.55 : 0;
  let q = clamp(g.angle/0.55, 0, 1.4) * (0.50+skill*0.80);
  q *= 1 - clamp(g.distM/SHOT_DIV, 0, 0.85);
  // 통로 수비수 — "몇 명이냐"가 아니라 "얼마나 가깝냐"로 깎는다.
  // 명수로 세면 5m 앞의 한 명 때문에 아예 안 쏘는 이분법이 된다.
  const nb = blk.list.length ? blk.list[0].d : 9;      // 가장 가까운 통로 수비수까지
  q -= clamp(1 - nb/0.105, 0, 1)*0.42;                 // 코앞이면 크게, 7m 밖이면 0
  q -= Math.max(0, blk.list.length-1)*0.10;            // 겹겹이 서 있으면 추가 감점
  q -= clamp(ctx.selfPress||0, 0, 2)*0.11;
  const TR=a.tr||{};
  // 특성: 중거리 슛 선호/자제, 득점보다 패스 선호
  const trShot = FX(a,"shoot")*1.0 + (g.distM>20 ? FX(a,"longShot")*0.75 : 0);
  let score = q*SHOT_GAIN + SHOT_BIAS + SHOT_BIAS_ADJ + flairBonus + trShot + ((ctx.mentality||1)-1)*0.30;   // [KMD26 MENT-01] 0.06 → 0.30. 자리만 밀지 말고 '때린다'는 판단도 바뀌어야 한다
  score += Math.log(meTune("shot"))*0.55;   // 🎛️ 에디터 튠 — 1.0이면 0
  // ── 중거리 슛 — 감독의 지시가 "때릴까 한 번 더 만들까"를 가른다.
  //    거리 감점(q에 이미 반영)에 눌려 박스 밖 슛이 거의 안 나오던 것을 여기서 되살린다.
  if(g.distM>16.5){
    const ls=clamp(ctx.longShot===undefined?1:ctx.longShot, 0, 2);
    const far=clamp((g.distM-16.5)/12, 0, 1.4);          // 16.5m→0 · 28.5m→1
    score += lsLerp(LS_PREF,ls)*(1-far*0.30) + ((a.lngSkill||0.6)-0.6)*lsLerp(LS_SKILL,ls);
    // "자제" 쪽으로 밀수록 통로가 열려 있어도 굳이 때리지 않는다
    if(ls<0.5) score -= 0.25*(1-ls*2);
  }
  // 앞이 완전히 비었고 골문이 가까우면 키퍼와의 1대1이다. 이때 옆으로 빼주는 축구 선수는 없다.
  // 다른 계수를 어떻게 조정하든 이 상황만은 흔들리지 않도록, 더하는 보너스가 아니라 점수의 하한선으로 둔다.
  // "경로가 비었다"만으로는 부족하다 — 몸에 붙은 수비수까지 없어야 진짜 키퍼와의 1대1이다.
  // 앞이 비었고 몸에 붙은 상대도 없다 — 눈으로 보면 명백한 찬스다. 반드시 때린다.
  // 몸을 던져 막을 만큼 붙은 수비수가 없다(blk.near===0)면, 통로 멀리 서 있는 수비수는
  // 사람 눈에도 "막혔다"고 보이지 않는다. 이걸 통로 완전 비움으로만 좁게 보면 찬스를 흘린다.
  // 통로에 사람이 "있냐 없냐"가 아니라 "발을 뻗어 막을 만큼 붙었냐"로 본다.
  // 4m 앞의 수비수 하나 때문에 아예 안 쏘는 건 축구가 아니다.
  if(nb>0.055 && g.distM<24 && nearOpp>0.042)
                                             score = Math.max(score, 0.70 + clamp((24-g.distM)/24,0,1)*0.80);
  // 슛 통로가 통째로 비어 있다는 건 그 자체로 큰 기회다.
  // 이걸 작게 보면 "앞이 비었는데도 옆으로 빼주는" 장면이 계속 나온다.
  else if(blk.list.length===0)               score += 0.45;
  else if(blk.near===0)                      score += 0.30;   // 몸으로 막을 만큼 붙은 수비수가 없다
  return {g, q, score, clear:blk.list.length===0, near:blk.near, nearOpp};
}
   // 페널티 박스 (공격 방향 기준)
/* 세트피스 세리머니 — 공을 가져다 놓고, 뒤로 물러났다가, 달려와서 찬다.
   각 단계의 지속 시간(초). 골킥이 가장 길고 스로인이 가장 짧다. */

const SETPIECE_PHASES={
  //  dead: 공이 죽어 있는 시간(회수·주심 신호) · place: 공을 놓는다 · backoff: 물러난다 · approach: 달려와 찬다
  goalKick: {dead:3.4, place:1.3, backoff:1.5, approach:0.7},
  freeKick: {dead:3.2, place:1.0, backoff:1.2, approach:0.6},   // 상대가 9.15m 물러날 시간
  corner:   {dead:5.5, place:1.2, backoff:1.3, approach:0.6},   // 양 팀이 박스로 올라올 시간이 필요하다
  throwIn:  {dead:1.2, place:0.9, backoff:0.6, approach:0.2},
  // 페널티킥 — 판정 시비, 키커 지정, 박스 비우기까지 시간이 오래 걸린다.
  // 물러나는 거리도 길고(런업), 그만큼 천천히 달려와 찬다.
  penalty:  {dead:5.0, place:2.2, backoff:2.0, approach:1.1}
};
/* ── 페널티킥 ──────────────────────────────────────────────────
   피치는 105m × 67m를 [0,1]²로 정규화한 것이다(x 1칸 = 105.4m, y 1칸 = 67m).
   그래서 실제 규격을 그대로 좌표로 옮길 수 있다. */

const PEN_MARK_M=11.0;                       // 골라인에서 페널티 마크까지

const PITCH_LEN_M=ISO_TO_M*PITCH_AR;         // ≈105.4m

const PEN_SPOT_ADV=1-PEN_MARK_M/PITCH_LEN_M; // 공격 진행도 기준 페널티 마크 x ≈ 0.896

const SP_KEEPOUT_M=9.15;                     // 규칙상 이격 거리
/* 키커·골키퍼를 제외한 20명이 물러나 서는 자리(공격 방향 기준).
   전부 박스 밖(adv<0.83)이면서 페널티 마크에서 9.15m 넘게 떨어진 지점이다.
   실제 경기처럼 양 팀이 아크 주변에 섞여 선다. */

const PEN_WAIT=[
  [0.800,0.30],[0.800,0.70],[0.788,0.38],[0.788,0.62],[0.775,0.46],
  [0.775,0.54],[0.805,0.22],[0.805,0.78],[0.758,0.34],[0.758,0.66],
  [0.745,0.50],[0.732,0.42],[0.732,0.58],[0.720,0.26],[0.720,0.74],
  [0.700,0.50],[0.688,0.38],[0.688,0.62],[0.665,0.46],[0.665,0.54]
];
/* 실제 페널티 성공률은 75% 안팎이다. 키커의 페널티 능력치가 성공률을 크게 가르고
   (약체 64% ↔ 특급 86%), 키퍼 실력도 몇 %를 움직인다. */
/* 박스 안 파울 억제 — 실제 경기의 페널티는 4경기에 한 번꼴(경기당 0.25회)이다.
   수비수가 자기 박스 안에서 발을 뻗지 않기 때문이다. 이 값이 그 조심성이다. */

const PEN_BOX_CAUTION=0.085;

const PEN_ACC_BASE=0.78, PEN_ACC_SKILL=0.20;   // 유효슈팅 확률 0.78~0.98

const PEN_SAVE_BASE=0.20, PEN_SAVE_GK=0.18, PEN_SAVE_KICKER=0.23;
/* ── 프리킥 수비벽 ──────────────────────────────────────────── */

const WALL_MAX_M=30;        // 이 거리 안쪽이면 벽을 세운다

const WALL_GAP_M=1.05;      // 벽 선수 어깨 간격 (몸이 닿을 듯 붙어 선다)

const WALL_SHIFT_M=1.15;    // 니어포스트 쪽으로 밀어 세우는 정도

const FK_DIRECT_M=32;       // 이 거리 안쪽이면 직접 슈팅을 노려볼 만하다

const SP_WALL_HOLD=0.6;     // 킥 후 벽이 버티는 시간(초) — 공이 발을 떠난 뒤에 무너진다

const CORNER_SHORT_P=0.12;  // 코너를 짧게 빼서 다시 만드는 비율 (나머지는 박스로 띄워 올린다)
/* ── FM식 하이라이트 중계 ──────────────────────────────────────
   경기는 뒤에서 빠르게 굴러간다. 결정적 장면이 나오면 그 앞 빌드업부터 되감아
   실시간으로 보여주고, 끝나면 다시 빨리 감는다. 그래서 "녹화 버퍼"가 필요하다. */

const HL_BUF_MAX=260;       // 링버퍼 길이 (0.2초 × 260 ≈ 52초 분량)

const HL_CAP_MAX=90;        // 해설 자막 링버퍼 길이

const HL_W={miss:1, save:2, red:3, pen:4, goal:5};

const THROW_MAX=0.30;   // 기본 사거리 (장거리 스로인 능력치로 늘어난다)        // 스로인 최대 사거리(등방) — 손으로 던지므로 짧다
/* 경기 상태 머신 — 지금 경기가 흐르는 중인지, 멈춰 있는지, 무엇으로 재개되는지 */

const MATCH_STATE={PLAYING:"PLAYING", FOUL_SCENE:"FOUL_SCENE", FREE_KICK:"FREE_KICK",
                   CORNER_KICK:"CORNER_KICK", GOAL_KICK:"GOAL_KICK", THROW_IN:"THROW_IN",
                   PENALTY:"PENALTY", CELEBRATION:"CELEBRATION"};

const SP_STATE={goalKick:MATCH_STATE.GOAL_KICK, corner:MATCH_STATE.CORNER_KICK,
                throwIn:MATCH_STATE.THROW_IN, freeKick:MATCH_STATE.FREE_KICK,
                penalty:MATCH_STATE.PENALTY};

const CARD={NONE:"NONE", VERBAL:"VERBAL", YELLOW:"YELLOW", RED:"RED"};

const FOUL_SCENE_T=3.4;       // 심판이 다가가 판정을 내리기까지

const SIM_REF_SPEED=0.052;    // 주심 이동 속도

const SIM_REF_TRAIL=0.085;    // 주심이 볼에서 유지하는 거리
/* 세트피스 이격 거리 — 상대는 공에서 이만큼 떨어져 있어야 한다 (경기 규칙) */

const SETPIECE_KEEPOUT={corner:9.15, freeKick:9.15, goalKick:9.15, throwIn:2.0, penalty:9.15};

const SETPIECE_BACK=0.055;   // 킥 전에 공 뒤로 물러나는 거리

const CROSS_TYPE={ EARLY:"EARLY", BYLINE:"BYLINE", CUTBACK:"CUTBACK" };
/* 공격 방향 기준으로 얼마나 전진했는가 (0=자기 골문, 1=상대 골문) */

function advOf(p, dir){ return dir>0 ? p.x : 1-p.x; }

function inBox(p, dir){ return advOf(p,dir)>BOX_X && p.y>BOX_Y0 && p.y<BOX_Y1; }
/* 크로스 기회 평가 — 현대축구는 포지션에 관계없이 측면에서 기회가 되면 올린다.
     EARLY   : 아직 멀리 있을 때 수비가 정렬되기 전에 일찍 올린다 (공중)
     BYLINE  : 터치라인 끝까지 파고들어 올린다 (공중, 더 위협적)
     CUTBACK : 골라인 근처에서 뒤로 낮게 빼주는 땅볼 — 가장 확률 높은 현대적 패턴
   올릴 곳이 없거나(박스에 동료 없음) 측면이 아니면 null. */

function evaluateCross(carrier, mates, opps, ctx){
  const dir=ctx.dir;
  const cx=advOf(carrier, dir);
  /* 크로스 성향은 점수만 올려서는 티가 안 났다 — 일단 "측면 깊숙이 + 박스에 동료" 조건이
     충족되면 크로스는 이미 패스를 크게 이겨서, 점수를 더 줘도 결과가 같았기 때문이다(측정 확인).
     그래서 성향이 강한 선수는 각이 덜 열린 자리에서도 올려 본다 — 문턱 자체를 낮춘다. */
  const cf=clamp(FX(carrier,"cross"), 0, 1.2);
  const wide=Math.abs(carrier.y-0.5) > 0.21-cf*0.055;
  if(!wide || cx < 0.56-cf*0.075) return null;
  const inBoxMates=mates.filter(m=>m!==carrier && inBox(m,dir));
  if(!inBoxMates.length) return null;
  const deep = cx>0.84;
  let type = deep ? (RNG()<0.22 ? CROSS_TYPE.CUTBACK : CROSS_TYPE.BYLINE) : CROSS_TYPE.EARLY;
  if(FX(carrier,"earlyCross")>0.3 && RNG()<0.55) type=CROSS_TYPE.EARLY;   // 특성: 얼리 크로스
  let target=null;
  if(type===CROSS_TYPE.CUTBACK){
    // 컷백은 박스 정면·뒤쪽으로 빠져 들어오는 동료에게 낮게 빼준다
    const cands=mates.filter(m=>m!==carrier && advOf(m,dir)>0.74 && advOf(m,dir)<0.90 && Math.abs(m.y-0.5)<0.22);
    if(!cands.length) type=CROSS_TYPE.BYLINE;
    else target=cands.reduce((best,m)=> pressureOn(m,opps,1)<pressureOn(best,opps,1)?m:best, cands[0]);
  }
  if(!target){
    // 공중 크로스는 헤딩이 좋고 덜 마크된 선수를 겨냥한다
    // 타깃 포워드 역할이 있으면 크로스는 그를 최우선으로 겨냥한다
    const aim=m=>(m.headSkill||0.6)*1.4 - pressureOn(m,opps,1)*0.9 + FX(m,"aerialTarget")*1.1;
    target=inBoxMates.reduce((best,m)=> aim(m)>aim(best)?m:best, inBoxMates[0]);
  }
  const dx=(target.x-carrier.x)*PITCH_AR, dy=target.y-carrier.y;
  const dist=Math.hypot(dx,dy);
  const skill=ctx.crossSkill||0.6;
  const recvPress=pressureOn(target, opps, ctx.press);
  // 점수 — 일반 패스 점수와 같은 척도에서 겨룬다
  // 크로스를 올리려면 발을 들 공간이 필요하다. 수비수가 붙어 있으면 애초에 시도하기 어렵다.
  const selfPress=pressureOn(carrier, opps, ctx.press);
  /* 크로스 성향(cross)은 여태 얼리크로스 감점을 깎는 데에만 쓰였다. 그래서 윙의 cross 0.65는
     엔드라인까지 파고들어 올리는 크로스에는 아무 영향도 주지 못했고, 임무를 바꿔도
     크로스 비율이 33.3%로 똑같이 나왔다. 종류와 무관하게 "시도할 마음" 자체를 올린다. */
  let score = -1.00 + inBoxMates.length*0.10 + skill*0.55 - recvPress*0.55
            - Math.max(0,dist-0.30)*1.4 - selfPress*0.62 + FX(carrier,"cross")*0.34;
  if(type===CROSS_TYPE.CUTBACK) score += 0.18;      // 컷백이 확률은 높지만 각이 나올 때만 가능하다
  if(type===CROSS_TYPE.EARLY)   score -= 0.55 - (FX(carrier,"earlyCross")>0.3?0.14:0);   // 얼리크로스는 성공률이 낮다
  return {type, to:target, dist, score, aerial:type!==CROSS_TYPE.CUTBACK, boxMates:inBoxMates.length};
}
/* 패스를 "어떻게" 줄지 정한다 — 얼마나 세게, 발밑인지 공간인지.
     · 받는 선수가 압박받으면 강하게 찔러 넣는다 (약하게 주면 뺏긴다)
     · 침투 중인 동료에게는 발밑이 아니라 앞 공간으로 (뛰어 들어가며 받도록)
     · 멀수록 세게 차야 도달한다
   패스 능력치가 좋을수록 세기 조절이 정교하고 공간 패스를 더 자주 시도한다. */
/* ── 패스 시스템 ────────────────────────────────────────────────────────────
   숏패스 : 가까운 동료 발밑으로 낮고 빠르게 굴린다. 높이 변화 없이 마찰만 받는다.
   롱패스 : 멀거나 사이에 사람이 많으면 띄워 보낸다. z축 포물선을 그린다.
   스루패스: 달리는 동료의 "현재 위치"가 아니라 공과 만날 "미래 위치"를 계산해 찔러 넣는다.  */

const PASS_TYPE={SHORT:"SHORT", LONG:"LONG", THROUGH:"THROUGH"};

const PASS_LONG_M=26;         // 이 거리를 넘으면 땅볼로 붙이기 어려워 띄운다

const PASS_VMAX=0.46;         // 사람이 낼 수 있는 최대 킥 속도 (iso/s ≈ 31m/s)

const PASS_OVER=1.25;         // 목표를 살짝 지나 죽도록 하는 여유분

/* 달리는 동료와 공이 만나는 미래 지점.
   공은 마찰로 감속하므로 "t초 뒤 공이 가 있을 거리"가 비선형이다.
   그래서 도달 시간 t를 몇 번 되풀이해 수렴시킨다(요격 문제). */

const THRU_SPACE_MIN=0.055;   // 뒷공간이 최소 이만큼(약 3.7m)은 있어야 찌를 값어치가 있다

const THRU_LOOK=0.20;         // 타깃 공간 주변 이 반경(약 13m) 안의 상대를 센다

const THRU_CROWD_MAX=2;       // 이보다 많으면 스루패스를 접고 일반 패스로 돌린다

function throughSpaceCheck(carrier, recv, opps, dir){
  // 뒤에서 두 번째 수비수(보통 최후방 필드 수비수)가 오프사이드 라인
  const line=offsideLineX(opps.filter(o=>o.slot!=="GK"), dir);
  // (2) 온사이드 확인 — 라인을 이미 넘어서 있으면 찔러도 오프사이드다
  const beyond = dir>0 ? (recv.x - line) : (line - recv.x);
  if(beyond > 0.004) return null;
  // (1) 라인과 골라인 사이 = 달려 들어갈 뒷공간. 라인이 낮으면(수비가 내려앉으면) 공간이 없다.
  const goalX = dir>0 ? 1 : 0;
  const space = Math.abs(goalX - line)*PITCH_AR;
  if(space < THRU_SPACE_MIN) return null;
  // 타깃 공간의 중심 — 라인에서 뒷공간 쪽으로 절반쯤 들어간 지점, 좌우는 리시버 라인
  const sx = clamp01(line + (goalX-line)*0.45);
  const sy = clamp01(recv.y);
  // (3) 그 공간의 상대 밀집도
  let crowd=0;
  for(const o of opps){
    if(o.slot==="GK") continue;
    if(Math.hypot((o.x-sx)*PITCH_AR, o.y-sy) < THRU_LOOK) crowd++;
  }
  if(crowd > THRU_CROWD_MAX) return null;
  return {line, space, crowd, sx, sy};
}
/* 가속을 반영한 교차점 — 리시버는 지금 속도에서 최고 속도까지 가속하며 달린다.
   등가속 구간 t_a=(vmax-v0)/a 를 지나면 그 뒤로는 vmax 등속.
     d(t) = v0·t + ½a·t²                     (t <= t_a)
          = v0·t_a + ½a·t_a² + vmax·(t-t_a)  (t >  t_a)
   공의 도착 시간과 리시버의 도착 시간이 같아지는 t 를 수렴시켜 찾는다. */

function runDistance(v0, vmax, acc, t){
  const ta=Math.max(0, (vmax-v0)/acc);
  if(t<=ta) return v0*t + 0.5*acc*t*t;
  return v0*ta + 0.5*acc*ta*ta + vmax*(t-ta);
}

function interceptPointAccel(from, to, ballSpeed, vmax, acc){
  // 달리는 방향 단위벡터 — 움직이고 있으면 그 방향, 아니면 상대 골 방향
  let ux=(to.vx||0)*PITCH_AR, uy=(to.vy||0);
  const ul=Math.hypot(ux,uy);
  if(ul>1e-5){ ux/=ul; uy/=ul; }
  else { ux=(to.dir>0?1:-1); uy=0; }
  const v0=ul/SIM_DT;                       // 현재 속도 (iso/초)
  let t=0.6;
  for(let i=0;i<7;i++){
    const d=runDistance(v0, vmax, acc, t);  // t초 동안 달려간 거리
    const px=to.x + ux*d/PITCH_AR, py=to.y + uy*d;
    const bd=Math.hypot((px-from.x)*PITCH_AR, py-from.y);
    const nt=bd/Math.max(0.06, ballSpeed);  // 공이 그 지점까지 가는 데 걸리는 시간
    if(Math.abs(nt-t)<0.02){ t=nt; break; }
    t=0.5*t+0.5*nt;                         // 진동하지 않게 절반씩 수렴
  }
  t=clamp(t, 0, 2.4);
  const d=runDistance(v0, vmax, acc, t);
  return {x:clamp01(to.x+ux*d/PITCH_AR), y:clamp01(to.y+uy*d), t, lead:d};
}

/* 목표까지 굴러가 그 지점에서 거의 멈추도록 초기 속도를 역산한다.
   마찰 f 로 감속하는 공의 총 이동거리 = v0·dt/(1-f) 이므로 v0 = D(1-f)/dt.
   여유분(PASS_OVER)만큼 더 세게 차서 받는 선수가 발을 대기 좋게 만든다. */

function passLaunchSpeed(distIso, over){
  return Math.min(PASS_VMAX, distIso*(over||PASS_OVER)*(1-GRASS_FRICTION)/SIM_DT);
}

/* 공을 가진 선수가 주변을 훑어 최선의 패스를 고른다.
   후보 점수는 evaluatePassOptions 가 매기고, 여기서는 "어떻게 보낼지"를 정한다 —
   종류(숏/롱/스루), 목표(발밑 / 미래의 공간), 세기, 그리고 능력치에 따른 오차. */

function findBestPass(carrier, mates, opps, ctx){
  const opts=evaluatePassOptions(carrier, mates, opps, ctx);
  if(!opts.length) return null;
  /* ⚡ 역습 — 옆으로 돌리는 안전한 패스보다 전진 옵션이 크게 가산된다.
     수비가 대형을 갖추기 전 몇 초가 역습 전술의 존재 이유다. */
  if(ctx.counter) opts.sort((x,y)=>(y.score+(y.forward||0)*0.65)-(x.score+(x.forward||0)*0.65));
  const opt=ctx.pick ? ctx.pick(opts) : opts[0];
  if(!opt) return null;

  const skill=ctx.passSkill||carrier.passSkill||0.6;
  const distM=opt.dist*ISO_TO_M;
  const runner = opt.to.offRole===OFF_ROLE.RUN || opt.to.offRole===OFF_ROLE.OVERLAP || opt.to.offRole===OFF_ROLE.INSIDE;
  const moving = Math.hypot((opt.to.vx||0)*PITCH_AR, opt.to.vy||0)/SIM_DT > 0.030;

  // ── 종류를 정한다
  let type;
  // 스루패스는 "침투 역할 + 움직이는 중"만으로는 부족하다. 뒷공간이 실제로 있고,
  // 온사이드이고, 그 공간이 비어 있어야 한다 — 아니면 일반 패스로 돌린다.
  const thru = (runner && moving) ? throughSpaceCheck(carrier, opt.to, opps, ctx.dir) : null;
  // 공간이 넓고 상대가 적을수록 자주 시도한다
  /* 뒷공간이 넓을수록 더 자주 노린다 — 이게 없으면 상대가 라인을 아무리 올려도
     "공간은 생겼는데 아무도 안 찌르는" 상태가 되어, 높은 라인이 순수 이득이 돼버린다. */
  const spaceK = thru ? clamp(thru.space/20, 0.55, 2.2) : 1;
  /* 뒷공간으로 찌를지 말지는 "누가 뛰느냐"에 크게 좌우된다. 발 느린 타깃형 9번에게는
     아무도 스루패스를 넣지 않고, 빠른 윙어가 뛰면 어지간히 좁아도 한 번 찔러 본다. */
  const runFast = thru ? clamp(0.62+(opt.to.topSpeed!=null?opt.to.topSpeed:0.6)*0.78, 0.62, 1.45) : 1;
  /* 제보: 1대1이 너무 자주 나온다(측정 경기당 10회) — 스루패스가 사실상 상한(0.9)에 붙어 살았다.
     기본 시도율을 낮추고 상한을 절반으로. 대신 성공한 1대1의 마무리는 resolveShot 에서 현실화했다. */
  const thruP = thru ? clamp((0.10 + skill*0.26)*spaceK*runFast*(1 + FX(carrier,"killer")) * (1 - thru.crowd*0.22)
                             * (ctx.counter?1.8:1), 0, ctx.counter?0.62:0.45) : 0;   // ⚡ 역습 창에는 찔러 본다
  /* 긴 패스 / 짧은 패스 선호 — "몇 m부터 길게 차는가"의 문턱 자체를 움직인다.
     예전에는 특성만 읽었고(TP.longPass), 게다가 shortPass 가지는 아래 기본 분기와
     조건이 완전히 같아 아무 일도 하지 않는 죽은 줄이었다. 역할(딥라잉 플레이메이커의
     긴 패스, 앵커·하프백의 짧고 안전한 패스)이 실제로 동작하도록 FX로 합쳐 읽는다. */
  const lpF=FX(carrier,"longPass"), spF=FX(carrier,"shortPass");
  /* [KMD26 PASS-03] 원본은 여기서 선수 특성(lpF/spF)만 봤다. 팀 지시도 같이 읽는다 —
     짧게 가는 팀은 문턱이 올라가 웬만하면 붙여 주고, 길게 가는 팀은 내려가 띄워 보낸다. */
  const _pdT = ((carrier && carrier.team) ? TAC(carrier.team).pass : 1) - 1;
  const longGate = PASS_LONG_M*clamp(1 - lpF*0.38 + spF*0.45 - _pdT*0.30, 0.55, 1.85);
  if(thru && RNG() < thruP)                            type=PASS_TYPE.THROUGH;
  else if(distM > longGate || (opt.laneRisk||0) > 0.7)         type=PASS_TYPE.LONG;
  else                                                          type=PASS_TYPE.SHORT;

  // ── 목표 지점을 정한다
  let tx, ty, lead=0;
  if(type===PASS_TYPE.THROUGH){
    const guess=passLaunchSpeed(opt.dist, PASS_OVER+0.15);
    // 리시버의 가속·최고속도를 반영해 "달려가서 닿을 수 있는" 지점을 잡는다
    const vmax=SPD.SPRINT*BURST_MUL*paceMul(opt.to);
    const acc =ACCEL_BASE*accMul(opt.to);
    const ip=interceptPointAccel(carrier, opt.to, guess, vmax, acc);
    tx=ip.x; ty=ip.y;
    lead=Math.hypot((tx-opt.to.x)*PITCH_AR, ty-opt.to.y);
    if(lead < 0.012){ type=PASS_TYPE.SHORT; tx=opt.to.x; ty=opt.to.y; lead=0; }  // 사실상 발밑이면 스루가 아니다
  } else { tx=opt.to.x; ty=opt.to.y; }

  // ── 능력치에 따른 오차. 낮을수록 방향이 틀어지고 세기 조절에도 실패한다.
  const errBase = type===PASS_TYPE.SHORT ? 0.011 : (type===PASS_TYPE.THROUGH ? 0.026 : 0.036);
  const err = errBase*Math.pow(1.42-skill, 1.45)*1.25;   // 능력치 차이를 비선형으로 벌린다
  tx = clamp01(tx + (RNG()-0.5)*err);
  ty = clamp01(ty + (RNG()-0.5)*err*1.4);
  const misWeight = 1 + (RNG()-0.5)*(0.42*(1.35-skill));   // 너무 길거나 짧게 찬다

  const dIso=Math.hypot((tx-carrier.x)*PITCH_AR, ty-carrier.y);
  const over = PASS_OVER + (type===PASS_TYPE.THROUGH?0.30:0) + (opt.recvPress||0)*0.18;
  const speed = passLaunchSpeed(dIso, over)*misWeight;
  const lofted = type===PASS_TYPE.LONG;

  // 도착 시간 — 거리에 따라 늘어나고, 세게 찰수록 짧아진다
  // 도착 시간 — 실제 축구의 패스 소요 시간(5m 0.4초 / 20m 0.8초 / 40m 1.4초)에 맞춘다.
  // 여기가 길면 공이 공중에 머무는 시간이 늘어 커트가 폭증한다.
  const T = clamp((0.22 + dIso*ISO_TO_M*0.030)/Math.max(0.6, misWeight), 0.24, 2.2);
  return {opt, to:opt.to, type, tx, ty, dist:dIso, lead, speed, lofted, T,
          power: clamp(speed/0.24, 0.5, 2.2)};
}

function decideCrossDelivery(carrier, cr, ctx){
  const skill=carrier.crossSkill||0.6;
  if(cr.type===CROSS_TYPE.CUTBACK) return {power:clamp(1.15+skill*0.25,0.9,1.7), floated:false};
  const head=(cr.to.headSkill||0.6);
  const press=pressureOn(cr.to, ctx.opps||[], 1);
  const floated = head>0.62 && press<0.7 && RNG()<0.45+head*0.3;
  const power = floated ? clamp(0.70+skill*0.18, 0.55, 1.0)      // 천천히 띄워 올린다
                        : clamp(1.10+skill*0.35+press*0.15, 0.9, 1.85); // 강하게 감아 올린다
  return {power, floated};
}

const EARLY_RUN_P=0.014;      // 라인을 미리 깨고 나가는 빈도

const EARLY_RUN_LEAD=0.055;  // 그때 라인을 넘는 깊이(약 3.7m)

const OFFSIDE_SEEN=0.011;  // 패서가 "명백한 오프사이드"로 인지하는 최소 차이 (이보다 아슬아슬하면 못 본다)
/* 오프사이드 라인 — 뒤에서 두 번째 수비수의 x (보통 최후방은 키퍼이므로 최종 필드 수비수) */

function offsideLineX(defs, dir){
  const xs=defs.map(d=>d.x).sort((a,b)=> dir>0 ? b-a : a-b);   // 상대 골문에 가까운 순
  if(xs.length>=2) return xs[1];
  return xs.length ? xs[0] : (dir>0?0.98:0.02);
}
/* 패스가 나가는 그 순간, 받는 선수가 오프사이드 위치인가.
   조건: 상대 진영 + 뒤에서 두 번째 수비수보다 앞 + 볼보다 앞 */

function isOffsidePos(recv, passer, defs, dir){
  const inOppHalf = dir>0 ? recv.x>0.5 : recv.x<0.5;
  if(!inOppHalf) return false;
  const line=offsideLineX(defs, dir);
  const beyondLine = dir>0 ? recv.x > line+0.004 : recv.x < line-0.004;
  const beyondBall = dir>0 ? recv.x > passer.x   : recv.x < passer.x;
  return beyondLine && beyondBall;
}

const PRESS_RADIUS=0.10;   // 압박으로 치는 거리
/* 전술이 반영된 선수의 기본 자리.
   width  — 좁게(0)/보통(1)/넓게(2) : 좌우 간격을 압축하거나 벌린다
   line   — 수비라인 높이           : 팀 전체 x를 앞뒤로 민다
   mentality + 소유 여부            : 공격 시 라인을 올리고 수비 시 내린다 */
/* 한 라인의 "좌 · 가운데 · 우" 짝 — 가운데가 비면 좌우가 그 공간을 나눠 메운다 */
/* 센터백만 적용한다. 중원·공격진까지 좁히면 팀 전체가 촘촘해져 공격할 공간 자체가 사라진다
   (실측: 중원까지 좁혔더니 슛이 29→14개로 반토막 났다). 뒷문은 좁히고 앞은 넓게 — 그게 맞다. */

const PAIR_CENTER={LCB:"CB", RCB:"CB"};
/* 가운데가 비었을 때 안쪽으로 좁히는 비율.
   1.0 = 그대로(24m — 센터백 사이가 뻥 뚫려 스트라이커가 걸어 들어온다)
   0.46 = 11.1m — 실제 백4의 센터백 간격. 중앙 슛이 크게 줄어드는 대신 수비가 단단해진다. */

const PAIR_TIGHT=0.46;
/* 그 슬롯에 실제로 선수가 서 있는가 — 전술판이 저장해 둔 슬롯 맵을 본다.
   매 틱 여러 번 불리므로 팀별로 캐시해 두고, 슬롯 맵이 바뀌면 다시 계산한다. */

function slotUsed(team, slot){
  const sm=(team && team.tactic && team.tactic.slot) || null;
  if(!sm) return false;
  if(team._suMap!==sm || team._suN!==Object.keys(sm).length){
    const set={};
    for(const id in sm) set[sm[id]]=true;
    team._suSet=set; team._suMap=sm; team._suN=Object.keys(sm).length;
  }
  return !!(team._suSet && team._suSet[slot]);
}

function tacticalAnchorXY(team, slot, phase, isHome){
  const T=TAC(team);
  const base=SLOT_XY[slot]||SLOT_XY.CM;
  // SLOT_XY는 전술판 표시용이라 최후방~최전방이 피치 전체(약 80m)에 걸쳐 있다. 실제 팀 블록은
  // 40m 안쪽으로 훨씬 촘촘하므로, 시뮬에서는 필드 플레이어의 x를 중심 쪽으로 압축한다.
  // (이걸 안 하면 동료 간 거리가 너무 멀어서 짧은 패스라는 선택지 자체가 존재하지 않는다)
  const COMPACT=0.52, MIDX=0.44;
  const bx = slot==="GK" ? base.x : MIDX+(base.x-MIDX)*COMPACT;
  const wScale=0.72+T.width*0.28;                          // 0.72 / 1.00 / 1.28
  let y=0.5+(base.y-0.5)*wScale;
  // ── 가운데 칸이 비면 좌우가 안쪽으로 좁힌다 ─────────────────────────
  //   전술판은 한 라인을 5칸으로 나눠 놓았다. 백4를 쓰면 LB·LCB·RCB·RB 만 채워지고
  //   한가운데 CB 칸이 통째로 빈다. 그러면 두 센터백 앵커가 y 0.32 / 0.68 —
  //   무려 24m가 벌어져, 그 사이로 스트라이커가 그냥 걸어 들어와 공을 받는다.
  //   실제 백4의 센터백은 9~12m 간격으로 붙어 선다. 가운데가 비었으면 그만큼 좁혀 준다.
  //   (중원·공격진의 짝도 같은 문제를 겪는다 — 4-4-2의 두 중앙 미드필더 등)
  const ctr=PAIR_CENTER[slot];
  if(ctr && !slotUsed(team, ctr)) y = 0.5 + (y-0.5)*PAIR_TIGHT;
  /* 수비 라인 지시는 "뒷선을 어디에 두느냐"다. 예전에는 열한 명 전부를 똑같이 밀어 올려서,
     라인을 올리면 공격진까지 오프사이드 라인에 처박히며 공간이 사라졌다.
     (실측: 라인 0 → 우리 슛 30.5 · 라인 4 → 20.5 로 오히려 공격이 죽었다)
     실제로는 뒷선이 많이 올라오고 앞선은 거의 그대로다 — 그래서 블록이 "압축"된다. */
  const LINE_W = {SW:1.0, DF:1.0, WB:0.95, DM:0.85, MF:0.70, AM:0.45, FW:0.25};
  const lineShift=(T.line-1)*0.055*(slot==="GK" ? 0.5 : (LINE_W[SLOT_BAND[slot]] !== undefined ? LINE_W[SLOT_BAND[slot]] : 0.7))*1.55;
  // 풀백은 소유 시 한 라인을 통째로 올라간다(현대축구). 이게 없으면 오버래핑 목표까지 거리가 너무 멀어
  // 소유가 끝나기 전에 도착하지 못해, 지시만 있고 실제로는 올라가지 못한다.
  const isFB = (slot==="LB"||slot==="RB");
  const isWB = (slot==="LWB"||slot==="RWB");
  // 윙백은 풀백보다 더 올라간다 — 그게 윙백이다
  const fbPush = (phase==="ATT" && (isFB||isWB)) ? ((isWB?0.125:0.11)+(T.mentality-1)*0.03) : 0;
  const phaseShift = (phase==="ATT" ? (0.06+(T.mentality-1)*0.035) : -(0.045+(2-T.mentality)*0.012)) + fbPush;
  const x=clamp01(bx + lineShift + (slot==="GK"?0:phaseShift));
  const p={x, y:clamp01(y)};
  return isHome ? p : mirrorXY(p);
}
/* 어떤 지점이 상대 선수들에게 받는 압박 강도. 가까울수록 급격히 커지고, 압박 전술이 높으면 가중된다. */

function pressureOn(pt, opponents, pressTac){
  let s=0;
  for(const o of opponents){
    const d=Math.hypot((o.x-pt.x)*PITCH_AR, o.y-pt.y);
    if(d<PRESS_RADIUS) s+=(1-d/PRESS_RADIUS);
  }
  /* [KMD26 PRESS-01] 압박 계수는 **압박하는 쪽**의 지시를 따라야 한다.
     호출부가 전부 '압박당하는 팀'의 값을 넘기고 있어서, 압박을 올리면
     우리 선수가 더 눌린 것처럼 계산돼 오히려 안전하게 돌렸다. */
  const _pk = (opponents && opponents.length && opponents[0].team)
            ? TAC(opponents[0].team).press
            : (pressTac===undefined?1:pressTac);
  return s*(0.8+_pk*0.25);
}
/* 패스 경로 위에 상대가 걸쳐 있는 정도(0=완전히 열림, 1=완전히 막힘) */

function laneBlocked(from, to, opponents){
  const dx=(to.x-from.x)*PITCH_AR, dy=to.y-from.y;
  const L=Math.hypot(dx,dy); if(L<1e-6) return 0;
  const ux=dx/L, uy=dy/L;
  let worst=0;
  for(const o of opponents){
    const px=(o.x-from.x)*PITCH_AR, py=o.y-from.y;
    const along=px*ux+py*uy;
    if(along<=0.01 || along>=L) continue;                  // 패서 뒤 / 리시버 너머는 무관
    const perp=Math.abs(px*uy-py*ux);
    const near=1-clamp01(perp/0.038);                      // 경로에서 3.8% 안이면 위협(그보다 넓으면 다 막힌 걸로 잡힌다)
    if(near>worst) worst=near;
  }
  return worst;
}
/* 동료 전원을 점수화한다. 전진 이득은 크게 치고, 받는 선수가 압박받거나 경로가 막히면 깎는다.
   내가 압박받는 상황에서는 안전한 후방 옵션에 가점이 붙어 — 별도 로직 없이 — 백패스가 자연히 선택된다. */

function evaluatePassOptions(carrier, mates, opps, ctx){
  const dir=ctx.dir, out=[];
  /* [KMD26 PASS-01] 팀 전술 '패스 길이'. tacVal 로 0~2 스케일이므로 가운데가 1이다.
     짧게(-1) 이면 거리 부담을 키우고 전진 이득을 깎아 가까운 연결을 고르게 하고,
     길게(+1) 이면 반대로 해서 앞으로 길게 붙이게 한다.
     ⚠ 난수를 쓰지 않는다 — 결정론에 영향이 없어야 한다. */
  const _pd = ((carrier && carrier.team) ? TAC(carrier.team).pass : 1) - 1;
  const _progK = 1 + _pd*0.45, _distK = 1 - _pd*0.30;
  for(const m of mates){
    if(m.id===carrier.id) continue;
    const dx=(m.x-carrier.x)*PITCH_AR, dy=m.y-carrier.y;
    const dist=Math.hypot(dx,dy);
    if(dist<0.03 || dist>0.70) continue;
    const forward=(m.x-carrier.x)*dir;
    // 전진 이득은 포화시킨다 — 이게 없으면 "가장 멀리 전진하는 패스"가 항상 이겨서 롱볼만 나온다
    const prog=Math.max(-1.2, Math.min(1.2, forward/0.25));
    // 거리 위험은 급격히 커진다(20m 부근이 기준). 패스 능력치가 높으면 완화된다.
    const distPen=Math.pow(dist/0.25, 1.8)*0.55*(1.35-ctx.passSkill*0.6);
    const recvPress=pressureOn(m, opps, ctx.press);
    const blocked=laneBlocked(carrier, m, opps);
    const recvAdv = dir>0 ? m.x : 1-m.x;                  // 0=자기 골문, 1=상대 골문
    const recvOwn = 1-(dir>0?m.x:1-m.x);                  // 0=상대 골문 쪽, 1=우리 골문 쪽
    // 우리 골문에 가까운 선수일수록, 그가 압박받고 있으면 패스 리스크가 급격히 커진다
    let score = prog*1.35*_progK - distPen*_distK - recvPress*(0.55+recvOwn*2.4) - blocked*1.2
              + Math.max(0, recvAdv-0.52)*1.0;            // 상대 진영으로 연결할수록 가점
    if(m.slot==="GK") score-=0.55+recvPress*3.0;               // 압박받는 키퍼에게 주는 건 자살행위
    // 명백한 오프사이드 위치의 동료에게는 주지 않는다. 다만 라인과의 차이가 아슬아슬하면
    // 패서도 그걸 못 본다 — 실제 경기의 오프사이드는 대부분 이 미세한 오차에서 나온다.
    if(ctx.defs){
      const oline=offsideLineX(ctx.defs, dir);
      const over = dir>0 ? (m.x-oline) : (oline-m.x);
      const inOpp = dir>0 ? m.x>0.5 : m.x<0.5;
      if(inOpp && over > OFFSIDE_SEEN){
        // 얼마나 명백하냐에 비례해서 깎는다. 아슬아슬하면 그냥 찔러 넣고 깃발이 오른다.
        const obvious = clamp((over-OFFSIDE_SEEN)/0.045, 0, 1);
        score -= (0.35 + obvious*(1.85+(ctx.passSkill||0.6)*2.2));
      }
    }
    // 플레이메이커 역할은 볼이 그를 거쳐 가게 만든다 (FM: 모든 플메는 볼을 받으러 다가온다)
    if(m.role&&m.role.pm) score += m.role.pm*ROLE_PM_BONUS;
    // 특성: 반대편 측면으로 보내기 — 볼과 반대쪽에 있는 동료에게 가점
    const sw=FX(carrier,"switchPlay");
    if(sw) score += sw*clamp(Math.abs(m.y-carrier.y)/0.45,0,1)*0.55;
    if(forward<0) score += Math.min(0.18, ctx.selfPress*0.20);  // 압박받을 때만 백패스가 살아난다
    /* 앞으로 뛰고 있는 동료는 그 선수가 빠를수록 값어치가 커진다 — 같은 공간이라도
       발 빠른 윙어가 뛰면 살아나는 패스가, 느린 선수에게는 그냥 버리는 패스가 된다. */
    if(forward>0.01){
      const spd_=(m.topSpeed!=null?m.topSpeed:0.6)-0.60;
      const running = (m.offRole===OFF_ROLE.RUN||m.offRole===OFF_ROLE.OVERLAP||m.offRole===OFF_ROLE.INSIDE) ? 1.6 : 0.7;
      score += spd_*running*Math.min(1, forward/0.18);
    }
    out.push({to:m, score, dist, forward, blocked, recvPress});
  }
  out.sort((a,b)=>b.score-a.score);
  return out;
}
/* ── 오프더볼 역할 ──
   같은 라인의 선수가 전부 같은 판단을 하면 라인이 통째로 움직여서 공간이 생기지 않는다.
   실제 축구는 한 명이 내려받고, 한 명은 하프스페이스로 들어가고, 한 명은 뒷공간으로 뛴다.
   그 역할 분담을 명시적으로 만든다. */

const OFF_ROLE={ RUN:"RUN", HALF:"HALF", WIDE:"WIDE", DEEP:"DEEP", HOLD:"HOLD", BALANCE:"BALANCE", OVERLAP:"OVERLAP", INSIDE:"INSIDE" };

const WIDE_SLOTS={LB:1,RB:1,LM:1,RM:1,LW:1,RW:1};
/* 슬롯 이름 기준 좌(-1)/중앙(0)/우(+1). home.y로 판단하면 CM은 y가 정확히 0.5여서
   RCM과 같은 쪽으로 가버리고, 결국 LCM·CM·RCM이 똑같이 움직이게 된다. */

const SLOT_SIDE={LB:-1,LCB:-1,LM:-1,LCM:-1,LW:-1,LS:-1, RB:1,RCB:1,RM:1,RCM:1,RW:1,RS:1, CB:0,CM:0,ST:0,GK:0};

const MID_SLOTS={LCM:1,CM:1,RCM:1};

const FWD_SLOTS={ST:1,LS:1,RS:1};
/* 상대 최종 수비 라인의 x — 침투(RUN)의 기준선이 된다 */

function oppLineX(opps, dir){
  let line=null;
  for(const o of opps){
    if(o.slot==="GK") continue;
    if(line===null) line=o.x;
    else line = dir>0 ? Math.max(line,o.x) : Math.min(line,o.x);
  }
  return line===null ? (dir>0?0.8:0.2) : line;
}
/* 소유 팀의 역할 분담. 슬롯을 기본으로 하되 시간에 따라 순환시켜, 같은 선수가 늘 같은 움직임만
   하지 않게 한다(6초 주기 + 선수별 위상차). 침투는 항상 소수만 나간다. */

function assignOffRoles(mine, t, ball, dir, ment){
  const out=mine.filter(a=>a.slot!=="GK");
  let runners=0, deep=0;
  ball=ball||{x:0.5,y:0.5}; dir=dir||1; ment=(ment===undefined?1:ment);
  // 전방 선수부터 역할을 정한다 — 침투 인원을 최대 2명으로 제한하기 위해
  const order=[...out].sort((p,q)=> (FWD_SLOTS[q.slot]?2:WIDE_SLOTS[q.slot]?1:0) - (FWD_SLOTS[p.slot]?2:WIDE_SLOTS[p.slot]?1:0));
  for(const a of order){
    const ph=Math.floor(t/6 + a.seed*0.17) % 3;
    let r;
    if(FWD_SLOTS[a.slot])      r = (ph!==2 && runners<2) ? OFF_ROLE.RUN : OFF_ROLE.HOLD;
    else if(a.slot==="LW"||a.slot==="RW"){
      /* 윙어는 늘 터치라인에 붙어 있었다. 그래서 공이 박스 근처까지 갔을 때도 각이 안 나오는
         자리에 서 있었고, 슛은 평균 25m 밖에서만 나왔다(측정: LW 23.5m · RW 27.4m).
         실제 윙어는 반대편으로 공이 넘어가면 안쪽으로 접어 들어가 뒷문(파포스트)을 노린다. */
      const mySide  = a.slot==="LW" ? -1 : 1;
      const ballSide= ball.y<0.5 ? -1 : 1;
      const adv     = dir>0 ? ball.x : 1-ball.x;
      if(ph===1 && runners<2)                    r = OFF_ROLE.RUN;
      else if(adv>0.58 && ballSide!==mySide)     r = OFF_ROLE.INSIDE;   // 공이 반대편 → 안으로 접는다
      else if(adv>0.72)                          r = OFF_ROLE.INSIDE;   // 박스 근처 → 폭보다 침투
      else                                       r = OFF_ROLE.WIDE;
    }
    else if(a.slot==="LB"||a.slot==="RB"){
      const mySide = a.slot==="LB" ? -1 : 1;
      const ballSide = ball.y<0.5 ? -1 : 1;
      const teamUp = (dir>0 ? ball.x : 1-ball.x) > 0.40;      // 팀이 어느 정도 전진했을 때만
      r = (teamUp && ballSide===mySide && ph!==2 && ment>=1) ? OFF_ROLE.OVERLAP : OFF_ROLE.WIDE;
    }
    else if(WIDE_SLOTS[a.slot]) r = OFF_ROLE.WIDE;                              // 측면 미드는 폭을 잡는다
    else if(a.slot==="CM")      r = OFF_ROLE.DEEP;                               // 중앙 피벗(#6) — 내려받는다
    else if(MID_SLOTS[a.slot])  r = (ph===0 && runners<2) ? OFF_ROLE.RUN          // #8은 가끔 박스로 침투
                                  : (ph===1) ? OFF_ROLE.HALF : OFF_ROLE.DEEP;    // 좌우가 번갈아 오르내린다
    else                        r = OFF_ROLE.BALANCE;                            // 센터백은 라인 유지
    if(r===OFF_ROLE.RUN) runners++;
    if(r===OFF_ROLE.DEEP) deep++;
    a.offRole=r;
  }
}
/* 역할별 "가고 싶은 기준점" */

function roleAnchorXY(a, anchor, ball, dir, lineX){
  let side = SLOT_SIDE[a.slot];
  if(side===undefined) side = a.home.y<0.5 ? -1 : 1;
  if(side===0) side = (a.seed%2) ? 0.35 : -0.35;   // 중앙 선수는 좌우로 살짝만 어긋나게
  switch(a.offRole){
    case OFF_ROLE.RUN: {
      // 오프사이드 라인 "바로 앞"에 붙어 기다린다. 타이밍(위치선정+침착성)이 좋을수록 라인에
      // 바짝 붙고(위협적) 흔들림이 적다. 나쁜 선수는 자꾸 라인을 넘어가 걸린다.
      const tm=a.offTiming||0.6;
      const margin=0.010+(1-tm)*0.018;                                   // 라인 앞에 두는 여유
      const jitter=Math.sin(a.seed*1.7+(a._runPhase||0))*(1-tm)*0.075;   // 흔들림 — 나쁜 선수는 여유를 넘어 라인을 넘는다
      return {x:clamp01(lineX-dir*margin+dir*jitter), y:clamp01(0.5+side*(0.10+Math.abs(a.home.y-0.5)*0.5))};
    }
    case OFF_ROLE.HALF:  // 라인 사이 하프스페이스 — 볼보다 앞, 중앙과 측면 사이
      return {x:clamp01(ball.x+dir*0.11), y:clamp01(0.5+side*0.19)};
    case OFF_ROLE.WIDE:  // 터치라인 쪽으로 벌려 블록을 넓힌다
      return {x:clamp01(ball.x+dir*0.05), y:clamp01(0.5+side*0.40)};
    case OFF_ROLE.INSIDE: {  // 컷인 — 안쪽으로 접어 박스 뒷문으로 들어간다
      const tm=a.offTiming||0.6;
      const margin=0.012+(1-tm)*0.016;
      // 오프사이드 라인을 넘지 않는 선에서 박스 언저리까지 파고든다
      const want = dir>0 ? Math.min(0.88, lineX-margin) : Math.max(0.12, lineX+margin);
      return {x:clamp01(want), y:clamp01(0.5+side*0.115)};
    }
    case OFF_ROLE.OVERLAP: // 풀백 오버래핑 — 볼보다 앞, 터치라인 끝까지 (윙어를 추월한다)
      return {x:clamp01(ball.x+dir*0.16), y:clamp01(0.5+side*0.45)};
    case OFF_ROLE.DEEP:  // 볼보다 살짝 뒤에서 안전하게 받아준다 (피벗 한 명만)
      return {x:clamp01(ball.x-dir*0.06), y:clamp01(anchor.y*0.65+0.5*0.35)};
    case OFF_ROLE.BALANCE: // 수비 라인 유지 — 볼을 따라 내려가지 않는다
      return {x:anchor.x, y:clamp01(anchor.y+(ball.y-anchor.y)*0.18)};
    default:
      return {x:anchor.x, y:anchor.y};
  }
}
/* 역할 기준점 주변에서 실제로 설 자리를 고른다. 역할마다 무엇을 중시하는지가 다르다 —
   침투는 전진을 최우선으로 보고(아직 받는 게 아니므로 패스 길은 덜 중요),
   내려받기는 압박이 없고 패스 길이 열린 곳을 최우선으로 본다. */

function findOpenSpot(a, anchor, carrier, opps, mates, dir, ball, lineX){
  const base=roleAnchorXY(a, anchor, ball, dir, lineX);
  const cands=[base];
  for(let k=0;k<4;k++){
    const th=(k/4)*Math.PI*2 + a.seed*0.7;
    const r=0.09;
    cands.push({x:clamp01(base.x+Math.cos(th)*r/PITCH_AR), y:clamp01(base.y+Math.sin(th)*r)});
  }
  // 역할의 전진 성향을 빈 공간 탐색에도 반영한다.
  // 이게 없으면 앵커만 앞으로 옮겨두고 실제 움직임은 역할과 무관해진다
  // (앵커 기준으로는 16m 차이인데 경기 중 평균은 5m밖에 안 벌어지던 원인).
  const rFwd=(a.role&&a.role.fwd)||0;
  const rWide=(a.role&&a.role.wide)||0;
  if(rFwd||rWide){
    const sideY = base.y<0.5 ? -1 : 1;
    for(let k=0;k<3;k++){
      cands.push({x:clamp01(base.x + dir*rFwd*(0.05+k*0.045)),
                  y:clamp01(base.y + sideY*rWide*(0.04+k*0.035))});
    }
  }
  const W = a.offRole===OFF_ROLE.RUN  ? {press:0.9, lane:0.5, crowd:1.0, adv:2.6}
          : a.offRole===OFF_ROLE.HALF ? {press:1.6, lane:1.8, crowd:1.3, adv:1.4}
          : a.offRole===OFF_ROLE.WIDE ? {press:1.4, lane:1.3, crowd:1.5, adv:0.8}
          : a.offRole===OFF_ROLE.INSIDE ? {press:0.7, lane:0.7, crowd:0.7, adv:2.0, narrow:3.4}
          : a.offRole===OFF_ROLE.DEEP ? {press:2.0, lane:2.0, crowd:1.2, adv:0.0}
          : a.offRole===OFF_ROLE.BALANCE ? {press:1.0, lane:0.6, crowd:1.0, adv:0.3}
          : a.offRole===OFF_ROLE.OVERLAP ? {press:1.1, lane:0.9, crowd:1.0, adv:2.0}
          :                             {press:1.6, lane:1.5, crowd:1.2, adv:0.7};
  let best=cands[0], bs=-1e9;
  const tmv=a.offTiming||0.6;
  for(const c of cands){
    const press=pressureOn(c, opps, 1);
    // 역할 성향과 같은 방향의 후보에 가점 (전진형은 앞을, 후방형은 뒤를 고른다)
    const rBias = rFwd ? (dir>0 ? (c.x-base.x) : (base.x-c.x))*rFwd*ROLE_SPOT_W : 0;
    const lane=carrier?laneBlocked(carrier, c, opps):0;
    // 오프사이드 라인을 넘는 자리는 피한다 — 타이밍이 좋은 선수일수록 확실히 지킨다
    const over = dir>0 ? (c.x-lineX) : (lineX-c.x);
    const offPen = over>0 ? (0.6+tmv*2.6) : 0;
    let crowd=0;
    for(const m of mates){
      if(m===a) continue;
      const d=Math.hypot((m.x-c.x)*PITCH_AR, m.y-c.y);
      if(d<0.10) crowd+=(1-d/0.10);
    }
    const adv=dir>0?c.x:1-c.x;
    /* 컷인은 "빈 공간"이 아니라 "골문 앞"으로 가는 움직임이다. 압박·혼잡만 보면
       늘 텅 빈 터치라인 쪽이 최고점을 받아, 역할만 컷인이고 몸은 계속 측면에 남았다.
       (실측: 컷인 배정 중에도 슛 위치의 좌우 편차가 0.34 — 사실상 윙에서 때린 것) */
    const narrow = W.narrow ? (0.5-Math.min(0.5, Math.abs(c.y-0.5)))*W.narrow : 0;
    const sc = -press*W.press - lane*W.lane - crowd*W.crowd + adv*W.adv - offPen + rBias + narrow;
    if(sc>bs){ bs=sc; best=c; }
  }
  return best;
}
/* ── 수비 시 역할 ──
   전원이 "앵커 + 볼 쪽으로 조금"이라는 같은 공식을 쓰면 3미드가 통째로 붙어 다닌다.
   실제 축구는 한 명이 압박 나가면, 한 명은 패스 길목을 끊고, 한 명은 사람을 잡는다.
   라인을 맞출 때도 있지만 늘 그런 건 아니다 — 그 편차를 만든다. */

const DEF_ROLE={ PRESS:"PRESS", LANE:"LANE", MARK:"MARK", LINE:"LINE", COVER:"COVER",
                 RECOVER:"RECOVER", COVER_WIDE:"COVER_WIDE" };
/* 올라가 있던 풀백이 남긴 뒷공간을 찾는다. 소유권을 잃은 직후(역습) 이 공간이 가장 위험하고,
   현대축구에서는 그 뒤에 있던 선수가 즉시 그 자리를 메운다. */

function exposedFlank(mine, dir){
  let worst=null;
  for(const a of mine){
    if(a.slot!=="LB" && a.slot!=="RB") continue;
    const defAnchor=tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
    const ahead=(a.x-defAnchor.x)*dir;              // 자기 수비 위치보다 얼마나 전진해 있나
    if(ahead>0.09 && (!worst || ahead>worst.ahead)) worst={by:a, anchor:defAnchor, ahead};
  }
  return worst;
}
/* 볼 소유자가 노릴 만한 "가장 위협적인 전진 패스 대상" — 길목 차단(LANE)의 기준이 된다 */

function topThreat(carrier, opps, dir){
  let best=null, bs=-1e9;
  for(const o of opps){
    if(o.slot==="GK" || o===carrier) continue;
    const fwd=(o.x-carrier.x)*dir;              // 상대 공격 방향 기준 전진도
    const d=Math.hypot((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
    if(d<0.04 || d>0.6) continue;
    const sc=fwd*2.2 - d*0.8;
    if(sc>bs){ bs=sc; best=o; }
  }
  return best;
}
/* 압박 나간 선수를 제외한 나머지에게 역할을 배분한다 */

function assignDefRoles(mine, opps, carrier, pressers, t, dir){
  const ownGoalX = dir>0 ? 0.015 : 0.985;       // 우리가 지켜야 할 골문
  const gap = exposedFlank(mine, dir);          // 올라가 있던 풀백이 남긴 공간
  let covered=false, coverTaken=false;
  const oppDir = -dir;                           // 상대의 공격 방향
  // 위협 순위: 우리 골문에 가까운 상대 공격수부터
  const threats=opps.filter(o=>o.slot!=="GK" && o!==carrier)
    .sort((p,q)=> Math.abs(p.x-ownGoalX)-Math.abs(q.x-ownGoalX));
  const taken=new Set();
  for(const a of mine) a._coverBehind=null;   // 지난 판단의 잔재를 지운다
  for(const a of mine){
    if(a.slot==="GK"){ a.defRole=null; continue; }
    if(pressers.includes(a)){ a.defRole=DEF_ROLE.PRESS; a._mark=null; continue; }
    // 올라가 있던 풀백 본인은 전력으로 복귀한다
    if(gap && a===gap.by){ a.defRole=DEF_ROLE.RECOVER; a._recover=gap.anchor; a._mark=null; continue; }
    // 그 뒤에 있던 선수 한 명이 빈 측면을 메운다 (같은 쪽 센터백 우선, 없으면 피벗)
    if(gap && !covered && (a.slot==="LCB"||a.slot==="RCB"||a.slot==="CB"||a.slot==="CM")){
      const sameSide = (gap.by.slot==="LB" && (a.slot==="LCB"||a.slot==="CM"))
                    || (gap.by.slot==="RB" && (a.slot==="RCB"||a.slot==="CM"));
      if(sameSide){ a.defRole=DEF_ROLE.COVER_WIDE; a._coverAt=gap.anchor; a._mark=null; covered=true; continue; }
    }
    // 동료가 압박하러 뛰어나갔으면, 그 뒤 공간을 한 명이 대각선 뒤로 메운다.
    // (예전엔 시간에 따라 무작위로 COVER 가 돌아가서 압박과 연동되지 않았다)
    if(!coverTaken && pressers.length && (a.slot==="LCB"||a.slot==="RCB"||a.slot==="CB")){
      const pr=pressers[0];
      const behind = (pr.x-a.x)*dir > -0.01;        // 압박 나간 동료가 나보다 앞에 있다
      if(behind){
        a.defRole=DEF_ROLE.COVER; a._mark=null;
        a._coverBehind={x:pr.x, y:pr.y};            // 그 뒤쪽을 지킨다
        coverTaken=true; continue;
      }
    }
    let r;
    /* 수비 행동에 개인 역할을 반영한다.
       예전에는 순수하게 슬롯과 시간(ph)으로만 갈려서, 수비형 윙이든 인사이드 포워드든
       마크 지정 비율이 28~31%로 똑같았다 — 역할이 협력수비에 관여할 방법이 없었다.
       이제 밀착 마크 성향은 사람을 잡고, 압박 성향은 길목으로 나가고,
       뒤에 서는 역할(fwd 음수)은 라인을 지키는 쪽으로 기운다. */
    const rMark = clamp(FX(a,"tightMark"), 0, 1.5);
    const rPress= clamp((a.role&&a.role.press)||0, 0, 1.5);
    const rDeep = Math.max(0, -((a.role&&a.role.fwd)||0));
    const pickDef=(wLane, wMark, wLine)=>{
      // 뒤에 서는 성향(rDeep)은 "어디에 서는가"이지 "누구를 잡는가"가 아니다.
      // 여기에 큰 가중을 주면 밀착 마크 역할이 오히려 라인만 지키게 된다 — 실제로 그랬다.
      const w0=wLane*(1+rPress*1.00), w1=wMark*(1+rMark*2.00), w2=wLine*(1+rDeep*0.50);
      const tot=w0+w1+w2;
      // 기존 ph 순환과 같은 리듬을 쓰되(선수마다 위상이 다르다) 가중치만 얹는다
      const u=((a.seed*0.61803 + t/5) % 1)*tot;
      return u<w0 ? DEF_ROLE.LANE : u<w0+w1 ? DEF_ROLE.MARK : DEF_ROLE.LINE;
    };
    if(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB") r = DEF_ROLE.LINE;
    else if(WIDE_SLOTS[a.slot] && (a.slot==="LB"||a.slot==="RB")) r = DEF_ROLE.MARK;
    else if(a.slot==="CM")      r = DEF_ROLE.LANE;                        // 피벗은 길목을 끊는다
    else if(MID_SLOTS[a.slot])  r = pickDef(1, 1, 1);
    else                        r = pickDef(0, 1, 2);   // 최전방·측면은 원래 마크 1 : 라인 2 비율이었다
    a.defRole=r;
    if(r===DEF_ROLE.MARK){
      // 아직 아무도 안 잡은 상대 중 자기와 가장 가까운 선수를 잡는다
      let pick=null, bd=1e9;
      for(const o of threats){
        if(taken.has(o.id)) continue;
        const d=Math.hypot((o.x-a.x)*PITCH_AR, o.y-a.y);
        if(d<bd){ bd=d; pick=o; }
      }
      if(pick){ taken.add(pick.id); a._mark=pick; } else { a._mark=null; a.defRole=DEF_ROLE.LINE; }
    } else a._mark=null;
  }
  // ── 판단력(Decisions) — 역할이 바뀌는 순간 멈칫한다.
  // 판단력이 낮을수록 오래 굳어 있고, 그동안은 직전 역할의 목표를 붙들고 있다(역동작).
  for(const a of mine){
    if(a.slot==="GK") continue;
    if(a._lastRole !== a.defRole){
      if(a._lastRole !== undefined){
        const dec=a.decSkill||0.6;
        a._hesitateUntil = t + HESITATE_MAX*(1.15-dec)*(0.5+RNG()*0.8);
        a._frozenRole = a._lastRole;
        a._frozenMark = a._lastMark;
      }
      a._lastRole = a.defRole;
    }
    a._lastMark = a._mark;
  }
  // ── 수비 라인 동기화 — 라인을 지키는 센터백들의 깊이를 서로 맞춘다(일자 라인).
  // 마크를 나간 선수는 제외한다. 침투를 따라간 선수 때문에 라인이 끌려가면 안 된다.
  const liners=mine.filter(a=>a.defRole===DEF_ROLE.LINE &&
                              (a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB"));
  if(liners.length>=2){
    const own = v => dir>0 ? v : 1-v;
    let sum=0; for(const a of liners) sum+=own(a.x);
    const avg=sum/liners.length;
    for(const a of liners) a._lineOwnX=avg;      // defTargetXY 가 이 깊이로 당겨준다
  } else for(const a of mine) a._lineOwnX=null;

  // ── 센터백 존 마킹 ─────────────────────────────────────────────
  //   센터백은 여태 LINE 역할로 고정돼 있어서 "아무도 잡지 않는" 상태였다.
  //   LINE 목표는 자기 전술 앵커를 볼 쪽으로 조금 당긴 값이라 상대 공격수의 위치를 아예 보지 않는다.
  //   그래서 센터백 둘 사이에 선 스트라이커가 그냥 free 로 공을 받았다.
  //   ─ 사람을 따라 피치를 가로지르는 대인마크가 아니라, 실제 존 수비처럼
  //     "내 구역에 들어온 공격수를 잡는다". 라인 깊이(x)는 그대로 두므로 오프사이드 라인도 유지된다.
  for(const a of mine) a._zoneMark=null;
  // LINE 뿐 아니라 COVER 로 내려앉은 센터백도 담당을 잡는다.
  // (LINE 은 전체의 34%뿐이라, LINE 에만 걸면 대부분의 시간 동안 아무도 안 잡는다)
  /* ⚠ 주석으로만 약속하고 코드는 LINE 만 걸렀던 버그 — LINE 은 전체의 34%뿐이라
     센터백이 대부분의 시간 동안 스트라이커를 방치했다("마킹 위치를 잘못 잡는다"는 그 제보). */
  const cbs=mine.filter(a=>(a.slot==="CB"||a.slot==="LCB"||a.slot==="RCB") &&
                            (a.defRole===DEF_ROLE.LINE || a.defRole===DEF_ROLE.COVER));
  if(cbs.length){
    const inZone=opps.filter(o=>o.slot!=="GK" &&
      Math.abs(o.x-ownGoalX)*PITCH_AR < CB_ZONE_X);       // 우리 진영 깊숙이 들어온 상대만
    inZone.sort((p,q)=>Math.abs(p.x-ownGoalX)-Math.abs(q.x-ownGoalX));  // 골문에 가까운 위협부터
    const used=new Set();
    for(const o of inZone){
      let best=null, bd=1e9;
      for(const c of cbs){
        if(used.has(c.id)) continue;
        const d=Math.abs(c.y-o.y);                        // 좌우 구역 기준으로 담당을 가른다
        if(d<bd){ bd=d; best=c; }
      }
      if(!best || bd>=CB_ZONE_Y) continue;
      // 너무 멀면 붙으러 가지 않는다 — 라인을 버리고 뛰쳐나가면 뒷공간이 열린다
      const near=Math.hypot((o.x-best.x)*PITCH_AR, o.y-best.y)*ISO_TO_M;
      if(near>CB_ZONE_NEAR) continue;
      best._zoneMark=o; used.add(best.id);
    }
  }
}
/* 수비 역할별 목표 지점 */

function defTargetXY(a, anchor, ball, carrier, threat, dir){
  const ownGoalX = dir>0 ? 0.015 : 0.985;
  // 판단이 굳어 있는 동안에는 바뀌기 전 역할의 목표를 붙들고 있다 — 역동작이 그대로 보인다
  const role = (a._hesitateUntil && a._hesitateUntil>a._now) ? a._frozenRole : a.defRole;
  const mark = (a._hesitateUntil && a._hesitateUntil>a._now) ? a._frozenMark : a._mark;
  switch(role){
    case DEF_ROLE.MARK: {   // 마크 대상과 우리 골문 사이(골사이드)에 선다
      const m=mark; if(!m) break;
      const own = v => dir>0 ? v : 1-v;
      const deep=blockDepth(ball, dir);
      // 박스 근처에서는 마크도 골문 쪽으로 더 붙어 선다
      const mx = Math.max(0.022, own(m.x) - 0.030 - deep*0.018);
      return {x:clamp01(dir>0?mx:1-mx), y:clamp01(m.y+(0.5-m.y)*(0.08+deep*0.12))};
    }
    case DEF_ROLE.LANE: {   // 볼 소유자와 가장 위협적인 전진 대상 사이를 끊는다
      if(!carrier || !threat) break;
      const mx=(carrier.x+threat.x)/2, my=(carrier.y+threat.y)/2;
      // 볼이 우리 박스 근처면 길목만 끊는 게 아니라 골문 앞으로 내려앉는다(로우블록).
      // 이게 없으면 박스 앞에 수비수가 한두 명뿐이라 찬스가 끝없이 나온다.
      const deep=blockDepth(ball, dir);
      const pull=0.10+deep*0.30;
      return {x:clamp01(mx+(ownGoalX-mx)*pull), y:clamp01(my+(0.5-my)*deep*0.45)};
    }
    case DEF_ROLE.RECOVER:  // 자기 수비 위치로 전력 복귀
      return {x:a._recover?a._recover.x:anchor.x, y:a._recover?a._recover.y:anchor.y};
    case DEF_ROLE.COVER_WIDE: { // 풀백이 비운 측면을 메운다 (자기 자리와 그 공간의 중간)
      const c=a._coverAt||anchor;
      return {x:clamp01(anchor.x*0.35+c.x*0.65), y:clamp01(anchor.y*0.35+c.y*0.65)};
    }
    case DEF_ROLE.COVER: {
      // 동료가 압박하러 나갔으면 그 "대각선 뒤"를 지킨다 — 뚫렸을 때 받아줄 자리다.
      if(a._coverBehind){
        const pb=a._coverBehind;
        const ang=Math.atan2(0.5-pb.y, (ownGoalX-pb.x)*PITCH_AR);   // 압박 지점 → 우리 골문 방향
        const back=0.075;                                            // 그만큼 뒤로 (약 5m)
        return {x:clamp01(pb.x+Math.cos(ang)*back/PITCH_AR),
                y:clamp01(pb.y+Math.sin(ang)*back)};
      }
      {
        let cx=goalSideX(anchor, ball, dir, 0.22, 0.090+blockDepth(ball,dir)*0.030);
        let cy=clamp01(anchor.y+(ball.y-anchor.y)*compactY(ball,dir,0.25));
        if(a._zoneMark){ const m=a._zoneMark;
          cy=clamp01(cy+(m.y-cy)*CB_MARK_Y);
          const own=v=>dir>0?v:1-v, gX=dir>0?0.015:0.985;
          const want=Math.max(own(gX)+0.020, own(m.x)-CB_MARK_GOALSIDE);
          const cur=own(cx);
          const mx=cur*(1-CB_MARK_X)+Math.min(cur,want)*CB_MARK_X;
          cx=clamp01(dir>0?mx:1-mx);
        }
        return {x:cx, y:cy};
      }
    }
    case DEF_ROLE.LINE:
    default: {
      const dpL=blockDepth(ball,dir);
      let tx=goalSideX(anchor, ball, dir, 0.14, 0.058+dpL*0.028);
      // 센터백끼리 깊이를 맞춰 일자 라인을 만든다
      if(a._lineOwnX!=null){
        const own = v => dir>0 ? v : 1-v;
        // 조직력이 낮으면 라인이 따로 논다 — 센터백끼리 깊이를 맞추는 정도를 그만큼 깎는다
        const sync = clamp(LINE_SYNC*(1+(a.teamFamK||0)*0.22), 0.20, 0.80);
        const merged = own(tx)*(1-sync) + a._lineOwnX*sync;
        tx = clamp01(dir>0 ? merged : 1-merged);
      }
      let ty=clamp01(anchor.y+(ball.y-anchor.y)*compactY(ball,dir,0.30));
      // 내 구역에 들어온 공격수를 잡는다 — 라인 깊이는 그대로 두고 좌우로만 붙는다.
      // 이게 없으면 센터백 둘은 각자 전술 자리에 서 있고, 그 사이가 통째로 비어 있다.
      if(a._zoneMark){
        const m=a._zoneMark;
        ty = clamp01(ty + (m.y-ty)*CB_MARK_Y);
        // 등 뒤로 빠지지 않게 골사이드로 조금 더 — 다만 라인이 무너지지 않을 만큼만
        const own = v => dir>0 ? v : 1-v;
        const goalX = dir>0 ? 0.015 : 0.985;
        const want = Math.max(own(goalX)+0.020, own(m.x)-CB_MARK_GOALSIDE);
        const cur=own(tx);
        const mx = cur*(1-CB_MARK_X) + Math.min(cur, want)*CB_MARK_X;
        tx = clamp01(dir>0 ? mx : 1-mx);
      }
      return {x:tx, y:ty};
    }
  }
  return {x:goalSideX(anchor, ball, dir, 0.14, 0.058), y:clamp01(anchor.y+(ball.y-anchor.y)*compactY(ball,dir,0.30))};
}
/* 볼이 우리 골문에 얼마나 가까운가 — 0(중원) ~ 1(박스 앞). 수축 정도를 정한다. */

function blockDepth(ball, dir){
  const own = dir>0 ? ball.x : 1-ball.x;
  return clamp01((0.34-own)/0.34);
}
/* 볼이 우리 진영 깊숙이 들어올수록 수비진은 좌우로도 볼 쪽으로 좁혀 선다.
   평소 넓게 벌려 있던 백라인이 박스 앞에서는 골문 폭으로 모이는 것과 같다. */

function compactY(ball, dir, base){
  const own = dir>0 ? ball.x : 1-ball.x;
  const deep = clamp01((0.30-own)/0.30);        // 0(중원) ~ 1(골문 앞)
  return base + (COMPACT_MAX-base)*deep;
}
/* 수비 라인의 깊이.
   평소에는 전술 라인(anchor)을 유지하며 볼 쪽으로 조금 당겨지지만, 볼이 우리 진영 깊숙이 들어오면
   "볼보다 골문 쪽"으로 내려선다. 이게 없으면 공격수가 골문 앞까지 아무 저항 없이 몰고 들어간다.
   own() 은 자기 골문을 0으로 놓고 본 좌표라, 값이 작을수록 우리 골문에 가깝다. */

function goalSideX(anchor, ball, dir, pull, margin){
  const own = v => dir>0 ? v : 1-v;
  const ballOwn=own(ball.x), anchorOwn=own(anchor.x);
  let x = anchorOwn + (ballOwn-anchorOwn)*pull;
  if(ballOwn < anchorOwn + 0.12){                       // 볼이 라인 근처까지 넘어왔다
    x = Math.min(x, Math.max(0.030, ballOwn - margin)); // 볼과 골문 사이로 내려선다
  }
  return clamp01(dir>0 ? x : 1-x);
}
/* 90분 연속 시뮬레이터 */
/* ── 세부 능력치 → 매치엔진 스킬 ──────────────────────────────────
   FM 설명대로, 각 능력치가 혼자 작동하지 않고 서로를 보정한다.
   여기가 유일한 변환 지점이라 엔진 나머지는 손대지 않아도 된다. */

function W(a, spec, fb){        // 가중 평균 (spec: {key:weight})
  let s=0, w=0;
  for(const k in spec){ const v=(a&&typeof a[k]==="number")?a[k]:fb; s+=v*spec[k]; w+=spec[k]; }
  return w? s/w : fb;
}
/* 능숙도가 낮으면 그 자리에서 제 기량이 안 나온다 — FM처럼 "능력치가 깎이는" 게 아니라
   판단·위치선정처럼 자리 이해가 필요한 쪽이 크게, 순수 신체 능력은 거의 안 깎인다. */

function applyFamiliarity(sk, fam, p, slot){
  const f=clamp(fam/100, 0, 1);
  const g=Math.pow(f, 1/FAM_CURVE);        // 능숙도가 낮은 구간에서 훨씬 빠르게 나빠진다
  const band=(p&&slot)?bandGapPenalty(p, slot):1;
  const heavy=(1 - (1-g)*FAM_PEN_HEAVY)*band;   // 자리 이해가 필요한 것
  const light=(1 - (1-g)*FAM_PEN_LIGHT)*(0.55+band*0.45);  // 몸으로 하는 것 — 덜하지만 영향은 받는다
  for(const k of ["posSkill","decSkill","offTiming","markSkill","passSkill","crossSkill","teamwork"]) if(sk[k]!==undefined) sk[k]*=heavy;
  for(const k of ["finSkill","lngSkill","dribSkill","firstTouch","headSkill","tackleSkill"]) if(sk[k]!==undefined) sk[k]*=light;
  // 어색한 자리에 선 선수는 있어야 할 곳에 없다 — 활동량·대담성도 흔들린다
  if(sk.workRate!==undefined) sk.workRate*=(0.7+heavy*0.3);
  if(sk.bravery!==undefined)  sk.bravery *=(0.75+band*0.25);
  sk.familiarity=f; sk.bandK=band;
  return sk;
}
/* 팀 전술 적응도(조직력)를 경기용 능력치에 얹는다.
   개인의 포지션 능숙도(applyFamiliarity)와는 다른 층이다 — 저쪽은 "이 선수가 이 자리를 아는가",
   이쪽은 "열한 명이 서로의 움직임을 아는가"다. 그래서 패스·판단·위치선정처럼
   동료를 전제로 하는 것만 건드리고, 개인기·슈팅·몸싸움은 손대지 않는다. */

const TFAM_PASS=0.10, TFAM_DEC=0.12, TFAM_POS=0.10, TFAM_TEAM=0.15;

function applyTeamFam(sk, k){
  sk.teamFamK=k||0;
  if(!k) return sk;
  if(sk.passSkill!=null)  sk.passSkill  = clamp(sk.passSkill *(1+k*TFAM_PASS), 0.15, 1);
  if(sk.decSkill!=null)   sk.decSkill   = clamp(sk.decSkill  *(1+k*TFAM_DEC),  0.15, 1);
  if(sk.posSkill!=null)   sk.posSkill   = clamp(sk.posSkill  *(1+k*TFAM_POS),  0.15, 1);
  if(sk.teamwork!=null)   sk.teamwork   = clamp(sk.teamwork  *(1+k*TFAM_TEAM), 0.15, 1);
  if(sk.offTiming!=null)  sk.offTiming  = clamp(sk.offTiming *(1+k*TFAM_DEC),  0.15, 1);
  return sk;
}
/* ── 체격 보정 ────────────────────────────────────────────────
   FM 원칙 그대로: 능력치가 먼저고 체격은 그 위에 얹는 보정이다(±12% 안쪽).
   키 194cm 센터백은 같은 헤딩 능력치라도 공중볼을 더 잘 따내고,
   체중 88kg 스트라이커는 등지고 버티는 힘이 세지만 방향 전환이 굼뜨다. */

const BODY_REF_H=178, BODY_REF_W=74;

function bodyFx(p){
  const h=(p&&p.h)||BODY_REF_H, w=(p&&p.w)||BODY_REF_W;
  const tall=clamp((h-BODY_REF_H)/20, -1.3, 1.3);
  const bmi=w/Math.pow(h/100,2);                       // 대개 21~26
  const mass=clamp((bmi-22.6)/2.4, -1.3, 1.3);         // 마른 체형 ~ 다부진 체형
  const bulk=clamp(tall*0.40+mass*0.80, -1.3, 1.3);    // 순수 덩치
  return {
    tall, mass, bulk,
    head: 1 + tall*0.11 + mass*0.03,                   // 공중볼 — 8할이 키
    str:  1 + mass*0.12 + tall*0.04,                   // 몸싸움 — 8할이 체중
    agi:  1 - bulk*0.085,                              // 덩치가 클수록 방향 전환이 느리다
    pace: 1 - Math.max(0,mass)*0.05 + Math.max(0,-mass)*0.02
  };
}
/* ── 포지션 능숙도 페널티 ────────────────────────────────────
   예전에는 능숙도 0이어도 판단·위치선정이 30%만 깎였다. 그래서 골키퍼를 최전방에 세우고
   전원을 엉뚱한 자리에 놓아도 경기가 비슷하게 흘러갔다. FM에서는 그러면 경기가 무너진다.
   지금은 (1) 능숙도 자체의 페널티를 크게 키우고,
        (2) 원래 라인(수비/미드/공격/골키퍼)과 다른 자리에 세우면 별도 페널티를 한 겹 더 얹는다. */

const FAM_PEN_HEAVY=0.58;   // 능숙도 0 일 때 판단·위치선정이 58% 깎인다

const FAM_PEN_LIGHT=0.26;

const FAM_CURVE=1.45;       // 낮은 구간일수록 급격히 나빠진다 (50이면 절반이 아니라 그 이상 손해)
/* 라인 자체가 다를 때의 추가 페널티 — 수비수를 최전방에, 골키퍼를 필드에 세우는 경우 */

const BAND_ORDER={GK:0, SW:1, DF:1, WB:1.6, DM:2.2, MF:2.6, AM:3.2, FW:4};

const OUTBAND_PEN=0.13;     // 라인 한 칸 어긋날 때마다

const GK_MISUSE=0.42;       // 골키퍼를 필드에 / 필드 선수를 골문에 세웠을 때

function bandGapPenalty(p, slot){
  // SLOT_BAND 에는 GK 밴드가 없다(필드 슬롯만 담긴다). 골키퍼는 따로 판정한다.
  const isGkSlot = slot==="GK";
  const isGkPlayer = p.pos==="GK";
  if(isGkSlot !== isGkPlayer) return 1-GK_MISUSE;       // 키퍼를 필드에 / 필드 선수를 골문에
  if(isGkSlot) return 1;
  const nb=BAND_ORDER[SLOT_BAND[prefSlotOf(p)]];
  const sb=BAND_ORDER[SLOT_BAND[slot]];
  if(nb===undefined || sb===undefined) return 1;
  return 1 - Math.min(0.55, Math.abs(nb-sb)*OUTBAND_PEN);
}

function matchSkills(p){
  const a=p.attr||{}, fb=p.ovr||65, g=p.gkA||null;
  const B=bodyFx(p);
  // 하한 0.25는 너무 후했다 — 어떤 선수든 최소 4분의 1은 하고 봤다는 뜻이라
  // 실력 차이가 화면에서 지워졌다. 진짜 못하는 선수는 진짜 못해야 한다.
  // 여기에 완만한 감마(1.16)를 얹어 중상위 구간의 차이를 조금 더 벌린다 —
  // 좋은 선수를 데려왔을 때 그 값어치가 화면에서 느껴져야 한다.
  const S=(x)=>clamp(Math.pow(clamp(x,0,100)/100, 1.16), 0.11, 1);
  return {
    body:B,
    // 패스 — 시야가 기회를 발견하고, 개인기가 실행 퀄리티를 결정한다
    passSkill:  S(W(a,{pas:0.55, vis:0.25, tec:0.20}, fb)),
    // 태클 — 파울 없이 끊는 능력. 예측력·적극성이 타이밍을 만든다
    tackleSkill:S(W(a,{tck:0.60, ant:0.20, agg:0.10, str:0.10}, fb)),
    // 드리블 — 순수 드리블에 주력·가속도·민첩성·균형이 실린다
    dribSkill:  S(W(a,{dri:0.45, tec:0.15, agi:0.15, bal:0.13, acc:0.07, pac:0.05}, fb)*B.agi),
    // 민첩성 — 좁은 공간에서 몸을 트는 능력. 덩치가 크면 깎인다.
    agility:    S(W(a,{agi:0.52, bal:0.28, acc:0.20}, fb)*B.agi),
    // 헤더 — 점프력과 신장, 몸싸움(덜 중요). 실제 신장이 여기에 직접 실린다.
    headSkill:  S(W(a,{hea:0.55, jum:0.28, str:0.10, bra:0.07}, fb)*B.head),
    // 침투 타이밍 — 오프더볼과 예측력
    offTiming:  S(W(a,{otb:0.55, ant:0.30, dec:0.15}, fb)),
    // 크로스 — 크로스 능력치에 개인기·시야
    crossSkill: S(W(a,{crs:0.62, tec:0.20, vis:0.18}, fb)),
    // 골 결정력 — 침착성과 판단력이 꾸준함을 만든다
    finSkill:   S(W(a,{fin:0.58, cmp:0.24, dec:0.18}, fb)),
    // 중거리 — 대체로 독립적이되 천재성이 시도를 늘린다
    lngSkill:   S(W(a,{lon:0.72, tec:0.16, fla:0.12}, fb)),
    // 골키퍼 — 반사신경·일대일·핸들링
    gkSkill:    g ? S(W(g,{ref:0.42, one:0.28, han:0.20, cmd:0.10}, fb)) : S(fb*0.6),
    // 주력 — 최고 속도(가속도와 함께). 옛 호출부가 쓰는 종합 스피드 지표.
    paceSkill:  S(W(a,{pac:0.55, acc:0.35, sta:0.10}, fb)*B.pace),
    // 최고 속도 — 30m를 달릴 때. 주력이 지배하고, 체중이 무거우면 깎인다.
    topSpeed:   S(W(a,{pac:0.76, acc:0.14, sta:0.10}, fb)*B.pace),
    // 가속도 — 첫 5m. 세컨볼·압박 도달·돌파 직후 이탈이 전부 여기서 갈린다.
    accelSkill: S(W(a,{acc:0.72, agi:0.16, bal:0.12}, fb)*B.agi),
    // 몸싸움 — 힘과 균형. 실제 체중이 여기에 직접 실린다.
    strength:   S(W(a,{str:0.62, bal:0.23, agg:0.15}, fb)*B.str),
    // 위치 선정(수비) — 위치선정·예측력·집중력
    posSkill:   S(W(a,{pos:0.50, ant:0.28, cnt:0.22}, fb)),
    // 판단력 — 낮으면 멈칫한다
    decSkill:   S(W(a,{dec:0.55, cnt:0.25, cmp:0.20}, fb)),
    // ── 새로 추가되는 축들 ─────────────────────────
    // 퍼스트 터치 — 낮으면 압박에서 볼을 흘린다
    firstTouch: S(W(a,{fir:0.65, tec:0.20, cmp:0.15}, fb)),
    // 대인마크 — 몸싸움·위치선정·예측력이 효율을 정한다
    markSkill:  S(W(a,{mar:0.50, pos:0.20, ant:0.18, str:0.12}, fb)),
    // 천재성 — 위험한 플레이(돌파·중거리·과감한 패스) 성향
    flair:      S(W(a,{fla:0.75, tec:0.25}, fb)),
    // 활동량 — 있어야 할 곳에 있는 능력. 수비 복귀·압박 참여 빈도
    workRate:   S(W(a,{wor:0.60, sta:0.25, tea:0.15}, fb)),
    // 대담성 — 50:50 경합에 몸을 던지는 빈도
    bravery:    S(W(a,{bra:0.70, det:0.30}, fb)),
    // 팀워크 — 전술을 따를지, 제멋대로 할지
    teamwork:   S(W(a,{tea:0.75, wor:0.25}, fb)),
    // 리더십 — 경기 중 동료를 다잡는 힘. 팀에서 가장 높은 한 명이 전체를 끌어올린다.
    leadership: S(W(a,{ldr:0.70, det:0.18, cmp:0.12}, fb)),
    // 타고난 체력 — 같은 90분을 뛰어도 덜 지친다
    natFit:     S(W(a,{nat:0.65, sta:0.35}, fb)),
    // 세트피스
    setPiece:   S(W(a,{cor:0.5, fre:0.5}, fb)),
    penSkill:   S(W(a,{pen:0.70, cmp:0.30}, fb)),
    // 직접 프리킥 — 감아 넘기는 기술이 8할이고, 나머지는 발재간과 침착함
    fkSkill:    S(W(a,{fre:0.72, tec:0.16, cmp:0.12}, fb)),
    throwLong:  S(W(a,{thr:1}, fb)),
    // 골키퍼 성향 (기행·돌진·펀칭 빈도)
    gkRush:     g ? S(W(g,{tro:0.6, cmd:0.4}, fb)) : 0.5,
    gkPunch:    g ? S(W(g,{pun:0.7, han:0.3}, fb)) : 0.5,
    gkKick:     g ? S(W(g,{kic:0.7}, fb)) : 0.5,
    // 공중볼 처리 — 박스로 떨어지는 크로스를 직접 나와서 잡거나 쳐낸다
    gkAerial:   g ? S(W(g,{aer:0.66, cmd:0.22, han:0.12}, fb)) : 0.5,
    // 수비 조율 — 뒤에서 라인을 세우고 자리를 잡아 준다. 수비수의 위치 오차를 줄인다.
    gkOrganize: g ? S(W(g,{com:0.66, cmd:0.34}, fb)) : 0.5,
    // 스위퍼 성향 — 기행(박스 밖으로 나가는 성향) + 돌진 빈도 + 박스 장악력 + 발 기술.
    // 노이어형 키퍼는 이 값이 높아 빌드업 때 아예 박스 밖에 서 있는다.
    sweepAbility: g ? S(W(g,{ecc:0.32, tro:0.28, cmd:0.22, kic:0.18}, fb)*
                        (0.75+((p.attr&&p.attr.pas)||60)/100*0.35)) : 0.4,
    // 선호 플레이 — 능력치를 더 주는 게 아니라 "선택"을 바꾼다
    tr: traitFx(p.traits)
  };
}
/* 순간 전력질주를 건다 — 쿨타임이 남아 있으면 그냥 뛴다 */

class MatchSim{
  constructor(M, opts){
    this.M=M; this.opts=opts||{};
    // 실제 경기로 쓸 때만 M에 기록하고 해설을 낸다. 관전용 시뮬에서는 끈다(세이브를 건드리면 안 되므로).
    this.emitEvents=!!this.opts.live;
    this.lastAssist=null;
    try{ simPick=null; }catch(e){}   // 이전 경기에서 클릭해 둔 선수 선택(금색 링)이 새 경기로 넘어오지 않게
    this.halfDone=false;
    /* ⚠ 후반에 골문을 바꿔 선 상태인지. 이 값이 없어서 교체만 하면 전반 진영으로 되돌아갔다. */
    this.ends=0;
    // 하이라이트 녹화 — 실제 경기에서만 켠다
    this.recording=!!this.opts.live;
    this.buf=[]; this.hl=null; this.caps=[];
    this.pendingOff=null;   // 늦게 올라갈 수 있는 오프사이드 깃발
    this.t=0;
    this.agents=[];
    this.buildSquads();
    /* 🧑‍⚖️ 오늘의 심판 — 주심 성향이 카드 판정에, 감독-심판 관계가 유저 팀 판정에 작용한다 */
    try{
      this.refCrew=refCrewOf(M);
      const RK={strict:1.28, calm:0.84, proud:1.08, vet:0.92, rookie:1.14};
      this.refStrict=RK[(this.refCrew.main.t||{}).k]||1;
    }catch(e){ this.refCrew=null; this.refStrict=1; }
    this.stats={
      h:this.blankStat(), a:this.blankStat(),
      thirds:{def:0, mid:0, att:0}, ticks:0
    };
    this.ball={x:0.5, y:0.5, z:0, vx:0, vy:0, vz:0, inNet:false, bounced:0,
               ownerId:null, state:"SETTLED", fromId:null, toId:null,
               tx:0.5, ty:0.5, flight:0, flightLen:0, hold:0};
    this.score={h:0, a:0};
    this.matchState=MATCH_STATE.PLAYING;
    this.ref={x:0.5, y:0.40};          // 주심 — 볼을 따라다니되 거리를 둔다
    this.sentOff=[];                   // 퇴장 기록
    this.firstKickSide="h"; this._endsSwapped=false;
    this.kickoff("h");
  }
  blankStat(){ return {pass:0, passOk:0, fwd:0, lat:0, back:0, intercept:0, lost:0, poss:0, passLen:0, longPass:0,
                       tackle:0, tackleWon:0, slide:0, slideWon:0, foul:0, aerial:0, aerialWon:0, offside:0,
                       throwIn:0, corner:0, goalKick:0, freeKick:0,
                       pen:0, penGoal:0, penSaved:0, penMiss:0, goalDisallowed:0, injury:0, fkDirect:0, fkGoal:0, wallBlock:0,
                       cross:0, crossOk:0, crossEarly:0, crossByline:0, crossCutback:0,
                       toSpace:0, powerSum:0, crossFloat:0, crossDriven:0,
                       shot:0, shotOn:0, shotOff:0, shotBlocked:0, shotSaved:0, shotCaught:0, shotParried:0,
                       shotHeader:0, shotVolley:0, shotFinesse:0, shotChip:0, shotPower:0, shotPlaced:0,
                       shotClose:0, shotNormal:0, shotLong:0,
                       goal:0, goalDeflected:0, block:0, save:0, deflect:0, crossBlocked:0,
                       shotPunched:0, shotTipped:0, superSave:0, woodwork:0,
                       takeOn:0, takeOnWon:0, clearance:0, shortPass:0, longPassT:0, yellow:0, red:0, verbal:0, jostle:0}; }
  /* ── 기록 브리지 ────────────────────────────────────────────────
     MatchSim은 원래 "구경거리"였다. 실제 경기로 쓰려면 시즌 시스템이 읽는 M 객체
     (M.hg/ag, M.st, M.events, 선수별 골·도움·카드)에 결과를 그대로 적어 넣어야 한다.
     그래야 applyMatchResult·평점·득점왕·뉴스·라커룸이 전부 손대지 않고 돌아간다. */
  rec(side){ return side==="h" ? this.M.h : this.M.a; }
  /* 에이전트 → M.list 항목. 골·카드는 이 항목에 쌓인다. */
  entryOf(agent){
    if(!agent) return null;
    const sd=this.rec(agent.side);
    return sd.list.find(x=>x.p===agent.p) || null;
  }
  /* 경기 시계를 M에 맞춘다 — 해설 줄의 시간 배지가 여기서 나온다 */
  syncClock(){
    const m=Math.floor(this.clock/60);
    this.M.min=clamp(m, 0, 999);
    this.M.half = this.clock < SIM_SECONDS/2 ? 1 : 2;
  }
  /* 해설 한 줄 — 기존 COMM 템플릿을 그대로 쓴다.
     각 줄에 "시뮬 시각"을 박아 둔다 — 하이라이트를 되감아 재생할 때
     화면보다 해설이 앞서 나가 결과를 미리 알려 버리지 않게 하기 위해서다. */
  say(side, txt, type, scene){
    if(!this.M || !this.emitEvents) return;
    this.syncClock();
    ev(this.M, side?this.rec(side):null, txt, type||"txt", false, scene||null);
    const e=this.M.events[this.M.events.length-1];
    if(e) e.simT=this.t;
  }
  /* ── 하이라이트 녹화 ──────────────────────────────────────────
     FM처럼 "빌드업부터 결말까지" 되감아 보여주려면, 결정적 장면이 터진 뒤에
     그 앞 장면을 알고 있어야 한다. 그래서 매 틱 좌표를 링버퍼에 남겨 둔다. */
  /* ── 실시간 해설 자막 녹음 ────────────────────────────────────
     화면 하단 패널에 흐를 문장이다. 문자중계 로그(M.events)와는 완전히 별개로,
     하이라이트로 잘려 나갈 구간만 쓰이고 시즌 기록에는 남지 않는다.
     프레임과 같은 링버퍼 방식이라 "되감아 보여주기"가 그대로 성립한다. */
  cap(side, pool, vars){
    if(!this.recording || !pool) return;
    this.caps.push({t:this.t, side, txt:F_(pool, vars||{})});
    if(this.caps.length>HL_CAP_MAX) this.caps.shift();
  }
  nm(a){ return a && a.p ? a.p.name : "선수"; }
  /* 오프사이드로 취소된 골.
     공은 이미 그물에 들어갔고 선수들은 환호하고 있다 — 그 뒤에 깃발이 올라간다.
     점수·득점 기록은 애초에 올리지 않는다(되돌리는 것보다 안전하다). */
  disallowGoal(side, sh){
    const b=this.ball, off=this.pendingOff;
    this.pendingOff=null;
    const st=this.stats[side];
    st.goalDisallowed=(st.goalDisallowed||0)+1;
    st.offside++;
    const sc=this.byId(sh.shooterId), nm=this.nm(sc);
    b.inNet=true; b.vx*=0.55; b.vy*=0.55; b.vz*=0.35; b.ownerId=null;
    // 짧은 환호 뒤 취소 — 세리머니 객체에 표시를 달아 재개 방식을 바꾼다
    b.celebrate={t:0, side, oKey:this.opp(side), scorerId:sh.shooterId,
                 disallowed:true, offSpot:{x:off.x, y:off.y, by:off.by}};
    this.lastEvent={kind:"GOAL_OFF", side, t:this.t};
    this.markHighlight("goal", side, HL_W.goal);
    if(this.emitEvents){
      this.syncClock();
      this.say(side, F_(COMM.goalOffText,{p:nm}), "big", {kind:"sim_goaloff", side});
      // 자막 — 환호했다가 깃발이 올라가는 순서 그대로
      this.cap(side, COMM.lvGoalLive, {p:nm});
      const t0=this.t;
      const push=(dt, arr, vars)=>{ this.caps.push({t:t0+dt, side, txt:F_(arr, vars||{})});
        if(this.caps.length>HL_CAP_MAX) this.caps.shift(); };
      push(1.4, COMM.lvOffFlag, {});
      push(3.0, COMM.lvOffCancel, {p:nm});
      push(5.0, COMM.lvOffAfter, {});
    }
  }
  /* 골 해설 — 어떤 골이었는지에 따라 첫 마디가 달라지고, 세리머니 동안 리액션이 이어진다.
     "그냥 골입니다"만 반복되면 어떤 골이었는지 화면을 봐도 기억에 남지 않는다. */
  goalCommentary(side, sh){
    if(!this.recording) return;
    const sc=this.byId(sh.shooterId), nm=this.nm(sc);
    // 첫 마디 — 슛의 종류·거리·상황으로 고른다
    let pool;
    if(sh.isPen)                      pool=COMM.gPen;
    else if(sh.isFK)                  pool=COMM.gFK;
    else if(sh.type===SHOT_TYPE.HEADER) pool=COMM.gHeader;
    else if(sh.type===SHOT_TYPE.VOLLEY) pool=COMM.gVolley;
    else if(sh.type===SHOT_TYPE.CHIP)   pool=COMM.gChip;
    else if(sh.distM>=23)             pool=COMM.gLong;
    else if(sh.solo)                  pool=COMM.gSolo;
    else if(sh.distM<7)               pool=COMM.gTap;
    else if(sh.type===SHOT_TYPE.FINESSE) pool=COMM.gFinesse;
    else if(sh.type===SHOT_TYPE.POWER)   pool=COMM.gPower;
    else                              pool=COMM.lvGoalLive;
    this.cap(side, pool, {p:nm});
    // 세리머니 리액션 — 시간차를 두고 이어 붙인다. 재생헤드가 지나갈 때마다 한 줄씩 뜬다.
    const t0=this.t;
    const push=(dt, arr, vars)=>{
      this.caps.push({t:t0+dt, side, txt:F_(arr, vars||{})});
      if(this.caps.length>HL_CAP_MAX) this.caps.shift();
    };
    push(1.6, COMM.celA, {p:nm});
    // 막기 어려운 골이었으면 골키퍼를 언급한다
    if(sh.type===SHOT_TYPE.FINESSE || sh.type===SHOT_TYPE.POWER || sh.distM>=23 || sh.type===SHOT_TYPE.CHIP)
      push(3.4, COMM.celKeeper, {});
    else push(3.4, COMM.celA, {p:nm});
    const M=this.M;
    if(M) push(5.2, COMM.celScore, {t:this.rec(side).team.short, h:M.hg, a:M.ag});
    /* ⚠ 예전에는 스코어와 무관하게 "승부를 원점으로 돌립니다!"가 섞여 나왔다.
       3-1로 달아나는 골에도 그 대사가 나오니 중계가 엉뚱해졌다. 지금 스코어를 보고 고른다. */
    if(M){
      const my = side==="h" ? M.hg : M.ag, op = side==="h" ? M.ag : M.hg;
      const d=my-op;
      const pool = d===0 ? COMM.celEqual
                 : d===1 && op>0 ? COMM.celLead      // 역전골(직전까지 뒤졌거나 동점)
                 : d>=3 ? COMM.celRout
                 : d>0 ? COMM.celExtra
                 : COMM.celChase;                     // 지고 있는데 따라붙는 골
      push(7.0, pool, {t:this.rec(side).team.short, h:M.hg, a:M.ag});
    }
  }
  recordFrame(){
    if(!this.recording) return;
    const a=new Array(this.agents.length);
    for(let i=0;i<this.agents.length;i++){
      const g=this.agents[i];
      a[i]={id:g.id, x:g.x, y:g.y, face:g.face};
    }
    const b=this.ball, rf=this.ref;
    // 세리머니 상태를 프레임에 새긴다 — 하이라이트를 되감아 볼 때 "공이 언제 들어갔는지"를
    // 그 프레임만 보고 알 수 있어야 득점자 패널이 미리 뜨지 않는다.
    const cel=b.celebrate;
    const cg = cel ? {s:cel.side, id:cel.scorerId, t:+cel.t.toFixed(2),
                      dis:!!cel.disallowed, own:!!cel.own, vc:!!cel.varCheck} : null;
    // ⚠ 심판도 함께 기록해야 한다. 예전에는 빠져 있어서, 하이라이트가 재생되는 동안
    //    화면의 심판만 실시간 위치(=멈춰 있는 값)에 그대로 남아 "심판이 안 움직인다"로 보였다.
    this.buf.push({t:this.t, clock:this.clock, bx:b.x, by:b.y, bz:b.z, st:this.matchState, a,
                   oi:b.ownerId||0,                                   // 이 순간의 볼 소유자 — 재생 때 흰 링이 이걸 따른다
                   rx:rf?rf.x:0.5, ry:rf?rf.y:0.4, cg});
    if(this.buf.length>HL_BUF_MAX) this.buf.shift();
  }
  /* 결정적 장면 표시 — 이 순간을 중심으로 앞뒤를 잘라 하이라이트로 만든다 */
  markHighlight(kind, side, weight){
    if(!this.recording) return;
    // 이미 같은 장면을 잡아 뒀다면 더 중요한 쪽으로 갱신한다 (슛 → 골로 승격)
    if(this.hl && (weight||1) <= this.hl.weight) return;
    this.hl={kind, side, weight:weight||1, t:this.t, at:this.buf.length-1};
  }
  /* 진행 중인 통계를 M.st 에 반영 — 경기 화면의 슈팅·점유율 표가 이걸 읽는다 */
  syncStats(){
    const st=this.M.st, H=this.stats.h, A=this.stats.a;
    st.hS=H.shot; st.aS=A.shot;
    // 유효슈팅 — resolveShot 이 골·선방을 가르기 전에 이미 shotOn 을 올리므로 골이 포함돼 있다.
    // 여기서 골을 다시 더하면 이중 계산이 된다.
    st.hT=H.shotOn; st.aT=A.shotOn;
    st.hF=H.foul; st.aF=A.foul;
    st.hC=H.corner; st.aC=A.corner;
    st.hY=H.yellow; st.aY=A.yellow;
    st.hR=H.red;   st.aR=A.red;
    // 점유율 — 연속 엔진은 매 틱 "누가 공을 갖고 있나"를 세고 있다.
    // 이걸 넘겨주지 않으면 화면은 M.rates(분 단위 엔진용 추정치)로 되돌아가 늘 50:50이 된다.
    st.hP=H.poss; st.aP=A.poss;
  }
  /* 득점 기록 — 점수판, 득점자, 도움, 해설 한 줄까지 한 번에 처리한다.
     도움은 "같은 팀의 마지막 패스"다. 다만 시간이 너무 지났거나(혼전 뒤 개인 돌파),
     본인이 스스로 몰고 들어간 경우에는 도움을 주지 않는다 — 실제 기록 규칙과 같다. */
  /* 실점 직후 흥분한 다혈질 선수의 항의 카드 — 분 단위 엔진(maybeDissentCard)의 2D 판.
     경고가 이미 있는 다혈질은 특히 위험하다. 퇴장까지 가면 팀이 열 명으로 남은 경기를 뛴다. */
  maybeDissentSim(concededSide){
    if(!this.emitEvents) return;
    const cands=this.side(concededSide).filter(a=>a.slot!=="GK" && a.p && a.p.pers===3);
    if(!cands.length) return;
    const f=cands[Math.floor(RNG()*cands.length)];
    const already=(f.yellows||0)>=1;
    const chance=(already?0.09:0.045)*this.refCardK(concededSide);
    if(RNG()>=chance) return;
    const st=this.stats[f.side], nm=f.p?f.p.name:"선수";
    const rv=refVars(this.M);
    if(already || RNG()<0.25){
      /* 퇴장 — 누적이거나 도를 넘었다 */
      const second=already;
      if(f.p){ f.p.ban=Math.max(f.p.ban||0, banMatches(second)); f.p.banNew=1; }
      st.red++;
      this.markHighlight("red", f.side, HL_W.red);
      this.sentOff.push({id:f.id, side:f.side, t:this.t, name:nm});
      this.agents=this.agents.filter(a=>a.id!==f.id);
      const fx=this.entryOf(f);
      if(fx){ fx.red=true; fx.off=Math.floor(this.clock/60); }
      const sd = f.side==="h" ? this.M.h : this.M.a;
      if(sd){ sd.red=(sd.red||0)+1; }
      this.syncClock();
      this.say(f.side, F_(second?COMM.dissentSecond:COMM.dissentRed, Object.assign({p:nm}, rv)), "big", {kind:"card_red", side:f.side, playerId:f.id});
      /* 퇴장으로 7명 미만 — 몰수 판정은 기존 레드카드 경로와 같은 검사를 태운다 */
      if(this.side(f.side).length<7){
        const isH=f.side==="h";
        const oppLead = isH ? (this.M.ag-this.M.hg) : (this.M.hg-this.M.ag);
        if(oppLead<3){ if(isH){ this.M.hg=0; this.M.ag=3; } else { this.M.hg=3; this.M.ag=0; } }
        this.M.forfeit={side:f.side, team:sd?sd.team.short:""};
        this.syncStats(); this.M.half=2; this.M.done=true;
        this.say(null, `🚫 몰수패! 인원 미달 — 경기 중단. 최종 ${this.M.home.short} ${this.M.hg} : ${this.M.ag} ${this.M.away.short}`, "big", {kind:"ft"});
      }
    } else {
      f.yellows=(f.yellows||0)+1;
      st.yellow++;
      const fx=this.entryOf(f); if(fx) fx.y=(fx.y||0)+1;
      this.syncClock();
      this.say(f.side, F_(COMM.dissentYellow, Object.assign({p:nm}, rv)), "warn", {kind:"card_yellow", side:f.side, playerId:f.id});
    }
    this.syncStats();
  }
  recordGoal(side, sh){
    // ⚠ 관전용 시뮬(emitEvents=false)은 실제 선수 기록을 건드리면 안 된다.
    //    관전 화면도 진짜 팀 객체로 경기를 만들기 때문에, 이 가드가 없으면 구경만 해도 득점왕이 바뀐다.
    if(!this.M || !this.emitEvents) return;
    this.syncClock();
    if(side==="h") this.M.hg++; else this.M.ag++;
    const scorer=this.byId(sh.shooterId);
    const sx=this.entryOf(scorer);
    if(sx){ sx.goals++; if(sx.p) sx.p.goals=(sx.p.goals||0)+1; }
    /* 득점자 명단 — 결과창·리포트·해트트릭 기사에 쓴다 */
    if(!Array.isArray(this.M.sc)) this.M.sc=[];
    this.M.sc.push({n:scorer&&scorer.p?scorer.p.name:"?", side, min:this.M.min||Math.ceil(this.clock/60)||0});
    // 도움 — 마지막 패스가 같은 팀이고 8초 이내여야 인정
    let ax=null;
    const la=this.lastAssist;
    /* K리그 개정 규정 — 시간·터치 제한 없음. 마지막 패스가 유효(굴절 없음·소유 연속)하기만 하면
       득점자가 수비 몇 명을 제치고 얼마나 몰고 갔든 도움으로 인정한다.
       유효성은 lastAssist 의 생존 여부가 담보한다: 상대 터치·골대·리바운드가 끼면 이미 지워져 있다. */
    if(la && la.side===side && la.id!==sh.shooterId){
      const ap=this.byId(la.id);
      ax=this.entryOf(ap);
      if(ax){ ax.assists++; if(ax.p) ax.p.assists=(ax.p.assists||0)+1; }
    }
    /* ⚽/🅰️ 이름표 — 시작 시점은 공이 그물에 닿는 순간(celebrate 생성부)이 정한다. 여기서는 도움만 채운다 */
    if(this.goalTag && this.goalTag.sid===sh.shooterId) this.goalTag.aid=(ax&&la)?la.id:null;
    else this.goalTag={sid:sh.shooterId, aid:(ax&&la)?la.id:null, until:this.t+6};
    this.lastAssist=null;
    this.syncStats();
    if(this.emitEvents){
      const nm=scorer&&scorer.p?scorer.p.name:"선수";
      const txt = ax ? F_(COMM.goalA,{p:nm, a:ax.p.name}) : F_(COMM.goal,{p:nm});
      this.say(side, txt, "goal", {kind:"sim_goal", side, scorerId:sh.shooterId});
      try{ this.maybeDissentSim(this.opp(side)); }catch(e){}
    }
  }
  /* 경기 중 전술 변경을 시뮬에 반영한다.
     에이전트는 만들어질 때 슬롯·역할·앵커·능력치를 한 번 계산해 들고 있다. 그래서 감독이
     포메이션이나 역할을 바꿔도, 교체 카드를 써도, 그대로 두면 그라운드에서는 아무 일도 일어나지 않는다.
     ─ 위치는 건드리지 않는다. 지시가 바뀌면 선수가 순간이동하는 게 아니라 새 자리로 움직여 가는 것이 맞다. */
  resyncSquads(){
    const alive=new Set();
    for(const [key, sd] of [["h",this.M.h],["a",this.M.a]]){
      const xi=onPitch(sd).map(x=>x.p);
      const slotOf=computeRenderSlots(sd.team, xi);
      for(const x of onPitch(sd)){
        const slot = x.p.pos==="GK" ? "GK" : (slotOf[x.p.id]||"CM");
        /* ⚠ 여기서 isHome 을 홈/원정 키로만 다시 계산해서, 후반에 교체를 하면
           switchEnds() 로 뒤집어 둔 공격 방향이 통째로 전반 상태로 돌아갔다.
           (제보: "교체하면 후반 공격 진영이 전반이랑 같아진다")
           지금 진영 교대 상태(this.ends)를 반영해서 계산한다. */
        const isHome = (key==="h") !== !!this.ends;
        const anchor=tacticalAnchorXY(sd.team, slot, "DEF", isHome);
        alive.add(x.p.id);
        let a=this.agents.find(q=>q.id===x.p.id);
        if(!a){
          // 교체 투입 — 자기 포지션 자리에서 들어온다
          a={id:x.p.id, p:x.p, team:sd.team, side:key, slot, isHome, dir:isHome?1:-1,
             x:anchor.x, y:anchor.y, seed:(x.p.id*37)%100, spd:0, face:isHome?0:Math.PI};
          this.agents.push(a);
        }
        a.p=x.p; a.team=sd.team; a.side=key; a.slot=slot; a.isHome=isHome; a.dir=isHome?1:-1;
        a.role=roleFx(sd.team, x.p, slot);
        a.home={x:anchor.x, y:anchor.y};
        // 능력치도 다시 계산한다 — 자리가 바뀌면 포지션 능숙도 보정이 달라진다
        Object.assign(a, applyTeamFam(applyFamiliarity(matchSkills(x.p), getPosFam(x.p, slot), x.p, slot), famK(sd.team)));
        // 세트피스 배치·추격 상태는 지시가 바뀌었으니 풀어 준다
        a._spSpot=null; a._inWall=false; a._spHold=0; a._spot=null; a._smx=undefined; a._smy=undefined;
      }
    }
    // 교체 아웃·퇴장으로 그라운드를 떠난 선수는 뺀다
    this.agents=this.agents.filter(a=>alive.has(a.id));
    const b=this.ball;
    if(b.ownerId!=null && !alive.has(b.ownerId)) b.ownerId=null;   // 공 가진 선수가 나갔다면 놓고 간다
    if(b.toId!=null && !alive.has(b.toId)) b.toId=null;
  }
  /* ── 상대 감독의 경기 중 전술 변화 ─────────────────────────────
     AI 팀은 시즌 시작에 전술을 한 번 정하고 그대로 90분을 보냈다. 지고 있어도 그대로,
     이기고 있어도 그대로. 실제 감독은 시계와 점수를 보고 움직인다.
     ─ 여기서 바꾸는 건 성향·라인·압박 같은 "지시"뿐이다. 이 값들은 매 틱 팀 객체에서 다시 읽으므로
       따로 재동기화할 필요 없이 즉시 그라운드에 반영된다. */
  aiTacticCheck(){
    if(!this.emitEvents) return;                 // 실제 경기에서만
    const min=Math.floor(this.clock/60);
    if(min===this._aiMin) return; this._aiMin=min;
    if(min<55) return;                           // 후반 중반부터 움직인다
    for(const key of ["h","a"]){
      const sd=this.rec(key), t=sd.team;
      if(!t || t.isUser) continue;               // 유저 팀은 감독이 직접 지시한다
      if(this._aiAt && min-(this._aiAt[key]||-99) < 12) continue;   // 너무 자주 바꾸지 않는다
      const gd=(key==="h" ? this.M.hg-this.M.ag : this.M.ag-this.M.hg);
      const T=t.tactic; let want=null, msg=null;
      if(gd<=-1 && min>=75){                     // 지고 있고 시간이 없다 — 총공세
        want={mentality:4, line:4, press:4, tempo:4, counter:false};
        msg=`${t.short} 벤치가 움직입니다 — 라인을 끌어올려 총공세로 나섭니다!`;
      } else if(gd<=-1 && min>=58){              // 지고 있다 — 공격적으로
        want={mentality:3, line:Math.min(4,(T.line||2)+1), press:Math.min(4,(T.press||2)+1)};
        msg=`${t.short}, 공격적으로 전환합니다. 압박을 올립니다.`;
      } else if(gd>=2 && min>=78){               // 넉넉히 이기고 있다 — 잠근다
        want={mentality:0, line:0, press:1, counter:true};
        msg=`${t.short}, 완전히 내려앉습니다. 승부를 굳히려 합니다.`;
      } else if(gd>=1 && min>=70){               // 한 골 차 리드 — 실리로
        want={mentality:1, line:Math.max(0,(T.line||2)-1), counter:true};
        msg=`${t.short}, 무게중심을 뒤로 옮깁니다. 역습을 노립니다.`;
      }
      if(!want) continue;
      // 이미 그 상태면 굳이 바꾸지 않는다 (같은 해설이 반복되는 것도 막는다)
      let changed=false;
      for(const k in want) if(T[k]!==want[k]){ T[k]=want[k]; changed=true; }
      if(!changed) continue;
      if(!this._aiAt) this._aiAt={};
      this._aiAt[key]=min;
      noteTacticChange(sd.team, 0.35);
      this.say(key, "🎽 "+msg, "info");
      this.cap(key, [msg], {});
    }
  }
  /* ── 부상 ──────────────────────────────────────────────────────
     연속 엔진에는 부상이 아예 없었다(옛 분 단위 엔진에만 있었다). 90분 내내 아무도 다치지 않으면
     교체 카드도, 스쿼드 뎁스도 의미가 없어진다.
     ─ 거친 태클을 당했을 때와, 지쳐 있을 때 자연 발생하는 두 경로로 나눈다. */
  hurt(a, hard){
    if(!this.emitEvents || !a) return;          // 관전용 시뮬은 실제 선수 기록을 건드리지 않는다
    if(a.slot==="GK") return;                   // 키퍼 부상은 교체 로직이 복잡해 다루지 않는다
    const x=this.entryOf(a);
    if(!x || x.off!=null) return;
    if(this._hurtIds && this._hurtIds.has(a.id)) return;   // 한 선수가 두 번 다치지 않게
    (this._hurtIds=this._hurtIds||new Set()).add(a.id);
    // 곧바로 사라지게 하면 이상하다. 쓰러져 있다가 들것에 실려 나가는 몇 초를 둔다.
    // 그 사이에 반칙 장면·세트피스가 끝나므로 다른 로직과 충돌하지도 않는다.
    const nm=a.p?a.p.name:"선수";
    // 기존 "넘어져 있음" 타이머를 그대로 쓴다 — 실려 나갈 때까지 그 자리에 누워 있는다.
    a._injured=true; a._down=this.t+INJ_DOWN_SECS+0.5;
    this.say(a.side, `🚑 ${nm} 선수가 쓰러졌습니다. 트레이너가 들어옵니다.`, "warn");
    this.cap(a.side, COMM.lvInjury, {p:nm});
    this._pendingHurt=this._pendingHurt||[];
    this._pendingHurt.push({id:a.id, hard:!!hard, at:this.t+INJ_DOWN_SECS});
  }
  /* 쓰러진 선수를 실제로 내보낸다 — 경기가 흘러가는 상태일 때만. */
  processHurt(){
    const q=this._pendingHurt;
    if(!q || !q.length) return;
    const b=this.ball;
    if(b.celebrate || b.foulScene || b.setPiece) return;   // 멈춰 있는 장면 중에는 손대지 않는다
    for(let i=q.length-1;i>=0;i--){
      if(this.t < q[i].at) continue;
      const it=q.splice(i,1)[0];
      const a=this.byId(it.id); if(!a) continue;
      const x=this.entryOf(a); if(!x) continue;
      this.syncClock();
      x.off=this.M.min;
      x.injGap=true;                   // 부상으로 비운 자리 — 채우기 전까지 교체 후보로 남긴다
      const wks=1+R(4)+(it.hard?R(3):0);                   // 결장 주수
      if(a.p) a.p.inj=Math.max(a.p.inj||0, wks);
      if(b.ownerId===a.id){                                // 공을 들고 쓰러졌다면 공은 흘러나간다
        b.ownerId=null;
        this.launchLoose(b.x, b.y, RNG()*Math.PI*2, 4+RNG()*6, this.opp(a.side), false);
      }
      this.agents=this.agents.filter(z=>z.id!==a.id);
      const nm=a.p?a.p.name:"선수";
      this.say(a.side, `🚑 ${nm} 선수, 더 이상 뛸 수 없습니다. (약 ${wks}주 결장 예상)`, "warn");
      this.stats[a.side].injury=(this.stats[a.side].injury||0)+1;
      // 내 팀이면 경기를 멈추고 전술판으로 — 교체할지 10명으로 버틸지 감독이 정한다
      if(this.rec(a.side).team.isUser){
        const left=this.agents.filter(z=>z.side===a.side).length;
        this.M.needsSubPause=true; this.M.pauseEntryId=a.p?a.p.id:null;
        this.M.pauseReason=`🚑 <b>${nm}</b> 선수가 부상으로 나갔습니다 (${left}명 남음). 교체를 진행하세요.`;
      }
    }
  }
  /* 매 틱 아주 낮은 확률로 자연 부상 — 지쳐 있을수록, 나이가 많을수록 위험하다 */
  injuryCheck(){
    if(!this.emitEvents) return;
    if(this.ball.celebrate || this.ball.foulScene) return;
    if(RNG() > INJ_TICK_P*meTune("inj")) return;
    const pool=this.agents.filter(a=>a.slot!=="GK" && !a._injured);
    if(!pool.length) return;
    const a=pool[Math.floor(RNG()*pool.length)];
    const cond=(a.p&&a.p.cond!=null)?a.p.cond:90;
    const age=(a.p&&a.p.by)? (G.season-a.p.by) : 26;
    // 체력이 바닥일수록·노장일수록 위험
    const risk=(1.35-cond/100)*(0.75+clamp((age-24)/16,0,1)*0.7);
    if(RNG()<risk) this.hurt(a, false);
  }
  buildSquads(){
    for(const [key, sd] of [["h",this.M.h],["a",this.M.a]]){
      const xi=onPitch(sd).map(x=>x.p);
      const slotOf=computeRenderSlots(sd.team, xi);
      for(const x of onPitch(sd)){
        const slot = x.p.pos==="GK" ? "GK" : (slotOf[x.p.id]||"CM");
        const isHome = key==="h";
        const anchor=tacticalAnchorXY(sd.team, slot, "DEF", isHome);
        const _rfx=roleFx(sd.team, x.p, slot);
        this.agents.push({
          id:x.p.id, p:x.p, team:sd.team, side:key, slot, isHome, role:_rfx,
          dir: isHome?1:-1,
          x:anchor.x, y:anchor.y,
          home:{x:anchor.x, y:anchor.y},   // 역할 판단의 기준이 되는 타고난 자리
          seed:(x.p.id*37)%100,
          ...applyTeamFam(applyFamiliarity(matchSkills(x.p), getPosFam(x.p, slot), x.p, slot), famK(sd.team)),
          _sd:sd,
          spd: 0,                                                              // 현재 속도(가속으로 붙는다)
          face: isHome?0:Math.PI                                               // 바라보는 방향(rad, iso 기준)
        });
      }
    }
    /* 리더십 — 그라운드에 선 선수 중 가장 리더십이 높은 한 명이 팀을 다잡는다.
       FM에서도 주장은 팀 전체의 집중력·침착성에 영향을 준다. 여기서는 판단력·팀워크·대담성을
       조금 끌어올리는 식으로 반영한다(최대 +6%). 리더가 교체돼 나가면 그만큼 빠진다. */
    for(const key of ["h","a"]){
      const mine=this.agents.filter(a=>a.side===key);
      if(!mine.length) continue;
      /* 감독이 지정한 주장이 그라운드에 있으면 그 선수가 팀을 다잡는다.
         없으면 예전처럼 리더십이 가장 높은 선수가 대신한다. */
      const sdT=mine[0]&&mine[0].team;
      const capId=sdT&&sdT.cap&&sdT.cap.s===G.season ? sdT.cap.c : null;
      const top=(capId && mine.find(a=>a.id===capId)) ||
        mine.reduce((b,a)=>((a.leadership||0)>(b.leadership||0)?a:b), mine[0]);
      const boost=1 + clamp(((top.leadership||0.5)-0.55)*0.16, -0.02, 0.06);
      for(const a of mine){
        if(a.decSkill!=null)  a.decSkill =clamp(a.decSkill*boost, 0.05, 1);
        if(a.teamwork!=null)  a.teamwork =clamp(a.teamwork*boost, 0.05, 1);
        if(a.bravery!=null)   a.bravery  =clamp(a.bravery*boost, 0.05, 1);
        if(a.posSkill!=null)  a.posSkill =clamp(a.posSkill*(1+(boost-1)*0.6), 0.05, 1);
      }
      this._captain=this._captain||{}; this._captain[key]=top.p?top.p.name:"";   // stats 는 아직 만들어지기 전이다
    }
  }
    /* ── 골키퍼의 움직임 ────────────────────────────────────────────
     FM처럼 상황에 따라 역할이 바뀐다.
       DIVE   : 우리 골문으로 날아오는 슛 — 코스로 몸을 날린다
       SWEEP  : 수비 뒷공간으로 흐른 공 — 박스 밖까지 나가 먼저 걷어낸다
       CLAIM  : 박스로 떨어지는 크로스 — 나와서 잡거나 쳐낸다
       SUPPORT: 우리 팀이 상대 진영에서 공을 돌린다 — 박스 앞까지 올라와 빌드업에 선다
       ANGLE  : 기본 — 골대와 공을 잇는 선 위에서 각을 좁힌다
     "나갈지 말지"는 박스 장악력·돌진 빈도·기행이 정하고,
     "나가서 해내는지"는 공중 장악력·일대일 방어가 정한다 (FM 설명 그대로). */
  gkTarget(a, b, key, anchor){
    const ownGx = a.dir>0 ? 0.015 : 0.985;
    const own = x => a.dir>0 ? x : 1-x;                 // 우리 골문 기준 전진도
    const dx0=(b.x-ownGx)*PITCH_AR, dy0=b.y-0.5, d0=Math.hypot(dx0,dy0)||1e-6;

    // 1) 슛이 날아온다 — 무조건 골문
    if(b.state==="SHOT" && b.shot && b.shot.oKey===key)
      return {role:"DIVE", x:anchor.x, y:clamp01(b.shot.saveY!=null?b.shot.saveY:b.shot.aimY), spd:SPD.SPRINT*1.7};

    // 역할(골키퍼 / 스위퍼 키퍼)이 "얼마나 나가는가"를 직접 조정한다.
    // 능력치(gkRush·sweepAbility)가 소질이라면, 역할은 감독의 지시다.
    const rSweep=(a.role&&a.role.sweep)||0;
    const rush=clamp((a.gkRush||0.5) + rSweep*0.55, 0.05, 1.25);
    const cmdSkill=clamp((a.gkSkill||0.6) + rSweep*0.20, 0.1, 1.2);
    const boxEdge = a.dir>0 ? 1-BOX_X : BOX_X;          // 우리 페널티 박스 경계의 x
    const ballOwn = own(b.x);                            // 공이 우리 골문에서 얼마나 떨어져 있나(0=골라인)

    // 2) 스위핑 — 뒷공간으로 흐르거나 찔러 들어온 공. 내가 먼저 닿을 수 있으면 나간다.
    if((b.state==="PASS"||b.state==="LOOSE") && b.z<CTRL_Z*1.6){
      const tx0 = b.state==="PASS" ? b.tx : b.x, ty0 = b.state==="PASS" ? b.ty : b.y;
      const landOwn = own(tx0);
      // 낙하 지점이 우리 진영 깊숙한 곳이고, 상대가 그리로 달려들 때만
      if(landOwn < GK_SWEEP_X && Math.abs(ty0-0.5) < 0.30){
        const myD = Math.hypot((tx0-a.x)*PITCH_AR, ty0-a.y);
        let oppD=9, mateD=9;
        for(const o of this.side(this.opp(key))){
          if(o.slot==="GK") continue;
          const dd=Math.hypot((o.x-tx0)*PITCH_AR, o.y-ty0);
          if(dd<oppD) oppD=dd;
        }
        // 우리 수비수가 더 가까우면 키퍼가 나갈 이유가 없다 — 진짜 뒷공간일 때만 나간다
        for(const m2 of this.side(key)){
          if(m2.slot==="GK") continue;
          const dd=Math.hypot((m2.x-tx0)*PITCH_AR, m2.y-ty0);
          if(dd<mateD) mateD=dd;
        }
        const dare = GK_SWEEP_EDGE*(0.55+rush*0.90);
        if(myD < mateD && myD < oppD + dare){
          // 볼이 도착할 때까지 계속 달린다 (1.2초 창은 짧아서 도중에 포기했다)
          const remain = b.state==="PASS" ? Math.max(0.4, (b.flightT||1)-(b.flight||0)) : 1.4;
          a._sweeping = this.t + remain + 0.6;
          return {role:"SWEEP", x:clamp01(tx0), y:clamp01(ty0), spd:SPD.SPRINT*1.25};
        }
      }
    }
    // 방금 스위핑을 시작했으면 잠깐은 계속 달린다(왔다갔다 하지 않게)
    if(a._sweeping && a._sweeping>this.t && (b.state==="PASS"||b.state==="LOOSE"))
      return {role:"SWEEP", x:clamp01(b.state==="PASS"?b.tx:b.x), y:clamp01(b.state==="PASS"?b.ty:b.y), spd:SPD.SPRINT*1.15};

    // 3) 크로스 처리 — 박스 안으로 떨어지는 뜬 공은 나와서 잡는다
    if(b.state==="PASS" && b.aerial && b.isCross){
      const landOwn=own(b.tx);
      if(landOwn < (1-BOX_X)*1.05 && Math.abs(b.ty-0.5) < 0.26){
        // 박스 장악력이 높을수록 적극적으로 나온다
        if(RNG() < GK_CLAIM_P*(0.35+cmdSkill*1.10)){
          return {role:"CLAIM", x:clamp01(b.tx), y:clamp01(b.ty), spd:SPD.SPRINT};
        }
      }
    }

    // 4) 빌드업 참여 — 우리 팀이 상대 진영에서 공을 돌리면 박스 앞까지 올라온다
    if(this.possSide===key && ballOwn > (0.50 - rSweep*0.16)){
      // 스위퍼 성향이 높을수록 멀리 나온다. 평범한 키퍼는 박스 안(약 13m),
      // 노이어형은 박스를 넘어 하프라인 쪽 30m 부근까지 올라와 빌드업의 한 축이 된다.
      const sw = clamp((a.sweepAbility||0.4) + rSweep*0.40, 0.05, 1.3);
      const base = GK_SUPPORT_X*(0.38+rush*0.40);
      const extra = Math.max(0, sw-GK_SWEEP_MIN)/(1-GK_SWEEP_MIN) * GK_SWEEP_PUSH;
      // 볼이 상대 진영 깊을수록 더 올라온다
      const depth = clamp01((ballOwn-0.50)/0.40);
      const push = clamp(base + extra*depth, 0.06, 0.40);
      const upX = a.dir>0 ? push : 1-push;
      return {role: push>(1-BOX_X) ? "SWEEPER" : "SUPPORT",
              x:clamp01(upX), y:clamp01(0.5+(b.y-0.5)*0.30), spd:SPD.RUN};
    }

    // 5) 기본 — 각 좁히기
    const near=1-clamp(d0/0.42, 0, 1);
    const step=0.010+0.085*near*near*(0.75+rush*0.50);
    return {role:"ANGLE",
      x:clamp01(ownGx + (dx0/d0)*step/PITCH_AR),
      y:clamp01(0.5 + (dy0/d0)*step*0.85),
      spd: near>0.35 ? SPD.RUN : SPD.GK};
  }
  /* 돌파 — 진행 경로를 막고 선 수비수를 제친다.
     성공하면 수비수는 역동작으로 잠깐 주저앉고(_beaten), 드리블러는 그 틈에 치고 나간다.
     이 대결은 비율(ratio)로 판정해서 능력치 차이가 증폭되게 한다 — 슈퍼스타가 슈퍼스타답게. */
  tryTakeOn(a, opps){
    if((a._takeOnAt||0) > this.t) return false;          // 연속 시도 쿨다운
    const fx=Math.cos(a.face||0), fy=Math.sin(a.face||0);
    let target=null, bd=TAKEON_RANGE;
    for(const o of opps){
      if(o.slot==="GK") continue;
      if(o._beaten && o._beaten>this.t) continue;        // 이미 제친 수비수
      const dx=(o.x-a.x)*PITCH_AR, dy=o.y-a.y, d=Math.hypot(dx,dy);
      if(d>bd || d<1e-6) continue;
      // 진행 방향 ±40도 안(내적)에 서 있어야 "막고 있는" 것이다
      if((dx*fx+dy*fy)/d < 0.76) continue;
      bd=d; target=o;
    }
    if(!target) return false;
    a._takeOnAt = this.t + TAKEON_COOL;
    const T3=a.tr||{};
    // 특성 "공을 차놓고 상대를 제치는 것을 선호" — 볼 다루는 기술 대신 속도로 승부한다
    const AK=(x,k)=>(x&&x[k]!=null)?x[k]:0.6;
    const atk = T3.knockPast
      // 공을 차놓고 달린다 — 발이 전부다. 기술은 거들 뿐.
      ? AK(a,"dribSkill")*0.18 + AK(a,"topSpeed")*0.54 + AK(a,"accelSkill")*0.28
      // 정면 돌파 — 기술이 절반, 나머지는 첫 두 걸음(가속)과 빠져나가는 속도(최고속)
      : AK(a,"dribSkill")*0.52 + AK(a,"accelSkill")*0.30 + AK(a,"topSpeed")*0.18;
    // 수비도 마찬가지다. 발이 느린 센터백은 태클이 아무리 좋아도 윙어를 못 따라간다.
    const def = AK(target,"tackleSkill")*0.46 + AK(target,"accelSkill")*0.22
              + AK(target,"topSpeed")*0.18 + AK(target,"posSkill")*0.14;
    // 비율 대결 — 1.5배 잘하면 이길 확률이 크게 벌어진다
    const r=Math.pow(atk/Math.max(0.05,def), TAKEON_POW);
    const pWin = clamp(r/(1+r), 0.06, 0.94);
    this.stats[a.side].takeOn=(this.stats[a.side].takeOn||0)+1;
    if(RNG() < pWin){
      this.stats[a.side].takeOnWon=(this.stats[a.side].takeOnWon||0)+1;
      // 제쳐진 뒤 다시 붙기까지 — 가속도가 좋은 수비수는 금방 따라붙는다
      target._beaten = this.t + TAKEON_STAGGER*clamp(1.30-(target.accelSkill||0.6)*0.85, 0.45, 1.30);
      this.cap(a.side, COMM.lvTakeOnWin, {p:this.nm(a)});
      // 특성 "상대를 여러 차례 속이는 것을 선호" — 쿨다운을 짧게 해 연속 돌파가 나온다
      if((a.tr||{}).repeatBeat) a._takeOnAt = this.t + TAKEON_COOL*0.35;
      this.tryBurst(a);                                   // 제치고 나가는 순간의 스퍼트
      return true;
    }
    // 실패 — 실제 축구에서 돌파 실패는 대개 볼을 뺏기는 것으로 끝난다.
    // 이 대가가 없으면 실력이 낮은 팀이 무한정 제치기를 시도하며 볼을 끌고 있게 된다.
    this.stats[a.side].lost++;
    this.cap(a.side, COMM.lvTakeOnLose, {p:this.nm(a)});
    if(RNG() < TAKEON_FAIL_LOSS){
      this.stats[target.side].tackleWon++; this.stats[target.side].tackle++;
      if(RNG()<0.35) this.looseBall(a, 0.22);    // 서로 엉켜 흘러나간다
      else this.giveTo(target);                          // 수비수가 그대로 뺏는다
      return true;
    }
    return false;
  }
  tryBurst(a){
    if(!a || a.slot==="GK") return false;
    if((a.burstReady||0) > this.t) return false;
    // 스퍼트를 얼마나 오래 유지하느냐는 최고 속도·지구력이, 얼마나 자주 걸 수 있느냐는 가속도가 정한다
    const top=a.topSpeed!=null?a.topSpeed:(a.paceSkill||0.6);
    const acc=a.accelSkill!=null?a.accelSkill:(a.paceSkill||0.6);
    a.burstUntil = this.t + BURST_DUR*(0.62+top*0.80);
    a.burstReady = this.t + BURST_COOL*clamp(1.42-acc*0.72, 0.70, 1.42);
    return true;
  }
  side(key){ return this.agents.filter(a=>a.side===key); }
  opp(key){ return key==="h"?"a":"h"; }
  byId(id){ return this.agents.find(a=>a.id===id); }
  /* 킥오프 — 양 팀이 자기 진영 안에 대형을 갖추고, 공은 하프라인 센터스팟에 놓인다.
     득점 후에는 실점한 팀이 소유권을 갖고 여기서 다시 시작한다. */
  /* ── 하프타임 진영 교대 ────────────────────────────────────
     축구는 후반에 양 팀이 골문을 바꿔 선다. 지금까지는 90분 내내 같은 쪽을 공격해서,
     화면상 홈팀이 전후반 내내 왼쪽에서 오른쪽으로만 공격했다.
     좌우를 통째로 뒤집는다 — 공격 방향(dir), 앵커 기준면(isHome), 그리고 지금 위치·속도까지. */
  switchEnds(){
    this.ends=this.ends?0:1;          // 지금 어느 쪽을 공격하는 중인지 기억해 둔다
    const mirror=(v)=>1-v;
    for(const a of this.agents){
      a.isHome=!a.isHome;
      a.dir=-a.dir;
      a.x=mirror(a.x);
      if(a.home) a.home.x=mirror(a.home.x);
      a.face=Math.PI-(a.face||0);
      if(a.face>Math.PI) a.face-=Math.PI*2; else if(a.face<-Math.PI) a.face+=Math.PI*2;
      a.vx=-(a.vx||0);
      // 캐시된 목표들도 같이 뒤집지 않으면 한 틱 동안 반대편으로 달려간다
      if(a._smx!==undefined) a._smx=mirror(a._smx);
      if(a._spot) a._spot.x=mirror(a._spot.x);
      if(a._tx!==undefined) a._tx=mirror(a._tx);
      a._spSpot=null; a._inWall=false; a._settled=false;
      a._lineOwnX=null; a._zoneMark=null; a._coverBehind=null;
    }
    const b=this.ball;
    b.x=mirror(b.x); b.vx=-(b.vx||0); b.ex=-(b.ex||0);
    if(b._rx!==undefined) b._rx=mirror(b._rx);
    if(this.ref) this.ref.x=mirror(this.ref.x);
    // 녹화 버퍼는 좌표계가 달라졌으므로 버린다 (하프타임을 가로지르는 하이라이트는 만들지 않는다)
    this.buf.length=0; this.hl=null; this.caps.length=0;
  }
  kickoff(key){
    const b=this.ball;
    for(const a of this.agents){
      const an=tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
      // 킥오프 순간에는 어느 팀도 하프라인을 넘을 수 없다
      a.x = a.dir>0 ? Math.min(an.x, 0.485) : Math.max(an.x, 0.515);
      a.y = an.y; if(!a._injured) a._down=0; a._spot=null; a.vx=0; a.vy=0; a._smx=undefined; a._smy=undefined;
      a.face = a.dir>0 ? 0 : Math.PI;
    }
    const mates=this.side(key).filter(a=>a.slot!=="GK");
    const mid=mates.reduce((best,a)=> Math.abs(a.y-0.5)<Math.abs(best.y-0.5)?a:best, mates[0]);
    mid.x = 0.5 - mid.dir*0.010; mid.y = 0.5;      // 센터스팟 앞에 선다
    this.possSide=key;
    b.ownerId=mid.id; b.state="SETTLED";
    b.x=0.5; b.y=0.5; b.hold=1.6*TEMPO;
    b.setPiece=null; b.shot=null; b.celebrate=null; b.foulScene=null;
    b.isPenalty=false;   // [KMD26 PK-01] 플레이가 새로 시작되면 PK 플래그도 죽는다
    this.pendingOff=null;   // 킥오프로 상황이 끊겼다 — 깃발도 무효
    for(const q of this.agents) q._spSpot=null;
    b.z=0; b.vx=0; b.vy=0; b.vz=0; b.inNet=false;
    b.aerial=false; b.isThrow=false; b.isCross=false; b.offsideAt=null;
    b._rollOwner=null; b.ex=0; b.ey=0;
  }
  /* 선수 이동 — 전술 앵커를 기준으로 볼 쪽으로 당겨지고, 포메이션 규율(앵커 반경) 안에서만 움직인다 */
  moveAgents(){
    const b=this.ball;
    const carrier=b.ownerId!=null?this.byId(b.ownerId):null;
    for(const key of ["h","a"]){
      const mine=this.side(key);
      const phase = key===this.possSide ? "ATT" : "DEF";
      const T=TAC(mine[0].team);
      // 수비 시 볼에 가장 가까운 두 명이 압박을 나간다
      let pressers=[];
      // 공이 죽어 있는 동안에는 아무도 공을 향해 달려들지 않는다.
      // (이게 없으면 코너킥·프리킥에서 상대 선수가 공 바로 앞까지 붙어버린다)
      if(phase==="DEF" && !b.setPiece){
        // 활동량 — 있어야 할 곳에 가는 능력. 낮으면 가까이 있어도 압박을 나가지 않는다.
        const pressCost=a2=>Math.hypot((a2.x-b.x)*PITCH_AR,a2.y-b.y)
              *(1.35-(a2.workRate||0.6)*0.50)*(1-((a2.role&&a2.role.press)||0)*0.35);
        /* 압박 인원 — 압박 강도뿐 아니라 "수비 라인"에도 반응한다.
           라인을 올린다는 건 상대를 자기 진영에 가둬 높은 위치에서 뺏겠다는 뜻이다.
           이 연결이 없으면 라인 지시는 뒷공간만 내주는 순수 손해였다. */
        const oppHalf = (mine[0].dir>0 ? b.x : 1-b.x) > 0.50;
        // 라인만 올려놓고 압박을 안 하면 높은 위치에서 뺏히지 않는다 — 둘이 같이 가야 한다
        const extra = (T.press>=1.5?1:0) + ((T.line>=1.35 && T.press>=0.9 && oppHalf) ? 1 : 0);
        pressers=[...mine].filter(a=>a.slot!=="GK" && !(a._beaten && a._beaten>this.t))
          .sort((p,q)=>pressCost(p)-pressCost(q))
          .slice(0, 1+extra);
      }
      // 팀 블록은 볼 위치를 따라 통째로 오르내린다 — 실제 축구의 라인 유지.
      // 이게 없으면 선수들이 각자 포메이션 자리에 묶여 있어서, 자기 진영 깊은 곳의 볼 소유자에게는
      // 40m짜리 롱볼 말고는 전진 옵션이 아예 존재하지 않게 된다.
      if(phase==="ATT") assignOffRoles(mine, this.t, b, mine[0].dir, T.mentality);   // 소유 팀은 역할을 나눠 움직인다
      const oLine = phase==="ATT" ? oppLineX(this.side(this.opp(key)), mine[0].dir) : 0;
      const blockShift=(b.x-0.5)*0.38;
      const dirBias = phase==="ATT" ? mine[0].dir*0.11 : 0;   // 소유 시 블록을 볼보다 앞으로 세운다
      let defThreat=null;
      if(phase==="DEF"){
        assignDefRoles(mine, this.side(this.opp(key)), carrier, pressers, this.t, mine[0].dir);
        defThreat = carrier ? topThreat(carrier, mine, -mine[0].dir) : null;
      }
      for(const a of mine){
        if(a._down && a._down>this.t) continue;   // 슬라이딩 후 넘어져 있는 동안은 움직이지 못한다
        if(b.setPiece && a.id===b.setPiece.kickerId) continue;   // 키커는 세리머니 로직이 움직인다
        // 세트피스 동안에는 배치된 자리를 지킨다 (코너킥 박스 경합, 골킥 전개 대형 등).
        // 벽은 킥 직후 짧게(_spHold) 더 버틴 뒤에야 흩어진다 — 실제로도 공이 발을 떠난 뒤 무너진다.
        if((a._spHold||0)<=this.t){ a._spHold=0; if(!b.setPiece && a._inWall){ a._spSpot=null; a._inWall=false; a._smx=undefined; a._smy=undefined; } }
        if(!b.setPiece && a._spFix){ a._spFix=null; a._spFixFor=null; }
        if((b.setPiece || (a._spHold||0)>this.t) && a._spSpot){
          const ox2=a.x, oy2=a.y;
          let sx2=a._spSpot.x, sy2=a._spSpot.y;
          // 배치 자리로 가는 도중 공 옆을 스치지 않게 밀어낸다 — 단, 배정된 자리가 이미 규정 거리
          // 밖이라면 그냥 그리로 걸어가면 된다.
          //   ⚠ 여기서 무조건 반경 방향으로 밀어내면, 원 안쪽에 서 있던 선수는 매 틱 목표가
          //      "공 반대편 9.15m 지점"으로 덮어써져 자기 자리로 영영 못 간다(벽 한 명이 17m 밖에서 멈춤).
          if(b.setPiece && key!==this.possSide && a.slot!=="GK"){
            const ko2=(SETPIECE_KEEPOUT[b.setPiece.kind]||9.15)/ISO_TO_M;
            const spotOk=Math.hypot((sx2-b.x)*PITCH_AR, sy2-b.y) >= ko2*0.985;
            if(!spotOk){
              // ⚠ 예전엔 "선수의 현재 위치"를 기준으로 밀어냈다. 그러면 목표가 매 틱 따라 움직이고,
              //    규정 거리 밖으로 나가는 순간 목표가 다시 원래(원 안쪽) 자리로 튀어 되돌아온다 —
              //    선수가 제자리에서 앞뒤로 왔다 갔다 하며 춤추는 것처럼 보이던 원인이다.
              //    배정된 자리 자체를 공 반대 방향으로 한 번만 밀어내 고정 목표로 삼는다.
              if(!a._spFix || a._spFixFor!==b.setPiece.kind){
                let fx=(sx2-b.x)*PITCH_AR, fy=sy2-b.y, fd=Math.hypot(fx,fy);
                if(fd<1e-6){ fx=-a.dir; fy=(RNG()-0.5)*0.4; fd=Math.hypot(fx,fy)||1; }
                a._spFix={x:clamp01(b.x+(fx/fd)*ko2*1.03/PITCH_AR), y:clamp01(b.y+(fy/fd)*ko2*1.03)};
                a._spFixFor=b.setPiece.kind;
              }
              sx2=a._spFix.x; sy2=a._spFix.y;
            } else { a._spFix=null; a._spFixFor=null; }
          }
          const mx2=(sx2-a.x)*PITCH_AR, my2=sy2-a.y, ml2=Math.hypot(mx2,my2);
          if(ml2>SP_ARRIVE){
            const step2=Math.min(ml2-SP_ARRIVE*0.5, SPD.SPRINT*SIM_DT);
            a.x=clamp01(a.x+(mx2/ml2)*step2/PITCH_AR);
            a.y=clamp01(a.y+(my2/ml2)*step2);
            a.face=Math.atan2(my2,mx2);
            a.vx=a.x-ox2; a.vy=a.y-oy2;
          } else {
            // 자리에 도착했다 — 발을 멈추고 공을 바라본다. (미세 이동을 계속하면 방향이 매 틱 뒤집혀 떨린다)
            a.vx=0; a.vy=0;
            a.face=Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR);
          }
          continue;
        }
        // 공간으로 찔러준 공을 쫓는 중 — 포메이션을 잊고 낙하 지점으로 전력질주한다
        if(a._chase){
          if(b.setPiece || b.foulScene || (b.state!=="PASS" && b.state!=="LOOSE") || this.t>a._chase.until){ a._chase=null; }
          // 반응 지연 중 — 아직 공이 간 걸 못 봤다. 이 프레임은 평소 수비 움직임을 그대로 한다.
          else if(a._chase.startAt && this.t < a._chase.startAt){ /* 아래 일반 로직으로 흘려보낸다 */ }
          else {
            if(a._burstAt && this.t>=a._burstAt){ this.tryBurst(a); a._burstAt=0; }
            const ch=a._chase;
            const ox0=a.x, oy0=a.y;
            const mx0=(ch.x-a.x)*PITCH_AR, my0=ch.y-a.y, ml0=Math.hypot(mx0,my0);
            if(ml0>1e-6){
              const want=Math.atan2(my0,mx0);
              if(a.face===undefined) a.face=want;
              let df=want-a.face;
              while(df>Math.PI) df-=Math.PI*2; while(df<-Math.PI) df+=Math.PI*2;
              const maxTurn=TURN_RATE*SIM_DT*(0.60+(a.agility||0.6)*0.80);
              a.face+=clamp(df,-maxTurn,maxTurn);
              const pen=1-Math.min(0.78, Math.abs(df)/Math.PI*1.25);
              let sp0=SPD.SPRINT*paceMul(a);
              if((a.burstUntil||0)>this.t) sp0*=BURST_MUL*(0.86+(a.accelSkill||0.6)*0.28);
              // 정지 상태에서 즉시 최고 속도가 되지 않는다 — 가속도를 걸어 서서히 붙인다.
              // 이 램프가 없으면 침투가 "순간이동"처럼 보이고 수비 지연 효과도 사라진다.
              const wantSpd=sp0*pen;
              const acc0=ACCEL_BASE*accMul(a);
              const lim0=(wantSpd>(a.spd||0)) ? acc0*SIM_DT : acc0*DECEL_MUL*SIM_DT;
              a.spd=(a.spd||0)+clamp(wantSpd-(a.spd||0), -lim0, lim0);
              const step=Math.min(ml0, a.spd*SIM_DT);
              a.x=clamp01(a.x+Math.cos(a.face)*step/PITCH_AR);
              a.y=clamp01(a.y+Math.sin(a.face)*step);
            }
            a.vx=a.x-ox0; a.vy=a.y-oy0;
            continue;
          }
        }
        const anchor=tacticalAnchorXY(a.team, a.slot, phase, a.isHome);
        anchor.x=clamp01(anchor.x + blockShift*(a.slot==="GK"?0.25:1) + (a.slot==="GK"?0:dirBias));
        // 역할 — 전진 성향(fwd)과 측면 치우침(wide)이 기본 자리 자체를 옮긴다
        if(a.slot!=="GK" && a.role){
          const rf=a.role.fwd||0, rw=a.role.wide||0;
          if(rf) anchor.x=clamp01(anchor.x + a.dir*rf*ROLE_FWD_X*(phase==="ATT"?1:0.45));
          if(rw){
            const side = anchor.y<0.5 ? -1 : 1;            // 원래 서 있던 쪽 기준
            anchor.y=clamp01(anchor.y + side*rw*ROLE_WIDE_Y);
          }
        }
        let tx=anchor.x, ty=anchor.y, spd=SPD.JOG;
        if(a.slot==="GK"){
          const g=this.gkTarget(a, b, key, anchor);
          tx=g.x; ty=g.y; spd=g.spd; a._gkRole=g.role;
          a._gkTx=g.x; a._gkTy=g.y;    // 아래의 포메이션 규율에 눌리지 않도록 따로 보관해 둔다
        } else if(carrier && a.id===carrier.id){
          const bd=Math.hypot((b.x-a.x)*PITCH_AR, b.y-a.y);
          if(bd>DRIB_LEAD*2.2){ tx=b.x; ty=b.y; spd=SPD.RUN; }      // 아직 공을 못 잡았다 — 공을 향해 간다
          else {
            // 볼 가진 선수는 전진. 안으로 파고드는 역할·특성이면 여기에 안쪽 성분을 섞는다.
            let lead=0.05, latY=0;
            const cut=Math.min(1.4, FX(a,"cutIn"));
            if(cut>0){
              const adv = a.dir>0 ? a.x : 1-a.x;      // 0=우리 골문, 1=상대 골문
              const off = a.y-0.5;                     // 중앙에서 벗어난 정도
              if(adv>CUTIN_FROM && Math.abs(off)>CUTIN_MIN_OFF){
                const inward = off>0 ? -1 : 1;         // 중앙으로 향하는 방향
                const k = clamp((adv-CUTIN_FROM)/(CUTIN_FULL-CUTIN_FROM), 0, 1);
                // 안쪽 레인 확인 — 앞을 가로막고 선 상대가 있으면 무리해서 접지 않는다
                let blocked=0;
                for(const o of this.side(this.opp(key))){
                  if(o.slot==="GK") continue;
                  const ahead=(o.x-a.x)*a.dir;
                  if(ahead<-0.015 || ahead>CUTIN_LOOK) continue;
                  if((o.y-a.y)*inward>0 && Math.abs(o.y-a.y)<CUTIN_LANE) blocked++;
                }
                const free=clamp(1-blocked*0.42, 0.15, 1);
                const pull=CUTIN_ANGLE*cut*k*free;             // 접는 각도의 탄젠트
                lead *= 1-Math.min(0.35, pull*0.30);           // 옆으로 트는 만큼 전진은 준다
                // 남은 오프셋보다 더 안으로 들어가지 않게 잘라, 반대편으로 넘어가는 일이 없게 한다.
                // 전진을 줄인 뒤의 lead 로 계산해야 각도가 의도(최대 39도)보다 서지 않는다.
                latY = inward*Math.min(pull*lead*PITCH_AR, Math.abs(off)*0.85);
              }
            }
            tx=clamp01(a.x+a.dir*lead); ty=clamp01(a.y+latY); spd=SPD.DRIBBLE;
            // 앞을 막은 수비수가 있으면 제치기를 시도한다 — 성공하면 그대로 뚫고 나간다
            // 특성(자주/드물게 드리블, 개인기 시도)이 드리블 빈도 자체를 바꾼다
            const dt = clamp(1 + FX(a,"dribble"), 0.25, 2.0);
            if(this.recording && RNG()<0.014) this.cap(a.side, COMM.lvDrib, {p:this.nm(a)});
            if(RNG() < TAKEON_TRY*dt/TEMPO) this.tryTakeOn(a, this.side(this.opp(key)));
            if((a.burstUntil||0)>this.t) spd=SPD.RUN;              // 제친 직후에는 속도가 붙는다
          }
        } else if(pressers.includes(a)){
          tx=b.x; ty=b.y; spd=SPD.SPRINT;                            // 압박
        } else if(phase==="ATT"){
          // 볼 쪽으로 몰려가지 않고 받을 공간을 찾아간다 (매 틱 재계산하면 무거우므로 1초에 한 번만)
          if(a.offRole===OFF_ROLE.RUN) a._runPhase=this.t*1.6;   // 라인 근처에서 앞뒤로 흔드는 리듬
          if(!a._spot || this.t-a._spotAt>1.6 || a._spotRole!==a.offRole){
            a._spot=findOpenSpot(a, anchor, carrier, this.side(this.opp(key)), mine, a.dir, b, oLine);
            a._spotAt=this.t; a._spotRole=a.offRole;
          }
          tx=a._spot.x; ty=a._spot.y;
          // 침투와 오버래핑은 전력질주 — 오버래핑은 거리가 멀어서 뛰지 않으면 소유가 끝나기 전에 못 간다
          spd = (a.offRole===OFF_ROLE.RUN || a.offRole===OFF_ROLE.OVERLAP || a.offRole===OFF_ROLE.INSIDE) ? SPD.SPRINT : SPD.RUN;
          // 라인 뒤로 파고드는 순간에는 잠깐 더 치고 나간다
          if(a.offRole===OFF_ROLE.RUN && (a.burstReady||0)<=this.t && RNG()<0.04/TEMPO) this.tryBurst(a);
        } else {
          // 수비 — 역할별로 다르게 움직인다(길목 차단 / 대인마크 / 라인 유지 / 커버)
          a._now=this.t;
          const dt=defTargetXY(a, anchor, b, carrier, defThreat, a.dir);
          tx=dt.x; ty=dt.y;
          // 위치 선정(Positioning) — 낮을수록 대기 상태에서 자리를 잘못 잡는다.
          // 압박·마크처럼 대상이 눈앞에 있는 역할에는 오차를 주지 않는다(그건 못 봐서가 아니니까).
          const idleRole = (a.defRole===DEF_ROLE.LINE || a.defRole===DEF_ROLE.COVER || a.defRole===DEF_ROLE.LANE);
          if(idleRole){
            if(a._posErrAt===undefined || this.t-a._posErrAt>POS_ERR_DRIFT){
              a._posErrAt=this.t;
              /* 수비 조율(com) — 골키퍼는 뒤에서 전부 보고 있다. 조율이 좋은 키퍼는
                 "한 발 나가", "왼쪽 비었어"를 계속 외쳐 수비의 자리 잡기 오차를 줄인다.
                 이게 없던 시절 com 은 화면에만 있고 경기에는 아무 영향이 없는 능력치였다. */
              const myGk=mine.find(x=>x.slot==="GK");
              const org=myGk ? clamp(myGk.gkOrganize||0.5, 0, 1.2) : 0.5;
              const e=POS_ERR_MAX*(1.05-(a.posSkill||0.6))*(1.22-org*0.44);
              a._posEx=(RNG()-0.5)*2*e;
              a._posEy=(RNG()-0.5)*2*e;
            }
            tx=clamp01(tx+(a._posEx||0)); ty=clamp01(ty+(a._posEy||0));
          }
          // 볼이 우리 진영으로 넘어오면 수비진은 걷지 않는다. 공격수는 전력질주로 들어오는데
          // 수비가 조깅으로 내려가면 라인은 영원히 볼보다 뒤에 놓인다.
          const deepBall = clamp01((0.34-(a.dir>0?b.x:1-b.x))/0.34);
          spd = (a.defRole===DEF_ROLE.RECOVER) ? SPD.SPRINT
              : (a.defRole===DEF_ROLE.MARK || a.defRole===DEF_ROLE.LANE || a.defRole===DEF_ROLE.COVER_WIDE) ? SPD.RUN
              : lerp(SPD.JOG, SPD.SPRINT, deepBall);
        }
        // 오프사이드 라인 맞추기 — 공격 시에는 매 스텝 라인을 확인하며 위치를 조정한다.
        // (1.6초마다만 갱신하면 그사이 수비 라인이 올라갔을 때 그대로 걸려버린다)
        if(phase==="ATT" && a.slot!=="GK" && (!carrier || a.id!==carrier.id)){
          const tm=a.offTiming||0.6;
          // 프라이잉 — 라인 위에서 재다가 타이밍이 나쁘면 패스보다 먼저 튀어나간다.
          // 오프사이드는 이 순간에서 나온다. 클램프만 걸어두면 영원히 0회가 된다.
          if(a._breakAt===undefined || this.t>a._breakAt){
            a._breakAt=this.t + 2.0 + RNG()*4.0;
            const bl = 1 + FX(a,"breakLine")*2.2;     // 역할·특성: 라인 뒤로 파고든다
            a._breakUntil = (RNG() < EARLY_RUN_P*bl*(1.25-tm))
                            ? this.t + 0.6 + RNG()*0.9 : 0;
          }
          const slack = (a._breakUntil>this.t) ? EARLY_RUN_LEAD*(1.25-tm) : (1-tm)*0.012;
          const limit = a.dir>0 ? oLine+slack : oLine-slack;
          tx = a.dir>0 ? Math.min(tx, limit) : Math.max(tx, limit);
        }
        // 포메이션 규율 — 앵커에서 일정 반경 밖으로는 못 나간다(압박 전술이 강하면 반경 확대)
        const leash=(pressers.includes(a)?0.34
                    : phase==="DEF" ? (a.defRole===DEF_ROLE.RECOVER?0.60 : a.defRole===DEF_ROLE.COVER_WIDE?0.34
                                     : a.defRole===DEF_ROLE.MARK?0.30 : a.defRole===DEF_ROLE.LANE?0.26 : 0.18)
                    : a.offRole===OFF_ROLE.OVERLAP?0.62   // 풀백이 윙어를 추월할 수 있을 만큼 풀어준다
                    // 컷인은 앵커(터치라인 근처)에서 골문 앞까지 가는 큰 움직임이다.
                    // 기본 반경(0.20)으로는 x·y 둘 다 갈 예산이 안 나와서, 역할만 컷인이고
                    // 몸은 계속 측면에 남아 있었다(실측: 슛 위치 좌우편차 0.34 = 사실상 윙).
                    : a.offRole===OFF_ROLE.INSIDE?0.52
                    : a.offRole===OFF_ROLE.RUN?0.42
                    : a.offRole===OFF_ROLE.HALF?0.28
                    : 0.20)+(T.press-1)*0.05;
        // 포메이션 규율은 "앞·옆으로 벗어나는 것"을 막는 것이지, 자기 골문 쪽으로 내려서는 것까지
        // 막아서는 안 된다. 후퇴 방향으로는 반경을 크게 풀어준다.
        const retreat = phase==="DEF" && (a.dir>0 ? tx<anchor.x : tx>anchor.x);
        // 볼이 우리 박스 앞까지 왔으면 포메이션 규율을 더 크게 풀어 전원이 내려앉게 한다
        const deepPull = phase==="DEF" ? blockDepth(b, a.dir) : 0;
        const lim = retreat ? leash*(2.0+deepPull*0.9) : leash;
        const ddx=(tx-anchor.x)*PITCH_AR, ddy=ty-anchor.y;
        const dl=Math.hypot(ddx,ddy);
        if(dl>lim){ tx=anchor.x+(ddx/dl)*lim/PITCH_AR; ty=anchor.y+(ddy/dl)*lim; }
        if((a.burstUntil||0)>this.t) spd*=BURST_MUL*(0.86+(a.accelSkill||0.6)*0.28);   // 순간 전력질주 — 가속도가 좋을수록 폭발적이다
        spd *= paceMul(a);   // 주력(Pace) — 느린 선수와 빠른 선수의 최고 속도가 확실히 다르다
        // 세트피스 이격 — 킥하는 팀이 아니면 규정 거리 안으로 들어갈 수 없다.
        // 방해는 하되, 실제 축구처럼 떨어져서 한다.
        if(b.setPiece && key!==this.possSide && a.slot!=="GK"){
          const ko=(SETPIECE_KEEPOUT[b.setPiece.kind]||9.15)/ISO_TO_M;
          // 목표가 원 안이면 원 밖으로 밀어낸다
          let dx=(tx-b.x)*PITCH_AR, dy=ty-b.y, d=Math.hypot(dx,dy);
          if(d<ko){
            if(d<1e-6){ dx=-a.dir; dy=0; d=1; }
            tx=clamp01(b.x+(dx/d)*ko/PITCH_AR); ty=clamp01(b.y+(dy/d)*ko);
          }
          // 이미 원 안에 서 있으면 밖으로 물러난다
          let cx2=(a.x-b.x)*PITCH_AR, cy2=a.y-b.y, cd=Math.hypot(cx2,cy2);
          if(cd<ko){
            if(cd<1e-6){ cx2=-a.dir; cy2=0; cd=1; }
            tx=clamp01(b.x+(cx2/cd)*ko*1.05/PITCH_AR); ty=clamp01(b.y+(cy2/cd)*ko*1.05);
          }
        }
        // 목표 위치 부드럽게 하기 —
        // 수비 목표는 볼 좌표에 직결돼 있어서, 공이 조금만 흔들려도 목표가 매 틱 위아래로 뒤집힌다.
        // 그대로 쫓으면 수비진 전체가 부들부들 떨며 복귀한다. 목표 자체를 천천히 따라가게 한다.
        // 다만 압박·추격·볼 소유자는 즉각 반응해야 하므로 필터를 걸지 않는다.
        const txPreShape=tx;
        // 포지션 규율 — 자기 자리에서 멀어질수록 목표를 앵커 쪽으로 되당긴다.
        // 이게 없으면 전원이 볼 근처로 흘러가 한 덩어리로 몰려다닌다.
        if(!a._chase && !(carrier && a.id===carrier.id) && !pressers.includes(a)){
          const ax=(tx-anchor.x)*PITCH_AR, ay=ty-anchor.y;
          const ad=Math.hypot(ax,ay);
          // 담당을 잡으러 가는 센터백은 규율을 느슨하게 — 안 그러면 "배정은 됐는데 안 붙는다".
          // (자리를 지키라고 앵커로 되당기면, 정작 잡아야 할 공격수는 그대로 free 가 된다)
          /* 침투·오버래핑·컷인은 "자리를 지키지 않는 것"이 목적인 움직임이다.
             여기서 앵커로 되당기면 역할만 배정되고 몸은 제자리에 남는다.
             (실측: 컷인 목표는 중앙 0.12 였는데 최종 목표가 0.41 로 되끌려 나갔다) */
          const breakShape = a.offRole===OFF_ROLE.INSIDE || a.offRole===OFF_ROLE.OVERLAP
                          || a.offRole===OFF_ROLE.RUN;
          const soft = a._zoneMark ? DISCIPLINE_SOFT*CB_MARK_LEASH
                     : breakShape ? DISCIPLINE_SOFT*3.2
                     : DISCIPLINE_SOFT;
          if(ad>soft){
            // 팀워크가 낮으면 전술 자리를 덜 지키고 제멋대로 움직인다
            // 역할이 자유로울수록(레지스타·트레콰르티스타 등) 자리를 덜 지킨다
            const rm=clamp(1-((a.role&&a.role.roam)||0)*0.55, 0.25, 1.4);
            const tw=(0.60+(a.teamwork||0.6)*0.66)*rm;
            const k=clamp((ad-soft)/0.16, 0, DISCIPLINE_MAX*tw*(phase==="DEF"?DEF_DISC:1));         // 최대 78% 되당김
            tx=tx-ax*k/PITCH_AR; ty=ty-ay*k;
          }
        }
        // 동료 간 간격 — 너무 붙어 있으면 목표를 서로 반대쪽으로 조금 민다.
        // 몸싸움(separateBodies)은 이미 겹친 뒤에 떼어놓는 것이고, 이건 애초에 겹치지 않게 하는 쪽이다.
        if(!a._chase && !(carrier && a.id===carrier.id)){
          let sx=0, sy=0;
          for(const q of mine){
            if(q===a || q.slot==="GK") continue;
            const dx2=(a.x-q.x)*PITCH_AR, dy2=a.y-q.y;
            const d2=Math.hypot(dx2,dy2);
            if(d2>1e-6 && d2<SPACING_R){
              const w=(1-d2/SPACING_R);
              sx+=dx2/d2*w; sy+=dy2/d2*w;
            }
          }
          const sl=Math.hypot(sx,sy);
          if(sl>1e-6){
            tx=clamp01(tx + sx/sl*SPACING_PUSH*Math.min(2,sl)/PITCH_AR);
            ty=clamp01(ty + sy/sl*SPACING_PUSH*Math.min(2,sl));
          }
        }
        // 라인 재확인 — 위의 규율/간격 보정이 목표를 앞으로 밀어 다시 오프사이드로 만들 수 있다.
        // 오프사이드 클램프는 반드시 마지막에 한 번 더 걸어야 한다.
        // 규율·간격 보정이 목표를 앞으로 밀어 위의 오프사이드 클램프를 무효화하지 않도록,
        // 공격 시에는 보정 전 위치보다 더 전진하지 못하게 막는다.
        if(phase==="ATT" && txPreShape!==undefined)
          tx = a.dir>0 ? Math.min(tx, txPreShape) : Math.max(tx, txPreShape);
        // 골키퍼는 포메이션 규율·간격·오프사이드 클램프의 대상이 아니다.
        // (이게 없으면 앵커=골문에 묶여 스위퍼 키퍼가 박스 밖으로 나갈 수 없다)
        if(a.slot==="GK" && a._gkTx!==undefined){ tx=a._gkTx; ty=a._gkTy; }
        const instant = !!a._chase || !!b.setPiece || pressers.includes(a) || (carrier && a.id===carrier.id)
                      || a.slot==="GK";
        // 목표가 완전히 다른 곳으로 바뀌었으면(역할 전환 등) 질질 끌지 말고 바로 붙는다.
        // 그 외에는 저역통과로 따라가 앵커의 미세한 흔들림이 몸의 떨림으로 번지지 않게 한다.
        const jumped = a._smx!==undefined &&
          Math.hypot((tx-a._smx)*PITCH_AR, ty-a._smy) > TARGET_JUMP;
        if(a._smx===undefined || instant || jumped){ a._smx=tx; a._smy=ty; }
        else { a._smx += (tx-a._smx)*TARGET_SMOOTH; a._smy += (ty-a._smy)*TARGET_SMOOTH; }
        tx=a._smx; ty=a._smy;
        // 이동 — 선수는 자기가 "바라보는 방향"으로만 나아간다. 목표가 옆이나 뒤면 먼저 몸을 돌려야 하고,
        // 돌아가는 동안에는 속도가 떨어진다. 그래서 방향 전환이 즉각적이지 않고 곡선을 그린다.
        const ox=a.x, oy=a.y;
        const mx=(tx-a.x)*PITCH_AR, my=ty-a.y, ml=Math.hypot(mx,my);
        if(a.slot==="GK"){
          // 골키퍼는 시선과 발이 따로 논다. 볼을 계속 마주 본 채로 옆·뒤로 스텝을 밟는다.
          // 단, 멀리 스위핑을 나갈 때는 실제로도 몸을 돌려 전력질주한다.
          const faceBall = Math.atan2(b.y-a.y, (b.x-a.x)*PITCH_AR);
          const runDir   = ml>1e-6 ? Math.atan2(my, mx) : faceBall;
          // 볼 쪽으로 달릴 때는 금방 몸을 돌리지만, 볼을 등지고 물러설 때는
          // 어지간히 멀지 않으면 계속 볼을 보며 백페달한다. 이게 "등지고 서 있는" 장면을 없앤다.
          let dfb=runDir-faceBall;
          while(dfb>Math.PI) dfb-=Math.PI*2; while(dfb<-Math.PI) dfb+=Math.PI*2;
          const towardBall = Math.abs(dfb) < Math.PI/2;
          const far = ml > GK_TURN_DIST*(towardBall ? 1 : 2.4);
          a.face = far ? runDir : faceBall;
          if(ml>TARGET_DEAD){
            // 옆·뒤로 움직일 때는 정면으로 달릴 때보다 느리다 (사이드스텝/백페달)
            const sidePen = far ? 1 : (1 - Math.min(0.42, Math.abs(dfb)/Math.PI*0.55));
            const wantSpd=spd*sidePen*clamp(ml/ARRIVE_R, ARRIVE_MIN, 1);
            const acc=ACCEL_BASE*accMul(a);
            const lim=(wantSpd>(a.spd||0)) ? acc*SIM_DT : acc*DECEL_MUL*SIM_DT;
            a.spd=(a.spd||0)+clamp(wantSpd-(a.spd||0), -lim, lim);
            const step=Math.min(ml, a.spd*SIM_DT);
            a.x=clamp01(a.x+Math.cos(runDir)*step/PITCH_AR);
            a.y=clamp01(a.y+Math.sin(runDir)*step);
          } else a.spd=Math.max(0, (a.spd||0)-ACCEL_BASE*DECEL_MUL*SIM_DT);
          a.vx=a.x-ox; a.vy=a.y-oy;
          continue;
        }
        a._tx=tx; a._ty=ty;
        // 이미 자리를 잡았다면 목표가 조금 움직여도 버틴다 (제자리 회전 방지)
        if(a._settled && ml<=TARGET_HOLD){
          a.spd=Math.max(0, (a.spd||0)-ACCEL_BASE*DECEL_MUL*SIM_DT);
          a.vx=a.x-ox; a.vy=a.y-oy;
          continue;
        }
        a._settled = (ml<=TARGET_DEAD);
        // 도착 — 속도를 0으로 내리치지 않고 감속으로 죽인다 (급정거처럼 보이지 않게)
        if(ml<=TARGET_DEAD){
          const dec=ACCEL_BASE*DECEL_MUL*SIM_DT;
          a.spd=Math.max(0, (a.spd||0)-dec);
        }
        if(ml>TARGET_DEAD){          // 코앞이면 굳이 움직이지 않는다 (제자리 떨림 방지)
          const want=Math.atan2(my, mx);
          if(a.face===undefined) a.face=want;
          let df=want-a.face;
          while(df>Math.PI) df-=Math.PI*2;
          while(df<-Math.PI) df+=Math.PI*2;
          // 방향 전환은 주력이 아니라 민첩성이 가른다. 발이 빠른 선수가 반드시
          // 몸을 잘 돌리는 것은 아니다 — 볼 잡은 선수 쪽과 같은 기준으로 맞춘다.
          const maxTurn=TURN_RATE*SIM_DT*(0.60+(a.agility||0.6)*0.80);
          a.face += clamp(df, -maxTurn, maxTurn);
          if(a.face>Math.PI) a.face-=Math.PI*2; else if(a.face<-Math.PI) a.face+=Math.PI*2;
          // 몸이 덜 돌아간 만큼 속도가 준다 — 뒤로 꺾을수록 크게 느려진다
          const turnPen = 1 - Math.min(0.78, Math.abs(df)/Math.PI*1.25);
          // 가속 — 정지 상태에서 최고 속도까지 시간이 걸리고, 멈출 때는 더 빨리 선다.
          // 이게 없으면 모든 선수가 매 틱 최고 속도로 튀어나가 움직임이 기계적으로 보인다.
          // 목표에 가까워질수록 목표 속도 자체를 낮춘다 — 오버슈트도, 급정거도 없어진다.
          // 공·상대를 쫓는 동작(SPRINT 이상)은 실제로도 끝까지 밀어붙이므로 덜 깎는다.
          const chasing = spd>=SPD.RUN;
          const arriveK = chasing ? 1 : clamp(ml/ARRIVE_R, ARRIVE_MIN, 1);
          const wantSpd=spd*turnPen*arriveK;
          // 외야 선수의 주 이동 경로. 여기만 옛 paceSkill 식(0.75~1.25)이 남아 있어서
          // 가속도 능력치의 폭이 절반밖에 반영되지 않았다 — accMul(0.62~1.52)로 통일한다.
          const acc=ACCEL_BASE*accMul(a);
          const lim=(wantSpd>(a.spd||0)) ? acc*SIM_DT : acc*DECEL_MUL*SIM_DT;
          a.spd = (a.spd||0) + clamp(wantSpd-(a.spd||0), -lim, lim);
          const step=Math.min(ml, a.spd*SIM_DT);
          a.x=clamp01(a.x+Math.cos(a.face)*step/PITCH_AR);
          a.y=clamp01(a.y+Math.sin(a.face)*step);
        }
        a.vx=a.x-ox; a.vy=a.y-oy;
      }
    }
    this.separateBodies();     // 모두 움직인 뒤 겹친 몸을 떼어놓는다
  }
  /* 드리블 중인 공 — 발에 붙어 있지 않다.
     선수는 몇 걸음마다 공을 앞으로 툭 차 놓고, 공은 마찰로 느려지며 굴러가고, 선수가 따라붙는다.
     그래서 공은 늘 선수보다 진행 방향 쪽으로 조금 앞서 있고, 멈춰 서면 발밑으로 돌아온다. */
  rollBall(carrier){
    const b=this.ball;
    if(b._rollOwner!==carrier.id){          // 방금 공을 받았다
      b._rollOwner=carrier.id; b._touchAt=this.t-DRIB_TOUCH;
      b.ex=0; b.ey=0;                       // 위치는 건드리지 않는다 — 아래에서 천천히 끌어온다
    }
    const vx=carrier.vx||0, vy=carrier.vy||0;
    const sp=Math.hypot(vx*PITCH_AR, vy);
    // 공은 기본적으로 선수와 같은 속도로 함께 나아간다(vx,vy). 여기에 툭 찬 "여분의 속도"(ex,ey)가
    // 얹혀 공을 앞으로 밀어내고, 그 여분만 마찰로 줄어든다. 그래서 공은 늘 진행 방향 앞쪽에 있게 된다.
    if(sp>1e-5 && this.t-b._touchAt >= DRIB_TOUCH*(0.75+RNG()*0.5)){
      b._touchAt=this.t;
      const dx=(b.x-carrier.x)*PITCH_AR, dy=b.y-carrier.y;
      const cur=(dx*vx*PITCH_AR + dy*vy)/sp;                          // 지금 진행 방향으로 앞선 거리
      const want=DRIB_LEAD*(1.30-(carrier.dribSkill||0.6)*0.40);      // 기술이 좋을수록 짧게 붙여 놓는다
      const push=Math.max(0, want-cur)*(1-BALL_ROLL_FRICTION);
      // 미는 방향은 순간 속도가 아니라 "선수가 바라보는 방향" — 몸을 꺾으면 공도 그쪽으로 꺾인다
      const f=(carrier.face===undefined) ? Math.atan2(vy, vx*PITCH_AR) : carrier.face;
      b.ex=Math.cos(f)*push/PITCH_AR; b.ey=Math.sin(f)*push;
    }
    b.x=clamp01(b.x+vx+(b.ex||0)); b.y=clamp01(b.y+vy+(b.ey||0));
    b.ex=(b.ex||0)*BALL_ROLL_FRICTION; b.ey=(b.ey||0)*BALL_ROLL_FRICTION;
    // 멈춰 서 있으면 공이 발밑으로 돌아온다
    if(sp<=1e-5){ b.x=lerp(b.x, carrier.x, 0.22); b.y=lerp(b.y, carrier.y, 0.22); }
    // 통제 범위 — 이보다 멀리 굴러가면 선수가 잡아 놓는다
    const dx=(b.x-carrier.x)*PITCH_AR, dy=b.y-carrier.y, d=Math.hypot(dx,dy);
    const maxLead=DRIB_LEAD*2.0;
    if(d>maxLead){
      // 통제 범위 밖 — 한 틱에 옮길 수 있는 만큼만 당겨온다. 한 번에 붙이면 공이 순간이동한다.
      const pull=Math.min(d-maxLead, SPD.SPRINT*SIM_DT*1.15);
      b.x=clamp01(b.x-(dx/d)*pull/PITCH_AR);
      b.y=clamp01(b.y-(dy/d)*pull);
      b.ex*=0.4; b.ey*=0.4;
    }
  }
  /* 몸싸움 — 겹쳐 선 두 선수를 떼어놓는다.
     밀리는 양은 상대적인 힘으로 갈린다. 센 선수가 약한 선수를 밀어내고,
     볼을 지키는 선수는 몸을 대고 버티므로 잘 밀리지 않는다.
     세 명 이상 뭉친 경우를 풀기 위해 두 번 반복한다. */
  separateBodies(){
    const A=this.agents, b=this.ball;
    const minD=BODY_R*2;
    // 한 틱에 몸싸움으로 밀려나는 총량을 제한한다.
    // 여러 명 사이에 끼면 밀림이 누적돼 사람이 튕겨 날아가 버린다.
    for(const p of A) p._pushed=0;
    for(let it=0; it<JOSTLE_ITER; it++){
      for(let i=0;i<A.length;i++){
        const p=A[i];
        if(p._down && p._down>this.t) continue;              // 넘어져 있는 선수는 넘어간다
        for(let j=i+1;j<A.length;j++){
          const q=A[j];
          if(q._down && q._down>this.t) continue;
          // 수비벽은 어깨를 붙이고 선다 — 평소의 몸 간격(1.7m)을 강제하면 벽이 벌어져 벽 구실을 못 한다
          if(p._inWall && q._inWall) continue;
          let dx=(q.x-p.x)*PITCH_AR, dy=q.y-p.y;
          let d=Math.hypot(dx,dy);
          if(d>=minD) continue;
          // 미는 방향(단위벡터). 완전히 포개졌으면 임의 방향으로 떼어낸다.
          let ux, uy;
          if(d<1e-6){
            const ang=((p.id*37+q.id*11)%628)/100;
            ux=Math.cos(ang); uy=Math.sin(ang); d=0;   // 거리는 0 — overlap 이 최대가 된다
          } else { ux=dx/d; uy=dy/d; }
          const overlap=minD-d;
          // 힘 대결 — 센 쪽이 덜 밀린다
          const sp=(p.strength||0.6)*(b.ownerId===p.id?SHIELD_BONUS:1)*(p.slot==="GK"?1.6:1);
          const sq=(q.strength||0.6)*(b.ownerId===q.id?SHIELD_BONUS:1)*(q.slot==="GK"?1.6:1);
          const tot=sp+sq;
          const rp=Math.max(0, PUSH_MAX-(p._pushed||0));      // 이번 틱에 아직 밀릴 수 있는 여유
          const rq=Math.max(0, PUSH_MAX-(q._pushed||0));
          const mp=Math.min(rp, overlap*(sq/tot));            // p 가 밀리는 거리
          const mq=Math.min(rq, overlap*(sp/tot));
          p._pushed=(p._pushed||0)+mp; q._pushed=(q._pushed||0)+mq;
          p.x=clamp01(p.x-ux*mp/PITCH_AR); p.y=clamp01(p.y-uy*mp);
          q.x=clamp01(q.x+ux*mq/PITCH_AR); q.y=clamp01(q.y+uy*mq);
          this.stats[p.side].jostle++; this.stats[q.side].jostle++;
        }
      }
    }
  }
  /* 볼 소유자가 다음 행동을 결정한다 — 패스 / 드리블 유지 / 걷어내기 */
  decide(carrier){
    const key=carrier.side, oKey=this.opp(key);
    const mates=this.side(key), opps=this.side(oKey);
    // ── 페널티킥 — 다른 선택지가 없다. 키커는 무조건 골문을 향해 찬다.
    if(this.ball.isPenalty){
      this.ball.isPenalty=false;
      this.resolveShot(carrier, shotGeom(carrier), SHOT_TYPE.PLACED, {penalty:true});
      return;
    }
    // ── 프리킥 처리 — 벽이 서고 키커가 기다렸다가, 미리 정해 둔 대로 실행한다.
    if(this.ball.spPlan){
      const plan=this.ball.spPlan;
      this.ball.spPlan=null; this.ball.fkDirect=false;
      if(plan==="shot"){
        const g=shotGeom(carrier);
        if((g.gx-carrier.x)*carrier.dir>0.01){
          this.stats[key].fkDirect++;
          // 벽을 넘겨 감는 슛이거나(FINESSE), 벽 위로 강하게 때리는 슛(POWER)
          const type=(g.distM<26 && RNG()<0.35+(carrier.fkSkill||0.5)*0.45)
                     ? SHOT_TYPE.FINESSE : SHOT_TYPE.POWER;
          this.resolveShot(carrier, g, type, {freeKick:true});
          return;
        }
      } else if(plan==="cross" || plan==="corner"){
        // 박스로 올린다 — 일반 크로스 판단을 쓰되, 세트피스라 "각이 안 나온다"는 조건은 무시한다.
        // 공이 정지해 있고 아무도 붙어 있지 않으므로, 측면이 아니어도 올릴 수 있다.
        // 코너킥은 골라인 위에서 차므로 반드시 띄워 올린다(컷백으로 새지 않게).
        const cr=this.setPieceDelivery(carrier, plan==="corner");
        if(cr){ this.startCross(carrier, cr); return; }
      }
      // "short" 이거나 위 경로가 불발이면 아래의 일반 판단으로 흘려보낸다 (짧게 연결).
      // 다만 세트피스에서 곧바로 중거리를 때려버리지 않도록 슛 판단은 이번 한 번 건너뛴다.
      if(plan!=="shot") this._skipShotOnce=true;
    }
    const T=TAC(carrier.team);
    const selfPress=pressureOn(carrier, opps, T.press);
    const pctx={dir:carrier.dir, press:T.press, passSkill:carrier.passSkill, selfPress, defs:opps,
                counter:this.counterOn(key)?1:0};   // ⚡ 역습 창 — 패스 선택이 앞을 본다
    const opts=evaluatePassOptions(carrier, mates, opps, pctx);
    // 골키퍼 배급 — 짧은 횡패스로 돌리지 않고 전방으로 길게 연결한다
    if(carrier.slot==="GK"){
      /* ⚽ 골킥 — 상대가 라인을 올려 압박 대형을 짜고 기다리는 상황이다. 중간 거리 연결은
         차단당하기 딱 좋다(실제 제보: "키퍼가 상대에게 패스한다"). 아주 안전한 짧은 연결이
         아니면 하프라인을 넘기는 높고 긴 킥으로 처리한다. */
      if(this.ball.fromGoalKick){
        this.ball.fromGoalKick=false;
        const safe=opts.filter(o=>o.dist<0.20 && o.recvPress<0.35 && o.forward>-0.02);
        if(safe.length && RNG()<0.30+(carrier.passSkill||0.6)*0.20){ this.startPass(carrier, safe[0]); return; }
        this.launchGoalKick(carrier, mates);
        return;
      }
      // 박스 밖에서 잡은 공은 손을 못 쓴다 — 지체 없이 발로 걷어내거나 가까운 동료에게 붙인다
      const gkOwn = carrier.dir>0 ? carrier.x : 1-carrier.x;
      if(gkOwn > (1-BOX_X)){
        const safe=opts.filter(o=>o.dist<0.22 && o.recvPress<0.6);
        if(safe.length && RNG()<0.45+(carrier.passSkill||0.6)*0.35) this.startPass(carrier, safe[0]);
        else this.clearBall(carrier);
        return;
      }
      /* 오픈 플레이 배급도 위험한 중간 패스를 거른다 — 받는 사람이 눌려 있으면 그 옵션은 버린다 */
      const gk=findBestPass(carrier, mates, opps, Object.assign({}, pctx, {
        pick:(list)=>{ const f=list.filter(o=>o.forward>0.08 && o.recvPress<0.70);
                       if(f.length) return f[0];
                       const f2=list.filter(o=>o.forward>0.08); return f2.length?f2[0]:list[0]; }
      }));
      if(gk && (gk.recvPress==null || gk.recvPress<0.85)) this.startPass(carrier, gk);
      else this.clearBall(carrier);
      return;
    }
    // 스로인은 손으로 던진다 — 짧고, 포물선으로 뜨고, 발로 찬 공보다 느리다
    if(this.ball.isThrow){
      const near=opts.filter(o=>o.dist<=THROW_MAX*(0.78+(carrier.throwLong||0.5)*0.62)*(1+((carrier.tr||{}).longThrow?0.45:0)));
      // 사거리 안에 아무도 없으면 "가장 가까운" 동료에게 던진다 (점수가 높다고 멀리 던질 순 없다)
      const pick = near.length ? near[0]
                 : (opts.length ? opts.reduce((x,y)=> y.dist<x.dist?y:x, opts[0]) : null);
      if(pick){ this.startThrow(carrier, pick); } else { this.ball.isThrow=false; this.clearBall(carrier); }
      return;
    }
    // 크로스 — 측면에서 박스로 올릴 기회가 있으면 일반 패스와 점수로 겨룬다
    const cross=evaluateCross(carrier, mates, opps, {
      dir:carrier.dir, press:T.press, crossSkill:carrier.crossSkill
    });
    if(cross) cross.score-=CROSS_ADJ;   // 크로스 남발 억제 — 실제는 패스 30회당 1회쯤이다
    const best=opts[0];
    // 슛 — 패스·크로스와 같은 점수 척도로 겨룬다. 각이 열려 있고 앞이 비었으면 때린다.
    let shot=evaluateShot(carrier, opps, {selfPress, mentality:T.mentality, longShot:T.longShot});
    if(this._skipShotOnce){ this._skipShotOnce=false; shot=null; }   // 세트피스 전개 — 이번엔 때리지 않기로 했다
    if(shot && (!best || shot.score>best.score) && (!cross || shot.score>cross.score)){
      const gk=opps.find(o=>o.slot==="GK");
      this.resolveShot(carrier, shot.g, chooseShotType(carrier, shot.g, this.ball, gk, shot));
      return;
    }
    if(cross && (!best || cross.score>best.score)){ this.startCross(carrier, cross); return; }
    // 돌파 욕심 — 내 앞의 수비수보다 내가 확실히 낫다면, 패스 대신 제치고 들어간다.
    // 이게 없으면 능력치 20짜리 드리블러도 그냥 무난한 패스만 골라 슈퍼스타처럼 보이지 않는다.
    {
      const fx=Math.cos(carrier.face||0), fy=Math.sin(carrier.face||0);
      let mark=null, md=TAKEON_RANGE*1.7;
      for(const o of opps){
        if(o.slot==="GK") continue;
        if(o._beaten && o._beaten>this.t) continue;
        const dx=(o.x-carrier.x)*PITCH_AR, dy=o.y-carrier.y, d=Math.hypot(dx,dy);
        if(d>md || d<1e-6) continue;
        if((dx*fx+dy*fy)/d < 0.70) continue;
        md=d; mark=o;
      }
      if(mark){
        const atk=(carrier.dribSkill||0.6)*0.65+(carrier.paceSkill||0.6)*0.35;
        const def=(mark.tackleSkill||0.6)*0.55+(mark.paceSkill||0.6)*0.30+(mark.posSkill||0.6)*0.15;
        const edge=atk/Math.max(0.05,def);                  // 1.0 이면 대등, 1.3 이면 확실히 우위
        // 우위가 클수록, 상대 골문에 가까울수록 과감해진다
        const adv=carrier.dir>0 ? carrier.x : 1-carrier.x;
        const T2=carrier.tr||{};
        // 특성: 공을 자주/드물게 드리블, 현란한 개인기, 여러 차례 속이기
        const dribTrait = 1 + FX(carrier,"dribble");
        let appetite=clamp((edge-1.02)*TAKEON_GREED*(0.65+(carrier.flair||0.6)*0.70)*dribTrait, 0, 0.92)*(0.55+adv*0.75);
        // 특성: 공을 차놓고 제치기 — 드리블이 아니라 순수 스피드로 뚫는다
        if(T2.knockPast) appetite *= 0.85 + (carrier.paceSkill||0.6)*0.60;
        if(FX(carrier,"shoot")<-0.2) appetite*=0.6;   // 득점보다 패스 성향
        if(RNG() < appetite){
          if(this.tryTakeOn(carrier, opps)) return;         // 제쳤으면 그대로 몰고 간다
          this.ball.hold=(0.3+RNG()*0.4)*TEMPO; return;
        }
      }
    }
    // 좋은 패스가 없고 압박도 약하면 계속 몰고 간다
    // 키퍼와 1대1인데 계속 몰고만 가는 건 축구가 아니다 — 이 상황에서는 드리블로 빠지지 않는다
    const oneOnOne = shot && shot.clear && shot.g.distM<18;
    // 특성: 공을 가지면 멈춤 / 공을 오래 소유 / 템포 조절 — 볼을 더 오래 쥔다
    const holdTr = 1 + FX(carrier,"hold");
    if(!oneOnOne && (!best || (best.score<-0.45 && selfPress<0.4))){ this.ball.hold=(0.6+RNG()*0.7)*TEMPO*holdTr*this.tempoK(key)*(this.counterOn(key)?0.55:1); return; } // 몰고 간다
    // 압박이 극심하고 옵션도 나쁘면 걷어낸다(롱볼)
    // 역할: 안정형 수비수/안정형 풀백/인버티드 풀백은 애매하면 그냥 걷어낸다
    const cf=FX(carrier,"clearFirst");
    if(cf>0 && best.score < -0.25+cf*0.55 && selfPress > 1.1-cf*0.55){ this.clearBall(carrier); return; }
    if(best.score<-0.25 && selfPress>1.1){ this.clearBall(carrier); return; }
    const plan=findBestPass(carrier, mates, opps, Object.assign({}, pctx, {pick:()=>best}));
    if(plan) this.startPass(carrier, plan); else this.clearBall(carrier);
  }
  startPass(carrier, plan){
    const b=this.ball, st=this.stats[carrier.side];
    const opt=plan.opt||plan;
    st.pass++; st.passLen+=opt.dist;
    if(opt.dist>0.45) st.longPass++;   // 30m 이상을 롱패스로 본다
    const ratio=opt.dist>1e-6 ? opt.forward/opt.dist : 0;   // 전진 성분의 비율(각도)로 분류
    if(ratio>0.35) st.fwd++; else if(ratio<-0.35) st.back++; else st.lat++;
    const pl=plan;
    st.powerSum+=pl.power;
    if(pl.type===PASS_TYPE.THROUGH) st.toSpace++;
    if(pl.type===PASS_TYPE.LONG) st.longPassT++;
    else if(pl.type===PASS_TYPE.SHORT) st.shortPass++;
    this.lastTouch=carrier.side;
    b.state="PASS"; b.fromId=carrier.id; b.toId=opt.to.id; b.ownerId=null;
    // 도움 후보 — 이 패스를 받은 선수가 곧바로 골을 넣으면 도움으로 기록된다
    this.lastAssist={id:carrier.id, side:carrier.side, t:this.t};
    // 해설 — 스루패스/롱패스/짧은 패스를 구분해 말한다
    if(this.recording){
      const dM=Math.hypot((opt.to.x-carrier.x)*PITCH_AR, opt.to.y-carrier.y)*ISO_TO_M;
      const pool = pl.type===PASS_TYPE.THROUGH ? COMM.lvThrough : (dM>32 ? COMM.lvPassLong : COMM.lvPass);
      this.cap(carrier.side, pool, {p:this.nm(carrier), q:this.nm(opt.to)});
    }
    b.power=pl.power; b.toSpace=(pl.type===PASS_TYPE.THROUGH); b.passType=pl.type;
    b.aerial = pl.lofted;              // 띄운 공만 공중볼 — 지상 커트가 안 되고 낙하 지점에서 경합한다
    // 오프사이드는 "패스가 나가는 순간"의 위치로 판정한다. 부심 깃발은 볼이 도착한 뒤 올라간다.
    const defs=this.side(this.opp(carrier.side));   // 키퍼 포함 — 뒤에서 두 번째가 곧 최종 수비수다
    b.offsideAt = isOffsidePos(opt.to, carrier, defs, carrier.dir)
                ? {x:opt.to.x, y:opt.to.y, by:carrier.side} : null;
    // 목표는 findBestPass 가 이미 정했다 — 발밑이거나, 달려가 만날 미래의 공간이거나.
    b.tx=clamp01(pl.tx); b.ty=clamp01(pl.ty);
    b.flight=0; b.flightT=pl.T;
    b.flightLen=Math.hypot((b.tx-b.x)*PITCH_AR, b.ty-b.y);
    b.sx=b.x; b.sy=b.y; b.z=0; b.vz=0; b.inNet=false; b.bounced=0;   // 공이 있는 자리에서 출발
    b._opt=opt;
    b._passer=carrier;
    if(pl.type===PASS_TYPE.THROUGH) this.startChase(opt.to, b.tx, b.ty);
    // 2대1 패스 성향 — 주자마자 앞 공간으로 뛰어 들어가 되받을 준비를 한다
    if(FX(carrier,"oneTwo")>0 && (carrier.burstReady||0)<=this.t && RNG()<0.45) this.tryBurst(carrier);
  }
  /* 공간으로 찔러준 공을 향해 달려간다.
     받을 선수는 전력질주로 낙하 지점을 향해 뛰고, 그 지점에 가장 가까운 상대도 함께 달려든다.
     그래서 공간 패스는 "먼저 닿는 쪽이 갖는" 경합이 된다. */
  startChase(recv, tx, ty){
    const until=this.t+CHASE_MAXT;
    if(recv && recv.slot!=="GK"){
      recv._chase={x:tx, y:ty, until};
      this.tryBurst(recv);
    }
    // 가장 먼저 반응하는 상대 한 명 — 낙하 지점 근처에 있어야 쫓아갈 수 있다
    let best=null, bd=1e9;
    for(const o of this.side(this.opp(recv.side))){
      if(o.slot==="GK") continue;
      let d=Math.hypot((o.x-tx)*PITCH_AR, o.y-ty);
      // 스위퍼는 라인 뒤로 넘어온 공을 정리하는 게 본업이라 남들보다 먼저 반응한다
      d *= 1 - clamp(FX(o,"sweepBack"), 0, 1)*SWEEP_EDGE;
      if(d<bd){ bd=d; best=o; }
    }
    if(best && bd<0.20){
      // 반응 지연 — 수비수는 패스가 나가는 순간 바로 몸을 돌리지 못한다.
      // 이 0.2~0.5초가 라인 브레이킹이 성립하는 이유다. 판단력이 좋을수록 짧다.
      // 같은 선수라도 매번 똑같이 반응하지는 않는다 — ±25% 흔들어 준다
      const delay = (REACT_MIN + (REACT_MAX-REACT_MIN)*(1.15-(best.decSkill||0.6)))
                    * (0.75+RNG()*0.50);
      best._chase={x:tx, y:ty, until, startAt:this.t+delay};
      // 지연이 끝난 뒤에 스퍼트가 붙도록 예약해 둔다
      best._burstAt = this.t + delay;
    }
  }
  /* 스로인 — 손으로 던지는 공. 포물선으로 뜨고 발로 찬 패스보다 느리며 멀리 가지 않는다.
     던진 공에는 오프사이드가 적용되지 않는다(축구 규칙). */
  startThrow(carrier, opt){
    const b=this.ball, st=this.stats[carrier.side];
    st.pass++; st.passLen+=opt.dist;
    const ratio=opt.dist>1e-6 ? opt.forward/opt.dist : 0;
    if(ratio>0.35) st.fwd++; else if(ratio<-0.35) st.back++; else st.lat++;
    this.lastTouch=carrier.side;
    b.state="PASS"; b.fromId=carrier.id; b.toId=opt.to.id; b.ownerId=null;
    b.aerial=true;                                  // 손으로 던진 공은 뜬다
    b.power=0.42+(carrier.passSkill||0.6)*0.14;     // 발로 찬 공보다 확연히 느리다
    b.isCross=false; b.offsideAt=null;              // 스로인은 오프사이드 없음
    b.tx=clamp01(opt.to.x); b.ty=clamp01(opt.to.y);
    b.flight=0; b.flightLen=opt.dist;
    b.flightT=clamp(0.40 + opt.dist*ISO_TO_M*0.048, 0.55, 2.0);  // 손으로 던진 공은 느리다
    b.sx=b.x; b.sy=b.y; b.z=0; b.vz=0; b.inNet=false; b.bounced=0;
    b._opt=opt; b._passer=carrier;
    b.isThrow=false;                                // 던졌으니 해제
    st.powerSum+=b.power;
  }
  /* 크로스를 올린다. 공중 크로스는 낙하 지점에서 헤딩 경합이 붙고, 컷백은 낮게 깔린 땅볼이라
     경합 없이 이어지지만 커트당할 수 있다. */
  startCross(carrier, cr){
    const b=this.ball, st=this.stats[carrier.side];
    st.pass++; st.passLen+=cr.dist; st.cross++;
    // 크로스 차단 — 붙어 선 수비수가 발을 뻗어 막는다. 막힌 공은 튀어나가고, 골라인 밖이면 코너킥.
    {
      const opps=this.side(this.opp(carrier.side));
      let near=null, nd=9;
      for(const o of opps){
        if(o.slot==="GK") continue;
        if((o.x-carrier.x)*carrier.dir < -0.010) continue;      // 크로스를 올리는 쪽 앞에 있어야 막는다
        const d=Math.hypot((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
        if(d<nd){ nd=d; near=o; }
      }
      if(near && nd<CROSS_BLOCK_R){
        const pb=CROSS_BLOCK_P*(1-nd/CROSS_BLOCK_R)*(0.55+(near.tackleSkill||0.6)*0.75);
        if(RNG()<pb){
          st.crossBlocked++; this.stats[near.side].block++;
          this.lastTouch=carrier.side;                          // 마지막 터치는 크로스를 올린 쪽
          b.state="SETTLED"; b.ownerId=null; b.isCross=false; b.aerial=false; b.offsideAt=null;
          // 바이라인 근처에서 막힌 크로스는 그대로 골라인을 넘는 일이 잦다 → 코너킥
          const adv=carrier.dir>0 ? carrier.x : 1-carrier.x;
          if(adv>0.76 && RNG()<CROSS_CORNER_P){
            this.lastTouch=near.side;
            this.cornerKick(carrier.side, carrier.dir>0?1:0, clamp01(carrier.y));
            return;
          }
          this.looseBall(near, 0.26);   // 나머지는 다시 경기장 안으로 흐른다
          return;
        }
      }
    }
    if(cr.type===CROSS_TYPE.EARLY) st.crossEarly++;
    else if(cr.type===CROSS_TYPE.BYLINE) st.crossByline++;
    else st.crossCutback++;
    const ratio=cr.dist>1e-6 ? (cr.to.x-carrier.x)*carrier.dir/cr.dist : 0;
    if(ratio>0.35) st.fwd++; else if(ratio<-0.35) st.back++; else st.lat++;
    this.lastTouch=carrier.side;
    b.state="PASS"; b.fromId=carrier.id; b.toId=cr.to.id; b.ownerId=null;
    this.lastAssist={id:carrier.id, side:carrier.side, t:this.t};   // 크로스도 도움 후보다
    this.cap(carrier.side, cr.type===CROSS_TYPE.CUTBACK?COMM.lvCutback:COMM.lvCross, {p:this.nm(carrier)});
    b.aerial=cr.aerial;                      // 컷백은 땅볼
    b.isCross=true; b.crossType=cr.type;
    // 크로스 정확도 — 능력치가 낮으면 목표에서 벗어나 흘러간다
    // 크로스는 정확히 머리에 맞추기 어렵다. 컷백은 짧고 낮아 상대적으로 정확하다.
    // 오차 ±10m 짜리 크로스는 아무에게도 닿지 않는다. 실제 크로스 성공률(약 25%)에 맞춰
    // 낙하 지점이 타깃 주변 3~5m 안에 들어오도록 좁힌다.
    const base = cr.type===CROSS_TYPE.CUTBACK ? 0.04 : 0.075;
    const cdl=decideCrossDelivery(carrier, cr, {opps:this.side(this.opp(carrier.side))});
    b.power=cdl.power;
    if(cdl.floated) st.crossFloat++; else st.crossDriven++;
    st.powerSum+=cdl.power;
    const err = base + (1-(carrier.crossSkill||0.6))*0.13;
    b.tx=clamp01(cr.to.x+(RNG()-0.5)*err);
    b.ty=clamp01(cr.to.y+(RNG()-0.5)*err*1.6);
    b.flight=0; b.flightLen=cr.dist;
    b.flightT = cr.aerial
      ? clamp(1.05 + cr.dist*ISO_TO_M*0.030, 1.30, 2.30)   // 뜬 크로스 — 최고점 3~5m
      : clamp(0.34 + cr.dist*ISO_TO_M*0.034, 0.45, 1.20);  // 컷백은 낮고 빠르다
    b.sx=b.x; b.sy=b.y; b.z=0; b.vz=0; b.inNet=false; b.bounced=0;
    b._opt=null; b._passer=carrier;
    // 크로스는 이미 박스 안 동료를 겨냥한 것이라 오프사이드 판정을 따로 한다
    const defs=this.side(this.opp(carrier.side));
    b.offsideAt = isOffsidePos(cr.to, carrier, defs, carrier.dir)
                ? {x:cr.to.x, y:cr.to.y, by:carrier.side} : null;
  }
  /* 골키퍼의 공중볼 처리 — 박스로 떨어지는 뜬 공을 직접 나와서 잡거나 쳐낸다.
     여태 골키퍼는 크로스가 머리 위로 지나가도 아무 반응이 없었다. 그래서 공중 장악력(aer)이
     경기에 단 한 번도 쓰이지 않는 능력치였다. 나올지 말지, 잡을지 놓칠지를 여기서 정한다. */
  tryGkClaim(){
    const b=this.ball;
    if(!b.aerial || !b._passer) return false;
    const gk=this.side(this.opp(b._passer.side)).find(o=>o.slot==="GK");
    if(!gk) return false;
    const adv = gk.dir>0 ? b.x : 1-b.x;               // 0 = 자기 골문
    if(adv>GK_CATCH_X) return false;                  // 박스 언저리로 떨어지는 공만
    const aer=clamp(gk.gkAerial||0.5, 0, 1.2);
    const d=Math.hypot((b.x-gk.x)*PITCH_AR, b.y-gk.y);
    if(d > GK_CATCH_R*(0.70+aer*0.60)) return false;  // 손이 닿는 범위
    // 사람이 많을수록 주저한다 — 나갔다가 못 잡으면 빈 골문이 된다
    const crowd=this.agents.filter(o=>o.slot!=="GK" &&
      Math.hypot((o.x-b.x)*PITCH_AR, o.y-b.y)<0.055).length;
    if(RNG() > clamp(GK_CATCH_P*(0.45+aer*1.10)*(1-crowd*0.10), 0.02, 0.90)) return false;
    gk.x=b.x; gk.y=b.y; gk.spd=0;                     // 공을 향해 나왔다
    const st=this.stats[gk.side];
    // 잡을지 놓칠지 — 공중 장악력이 8할, 붙어 있는 사람 수가 나머지
    if(RNG() < clamp(0.32+aer*0.55-crowd*0.05, 0.15, 0.94)){
      if(RNG() < clamp((gk.gkPunch||0.5)*0.55, 0.05, 0.60)){
        st.shotPunched=(st.shotPunched||0)+1;
        this.clearBall(gk);                            // 펀칭 — 멀리 걷어낸다
      } else {
        st.shotCaught=(st.shotCaught||0)+1;
        this.giveTo(gk);                               // 캐치
      }
      return true;
    }
    this.looseBall(gk, 0.22);                          // 놓쳤다 — 골문 앞 혼전
    return true;
  }
  /* 골킥 롱킥 — 하프라인 너머 공중볼 투쟁 지점으로 높고 길게 찬다.
     상대 발밑으로 배달되는 "패스 미스"가 아니라, 떨어지는 지점에서 헤더 경합이 벌어진다.
     키퍼의 골킥(kic) 능력이 좋을수록 원하는 지점에 더 정확히 떨어진다. */
  launchGoalKick(carrier, mates){
    const b=this.ball, st=this.stats[carrier.side];
    const adv=m=> carrier.dir>0 ? m.x : 1-m.x;
    const cands=(mates||this.side(carrier.side)).filter(m=>m.slot!=="GK" && adv(m)>0.42 && adv(m)<0.80);
    let tgt=null, best=-1;
    for(const m of cands){
      const v=(m.bravery||0.5)*0.5 + adv(m)*0.6 + RNG()*0.30;
      if(v>best){ best=v; tgt=m; }
    }
    const acc=clamp(0.14 - (carrier.gkKick||0.5)*0.10, 0.03, 0.14);   // 골킥 능력 → 낙하 오차
    const tx = tgt ? clamp(tgt.x + carrier.dir*0.02 + (RNG()-0.5)*acc, 0.08, 0.92)
                   : clamp(carrier.x + carrier.dir*(0.52+RNG()*0.10), 0.08, 0.92);
    const ty = clamp01((tgt ? tgt.y : 0.28+RNG()*0.44) + (RNG()-0.5)*acc*2.2);
    b.state="PASS"; b.fromId=carrier.id; b.toId=null; b.ownerId=null;
    b.aerial=true; b.offsideAt=null; b.power=1.65;
    b.tx=tx; b.ty=ty;
    b.flight=0; b.flightLen=Math.hypot((b.tx-carrier.x)*PITCH_AR, b.ty-carrier.y);
    b.flightT=clamp(0.9 + b.flightLen*ISO_TO_M*0.028, 1.1, 2.6);      // 높이 떠서 오래 난다
    b.sx=b.x; b.sy=b.y; b.z=0; b.vz=0; b.inNet=false; b.bounced=0;
    b._opt=null; b._passer=carrier;
    st.longKick=(st.longKick||0)+1;
    this.cap(carrier.side, ["🥾 {p}, 하프라인을 훌쩍 넘기는 긴 골킥"], {p:this.nm(carrier)});
  }
  clearBall(carrier){
    const b=this.ball, st=this.stats[carrier.side];
    st.clearance=(st.clearance||0)+1;   // 클리어런스는 패스가 아니다 — 실제 스탯에서도 별도 항목
    b.state="PASS"; b.fromId=carrier.id; b.toId=null; b.ownerId=null;
    this.cap(carrier.side, COMM.lvClear, {p:this.nm(carrier)});
    b.aerial=true; b.offsideAt=null; b.power=1.7;   // 걷어내기는 항상 공중볼이고 세게 찬다
    const deep=(carrier.dir>0 ? carrier.x : 1-carrier.x) < 0.32;   // 자기 골문 앞 혼전
    if(deep && RNG()<0.50){
      // 골문 앞에서 다급하게 걷어낸 공이 자기 골라인을 넘는다 → 상대 코너킥
      b.tx = carrier.x - carrier.dir*0.16;
      b.ty = clamp01(carrier.y+(RNG()-0.5)*0.34);
    } else {
      // 전방으로 걷어낸다 — 골라인 밖까지 날아가는 일은 드물다
      b.tx=clamp(carrier.x+carrier.dir*0.26, 0.04, 0.96);
      b.ty=RNG()<0.5 ? -0.015+RNG()*0.22 : 0.80+RNG()*0.215;
    }
    b.flight=0; b.flightLen=Math.hypot((b.tx-carrier.x)*PITCH_AR, b.ty-carrier.y);
    b.flightT=clamp(0.40 + b.flightLen*ISO_TO_M*0.030, 0.6, 2.2);  // 걷어낸 공은 높이 뜬다
    b.sx=b.x; b.sy=b.y; b.z=0; b.vz=0; b.inNet=false; b.bounced=0;
    b._opt=null; b._passer=carrier;
  }
  /* 비행 중인 패스를 진행시키고, 도착·차단을 판정한다 */
  advancePass(){
    const b=this.ball;
    const total=b.flightT || Math.max(0.05, b.flightLen/(PASS_SPEED*(b.power||1)));
    b.flight+=SIM_DT;
    const p=clamp01(b.flight/total);
    const e=frictionEase(p);
    const ox=b.x, oy=b.y;
    // 수평 — 마찰로 감속하는 곡선을 따라간다. 수직 — 뜬 공이면 포물선을 그린다.
    b.x=lerp(b.sx, b.tx, e); b.y=lerp(b.sy, b.ty, e);
    b.z = b.aerial ? Math.max(0, loftPeak(total)*4*p*(1-p)) : 0;
    b.vx=(b.x-ox)*PITCH_AR/SIM_DT; b.vy=(b.y-oy)/SIM_DT;    // 도착 후 굴러갈 속도
    b.vz = b.aerial ? loftPeak(total)*4*(1-2*p)/total : 0;
    // 비행 중 라인을 넘으면 그 순간 아웃 — 도착까지 기다리면 공이 피치 밖에 떠 있게 된다
    if(b.x<0 || b.x>1 || b.y<0 || b.y>1){
      if(this.outOfPlay(b.x, b.y, b._passer.side)){ this.stats[b._passer.side].lost++; return; }
      b.x=clamp01(b.x); b.y=clamp01(b.y);
    }
    // 경로 차단 — 지나가는 공에 상대 몸이 겹치면 커트한다. 머리 위로 뜬 공은 건드릴 수 없다.
    const oKey=this.opp(b._passer.side);
    if(b.z < CTRL_Z) for(const o of this.side(oKey)){
      if(o._down && o._down>this.t) continue;
      // 예측(anticipation) — 판단력·위치선정이 좋은 수비수는 몸을 던지지 않고도 길목을 끊는다.
      // 패서의 시야가 좋을수록 길목을 피해 찔러 넣는다 — 차단 판정에 패서 실력을 반영
      const ant = (0.72 + ((o.posSkill||0.6)*0.5 + (o.decSkill||0.6)*0.5)*0.56)
                * (1.30 - (b._passer.passSkill||0.6)*0.42);
      const sweeping = o.slot==="GK" && o._sweeping && o._sweeping>this.t;
      // 스위핑으로 뛰쳐나온 키퍼는 그 순간 필드 플레이어다 — 평소의 코앞 제한을 풀어준다
      const ir = (o.slot==="GK" && !sweeping) ? CTRL_RADIUS*0.26 : CTRL_RADIUS*ITC_MUL*ant;
      if(Math.hypot((o.x-b.x)*PITCH_AR, o.y-b.y) < ir){
        this.stats[oKey].intercept++; this.stats[b._passer.side].lost++;
        this.cap(o.side, COMM.lvItc, {p:this.nm(o)});
        this.giveTo(o); return;
      }
    }
    // 뜬 공을 선수가 만나는 높이 — 낙하 지점 직전이라 아직 떠 있다.
    // 높이 뜬 크로스는 머리로, 낮게 깔린 공은 발리로 때리게 되는 갈림길이 여기서 난다.
    const zMeet = b.aerial ? loftPeak(total)*4*0.85*0.15 : 0;
    const meetBall = {state:"PASS", z:zMeet};
    if(p>=1){
      if(b.offsideAt){
        const off=b.offsideAt;
        // ── 깃발을 늦게 드는 경우 — 부심이 일단 플레이를 흘려보낸다.
        //    실제 경기에서 흔한 장면이다. 이 상태에서 골이 들어가면 그제서야 깃발이 올라가고 골이 취소된다.
        if(RNG()<OFFSIDE_LATE_P){
          this.pendingOff={by:off.by, x:off.x, y:off.y, until:this.t+OFFSIDE_LATE_WIN};
          const rcv0=this.byId(b.toId);
          if(rcv0){ this.giveTo(rcv0); return; }
        }
        // 오프사이드 — 반칙 지점에서 수비 팀의 "간접" 프리킥으로 재개 (직접 득점 불가)
        this.stats[off.by].offside++;
        if(this.emitEvents){
          const rcv=this.byId(b.toId);
          this.say(off.by, F_(COMM.offside,{p:rcv&&rcv.p?rcv.p.name:"공격수"}), "txt");
          this.cap(off.by, COMM.lvOffLive, {p:rcv&&rcv.p?rcv.p.name:"공격수"});
        }
        this.freeKick(this.opp(off.by), off, true);
        return;
      }
      if(this.tryGkClaim()) return;   // 골키퍼가 먼저 나와서 잡거나 쳐낸다
      if(b.aerial){
        // 공중볼 — 낙하 지점에서 헤딩 경합. 이긴 쪽이 볼을 따낸다.
        const w=this.aerialDuel();
        if(this.ball.foulScene) return;   // 경합 중 반칙 휘슬 — 공은 죽었다. 리시브 처리를 이어가면 PK 장면이 오염된다
        if(w){
          if(w.side===b._passer.side) this.stats[b._passer.side].passOk++;
          else this.stats[b._passer.side].lost++;
          // 박스 안에서 뜬 공을 따낸 공격수는 잡지 않고 그대로 머리로 마무리한다
          if(w.side===b._passer.side && w.slot!=="GK"){
            const hg=shotGeom(w);
            if(hg.distM<16 && (hg.gx-w.x)*w.dir>0.01 && RNG()<0.74+(w.headSkill||0.6)*0.26){
              const gk2=this.side(this.opp(w.side)).find(o=>o.slot==="GK");
              this.resolveShot(w, hg, chooseShotType(w, hg, meetBall, gk2)); return;
            }
          }
          this.giveTo(w);
          return;
        }
      }
      const rc=b.toId!=null?this.byId(b.toId):null;
      if(rc && Math.hypot((rc.x-b.x)*PITCH_AR, rc.y-b.y) < CTRL_RADIUS*2.7){
        this.stats[b._passer.side].passOk++;
        // 경합 상대가 붙지 않은 크로스라도, 박스 안이라면 잡지 않고 그대로 머리로 마무리한다
        if(b.aerial && rc.side===b._passer.side && rc.slot!=="GK"){
          const hg=shotGeom(rc);
          if(hg.distM<17 && (hg.gx-rc.x)*rc.dir>0.005 && RNG()<0.68+(rc.headSkill||0.6)*0.20){
            const gk2=this.side(this.opp(rc.side)).find(o=>o.slot==="GK");
            this.resolveShot(rc, hg, chooseShotType(rc, hg, meetBall, gk2)); return;
          }
        }
        this.giveTo(rc);
      } else {
        // 겨냥에서 빗나간 크로스라도, 박스 안에 떨어진 뜬 공에 가장 먼저 닿은 공격수는 머리로 돌려놓는다
        if(b.aerial){
          let near=null, nd=1e9;
          for(const a of this.agents){
            if(a.slot==="GK") continue;
            const d=Math.hypot((a.x-b.x)*PITCH_AR, a.y-b.y);
            if(d<nd){ nd=d; near=a; }
          }
          if(near && nd<AERIAL_RANGE && near.side===b._passer.side){
            const hg=shotGeom(near);
            if(hg.distM<17 && (hg.gx-near.x)*near.dir>0.005 && RNG()<0.66+(near.headSkill||0.6)*0.22){
              this.stats[b._passer.side].passOk++;
              const gk2=this.side(this.opp(near.side)).find(o=>o.slot==="GK");
              this.resolveShot(near, hg, chooseShotType(near, hg, meetBall, gk2)); return;
            }
          }
        }
        // 아무도 못 잡은 공은 남은 속도로 더 굴러간다 → 그대로 루즈볼로 넘긴다
        this.stats[b._passer.side].lost++;
        b.state="LOOSE"; b.looseT=0; b.looseBy=b._passer.side;
        b.ownerId=null; b.toId=null; b.z=Math.max(0,b.z); b.aerial=b.z>0.004; b._pt=null;
        b.vx*=0.55; b.vy*=0.55;
        return;
        // eslint-disable-next-line no-unreachable
        let best=null, bd=1e9;
        for(const a of this.agents){
          let d=Math.hypot((a.x-b.x)*PITCH_AR, a.y-b.y);
          if(a.slot==="GK" && !(a._sweeping&&a._sweeping>this.t)) d+=0.22;   // 평소엔 코앞만, 스위핑 중이면 정상 경합
          if(d<bd){ bd=d; best=a; }
        }
        if(best){
          if(best.side===b._passer.side) this.stats[b._passer.side].passOk++;
          else this.stats[b._passer.side].lost++;
          // 정확히 머리에 오지 않은 크로스라도, 박스 안에 떨어진 뜬 공에 먼저 닿은 공격수는 머리로 돌려놓는다
          if(b.aerial && best.side===b._passer.side && best.slot!=="GK"){
            const hg=shotGeom(best);
            if(hg.distM<14 && (hg.gx-best.x)*best.dir>0.01 && RNG()<0.52+(best.headSkill||0.6)*0.34){
              this.resolveShot(best, hg, SHOT_TYPE.HEADER); return;
            }
          }
          this.giveTo(best);
        }
      }
    }
  }
  /* 🎯 전담 키커 — 감독이 정한 순위 중 그라운드에 있는 첫 번째. 없으면 null(엔진 자동). */
  designatedKicker(side, kind){
    try{
      const team=this.rec(side).team;
      const K=team.tactic && team.tactic.kickers;
      if(!K || !Array.isArray(K[kind])) return null;
      for(const pid of K[kind]){
        if(!pid) continue;
        const a=this.side(side).find(x=>x.id===pid && x.slot!=="GK");
        if(a) return a;
      }
    }catch(e){}
    return null;
  }
  /* ⏱️ 템포 — 전술 슬라이더가 2D의 "공 잡고 있는 시간"을 실제로 줄이고 늘린다.
     (제보 — 역습·템포가 화면에서만 조절되고 엔진에는 반영되지 않았다) */
  tempoK(side){
    /* [KMD26 TEMPO-01] T.tempo 는 tacVal 을 거쳐 0~2 로 들어오는데 계수가 옛 0~4 눈금에 맞춰져
       있었다. 그래서 폭이 절반(1.12~1.00)이고 중립점도 1.06 으로 어긋나 있었다.
       0.12 로 두면 1.12~0.88 이 되어 아래 clamp(0.85~1.15) 와 정확히 맞고 중립이 1.00 이 된다. */
    try{ const T=TAC(this.rec(side).team); return clamp(1.12-(T.tempo!=null?T.tempo:1)*0.12, 0.85, 1.15); }
    catch(e){ return 1; }
  }
  /* ⚡ 역습 창 — 소유권을 빼앗은 순간부터 몇 초간, 역습 전술 팀은 앞만 본다 */
  counterOn(side){ return this._cw && this._cw.side===side && this.t<this._cw.until; }
  giveTo(a){
    const b=this.ball;
    // 공을 선수 발밑으로 순간이동시키지 않는다. 소유권만 넘기고, 공은 rollBall 이
    // 몇 틱에 걸쳐 발밑으로 끌어온다(잡는 동작). 그동안 선수도 공 쪽으로 다가간다.
    b.z=0; b.vz=0; b.vx=0; b.vy=0; b.inNet=false;
    if(b.isCross && b._passer){                  // 크로스가 같은 팀에게 연결됐는가
      if(a.side===b._passer.side) this.stats[b._passer.side].crossOk++;
      b.isCross=false;
    }
    /* 도움 규정 — 상대 선수(키퍼 포함)의 몸에 맞거나 소유가 넘어가면 "마지막 패스"는 무효다 */
    if(this.lastAssist && a.side!==this.lastAssist.side) this.lastAssist=null;
    /* 소유권 탈환 감지 — 역습 전술 팀이 자기 진영에서 공을 끊었으면 역습 창이 열린다 */
    if(a.side!==this.possSide){
      try{
        const T=TAC(a.team);
        const own=a.dir>0?a.x:1-a.x;
        this._cw = (T.counter && own<0.55) ? {side:a.side, until:this.t+7} : null;
      }catch(e){ this._cw=null; }
    }
    this.lastTouch=a.side;                       // 마지막으로 볼에 손댄 팀
    b.ownerId=a.id; b.state="SETTLED"; b.x=a.x; b.y=a.y;
    b.hold=(1.8+RNG()*1.6)*TEMPO*this.tempoK(a.side)*(this.counterOn(a.side)?0.55:1);   // 볼 터치 후 다음 행동까지
    this.possSide=a.side;
  }
  /* 매 틱 경기 규칙을 점검하고 상태를 갱신한다.
     지금이 흐르는 중인지, 반칙 장면인지, 어떤 세트피스로 멈춰 있는지를 한곳에서 정한다. */
  checkMatchRules(){
    const b=this.ball;
    if(b.celebrate)       this.matchState=MATCH_STATE.CELEBRATION;
    else if(b.foulScene)  this.matchState=MATCH_STATE.FOUL_SCENE;
    else if(b.setPiece)   this.matchState=SP_STATE[b.setPiece.kind]||MATCH_STATE.FREE_KICK;
    else                  this.matchState=MATCH_STATE.PLAYING;
    return this.matchState;
  }
  /* 주심 — 볼을 따라다니되 플레이에 끼지 않을 만큼 거리를 둔다.
     반칙 장면에서는 반칙한 선수에게 곧장 다가간다. */
  moveReferee(){
    const b=this.ball, r=this.ref;
    let tx, ty, spd=SIM_REF_SPEED;
    const fs=b.foulScene;
    if(fs){
      const f=this.byId(fs.foulerId);
      if(f){ tx=f.x-0.020; ty=f.y-0.018; spd=SIM_REF_SPEED*1.5; }
      else { tx=fs.spot.x; ty=fs.spot.y; }
    } else {
      /* 실제 주심의 "대각선 시스템" —
         · 볼을 비스듬히 뒤에서 따라가되, 골라인·페널티 박스 안까지 파고들지 않는다
           (골라인 근처는 부심 담당 구역이다)
         · 볼이 측면에 있으면 반대쪽 대각선으로 살짝 비켜서 시야각을 확보한다 */
      tx=b.x-0.035;
      ty=b.y-SIM_REF_TRAIL + (0.5-b.y)*0.30;          // 반대편 대각선 편향 — 플레이를 심판과 부심 사이에 둔다
      /* 종방향 순찰 한계 — 페널티 아크 언저리(양쪽 박스 진입선 밖)까지만 내려간다 */
      const X_MIN=0.145, X_MAX=0.855;                  // 박스 라인(0.835) 바깥 + 여유
      tx=clamp(tx, X_MIN, X_MAX);
      /* 볼이 박스 깊숙이 들어가면 쫓아 들어가지 않고 아크 부근에서 각을 잡는다 */
      if(b.x>X_MAX) ty=lerp(ty, 0.5+(b.y-0.5)*0.45, 0.5);
      if(b.x<X_MIN) ty=lerp(ty, 0.5+(b.y-0.5)*0.45, 0.5);
      ty=clamp(ty, 0.10, 0.90);                        // 터치라인 밖·구석까지 밀리지 않는다
    }
    const mx=(clamp01(tx)-r.x)*PITCH_AR, my=clamp01(ty)-r.y, ml=Math.hypot(mx,my);
    if(ml>1e-6){
      const step=Math.min(ml, spd*SIM_DT);
      r.x=clamp01(r.x+(mx/ml)*step/PITCH_AR);
      r.y=clamp01(r.y+(my/ml)*step);
    }
  }
  /* 반칙이 일어났다 — 경기를 멈추고 심판을 부른다. */
  startFoulScene(fouler, victim, slide, danger){
    const b=this.ball;
    /* ⚠ 제보 — "PK를 얻었는데 오프사이드로 넘어간다". 휘슬이 불리면 이전 공격의
       깃발은 늦은 깃발(pendingOff)만이 아니라 도착 대기 중인 판정(offsideAt)까지 전부 무효다. */
    this.pendingOff=null;
    b.offsideAt=null; b.toId=null;

    // 위험도 — 슬라이딩·위험 지역·뒤에서 들어간 태클일수록 무겁다
    const fromBehind = (victim.x-fouler.x)*victim.dir > 0.004;
    let sev = (slide?0.42:0.14) + (danger?0.20:0) + (fromBehind?0.18:0);
    sev += (1-(fouler.tackleSkill||0.6))*0.14;                  // 서툰 수비가 거칠어진다
    // 반칙 지점이 수비 팀의 페널티 박스 안이면 프리킥이 아니라 페널티킥이다.
    // 박스 안 반칙은 더 무겁게 다뤄진다(득점 기회 저지) — 카드 확률도 함께 올라간다.
    const pen = inBox(victim, victim.dir);
    if(pen) sev += 0.22;
    b.foulScene={t:0, foulerId:fouler.id, victimId:victim.id,
                 spot:{x:victim.x, y:victim.y}, sev, card:null, pen,
                 restartSide:victim.side};
    b.state="SETTLED"; b.ownerId=null; b.vx=0; b.vy=0; b.vz=0; b.z=0;
    b.x=clamp01(victim.x); b.y=clamp01(victim.y);
    b.hold=99;
  }
  /* 심판이 다가가 판정을 내린다 — 구두 경고 / 옐로 / 레드. */
  /* 이 반칙 팀에게 적용될 심판 계수 — 주심 성향 × (유저 팀이면) 감독-심판 관계 × 에디터 튠 */
  refCardK(side){
    let k=(this.refStrict||1)*meTune("card");
    try{
      const sd = side==="h" ? this.M.h : this.M.a;
      if(sd && sd.team && sd.team.isUser) k*=(1 - clamp(refBias(),-1,1)*0.15);
    }catch(e){}
    return k;
  }
  handleRefereeDecision(fs){
    const f=this.byId(fs.foulerId);
    if(!f) return CARD.NONE;
    const st=this.stats[f.side];
    const r=RNG();
    let card;
    /* 성격 — 다혈질은 태클이 거칠어 카드 위험이 크고, 프로페셔널은 선을 안 넘는다.
       ⚠ 분 단위 엔진(hotHead)에는 있었는데 2D 엔진에는 빠져 있었다. */
    const persK = f.p ? (f.p.pers===3?1.35 : f.p.pers===0?0.90 : 1) : 1;
    const rc = (1 + ((f.tr||{}).cardRisk||0)) * this.refCardK(f.side) * persK;   // 특성 × 심판 × 성격
    if(r < fs.sev*0.012*rc)  card=CARD.RED;        // 심각한 반칙 — 다이렉트 퇴장 (실제 경기당 0.05회)
    else if(r < fs.sev*0.53*rc) card=CARD.YELLOW;
    else                     card=CARD.VERBAL;
    if(card===CARD.YELLOW){
      f.yellows=(f.yellows||0)+1;
      if(f.yellows>=2) card=CARD.RED;              // 경고 누적 퇴장
    }
    if(card===CARD.RED && f.slot==="GK") card=CARD.YELLOW;   // 키퍼 퇴장은 다루지 않는다
    if(card===CARD.RED){
      // 징계 — 실제 경기에서만 (관전용 시뮬은 선수 기록을 건드리지 않는다)
      if(this.emitEvents && f.p){ f.p.ban=Math.max(f.p.ban||0, banMatches((f.yellows||0)>=2)); f.p.banNew=1; }
      st.red++;
      this.markHighlight("red", f.side, HL_W.red);
      this.sentOff.push({id:f.id, side:f.side, t:this.t, name:f.p?f.p.name:""});
      this.agents=this.agents.filter(a=>a.id!==f.id);          // 배열에서 제거 — 퇴장
      /* 🚫 7명 미만 — 몰수패. 시뮬을 그 자리에서 끝낸다 */
      if(this.side(f.side).length<7 && this.emitEvents){
        const sd = f.side==="h" ? this.M.h : this.M.a;
        const isH = f.side==="h";
        const oppLead = isH ? (this.M.ag-this.M.hg) : (this.M.hg-this.M.ag);
        if(oppLead<3){ if(isH){ this.M.hg=0; this.M.ag=3; } else { this.M.hg=3; this.M.ag=0; } }
        this.M.forfeit={side:f.side, team:sd.team.short};
        this.syncStats(); this.M.min=Math.max(this.M.min, Math.floor(this.clock/60)); this.M.half=2; this.M.done=true;
        this.say(null, `🚫 몰수패! ${sd.team.short}의 그라운드 인원이 7명 미만 — 주심이 경기를 중단합니다. 최종 ${this.M.home.short} ${this.M.hg} : ${this.M.ag} ${this.M.away.short}`, "big", {kind:"ft"});
        try{ addNews(`🚫 <b>${sd.team.name}, 몰수패</b> — 퇴장 누적으로 경기 인원(7명)을 채우지 못했습니다. (${this.M.home.short} ${this.M.hg}-${this.M.ag} ${this.M.away.short})`, "warn", "club"); }catch(e){}
        if(sd.team.isUser){ try{ adjustTrust("owner", -10, "몰수패"); adjustTrust("fans", -8, "몰수패"); }catch(e){} }
      }
    } else if(card===CARD.YELLOW) st.yellow++;
    else st.verbal++;
    this.lastEvent={kind:"FOUL", card, side:f.side, t:this.t};
    // ── 기록 브리지: 카드는 선수 개인 기록이자 시즌 징계로 이어진다.
    //    관전용 시뮬에서는 기록하지 않는다 (recordGoal 과 같은 이유).
    if(this.M && this.emitEvents){
      const fx=this.entryOf(f);
      if(fx){
        if(card===CARD.YELLOW) fx.y=(fx.y||0)+1;
        if(card===CARD.RED){ fx.red=true; fx.off=this.M.min; }
      }
      this.syncStats();
      if(this.emitEvents){
        const nm=f.p?f.p.name:"선수";
        if(card===CARD.RED){
          this.say(f.side, F_(COMM.red,Object.assign({p:nm},refVars(this.M))), "big"); this.cap(f.side, COMM.lvRedLive, {p:nm});
          // 내 팀 선수가 퇴장당했다 — 경기를 멈추고 전술판으로 넘긴다.
          //   10명으로 어떻게 버틸지는 감독이 결정해야 할 문제다. 그냥 흘려보내면 안 된다.
          if(this.rec(f.side).team.isUser){
            const left=this.agents.filter(a=>a.side===f.side).length;
            this.M.needsSubPause=true; this.M.pauseEntryId=f.p?f.p.id:null;
            this.M.pauseReason=`🟥 <b>${nm}</b> 선수가 퇴장당했습니다 (${left}명 남음). 전술을 다시 짜세요.`;
          }
          if(this.rec(f.side).team.isUser && f.p && f.p.ban>0){
            this.say(f.side, `⛔ ${nm} 선수는 다음 ${f.p.ban}경기 출장정지입니다.`, "warn");
          }
        }
        else if(card===CARD.YELLOW){ this.say(f.side, F_(COMM.yellow,Object.assign({p:nm},refVars(this.M))), "warn"); this.cap(f.side, COMM.lvYellowLive, {p:nm}); }
        else                        this.say(f.side, F_(COMM.foul,Object.assign({p:nm},refVars(this.M))), "txt");
      }
    }
    return card;
  }
  /* 반칙 장면을 진행시킨다. 끝나면 반칙당한 팀의 프리킥으로 재개. */
  advanceFoulScene(){
    const b=this.ball, fs=b.foulScene;
    fs.t+=SIM_DT;
    this.moveReferee();
    if(!fs.card && fs.t>=FOUL_SCENE_T*0.55) fs.card=this.handleRefereeDecision(fs);
    if(fs.t>=FOUL_SCENE_T){
      b.foulScene=null;
      if(fs.pen) this.penaltyKick(fs.restartSide);
      else       this.freeKick(fs.restartSide, fs.spot);
    }
  }
  /* 세트피스 전용 배치 — 상황에 맞게 양 팀을 재배치하고, 킥이 나갈 때까지 그 자리를 지킨다. */
  setupSetPiece(kind, side, spot){
    const mine=this.side(side), opp=this.side(this.opp(side));
    if(!mine.length || !opp.length) return;
    const dir=mine[0].dir;
    const X=v=> dir>0 ? v : 1-v;                 // 공격 방향 기준 좌표를 절대 좌표로
    const near = spot && spot.y<0.5 ? -1 : 1;
    for(const a of this.agents){ a._spSpot=null; a._inWall=false; }
    // 스팟마다 "지금 가장 가까운 선수"를 배정한다. 아무나 배정하면 반대편 선수가 피치를 가로질러야 한다.
    const assign=(list, spots)=>{
      const pool=list.slice();
      for(const sp2 of spots){
        if(!pool.length) break;
        let bi=0, bd=1e9;
        for(let i=0;i<pool.length;i++){
          const d=Math.hypot((pool[i].x-sp2.x)*PITCH_AR, pool[i].y-sp2.y);
          if(d<bd){ bd=d; bi=i; }
        }
        pool[bi]._spSpot={x:clamp01(sp2.x), y:clamp01(sp2.y)};
        pool[bi]._spHeld=pool[bi]._spSpot;      // 검증용 기록 — 킥 후에도 남는다
        pool.splice(bi,1);
      }
    };
    if(kind==="corner"){
      // 공격팀은 박스 안으로 몰려들고, 수비팀은 그 앞을 막아선다
      const kid=this.ball.setPiece?this.ball.setPiece.kickerId:null;
      const atk=[[0.895,0.42],[0.895,0.58],[0.855,0.47],[0.855,0.53],[0.925,0.50],[0.79,0.50]];
      const def=[[0.955,0.46],[0.955,0.54],[0.915,0.44],[0.915,0.56],[0.875,0.50],[0.955,0.50]];
      assign(mine.filter(a=>a.slot!=="GK" && a.id!==kid), atk.map(v=>({x:X(v[0]), y:v[1]})));
      const gk=opp.find(o=>o.slot==="GK"); if(gk) gk._spSpot={x:X(0.975), y:0.50};
      assign(opp.filter(o=>o.slot!=="GK"), def.map(v=>({x:X(v[0]), y:v[1]})));
    } else if(kind==="goalKick"){
      // 차는 팀은 넓게 벌려 받을 자리를 만들고, 상대는 라인을 올려 압박한다
      assign(mine.filter(a=>a.slot!=="GK"),
        [[0.20,0.16],[0.20,0.84],[0.26,0.36],[0.26,0.64],[0.42,0.28],[0.42,0.72],
         [0.46,0.50],[0.58,0.34],[0.58,0.66],[0.64,0.50]].map(v=>({x:X(v[0]), y:v[1]})));
      assign(opp.filter(o=>o.slot!=="GK"),
        [[0.62,0.30],[0.62,0.70],[0.55,0.44],[0.55,0.56],[0.46,0.22],[0.46,0.78],
         [0.40,0.50],[0.34,0.36],[0.34,0.64],[0.28,0.50]].map(v=>({x:X(v[0]), y:v[1]})));
    } else if(kind==="throwIn"){
      // 던질 팀은 가까이 붙어 받을 각을 만들고, 상대는 그 선수들을 따라붙는다
      const kid2=this.ball.setPiece?this.ball.setPiece.kickerId:null;
      assign(mine.filter(a=>a.slot!=="GK" && a.id!==kid2),
        [[0.03,0.10],[-0.04,0.13],[0.08,0.20],[0.00,0.24]]
          .map(o=>({x:clamp01(spot.x+o[0]*dir), y:clamp01(spot.y - near*o[1])})));
    } else if(kind==="penalty"){
      // 키커와 골키퍼만 남고, 나머지 20명은 전부 박스 밖 + 마크에서 9.15m 뒤로 물러난다.
      // 양 팀이 아크 주변에 섞여 서서 리바운드를 노리는 그림이다.
      const kid3=this.ball.setPiece?this.ball.setPiece.kickerId:null;
      const gk=opp.find(o=>o.slot==="GK");
      if(gk) gk._spSpot=gk._spHeld={x:X(0.995), y:0.5};        // 골라인 위, 골문 한가운데
      // 우리 팀 골키퍼도 하프라인 쪽으로 물러나 지켜본다
      const myGk=mine.find(a=>a.slot==="GK");
      if(myGk) myGk._spSpot=myGk._spHeld={x:X(0.22), y:0.5};
      // 두 팀을 번갈아 배치 — 한 팀이 아크 한쪽을 독차지하지 않도록
      const atkList=mine.filter(a=>a.slot!=="GK" && a.id!==kid3);
      const defList=opp.filter(o=>o.slot!=="GK");
      const mix=[];
      for(let i=0;i<Math.max(atkList.length, defList.length);i++){
        if(atkList[i]) mix.push([atkList[i], PEN_WAIT[i*2]]);
        if(defList[i]) mix.push([defList[i], PEN_WAIT[i*2+1]]);
      }
      for(const [a, w] of mix){ if(!w) continue; a._spSpot=a._spHeld={x:clamp01(X(w[0])), y:clamp01(w[1])}; }
    } else if(kind==="freeKick"){
      this.setupFreeKick(mine, opp, dir, spot, X, assign);
    }
  }
  /* 프리킥 배치 — 슈팅 사거리면 벽을 세우고, 멀면 그냥 전개 대형을 잡는다.
     벽은 "공에서 골문 중앙을 잇는 선" 위 9.15m 지점에 서고, 니어포스트 쪽으로 조금 밀어 세운다.
     그래야 키퍼가 파포스트 쪽만 지키면 되는, 실제 축구의 역할 분담이 나온다. */
  setupFreeKick(mine, opp, dir, spot, X, assign){
    const kid=this.ball.setPiece?this.ball.setPiece.kickerId:null;
    const gx=X(1.0);                                        // 상대 골문 x
    // 공 → 골문 중앙 벡터 (미터)
    const vx=(gx-spot.x)*PITCH_LEN_M, vy=(0.5-spot.y)*ISO_TO_M;
    const distM=Math.hypot(vx, vy);
    const M2X=m=>m/PITCH_LEN_M, M2Y=m=>m/ISO_TO_M;          // 미터 → 정규화 좌표
    const gk=opp.find(o=>o.slot==="GK");
    const atk=mine.filter(a=>a.slot!=="GK" && a.id!==kid);
    let def=opp.filter(o=>o.slot!=="GK");
    if(distM>WALL_MAX_M || distM<1e-6){
      // 사거리 밖 — 벽은 없다. 차는 팀은 넓게 벌리고, 수비는 라인을 유지한다.
      const adv=dir>0?spot.x:1-spot.x;
      assign(atk, [[adv+0.10,0.18],[adv+0.10,0.82],[adv+0.06,0.36],[adv+0.06,0.64],
                   [adv+0.14,0.50],[adv-0.04,0.30],[adv-0.04,0.70],[adv+0.02,0.50],
                   [adv+0.18,0.40],[adv+0.18,0.60]].map(v=>({x:X(clamp(v[0],0.05,0.95)), y:v[1]})));
      assign(def, [[adv+0.16,0.32],[adv+0.16,0.68],[adv+0.20,0.44],[adv+0.20,0.56],
                   [adv+0.12,0.22],[adv+0.12,0.78],[adv+0.26,0.50],[adv+0.30,0.38],
                   [adv+0.30,0.62],[adv+0.24,0.50]].map(v=>({x:X(clamp(v[0],0.05,0.95)), y:v[1]})));
      return;
    }
    // ── 벽 인원: 정면에서 가까울수록 많이 세운다 (실제로도 2~5명)
    const ux=vx/distM, uy=vy/distM;                          // 골문 방향 단위벡터
    const central=1-clamp(Math.abs(spot.y-0.5)/0.34, 0, 1);  // 1=정면, 0=완전 측면
    let n=Math.round(2 + central*2 + clamp((26-distM)/14, 0, 1)*1.2);
    n=clamp(n, 2, 5);
    // 벽은 공에서 9.15m 떨어진 지점 — 규칙 그대로다
    const wcx=spot.x + M2X(ux*SP_KEEPOUT_M), wcy=spot.y + M2Y(uy*SP_KEEPOUT_M);
    // 골문 방향에 수직인 방향. 니어포스트(공에 가까운 골포스트) 쪽으로 벽을 민다.
    const px=-uy, py=ux;
    const nearSide=(spot.y<0.5) ? -1 : 1;                    // 공이 있는 쪽이 니어포스트
    const shift=(py*nearSide>0 ? 1 : -1)*WALL_SHIFT_M;
    const wall=[];
    for(let i=0;i<n;i++){
      const off=(i-(n-1)/2)*WALL_GAP_M + shift;
      wall.push({x:clamp01(wcx + M2X(px*off)), y:clamp01(wcy + M2Y(py*off))});
    }
    // 벽에는 키 크고 용감한 선수를 세운다 (점프력·대담성)
    def.sort((a,b)=> ((b.jump||0.6)+(b.bravery||0.6)) - ((a.jump||0.6)+(a.bravery||0.6)) );
    const wallMen=def.slice(0, n), rest=def.slice(n);
    for(let i=0;i<wallMen.length;i++){ wallMen[i]._spSpot=wallMen[i]._spHeld=wall[i]; wallMen[i]._inWall=true; }
    // 골키퍼는 벽이 가리지 않는 쪽(파포스트)에 선다
    if(gk) gk._spSpot=gk._spHeld={x:X(0.985), y:clamp01(0.5 - nearSide*0.030)};
    // 남은 수비는 벽 뒤로 내려가 골문 앞에 라인을 만든다.
    // 이 라인도 공에서 9.15m 밖이어야 한다 — 안 그러면 배치하자마자 규정 위반으로 밀려나 대형이 흐트러진다.
    const sAdv0=dir>0?spot.x:1-spot.x;
    const lineAdv=clamp(Math.max(sAdv0 + M2X(SP_KEEPOUT_M*1.15), 0.90), 0.60, 0.945);
    assign(rest, [[lineAdv,0.34],[lineAdv,0.44],[lineAdv,0.56],[lineAdv,0.66],
                  [lineAdv-0.02,0.28],[lineAdv-0.02,0.72]].map(v=>({x:X(v[0]), y:v[1]})));
    // 공격팀: 한 명은 공 옆에 붙어 페이크를 걸고, 나머지는 박스 안으로 들어간다
    const sAdv=dir>0?spot.x:1-spot.x;
    assign(atk, [[sAdv, spot.y<0.5?spot.y+0.035:spot.y-0.035],
                 [0.885,0.40],[0.885,0.60],[0.905,0.50],[0.860,0.34],[0.860,0.66],
                 [0.845,0.50],[0.79,0.44],[0.79,0.56],[0.74,0.50]]
      .map((v,i)=>({x:X(v[0]), y: i===0 ? clamp01(v[1]) : v[1]})));
  }
  /* 볼 가진 선수에게 수비수가 붙으면 태클 경합 */
  /* 태클 — 서서 하는 태클과 슬라이딩을 구분한다.
     슬라이딩은 더 멀리 닿고 성공률도 높지만, 한 번 나가면 성공하든 실패하든 잠시 넘어져 있고
     파울 위험이 훨씬 크다. 그래서 "닿지 않는 거리" 또는 "위험 지역 + 거친 수비" 일 때만 나간다. */
  tryTackle(carrier){
    const oKey=this.opp(carrier.side);
    const T=TAC(this.side(oKey)[0].team);
    const st=this.stats[oKey];
    // 자기 페널티 박스 안에서는 수비수가 발을 뻗지 않는다 — 잡아 세우고 몰아낼 뿐이다.
    // 여기서 파울을 하면 곧바로 페널티킥이기 때문이다. 이 조심성이 없으면 경기당 PK가 4번씩 나온다.
    const inOwnBox=inBox(carrier, carrier.dir);
    const boxCare=inOwnBox ? PEN_BOX_CAUTION : 1;
    for(const o of this.side(oKey)){
      if(o.slot==="GK") continue;
      if(o._down && o._down>this.t) continue;                 // 아직 못 일어남
      if(o._beaten && o._beaten>this.t) continue;             // 방금 제쳐져 역동작에 걸렸다
      const d=Math.hypot((o.x-carrier.x)*PITCH_AR, o.y-carrier.y);
      if(d>SLIDE_RANGE) continue;
      // 제쳐지는 순간의 파울 — 태클도 못 들어가고 속도로도 밀리면 잡아채거나 몸으로 막는다.
      // 실제 경기 파울의 절반쯤은 이 "어쩔 수 없어서" 하는 파울이다.
      const behind = (carrier.dir>0 ? o.x<carrier.x : o.x>carrier.x);
      const booked = (o.yellows||0)>0 ? BOOKED_CAUTION : 1;   // 경고 받은 선수는 몸을 사린다
      if(behind && d<TACKLE_RANGE*1.5 && RNG()<SHIRT_FOUL_P*meTune("foul")*booked*boxCare*(0.6+T.tackle*0.4)/TEMPO){
        st.foul++; this.stats[carrier.side].freeKick++;
        this.startFoulScene(o, carrier, false, (o.dir>0?o.x:1-o.x)<0.34);
        return true;
      }
      const inStand = d<=TACKLE_RANGE;
      // 우리 골문에 가까울수록 위험 지역 — 마지막 수단으로 슬라이딩이 나온다
      const danger = (o.dir>0 ? o.x : 1-o.x) < 0.34;
      const bookedS = (o.yellows||0)>0 ? BOOKED_CAUTION : 1;
      // 대인마크 능력치가 좋으면 더 자주 붙어서 끊을 기회를 만든다
      // 특성 "상대 선수를 단단히 마크" — 더 자주 붙어서 끊는다
      /* 거친 압박(aggPress) — 압박형 포워드의 정체성인데 여태 엔진 어디서도 읽지 않았다.
         "더 자주 달려들고, 더 자주 발을 뻗고, 그만큼 파울도 는다"로 배선한다.
         압박은 위치를 잡는 게 아니라 몸을 부딪히는 행위이므로 태클 쪽이 맞는 자리다. */
      const aggr = clamp(FX(o,"aggPress"), 0, 1.5);
      const markEdge = (0.84 + (o.markSkill||0.6)*0.30)*(1 + clamp(FX(o,"tightMark"),-1,1)*0.30)*(1+aggr*0.34);
      const TD=o.tr||{};
      // 특성: 슬라이딩 태클 선호 / 하지 않음
      const slideP = clamp(0.35*(1+FX(o,"slide")+aggr*0.45), 0.05, 0.85);
      // 특성이 있으면 위험 지역이 아니어도 발을 뻗는다 (반대로 "하지 않음"이면 거의 안 한다)
      const slide = !inStand || (T.tackle>=2 && danger && RNG()<slideP*bookedS)
                             || ((TD.slide||0)>0 && RNG()<0.30*(TD.slide||0)*bookedS);
      if(!inStand && !slide) continue;
      // 실제 축구는 경기당 태클이 30~40회다. 매 스텝 미세 경합을 전부 시도로 세면 수백 회가 되므로
      // 시도 자체를 드물게 만든다(붙어 있어도 대부분은 그냥 견제만 하는 상태).
      // [KMD26 PRESS-02] 팀 압박 지시도 읽는다 — 높은 압박은 더 자주 발을 뻗는 것이다
      if(RNG() > (slide?0.006:0.009)*markEdge/(TEMPO*1.5)*(0.8+T.tackle*0.2)*(0.75+T.press*0.25)) continue;   // 틱당 확률이라 시간을 늘린 만큼 낮춘다
      const atk=o.tackleSkill*(0.75+T.tackle*0.18)*(slide?1.28:1.0);   // 슬라이딩이 성공률은 더 높다
      // 퍼스트 터치가 나쁘면 압박에서 볼이 발에서 튄다 — 태클을 버티는 힘도 떨어진다
      const keep=carrier.dribSkill*1.25*(0.72+(carrier.firstTouch||0.6)*0.46);
      const won = atk*RNG() > keep*RNG();
      st.tackle++; if(slide){ st.slide++; o._down=this.t+SLIDE_COMMIT*(won?0.55:1.0); }
      if(won){
        st.tackleWon++; if(slide) st.slideWon++;
        this.cap(o.side, slide?COMM.lvSlide:COMM.lvTackle, {p:this.nm(o)});
        this.stats[carrier.side].lost++;
        // 슬라이딩은 소유하기보다 걷어내는 경우가 많다
        if(slide && RNG()<0.40) this.looseBall(carrier);
        else this.giveTo(o);
        return true;
      }
      // 실패 — 파울 위험 (슬라이딩이 훨씬 높다)
      // 거칠게 달려든 만큼 파울도 는다 — 이득만 있고 대가가 없으면 손잡이가 아니다
      if(RNG() < (slide?0.52:0.30)*bookedS*boxCare*(0.7+T.tackle*0.3)*(1+aggr*0.22)){
        st.foul++;
        this.stats[carrier.side].freeKick++;
        this.cap(o.side, COMM.lvFoulLive, {p:this.nm(o)});
        this.startFoulScene(o, carrier, slide, danger);
        // 거친 태클을 당하면 다칠 수 있다 — 슬라이딩이 훨씬 위험하다
        if(RNG() < INJ_TACKLE_P*(slide?1:0.35)) this.hurt(carrier, slide);   // 휘슬 → 심판이 다가온다 → 판정 → 프리킥
        return true;
      }
    }
    return false;
  }
  /* 세트피스 세리머니를 한 단계씩 진행시킨다.
     PLACE(공을 놓으러 간다) → BACKOFF(뒤로 물러난다) → APPROACH(달려온다) → 킥.
     공은 그동안 스팟에 가만히 놓여 있고, 키커만 움직인다. */
  advanceSetPiece(){
    const b=this.ball, sp=b.setPiece;
    const kicker=this.byId(sp.kickerId);
    if(!kicker){ b.setPiece=null; b.hold=0; return; }
    const ph=SETPIECE_PHASES[sp.kind]||SETPIECE_PHASES.freeKick;
    sp.t+=SIM_DT;
    // 공 뒤쪽(자기 골문 쪽) 지점 — 여기서 물러났다가 달려온다
    const back = sp.kind==="throwIn" ? SETPIECE_BACK*0.4 : SETPIECE_BACK;   // 스로인은 살짝만 물러난다
    const backX=clamp01(sp.spot.x - kicker.dir*back);
    const backY=clamp01(sp.spot.y + (sp.spot.y<0.5?0.02:-0.02));
    const moveTo=(tx,ty,dur)=>{
      const k=clamp01(sp.t/Math.max(0.05,dur));
      let nx=lerp(sp.from.x, tx, k), ny=lerp(sp.from.y, ty, k);
      // 거리와 무관한 보간이라 멀리 있으면 순간이동해 버린다 — 사람이 낼 수 있는 속도로 제한한다
      const dx=(nx-kicker.x)*PITCH_AR, dy=ny-kicker.y, d=Math.hypot(dx,dy);
      const cap=SPD.SPRINT*SIM_DT;
      if(d>cap){ nx=kicker.x+(dx/d)*cap/PITCH_AR; ny=kicker.y+(dy/d)*cap; }
      if(d>1e-6) kicker.face=Math.atan2(dy,dx);       // 가는 방향을 바라본다
      kicker.x=clamp01(nx); kicker.y=clamp01(ny);
    };
    if(sp.phase==="DEAD"){
      // 공을 회수하러 간다 — 공은 나간 자리에 그대로 있고, 키커가 "공이 있는 곳"으로 걸어간다.
      // 여기서 킥 지점으로 바로 가버리면, 선수가 공을 잡기도 전에 공이 혼자 움직여 버린다.
      moveTo(sp.out.x, sp.out.y, ph.dead);
      b.x=clamp01(sp.out.x); b.y=clamp01(sp.out.y); b.z=0;
      const got=Math.hypot((kicker.x-sp.out.x)*PITCH_AR, kicker.y-sp.out.y) < 0.012;
      if((sp.t>=ph.dead && got) || sp.t>ph.dead+8){      // 공에 닿아야 다음 단계로
        sp.phase="PLACE"; sp.t=0; sp.from={x:kicker.x,y:kicker.y};
      }
      return;
    }
    if(sp.phase==="PLACE"){
      // 공을 들고(굴리며) 킥 지점까지 옮긴다 — 이제 공은 키커를 따라간다.
      moveTo(sp.spot.x, sp.spot.y, ph.place);
      b.x=clamp01(kicker.x); b.y=clamp01(kicker.y); b.z=0;
      const arrived=Math.hypot((kicker.x-sp.spot.x)*PITCH_AR, kicker.y-sp.spot.y)<0.010;
      if((sp.t>=ph.place && arrived) || sp.t>ph.place+8){
        b.x=clamp01(sp.spot.x); b.y=clamp01(sp.spot.y);   // 정확히 스팟에 놓는다
        sp.phase="BACKOFF"; sp.t=0; sp.from={x:kicker.x,y:kicker.y};
      }
      return;
    }
    if(sp.phase==="BACKOFF"){
      moveTo(backX, backY, ph.backoff);
      // 주심이 벽을 세울 때까지 기다린다 — 벽이 자리를 잡기 전에 차버리면 프리킥이 아니다.
      // (아무리 늦어도 4초 뒤에는 진행한다 — 어떤 이유로든 벽이 못 서도 경기가 멈추지 않게)
      let wallSet=true;
      if(sp.kind==="freeKick"){
        for(const q of this.agents){
          if(!q._inWall || !q._spSpot) continue;
          if(Math.hypot((q.x-q._spSpot.x)*PITCH_AR, q.y-q._spSpot.y) > 0.010){ wallSet=false; break; }
        }
      }
      if(sp.t>=ph.backoff && (wallSet || sp.t>ph.backoff+4)){ sp.phase="APPROACH"; sp.t=0; sp.from={x:kicker.x,y:kicker.y}; }
    } else {
      moveTo(sp.spot.x, sp.spot.y, ph.approach);
      const atBall=Math.hypot((kicker.x-sp.spot.x)*PITCH_AR, kicker.y-sp.spot.y)<0.014;
      if((sp.t>=ph.approach && atBall) || sp.t>ph.approach+6){
        b.setPiece=null; b.hold=0;                         // 공 앞에 도착했다 — 여기서 실제 킥이 나간다
        // 배치 해제 → 다시 PLAYING. 단 벽은 공이 발을 떠나는 순간까지 서 있어야 한다 —
        // 여기서 곧바로 흩어지면 화면에서 "차기 직전에 벽이 사라지는" 장면이 된다.
        for(const q of this.agents){
          if(q._inWall){ q._spHold=this.t+SP_WALL_HOLD; continue; }
          q._spSpot=null; q._inWall=false; q._smx=undefined; q._smy=undefined;
        }
      }
    }
    b.x=clamp01(sp.spot.x); b.y=clamp01(sp.spot.y); b.z=0;   // 물러났다 달려오는 동안 공은 스팟에 그대로
  }
  /* 세트피스 시작 — 키커를 지정하고 세리머니를 건다 */
  beginSetPiece(kind, kicker, spot, outAt){
    const b=this.ball;
    this.lastAssist=null;   // 데드볼 — 마지막 패스 연결이 끊겼다 (코너·프리킥 딜리버리가 새로 세팅한다)
    /* ⚠ 제보 — PK 골이 오프사이드로 취소되는 사건. "늦게 올라가는 깃발"(pendingOff)이
       이전 공격에서 남은 채 세트피스를 넘어와, PK 득점 순간 그 깃발이 올라갔다.
       플레이가 죽고 새로 시작되면 이전 상황의 깃발은 무효다. */
    this.pendingOff=null;
    const out = outAt || {x:b.x, y:b.y};      // 공이 나가 멈춘 자리 — 여기서부터 회수한다
    b.setPiece={kind, kickerId:kicker.id, spot:{x:clamp01(spot.x),y:clamp01(spot.y)},
                out:{x:clamp01(out.x), y:clamp01(out.y)},
                phase:"DEAD", t:0, from:{x:kicker.x, y:kicker.y}};
    b.state="SETTLED"; b.z=0; b.vx=0; b.vy=0; b.vz=0; b.inNet=false; b.aerial=false;
    b.x=clamp01(b.x); b.y=clamp01(b.y);
    b.hold=99;                        // 세리머니가 끝날 때까지 킥하지 않는다
  }
  /* 볼이 라인을 넘었는지 판정하고 알맞은 방식으로 재개한다.
       터치라인 → 스로인 (마지막에 건드린 팀의 상대)
       골라인   → 마지막 터치가 공격 팀이면 골킥, 수비 팀이면 코너킥 */
  outOfPlay(x, y, lastSide){
    if(!lastSide) lastSide=this.lastTouch||this.possSide;
    // 기준선 — 공의 중심이 라인을 완전히 넘어야 아웃 (x: 골라인, y: 터치라인)
    const EPS=0.001;
    const overX = x<-EPS ? (-x) : (x>1+EPS ? x-1 : 0);
    const overY = y<-EPS ? (-y) : (y>1+EPS ? y-1 : 0);
    if(overX<=0 && overY<=0) return false;
    // 코너 부근에서 둘 다 넘었으면 더 많이 넘은 쪽 라인으로 판정한다
    if(overY>0 && overY>=overX){
      this.throwIn(this.opp(lastSide), {x:clamp01(x), y:y<0?0:1});
      return true;
    }
    {
      const dir=this.side(lastSide)[0].dir;          // 마지막 터치 팀의 공격 방향
      const outAt = x<0 ? 0 : 1;
      const theirGoal = dir>0 ? 1 : 0;               // 그 팀이 노리는 골문
      if(outAt===theirGoal) this.goalKick(this.opp(lastSide));   // 상대 골라인 밖 → 상대 골킥
      else this.cornerKick(this.opp(lastSide), outAt, y);        // 자기 골라인 밖 → 상대 코너킥
      return true;
    }
    return false;
  }
  /* 스로인 — 나간 지점에서 상대 팀이 던진다. 짧게 연결되고 오프사이드가 적용되지 않는다. */
  throwIn(side, at){
    const b=this.ball;
    const out={x:b.x, y:b.y};                       // 공이 나가 멈춘 자리
    const spot={x:clamp01(at.x), y: at.y<0.5?0.004:0.996};   // 공은 터치라인 위에 놓는다
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false;
    let best=null,bd=1e9;
    for(const a of this.side(side)){
      if(a.slot==="GK") continue;
      const d=Math.hypot((a.x-spot.x)*PITCH_AR, a.y-spot.y);
      if(d<bd){ bd=d; best=a; }
    }
    if(!best) best=this.side(side)[0];
    b.ownerId=best.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=true;                       // 다음 배급은 발이 아니라 손이다
    this.beginSetPiece("throwIn", best, spot, out);
    this.setupSetPiece("throwIn", side, spot);
    this.stats[side].throwIn++;
  }
  /* 골킥 — 골키퍼가 골 에어리어에서 길게 찬다 */
  goalKick(side){
    const b=this.ball;
    const mine=this.side(side), dir=mine[0].dir;
    const gk=mine.find(a=>a.slot==="GK")||mine[0];
    const out={x:b.x, y:b.y};                       // 공이 나가 멈춘 자리 — 여기서 회수한다
    const spot={x: dir>0 ? 0.06 : 0.94, y:0.5};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false;
    b.ownerId=gk.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=false; b.fromGoalKick=true; this.beginSetPiece("goalKick", gk, spot, out);
    this.setupSetPiece("goalKick", side, {x:b.x, y:b.y});   // 회수 → 놓고 → 물러났다 → 찬다
    this.stats[side].goalKick++;
  }
  /* 코너킥 — 코너 플래그에서 박스 안으로 올린다(공중볼) */
  cornerKick(side, outAt, y){
    const b=this.ball;
    const out={x:b.x, y:b.y};                       // 공이 나가 멈춘 자리 — 여기서 회수한다
    const spot={x: outAt===0 ? 0.01 : 0.99, y: y<0.5 ? 0.02 : 0.98};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false;
    let best=this.designatedKicker(side, "ck");
    if(!best){
      let bd=1e9;
      for(const a of this.side(side)){
        if(a.slot==="GK") continue;
        const d=Math.hypot((a.x-spot.x)*PITCH_AR, a.y-spot.y);
        if(d<bd){ bd=d; best=a; }
      }
    }
    if(!best) best=this.side(side)[0];
    b.ownerId=best.id; this.possSide=side; this.lastTouch=side;
    // 코너는 원칙적으로 박스 안으로 띄워 올린다. 다만 실제 경기의 1할쯤은 짧게 빼서 다시 만든다.
    b.fkIndirect=false;
    b.spPlan = RNG()<CORNER_SHORT_P ? "short" : "corner";
    if(this.emitEvents) this.say(side, F_(COMM.corner,{t:this.rec(side).team.short}), "txt");
    this.cap(side, COMM.lvCornerLive, {t:this.rec(side).team.short});
    b.isThrow=false; this.beginSetPiece("corner", best, spot, out);
    this.setupSetPiece("corner", side, spot);
    this.stats[side].corner++;
  }
  /* 프리킥으로 재개 — 반칙(오프사이드) 지점에 볼을 놓고 해당 팀이 소유한다.
     실제 축구처럼 잠시 경기가 멈췄다가(hold) 다시 시작된다. */
  freeKick(side, at, indirect){
    const b=this.ball;
    const out={x:b.x, y:b.y};
    const spot={x:clamp01(at.x), y:clamp01(at.y)};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null;
    // 간접 프리킥 — 오프사이드 재개 등, 직접 득점이 인정되지 않는다.
    // (위 초기화 뒤에 세워야 한다 — 앞에 두면 초기화에 지워진다)
    b.fkIndirect=!!indirect;
    let best=null, bd=1e9;
    for(const a of this.side(side)){
      if(a.slot==="GK") continue;
      const d=Math.hypot((a.x-spot.x)*PITCH_AR, a.y-spot.y);
      if(d<bd){ bd=d; best=a; }
    }
    if(!best) best=this.side(side)[0];
    // 슈팅 사거리 안이면 전담 키커(프리킥 능력치)가 나선다 — 근처 아무나 차게 두면 수비수가 감아 넣는다
    const dir=this.side(side)[0].dir;
    const gx=dir>0?1:0;
    const distM=Math.hypot((gx-spot.x)*PITCH_LEN_M, (0.5-spot.y)*ISO_TO_M);
    if(distM<FK_DIRECT_M){
      let bk=this.designatedKicker(side, "fk"), bs=-1;
      if(!bk) for(const a of this.side(side)){
        if(a.slot==="GK") continue;
        const s=(a.fkSkill||0.5);
        if(s>bs){ bs=s; bk=a; }
      }
      if(bk) best=bk;
    }
    b.ownerId=best.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=false;
    // ── 무엇을 할지 여기서 정해 둔다. 키커는 공 앞에 서서 이 결정을 들고 기다린다.
    //    직접 슛 / 박스로 올리기 / 짧게 연결 — 실제 팀이 프리킥 앞에서 고르는 세 가지다.
    b.spPlan=this.chooseFreeKickPlan(best, spot, distM, side, b.fkIndirect);
    b.fkDirect=(b.spPlan==="shot");
    this.beginSetPiece("freeKick", best, spot, out);   // 회수 → 놓고 → 물러났다 → 찬다
    this.setupSetPiece("freeKick", side, spot);        // 수비는 벽을 세우고, 공격은 박스로 들어간다
  }
  /* 세트피스에서 박스로 올리는 공 — 일반 크로스(evaluateCross)는 "측면에서, 달리면서"를 전제하지만
     프리킥은 정지된 공이라 중앙에서도 올릴 수 있다. 그래서 타깃 선정만 따로 한다. */
  setPieceDelivery(carrier, forceAerial){
    const dir=carrier.dir, opps=this.side(this.opp(carrier.side));
    const mates=this.side(carrier.side).filter(m=>m!==carrier && m.slot!=="GK");
    // 박스 안(또는 박스 언저리)에서 기다리는 동료
    let box=mates.filter(m=>advOf(m,dir)>BOX_X-0.02 && m.y>BOX_Y0-0.03 && m.y<BOX_Y1+0.03);
    if(!box.length) box=mates.filter(m=>advOf(m,dir)>0.72);
    if(!box.length) return null;
    // 머리가 좋고 덜 마크된 선수를 겨냥한다
    const aim=m=>(m.headSkill||0.6)*1.4 + (m.jump||0.6)*0.6 - pressureOn(m,opps,1)*0.9 + FX(m,"aerialTarget")*1.1;
    const to=box.reduce((b0,m)=> aim(m)>aim(b0)?m:b0, box[0]);
    const dist=Math.hypot((to.x-carrier.x)*PITCH_AR, to.y-carrier.y);
    // 골라인에 아주 가까우면 낮게 빼주는 컷백, 아니면 띄워 올린다.
    // 코너킥은 코너 플래그가 골라인 위라 컷백 조건에 걸리지만, 실제로는 언제나 띄워 올린다.
    const type = (!forceAerial && advOf(carrier,dir)>0.86) ? CROSS_TYPE.CUTBACK : CROSS_TYPE.BYLINE;
    return {type, to, dist, score:1, aerial:forceAerial ? true : type!==CROSS_TYPE.CUTBACK, boxMates:box.length};
  }
  /* 프리킥을 무엇으로 처리할지 고른다 — "shot"(직접) / "cross"(박스로) / "short"(짧게).
     실제 팀의 판단 그대로다: 각이 서고 사거리면 때리고, 옆이거나 조금 멀면 박스로 올리고,
     너무 멀거나 각이 죽었으면 짧게 연결해 다시 만들어 간다. */
  chooseFreeKickPlan(kicker, spot, distM, side, indirect){
    const dir=kicker.dir;
    const central=Math.pow(1-clamp(Math.abs(spot.y-0.5)/0.34, 0, 1), 1.5);
    const adv=dir>0?spot.x:1-spot.x;
    // 박스 안에서 머리를 댈 수 있는 동료가 몇이나 되는가 — 크로스의 가치를 정한다
    let tall=0;
    for(const m of this.side(side)){
      if(m.slot==="GK" || m.id===kicker.id) continue;
      if((m.headSkill||0.5)>0.55 || (m.jump||0.5)>0.55) tall++;
    }
    // 직접 슛 — 사거리 안 + 각이 서 있어야 한다.
    // 간접 프리킥(오프사이드 재개 등)은 규칙상 직접 득점이 안 되므로 아예 후보에서 뺀다.
    let wShot = (!indirect && distM<FK_DIRECT_M)
      ? Math.max(0, 0.02 + central*0.34 + (kicker.fkSkill||0.5)*0.34 - clamp((distM-20)/18,0,1)*0.42)
      : 0;
    // 크로스 — 골라인에 가깝고(공격 진영), 머리 댈 사람이 있어야 의미가 있다.
    //   너무 가까우면(박스 코앞) 올릴 각이 없고, 너무 멀면 그냥 전개다.
    const crossZone = clamp((adv-0.46)/0.22, 0, 1) * clamp((0.95-adv)/0.12, 0, 1);
    let wCross = crossZone * (0.30 + clamp(tall/8,0,1)*0.45 + (kicker.crossSkill||0.5)*0.35)
               * (0.55 + (1-central)*0.75);            // 옆에서 올릴수록 크로스가 자연스럽다
    // 짧게 — 언제나 가능한 안전한 선택. 멀수록·각이 죽을수록 비중이 커진다.
    let wShort = 0.18 + clamp((distM-26)/22, 0, 1)*0.75 + (1-crossZone)*0.35;
    const tot=wShot+wCross+wShort;
    let r=RNG()*tot;
    if((r-=wShot)<0)  return "shot";
    if((r-=wCross)<0) return "cross";
    return "short";
  }
  /* 페널티킥 — 박스 안 반칙. 키커와 골키퍼만 남고 나머지는 전부 박스 밖으로 물러난다. */
  penaltyKick(side){
    const b=this.ball;
    const mine=this.side(side), dir=mine[0].dir;
    const out={x:b.x, y:b.y};
    const spot={x: dir>0 ? PEN_SPOT_ADV : 1-PEN_SPOT_ADV, y:0.5};
    b.state="SETTLED"; b.aerial=false; b.offsideAt=null; b.toId=null; b.spPlan=null; b.fkIndirect=false; b.isCross=false;
    // 전담 키커 — 감독 지정이 먼저, 없으면 페널티 능력치(침착성 포함)가 가장 좋은 필드 플레이어
    let kicker=this.designatedKicker(side, "pk");
    if(!kicker){
      let bs=-1;
      for(const a of mine){
        if(a.slot==="GK") continue;
        const s=(a.penSkill||0.5);
        if(s>bs){ bs=s; kicker=a; }
      }
    }
    if(!kicker) kicker=mine[0];
    b.ownerId=kicker.id; this.possSide=side; this.lastTouch=side;
    b.isThrow=false; b.fkDirect=false;
    b.isPenalty=true;                                  // 세리머니가 끝나면 무조건 슛이다
    this.beginSetPiece("penalty", kicker, spot, out);
    this.setupSetPiece("penalty", side, spot);
    this.stats[side].pen++;
    if(this.emitEvents) this.say(side, F_(COMM.penGiven,{t:this.rec(side).team.short}), "big", {kind:"sim_pen", side});
    this.markHighlight("pen", side, HL_W.pen);
    this.cap(side, COMM.lvPenLive, {});
  }
  /* 슛을 때린다. 블록 → 굴절 → 유효슈팅 → 키퍼 → 골 순으로 판정한다.
     각 단계는 앞 단계를 통과한 슛만 받으므로, 몸을 던진 수비수 앞에서는 유효슈팅 자체가 나오지 않고
     굴절된 슛은 키퍼가 반응할 방향을 잃는다. */
  resolveShot(shooter, g, type, opts){
    const b=this.ball, side=shooter.side, oKey=this.opp(side);
    const st=this.stats[side], ost=this.stats[oKey];
    const isPen=!!(opts&&opts.penalty), isFK=!!(opts&&opts.freeKick);
    st.shot++;
    this.cap(side, type===SHOT_TYPE.HEADER?COMM.lvHead:(g.distM>22?COMM.lvShotLong:COMM.lvShot), {p:this.nm(shooter)});
    if(type===SHOT_TYPE.HEADER) st.shotHeader++;
    else if(type===SHOT_TYPE.VOLLEY) st.shotVolley++;
    else if(type===SHOT_TYPE.FINESSE) st.shotFinesse++;
    else if(type===SHOT_TYPE.CHIP) st.shotChip++;
    else if(type===SHOT_TYPE.POWER) st.shotPower++;
    else st.shotPlaced++;
    if(g.distM>20) st.shotLong++; else if(g.distM<11) st.shotClose++; else st.shotNormal++;
    this.lastTouch=side;

    const opps=this.side(oKey);
    const gk=opps.find(a=>a.slot==="GK");
    // 페널티킥은 통로에 아무도 없다 — 규칙상 전원 9.15m 뒤에 있으므로 블록 판정 자체를 하지 않는다
    const blk = isPen ? {near:0, far:0, list:[]} : shotLaneBlockers(shooter, opps, g);
    const skill = isPen ? (shooter.penSkill||0.6)
                : isFK ? (shooter.fkSkill||0.6)
                : type===SHOT_TYPE.HEADER ? (shooter.headSkill||0.6)
                : (type===SHOT_TYPE.POWER ? (shooter.lngSkill||0.6) : (shooter.finSkill||0.6));
    // 종류마다 세기가 다르다 — 발리·중거리는 강하게, 감아차기·로빙은 약하게 대신 정교하게
    const POW={HEADER:0.55, VOLLEY:1.28, FINESSE:0.88, CHIP:0.62, POWER:1.20, PLACED:0.95};
    const power = (POW[type]||0.95) + skill*(type===SHOT_TYPE.CHIP?0.22:0.48);

    // ── 결과를 먼저 판정한다. 공은 그 결과 지점을 향해 "날아간 뒤" 상황이 이어진다.
    let outcome=null, ex=g.gx, ey=0.5, actorId=null, deflected=false;
    // 슛의 코스를 먼저 정한다 — 골문 안 어디를 노렸는가. 마무리가 좋을수록 구석을 노린다.
    // 블록·선방 지점도 모두 이 직선 위에서 잡아야 공이 옆이나 뒤로 튀지 않는다.
    const corner = RNG() < 0.25+skill*0.45;
    const aimOff = corner ? 0.72+RNG()*0.26 : RNG()*0.62;
    let aimY = 0.5 + (RNG()<0.5?-1:1)*GOAL_HALF*aimOff;
    const span=(g.gx-shooter.x)||1e-6;
    // 슛 경로 위의 한 점 — 진행률 k(0=발끝, 1=골라인)
    const onLine=(k)=>({x:shooter.x+span*clamp(k,0,1), y:shooter.y+(aimY-shooter.y)*clamp(k,0,1)});

    // 1) 블록 — 앞에 선 수비수가 몸을 던진다. 가까울수록, 통로 중앙일수록 잘 막는다.
    for(const bl of blk.list){
      if(bl.d>0.16) break;
      let pb = BLOCK_P*(1-bl.d/0.16)*(0.60+(bl.o.tackleSkill||0.6)*0.70);
      pb *= 1 - (bl.off/BLOCK_W)*0.50;
      if(RNG()<pb){
        st.shotBlocked++; ost.block++; this.lastAssist=null;   // 수비 몸에 맞음 — 도움 무효 (규정)
        this.cap(oKey, COMM.lvBlock, {p:this.nm(bl.o)});
        // 골문 가까이에서 막힌 공은 상당수가 그대로 골라인을 넘어간다 → 코너킥
        if(g.distM<20 && RNG()<BLOCK_CORNER_P){
          this.stats[shooter.side].shotBlockedOut=(this.stats[shooter.side].shotBlockedOut||0)+1;
          this.lastTouch=bl.o.side;
          this.cornerKick(shooter.side, g.gx, clamp01(bl.o.y+(RNG()-0.5)*0.10));
          return;
        }
        outcome="BLOCK"; actorId=bl.o.id;
        // 막히는 지점도 슛 경로 위다. 수비수가 옆이나 뒤쪽에 서 있어도 공이 그리로 날아가진 않는다.
        const pt=onLine(Math.max(0.10, (bl.o.x-shooter.x)/span));
        ex=pt.x; ey=pt.y;
        break;
      }
    }
    // 2) 굴절 — 막지는 못했지만 발끝·정강이에 스쳐 궤도가 바뀐다
    if(!outcome && blk.list.length && RNG()<0.17){ deflected=true; ost.deflect++; }

    // 3) 유효슈팅 판정 — 각이 좁거나 멀수록, 앞이 막혀 급하게 찰수록 빗나간다
    if(!outcome){
      let acc;
      if(isPen){
        // 11m·무압박·정지된 공 — 실제로도 85% 이상이 골문 안으로 간다
        acc = PEN_ACC_BASE + skill*PEN_ACC_SKILL;
      } else {
        acc = ACC_BASE + skill*0.42 + clamp(g.angle/0.60,0,1)*0.22;
        acc -= clamp(g.distM/SHOT_MAX_M,0,1)*0.24;
        acc -= blk.near*0.05;
        /* 진짜 단독 1대1 — 블로커 0 + 16m 이내 + 몸 근처 3m에 필드 수비수가 아무도 없다.
           (컷백·혼전 리바운드까지 후하게 쳐주면 득점이 폭주한다 — 실측 5.2골/경기) */
        const solo = blk.list.length===0 && g.distM<16 && type!==SHOT_TYPE.HEADER && type!==SHOT_TYPE.VOLLEY
          && !opps.some(o=>o.slot!=="GK" && Math.hypot((o.x-shooter.x)*PITCH_AR,(o.y-shooter.y))<0.043);
        if(solo) acc += 0.20;
        this._soloShot=solo;
        const ACCADJ={HEADER:-0.08, VOLLEY:-0.14, FINESSE:+0.10, CHIP:-0.04, POWER:-0.05, PLACED:+0.06};
        acc += (ACCADJ[type]||0);          // 발리는 맞히기 어렵고, 감아차기·정교한 슛은 코스가 산다
        // 직접 프리킥 — 정지된 공을 준비해서 차므로 코스는 살지만, 벽이 통로를 막고 있다
        if(isFK) acc += 0.12 - Math.max(0, blk.list.length-1)*0.03;
      }
      if(deflected) acc += (RNG()-0.5)*0.35;      // 굴절되면 어디로 갈지 알 수 없다
      if(RNG() > clamp(acc, 0.06, isPen?0.97:0.92)){
        st.shotOff++; this.lastAssist=null;   // 빗나간 슛 — 이후 혼전 득점에 도움 없음
        if(isPen) st.penMiss++;
        if(this.emitEvents){
          this.say(side, F_(COMM.shotOn,{p:shooter.p.name}), "txt");
          this.say(side, F_(COMM.miss,{}), "txt");
        }
        // 빗나갔어도 가까운 거리에서 때린 결정적 장면이면 보여줄 값어치가 있다
        this.cap(side, COMM.lvMiss, {});
        if(g.distM<18) this.markHighlight("miss", side, HL_W.miss);
        outcome="MISS";                                   // 골포스트를 살짝 빗겨 골라인을 넘는다
        aimY = 0.5 + (aimY<0.5?-1:1)*(GOAL_HALF+0.006+RNG()*0.028);
      }
    }
    // 4) 골키퍼 — 멀수록 반응할 시간이 있고, 각이 열려 있거나 굴절된 슛은 막기 어렵다
    if(!outcome){
      st.shotOn++;
      const gkSkill = gk ? (gk.gkSkill||0.6) : 0.6;
      let save;
      if(isPen){
        // 페널티는 방향 싸움이다 — 거리·각도·비행시간 공식이 통하지 않는다.
        // 키퍼 실력이 올리고 키커의 페널티 능력치가 내린다. 평균적으로 20% 남짓 막힌다.
        save = clamp((PEN_SAVE_BASE + gkSkill*PEN_SAVE_GK - skill*PEN_SAVE_KICKER) * meTune("pen"), 0.02, 0.9);
      } else {
      save = clamp((SAVE_BASE + gkSkill*0.46) * meTune("save"), 0.05, 0.97);   // 튠을 크게 올려도 100% 선방은 없다
      save -= clamp(g.angle/0.60,0,1)*0.22;
      save += clamp(g.distM/SHOT_MAX_M,0,1)*0.26;
      save -= (power-1.0)*0.14;
      if(deflected) save -= 0.30;
      // 반사신경 — 공이 날아오는 시간보다 반응 시간이 길면 몸이 따라가지 못한다
      const flightT=Math.max(SIM_DT*SHOT_MIN_TICKS, g.dist/(SHOT_SPEED*power));
      const reactT=0.42-gkSkill*0.22;                        // 0.20~0.35초
      save += clamp((flightT-reactT)*0.38, -0.30, 0.09);
      const SAVEADJ={HEADER:+0.04, VOLLEY:-0.06, FINESSE:-0.10, CHIP:-0.02, POWER:0, PLACED:0};
      save += (SAVEADJ[type]||0);
      // 직접 프리킥 — 벽 너머로 넘어오는 공은 시야가 늦게 열려 반응이 반 박자 늦다
      if(isFK) save -= 0.10;
      }
      // 로빙슛은 키퍼가 나와 있을 때 노리는 슛이라, 앞에 나와 있을수록 막기 어렵다
      if(type===SHOT_TYPE.CHIP && gk) save -= clamp(Math.abs(gk.x-g.gx)*PITCH_AR/GK_OFFLINE,0,2)*0.16;
      // 진짜 단독 1대1 — 수비 커버 없이 슈터가 코스를 고른다. 키퍼 혼자서 다 막아낼 수는 없다.
      if(this._soloShot) save -= 0.17;
      if(RNG() < clamp(save, isPen?0.03:0.06, 0.93)){
        st.shotSaved++; ost.save++; this.lastAssist=null;   // 키퍼 몸에 맞음 — 리바운드 득점에 도움 없음 (규정)
        if(isPen) st.penSaved++;
        if(this.emitEvents) this.say(side, F_(COMM.save,{p:shooter.p.name, g:gk&&gk.p?gk.p.name:"골키퍼"}), "txt");
        this.markHighlight("save", side, HL_W.save);
        this.cap(oKey, COMM.lvSave, {g:gk&&gk.p?gk.p.name:"골키퍼"});
        // 어떻게 막았는가 —
        //   캐칭: 품에 안는다. 세거나 구석으로 오는 공은 잡을 수 없다.
        //   펀칭: 강하게 오는 공은 주먹으로 멀리 걷어낸다.
        //   쳐내기: 앞으로 밀어낸 공이 박스 안에 흐른다(리바운드).
        //   골대 옆으로: 구석으로 오는 공은 손끝으로 밀어 골라인 밖으로 넘긴다 → 코너킥
        const nearPost = Math.abs(aimY-0.5)/GOAL_HALF;      // 0=정면, 1=골포스트 구석
        let hold = 0.34 + gkSkill*0.45 - (power-1.0)*0.30 - clamp(1-g.distM/25,0,1)*0.26 - nearPost*0.32;
        if(deflected) hold -= 0.20;
        if(type===SHOT_TYPE.POWER) hold += 0.12;
        if(type===SHOT_TYPE.CHIP) hold += 0.10;   // 느리게 떠오는 공은 잡기 쉽다
        if(gk && RNG() < clamp(hold, 0.04, 0.85)){ st.shotCaught++; outcome=SAVE_TYPE.CATCH; }
        else if(nearPost>0.70 && RNG()<0.58){ st.shotTipped++; outcome=SAVE_TYPE.TIP; }
        else if(power>1.22 && RNG()<0.24+(gk.gkPunch||0.5)*0.52){ st.shotPunched++; outcome=SAVE_TYPE.PUNCH; }
        else { st.shotParried++; outcome=SAVE_TYPE.PARRY; }
        // 슈퍼세이브 — 막힐 리 없던 슛을 막아냈다
        if((g.distM<14 && g.angle>0.45) || (power>1.32 && nearPost>0.68)) st.superSave++;
        if(gk){ actorId=gk.id; }
      } else {
        st.goal++; if(deflected) st.goalDeflected++;
        if(isPen) st.penGoal++; else if(isFK) st.fkGoal++;
        outcome="GOAL";
        ey = 0.5 + (RNG()-0.5)*2*GOAL_HALF*0.85;   // 골문 안쪽 어딘가
      }
    }

    // 궤도는 언제나 골문을 향한 직선이다. 키퍼가 막는 슛은 그 직선 위에서 키퍼가 서 있는 지점에
    // 멈출 뿐, 공이 키퍼를 따라 휘지 않는다.
    let saveY=null;
    const isSave = (outcome===SAVE_TYPE.CATCH||outcome===SAVE_TYPE.PARRY||
                    outcome===SAVE_TYPE.PUNCH||outcome===SAVE_TYPE.TIP);
    if(isSave){
      const pt=onLine(gk ? (gk.x-shooter.x)/span : 1);
      ex=pt.x; ey=pt.y; saveY=pt.y;                    // 키퍼는 이 지점으로 몸을 날린다
    } else if(outcome!=="BLOCK"){ ex=g.gx; ey=aimY; }

    // ── 공을 실제로 날린다. 결과는 도착한 뒤에 적용된다.
    b.state="SHOT"; b.ownerId=null; b.toId=null;
    b.isCross=false; b.offsideAt=null; b.isThrow=false; b.aerial=false; b.setPiece=null;
    b.sx=shooter.x; b.sy=shooter.y;
    b.x=shooter.x;  b.y=shooter.y;
    b.tx=clamp01(ex); b.ty=clamp01(ey);
    b.power=power;
    b.flight=0;
    b.flightLen=Math.hypot((b.tx-b.sx)*PITCH_AR, b.ty-b.sy);
    // 슛의 높이 — 대부분 낮게 깔지만 일부는 골문 위쪽을 노린다. 헤딩은 위에서 아래로 꽂는다.
    // 도착 높이 — 헤더는 아래로 찍고, 로빙은 키퍼 키를 넘겨 떨어뜨리고, 중거리는 낮게 깔린다
    let aimZ;
    if(type===SHOT_TYPE.HEADER)      aimZ=CROSSBAR_Z*(0.05+RNG()*0.20);
    else if(type===SHOT_TYPE.CHIP)   aimZ=CROSSBAR_Z*(0.55+RNG()*0.35);
    else if(type===SHOT_TYPE.POWER)  aimZ=CROSSBAR_Z*RNG()*0.35;
    else if(type===SHOT_TYPE.VOLLEY) aimZ=CROSSBAR_Z*(0.15+RNG()*0.55);
    else aimZ=(RNG()<0.30 ? CROSSBAR_Z*(0.40+RNG()*0.50) : CROSSBAR_Z*RNG()*0.30);
    const spd  = SHOT_SPEED*power;
    const T    = Math.max(SIM_DT*SHOT_MIN_TICKS, b.flightLen/spd);
    b.vx=(b.tx-b.sx)*PITCH_AR/T; b.vy=(b.ty-b.sy)/T;
    // 출발 높이 — 헤더는 머리에서, 발리는 뜬 공 그대로, 나머지는 발밑
    b.z = type===SHOT_TYPE.HEADER ? CROSSBAR_Z*0.80
        : type===SHOT_TYPE.VOLLEY ? Math.max(VOLLEY_Z, b.z||0) : 0.0008;
    b.z0=b.z; b.vz=0;
    // 감아차기 — 경로 옆으로 부풀렸다가 코스로 되돌아오는 바나나 궤적.
    // (매 틱 수직 가속도를 누적하는 것과 같은 모양이지만, 도착점이 어긋나지 않는다)
    b.curve = type===SHOT_TYPE.FINESSE
            ? (shooter.y<0.5?1:-1)*CURVE_MAX*(0.55+(shooter.finSkill||0.6)*0.7)
            : (type===SHOT_TYPE.POWER ? (RNG()-0.5)*CURVE_MAX*0.35 : 0);
    b.inNet=false; b.bounced=0;
    b.aimZ=aimZ; b.flightT=T;
    // distM·isPen·isFK 는 골 해설을 고르는 데 쓴다 (헤더골·발리골·중거리포·PK 골을 구분해서 말한다)
    b.shot={outcome, side, oKey, actorId, deflected, type, gx:g.gx, fromY:shooter.y, shooterId:shooter.id,
            aimY, saveY, aimZ, distM:g.distM, isPen, isFK, solo:(shooter.burstUntil||0)>this.t};
    this.lastEvent={kind:outcome, type, side, t:this.t};
  }
  /* 슛한 공이 날아가는 동안 — 골문(또는 블로커·키퍼)까지 실제로 이동한다.
     이게 없으면 슛을 때리는 순간 공이 결과 지점으로 순간이동해서, 슛도 그 다음 상황도 보이지 않는다. */
  advanceShot(){
    const b=this.ball, sh=b.shot;
    b.flight+=SIM_DT;
    const px=b.x, py=b.y;
    const total=b.flightT||Math.max(SIM_DT*SHOT_MIN_TICKS, b.flightLen/(SHOT_SPEED*(b.power||1)));
    const p=clamp01(b.flight/total);
    b.x=clamp01(lerp(b.sx, b.tx, p)); b.y=clamp01(lerp(b.sy, b.ty, p));
    // 높이 — 출발 높이에서 목표 높이(aimZ)까지, 중력에 눌린 포물선
    const z0=b.z0||0, z1=b.aimZ||0;
    b.z=Math.max(0, lerp(z0, z1, p) + loftPeak(total)*1.2*p*(1-p));
    // 감아차기 — 경로에 수직인 방향으로 부풀린다. 중간에서 가장 크게 휘고 코스에서 만난다.
    if(b.curve){
      const dx=(b.tx-b.sx)*PITCH_AR, dy=b.ty-b.sy, dl=Math.hypot(dx,dy)||1e-6;
      const bulge=b.curve*Math.sin(Math.PI*p);
      b.x=clamp01(b.x + (-dy/dl)*bulge/PITCH_AR);
      b.y=clamp01(b.y + ( dx/dl)*bulge);
    }
    b.vx=(b.x-px)*PITCH_AR/SIM_DT; b.vy=(b.y-py)/SIM_DT;
    // 골라인 평면을 넘는 순간 — 골포스트·크로스바에 맞았는지 본다
    if(sh){
      const gx=sh.gx;
      const crossed = gx>0.5 ? (px<gx && b.x>=gx) : (px>gx && b.x<=gx);
      if(crossed){
        const k=Math.abs(gx-px)/Math.max(1e-6, Math.abs(b.x-px));
        const yAt=lerp(b.y-b.vy*SIM_DT, b.y, k);
        const zAt=Math.max(0, b.z - b.vz*SIM_DT*(1-k));
        const off=Math.abs(yAt-0.5);
        const hitPost = Math.abs(off-GOAL_HALF)<GOAL_POST && zAt<CROSSBAR_Z;
        const hitBar  = off<GOAL_HALF+GOAL_POST && Math.abs(zAt-CROSSBAR_Z)<GOAL_POST*1.6;
        if(hitPost || hitBar){
          this.stats[sh.side].woodwork++;
          this.lastAssist=null;                     // 골대 굴절 — 이후 득점은 도움 없음 (규정)
          this.lastEvent={kind:hitBar?"CROSSBAR":"POST", side:sh.side, t:this.t};
          b.x=clamp01(gx - (gx>0.5?1:-1)*0.004); b.y=clamp01(yAt); b.z=Math.max(0,zAt);
          if(hitBar){ b.vz=-Math.abs(b.vz)*POST_BOUNCE; b.vx*=-POST_BOUNCE*0.6; }
          else { b.vx*=-POST_BOUNCE; b.vy=(yAt<0.5?-1:1)*Math.abs(b.vy||0.05)*POST_BOUNCE; }
          b.shot=null; b.state="LOOSE"; b.looseT=0; b.looseBy=sh.side;
          b.ownerId=null; b.toId=null; b.aerial=b.z>0.004;
          return;                                   // 골대를 맞고 튕겨 나왔다
        }
        if(off<GOAL_HALF && zAt<CROSSBAR_Z && sh.outcome!=="GOAL"){
          // 코스는 골문 안이지만 결과는 골이 아니다(키퍼가 막았다) — 그 자리에서 결과를 적용
        }
      }
    }
    if(p>=1) this.finishShot();
  }
  /* 슛이 도착했다 — 결과에 따라 다음 상황으로 이어진다. */
  finishShot(){
    const b=this.ball, sh=b.shot;
    b.shot=null; b.state="SETTLED";
    if(!sh){ this.kickoff(this.possSide); return; }
    const {outcome, side, oKey, actorId, gx, fromY}=sh;
    switch(outcome){
      case "BLOCK": {                                  // 막힌 공이 수비수 몸을 맞고 튕겨 나온다
        const bl=this.byId(actorId);
        if(!bl){ this.goalKick(oKey); return; }
        // 되돌아오는 방향 — 슛이 온 쪽으로 되튀되 좌우로 크게 흩어진다
        const backAng=Math.atan2(b.sy-b.y, (b.sx-b.x)*PITCH_AR);
        const ang=backAng+(RNG()-0.5)*2.2;
        this.launchLoose(b.x, b.y, ang, 8+RNG()*13, side, false);       // 몸에 맞고 8~21m 튄다
        return;
      }
      case "MISS":  this.lastEvent={kind:"MISS", side, t:this.t};
                    this.goalKick(oKey); return;       // 골라인을 넘었다 → 상대 골킥
      case SAVE_TYPE.CATCH: {                          // 캐칭 — 품에 안았다. 그대로 소유권이 넘어간다.
        const gk=this.byId(actorId);
        if(gk){ this.giveTo(gk); b.hold=(3.0+RNG()*2.0)*TEMPO; } else this.goalKick(oKey);
        return;
      }
      case SAVE_TYPE.TIP: {                            // 손끝으로 밀어 골대 옆으로 넘겼다 → 코너킥
        const gk=this.byId(actorId); if(gk) gk._down=this.t+DIVE_HOLD;
        this.cornerKick(side, gx, b.y);
        return;
      }
      case SAVE_TYPE.PUNCH: {                          // 펀칭 — 주먹으로 멀리, 박스 밖으로 걷어낸다
        const gk=this.byId(actorId); if(gk) gk._down=this.t+DIVE_HOLD*0.6;
        const away = gx>0.5 ? Math.PI : 0;              // 골문 반대 방향
        const ang = away + (RNG()-0.5)*1.5;
        this.launchLoose(b.x, b.y, ang, 17+RNG()*11, oKey, true);       // 주먹으로 17~28m (최종 정지 지점까지)
        return;
      }
      case SAVE_TYPE.PARRY: {           // 쳐내기 — 앞으로 밀어낸 공이 박스 안에 흐른다
        const gk=this.byId(actorId); if(gk) gk._down=this.t+DIVE_HOLD;
        const away = gx>0.5 ? Math.PI : 0;
        const ang = away + (RNG()<0.5?-1:1)*(0.5+RNG()*1.0);   // 옆으로 비스듬히
        this.launchLoose(b.x, b.y, ang, 6+RNG()*9, oKey, false);        // 앞으로 6~15m 흘린다
        return;
      }
      default: {                                       // 골 — 공은 그물에 걸려 흔들리다 멈춘다
        // 늦게 올라간 깃발 — 골이 들어간 뒤에야 오프사이드가 선언된다
        if(this.pendingOff && this.pendingOff.by===side && this.t<=this.pendingOff.until){
          this.disallowGoal(side, sh);
          return;
        }
        /* 📺 VAR 온필드 리뷰 — 실제 경기(emitEvents)에서만, 낮은 확률로.
           환호가 터진 직후 주심이 헤드셋에 손을 얹고, 몇 초 뒤 인정/취소가 갈린다. */
        if(this.emitEvents && !sh.isPen && RNG()<VAR_CHECK_P){   // [KMD26 PK-02] PK 골은 판독 대상이 아니다
          this.lastEvent={kind:"VAR", side, t:this.t};
          this.markHighlight("goal", side, HL_W.goal);
          b.inNet=true; b.vx*=0.55; b.vy*=0.55; b.vz*=0.35; b.ownerId=null;
          b.celebrate={t:0, side, oKey, scorerId:sh.shooterId, varCheck:true, varSh:sh};
          // VAR 검토 중에는 ⚽ 이름표를 달지 않는다 — 인정이 확정된 순간(아래 확정 처리)에 단다
          this.syncClock();
          const nm=this.nm(this.byId(sh.shooterId));
          this.say(side, F_(COMM.varCheck, Object.assign({p:nm}, refVars(this.M))), "info", {kind:"var_check", side});
          this.cap(side, COMM.lvGoalLive, {p:nm});
          const t0=this.t;
          this.caps.push({t:t0+1.6, side, txt:F_(COMM.lvVarWait,{})});
          if(this.caps.length>HL_CAP_MAX) this.caps.shift();
          return;
        }
        this.score[side]++;
        this.lastEvent={kind:"GOAL", type:sh.type, side, t:this.t};
        this.recordGoal(side, sh);
        this.goalCommentary(side, sh);
        this.markHighlight("goal", side, HL_W.goal);
        b.inNet=true;                                  // 그물 저항 → 급격히 감속
        b.vx*=0.55; b.vy*=0.55; b.vz*=0.35;
        b.celebrate={t:0, side, oKey, scorerId:sh.shooterId};
        { const _sid=(b.celebrate&&b.celebrate.scorerId)||null, _prev=this.goalTag;
          this.goalTag={sid:_sid, aid:(_prev&&_prev.sid===_sid)?_prev.aid:null, until:this.t+6}; }   // 도움(recordGoal이 채움)을 덮어쓰지 않는다
        b.ownerId=null;
        return;
      }
    }
  }
  /* 골 세리머니 — 득점자가 코너 쪽으로 달려나가면 동료들이 우르르 몰려가 껴안고,
     실점한 팀은 고개를 숙인 채 자기 진영으로 걸어 돌아간다. 끝나면 킥오프. */
  advanceCelebration(){
    const b=this.ball, cel=b.celebrate;
    cel.t+=SIM_DT;
    const scorer=this.byId(cel.scorerId);
    /* 📺 판독 중 — 시간이 되면 결과가 나온다 */
    if(cel.varCheck && !cel.varDone && cel.t>=VAR_DECIDE_SECS){
      cel.varDone=true;
      const sh=cel.varSh||{shooterId:cel.scorerId};
      const nm=this.nm(this.byId(cel.scorerId));
      /* 심판진 관계 — 애매한 판독에서 아주 조금 작용한다 (유저 팀 골일 때만) */
      let okP=VAR_CONFIRM_P;
      try{ const sd=cel.side==="h"?this.M.h:this.M.a;
        if(sd&&sd.team&&sd.team.isUser) okP=clamp(okP+refBias()*0.06, 0.35, 0.85); }catch(e){}
      if(RNG()<okP){
        cel.varCheck=false;                            // 인정 — 남은 세리머니를 이어 간다
        this.score[cel.side]++;
        this.lastEvent={kind:"GOAL", side:cel.side, t:this.t};
        this.recordGoal(cel.side, sh);
        if(this.emitEvents) this.say(cel.side, F_(COMM.varConfirm, refVars(this.M)), "goal", {kind:"sim_goal", side:cel.side, scorerId:cel.scorerId});
        this.cap(cel.side, COMM.lvVarOk, {p:nm});
      } else {
        cel.disallowed=true; cel.varCheck=false; cel.t=CELEBRATE_OFF_SECS*0.45;   // 취소 — 짧게 끊는다
        cel.offSpot={x:this.ball.x, y:this.ball.y, by:cel.side};
        const st=this.stats[cel.side];
        st.goalDisallowed=(st.goalDisallowed||0)+1;
        if(this.emitEvents){
          this.syncClock();
          this.say(cel.side, F_(RNG()<0.5?COMM.varOverturnOffside:COMM.varOverturnFoul, Object.assign({p:nm}, refVars(this.M))), "bad", {kind:"var_overturn", side:cel.side});
        }
        this.cap(cel.side, COMM.lvVarNo, {p:nm});
      }
    }
    const dur = cel.disallowed ? CELEBRATE_OFF_SECS : (cel.varCheck ? VAR_DECIDE_SECS+2 : CELEBRATE_SECS);
    if(!scorer || (cel.t>=dur && !(cel.varCheck&&!cel.varDone))){
      b.celebrate=null;
      if(cel.disallowed){
        // 취소된 골 — 킥오프가 아니라 오프사이드 지점에서 수비 팀 간접 프리킥
        const o=cel.offSpot;
        this.freeKick(this.opp(o.by), {x:o.x, y:o.y}, true);
      } else this.kickoff(cel.oKey);                    // 실점한 팀이 킥오프
      return;
    }
    /* 판독 중 — 환호 대신 주심 주변으로 모여 서성인다 */
    if(cel.varCheck && !cel.varDone){
      for(const a of this.agents){
        if(a.slot==="GK") continue;
        const ang=(a.seed%360)*Math.PI/180;
        const tx=0.5+Math.cos(ang)*0.07, ty=0.30+Math.sin(ang)*0.06;
        const mx=(tx-a.x)*PITCH_AR, my=ty-a.y, ml=Math.hypot(mx,my);
        if(ml>1e-6){ const st2=Math.min(ml, SPD.JOG*SIM_DT);
          a.x=clamp01(a.x+(mx/ml)*st2/PITCH_AR); a.y=clamp01(a.y+(my/ml)*st2); }
      }
      if(b.inNet){ stepBallPhysics(b); if(Math.hypot(b.vx,b.vy)<BALL_STOPV && b.z<=0) b.inNet=false; }
      return;
    }
    // 득점자는 자기가 넣은 쪽 코너 깃발로 달려나간다
    const cornerX = scorer.dir>0 ? 0.94 : 0.06;
    const cornerY = scorer.y<0.5 ? 0.10 : 0.90;
    const rush = clamp01(cel.t/4.5);                   // 4.5초 동안 몰려갔다가 이후 자리로 복귀
    const back = cel.t>CELEBRATE_SECS-7 ? clamp01((cel.t-(CELEBRATE_SECS-7))/7) : 0;
    for(const a of this.agents){
      if(a.slot==="GK") continue;
      let tx, ty, spd;
      if(a.side===cel.side){
        if(a.id===scorer.id){ tx=cornerX; ty=cornerY; spd=SPD.SPRINT; }
        else {                                          // 동료들이 득점자에게 몰려간다
          const ang=(a.seed%360)*Math.PI/180;
          tx=cornerX+Math.cos(ang)*0.035; ty=cornerY+Math.sin(ang)*0.045; spd=SPD.SPRINT;
        }
      } else {                                          // 실점한 팀은 하프라인 쪽으로 터덜터덜
        tx=0.5-a.dir*0.10; ty=a.home.y; spd=SPD.JOG*0.7;
      }
      if(back>0){                                       // 끝나갈 무렵엔 킥오프 자리로 돌아간다
        const anchor=tacticalAnchorXY(a.team, a.slot, "DEF", a.isHome);
        tx=lerp(tx, anchor.x, back); ty=lerp(ty, anchor.y, back); spd=SPD.SPRINT;
      } else if(a.side===cel.side && rush<1){
        spd=SPD.SPRINT;
      }
      const mx=(tx-a.x)*PITCH_AR, my=ty-a.y, ml=Math.hypot(mx,my);
      if(ml>1e-6){
        const step=Math.min(ml, spd*SIM_DT);
        a.x=clamp01(a.x+(mx/ml)*step/PITCH_AR);
        a.y=clamp01(a.y+(my/ml)*step);
      }
    }
    // 골망에 걸린 공은 잠시 흔들리다 멈춘다
    if(b.inNet){ stepBallPhysics(b); b.x=clamp01(b.x); b.y=clamp01(b.y);
      if(Math.hypot(b.vx,b.vy)<BALL_STOPV && b.z<=0) b.inNet=false; }
  }
  /* 공에 속도를 줘서 굴러가게 한다. 방향(rad, iso 기준)과 세기(iso/초)를 받는다.
     aerial 이면 떠서 날아가므로 굴러가는 도중에는 아무도 잡지 못한다(펀칭 등). */
  launchLoose(x, y, ang, runM, byside, aerial){
    const b=this.ball;
    b.state="LOOSE";
    b.x=clamp01(x); b.y=clamp01(y);
    // 굴러갈 거리(m)를 받아 초기 속도를 역산한다. 마찰로 감속하며 대략 그만큼 가서 멈춘다.
    const D=runM/ISO_TO_M;
    if(aerial){                                  // 떠서 날아간다 — 포물선
      // ⚠ runM 은 "최종적으로 멈추는 곳까지의 거리"다.
      //    공중볼은 첫 착지 뒤에도 바운스하며 계속 굴러가기 때문에, 첫 비행 거리를 그대로 runM 으로 잡으면
      //    실제로는 세 배 가까이 날아간다(펀칭 지시 30m → 실측 76m, 최대 96m — 피치를 가로지른다).
      //    그래서 비행 구간은 전체의 일부만 담당하게 나눠 준다.
      const Dfly=D/AERIAL_ROLLOUT;
      const T=clamp(Dfly*2.6, 0.6, 1.8);
      b.vz=GRAVITY*T/2; b.vx=Math.cos(ang)*Dfly/T; b.vy=Math.sin(ang)*Dfly/T; b.z=0.0008;
    } else {                                     // 잔디 위를 구른다 — 마찰로 D 만큼 가서 멈춘다
      const v0=D*(1-GRASS_FRICTION)/SIM_DT;
      b.vx=Math.cos(ang)*v0; b.vy=Math.sin(ang)*v0; b.z=0; b.vz=0;
    }
    b.inNet=false; b.bounced=0;
    b.looseT=0; b.looseBy=byside; b.aerial=!!aerial;
    b.ownerId=null; b.toId=null; b.isCross=false; b.offsideAt=null; b.setPiece=null;
    this.lastTouch=byside;
  }
  /* 굴러가는 공 — 마찰로 느려지고, 가까이 온 선수가 잡거나, 멈추면 가장 가까운 선수에게 간다.
     굴러가다 라인을 넘으면 그 자리에서 아웃 판정(코너킥·스로인·골킥)이 난다. */
  advanceLoose(){
    const b=this.ball;
    b.looseT+=SIM_DT;
    stepBallPhysics(b);
    if(b.x<0 || b.x>1 || b.y<0 || b.y>1){
      if(this.outOfPlay(b.x, b.y, b.looseBy)) return;
      b.x=clamp01(b.x); b.y=clamp01(b.y);
    }
    b.aerial = b.z > 0.004;                                 // 아직 떠 있는가
    const sp=Math.hypot(b.vx, b.vy)*SIM_DT;
    // 머리 위로 뜬 공은 발로 잡을 수 없다
    if(b.z < CTRL_Z && b.looseT>=LOOSE_GRACE && sp<LOOSE_CATCH_V){
      let best=null, bd=1e9;
      for(const a of this.agents){
        if(a._down && a._down>this.t) continue;         // 넘어져 있는 선수는 못 잡는다
        let d=Math.hypot((a.x-b.x)*PITCH_AR, a.y-b.y);
        if(a.slot==="GK") d*=0.75;                      // 박스 안이면 키퍼가 먼저 덮친다
        if(d<bd){ bd=d; best=a; }
      }
      if(best && bd<LOOSE_PICKUP){ this.giveTo(best); return; }
    }
    if((sp<LOOSE_STOP && b.z<=0) || b.looseT>LOOSE_MAXT){   // 공이 멈췄다
      b.aerial=false; b.z=0; b.vx=0; b.vy=0; b.vz=0;
      let best=null, bd=1e9;
      for(const a of this.agents){
        if(a._down && a._down>this.t) continue;
        const d=Math.hypot((a.x-b.x)*PITCH_AR, a.y-b.y);
        if(d<bd){ bd=d; best=a; }
      }
      if(!best){ this.goalKick(this.opp(b.looseBy)); return; }
      if(bd<LOOSE_PICKUP*1.8){ this.giveTo(best); return; }
      // 아직 멀다 — 순간이동시키지 않고, 가장 가까운 선수가 달려와 줍게 한다
      best._chase={x:b.x, y:b.y, until:this.t+CHASE_MAXT};
      this.tryBurst(best);
      b.looseT=Math.min(b.looseT, LOOSE_MAXT-0.4);
      if(b.looseT>LOOSE_MAXT*2.6) this.giveTo(best);        // 아주 오래 방치되면 정리
    }
  }
  /* 아무도 소유하지 못한 루즈볼 — 근처에서 가장 가까운 선수가 잡는다 */
  looseBall(near, outChance){
    const b=this.ball;
    const deep=(near.dir>0 ? near.x : 1-near.x) < 0.32;   // 자기 골문 가까이
    let nx, ny;
    if(deep && RNG()<(outChance==null?0.55:outChance)){
      // 급하게 걷어낸 공이 자기 골라인을 넘어간다 → 상대 코너킥
      nx = near.x - near.dir*(0.10+RNG()*0.18);
      ny = clamp01(near.y+(RNG()-0.5)*0.34);
    } else {
      nx = near.x+(RNG()-0.5)*0.14;
      ny = near.y+(RNG()-0.5)*0.20;
    }
    // 순간이동시키지 않는다 — 그 방향으로 실제로 굴려 보낸다
    const ang=Math.atan2(ny-b.y, (nx-b.x)*PITCH_AR);
    const runM=Math.hypot((nx-b.x)*PITCH_AR, ny-b.y)*ISO_TO_M;
    this.launchLoose(b.x, b.y, ang, Math.max(3, runM), near.side, false);
  }
  /* 공중볼 경합 — 롱패스가 떨어지는 지점에서 양 팀이 헤딩으로 다툰다 */
  aerialDuel(){
    const b=this.ball;
    const near=this.agents.filter(a=>a.slot!=="GK" && a._down!==undefined ? (!a._down || a._down<=this.t) : true)
      // 큰 선수는 조금 더 멀리서도 머리를 갖다 댄다 — 도달 반경에 신장을 반영한다
      .filter(a=>Math.hypot((a.x-b.x)*PITCH_AR, a.y-b.y) < AERIAL_RANGE*(1+((a.body&&a.body.tall)||0)*0.10));
    if(near.length<2) return null;
    let best=null, bs=-1;
    for(const a of near){
      // 대담성이 낮으면 50:50 공중볼에서 몸을 사린다 — 경합 자체를 덜 한다
      if((a.bravery||0.6) < 0.45 && RNG() > 0.35+(a.bravery||0.6)) continue;
      const sc=a.headSkill*(0.55+(a.bravery||0.6)*0.25)*(0.6+RNG()*0.8);
      if(sc>bs){ bs=sc; best=a; }
    }
    if(!best) best=near[0];
    for(const a of near) this.stats[a.side].aerial++;
    if(best){ this.stats[best.side].aerialWon++; this.cap(best.side, COMM.lvAerial, {p:this.nm(best)}); }
    // 공중볼은 몸이 부딪히는 경합이라 파울이 잦다 — 진 쪽이 밀거나 팔을 쓴다
    if(best && near.length>=2 && RNG()<AERIAL_FOUL_P*meTune("foul")){
      // 경고 받은 선수는 공중볼에서도 몸을 사린다 — 경고누적 퇴장이 쏟아지지 않게
      const losers=near.filter(a=>a.side!==best.side && ((a.yellows||0)===0 || RNG()<BOOKED_CAUTION));
      if(losers.length){
        const o=losers[Math.floor(RNG()*losers.length)];
        this.stats[o.side].foul++; this.stats[best.side].freeKick++;
        this.startFoulScene(o, best, false, (o.dir>0?o.x:1-o.x)<0.34);
        return null;
      }
    }
    return best;
  }
  /* 한 틱 진행 + 녹화.
     ⚠ tickCore 안에는 조기 return 이 여섯 군데 있다(세리머니·반칙·슛 비행·흐른 공·킥오프·세트피스).
        녹화를 그 안쪽 맨 아래에 두면 정작 보여줘야 할 장면 — 날아가는 슛, 키퍼 선방, 골대 맞고
        튀는 공, 골 세리머니 — 이 전부 녹화에서 빠진다. 그래서 바깥에서 감싸 무조건 남긴다. */
  tick(){
    this.halfTimeCheck();
    this.injuryCheck(); this.processHurt(); this.tickCore(); this.recordFrame();
    this.drainStamina();
    this.subCheck();
  }
  /* 상대 벤치도 경기를 본다 — 분이 바뀔 때마다 한 번씩 교체를 검토한다.
     이게 없던 시절 2D 엔진에서는 AI가 90분 내내 한 명도 바꾸지 않았다. */
  subCheck(){
    const m=Math.floor(this.clock/60);
    if(this._subMin===m) return;
    this._subMin=m;
    this.syncClock();
    // [KMD26 SUB-02] 45분 전에도 부른다 — 부상으로 빈 자리는 교체 창을 기다리지 않는다
    aiSubs(this.M, m);
    // 교체된 선수는 그라운드에서 내보내고, 들어온 선수를 새로 세운다
    if(this.M.subQueue && this.M.subQueue.length) this.resyncSquads();
  }
  /* ── 체력 소모 ────────────────────────────────────────────────
     예전에는 분 단위 엔진(stepMinute)에서만 체력을 깎았다. 그래서 감독이 직접 보는 경기,
     즉 연속 2D 엔진으로 치르는 경기에서는 후반이 되어도 전원 체력 100 이었다.
     여기서는 "얼마나 뛰었는가"를 실제로 센다 — 많이 뛴 선수가 더 지친다. */
  drainStamina(){
    // 매 틱 이동 거리를 쌓아 둔다 (스프린트한 선수가 더 많이 지치게)
    for(const a of this.agents){
      const d=Math.hypot((a.x-(a._fx!=null?a._fx:a.x))*PITCH_AR, a.y-(a._fy!=null?a._fy:a.y));
      a._work=(a._work||0)+d;
      a._fx=a.x; a._fy=a.y;
    }
    const m=Math.floor(this.clock/60);
    if(this._fitMin===undefined){ this._fitMin=m; return; }
    if(m<=this._fitMin) return;
    const mins=m-this._fitMin; this._fitMin=m;
    for(const [key, sd] of [["h",this.M.h],["a",this.M.a]]){
      const cf=condFactor(sd.team);
      for(const x of onPitch(sd)){
        const a=this.agents.find(q=>q.id===x.p.id);
        // 평균적인 1분 이동량을 1.0으로 본다 — 그보다 많이 뛰었으면 그만큼 더 지친다
        const work = a ? clamp((a._work||0)/(STAM_REF_RUN*mins), 0.55, 1.45) : 1;
        if(a) a._work=0;
        // 타고난 체력(nat)·지구력(sta)이 좋으면 덜 지친다
        const natK = x.p.attr ? clamp(1.24 - (attr20(x.p.attr.nat)-10)*0.026 - (attr20(x.p.attr.sta)-10)*0.014, 0.72, 1.26) : 1;
        const drop = (STAM_PER_MIN*cf + RNG()*0.14) * work * natK * mins;
        x.fit=Math.max(25, x.fit - drop);
      }
    }
  }
  /* 전반이 끝나면 진영을 바꾸고 후반 킥오프. 공이 살아 있는 도중에 자르면 어색하므로
     플레이가 끊긴 순간을 기다리되, 30초 넘게 안 끊기면 그냥 끊는다. */
  halfTimeCheck(){
    if(this._endsSwapped) return;
    if(this.clock < SIM_SECONDS/2) return;
    const b=this.ball;
    const settled = !b.celebrate && !b.foulScene && !b.setPiece && b.state!=="SHOT";
    if(!settled && this.clock < SIM_SECONDS/2 + 30) return;
    this._endsSwapped=true;
    this.switchEnds();
    this.kickoff(this.firstKickSide==="h" ? "a" : "h");   // 후반은 반대 팀이 찬다
  }
  tickCore(){
    const b=this.ball;
    this.checkMatchRules();                // 지금 경기가 어떤 상태인가
    if(b.celebrate){                       // 세리머니 중에는 경기가 멈춘다
      this.advanceCelebration();
      this.stats.ticks++; this.t+=SIM_DT;
      return;
    }
    if(b.foulScene){                       // 반칙 장면 — 심판이 다가가 판정할 때까지 멈춘다
      this.advanceFoulScene();
      this.stats.ticks++; this.t+=SIM_DT;
      return;
    }
    this.moveReferee();
    this.moveAgents();
    if(b.state==="SHOT"){ this.advanceShot(); this.stats[this.possSide].poss++; this.stats.ticks++; this.t+=SIM_DT; return; }
    if(b.state==="LOOSE"){ this.advanceLoose(); this.stats[this.possSide].poss++; this.stats.ticks++; this.t+=SIM_DT; return; }
    if(b.state==="SETTLED"){
      const carrier=this.byId(b.ownerId);
      if(!carrier){ this.kickoff(this.possSide); return; }
      if(b.setPiece){ this.advanceSetPiece(); this.stats[this.possSide].poss++; this.stats.ticks++; this.t+=SIM_DT; return; }
      this.rollBall(carrier);
      if(!this.tryTackle(carrier)){
        b.hold-=SIM_DT;
        if(b.hold<=0) this.decide(carrier);
      }
    } else if(b.state==="PASS"){
      this.advancePass();
    }
    // 통계
    this.stats[this.possSide].poss++;
    this.stats.ticks++;
    const zx = this.possSide==="h" ? b.x : 1-b.x;   // 소유팀 기준 공격 방향으로 정규화
    if(zx<1/3) this.stats.thirds.def++; else if(zx<2/3) this.stats.thirds.mid++; else this.stats.thirds.att++;
    this.t+=SIM_DT;
  }
  /* 전광판에 찍히는 경기 시간 — 시뮬레이션 시간과 분리돼 있다 */
  get clock(){ return this.t*MATCH_CLOCK_SCALE; }
  run(seconds){
    const end=seconds||SIM_SECONDS;
    let guard=0;
    /* [KMD26 PK-03] 경기는 PK 가 끝나야 끝난다.
       실제 축구도 종료 직전 PK 가 선언되면 그 킥이 마무리될 때까지 시간을 연장한다.
       판정 대기 → 세트피스 준비 → 슛이 날아가는 구간까지가 '아직 안 끝난 PK'다.
       키퍼가 쳐낸 뒤의 세컨볼은 연장 대상이 아니다 (경기규칙과 같다). */
    const penPending=()=>{ const b=this.ball||{};
      return !!(b.isPenalty
             || (b.foulScene && b.foulScene.pen)
             || (b.setPiece && b.setPiece.kind==="penalty")
             || (b.shot && b.shot.isPen)); };
    while((this.clock<end || penPending()) && guard++<200000){
      this.tick();
      // 하프타임 — 해설에 한 줄 남긴다 (실제 경기 모드일 때만)
      if(this.emitEvents && !this.halfDone && this.clock>=SIM_SECONDS/2){
        this.halfDone=true;
        this.syncClock(); this.syncStats();
        this.say(null, `⏸ 전반 종료 — ${this.M.home.short} ${this.M.hg} : ${this.M.ag} ${this.M.away.short}`, "info", {kind:"ht"});
      }
    }
    if(this.emitEvents) this.finishMatch();
    return this.report();
  }
  /* 경기 종료 — M을 시즌 시스템이 읽을 수 있는 완성된 상태로 만든다 */
  finishMatch(){
    const M=this.M;
    this.syncStats();
    M.min=Math.floor(SIM_SECONDS/60);
    M.half=2; M.done=true;
    // 출전 시간 — 교체가 없으면 전원 풀타임으로 기록된다
    for(const sd of [M.h, M.a]) for(const x of sd.list){ if(x.off===null && !x.red) x.off=null; }
    this.say(null, `🏁 경기 종료 — ${M.home.short} ${M.hg} : ${M.ag} ${M.away.short}`, "info", {kind:"ft"});
  }
  /* 실제 축구 통계와 비교할 수 있는 형태로 뽑는다 */
  report(){
    const s=this.stats, tot=s.ticks||1;
    const per=(k)=>{
      const st=s[k];
      const dirTot=st.fwd+st.lat+st.back||1;
      return {
        pass:st.pass, acc: st.pass? +(st.passOk/st.pass*100).toFixed(1):0,
        fwdPct:+(st.fwd/dirTot*100).toFixed(1), latPct:+(st.lat/dirTot*100).toFixed(1), backPct:+(st.back/dirTot*100).toFixed(1),
        possPct:+(st.poss/tot*100).toFixed(1),
        intercept:st.intercept, lost:st.lost,
        avgLenM:+(st.passLen/Math.max(1,st.pass)*ISO_TO_M).toFixed(1),
        tackle:st.tackle, tackleWon:st.tackleWon, slide:st.slide, slideWon:st.slideWon,
        foul:st.foul, aerial:st.aerial, aerialWon:st.aerialWon, offside:st.offside,
        throwIn:st.throwIn, corner:st.corner, goalKick:st.goalKick, freeKick:st.freeKick,
        cross:st.cross, crossOk:st.crossOk, crossEarly:st.crossEarly, crossByline:st.crossByline, crossCutback:st.crossCutback,
        toSpace:st.toSpace, avgPower:+(st.powerSum/Math.max(1,st.pass)).toFixed(2), crossFloat:st.crossFloat, crossDriven:st.crossDriven,
        longPct:+(st.longPass/Math.max(1,st.pass)*100).toFixed(1),
        shot:st.shot, shotOn:st.shotOn, shotOff:st.shotOff, shotBlocked:st.shotBlocked,
        shotSaved:st.shotSaved, shotCaught:st.shotCaught, shotParried:st.shotParried,
        shotHeader:st.shotHeader, shotVolley:st.shotVolley, shotFinesse:st.shotFinesse,
        shotChip:st.shotChip, shotPower:st.shotPower, shotPlaced:st.shotPlaced,
        shotClose:st.shotClose, shotNormal:st.shotNormal, shotLong:st.shotLong,
        goal:st.goal, goalDeflected:st.goalDeflected, save:st.save, block:st.block, deflect:st.deflect,
        crossBlocked:st.crossBlocked, shotPunched:st.shotPunched, shotTipped:st.shotTipped, superSave:st.superSave,
        woodwork:st.woodwork, shortPass:st.shortPass, longPassT:st.longPassT,
        yellow:st.yellow, red:st.red, verbal:st.verbal, jostle:st.jostle
      };
    };
    return {
      minutes:+(this.clock/60).toFixed(1),
      score:{h:this.score.h, a:this.score.a},
      state:this.matchState, sentOff:this.sentOff.slice(),
      h:per("h"), a:per("a"),
      totalPass:s.h.pass+s.a.pass,
      thirds:{ def:+(s.thirds.def/tot*100).toFixed(1), mid:+(s.thirds.mid/tot*100).toFixed(1), att:+(s.thirds.att/tot*100).toFixed(1) }
    };
  }
}

/* 매 프레임 호출되는 단 하나의 그리기 함수. 하이라이트 씬이 없으면 22명이 포메이션 자리에 가만히 서 있는
   정지 화면이고(FM처럼 그동안은 시간만 흐른다), 씬이 재생 중이면 그 씬이 지정한 선수·공은 스크립트된
   경로를 따르고, 나머지 선수들은 PitchAI가 상태(돌파/추격/차단/침투)에 따라 벡터로 움직인다. */

const REF_FAM_DEF=["표종혁","마형진","하대용","노동식","방동준","진상협","도재훈","육현재","편진철","봉용준","남민석","예지음"];

function refNames(){
  if(!Array.isArray(G.refNames) || G.refNames.length!==REF_FAM_DEF.length) G.refNames=REF_FAM_DEF.slice();
  return G.refNames;
}

const REF_TRAIT=[
  {k:"strict", n:"원칙주의", d:"규정집을 외우고 다닌다. 항의를 가장 싫어한다.", tol:-0.16},
  {k:"calm",   n:"소통형",   d:"경기 중에도 선수들과 말을 섞는다.",             tol:+0.14},
  {k:"proud",  n:"자존심",   d:"자기 판정을 의심받는 걸 못 견딘다.",           tol:-0.10},
  {k:"vet",    n:"베테랑",   d:"산전수전 다 겪었다. 웬만한 일에는 눈도 깜짝 안 한다.", tol:+0.20},
  {k:"rookie", n:"신인",     d:"아직 휘슬을 부는 손이 떨린다.",                tol:-0.04}
];

function refCrewOf(M){
  if(M && M._refs) return M._refs;
  const seed=((G.season||2026)*997 + (G.day||0)*31 + ((M&&M.home&&M.home.id)||"x").length*7)|0;
  const NAMES=refNames();
  const pickAt=(arr,off)=>arr[Math.abs(seed+off*131)%arr.length];
  const crew={
    main:{n:pickAt(NAMES,0), t:REF_TRAIT[Math.abs(seed)%REF_TRAIT.length]},
    ar:  {n:pickAt(NAMES,3)},
    var_:{n:pickAt(NAMES,7)}
  };
  if(crew.ar.n===crew.main.n) crew.ar.n=pickAt(NAMES,4);
  if(crew.var_.n===crew.main.n||crew.var_.n===crew.ar.n) crew.var_.n=pickAt(NAMES,9);
  if(M) M._refs=crew;
  return crew;
}
/* 오늘 판정이 우리에게 어땠나 — 카드·PK 차이로 본다. 양수면 우리가 손해를 봤다는 뜻 */


export {
  MatchSim,
  matchSkills,
  TAC,
  getPosFam,
  initPosFam,
  canonSlot,
  computeFormationPositions,
  computeRenderSlots,
  FORMATION_SHAPE,
  SLOT_FAM,
  FAM_NEAR,
  FAM_POS,
  ROLES,
  ROLE_BY_KEY,
  TRAITS,
  SIM_SECONDS,
  SIM_DT,
  MATCH_CLOCK_SCALE,
  TAC_KEYS,
  TAC_DEF,
  SLOT_XY,
  refCrewOf,
  COMM,
  onPitch,
  slotRating,
  ovrStarVal,
  playerLevel,
  F_
};
