// Custom Playwright reporter that collects all page errors and console.errors,
// even from tests that pass. Outputs to e2e-errors.json at the end of the run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

class ErrorCollector {
  constructor() {
    this.errors = [];
    this.testCount = 0;
  }

  onTestEnd(test, result) {
    this.testCount++;
    // result.errors[] contains assertion failures, but we also want pageerror/console
    // those are in result.attachments or result.steps
    for (const err of (result.errors || [])) {
      this.errors.push({
        type: 'test_error',
        test: test.title,
        file: test.location.file.split(/[\\/]/).pop(),
        message: (err.message || '').slice(0, 500),
        stack: (err.stack || '').slice(0, 1000),
      });
    }
    // Stdout/stderr captured by Playwright
    for (const out of (result.stdout || [])) {
      const text = out.toString();
      if (text.includes('Error') || text.includes('error') || text.includes('TypeError') || text.includes('ReferenceError')) {
        this.errors.push({ type: 'stdout', test: test.title, file: test.location.file.split(/[\\/]/).pop(), message: text.slice(0, 300) });
      }
    }
    for (const out of (result.stderr || [])) {
      const text = out.toString();
      this.errors.push({ type: 'stderr', test: test.title, file: test.location.file.split(/[\\/]/).pop(), message: text.slice(0, 300) });
    }
  }

  async onEnd(result) {
    const outPath = path.join(root, 'e2e-errors.json');
    fs.writeFileSync(outPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      testCount: this.testCount,
      status: result.status,
      errorCount: this.errors.length,
      errors: this.errors,
    }, null, 2));
    console.log(`\n[playwright-error-collector] Wrote ${this.errors.length} error(s) to ${outPath}`);
  }
}

export default ErrorCollector;
