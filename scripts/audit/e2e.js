import { spawnSync } from 'node:child_process';

export async function checkE2E({ root }) {
  // Use reporter=json for parsing
  const res = spawnSync('npx', ['playwright', 'test', '--reporter=json'], {
    cwd: root, shell: true, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  });

  if (res.error) return { status: 'fail', message: `Playwright failed to start: ${res.error.message}` };

  // Extract JSON from mixed stdout (Playwright may prepend logs)
  let json;
  try {
    const start = res.stdout.indexOf('{');
    json = JSON.parse(res.stdout.slice(start));
  } catch {
    // If we can't parse, fall back to exit code
    if (res.status === 0) return { status: 'pass', message: 'E2E passed (no JSON parsed)' };
    return { status: 'fail', message: 'E2E failed and JSON unparseable', details: res.stderr?.slice(-500) };
  }

  const stats = json.stats || {};
  const total = (stats.expected || 0) + (stats.unexpected || 0) + (stats.flaky || 0);
  const failed = stats.unexpected || 0;
  const passed = stats.expected || 0;
  const flaky = stats.flaky || 0;

  if (failed > 0) {
    return {
      status: 'fail',
      message: `${failed}/${total} E2E tests failed`,
      metrics: { total, passed, failed, flaky },
    };
  }

  if (flaky > 0) {
    return {
      status: 'warn',
      message: `${passed}/${total} passed (${flaky} flaky)`,
      metrics: { total, passed, failed, flaky },
    };
  }

  return {
    status: 'pass',
    message: `${passed}/${total} E2E tests passed`,
    metrics: { total, passed, failed, flaky },
  };
}
