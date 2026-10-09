/* ============================================================
   assets/nav.js — 管理画面の共通サイドバー
   メニューを変えるときはこのファイルだけを差し替えてください。
   版数   2026-10-09  v1
   ============================================================ */
(function(global){
'use strict';

const MENU=[
 {t:'ホーム',           icon:'fa-house-chimney'},
 {t:'葬家管理',         icon:'fa-users'},
 {t:'注文管理',         icon:'fa-phone',  href:'orders.html',   key:'orders'},
 {t:'利用状況',         icon:'fa-chart-column'},
 {t:'名札作成',         icon:'fa-tag',    href:'name-tag.html', key:'nametag', tag:'NEW'},
 {t:'配信機能',         icon:'fa-satellite-dish'},
 {t:'業者管理',         icon:'fa-store'},
 {t:'商品管理',         icon:'fa-gifts'},
 {t:'返礼品管理',       icon:'fa-gift'},
 {t:'スケジュール管理', icon:'fa-calendar-plus'},
 {t:'担当者別葬儀履歴', icon:'fa-list-alt'},
 {t:'月別累計売上高',   icon:'fa-list-alt'},
 {t:'操作ログ',         icon:'fa-clock'},
 {t:'設定',             icon:'fa-gear'},
];

function render(current){
  const items=MENU.map(m=>{
    const on=m.key&&m.key===current;
    const tag=m.tag?`<span class="tag">${m.tag}</span>`:'';
    const cls='nav-item2'+(on?' active':'');
    return m.href
      ? `<a class="${cls}" href="${m.href}"><i class="fas ${m.icon}"></i>${m.t}${tag}</a>`
      : `<span class="${cls}" style="opacity:.55;cursor:default" title="このモックでは開きません"><i class="fas ${m.icon}"></i>${m.t}${tag}</span>`;
  }).join('');
  return `<aside class="sidebar">
    <div class="brand">itowa</div>
    <div class="evt">株式会社サン・ライフ</div>
    ${items}
    <div class="foot">静的モック（GitHub Pages）<br>保存はされません<br>
      名札の組版 ${FUDA.version}<br>画面 2026-10-09 v4<br>
      書体 ${FUDA.fontName()}　字面率 ${(FUDA.MEAS.face||1).toFixed(3)}</div>
  </aside>`;
}

function mount(current){
  const el=document.getElementById('sidebar');
  if(el) el.outerHTML=render(current);
}

global.NAV={MENU,render,mount};
})(window);
