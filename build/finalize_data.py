# convert binary outputs to base64 JSON (artifact hosting serves only text/image types)
import json, base64, os
from paths import DATA
D = DATA
if os.path.exists(D + 'ephem.bin'):
    m = json.load(open(D + 'ephem.json')); m['data_b64'] = base64.b64encode(open(D + 'ephem.bin', 'rb').read()).decode()
    json.dump(m, open(D + 'ephem.json', 'w')); os.remove(D + 'ephem.bin')
if os.path.exists(D + 'plan_height.bin'):
    p = json.load(open(D + 'plan.json')); p['height_b64'] = base64.b64encode(open(D + 'plan_height.bin', 'rb').read()).decode()
    json.dump(p, open(D + 'plan.json', 'w')); os.remove(D + 'plan_height.bin')
print('ok')
