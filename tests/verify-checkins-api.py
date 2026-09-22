"""Daily effort is independent of plan, rollover and completion. Temporary task only."""
import json, urllib.request, urllib.error, uuid
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(payload=None):
    req=urllib.request.Request('http://localhost:3000/api/workspace',data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
def reject(payload):
    try:call(payload)
    except urllib.error.HTTPError as e:assert e.code==400
    else:raise AssertionError('invalid check-in accepted')
today=datetime.now(ZoneInfo('Asia/Shanghai')).date();yesterday=str(today-timedelta(days=1));date=str(today)
tid='checkin-test-'+str(uuid.uuid4())
def item(data):return next(t for t in data['tasks'] if t['id']==tid)
base={'action':'saveCheckIn','id':tid,'date':date,'note':'Worked on the layout','minutes':60}
try:
    saved=item(call({'action':'saveTask','task':{'id':tid,'title':'Temporary layout','project':'','status':'todo','priority':'medium','date':yesterday,'time':'','duration':1440,'notes':'','tracking':True}}))
    assert saved['date']==date and saved['baselineEnd']==yesterday
    first=item(call({**base,'date':yesterday}))
    assert first['status']=='doing' and first['date']==saved['date'] and first['baselineEnd']==yesterday
    assert first['startedOn']==yesterday and first['completedOn']==''
    second=item(call(base));assert len(second['checkins'])==2
    updated=item(call({**base,'note':'Revised entry','minutes':90}));assert len(updated['checkins'])==2
    assert updated['checkins'][0]['minutes']==90
    assert item(call())['checkins']==updated['checkins']
    # An ordinary task save carrying an old/empty snapshot cannot erase daily history.
    moved=item(call({'action':'saveTask','task':{**saved,'date':str(today+timedelta(days=2)),'checkins':[],'status':'doing'}}))
    assert moved['checkins']==updated['checkins'] and moved['baselineEnd']==str(today+timedelta(days=2))
    done=item(call({'action':'saveTask','task':{**moved,'status':'done'}}));assert done['status']=='done'
    logged=item(call(base));assert logged['status']=='done' and logged['completedOn']==date
    for patch in [{'date':str(today+timedelta(days=1))},{'date':'2026-02-30'},{'minutes':-1},{'minutes':1441},{'minutes':1.5},{'note':'x'*2001}]:reject({**base,**patch})
    removed=item(call({'action':'deleteCheckIn','id':tid,'date':date}));assert len(removed['checkins'])==1
    assert removed['checkins'][0]['date']==yesterday
finally:call({'action':'deleteTask','id':tid})
print('PASS: daily check-ins persist, update without duplicates, preserve plans/status/history across rescheduling, validate dates and minutes, delete one day only')
