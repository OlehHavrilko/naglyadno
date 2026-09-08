// Минимальный логгер с меткой этапа и времени.
const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export function logger(stage) {
  const p = `[${stage}]`;
  return {
    info: (...a) => console.log(ts(), p, ...a),
    warn: (...a) => console.warn(ts(), p, 'WARN', ...a),
    error: (...a) => console.error(ts(), p, 'ERROR', ...a),
    ok: (...a) => console.log(ts(), p, 'OK', ...a),
  };
}
