const { spawn } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('dry-run');

if (dryRun) {
  process.env.DRY_RUN = 'true';
}

// Remove --dry-run from args so medusa exec doesn't fail
const cleanArgs = args.filter(arg => arg !== '--dry-run' && arg !== 'dry-run');

const child = spawn('npx', ['medusa', 'exec', './scripts/restore-categories.ts', ...cleanArgs], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  process.exit(code);
});
