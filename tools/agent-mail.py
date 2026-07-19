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


def proxy(argv, url):
    import urllib.request
    req = urllib.request.Request(url + '/rpc',
        data=json.dumps({'argv': argv}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            reply = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        sys.exit(f'mail hub unreachable at {url}: {e} — fix or delete .agent-mail/remote')
    out = reply.get('out', '')
    if out:
        print(out, end='' if out.endswith('\n') else '\n')
    return int(reply.get('code', 0))


def serve(host, port):
    import io
    import contextlib
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

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
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
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
            return
        for m in msgs:
            print(hdr(m) if a.headers else fmt(m))
        if a.cmd == 'inbox' and msgs:
            # cursor moves to the newest unread we actually displayed
            set_cursor(a.role, max(m['id'] for m in unread_for(a.role)))

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
