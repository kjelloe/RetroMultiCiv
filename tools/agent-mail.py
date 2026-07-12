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
"""
import argparse
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOX = os.path.join(ROOT, '.agent-mail')
LOG = os.path.join(BOX, 'messages.jsonl')


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
    head = f"#{m['id']} {ts} {m['from']} → {m['to']}{tag}"
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

    sub.add_parser('who')

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
        print(f"sent #{msg['id']} to {a.to}")

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

    elif a.cmd == 'who':
        msgs = read_all()
        roles = sorted({m['from'] for m in msgs} | {m['to'] for m in msgs if m['to'] != 'all'})
        for r in roles:
            print(f'{r}: {len(unread_for(r))} unread')


if __name__ == '__main__':
    main()
