/* ============================================================
   assets/pdf.js — 名札の PDF 出力
   ------------------------------------------------------------
   札種ごとに PDF を分けて出します。生花札・芳名札・スロープ／枕札の
   3ファイルに分かれるので、用紙を入れ替えながらまとめて刷れます。
   ページの大きさは札の実寸（例：生花札 450×150mm）です。

   使い方
     FUDAPDF.exportByFormat(items, {prefix:'名札'})
       items = [{label:{...}, title:'表示名'}, ...]
   版数   2026-10-09  v1
   ============================================================ */
(function(global){
'use strict';

const PX_PER_MM = 4;          // 書き出しの解像度（4px/mm で描いて…）
const SCALE     = 3;          // …html2canvas で3倍。実効 12px/mm ＝ 約305dpi

/* 背景は塗りません。名札用紙そのものに色や模様が入っているため、
   PDF には黒のインクだけを載せます（透過PNG）。                */

function ready(){
  return (global.jspdf && global.html2canvas)
    ? Promise.resolve(true)
    : Promise.reject(new Error('PDFの部品が読み込めていません。通信状態をご確認ください。'));
}

/* 画面外に実寸で描いて、画像にする */
function stage(){
  let el = document.getElementById('fudapdf-stage');
  if(!el){
    el = document.createElement('div');
    el.id = 'fudapdf-stage';
    el.setAttribute('aria-hidden','true');
    el.style.cssText = 'position:fixed;left:-99999px;top:0;z-index:-1;background:transparent';
    document.body.appendChild(el);
  }
  return el;
}

async function shoot(label){
  const fm = FUDA.FORMATS[label.fmt] || FUDA.FORMATS.seika;
  const st = stage();
  st.innerHTML = FUDA.html(label, fm.H * PX_PER_MM, {flat:true, print:true});
  const node = st.firstElementChild;
  if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch(e){} }
  const canvas = await global.html2canvas(node, {
    scale: SCALE, backgroundColor: null, logging:false, useCORS:true
  });
  st.innerHTML = '';
  return canvas.toDataURL('image/png');
}

/* 1つの札種ぶんの PDF を作る */
async function buildOne(fmtKey, items, onStep){
  const fm = FUDA.FORMATS[fmtKey];
  const { jsPDF } = global.jspdf;
  const doc = new jsPDF({ unit:'mm', format:[fm.W, fm.H], orientation:'portrait', compress:true });
  for(let i=0;i<items.length;i++){
    if(i) doc.addPage([fm.W, fm.H], 'portrait');
    const img = await shoot(Object.assign({}, items[i].label, {fmt:fmtKey}));
    doc.addImage(img, 'PNG', 0, 0, fm.W, fm.H);
    if(onStep) onStep(i+1, items.length, fm.name);
  }
  return doc;
}

function stamp(){
  const d = new Date();
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
}

/* 札種ごとに分けて書き出す。戻り値は作成したファイルの一覧 */
async function exportByFormat(items, opt){
  const o = opt || {};
  await ready();
  const groups = {};
  (items||[]).forEach(it=>{
    const k = (it.label && it.label.fmt) || 'seika';
    if(!FUDA.FORMATS[k]) return;
    (groups[k] = groups[k] || []).push(it);
  });
  const order = ['seika','houmei','slope'].filter(k=>groups[k] && groups[k].length);
  if(!order.length) throw new Error('出力できる名札がありません。');

  const made = [];
  for(const k of order){
    const doc = await buildOne(k, groups[k], o.onStep);
    const name = `${o.prefix||'名札'}_${FUDA.FORMATS[k].name}_${stamp()}.pdf`;
    doc.save(name);
    made.push({ fmt:k, name, count:groups[k].length, size:FUDA.FORMATS[k].call });
    await new Promise(r=>setTimeout(r, 400));   // 連続保存でブロックされないように間を置く
  }
  return made;
}

/* 1枚だけ出す（確認用） */
async function exportOne(label, title){
  await ready();
  const k = label.fmt || 'seika';
  const doc = await buildOne(k, [{label, title}], null);
  const name = `名札_${FUDA.FORMATS[k].name}_${(title||'1枚').replace(/[\\/:*?"<>|]/g,'')}_${stamp()}.pdf`;
  doc.save(name);
  return [{ fmt:k, name, count:1, size:FUDA.FORMATS[k].call }];
}

global.FUDAPDF = { exportByFormat, exportOne, version:'2026-10-09 v1' };
})(window);
