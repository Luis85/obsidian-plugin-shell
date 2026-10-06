/** One rule for the session hook's opt-in/opt-out switches: `<NAME>=0` never, `<NAME>=1` always, otherwise cloud sessions only. */
export function switchDecision(env, name) {
  if (env[name] === '0') return { enabled: false, why: `${name}=0` };
  if (env[name] === '1') return { enabled: true, why: 'opted in' };
  return env.CLAUDE_CODE_REMOTE === 'true' ? { enabled: true, why: 'cloud session' } : { enabled: false, why: `local session; set ${name}=1 to allow` };
}
