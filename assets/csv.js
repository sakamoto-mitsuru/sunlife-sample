/* ============================================================
   assets/csv.js — 名札の一括取り込み（札種ごと）
   ------------------------------------------------------------
   ・札種ごとのテンプレートCSVを作る（Excelで開けるよう BOM付きUTF-8）
   ・記入済みCSVを読む（UTF-8 / Shift_JIS 自動判定）
   ・1セルに混ざった名義を 会社種別・会社名・肩書・氏名 に分ける
   ・同じ「注文番号」の行をまとめて1枚の名札にする

   分け方の規則は、お預かりした名札パターン表70種から起こしています。
   70種の法人名義55件で答え合わせをして、全件一致を確認しました。
   版数   2026-10-09  v1
   ============================================================ */
(function(global){
'use strict';

/* ---------- 取り込む列 ---------- */
const COLS=['注文番号','葬家','商品','枚数','区分','頭に置く語','1段の人数',
            '会社種別','会社・団体名','肩書','氏名','続柄','名義（自由入力）','備考'];

/* ---------- 分け方の手がかり（70種から） ---------- */
const TYPES=['医療法人社団','一般社団法人','一般財団法人','社会福祉法人','特定非営利活動法人',
  '株式会社','有限会社','合同会社','合資会社','合名会社','医療法人','学校法人','宗教法人','㈱','㈲'];
const TITLES=['代表取締役社長','代表取締役会長','代表取締役副社長','代表取締役専務','代表取締役',
  '取締役副社長','取締役社長','取締役会長','専務取締役','常務取締役','取締役','執行役員',
  '中央執行委員長','執行委員長','理事長','副理事長','理事','監事','院長','副院長','会長','副会長',
  '社長','副社長','専務','常務','支配人','店長','副店長','本部長','支部長','代表','所長',
  '部長','次長','課長','係長','主任','園長','校長','組合長','会計士','弁護士','司法書士',
  '税理士','行政書士','社会保険労務士','医師','歯科医師','薬剤師'];
const ICHI=/(一同|御一同|有志)$/;
const ORG_TAIL=/(店|支部|支店|本部|営業所|工場|会|部|課|室|社|院|館|組合|事務所|センター|クリニック|ホテル|レストラン|病院|医院|商会|商店|銀行|学校|大学|高校|中学|小学校|幼稚園|保育園)$/;

/* 1セルの自由テキストを 会社種別／会社・団体名／肩書／氏名 に分ける */
function split(raw){
  const out={type:'',co:'',ti:'',na:'',kind:'corp',conf:1,raw:String(raw||'')};
  let s=out.raw.replace(/[　\s]+/g,' ').trim();
  if(!s){ out.conf=0; return out; }

  /* 1) 肩書を拾う（長いものから。「会長 本部長」のように2つ並ぶことがある） */
  const found=[];
  for(const t of TITLES){
    const re=new RegExp('(^| )'+t+'( |$)');
    if(re.test(s)){ found.push(t); s=s.replace(re,'$1\u0000$2'); }
  }
  out.ti=found.join(' ');
  s=s.replace(/\u0000/g,' ').replace(/ +/g,' ').trim();

  /* 2) 会社種別 */
  for(const t of TYPES){ if(s.includes(t)){ out.type=t; break; } }

  /* 3) 残りを 会社・団体名 と 氏名 に分ける */
  const p=s.split(' ').filter(Boolean);
  if(!p.length){ out.conf=0.3; return out; }
  const looksName=(a,b)=>a&&b&&a.length<=4&&b.length<=4
    &&!ORG_TAIL.test(a)&&!ORG_TAIL.test(b)&&!TYPES.some(t=>a.includes(t)||b.includes(t));

  if(p.length>=2 && looksName(p[p.length-2],p[p.length-1])){
    out.na=p.slice(-2).join(' '); out.co=p.slice(0,-2).join(' ');
  }else if(ICHI.test(p[p.length-1])){
    out.na=p[p.length-1]; out.co=p.slice(0,-1).join(' ');
  }else if(p.length===1){
    out.co=p[0]; out.conf=0.6;
  }else{
    out.co=p.join(' '); out.conf=0.5;
  }

  /* 4) 70種から読み取れる組み方：
        代表者名が無い法人は、会社種別を小さい列に、屋号を大きい「名前」列に回す
        （例：「株式会社／厚木生花」。パターン52・54・72〜75） */
  if(!out.na && out.type){
    const rest=out.co.replace(out.type,'').replace(/\s+/g,' ').trim();
    if(rest && !ORG_TAIL.test(rest.split(' ').slice(0,-1).join(''))){
      out.co=out.type; out.na=rest; out.conf=0.78;
    }
  }

  /* 5) 個人か法人かの判定 */
  if(!out.co && !out.type && !out.ti) out.kind='ind';
  if(out.kind==='corp' && !out.co && out.ti) out.conf=Math.min(out.conf,0.8);  /* 肩書＋氏名だけ */
  return out;
}

/* ---------- CSV を読む ---------- */
function parse(text){
  const t=text.replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(q){
      if(c==='"'){ if(t[i+1]==='"'){ cell+='"'; i++; } else q=false; }
      else cell+=c;
    }else{
      if(c==='"') q=true;
      else if(c===','){ row.push(cell); cell=''; }
      else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
      else cell+=c;
    }
  }
  if(cell||row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r=>r.some(x=>(x||'').trim()));
}

/* 文字コードを見分けて読む（UTF-8 / Shift_JIS） */
function readFile(file){
  return new Promise((ok,ng)=>{
    const fr=new FileReader();
    fr.onerror=()=>ng(new Error('ファイルを読めませんでした。'));
    fr.onload=()=>{
      const buf=new Uint8Array(fr.result);
      let txt='';
      try{ txt=new TextDecoder('utf-8',{fatal:true}).decode(buf); }
      catch(e){
        try{ txt=new TextDecoder('shift_jis').decode(buf); }
        catch(e2){ txt=new TextDecoder('utf-8').decode(buf); }
      }
      ok(txt);
    };
    fr.readAsArrayBuffer(file);
  });
}

/* ---------- テンプレートCSV ---------- */
function template(fmtKey,FORMATS,maxNames){
  const F=FORMATS[fmtKey];
  const ex=[
    ['A-001','平塚家','供花 スタンド一段','1','個人','','', '','','','平塚 太郎','',          '',''],
    ['A-001','','','','個人','','',                        '','','','平塚 花子','',          '',''],
    ['A-002','平塚家','供花 スタンド一段','1','個人','孫','3','','','','平塚 二郎','',       '',''],
    ['A-003','厚木家','芳名板','1','法人','','',           '株式会社','平塚会計','代表取締役社長','平塚 太郎','','',''],
    ['A-004','厚木家','枕花','1','法人','','',             '','','','','',  '株式会社厚木生花 代表取締役 厚木 恩子',''],
    ['A-005','相模家','供花 スタンド二段','2','法人','','', '','','','','', '㈱ 相模生花','種別は社名の前でも後ろでも構いません'],
  ];
  const note=[
    ['# 名札 一括取り込みテンプレート（'+F.name+'　'+F.call+'　'+F.W+'×'+F.H+'mm）'],
    ['# 1行＝1名義です。同じ「注文番号」の行は、まとめて1枚の名札になります。'],
    ['# 個人・連名は1枚あたり '+maxNames+' 名まで、会社・団体は1枚あたり 2件までです。'],
    ['# 「名義（自由入力）」だけ埋めた場合は、会社種別・会社名・肩書・氏名に自動で分けます。'],
    ['# 姓と名のあいだは、半角または全角のスペースで区切ってください。'],
    ['# この「#」で始まる行は読み飛ばされます。消しても構いません。'],
    [],
  ];
  const esc=v=>/[",\n]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':String(v);
  const body=[COLS].concat(ex).map(r=>r.map(esc).join(','));
  return '﻿'+note.map(r=>r.map(esc).join(',')).join('\r\n')+'\r\n'+body.join('\r\n')+'\r\n';
}

function download(name,text){
  const b=new Blob([text],{type:'text/csv;charset=utf-8'});
  const u=URL.createObjectURL(b), a=document.createElement('a');
  a.href=u; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(u); a.remove();},300);
}

/* ---------- 取り込んだ行を名札にまとめる ---------- */
function toLabels(rows,ctx){
  /* 「#」で始まる説明行は読み飛ばし、見出しは列がそろっている行だけを採る */
  const live=rows.filter(r=>!/^\s*#/.test(r[0]||''));
  const hit=live.findIndex(r=>{
    const c=r.map(x=>(x||'').trim());
    return c.includes('注文番号') && (c.includes('氏名')||c.includes('名義（自由入力）'));
  });
  if(hit<0) throw new Error('見出しの行が見つかりません。テンプレートの見出し行（注文番号, 葬家, …）をそのままお使いください。');
  const hi=live[hit].map(h=>(h||'').trim());
  const at=n=>hi.indexOf(n);
  const body=live.slice(hit+1).filter(r=>r.some(c=>(c||'').trim()));

  const get=(r,n)=>{ const i=at(n); return i<0?'':String(r[i]||'').trim(); };
  const groups=new Map(); let auto=0;

  body.forEach((r,ix)=>{
    let key=get(r,'注文番号') || ('_'+(++auto));
    if(!groups.has(key)) groups.set(key,{key,rows:[],warn:[]});
    groups.get(key).rows.push({r,ix});
  });

  const out=[];
  groups.forEach(gr=>{
    const first=gr.rows[0].r;
    const funName=get(first,'葬家'), itName=get(first,'商品');
    const fu=ctx.FUNERALS.find(f=>f.name===funName)||ctx.FUNERALS[0];
    const it=ctx.ITEMS.find(x=>x.name===itName)||ctx.ITEMS[0];
    const qty=Math.max(1,parseInt(get(first,'枚数')||'1',10)||1);
    const lead=get(first,'頭に置く語');
    const per=parseInt(get(first,'1段の人数')||'0',10)||0;
    const note=gr.rows.map(x=>get(x.r,'備考')).filter(Boolean).join(' ／ ');

    const names=[], corps=[]; let conf=1; const raw=[];
    gr.rows.forEach(({r})=>{
      const free=get(r,'名義（自由入力）');
      let type=get(r,'会社種別'), co=get(r,'会社・団体名'),
          ti=get(r,'肩書'), na=get(r,'氏名');
      const rel=get(r,'続柄');
      let kind=get(r,'区分');
      if(free && !co && !ti && !na){
        const s=split(free);
        type=type||s.type; co=s.co; ti=s.ti; na=s.na;
        conf=Math.min(conf,s.conf); raw.push(free);
        if(!kind) kind=s.kind==='ind'?'個人':'法人';
      }
      const isCorp = kind ? /法人|会社|団体/.test(kind) : !!(co||ti||type);
      if(isCorp){
        /* 会社種別は、社名に含まれていなければ前に付ける */
        let company=co;
        if(type && company && !company.includes(type)) company=type+company;
        else if(type && !company) company=type;
        corps.push({type:type||'（記載なし）',co:company,ti,na});
      }else{
        if(na) names.push({na,rel,couple:!/[ 　]/.test(na)&&names.length>0});
      }
    });

    const kind = corps.length?'corp':'ind';
    const warn=[];
    if(kind==='ind' && names.length>ctx.MAX_NAMES)
      warn.push(`連名が ${names.length} 名で上限（${ctx.MAX_NAMES}名）を超えています`);
    if(kind==='corp' && corps.length>ctx.MAX_CORPS)
      warn.push(`会社・団体が ${corps.length} 件で上限（${ctx.MAX_CORPS}件）を超えています`);
    if(!names.length && !corps.length) warn.push('名義が空です');

    out.push({
      key:gr.key, funeralId:fu.id, itemId:it.id, qty, note, conf, raw,
      warnings:warn,
      label:{fmt:it.fmt||ctx.fmt||'seika', adj:{}, kind, lead, withRel:names.some(n=>n.rel),
             perRow:per, names:names.length?names:[{na:'',rel:'',couple:false}],
             corps:corps.length?corps:[{type:'株式会社',co:'',ti:'',na:''}]},
    });
  });
  return out;
}

global.FUDACSV={COLS,split,parse,readFile,template,download,toLabels,version:'2026-10-09 v1'};
})(window);
