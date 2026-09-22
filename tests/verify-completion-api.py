"""All user completion paths check in once; no production records changed."""
import json,urllib.request,uuid
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(payload=None):
 req=urllib.request.Request('http://localhost:3000/api/workspace',data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
today=str(datetime.now(ZoneInfo('Asia/Shanghai')).date());yesterday=str(datetime.now(ZoneInfo('Asia/Shanghai')).date()-timedelta(days=1))
ids=['completion-'+str(uuid.uuid4()) for _ in range(4)]
def task(i,**patch):return dict(id=ids[i],title='Temporary completion',project='',status='todo',priority='medium',date=today,time='',duration=60,notes='',tracking=True,**patch)
def get(data,i):return next(t for t in data['tasks'] if t['id']==ids[i])
try:
 call({'action':'saveTasks','tasks':[task(0),task(1),task(2)]})
 first=get(call({'action':'saveTask','task':{**task(0),'status':'done','tracking':False}}),0)
 assert first['checkins']==[{'date':today,'note':'完成任务','minutes':0}]
 assert first['completedOn']==today
 enriched=get(call({'action':'saveCheckIn','id':ids[0],'date':today,'note':'Completion details','minutes':20}),0)
 assert enriched['checkins'][0]['minutes']==20
 again=get(call({'action':'saveTask','task':{**enriched,'title':'Renamed completed task'}}),0)
 assert again['checkins']==enriched['checkins']
 recorded=get(call({'action':'saveCheckIn','id':ids[1],'date':today,'note':'Finished two pages','minutes':90}),1)
 complete=get(call({'action':'saveTasks','tasks':[{**recorded,'status':'done'}]}),1)
 assert complete['checkins']==recorded['checkins']
 board=get(call({'action':'moveItem','kind':'tasks','id':ids[2],'target':ids[0]}),2)
 assert board['status']=='done' and len(board['checkins'])==1 and board['checkins'][0]['date']==today
 # Historical imported completion is not silently counted as work today when merely edited.
 old={**task(3),'status':'done','date':yesterday,'completedOn':yesterday,'checkins':[{'date':yesterday,'note':'Finished','minutes':15}]}
 call({'action':'importWorkspace','mode':'merge','backup':{'format':'pat-mi','version':1,'data':{'tasks':[old],'projects':[],'folders':[],'labels':[],'preferences':call()['preferences']}}})
 edited=get(call({'action':'saveTask','task':{**old,'notes':'Metadata edit'}}),3)
 assert len(edited['checkins'])==1 and edited['checkins'][0]['date']==yesterday
 reopened=get(call({'action':'saveTask','task':{**edited,'status':'doing'}}),3)
 reclosed=get(call({'action':'saveTask','task':{**reopened,'status':'done'}}),3)
 assert len(reclosed['checkins'])==2 and reclosed['completedOn']==today
 print('PASS: completion auto checks in via single, batch, board and reopening; existing notes/time preserved; metadata edits do not create new activity')
finally:call({'action':'deleteTasks','ids':ids})
