import { spawnSync } from 'node:child_process';

export async function checkUnitTests({ root }) {
  const res = spawnSync('npx', ['vitest', 'run', '--reporter=json'], {
    cwd: root, shell: true, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024,
  });

  if (res.error) return { status: 'fail', message: `Vitest failed to start: ${res.error.message}` };

  // Vitest JSON reporter prints a large JSON to stdout
  let json;
  try {
    // Find the JSON blob (may have leading text)
    const match = res.stdout.match(/\{[\s\S]*\}\s*$/);
    json = JSON.parse(match ? match[0] : res.stdout);
  } catch {
    return { status: 'fail', message: 'Could not parse vitest output', details: res.stderr || res.stdout };
  }

  const total = json.numTotalTests || 0;
  const failed = json.numFailedTests || 0;
  const passed = json.numPassedTests || 0;

  if (failed > 0) {
    const failures = [];
    for (const suite of json.testResults || []) {
      for (const t of suite.assertionResults || []) {
        if (t.status === 'failed') failures.push(`${suite.name} > ${t.title}`);
      }
    }
    return {
      status: 'fail',
      message: `${failed}/${total} tests failed`,
      details: failures.slice(0, 10).join('\n'),
    };
  }

  return {
    status: 'pass',
    message: `${passed}/${total} tests passed`,
    metrics: { total, passed, failed },
  };
}
