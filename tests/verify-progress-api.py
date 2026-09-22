"""Tracking persistence and status transitions; temporary entities only."""
import json, urllib.request, uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(payload=None):
    req=urllib.request.Request('http://localhost:3000/api/workspace', data=json.dumps(payload).encode() if payload else None, headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r: return json.load(r)
today=datetime.now(ZoneInfo('Asia/Shanghai')).date()
run='tracking-test-'+str(uuid.uuid4()); pid=run+'-p'; tid=run+'-t'; target=run+'-target'
def item(data): return next(t for t in data['tasks'] if t['id']==tid)
t={'id':tid,'title':'Temporary tracked task','project':pid,'status':'todo','priority':'medium','date':str(today-timedelta(days=3)),'time':'23:00','duration':120,'notes':'','tracking':True}
try:
    call({'action':'saveProject','project':{'id':pid,'title':'Temporary auto project','description':'','color':'0','scheduleMode':'auto'}})
    saved=item(call({'action':'saveTask','task':t}))
    assert saved['baselineStart']==str(today-timedelta(days=3))
    assert saved['baselineEnd']==str(today-timedelta(days=2))
    assert saved['date']==str(today-timedelta(days=1)) and saved['rolledDays']==2
    assert item(call())==saved, 'reloading must not roll twice'
    renamed=item(call({'action':'saveTask','task':{**saved,'title':'Renamed after rollover'}}))
    assert renamed['baselineEnd']==saved['baselineEnd'] and renamed['rolledDays']==2
    changed=item(call({'action':'saveTask','task':{**renamed,'date':str(today+timedelta(days=4)),'baselineEnd':'2099-01-01'}}))
    assert changed['baselineStart']==str(today+timedelta(days=4))
    assert changed['baselineEnd']==str(today+timedelta(days=5)) and changed['rolledDays']==0
    doing=item(call({'action':'saveTask','task':{**changed,'status':'doing'}}))
    assert doing['startedOn']==str(today)
    done=item(call({'action':'saveTask','task':{**doing,'status':'done'}}))
    assert done['completedOn']==str(today)
    assert item(call())==done
    call({'action':'saveTask','task':{**t,'id':target,'tracking':False,'status':'todo'}})
    reopened=item(call({'action':'moveItem','kind':'tasks','id':tid,'target':target}))
    assert reopened['status']=='todo' and reopened['completedOn']=='' and reopened['startedOn']==str(today)
    paused=item(call({'action':'saveTask','task':{**reopened,'tracking':False,'date':str(today-timedelta(days=4))}}))
    assert paused['date']==str(today-timedelta(days=4))
    assert paused['baselineEnd']==str(today-timedelta(days=3))
    assert 'tracking' not in call()['preferences']['navOrder']
finally:
    call({'action':'deleteTasks','ids':[tid,target]})
    call({'action':'deleteProject','id':pid})
print('PASS: rollover catches up idempotently; manual scheduling replaces baseline; automatic rollover preserves baseline; completion and board reopen timestamps; opt-out; navigation migration; cleanup')
