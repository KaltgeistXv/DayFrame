"""Daily Gantt actions round-trip through the real API using a temporary task."""
import json, urllib.request, uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(payload=None):
    req=urllib.request.Request('http://localhost:3000/api/workspace',data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as response: return json.load(response)
today=datetime.now(ZoneInfo('Asia/Shanghai')).date()
tid='daily-gantt-test-'+str(uuid.uuid4())
def task(data): return next(t for t in data['tasks'] if t['id']==tid)
initial={'id':tid,'title':'Temporary daily Gantt test','project':'','status':'todo','priority':'medium','date':str(today-timedelta(days=7)),'time':'','duration':2880,'tracking':True,'notes':''}
try:
    saved=task(call({'action':'saveTask','task':initial}))
    original=(saved['baselineStart'],saved['baselineEnd'],saved['date'],saved['duration'])
    for delta in (7, 3, 0):
        date=str(today-timedelta(days=delta))
        saved=task(call({'action':'saveCheckIn','id':tid,'date':date,'note':'Daily entry '+date,'minutes':30}))
        assert (saved['baselineStart'],saved['baselineEnd'],saved['date'],saved['duration']) == original
    assert len(saved['checkins'])==3 and saved['status']=='doing'
    date=str(today-timedelta(days=3)); entry=next(c for c in saved['checkins'] if c['date']==date)
    removed=task(call({'action':'deleteCheckIn','id':tid,'date':date}))
    assert len(removed['checkins'])==2
    restored=task(call({'action':'saveCheckIn','id':tid,**entry}))
    assert next(c for c in restored['checkins'] if c['date']==date)==entry
    moved=task(call({'action':'saveTask','task':{**restored,'calendarOriginal':True,'date':str(today-timedelta(days=6))}}))
    assert moved['baselineStart']==str(today-timedelta(days=6))
    assert moved['rolledDays']==5 and len(moved['checkins'])==3
    completed=task(call({'action':'saveTask','task':{**moved,'status':'done'}}))
    assert completed['completedOn']==str(today)
    assert len(completed['checkins'])==3
    assert next(c for c in completed['checkins'] if c['date']==str(today))['minutes']==30
    assert task(call())['checkins']==completed['checkins']
finally:
    call({'action':'deleteTasks','ids':[tid]})
print('PASS: past/today check-ins persist without changing plan; delete/restore preserves notes; original replan recalculates rollover; completion deduplicates today; reload and cleanup')
