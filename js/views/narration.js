import { rp } from './basic.js';

const short = (text, limit = 86) => text.length > limit ? text.slice(0, limit - 1) + '…' : text;
const code = line => line.trim().split(/\s+# Step:/, 1)[0];

export function explain(step, previous, frame, changes, lines) {
  if (step.error) return step.error;
  if (step.exc) {
    const { name, message } = step.exc;
    return name + (message ? ': ' + message : '');
  }
  if (step.handled) return 'The except block handles ' + step.handled + '.';
  if (step.cleanup) return 'The finally block runs during cleanup.';
  if (step.tryElse) return 'The try block completed, so its else block runs.';
  if (step.done) return step.out ? 'The run is complete. The result is in Output.' : 'The run is complete.';
  if (!previous) return 'Press Play or take the first step to start this run.';
  if (step.out !== previous.out) {
    const printed = step.out.slice(previous.out.length).trim();
    return printed ? 'Printed ' + short(printed.replace(/\s*\n\s*/g, ' · ')) + '.' : 'Wrote a blank line to Output.';
  }
  if (step.F.length > previous.F.length) {
    const args = frame.a.map(key => rp(step.H, frame.v[key])).join(', ');
    return 'Enter ' + frame.n + '(' + short(args) + ').';
  }
  if (step.F.length < previous.F.length) {
    if (step.rv === 'suspended') return 'The function suspended and gave control back to its caller.';
    const name = previous.F.at(-1)?.n ?? 'The function';
    if (step.rv !== undefined) return name + ' returns ' + short(step.rv) + '.';
    return 'Leave ' + name + ' and continue in its caller.';
  }

  const line = code(lines[previous.l - 1] || '');
  if (previous.c && /^(if|elif|while)\b/.test(line)) {
    const test = previous.c.split('→')[0].trim();
    const sourceTest = line.replace(/^(if|elif|while)\s+|:\s*$/g, '');
    // A compound test can record only the last comparison it evaluated.
    const simple = /^[\w.]+\s*(?:==|!=|<=|>=|<|>)\s*[\w.]+$/.test(sourceTest);
    const condition = '“' + short(simple && !/^(True|False)$/.test(test) ? test : sourceTest, 64) + '”';
    const passed = previous.c.endsWith('True');
    if (line.startsWith('while ')) return condition + (passed ? ' is true. Run another loop iteration.' : ' is false. Exit the loop.');
    return condition + (passed ? ' is true. Enter this branch.' : ' is false. Skip this branch.');
  }
  if (previous.exc) return 'Execution continues after ' + previous.exc.name + '.';
  if (/^finally\b/.test(line)) return 'The finally block runs during cleanup.';
  if (/^case\b/.test(line)) return 'Python checks this match case.';
  if (/^(async )?for\b/.test(line) && !changes.length) return 'Check for the next item in “' + short(line.replace(/:\s*$/, ''), 66) + '”.';
  if (/^(async )?with\b/.test(line)) return 'The context manager handles setup or cleanup.';
  if (/^return\b/.test(line)) return 'The function hands back its result.';
  const definition = /^(?:async )?(def|class)\s+(\w+)/.exec(line);
  if (definition) return 'Define ' + (definition[1] === 'def' ? 'the function ' : 'the class ') + definition[2] + '.';
  if (/^break\b/.test(line)) return 'The loop exits.';
  if (/^continue\b/.test(line)) return 'The loop skips to the next iteration.';
  if (/^print\b/.test(line)) return 'The program writes to the output.';
  const change = /^([^:]+): (.+) → (.+)$/.exec(changes[0] ?? '');
  if (change) {
    const [, name, before, after] = change;
    const length = /^len (\d+)$/.exec(after);
    if (length) return name + ' now holds ' + length[1] + (length[1] === '1' ? ' item.' : ' items.');
    return before === '—' ? 'Set ' + name + ' to ' + short(after) + '.' : name + ' changes from ' + short(before, 42) + ' to ' + short(after, 56) + '.';
  }
  return line ? 'Evaluate “' + short(line) + '”.' : 'Continue to the next recorded step.';
}

