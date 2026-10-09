/* ============================================================
   assets/fuda.js  —  名札の組版エンジン（サン・ライフ様 現行仕様）
   ------------------------------------------------------------
   3画面（お客様フォーム／注文管理／名札作成）が共通で読み込みます。
   値を微調整したときは、このファイルの FUDA.MEAS だけを差し替えれば
   3画面すべてに反映されます。HTML は触りません。

   初期値の出どころ
     ・札の寸法     ヒアリングシート「名札の種類」のご回答
     ・余白と組み方 お預かりした名札パターン表 70種の見本を実測した値
   版数   2026-10-09  v1
   ============================================================ */
(function(global){
'use strict';

/* ---------- 札の種類（ヒアリングシートのご回答） ---------- */
const FORMATS={
  seika :{key:'seika' ,name:'生花札'        ,call:'450×150',W:150,H:450,
          note:'いちばん多く使う', sheetTop:50, sheetBottom:50},
  houmei:{key:'houmei',name:'芳名札'        ,call:'340×100',W:100,H:340,
          note:'多く使う',        sheetTop:25, sheetBottom:25},
  slope :{key:'slope' ,name:'スロープ・枕札' ,call:'240×90' ,W:90 ,H:240,
          note:'多く使う',        sheetTop:16, sheetBottom:16},
};

/* ---------- 組版の値（パターン表70種の実測）----------
   比率はすべて札の寸法に対する割合。同じ縦横比のサイズ違いに
   そのまま使えるよう、mm ではなく比率で持っています。          */
const MEAS={
  mTop   :0.048,  // 上余白 ÷ 札の高さ      70種の中央値 0.0475
  mBottom:0.094,  // 下余白 ÷ 札の高さ      70種の中央値 0.0943
  mSide  :0.045,  // 左右余白 ÷ 札の幅      横の占有 0.910 の裏返し
  colp   :1.08,   // 列ピッチ ÷ 文字サイズ  実測 列ピッチ/列幅 1.20 × 字面率 0.9
  lhMax  :2.30,   // 均等割りで字間を伸ばす上限
  lh     :1.25,   // 字送り（固定モードのとき）
  sx     :1.00,   // 字幅  実測 文字の幅/高 中央値 0.974
  vf     :0.34,   // 縦位置  余白全体のうち上に置く割合  実測 0.341
  perRow :4,      // 1段あたりの人数
  mode   :'justify',  // justify＝均等割り ／ fixed＝字送り固定
  footer :0,      // 下部に会社名を入れるか（見本には入っていない）
  /* 文字の上限サイズ ÷ 札の幅 */
  capNa  :0.90,   // 個人名
  capCn  :0.55,   // 名前（法人）
  capCo  :0.22,   // 会社・団体名
  capTi  :0.22,   // 肩書
  capRel :0.14,   // 続柄（小）
  capLead:0.55,   // 続柄（大・「孫」など頭に置くもの）
};

/* ---------- 組版 ---------- */
const ulen=t=>[...(t||'')].reduce((a,c)=>a+(/\s/.test(c)?0.5:1),0);
const clen=t=>(t||'').replace(/\s/g,'').length;
function splitSur(nm){
  const g=[...(nm||'')], i=g.findIndex(c=>/\s/.test(c));
  return i>0?[i,g.slice(0,i).join(''),g.slice(i+1).join('')]:[0,'',nm||''];
}
const ADJ=(f,k)=>1+0.05*(((f&&f.adj)||{})[k]||0);

function specsOf(f,c){
  const W=FORMATS[f.fmt].W, out=[];
  const Ana=ADJ(f,'na'),Acn=ADJ(f,'cn'),Aco=ADJ(f,'co'),
        Ati=ADJ(f,'ti'),Arel=ADJ(f,'rel'),Ald=ADJ(f,'lead');
  if(f.kind==='ind'){
    const base=c.capNa;
    if(f.lead){ const lw=(c.capLead/base)*Ald;
      out.push({t:'lead',w:lw,k:lw,cap:c.capLead*W*Ald,text:f.lead,units:ulen(f.lead)*lw}); }
    const list=(f.names||[]).filter(n=>(n.na||'').trim());
    const es=list.map(n=>{const r=splitSur(n.na.trim());
      return{rel:f.withRel?(n.rel||''):'',sl:r[0],sur:r[1],giv:r[2]};});
    const ws=es.filter(e=>e.sl>0), mx=ws.length?Math.max(...ws.map(e=>e.sl)):0;
    es.forEach(e=>{
      let head=e.sur,tail=e.giv,gap=0;
      if(e.sl>0) gap=0.5+(mx-e.sl); else if(mx>0){head='';gap=mx+0.5;}
      const rw=(c.capRel/base)*Arel;
      const relu=f.withRel?(e.rel?clen(e.rel)*rw+0.3:rw+0.3):0;
      out.push({t:'name',w:Ana,k:Ana,cap:c.capNa*W*Ana,rel:e.rel,relW:rw,head,gap,tail,
        units:relu+(clen(head)+gap+clen(tail))*Ana});});
  }else{
    const base=c.capCn, rw=(c.capCo/base)*Aco, tw=(c.capTi/base)*Ati;
    (f.corps||[]).forEach(p=>{
      if((p.co||'').trim()) out.push({t:'org'  ,w:rw ,k:rw ,cap:c.capCo*W*Aco,text:p.co.trim(),units:clen(p.co)*rw});
      if((p.ti||'').trim()) out.push({t:'title',w:tw ,k:tw ,cap:c.capTi*W*Ati,text:p.ti.trim(),units:clen(p.ti)*tw});
      if((p.na||'').trim()) out.push({t:'cname',w:Acn,k:Acn,cap:c.capCn*W*Acn,name:p.na.trim(),units:ulen(p.na.trim())*Acn});
    });
  }
  return out;
}

function geom(f,cfg){
  const c=Object.assign({},MEAS,cfg||{});
  const fm=FORMATS[f.fmt]||FORMATS.seika, SX=c.sx;
  const ftBand=c.footer?fm.H*0.026*1.6:0;
  const bodyH=fm.H*(1-c.mTop-c.mBottom)-ftBand, innerW=fm.W*(1-c.mSide*2);
  const sp=specsOf(f,c);
  if(!sp.length) return {fm,empty:true,bodyH,innerW,ftBand,rows:[],K:0,Kmain:0,LH:1,
                         sp,usedH:0,slack:bodyH,offset:0,mc:0,nR:0,wsum:0,c,bind:'—'};
  const per0=Math.max(2, f.perRow||c.perRow);
  let rows=[sp];
  if(f.kind==='ind' && sp.length>per0){
    const nr=Math.ceil(sp.length/per0), per=Math.ceil(sp.length/nr); rows=[];
    for(let i=0;i<sp.length;i+=per) rows.push(sp.slice(i,i+per));
  }
  const nR=rows.length, rowGap=fm.H*0.025*(nR-1);
  const mu=Math.max(1,...sp.map(x=>x.units));
  const mc=Math.max(1,...rows.map(r=>r.length));
  const wsum=Math.max(...rows.map(r=>r.reduce((a,x)=>a+(x.w||1),0)),1);
  const capK=Math.min(...sp.map(x=>x.cap/(x.w||1)),Infinity);
  const fitW=innerW/(wsum*c.colp*SX);
  let K,LH;
  if(c.mode==='fixed'){
    LH=c.lh;
    K=Math.max(3,Math.min((bodyH-rowGap)/(nR*mu*LH),fitW,capK||99));
  }else{
    K=Math.max(3,Math.min(fitW,capK||99));
    LH=(bodyH-rowGap)/(nR*mu*K);
    if(LH<1.00){ LH=1.00; K=Math.max(3,(bodyH-rowGap)/(nR*mu*LH)); }
    else if(LH>c.lhMax) LH=c.lhMax;
  }
  const usedH=nR*mu*K*LH+rowGap, slack=bodyH-usedH;
  const offset=slack>0?slack*c.vf:0;
  const bind=(K>=(capK||99)-0.01)?'上限':(K>=fitW-0.01?'幅':'高さ');
  const main=sp.find(x=>x.t==='name'||x.t==='cname');
  return {fm,bodyH,innerW,ftBand,sp,rows,nR,mc,wsum,K,Kmain:K*((main&&main.k)||1),
          LH,SX,usedH,slack,offset,bind,c,
          maxChars:Math.max(0,...sp.map(x=>clen(x.text||x.name||((x.head||'')+(x.tail||'')))))};
}

const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

/* pxH を渡すと、その高さで実寸比の名札 HTML を返します */
function html(f,pxH,opt){
  const o=opt||{}, g=geom(f,o.cfg), fm=g.fm, SC=pxH/fm.H, c=g.c;
  const cls='fuda'+(o.flat?' flat':'')+(o.print?' print':'');
  if(g.empty) return `<div class="${cls}" style="width:${fm.W*SC}px;height:${pxH}px"></div>`;
  const K=g.K*SC, LH=g.LH, SX=g.SX;
  const gl=(t,size)=>[...(t||'')].map(ch=>/\s/.test(ch)
    ?`<span class="gl" style="height:${size*0.5*LH}px"></span>`
    :`<span class="gl" style="font-size:${size}px;line-height:${LH};transform:scaleX(${SX})">${esc(ch)}</span>`).join('');
  const spc=v=>v>0?`<span class="gl" style="height:${v}px"></span>`:'';
  const col=x=>{
    const KK=K*(x.k||1);
    if(x.t==='org'||x.t==='title'||x.t==='lead') return `<div class="fcol">${gl(x.text,KK)}</div>`;
    if(x.t==='cname') return `<div class="fcol">${gl(x.name,KK)}</div>`;
    let s='';
    if(f.withRel) s+= x.rel?gl(x.rel,K*x.relW)+spc(K*0.3):spc(K*x.relW*LH+K*0.3);
    if(x.head) s+=gl(x.head,KK);
    if(x.gap>0) s+=spc(x.gap*KK*LH);
    s+=gl(x.tail,KK);
    return `<div class="fcol">${s}</div>`;
  };
  const gap=g.mc>1?Math.max(0,K*g.wsum*(c.colp-1)/(g.mc-1)):0;
  const body=g.rows.map(r=>`<div class="frow" style="gap:${gap}px">${r.map(col).join('')}</div>`).join('');
  const area=o.area?`<div class="farea" style="left:${fm.W*c.mSide*SC}px;top:${fm.H*c.mTop*SC}px;
      width:${g.innerW*SC}px;height:${g.bodyH*SC}px"></div>`:'';
  const ft=c.footer?`<div class="fft" style="bottom:${fm.H*c.mBottom*0.30*SC}px;font-size:${fm.H*0.026*SC}px">${esc(o.footerText||'会社名')}</div>`:'';
  return `<div class="${cls}" style="width:${fm.W*SC}px;height:${pxH}px">${area}
    <div class="fbody" style="margin-top:${(fm.H*c.mTop+g.offset)*SC}px;gap:${fm.H*0.025*SC}px">${body}</div>${ft}</div>`;
}

/* 収まりの判定 */
function verdict(g){
  if(g.empty) return ['warn','名義が入っていません'];
  if(g.slack<-0.5) return ['warn','印字領域からはみ出します'];
  if(g.c.mode==='justify'){
    if(g.LH<=1.001) return ['warn','字間の余裕がありません'];
    if(g.LH>=g.c.lhMax-0.001) return ['warn','字間が上限まで開いています'];
  }else if(g.usedH/g.bodyH<0.60) return ['warn','下が大きく空きます'];
  return ['ok','収まり良好'];
}

/* 名義を1行の文字列にする（一覧表示用） */
function summary(f){
  if(!f) return '';
  if(f.kind==='ind'){
    const ns=(f.names||[]).map(n=>(n.na||'').trim()).filter(Boolean);
    return (f.lead?f.lead+'／':'')+(ns.join('・')||'（未入力）');
  }
  return (f.corps||[]).map(p=>[p.co,p.ti,p.na].map(x=>(x||'').trim()).filter(Boolean).join(' '))
    .filter(Boolean).join(' ／ ')||'（未入力）';
}

const mm2pt=v=>Math.round(v/0.352778);

global.FUDA={FORMATS,MEAS,geom,html,verdict,summary,specsOf,mm2pt,esc,ulen,clen,
             version:'2026-10-09 v1'};
})(window);
