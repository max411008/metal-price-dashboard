(() => {
 'use strict';
 const q=s=>document.querySelector(s);
 let settings={scope:'current',charts:true};
 function getReportSelection(){
  const scope=settings.scope==='current'?(q('#news-panel').hidden?'prices':'news'):settings.scope;
  const includePrices=scope==='prices'||scope==='both',includeNews=scope==='news'||scope==='both';
  if(includePrices&&(typeof DATA==='undefined'||!DATA))throw new Error('價格資料尚未載入，請稍後再試。');
  const ns=window.MetalNews?.getSnapshot();if(includeNews&&!ns?.loaded)throw new Error('消息資料尚未載入，請稍後再試。');
  return {scope,includePrices,includeNews,news:ns,series:includePrices?DATA.series.filter(s=>(group==='全部'||s.group===group)&&(item==='all'||s.id===item)):[]};
 }
 function buildReport(){
  const selected=getReportSelection(),{includePrices,includeNews,series}=selected;
  const now=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  let html=`<div class="report-title"><span>METALS / TAIWAN & GLOBAL</span><h1>鋼鐵原料與市場消息報表</h1><p>出表時間：${esc(now)}（台北）</p></div><div class="report-context">${includePrices?`<p>價格範圍：${esc(group)}／${esc(item==='all'?'全部品項':series[0]?.title||'')} · ${startDate()} 至 ${DATA.asOf}</p>`:''}${includeNews?`<p>新聞篩選：${esc(selected.news.category)}／${esc(selected.news.direction)} · 收錄 ${selected.news.items.length} 則 · 整理日 ${esc(selected.news.updatedAt)}</p>`:''}<p>每日排程檢查；抓取失敗保留舊值，部分鋼廠調整額仍須人工核對。各品項的截止日、幣別與單位不同。</p></div>`;
  if(includePrices){
   html+='<h2 class="report-section-title">價格與盤價總表</h2><table class="report-table"><thead><tr><th>品項／單位</th><th>資料日期</th><th>最新值</th><th>較前筆</th></tr></thead><tbody>';
   for(const s of series){const p=visiblePoints(s).filter(p=>p.value!=null),last=p.at(-1),prev=p.at(-2),delta=last&&prev?last.value-prev.value:null;
    html+=`<tr><td><strong>${esc(s.title)}</strong><small>${esc(s.unit)} · ${esc(s.frequency)}資料${s.kind==='change'?' · 調整額，非售價':''}<br>來源：<a href="${esc(s.url)}">${esc(s.source)}</a></small></td><td>${last?niceDate(s,last):'此期間無資料'}</td><td>${s.kind==='change'&&last?.value>0?'+':''}${fmt(last?.value)}</td><td>${s.kind==='change'?'不適用':delta==null?'—':(delta>0?'+':'')+fmt(delta)}</td></tr>`;
   }
   html+='</tbody></table>';
   if(settings.charts){html+='<h2 class="report-section-title">歷史價格折線圖</h2>';
    for(const s of series){const pts=visiblePoints(s);html+=`<figure class="report-chart"><figcaption><strong>${esc(s.title)}</strong><span>${esc(s.unit)} · ${esc(s.frequency)}資料${s.kind==='change'?' · 調整額，非完整售價':''}</span></figcaption>${chart(s,pts)}<p>${esc(s.note)} 來源：<a href="${esc(s.url)}">${esc(s.source)}</a></p></figure>`}
   }
  }
  if(includeNews){html+='<h2 class="report-section-title">國際行情與鋼廠開盤消息</h2>';
   if(!selected.news.items.length)html+='<p>目前篩選條件沒有消息。</p>';
   for(const n of selected.news.items)html+=`<article class="report-news"><div class="report-news-meta">${esc(n.date)} · ${esc(n.category)} · ${esc(n.signal)} · ${esc(n.type)}</div><h3>${esc(n.title)}</h3><p class="report-effective">適用：${esc(n.effective)}</p><p>${esc(n.summary)}</p><p class="report-source">來源：<a href="${esc(n.url)}">${esc(n.source)}</a>（${esc(new URL(n.url).hostname)}）</p></article>`;
  }
  html+='<p class="report-end">調價幅度不等於完整售價；供需展望不代表已實現漲跌。PDF 內的來源名稱可點擊開啟原文。</p>';
  q('#print-report').innerHTML=html;return {prices:series.length,news:includeNews?selected.news.items.length:0,charts:includePrices&&settings.charts};
 }
 q('#print-open').onclick=()=>{q('#print-status').textContent='';q('#print-dialog').showModal()};
 q('#print-cancel').onclick=()=>q('#print-dialog').close();
 q('#print-run').onclick=()=>{settings={scope:q('#print-scope').value,charts:q('#print-charts').checked};try{buildReport();q('#print-dialog').close();window.print()}catch(e){q('#print-status').textContent=e.message}};
 window.addEventListener('beforeprint',()=>{try{buildReport()}catch(e){q('#print-report').innerHTML=`<h1>無法產生報表</h1><p>${esc(e.message)}</p>`}});
 window.MetalPrint={buildReport,getReportSelection};
})();
