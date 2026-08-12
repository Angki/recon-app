import sqlite3
import os
import json

db_path = os.path.join(os.path.expanduser('~'), 'Documents', 'SecOpsScans', 'recon_app.sqlite')
try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM scans ORDER BY startTime DESC LIMIT 1")
    scan = cur.fetchone()
    
    if scan:
        print(f"Evaluating Target: {scan['target']}")
        print(f"Scan Status: {scan['status']}")
        print(f"Start Time: {scan['startTime']}")
        
        cur.execute("SELECT severity, count(*) as c FROM findings WHERE scanId=? GROUP BY severity", (scan['scanId'],))
        counts = cur.fetchall()
        print("\n--- FINDINGS SUMMARY ---")
        for row in counts:
            print(f"{row['severity']}: {row['c']}")
            
        cur.execute("SELECT * FROM findings WHERE scanId=? AND severity IN ('critical', 'high', 'medium')", (scan['scanId'],))
        critical = cur.fetchall()
        print(f"\n--- CRITICAL/HIGH/MEDIUM FINDINGS ({len(critical)}) ---")
        
        unique = {}
        for f in critical:
            name = f['name']
            if name not in unique:
                unique[name] = {'count': 0, 'severity': f['severity'], 'urls': [], 'type': f['type']}
            unique[name]['count'] += 1
            if len(unique[name]['urls']) < 5:
                unique[name]['urls'].append(f['url'])
                
        for name, data in unique.items():
            print(f"[{data['severity'].upper()}] {name} (Found {data['count']} times)")
            print(f"    Scanner: {data['type']}")
            print(f"    Sample URLs:")
            for url in data['urls']:
                print(f"      - {url}")
                
    else:
        print("No scans found in database.")
except Exception as e:
    print(f"Error reading DB: {e}")
