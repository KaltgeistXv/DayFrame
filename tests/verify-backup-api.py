"""Import only temporary entities into the running preview; never replace user data."""
import json,urllib.request,urllib.error,uuid
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(payload=None):
 req=urllib.request.Request('http://localhost:3000/api/workspace',data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
def reject(payload):
 try:call(payload)
 except urllib.error.HTTPError as e:assert e.code==400
 else:raise AssertionError('Invalid backup accepted')
prefs=call()['preferences'];run='backup-test-'+str(uuid.uuid4());tid=run+'-t';pid=run+'-p'
data={'tasks':[{'id':tid,'title':'Temporary task','project':pid,'status':'done','priority':'medium','date':'2026-09-05','time':'','duration':1440,'notes':'','tracking':True,'baselineStart':'2026-09-05','baselineEnd':'2026-09-05','completedOn':'2026-09-06','checkins':[{'date':'2026-09-05','note':'progress','minutes':60}]}], 'projects':[{'id':pid,'title':'Temporary project','description':'','color':'0'}],'folders':[],'labels':[],'preferences':prefs}
backup={'format':'pat-mi','version':1,'exportedAt':'2026-09-06','data':data}
try:
 reject({'action':'importWorkspace','mode':'replace','backup':{'format':'pat-mi','version':999,'data':data}})
 reject({'action':'saveAppearance','appearance':{'sidebarVisible':'bad'}})
 imported=call({'action':'importWorkspace','mode':'merge','backup':backup});t=next(t for t in imported['tasks'] if t['id']==tid)
 assert t['checkins'][0]['minutes']==60 and t['completedOn']=='2026-09-06'
 data['tasks'][0]['title']='Should not replace'
 again=call({'action':'importWorkspace','mode':'merge','backup':backup});assert next(t for t in again['tasks'] if t['id']==tid)['title']=='Temporary task'
 assert again['preferences']==prefs
 print('PASS: merge import retains history, duplicate IDs do not overwrite data, invalid replace is rejected, settings unchanged')
finally:
 call({'action':'deleteTask','id':tid});call({'action':'deleteProject','id':pid})
