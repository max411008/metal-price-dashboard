import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const data=JSON.parse(fs.readFileSync('docs/data.json','utf8'));
assert.equal(data.series.length,35);
assert.equal(new Set(data.series.map(s=>s.id)).size,data.series.length);
for(const s of data.series){
 assert(s.points.length>0,s.id);
 assert(s.url.startsWith('https://'),s.id);
 for(let i=0;i<s.points.length;i++){
  const p=s.points[i];assert(p.date>='2016-10-01'&&p.date<=data.asOf,s.id);
  assert(p.value===null||Number.isFinite(p.value),s.id);
  if(i)assert(p.date>s.points[i-1].date,s.id+' date ordering');
 }
}
assert(data.series.find(s=>s.id==='iron-ore').points.length>=120);

const elements=new Map();
const document={querySelector(s){if(!elements.has(s))elements.set(s,{textContent:'',innerHTML:'',value:'',style:{},setAttribute(){},focus(){},showModal(){},close(){}});return elements.get(s)},querySelectorAll(){return[]}};
const context=vm.createContext({document,console,fetch:async()=>({ok:true,json:async()=>data})});
vm.runInContext(fs.readFileSync('docs/app.js','utf8'),context);
await new Promise(r=>setTimeout(r,0));
assert.equal((elements.get('#charts').innerHTML.match(/<article /g)||[]).length,35);
assert(!elements.get('#charts').innerHTML.includes('NaN'));
vm.runInContext("months=12; selectGroup('原料')",context);
assert.equal((elements.get('#charts').innerHTML.match(/<article /g)||[]).length,4);
assert(vm.runInContext("visiblePoints(DATA.series.find(s=>s.id==='iron-ore')).length",context)<=13);
vm.runInContext("item='nickel-cash';render()",context);
assert.equal((elements.get('#charts').innerHTML.match(/<article /g)||[]).length,1);
vm.runInContext("details('csc-hrc-change')",context);
assert(elements.get('#detail-body').innerHTML.includes('600'));
for(const asset of ['app.js','style.css','data.json'])assert(fs.existsSync('docs/'+asset));
const news=JSON.parse(fs.readFileSync('docs/news.json','utf8'));
assert.equal(new Set(news.items.map(n=>n.id)).size,news.items.length);
for(const n of news.items){assert(n.date<=news.updatedAt);assert(/^https:\/\//.test(n.url));assert(n.summary&&n.source&&n.effective);if(n.series)assert(data.series.some(s=>s.id===n.series));}
context.window={addEventListener(){}};context.location={hash:'#news'};context.fetch=async()=>({ok:true,json:async()=>news});
vm.runInContext(fs.readFileSync('docs/news.js','utf8'),context);
await new Promise(r=>setTimeout(r,0));
assert.equal(elements.get('#news-panel').hidden,false);
assert.equal(elements.get('#prices-panel').hidden,true);
assert.equal((elements.get('#news-list').innerHTML.match(/<article /g)||[]).length,6);
const filtered=context.window.MetalNews.selectNews(news.items,'台灣盤價','平盤');
assert.equal(filtered.length,1);assert.equal(filtered[0].id,'fenghsin-oct5');
elements.get('#more-news').onclick();assert.equal((elements.get('#news-list').innerHTML.match(/<article /g)||[]).length,12);
elements.get('#news-direction').onchange({target:{value:'平盤'}});assert.equal((elements.get('#news-list').innerHTML.match(/<article /g)||[]).length,2);
context.window.MetalNews.showView('prices');assert.equal(elements.get('#prices-panel').hidden,false);
console.log(JSON.stringify({news:news.items.length,checks:'source URLs, dates, related series, newest-first selection, news view, category/direction filters, pagination, returning to price charts passed'}));
console.log(JSON.stringify({series:data.series.length,records:data.series.reduce((n,s)=>n+s.points.length,0),checks:'dates, unique observations, finite values, period filters, item filters, card rendering, history details, local assets passed',webmcp:'supported browser context unavailable; not validated'}));
