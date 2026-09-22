"""Check invalid layout requests against local API without changing user preferences."""
import json,urllib.request,urllib.error
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
def call(payload=None):
    req=urllib.request.Request('http://localhost:3000/api/workspace',data=json.dumps(payload).encode() if payload else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:return json.load(r)
before=call()['preferences'];layout=before['homeLayout']
assert set(c['id'] for c in layout['cards'])=={'today','tracking','projects','inbox'}
for invalid in [None,{},dict(layout,sidebarWidth=999),dict(layout,cards=[])]:
    try:call({'action':'saveHomeLayout','layout':invalid})
    except urllib.error.HTTPError as e:assert e.code==400
    else:raise AssertionError('Invalid layout accepted')
assert call()['preferences']==before
# Re-save the unchanged layout to exercise serialization without altering the user's layout.
assert call({'action':'saveHomeLayout','layout':layout})['preferences']==before
# Existing workspace settings must not erase layout and vice versa.
assert call({'action':'savePreferences','preferences':before})['preferences']==before
print('PASS: home layout loads, rejects invalid changes, persists, and survives workspace preference saves')
