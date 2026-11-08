import { useState } from 'react';

const SAMPLES = {
  OOM: `FATAL: container worker-3 terminated with exit code 137 (OOMKilled). Memory limit 512Mi exceeded during image batch resizing.`,
  TIMEOUT: `error: connection to server at "db-prod.internal" (10.0.4.12), port 5432 failed: Connection timed out. Is PostgreSQL accepting connections?`,
  PORT_CONFLICT: `Error: listen EADDRINUSE: address already in use :::8000. Failed to bind server socket.`
};

export default function App() {
  const [logText, setLogText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!logText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_text: logText }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">CloudPulse</h1>
          <p className="text-slate-400 text-sm mt-1">AI-Powered Cloud & Server Log Diagnostics</p>
        </header>

        {/* Preset Samples */}
        <div className="flex gap-2 mb-3">
          <span className="text-xs text-slate-400 self-center mr-1">Try sample:</span>
          {Object.entries(SAMPLES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setLogText(val)}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Input */}
        <textarea
          rows={5}
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          placeholder="Paste raw server logs, Docker errors, or stack traces here..."
          className="w-full p-3 font-mono text-sm bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        <button
          onClick={handleAnalyze}
          disabled={loading || !logText.trim()}
          className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition"
        >
          {loading ? 'Diagnosing Incident...' : 'Analyze Log'}
        </button>

        {error && <div className="mt-4 p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div>}

        {/* Diagnosis Results */}
        {result && (
          <div className="mt-6 p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                {result.category}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                result.severity === 'Critical' ? 'bg-red-900/60 text-red-300' : 'bg-amber-900/60 text-amber-300'
              }`}>
                {result.severity}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300">Summary</h3>
              <p className="text-sm text-slate-400 mt-0.5">{result.summary}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300">Root Cause</h3>
              <p className="text-sm text-slate-400 mt-0.5">{result.root_cause}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300">Remediation</h3>
              <pre className="mt-1 p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto">
                {result.fix_command_or_code}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}