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
    return os.path.join(BOX, f'cursor-{role}')


def get_cursor(role):
    try:
        with open(cursor_file(role)) as f:
            return int(f.read().strip() or 0)
    except (FileNotFoundError, ValueError):
        return 0


def set_cursor(role, value):
    with open(cursor_file(role), 'w') as f:
        f.write(str(value))


def unread_for(role):
    cur = get_cursor(role)
    return [m for m in read_all()
            if m['id'] > cur and (m['to'] == role or m['to'] == 'all') and m['from'] != role]


def fmt(m):
    ts = time.strftime('%H:%M', time.localtime(m['ts']))
    tag = f" [{m['tag']}]" if m.get('tag') else ''
    head = f"#{m['id']} @{msg_hash(m)} {ts} {m['from']} → {m['to']}{tag}"
    body = m['text'] if '\n' not in m['text'] else '\n  ' + m['text'].replace('\n', '\n  ')
    return f"{head}: {body}" if '\n' not in m['text'] else f"{head}:{body}"


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)

    s = sub.add_parser('send')
    s.add_argument('--from', dest='sender', required=True)
    s.add_argument('--to', dest='to', required=True)
    s.add_argument('--tag', dest='tag', default='')
    s.add_argument('text', help="message body, or '-' to read from stdin")

    for name in ('inbox', 'peek'):
        i = sub.add_parser(name)
        i.add_argument('--as', dest='role', required=True)
        i.add_argument('--tag', dest='tag', default='')

    l = sub.add_parser('log')
    l.add_argument('-n', type=int, default=15)

    sh = sub.add_parser('show')
    sh.add_argument('prefix', help='global message hash (or unique prefix)')

    sub.add_parser('who')

    lk = sub.add_parser('lock')
    lk.add_argument('path', help='file to lock (repo-relative)')
    lk.add_argument('--as', dest='role', required=True)
    lk.add_argument('--why', dest='why', default='')

    ul = sub.add_parser('unlock')
    ul.add_argument('path')
    ul.add_argument('--as', dest='role', required=True)
    ul.add_argument('--force', action='store_true',
                    help='architect arbitration: release someone else\'s lock (broadcasts)')

    sub.add_parser('locks')

    a = p.parse_args()
    os.makedirs(BOX, exist_ok=True)

    if a.cmd == 'send':
        text = sys.stdin.read().strip() if a.text == '-' else a.text
        if not text:
            sys.exit('empty message')
        msgs = read_all()
        msg = {'id': (msgs[-1]['id'] + 1) if msgs else 1, 'ts': int(time.time()),
               'from': a.sender, 'to': a.to, 'text': text}
        if a.tag:
            msg['tag'] = a.tag
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps(msg) + '\n')
        print(f"sent #{msg['id']} @{msg_hash(msg)} to {a.to}")

    elif a.cmd in ('inbox', 'peek'):
        msgs = unread_for(a.role)
        if a.tag:
            msgs = [m for m in msgs if m.get('tag') == a.tag]
        if not msgs:
            print(f'({a.role}: no unread)')
            return
        for m in msgs:
            print(fmt(m))
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
        roles = sorted({m['from'] for m in msgs} | {m['to'] for m in msgs if m['to'] != 'all'})
        for r in roles:
            print(f'{r}: {len(unread_for(r))} unread')

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
