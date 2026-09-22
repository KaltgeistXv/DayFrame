"""Integration checks against local preview; uses only temporary entities."""
import json,urllib.request,urllib.error,uuid
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
base='http://localhost:3000/api/workspace'
def call(payload=None):
    req=urllib.request.Request(base,data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
def reject(payload):
    try:call(payload)
    except urllib.error.HTTPError as e:assert e.code==400
    else:raise AssertionError('Invalid input accepted')
run='org-qa-'+str(uuid.uuid4());fid=run+'-f';lid=run+'-l';pid=run+'-p';pid2=run+'-q';ids=[run+'-a',run+'-b']
project={'id':pid,'title':'Temporary project','description':'QA','color':'1','folder':fid,'tags':[lid],'start':'2026-09-29','end':'2026-10-03'}
tasks=[{'id':id,'title':'Temporary task','project':pid,'status':status,'priority':'medium','date':'2026-09-30','time':'23:00','duration':2940,'notes':'QA','tags':[lid]} for id,status in zip(ids,['todo','doing'])]
try:
    call({'action':'saveFolder','item':{'id':fid,'title':'Temporary folder'}})
    call({'action':'saveLabel','item':{'id':lid,'title':'Temporary label','color':'2'}})
    call({'action':'saveProject','project':project})
    call({'action':'saveProject','project':{**project,'id':pid2,'title':'Second temporary project','folder':''}})
    call({'action':'saveTasks','tasks':tasks})
    data=call();stored=next(p for p in data['projects'] if p['id']==pid)
    assert all(stored[k]==v for k,v in project.items())
    assert next(t for t in data['tasks'] if t['id']==ids[0])['duration']==2940
    for color in ['#ff0022','#FFFFFF','#123abc']:
        call({'action':'saveProject','project':{**project,'color':color}})
        call({'action':'saveLabel','item':{'id':lid,'title':'Temporary label','color':color}})
        assert next(p for p in call()['projects'] if p['id']==pid)['color']==color
        assert next(l for l in call()['labels'] if l['id']==lid)['color']==color
    reject({'action':'saveProject','project':{**project,'color':'#123456;display:none'}})
    for date,time,duration in [('2026-09-05','',4320),('2026-09-06','',4320),('2026-09-06','23:00',120),('2026-09-06','',2880),('','',2880)]:
        call({'action':'saveTask','task':{**tasks[0],'date':date,'time':time,'duration':duration}})
        stored=next(t for t in call()['tasks'] if t['id']==ids[0])
        assert (stored['date'],stored['time'],stored['duration'])==(date,time,duration)
        assert stored['project']==pid and stored['tags']==[lid]
    reject({'action':'saveProject','project':{**project,'end':'2026-08-01'}})
    reject({'action':'saveTasks','tasks':[{**tasks[0],'tags':['missing-label']}]})
    call({'action':'moveItem','kind':'projects','id':pid2,'target':pid})
    data=call();ordered=[p for p in data['projects'] if p['id'] in [pid,pid2]]
    assert [p['id'] for p in ordered]==[pid2,pid]
    assert ordered[0]['folder']==fid
    before_order=next(t for t in call()['tasks'] if t['id']==ids[0])
    call({'action':'moveItem','kind':'tasks','id':ids[0],'target':ids[1],'preserveStatus':True})
    after_order=next(t for t in call()['tasks'] if t['id']==ids[0])
    assert after_order['status']==before_order['status'] and after_order['project']==before_order['project']
    call({'action':'moveItem','kind':'tasks','id':ids[0],'target':ids[1]})
    assert next(t for t in call()['tasks'] if t['id']==ids[0])['status']=='doing'
    call({'action':'saveLabel','item':{'id':lid,'title':'Renamed temporary label','color':'0'}})
    assert next(t for t in call()['tasks'] if t['id']==ids[0])['tags']==[lid]
    task_snapshot=[t for t in call()['tasks'] if t['id'] in ids]
    for start,end in [('2026-09-05','2026-09-09'),('2026-09-06','2026-09-10'),('2026-09-07','2026-09-10'),('2026-09-07','2026-09-12'),('2026-09-05','2026-09-09')]:
        current=next(p for p in call()['projects'] if p['id']==pid)
        call({'action':'saveProject','project':{**current,'start':start,'end':end}})
        saved=next(p for p in call()['projects'] if p['id']==pid)
        assert (saved['start'],saved['end'])==(start,end)
        assert [t for t in call()['tasks'] if t['id'] in ids]==task_snapshot
    prefs=call()['preferences']
    reject({'action':'savePreferences','preferences':{**prefs,'navOrder':['today']*5}})
    assert call()['preferences']==prefs
    call({'action':'deleteFolder','id':fid})
    assert all(p['folder']=='' for p in call()['projects'] if p['id'] in [pid,pid2])
    call({'action':'deleteLabel','id':lid})
    data=call();assert all(not t['tags'] for t in data['tasks'] if t['id'] in ids)
    assert all(not p['tags'] for p in data['projects'] if p['id'] in [pid,pid2])
    assert all(any(t['id']==id for t in data['tasks']) for id in ids)
    print('PASS: project move, resize and restore preserve internal tasks; custom colors; date-only, timed and unplanned transitions; project ranges and labels persist; cross-day duration; invalid dates and tags rejected; order and folder movement; board status follows target; rename retains links; invalid preferences rejected; deletion preserves projects and tasks')
finally:
    call({'action':'deleteTasks','ids':ids})
    for id in [pid,pid2]:call({'action':'deleteProject','id':id})
    call({'action':'deleteFolder','id':fid});call({'action':'deleteLabel','id':lid})
