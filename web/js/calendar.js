'use strict';

/**
 * calendar.js — 日历渲染与日程交互
 * 月历切换、日期选中、日程弹窗增删、里程碑/日程圆点标记
 */
const Calendar = (() => {
  const gridEl = document.getElementById('calGrid');
  const titleEl = document.getElementById('calTitle');

  let viewYear, viewMonth;   // 当前展示的年月
  let selected = null;       // 选中日期 'YYYY-MM-DD'

  /* ---------- 月历渲染 ---------- */
  function render() {
    titleEl.textContent = `${viewYear}年${viewMonth + 1}月`;
    gridEl.innerHTML = '';

    // 星期表头(周一 = 第一列)
    ['一', '二', '三', '四', '五', '六', '日'].forEach(w => {
      const dow = document.createElement('div');
      dow.className = 'cal-dow';
      dow.textContent = w;
      gridEl.appendChild(dow);
    });

    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = (first.getDay() + 6) % 7;           // 周一 = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = Store.todayStr();
    const milestoneSet = new Set(Store.milestones().map(m => m.date));

    for (let i = 0; i < 42; i++) {
      const dayNum = i - startOffset + 1;
      const dt = new Date(viewYear, viewMonth, dayNum);
      const dateStr = Store.fmtDate(dt);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (inMonth ? '' : ' other');
      if (dateStr === today) cell.classList.add('today');
      if (selected === dateStr) cell.classList.add('selected');

      const daySpan = document.createElement('span');
      daySpan.className = 'cal-day';
      daySpan.textContent = String(dt.getDate());
      cell.appendChild(daySpan);

      const marks = [];
      if (Store.getEvents(dateStr).length) marks.push('event');
      if (milestoneSet.has(dateStr)) marks.push('milestone');
      if (marks.length) {
        const dotRow = document.createElement('span');
        dotRow.className = 'cal-dots';
        marks.forEach(k => {
          const dot = document.createElement('i');
          dot.className = 'cal-dot' + (k === 'milestone' ? ' milestone' : '');
          dotRow.appendChild(dot);
        });
        cell.appendChild(dotRow);
      }

      cell.addEventListener('click', () => pick(dateStr, inMonth));
      gridEl.appendChild(cell);
    }
  }

  function emitPick(dateStr) {
    document.dispatchEvent(new CustomEvent('calendar:pick', { detail: dateStr }));
  }

  function pick(dateStr, inMonth) {
    if (!inMonth) {
      const [y, m] = dateStr.split('-').map(Number);
      viewYear = y;
      viewMonth = m - 1;
    }
    selected = dateStr;
    render();
    emitPick(dateStr);
  }

  function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selected = Store.todayStr();
    render();

    document.getElementById('calPrev').addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      render();
    });
    document.getElementById('calToday').addEventListener('click', () => {
      const now2 = new Date();
      viewYear = now2.getFullYear();
      viewMonth = now2.getMonth();
      selected = Store.todayStr();
      render();
      emitPick(selected);
    });
  }

  return { init, render, selectedDate: () => selected };
})();
