import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { beatPosition } from './watchModel';
import type { Replay } from './workspace';

type Question = { from: number; target: number; prompt: string; choices: string[]; answer: number; explanation: string };

function nextQuestion(replay: Replay, index: number): Question | undefined {
  const { beats, scene } = replay.watch;
  const at = beatPosition(beats, index);
  const current = beats[at], next = beats[at + 1];
  if (!next || current?.index !== index) return;
  const base = { from: index, target: next.index, explanation: next.label };
  if (current.kind === 'compare' && (next.kind === 'swap' || next.kind === 'compare')) {
    return { ...base, prompt: 'What happens to the highlighted values?', choices: ['They swap', 'They stay in place'], answer: next.kind === 'swap' ? 0 : 1 };
  }
  if (next.kind === 'probe' && next.cells?.length && scene.id) {
    const value = next.cells[0];
    const length = replay.steps[next.index].H[scene.id]?.v.length ?? 0;
    const choices = [value - 1, value, value + 1].filter(number => number >= 0 && number < length);
    if (choices.length > 1) return { ...base, prompt: 'Which index will be checked next?', choices: choices.map(i => 'Index ' + i), answer: choices.indexOf(value) };
  }
}

export function Prediction({ replay, index, onPause, onReveal }: { replay: Replay; index: number; onPause: () => void; onReveal: () => void }) {
  const [session, setSession] = useState<{ question: Question; answer?: number } | null>(null);
  const prompt = session && session.answer === undefined && session.question.from === index ? session.question : undefined;
  const result = session && session.answer !== undefined && session.question.target === index ? session : undefined;
  const question = nextQuestion(replay, index);
  if (result) {
    const correct = result.answer === result.question.answer;
    return <div className="prediction" data-result={correct ? 'correct' : 'incorrect'}>
      <div role="status"><strong>{correct ? 'Correct' : 'The trace shows ' + result.question.choices[result.question.answer].toLowerCase()}</strong>
        <p>{result.question.explanation}</p></div>
      <button type="button" className="button compact neutral" onClick={() => setSession(null)}>Done</button>
    </div>;
  }
  if (prompt) return <div className="prediction">
    <p>{prompt.prompt}</p>
    <div className="prediction-answers">{prompt.choices.map((choice, i) => <button className="button compact neutral" type="button" key={choice} onClick={() => {
      setSession({ question: prompt, answer: i });
      onReveal();
    }}>{choice}</button>)}</div>
    <button type="button" className="button compact prediction-skip" onClick={() => setSession(null)}>Skip question</button>
  </div>;
  return question ? <button type="button" className="button neutral compact predict-trigger" onClick={() => {
    onPause();
    setSession({ question });
  }}><Lightbulb />Predict next</button> : null;
}
