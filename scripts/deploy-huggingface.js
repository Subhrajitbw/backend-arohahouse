#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const hfToken = process.env.HF_TOKEN || process.argv[2];
  const spaceName = process.env.SPACE_NAME || process.argv[3] || 'arohahouse-backend';

  if (!hfToken) {
    console.error('❌ Error: Hugging Face token is required.');
    console.error('Usage: node scripts/deploy-huggingface.js <HF_TOKEN> [SPACE_NAME]');
    console.error('Get your token (Write permission) at: https://huggingface.co/settings/tokens');
    process.exit(1);
  }

  console.log('🔍 Authenticating with Hugging Face API...');
  const whoamiRes = await fetch('https://huggingface.co/api/whoami-v2', {
    headers: { Authorization: `Bearer ${hfToken}` }
  });

  if (!whoamiRes.ok) {
    console.error('❌ Authentication failed:', await whoamiRes.text());
    process.exit(1);
  }

  const user = await whoamiRes.json();
  const username = user.name;
  const repoId = `${username}/${spaceName}`;
  console.log(`✅ Authenticated as: ${username}`);

  console.log(`📦 Ensuring Docker Space "${repoId}" exists...`);
  const createRes = await fetch('https://huggingface.co/api/repos/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'space',
      name: spaceName,
      space_sdk: 'docker',
      private: false
    })
  });

  if (createRes.status === 200 || createRes.status === 201) {
    console.log(`✅ Created Space: https://huggingface.co/spaces/${repoId}`);
  } else if (createRes.status === 409) {
    console.log(`ℹ️ Space already exists: https://huggingface.co/spaces/${repoId}`);
  } else {
    console.log(`⚠️ Space creation note:`, await createRes.text());
  }

  // Parse .env.server
  const envPath = path.resolve(__dirname, '../.env.server');
  if (fs.existsSync(envPath)) {
    console.log('🔑 Syncing secrets from .env.server to Hugging Face Space...');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      try {
        const secRes = await fetch(`https://huggingface.co/api/spaces/${repoId}/secrets`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ key, value, description: 'Synced from .env.server' })
        });
        if (secRes.ok) {
          console.log(`  ✓ Synced secret: ${key}`);
        } else {
          console.log(`  ℹ️ Secret ${key}: ${secRes.statusText}`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to set secret ${key}:`, err.message);
      }
    }
  }

  console.log('🚀 Pushing repository to Hugging Face Space...');
  const remoteUrl = `https://${username}:${hfToken}@huggingface.co/spaces/${repoId}`;
  
  try {
    execSync(`git remote remove hf 2>/dev/null || true`, { stdio: 'ignore' });
    execSync(`git remote add hf "${remoteUrl}"`, { stdio: 'ignore' });
    execSync(`git push hf cloudflare-container:main --force`, { stdio: 'inherit' });
    console.log(`\n🎉 Successfully deployed!`);
    console.log(`🌐 Your Medusa Space: https://huggingface.co/spaces/${repoId}`);
    console.log(`🔌 Direct API URL: https://${username.toLowerCase()}-${spaceName.toLowerCase().replace(/_/g, '-')}.hf.space`);
  } catch (err) {
    console.error('❌ Git push error:', err.message);
  } finally {
    // Clean up remote with embedded token
    execSync(`git remote remove hf 2>/dev/null || true`, { stdio: 'ignore' });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
