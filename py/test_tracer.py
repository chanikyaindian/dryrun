import asyncio
import json
import unittest

from tracer import run_trace, run_trace_async


class TracerTests(unittest.TestCase):
    def trace(self, source):
        return json.loads(run_trace(source.strip()))

    def test_compile_error_has_location(self):
        step, = self.trace("break")['steps']
        self.assertIn("outside loop", step['error'])
        self.assertEqual(step['l'], 1)
        self.assertEqual(step['syntax']['column'], 1)

    def test_match_handler_and_cleanup(self):
        result = self.trace("""
match [1, 2, 3]:
    case [first, *rest]:
        try:
            raise ValueError("example")
        except ValueError as error:
            print(sum(rest))
        finally:
            print("cleanup")
""")
        steps = result['steps']
        self.assertTrue(any(step.get('exc', {}).get('name') == 'ValueError' for step in steps))
        self.assertTrue(any(step.get('handled') == 'ValueError' for step in steps))
        self.assertTrue(any(step.get('cleanup') for step in steps))
        self.assertEqual(steps[-1]['out'], '5\ncleanup\n')
        self.assertTrue(steps[-1]['done'])

    def test_unhandled_exception_keeps_raising_line(self):
        steps = self.trace("""
def fail():
    try:
        raise ValueError("bad")
    finally:
        print("cleanup")
fail()
""")['steps']
        self.assertEqual(steps[-1]['l'], 3)
        self.assertEqual(steps[-1]['error'], 'ValueError: bad')
        self.assertEqual(steps[-1]['out'], 'cleanup\n')

    def test_exception_groups(self):
        steps = self.trace("""
try:
    raise ExceptionGroup("batch", [ValueError("x"), TypeError("y")])
except* ValueError:
    print("value")
except* TypeError:
    print("type")
""")['steps']
        self.assertTrue(any('ValueError, TypeError' in step.get('exc', {}).get('message', '') for step in steps))
        self.assertEqual(sum('handled' in step for step in steps), 2)
        self.assertEqual(steps[-1]['out'], 'value\ntype\n')

    def test_visual_inspection_does_not_repeat_properties_or_repr(self):
        steps = self.trace("""
class Item:
    def __init__(self):
        self.calls = 0

    @property
    def index(self):
        self.calls += 1
        return 0

    def __repr__(self):
        raise AssertionError("tracer called repr")

item = Item()
data = [True]
if data[item.index]:
    print(item.calls)
""")['steps']
        self.assertTrue(steps[-1]['done'])
        self.assertEqual(steps[-1]['out'], '1\n')

    def test_slotted_dataclass_references_and_large_integers(self):
        step = self.trace("""
from __future__ import annotations
from dataclasses import dataclass

@dataclass(slots=True)
class Node:
    value: int
    next: Node | None = None

if __name__ == "__main__":
    head = Node(1, Node(2**60))
""")['steps'][-1]
        head = step['F'][0]['v']['head']['r']
        tail = dict(step['H'][str(head)]['v'])['next']['r']
        self.assertEqual(dict(step['H'][str(tail)]['v'])['value'], {'p': str(2**60)})

    def test_import_aliases_provide_heap_roles(self):
        trace = self.trace("""
from heapq import heappush as push
pending = []
push(pending, (5, 'node'))
""")
        self.assertIn('@heap', trace['feat'])
        self.assertIn('@heapvar:pending', trace['feat'])

    def test_generator_calls_can_suspend_and_resume(self):
        trace = self.trace("""
def numbers():
    yield 1
    yield 2
print(list(numbers()))
""")
        self.assertTrue(any(event.get('rv') == 'suspended' for event in trace['evs']))
        self.assertTrue(any(event.get('lab', '').startswith('resume ') for event in trace['evs']))
        self.assertEqual(trace['steps'][-1]['out'], '[1, 2]\n')

    def test_top_level_await_runs_on_the_existing_event_loop(self):
        trace = json.loads(asyncio.run(run_trace_async("""
import asyncio

async def compute():
    await asyncio.sleep(0)
    return 42

print(await compute())
""".strip())))
        self.assertEqual(trace['steps'][-1]['out'], '42\n')
        self.assertTrue(trace['steps'][-1]['done'])

    def test_trace_limit_survives_user_catching_base_exception(self):
        step = self.trace("""
try:
    while True:
        pass
except BaseException:
    print("caught")
""")['steps'][-1]
        self.assertIn('4000 steps', step['error'])


if __name__ == '__main__':
    unittest.main()
