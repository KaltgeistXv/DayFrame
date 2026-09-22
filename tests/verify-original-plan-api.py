"""Original and automatic calendar layers update one persisted task."""
import json, urllib.request, uuid
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(data=None):
    req=urllib.request.Request('http://localhost:3000/api/workspace',data=json.dumps(data).encode() if data else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
tid='original-plan-test-'+str(uuid.uuid4());today=datetime.now(ZoneInfo('Asia/Shanghai')).date()
def date(delta):return str(today+timedelta(days=delta))
def save(t):
    data=call({'action':'saveTask','task':t});rows=[t for t in data['tasks'] if t['id']==tid]
    assert len(rows)==1,'calendar layers created duplicate tasks'
    return rows[0]
def original(t):return {**t,'date':t['baselineStart'],'calendarOriginal':True}
t={'id':tid,'title':'Temporary original plan test','project':'','status':'todo','priority':'medium','date':date(-4),'time':'09:00','duration':60,'notes':'','tracking':True}
try:
    rolled=save(t)
    assert rolled['date']==date(0) and rolled['baselineStart']==date(-4) and rolled['rolledDays']==4
    call({'action':'saveCheckIn','id':tid,'date':date(-1),'minutes':25,'note':'Actual work'})
    revised=save({**original(rolled),'date':date(-2)})
    assert revised['date']==date(0) and revised['baselineStart']==date(-2) and revised['rolledDays']==2
    assert revised['checkins'][0]['minutes']==25
    assert 'calendarOriginal' not in revised
    renamed=save({**original(revised),'title':'Renamed original'})
    assert renamed['date']==revised['date'] and renamed['rolledDays']==2
    same=save({**original(renamed),'date':date(0)})
    assert same['baselineStart']==date(0) and same['rolledDays']==0
    again=save({**same,'date':date(-3)})
    future=save({**original(again),'date':date(2)})
    assert future['date']==date(2) and future['baselineStart']==date(2) and future['rolledDays']==0
    assert future['checkins'][0]['date']==date(-1)
    print('PASS: original edits recompute rollover; same-day/future plans stop rollover; metadata and check-ins preserved; one stored task')
finally:
    call({'action':'deleteTasks','ids':[tid]})
