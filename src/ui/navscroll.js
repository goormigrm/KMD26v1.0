/* ─────────────────────────────────────────────────────────────
   위쪽 탭 줄을 **마우스로 끌어서** 넘길 수 있게 한다

   왜 필요한가
   -----------
   좁은 화면에서 왼쪽 바는 위쪽 가로 탭으로 눕고, 탭이 여섯 개라 폭을 넘칩니다
   (`#navScroll { overflow-x:auto }`). 진짜 폰에서는 손가락으로 밀면 넘어가지만,
   **PC 브라우저의 모바일 보기(웨일·크롬 기기 시뮬레이션)에서는 마우스로 끌어도
   꿈쩍하지 않습니다.** 브라우저가 `overflow` 를 마우스 드래그로 굴려 주지 않기 때문입니다.
   그래서 뒤쪽 탭(듀얼 기록실 · 선수단)에 아예 닿을 수 없었습니다.

   여기서 하는 일
   --------------
   · 마우스로 끌면 옆으로 굴린다 (손가락은 원래 되므로 건드리지 않는다)
   · 세로 휠도 옆으로 굴린다 — 가로 휠이 없는 마우스가 대부분이다
   · **끌고 난 뒤의 클릭은 삼킨다** — 안 그러면 탭을 밀 때마다 그 페이지로 넘어간다
   · 넘칠 때만 오른쪽 끝을 흐리게 해서 "더 있다"를 알린다

   ⚠ 이건 화면 장치입니다. 엔진 모듈이 아니므로 `realmatch`·`simcheck` 목록에 넣지 마세요.
   ───────────────────────────────────────────────────────────── */

const DRAG_MIN = 4;      // 이만큼(px) 넘게 움직였으면 "끈 것"으로 본다 (손 떨림은 클릭)

export function installNavScroll(el) {
  if (!el || el._navScroll) return;
  el._navScroll = true;

  let down = false, startX = 0, startLeft = 0, moved = 0;

  const canScroll = () => el.scrollWidth - el.clientWidth > 1;

  /* 넘치는지에 따라 커서와 오른쪽 흐림을 켠다.
     탭 수·글자 길이·화면 폭이 바뀌면 달라지므로 그때마다 다시 본다.
     ⚠ 흐림은 **굴러가는 칸 밖**(부모 = #side)에 붙인다 — 안에 붙이면 내용과 함께 밀려 나간다. */
  const sync = () => {
    const over = canScroll();
    el.classList.toggle("drag", over);
    const more = over && el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    if (el.parentElement) el.parentElement.classList.toggle("hasmore", more);
  };

  el.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch" || !canScroll()) return;   // 손가락은 원래 된다
    down = true; moved = 0;
    startX = e.clientX; startLeft = el.scrollLeft;
  });

  el.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > moved) moved = Math.abs(dx);
    if (moved > DRAG_MIN) {
      // 잡아 두면 탭 밖으로 나가도 계속 끌린다
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 오래된 브라우저 */ }
      el.classList.add("grabbing");
      e.preventDefault();
    }
    el.scrollLeft = startLeft - dx;
    sync();
  });

  const release = () => { down = false; el.classList.remove("grabbing"); };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);

  /* 끌고 난 뒤의 클릭은 삼킨다 — 탭은 <a> 라서 그대로 두면 밀 때마다 페이지가 넘어간다.
     ⚠ 잡는 단계(capture)에서 막아야 한다. <a> 의 기본 동작보다 먼저 와야 하기 때문이다.
     ⚠ moved 는 여기서 비운다. pointerup 에서 비우면 클릭이 오기 전에 지워진다. */
  el.addEventListener("click", e => {
    if (moved > DRAG_MIN) { e.preventDefault(); e.stopPropagation(); }
    moved = 0;
  }, true);

  // 링크·글자를 브라우저가 끌어가려 드는 것을 막는다 (끌면 유령 이미지가 따라다닌다)
  el.addEventListener("dragstart", e => e.preventDefault());

  /* 세로 휠을 옆으로. 가로 휠이 달린 마우스는 드무니, 세로를 그대로 옮긴다.
     ⚠ 넘치지 않으면 손대지 않는다 — 페이지 세로 스크롤을 뺏으면 안 된다. */
  el.addEventListener("wheel", e => {
    if (e.deltaX || !canScroll()) return;
    el.scrollLeft += e.deltaY;
    sync();
    e.preventDefault();
  }, { passive: false });

  el.addEventListener("scroll", sync);
  window.addEventListener("resize", sync);
  sync();
}

/** 페이지마다 부르는 한 줄 — 탭 줄은 어느 화면에서나 `#navScroll` 이다 */
export function installNav() {
  installNavScroll(document.getElementById("navScroll"));
}
