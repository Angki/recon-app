const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'release');
const artifactPattern = /\.(exe|msi|msix|zip|7z|dmg|pkg|AppImage|deb|rpm)$/i;

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toUpperCase()));
  });
}

async function main() {
  if (!fs.existsSync(releaseDir)) {
    console.error(`[checksums] Release directory not found: ${releaseDir}`);
    process.exit(1);
  }

  const artifacts = fs.readdirSync(releaseDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && artifactPattern.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (artifacts.length === 0) {
    console.error('[checksums] No release artifacts found at the top level of release/. Run the build first.');
    process.exit(1);
  }

  const lines = [];
  for (const name of artifacts) {
    const filePath = path.join(releaseDir, name);
    const digest = await sha256(filePath);
    const size = fs.statSync(filePath).size;
    lines.push(`${digest}  ${name}`);
    console.log(`[checksums] ${digest}  ${name} (${size.toLocaleString()} bytes)`);
  }

  const outputPath = path.join(releaseDir, 'SHA256SUMS');
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');
  console.log(`[checksums] Wrote ${outputPath}`);
}

main().catch(error => {
  console.error(`[checksums] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
