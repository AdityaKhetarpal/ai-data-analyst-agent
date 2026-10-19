// The agent's path for every question, as a strip of numbered steps (matches the files in agent/)
const STEPS = [
  ["3", "describe the tables"], ["4", "add 5 worked examples"], ["6", "AI writes SQL"],
  ["5", "safety check"], ["2", "run read-only"], ["7", "fix errors (≤2)"], ["7", "answer + chart"],
];

export default function PipelineStrip() {
  return (
    <div className="strip">
      <div>
        <p className="strip-label">every question goes through</p>
        <ol>{STEPS.map(([n, t], i) => <li key={i}><span>step {n}</span>{t}</li>)}</ol>
      </div>
    </div>
  );
}
