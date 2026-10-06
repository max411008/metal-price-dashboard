"""Refresh public feeds without discarding historical observations on failure."""
import ast, base64, hashlib, io, json, math, re, os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode
import xml.etree.ElementTree as ET
import openpyxl

ROOT = Path(__file__).resolve().parents[1] / 'docs'
NOW = datetime.now(timezone(timedelta(hours=8)))
TODAY = NOW.date().isoformat()
CHECKED = NOW.isoformat(timespec='seconds')
WB = 'https://thedocs.worldbank.org/en/doc/561011486076393416-0050022017/original/CMOHistoricalDataMonthly.xlsx'

def fetch(url):
    with urlopen(Request(url, headers={'User-Agent':'MetalPriceDashboard/1.0 (+https://github.com/max411008/metal-price-dashboard)'}), timeout=25) as r:
        return r.read(12_000_000)

def valid(points):
    out = {}
    for p in points:
        d, v = p['date'], p['value']
        datetime.strptime(d, '%Y-%m-%d')
        if not '2016-10-01' <= d <= TODAY: continue
        if isinstance(v, bool) or not isinstance(v, (float,int)) or not math.isfinite(v): continue
        if d in out and out[d]['value'] != v: raise ValueError('conflicting dates')
        out[d] = dict(p, value=round(v,4))
    if not out: raise ValueError('no valid observations')
    return list(out.values())

def metal_points(html, title):
    match = re.search(r'id="page-data">\s*(.*?)\s*</script>', html, re.S)
    if not match: raise ValueError('source format changed')
    payload = json.loads(match[1]); raw = payload['a']
    raw = ast.literal_eval(raw) if raw.startswith("b'") else raw
    decoded = ast.literal_eval(base64.b64decode(raw).decode())
    dates = decoded.get('X1', decoded.get('X'))
    candidates = [v for v in decoded.values() if isinstance(v,dict) and 'name' in v and 'data' in v]
    matches = [v for v in candidates if v['name'].split('(')[0].strip() == title]
    if len(matches) != 1: raise ValueError('series name mismatch')
    values = matches[0]['data']
    if len(dates) != len(values): raise ValueError('date/value count mismatch')
    return valid([{'date':d,'value':v} for d,v in zip(dates,values)])

def merge(old, new):
    points = {p['date']:p for p in old}
    points.update({p['date']:p for p in valid(new)})
    return [points[d] for d in sorted(points)]

def price(s):
    s = dict(s); s['lastAttemptAt'] = CHECKED
    try:
        if 'chart.metaltrade.tw/' in s['url']:
            points = metal_points(fetch(s['url']).decode('utf-8'), s['title'])
        elif s['id'] == 'iron-ore':
            book = openpyxl.load_workbook(io.BytesIO(fetch(WB)), read_only=True, data_only=True)
            rows = list(book['Monthly Prices'].values)
            h = next(i for i,r in enumerate(rows) if 'Iron ore, cfr spot' in r)
            col = rows[h].index('Iron ore, cfr spot')
            points = valid([{'date':r[0][:4]+'-'+r[0][5:7]+'-01','value':r[col]} for r in rows[h+1:] if isinstance(r[0],str) and re.fullmatch(r'\d{4}M\d{2}',r[0])])
        elif s['id'].startswith('fenghsin-'):
            html = fetch(s['url']).decode('utf-8'); points=[]
            col={'fenghsin-scrap':1,'fenghsin-rebar':2,'fenghsin-section':3}[s['id']]
            for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',html,re.S):
                cells=[re.sub('<[^>]*>','',c).strip() for c in re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S)]
                if len(cells)>=4 and re.fullmatch(r'\d{4}/\d{2}/\d{2}',cells[0]) and re.fullmatch(r'[\d,]+',cells[col]):
                    points.append({'date':cells[0].replace('/','-'),'value':int(cells[col].replace(',',''))})
        else:
            s['updateStatus']='manual'; return s
        s['points']=merge(s['points'],points)
        s.update(updateStatus='ok',lastSuccessAt=CHECKED)
        s.pop('updateError',None)
    except Exception as e:
        s.update(updateStatus='error',updateError=str(e)[:180])
    return s

FEEDS = [
 ('國際原料','(nickel OR "iron ore" OR "scrap steel") prices when:7d','en-US','US','US:en'),
 ('國際鋼市','steel prices mills when:7d','en-US','US','US:en'),
 ('台灣盤價','(中鋼 OR 燁聯 OR 唐榮 OR 豐興) (盤價 OR 開盤 OR 調漲 OR 調降) when:7d','zh-TW','TW','TW:zh-Hant')
]

def news_feed(feed):
    category,query,hl,gl,ceid=feed
    url='https://news.google.com/rss/search?'+urlencode({'q':query,'hl':hl,'gl':gl,'ceid':ceid})
    root=ET.fromstring(fetch(url)); items=[]
    if root.tag != 'rss': raise ValueError('invalid RSS')
    for n in root.findall('./channel/item')[:60]:
        title=n.findtext('title','').strip(); link=n.findtext('link','').strip()
        try: date=parsedate_to_datetime(n.findtext('pubDate')).astimezone(timezone(timedelta(hours=8))).date().isoformat()
        except (ValueError,TypeError): continue
        if not title or not link.startswith('https://') or date>TODAY: continue
        # Title-only discovery is deliberately not treated as a verified price movement.
        items.append(dict(id='rss-'+hashlib.sha256(link.encode()).hexdigest()[:20],date=date,title=title,url=link,source=n.findtext('source','Google News'),category=category,signal='待核對',type='自動收錄・新聞標題',effective='適用期間請見原文',summary='由新聞索引自動收錄；尚未核對全文、漲跌幅與適用盤期，請點擊原文確認。',tags=['自動收錄','待核對'],series=None))
    return items

def save(name,data):
    path=ROOT/name; temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temp.replace(path)

def main():
    data=json.loads((ROOT/'data.json').read_text(encoding='utf-8'))
    news=json.loads((ROOT/'news.json').read_text(encoding='utf-8'))
    with ThreadPoolExecutor(max_workers=4) as pool: data['series']=list(pool.map(price,data['series']))
    data['asOf']=max(data['asOf'],TODAY)
    counts={k:sum(s['updateStatus']==k for s in data['series']) for k in ['ok','error','manual']}
    data['automation']={'lastAttemptAt':CHECKED,'counts':counts,'schedule':'每天台灣時間 07:25（GitHub 可能延遲）'}
    data['limitations']=[x for x in data['limitations'] if '尚未啟用自動更新' not in x]
    note='自動更新逐來源執行；失敗保留舊值。中鋼、燁聯、唐榮調整額仍須人工核對；新聞自動收錄不代表已確認盤價。'
    if note not in data['limitations']:data['limitations'].append(note)
    indexed={n['id']:n for n in news['items']}; results=[]
    for feed in FEEDS:
        try:
            items=news_feed(feed)
            for n in items:indexed[n['id']]=n
            results.append({'category':feed[0],'status':'ok','count':len(items)})
        except Exception as e: results.append({'category':feed[0],'status':'error','error':str(e)[:180]})
    news['items']=sorted(indexed.values(),key=lambda n:(n['date'],n['id']),reverse=True)
    if any(r['status']=='ok' for r in results):news['updatedAt']=max(news['updatedAt'],TODAY)
    news['automation']={'lastAttemptAt':CHECKED,'feeds':results}
    save('data.json',data);save('news.json',news)
    report={'checkedAt':CHECKED,'prices':counts,'news':results}
    print(json.dumps(report,ensure_ascii=False))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        Path(os.environ['GITHUB_STEP_SUMMARY']).write_text('## 更新結果\n```json\n'+json.dumps(report,ensure_ascii=False,indent=2)+'\n```',encoding='utf-8')

if __name__=='__main__':main()
