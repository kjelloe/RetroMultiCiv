#!/usr/bin/env python3
"""Tiny file-backed mailbox for the architect and any number of coder agents.

Replaces the free-form agent-chat.md for day-to-day signaling: addressed
messages, per-recipient unread tracking, no rereading a growing file.
Storage: .agent-mail/messages.jsonl (append-only) + one cursor file per
reader (no shared writes, so parallel agents can't clobber each other).

  python3 tools/agent-mail.py send --from architect --to helper "A11 is a go"
  python3 tools/agent-mail.py send --from helper --to architect "A11 done" --tag done
  python3 tools/agent-mail.py inbox --as helper          # unread for me (marks read)
  python3 tools/agent-mail.py peek --as helper           # unread, without marking
  python3 tools/agent-mail.py log [-n 20]                # recent traffic, all parties
  python3 tools/agent-mail.py who                        # known roles + unread counts

Conventions: roles are free-form (architect, helper, helper2...); --to all
broadcasts; multi-line bodies via stdin: `... send --from x --to y -` reads
the body from stdin. Tags (--tag done|question|fyi|claim) make filtering
easy: `inbox --as architect --tag done`.

Forgiving flags (agents guess these; all accepted): the identity flag is
--from/--as/--role/--sender interchangeably on every command that takes
one; the send body may be positional OR --body/--text/--message/-m;
lock's --why also answers to --reason.

Every message has a GLOBAL id hash (8 hex chars, derived from its content,
identical for every reader) shown next to the sequence number — refer to
messages by hash across inboxes and sessions; `show <hash-prefix>` prints
the full message.

FILE LOCKS (the claim protocol, made mechanical — a mail claim carries the
WHY; the lock registry answers "may I edit this file RIGHT NOW"):

  python3 tools/agent-mail.py lock client/main.js --as helper --why "A28 e2e block"
  python3 tools/agent-mail.py locks                    # who holds what, with age
  python3 tools/agent-mail.py unlock client/main.js --as helper
  python3 tools/agent-mail.py unlock client/main.js --as architect --force

Rules: check `locks` BEFORE editing any shared file (client/, server/,
shared/, test/browser.test.js); lock what you edit, unlock in your
done-mail step. A lock held by someone else = mail them or the architect —
never edit through it. Only the holder (or the architect with --force,
which logs a broadcast) may unlock. Locks are advisory-but-mandatory
convention; stale ones (see age) get arbitrated, not ignored.

MAILBOX FLAG (the 10-minute poll, 2026-07-21): one cheap line that answers
"is there anything for me?" — unread mail, queued work, or a manually
raised note — like the raised flag on a mailbox:

  python3 tools/agent-mail.py flag --as helper          # check; poll this at least every 10 min
  python3 tools/agent-mail.py flag wait --as helper     # BLOCKING check — the idle-lane loop (below)
  python3 tools/agent-mail.py flag raise --for helper --as architect --why "re-read spec X"
  python3 tools/agent-mail.py flag lower --as helper    # after acting on the note

Discipline: EVERY lane checks its flag at least every 10 minutes — between
test runs, during long ops, and ESPECIALLY while in a waiting pattern
(waiting is not exemption; it is the main case). FLAG UP names the next
command to run (inbox / queue take / flag lower). Unread mail and queue
depth clear themselves when consumed; only the manual note needs an
explicit `flag lower`. `flag raise` is for "new work/update" signals that
have no new mail behind them (a spec changed, a ruling landed in a file, a
parked lane should resume); a worker that needs the coordinator NOW may
raise the coordinator's flag (`flag raise --for coordinator --as <role>
--why "see status board"`) — the one outbound signal workers keep.

THE IDLE-LANE LISTENING LOOP (`flag wait`, 2026-07-22): an agent session
only executes while it has a live turn — a lane that ends its turn
"waiting" cannot poll anything, which is why updates sat unseen until a
human nudge. `flag wait --as <role>` fixes that mechanically: it BLOCKS
until the flag is up (mail/queue/note), else returns after --timeout
(default 540s, sized under a 600s shell-tool cap). The waiting ritual:
instead of ending your turn, run `flag wait`; on FLAG UP act on what it
names; on "still down" run `flag wait` again. Long ops: run them in the
background and `flag wait` in the foreground. The loop runs client-side
(one cheap check per --interval, default 15s), so it is hub-safe and
identical on remote clones.

LAN HUB (cross-machine mail + locks, 2026-07-14): the dev PC runs
`agent-mail.py serve [--port 8970] [--host 0.0.0.0]` — a tiny HTTP hub
over the same .agent-mail/ store. Any other clone on the LAN writes the
hub's URL into `.agent-mail/remote` (one line, e.g.
http://192.168.1.116:8970) and EVERY agent-mail command there proxies
transparently: same commands, same output, one shared mailbox and ONE
shared lock registry across machines. Trusted-LAN posture (no auth —
same stance as the game server); delete the remote file to go local.
"""
import argparse
import hashlib
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOX = os.path.join(ROOT, '.agent-mail')
LOG = os.path.join(BOX, 'messages.jsonl')
LOCKS = os.path.join(BOX, 'locks.json')
ALIASES = os.path.join(BOX, 'roles')

_ALIAS_CACHE = None


def load_aliases():
    # Role aliases: an editable map so a coordination ROLE can be re-pointed
    # without touching specs or code. Format: "alias = canonical" per line
    # ('#' comments; ':' also accepted). Read-time + additive — `--to
    # coordinator` reaches whoever `coordinator` resolves to; `--to architect`
    # is unaffected. Cached per process: a local CLI reloads every call (instant
    # re-point); the long-lived `serve` hub reloads on restart (like any
    # agent-mail.py change), so remote lanes see a re-point after a hub restart.
    global _ALIAS_CACHE
    if _ALIAS_CACHE is not None:
        return _ALIAS_CACHE
    out = {}
    try:
        with open(ALIASES, encoding='utf-8') as f:
            for line in f:
                line = line.split('#', 1)[0].strip()
                if not line:
                    continue
                sep = '=' if '=' in line else (':' if ':' in line else None)
                if not sep:
                    continue
                alias, target = (p.strip() for p in line.split(sep, 1))
                if alias and target:
                    out[alias] = target
    except FileNotFoundError:
        pass
    _ALIAS_CACHE = out
    return out


def canon(role):
    # Resolve an alias to its canonical role (one hop — a canonical must be a
    # real role, never another alias). Unknown/non-alias roles map to themselves.
    return load_aliases().get(role, role)


def addressed(to_field, role):
    # Does a message addressed to `to_field` reach `role`? 'all' broadcasts;
    # otherwise match on the CANONICAL role so aliases deliver into the
    # canonical inbox (coordinator→architect matches a query as either name).
    if to_field == 'all':
        return True
    c = canon(role)
    return any(canon(r) == c for r in recipients(to_field))


def read_locks():
    try:
        with open(LOCKS, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_locks(locks):
    tmp = LOCKS + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(locks, f, indent=1)
    os.replace(tmp, LOCKS)


def norm_path(path):
    # registry keys are repo-relative with forward slashes — the same file
    # must hash to the same key no matter how the caller spelled it
    ap = os.path.abspath(os.path.join(ROOT, path)) if not os.path.isabs(path) else path
    return os.path.relpath(ap, ROOT).replace(os.sep, '/')


def age_str(ts):
    mins = int((time.time() - ts) / 60)
    return f'{mins}m' if mins < 120 else f'{mins // 60}h{mins % 60:02d}m'


def read_all():
    if not os.path.exists(LOG):
        return []
    out = []
    with open(LOG, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return out


def msg_hash(m):
    # content-derived: every reader computes the same hash, no migration
    # needed for old messages, and racing senders that collide on the
    # sequential id still get distinct hashes
    key = f"{m.get('id')}|{m.get('ts')}|{m.get('from')}|{m.get('to')}|{m.get('text')}"
    return hashlib.sha256(key.encode('utf-8')).hexdigest()[:8]


def cursor_file(role):
    # canonical so an alias and its target share ONE cursor (no double-reads)
    return os.path.join(BOX, f'cursor-{canon(role)}')


def get_cursor(role):
    try:
        with open(cursor_file(role)) as f:
            return int(f.read().strip() or 0)
    except (FileNotFoundError, ValueError):
        return 0


def set_cursor(role, value):
    with open(cursor_file(role), 'w') as f:
        f.write(str(value))


def recipients(to_field):
    # a message's `to` may be a comma-joined list ("architect,sim-runner");
    # split it so each named role matches, not just the exact joined string.
    return [r.strip() for r in to_field.split(',') if r.strip()]


def unread_for(role):
    cur = get_cursor(role)
    c = canon(role)
    return [m for m in read_all()
            if m['id'] > cur and addressed(m['to'], role)
            and canon(m['from']) != c]


# --- presence board (liveness without flooding the message log) ---
STATUS_STALE_MIN = 15  # a 'working' status older than this, not marked long-running, is a stall signal


def status_file(role):
    # canonical so an alias (coordinator) shares its target's status
    return os.path.join(BOX, f'status-{canon(role)}')


def set_status(role, state):
    tmp = status_file(role) + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'state': state, 'ts': int(time.time())}, f)
    os.replace(tmp, status_file(role))


def get_status(role):
    try:
        with open(status_file(role), encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def all_statuses():
    out = {}
    try:
        names = os.listdir(BOX)
    except FileNotFoundError:
        return out
    for fn in names:
        if fn.startswith('status-') and not fn.endswith('.tmp'):
            st = get_status(fn[len('status-'):])
            if st:
                out[fn[len('status-'):]] = st
    return out


# --- per-lane work stacks (front-load routing; an idle lane self-serves) ---
def queue_file(lane):
    return os.path.join(BOX, f'queue-{canon(lane)}')


def read_queue(lane):
    try:
        with open(queue_file(lane), encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def write_queue(lane, items):
    tmp = queue_file(lane) + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=1)
    os.replace(tmp, queue_file(lane))


def all_queues():
    out = {}
    try:
        names = os.listdir(BOX)
    except FileNotFoundError:
        return out
    for fn in names:
        if fn.startswith('queue-') and not fn.endswith('.tmp'):
            q = read_queue(fn[len('queue-'):])
            if q:
                out[fn[len('queue-'):]] = q
    return out


# --- mailbox flag (raised = "come check": mail, queue, or a manual note) ---
def flag_file(role):
    # canonical so an alias (coordinator) shares its target's flag
    return os.path.join(BOX, f'flag-{canon(role)}')


def get_flag(role):
    try:
        with open(flag_file(role), encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def flag_counts(role):
    # machine form (also `flag --as X --raw`): unread count, queue depth,
    # note timestamp (0 = none). `flag wait` polls THIS, local or via hub.
    note = get_flag(role)
    return len(unread_for(role)), len(read_queue(role)), (note or {}).get('ts', 0)


def flag_check_line(role):
    # the one-line poll answer; shared by `flag` (check) and `flag wait`
    unread = len(unread_for(role))
    qn = len(read_queue(role))
    note = get_flag(role)
    if not (unread or qn or note):
        return f'flag down ({canon(role)}: no unread, queue empty)'
    parts = []
    if unread:
        parts.append(f'{unread} unread → `inbox --as {canon(role)} --headers`')
    if qn:
        parts.append(f'queue {qn} → `queue take --as {canon(role)}`')
    if note:
        parts.append(f"note from {note.get('by', '?')} {age_str(note['ts'])} ago: "
                     f"{note.get('why') or '(no note)'} → `flag lower --as {canon(role)}` once acted on")
    return f"FLAG UP ({canon(role)}): " + ' · '.join(parts)


def fmt(m):
    ts = time.strftime('%H:%M', time.localtime(m['ts']))
    tag = f" [{m['tag']}]" if m.get('tag') else ''
    head = f"#{m['id']} @{msg_hash(m)} {ts} {m['from']} → {m['to']}{tag}"
    body = m['text'] if '\n' not in m['text'] else '\n  ' + m['text'].replace('\n', '\n  ')
    return f"{head}: {body}" if '\n' not in m['text'] else f"{head}:{body}"


def hdr(m):
    # one-line header: id, from→to, tag, first line only (no body echo).
    ts = time.strftime('%H:%M', time.localtime(m['ts']))
    tag = f" [{m['tag']}]" if m.get('tag') else ''
    first = m['text'].split('\n', 1)[0]
    if len(first) > 100:
        first = first[:97] + '...'
    return f"#{m['id']} @{msg_hash(m)} {ts} {m['from']} → {m['to']}{tag}: {first}"


REMOTE_FILE = os.path.join(BOX, 'remote')


def remote_url():
    url = os.environ.get('AGENT_MAIL_URL', '')
    if url:
        return url.strip().rstrip('/')
    try:
        with open(REMOTE_FILE) as f:
            u = f.read().strip()
            return u.rstrip('/') if u else None
    except FileNotFoundError:
        return None


def proxy_raw(argv, url):
    import urllib.request
    req = urllib.request.Request(url + '/rpc',
        data=json.dumps({'argv': argv}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            reply = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        sys.exit(f'mail hub unreachable at {url}: {e} — fix or delete .agent-mail/remote')
    return reply.get('out', ''), int(reply.get('code', 0))


def proxy(argv, url):
    out, code = proxy_raw(argv, url)
    if out:
        print(out, end='' if out.endswith('\n') else '\n')
    return code


def flag_wait(argv):
    # `flag wait --as <role> [--timeout S] [--interval S]` — a BLOCKING check:
    # returns the moment there is something NEW for the role, else after
    # --timeout. Unread mail or a raised note return immediately; standing
    # QUEUE depth does not (a holding lane may have a stocked queue it cannot
    # take yet) — queue triggers only on an INCREASE over the loop's baseline.
    # Runs CLIENT-side (one cheap poll per interval), so it works identically
    # local and through the hub (whose per-request timeout is 10s and whose
    # threads must never block). This is the idle-lane listening loop: a
    # waiting lane's last action is `flag wait`; on FLAG UP act, on timeout
    # run it again — the lane stays reachable without a human nudge.
    wp = argparse.ArgumentParser(prog='agent-mail.py flag wait')
    wp.add_argument('--as', '--from', '--role', dest='role', required=True)
    wp.add_argument('--timeout', type=int, default=540,
                    help='max seconds to listen before returning (default 540; keep under your shell tool timeout)')
    wp.add_argument('--interval', type=int, default=15)
    a = wp.parse_args(argv)
    url = remote_url()

    def counts():
        if url:
            raw, _ = proxy_raw(['flag', '--as', a.role, '--raw'], url)
            try:
                u, q, n = raw.split()
                return int(u.split('=')[1]), int(q.split('=')[1]), int(n.split('=')[1])
            except ValueError:
                # malformed/empty hub reply (the #2235 race, hub-side fixed by
                # DISPATCH_LOCK) — treat as "no change this poll", never crash
                return None
        return flag_counts(a.role)

    def line():
        if url:
            out, _ = proxy_raw(['flag', '--as', a.role], url)
            return out.strip()
        return flag_check_line(a.role)

    first = counts()
    base_qn = first[1] if first else 0
    deadline = time.time() + max(a.timeout, a.interval)
    while True:
        c = counts()
        if c is not None:
            unread, qn, note_ts = c
            if unread or note_ts or qn > base_qn:
                print(line())
                return
            base_qn = qn  # a shrinking queue lowers the baseline
        if time.time() >= deadline:
            print(f'{line()} — nothing new after {a.timeout}s; run `flag wait` again to keep listening')
            return
        time.sleep(min(a.interval, max(1, int(deadline - time.time()))))


def serve(host, port):
    import io
    import contextlib
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    DISPATCH_LOCK = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):  # quiet; the hub prints its own line on start
            pass

        def do_GET(self):
            body = f'agent-mail hub · {len(read_all())} messages · {len(read_locks())} locks\n'.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if self.path != '/rpc':
                self.send_response(404); self.end_headers(); return
            try:
                length = int(self.headers.get('Content-Length', 0))
                argv = json.loads(self.rfile.read(length).decode('utf-8'))['argv']
                assert isinstance(argv, list) and argv and argv[0] != 'serve'
            except Exception:
                self.send_response(400); self.end_headers(); return
            buf = io.StringIO()
            code = 0
            # SERIALIZED: redirect_stdout swaps the PROCESS-global stdout, so
            # concurrent requests under ThreadingHTTPServer raced and one got
            # an empty reply (the #2235 flag-wait bug). Dispatch is cheap file
            # ops; one at a time is correct and also guards the store writes.
            with DISPATCH_LOCK, contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                try:
                    dispatch([str(a) for a in argv])
                except SystemExit as e:
                    if isinstance(e.code, str):
                        print(e.code)
                        code = 1
                    else:
                        code = e.code or 0
                except Exception as e:  # keep the hub alive; report the error
                    print(f'hub error: {e}')
                    code = 1
            body = json.dumps({'out': buf.getvalue(), 'code': code}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)

    srv = ThreadingHTTPServer((host, port), Handler)
    print(f'agent-mail hub listening on {host}:{port} (store: {BOX})')
    srv.serve_forever()


def main():
    argv = sys.argv[1:]
    if argv and argv[0] == 'serve':
        sp = argparse.ArgumentParser()
        sp.add_argument('serve')
        sp.add_argument('--port', type=int, default=8970)
        sp.add_argument('--host', default='0.0.0.0')
        a = sp.parse_args(argv)
        os.makedirs(BOX, exist_ok=True)
        serve(a.host, a.port)
        return
    if argv[:2] == ['flag', 'wait']:
        # client-side always — the blocking loop must never reach the hub
        flag_wait(argv[2:])
        return
    url = remote_url()
    if url:
        # resolve stdin bodies BEFORE proxying — the hub's stdin is empty,
        # so a literal '-' must become text on the client side
        if '-' in argv:
            body = sys.stdin.read().strip()
            argv = [body if a == '-' else a for a in argv]
        # resolve --body-file BEFORE proxying too — the path is local to
        # THIS machine; the hub must receive the CONTENT, never the path
        # (a remote sender's /tmp does not exist on the hub's disk)
        out, i = [], 0
        while i < len(argv):
            a = argv[i]
            if a == '--body-file' and i + 1 < len(argv):
                with open(argv[i + 1], encoding='utf-8') as f:
                    out.extend(['--body', f.read().strip()])
                i += 2
            elif a.startswith('--body-file='):
                with open(a.split('=', 1)[1], encoding='utf-8') as f:
                    out.extend(['--body', f.read().strip()])
                i += 1
            else:
                out.append(a)
                i += 1
        argv = out
        sys.exit(proxy(argv, url))
    dispatch(argv)


def dispatch(argv):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)

    s = sub.add_parser('send')
    s.add_argument('--from', '--as', '--sender', dest='sender', required=True)
    s.add_argument('--to', dest='to', required=True)
    s.add_argument('--tag', dest='tag', default='')
    s.add_argument('text', nargs='?', default=None,
                   help="message body, or '-' to read from stdin")
    s.add_argument('--body', '--text', '--message', '-m', dest='body',
                   default=None, help='message body (alias for the positional)')
    s.add_argument('--body-file', dest='body_file', default=None,
                   help='read the body from a file (keeps it out of the command line/transcript)')

    for name in ('inbox', 'peek'):
        i = sub.add_parser(name)
        i.add_argument('--as', '--from', '--role', dest='role', required=True)
        i.add_argument('--tag', dest='tag', default='')
        i.add_argument('--headers', action='store_true',
                       help='one line per message (id/from→to/tag/first line); expand one with `show #id`')

    l = sub.add_parser('log')
    l.add_argument('-n', type=int, default=15)

    sh = sub.add_parser('show')
    sh.add_argument('prefix', help='global message hash (or unique prefix)')

    sub.add_parser('who')

    st = sub.add_parser('status')
    st.add_argument('--as', '--from', '--role', dest='role', default=None)
    st.add_argument('text', nargs='?', default=None,
                    help="set your status (waiting / working X / working X (long ~Nm)); omit to print the board")

    q = sub.add_parser('queue')
    q.add_argument('action', choices=['add', 'take', 'list', 'drop'],
                   help="add --for <lane> an item; take --as <lane> your next; list [--for <lane>]; drop --for <lane> --id N")
    q.add_argument('--for', dest='forlane', default=None)
    q.add_argument('--as', '--from', '--role', dest='role', default=None)
    q.add_argument('--tag', dest='tag', default='')
    q.add_argument('--id', dest='qid', type=int, default=None)
    q.add_argument('--body', '--text', '-m', dest='body', default=None,
                   help="item body for `add` (short); use --body-file for substantive; '-' for stdin")
    q.add_argument('--body-file', dest='body_file', default=None)

    fl = sub.add_parser('flag')
    fl.add_argument('action', nargs='?', default='check', choices=['check', 'raise', 'lower'],
                    help="check --as <role> (the 10-min poll); raise --for <role> [--why]; lower --as <role>; "
                         "`flag wait --as <role>` = the blocking idle-lane loop (client-side, see docstring)")
    fl.add_argument('--as', '--from', '--role', dest='role', default=None)
    fl.add_argument('--for', dest='forlane', default=None)
    fl.add_argument('--why', '--reason', dest='why', default='')
    fl.add_argument('--raw', action='store_true',
                    help='machine form for check: "unread=N queue=N note=TS" (flag wait polls this)')

    lk = sub.add_parser('lock')
    lk.add_argument('path', help='file to lock (repo-relative)')
    lk.add_argument('--as', '--from', '--role', dest='role', required=True)
    lk.add_argument('--why', '--reason', dest='why', default='')

    ul = sub.add_parser('unlock')
    ul.add_argument('path')
    ul.add_argument('--as', '--from', '--role', dest='role', required=True)
    ul.add_argument('--force', action='store_true',
                    help='architect arbitration: release someone else\'s lock (broadcasts)')

    sub.add_parser('locks')

    a = p.parse_args(argv)
    os.makedirs(BOX, exist_ok=True)

    if a.cmd == 'send':
        given = [x for x in (a.text, a.body, a.body_file) if x is not None]
        if len(given) > 1:
            sys.exit('give the body once: positional, --body, or --body-file')
        if a.body_file is not None:
            with open(a.body_file, encoding='utf-8') as f:
                text = f.read().strip()
        else:
            raw = a.body if a.body is not None else a.text
            if raw is None:
                sys.exit('missing message body (positional text, --body "...", or --body-file PATH)')
            text = sys.stdin.read().strip() if raw == '-' else raw
        if not text:
            sys.exit('empty message')
        msgs = read_all()
        msg = {'id': (msgs[-1]['id'] + 1) if msgs else 1, 'ts': int(time.time()),
               'from': a.sender, 'to': a.to, 'text': text}
        if a.tag:
            msg['tag'] = a.tag
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps(msg) + '\n')
        # receipt only — never echo the body back to stdout/the transcript.
        tagpart = f"{a.tag} " if a.tag else ''
        print(f"queued {tagpart}#{msg['id']} → {a.to}")

    elif a.cmd in ('inbox', 'peek'):
        msgs = unread_for(a.role)
        if a.tag:
            msgs = [m for m in msgs if m.get('tag') == a.tag]
        if not msgs:
            print(f'({a.role}: no unread)')
        else:
            for m in msgs:
                print(hdr(m) if a.headers else fmt(m))
            if a.cmd == 'inbox':
                # cursor moves to the newest unread we actually displayed
                set_cursor(a.role, max(m['id'] for m in unread_for(a.role)))
        # anti-stale-idle: an empty inbox is NOT an idle verdict — surface the
        # work stack at the exact moment a lane forms its "nothing to do" belief
        q = read_queue(a.role)
        if q:
            print(f"note: {len(q)} queued item(s) for {canon(a.role)} — `queue take --as {canon(a.role)}` pops the next")
        note = get_flag(a.role)
        if note:
            print(f"note: 🚩 flag note from {note.get('by', '?')}: {note.get('why') or '(no note)'} — "
                  f"`flag lower --as {canon(a.role)}` once acted on")

    elif a.cmd == 'log':
        for m in read_all()[-a.n:]:
            print(fmt(m))

    elif a.cmd == 'show':
        hits = [m for m in read_all() if msg_hash(m).startswith(a.prefix.lstrip('@'))]
        if not hits:
            sys.exit(f'no message matches @{a.prefix}')
        if len(hits) > 1:
            sys.exit(f'ambiguous: {len(hits)} messages match @{a.prefix} — use more characters')
        print(fmt(hits[0]))

    elif a.cmd == 'who':
        msgs = read_all()
        aliases = load_aliases()
        roles = sorted({canon(m['from']) for m in msgs}
                       | {canon(r) for m in msgs if m['to'] != 'all'
                          for r in recipients(m['to'])})
        for r in roles:
            print(f'{r}: {len(unread_for(r))} unread')
        for alias, target in sorted(aliases.items()):
            print(f'  (alias) {alias} → {target}')

    elif a.cmd == 'status':
        if a.text is not None:
            if not a.role:
                sys.exit('status: --as <role> required to SET a status')
            # anti-stale-idle guard (2026-07-21): a lane may not declare itself
            # plain-"waiting" while its work stack holds items — either take the
            # next item, or NAME what it is waiting on (await/block/park/hold/
            # gate/pending in the text passes the guard).
            low = a.text.strip().lower()
            if low.startswith('waiting'):
                q = read_queue(a.role)
                if q and not any(w in low for w in ('await', 'block', 'park', 'hold', 'gate', 'pending')):
                    sys.exit(f"status REJECTED: {canon(a.role)} has {len(q)} queued item(s) — "
                             f"run `queue take --as {canon(a.role)}` and post working, "
                             f"or say WHAT you are waiting on (awaiting/blocked/parked/holding/gated/pending …).")
            set_status(a.role, a.text)
            print(f'status[{canon(a.role)}] = {a.text}')
        else:
            board = all_statuses()
            if not board:
                print('(no statuses posted yet)')
            else:
                now = int(time.time())
                # oldest first so a stale lane surfaces at the top
                for role, stt in sorted(board.items(), key=lambda kv: kv[1]['ts']):
                    s = stt['state']
                    mins = (now - stt['ts']) / 60
                    stale = mins > STATUS_STALE_MIN and 'working' in s.lower() and 'long' not in s.lower()
                    qn = len(read_queue(role))
                    qtag = f' · queue {qn}' if qn else ''
                    ftag = ' · 🚩flag' if get_flag(role) else ''
                    print(f"{role}: {s}  ({age_str(stt['ts'])} ago){' ⚠STALE' if stale else ''}{qtag}{ftag}")

    elif a.cmd == 'queue':
        if a.action == 'add':
            if not a.forlane:
                sys.exit('queue add: --for <lane> required')
            if a.body_file:
                with open(a.body_file, encoding='utf-8') as f:
                    text = f.read().strip()
            elif a.body is not None:
                text = a.body
            else:
                text = None
            if text == '-':
                text = sys.stdin.read().strip()
            if not text:
                sys.exit('queue add: needs an item body (--body, --body-file, or - for stdin)')
            items = read_queue(a.forlane)
            nid = max([it.get('id', 0) for it in items], default=0) + 1
            items.append({'id': nid, 'tag': a.tag, 'text': text, 'ts': int(time.time()),
                          'by': canon(a.role) if a.role else 'architect'})
            write_queue(a.forlane, items)
            print(f'queued item #{nid}{" [" + a.tag + "]" if a.tag else ""} → {canon(a.forlane)} (depth {len(items)})')
        elif a.action == 'take':
            if not a.role:
                sys.exit('queue take: --as <lane> required')
            items = read_queue(a.role)
            if not items:
                print(f'({canon(a.role)} queue empty)')
            else:
                it = items.pop(0)
                write_queue(a.role, items)
                ts = time.strftime('%H:%M', time.localtime(it.get('ts', 0)))
                tag = f" [{it['tag']}]" if it.get('tag') else ''
                print(f"taken #{it.get('id')}{tag} (added {ts} by {it.get('by','?')}, {len(items)} left):")
                print(it['text'])
        elif a.action == 'list':
            board = {canon(a.forlane): read_queue(a.forlane)} if a.forlane else all_queues()
            if not any(board.values()):
                print('(all queues empty)')
            else:
                for lane, items in sorted(board.items()):
                    if not items:
                        continue
                    print(f'{lane}: {len(items)} queued')
                    for it in items:
                        head = it['text'].split('\n')[0][:70]
                        tag = f"[{it['tag']}] " if it.get('tag') else ''
                        print(f"  #{it.get('id')} {tag}{head}")
        elif a.action == 'drop':
            if not a.forlane or a.qid is None:
                sys.exit('queue drop: --for <lane> --id <n> required')
            items = read_queue(a.forlane)
            n = len(items)
            items = [it for it in items if it.get('id') != a.qid]
            write_queue(a.forlane, items)
            print(f'dropped #{a.qid} from {canon(a.forlane)} ({len(items)} left)' if len(items) < n
                  else f'#{a.qid} not in {canon(a.forlane)}')

    elif a.cmd == 'flag':
        if a.action == 'check':
            role = a.role or a.forlane
            if not role:
                sys.exit('flag: --as <role> required to check your flag')
            if a.raw:
                u, q, n = flag_counts(role)
                print(f'unread={u} queue={q} note={n}')
            else:
                print(flag_check_line(role))
        elif a.action == 'raise':
            if not a.forlane:
                sys.exit('flag raise: --for <role> required (whose flag goes up)')
            tmp = flag_file(a.forlane) + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump({'why': a.why, 'by': canon(a.role) if a.role else 'architect',
                           'ts': int(time.time())}, f)
            os.replace(tmp, flag_file(a.forlane))
            print(f'flag raised for {canon(a.forlane)}')
        elif a.action == 'lower':
            role = a.role or a.forlane
            if not role:
                sys.exit('flag lower: --as <role> required')
            note = get_flag(role)
            if not note:
                print(f'({canon(role)}: no manual flag was raised)')
            else:
                os.remove(flag_file(role))
                print(f"flag lowered for {canon(role)} (was from {note.get('by', '?')}: "
                      f"{note.get('why') or 'no note'})")

    elif a.cmd == 'lock':
        locks = read_locks()
        key = norm_path(a.path)
        held = locks.get(key)
        if held and held['by'] != a.role:
            sys.exit(f"DENIED: {key} locked by {held['by']} {age_str(held['ts'])} ago"
                     f" ({held.get('why') or 'no reason given'}) — mail them or the architect")
        locks[key] = {'by': a.role, 'ts': int(time.time()), 'why': a.why}
        write_locks(locks)
        print(f'locked {key} for {a.role}' + (' (renewed)' if held else ''))

    elif a.cmd == 'unlock':
        locks = read_locks()
        key = norm_path(a.path)
        held = locks.get(key)
        if not held:
            print(f'{key} was not locked')
            return
        if held['by'] != a.role and not a.force:
            sys.exit(f"DENIED: {key} is {held['by']}'s lock — only they (or --force by the architect) release it")
        del locks[key]
        write_locks(locks)
        print(f'unlocked {key}')
        if held['by'] != a.role:
            # forced release is arbitration — everyone hears about it
            msgs = read_all()
            msg = {'id': (msgs[-1]['id'] + 1) if msgs else 1, 'ts': int(time.time()),
                   'from': a.role, 'to': 'all', 'tag': 'fyi',
                   'text': f"FORCED UNLOCK: {key} (was {held['by']}'s: {held.get('why') or 'no reason'})"}
            with open(LOG, 'a', encoding='utf-8') as f:
                f.write(json.dumps(msg) + '\n')
            print(f"broadcast #{msg['id']} @{msg_hash(msg)}")

    elif a.cmd == 'locks':
        locks = read_locks()
        if not locks:
            print('(no locks held)')
            return
        for key in sorted(locks):
            h = locks[key]
            print(f"{key}  ·  {h['by']}  ·  {age_str(h['ts'])}  ·  {h.get('why') or '-'}")


if __name__ == '__main__':
    main()
