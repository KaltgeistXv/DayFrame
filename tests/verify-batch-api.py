"""Run against the local preview: python3 tests/verify-batch-api.py."""
import json, urllib.request, urllib.error, uuid
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
base='http://localhost:3000/api/workspace'
def call(payload=None):
    req=urllib.request.Request(base,data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=15) as r:return json.load(r)
def invalid(payload):
    try:call(payload)
    except urllib.error.HTTPError as e:
        assert e.code==400
    else:raise AssertionError('Invalid batch was accepted')
run='interaction-qa-'+str(uuid.uuid4());pid=run+'-project';ids=[run+'-a',run+'-b']
project={'id':pid,'title':'Temporary interaction test','description':'QA only','color':'0'}
records=[{'id':id,'title':'Temporary calendar task','project':pid,'status':'todo','priority':'medium','date':'2026-09-10','time':time,'duration':duration,'notes':'QA only'} for id,time,duration in zip(ids,['09:00','10:30'],[60,45])]
try:
    call({'action':'saveProject','project':project})
    call({'action':'saveTasks','tasks':records})
    moved=[{**t,'date':'2026-09-11','duration':90} for t in records]
    call({'action':'saveTasks','tasks':moved})
    loaded={t['id']:t for t in call()['tasks']}
    assert all(all(loaded[t['id']][k]==v for k,v in t.items()) for t in moved)
    invalid({'action':'saveTasks','tasks':[{**moved[0],'time':'13:00'},{**moved[1],'duration':-1}]})
    assert all(next(t for t in call()['tasks'] if t['id']==ids[0])[k]==v for k,v in moved[0].items()), 'Invalid batch partially applied'
    invalid({'action':'saveTasks','tasks':[records[0],records[0]]})
    invalid({'action':'deleteTasks','ids':[ids[0],7]})
    assert all(any(t['id']==id for t in call()['tasks']) for id in ids)
    call({'action':'deleteTasks','ids':ids})
    assert not any(t['id'] in ids for t in call()['tasks'])
    call({'action':'saveTasks','tasks':moved})
    loaded={t['id']:t for t in call()['tasks']}
    assert all(all(loaded[t['id']][k]==v for k,v in t.items()) for t in moved), 'Undo did not restore exact records'
    for color in ['0','1','2','3']:
        call({'action':'saveProject','project':{**project,'color':color}})
        assert next(p for p in call()['projects'] if p['id']==pid)['color']==color
    print('PASS: batch persistence; invalid batch is atomic; duplicate IDs rejected; delete validation; delete and exact restore; all project colors persist')
finally:
    call({'action':'deleteTasks','ids':ids})
    call({'action':'deleteProject','id':pid})
