import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export async function checkIntegration({ root }) {
  const envPath = join(root, '.env.test');
  if (!existsSync(envPath)) {
    return {
      status: 'skip',
      message: '.env.test not configured — run: cp .env.test.example .env.test and fill it',
      details: 'See tests/integration/README.md for the 5-minute setup of a dedicated test Supabase project.',
    };
  }

  const res = spawnSync('npx', ['vitest', 'run', '--config', 'vitest.integration.config.js', '--reporter=json'], {
    cwd: root, shell: true, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024,
  });

  if (res.error) return { status: 'fail', message: `Integration runner failed: ${res.error.message}` };

  let json;
  try {
    const match = res.stdout.match(/\{[\s\S]*\}\s*$/);
    json = JSON.parse(match ? match[0] : res.stdout);
  } catch {
    return {
      status: 'fail',
      message: 'Could not parse integration output',
      details: (res.stderr || res.stdout).slice(-800),
    };
  }

  const total = json.numTotalTests || 0;
  const passed = json.numPassedTests || 0;
  const failed = json.numFailedTests || 0;

  if (failed > 0) {
    const failures = [];
    for (const suite of json.testResults || []) {
      for (const t of suite.assertionResults || []) {
        if (t.status === 'failed') failures.push(`${suite.name} > ${t.title}`);
      }
    }
    return {
      status: 'fail',
      message: `${failed}/${total} integration tests failed`,
      details: failures.slice(0, 10).join('\n'),
    };
  }

  return {
    status: 'pass',
    message: `${passed}/${total} integration tests passed`,
    metrics: { total, passed, failed },
  };
}
