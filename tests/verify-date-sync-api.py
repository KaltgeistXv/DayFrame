"""Exercise the same saveTask/saveTasks endpoints used by detail editing and Gantt."""
import json, urllib.request, uuid
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(data=None):
    req=urllib.request.Request('http://localhost:3000/api/workspace',data=json.dumps(data).encode() if data else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as r: return json.load(r)
key='date-sync-'+str(uuid.uuid4()); ids=[key+'a',key+'b'];pid=key+'project'
project={'id':pid,'title':'Temporary date sync test','description':'','color':'0','scheduleMode':'auto'}
a={'id':ids[0],'title':'Temporary date sync task','project':pid,'status':'todo','priority':'medium','date':'2030-09-05','time':'09:00','duration':60,'notes':'retained','tracking':False}
b={**a,'id':ids[1],'date':'2030-09-08','time':'','duration':1440}
try:
    call({'action':'saveProject','project':project})
    call({'action':'saveTasks','tasks':[a,b]})
    updated={**a,'date':'2031-01-05','time':'13:15','duration':92*1440}
    result=call({'action':'saveTask','task':updated})
    for data in [result,call()]:
        actual=next(t for t in data['tasks'] if t['id']==a['id'])
        for k in ['date','time','duration','project','notes']: assert actual[k]==updated[k], k
    shifted=[{**updated,'date':'2031-02-04'}, {**b,'date':'2030-10-08'}]
    data=call({'action':'saveTasks','tasks':shifted})
    for expected in shifted:
        actual=next(t for t in data['tasks'] if t['id']==expected['id'])
        for k in ['date','time','duration','project']: assert actual[k]==expected[k], k
    print('PASS: details persist new date/time and 92-day span; grouped project tasks retain relative offset and duration')
finally:
    call({'action':'deleteTasks','ids':ids})
    call({'action':'deleteProject','id':pid})
