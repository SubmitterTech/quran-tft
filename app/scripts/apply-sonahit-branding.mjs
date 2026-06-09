import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const buildDir = path.resolve(process.cwd(), 'build');
const indexPath = path.join(buildDir, 'index.html');

const brand = {
  title: 'KURAN SON AHİT',
  appName: 'Kuran Son Ahit',
  shortName: 'Kuran',
  description: 'Kuran Son Ahit (İnteraktif Kitap)',
  shortcutName: 'Ara',
  shortcutDescription: 'Ayet, başlık, dipnot ve eklerde ara',
};

function assertBuildFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected build file not found: ${filePath}`);
  }
}

function replaceAll(input, replacements) {
  return replacements.reduce(
    (current, [from, to]) => current.split(from).join(to),
    input,
  );
}

function updateIndexHtml() {
  assertBuildFile(indexPath);

  const original = fs.readFileSync(indexPath, 'utf8');
  const updated = replaceAll(original, [
    ['Quran The Final Testament (Interactive Book)', brand.description],
    ['QURAN TFT', brand.title],
    ['Quran TFT', brand.appName],
  ]);

  fs.writeFileSync(indexPath, updated);

  const required = [
    brand.title,
    brand.appName,
    brand.description,
  ];
  const missing = required.filter((value) => !updated.includes(value));
  if (missing.length > 0) {
    throw new Error(`Son Ahit index branding failed; missing: ${missing.join(', ')}`);
  }
}

function updateManifest(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const manifest = JSON.parse(raw);

  manifest.short_name = brand.shortName;
  manifest.name = brand.appName;
  manifest.description = brand.description;
  manifest.lang = 'tr';

  if (Array.isArray(manifest.shortcuts)) {
    manifest.shortcuts = manifest.shortcuts.map((shortcut) => ({
      ...shortcut,
      name: brand.shortcutName,
      short_name: brand.shortcutName,
      description: brand.shortcutDescription,
    }));
  }

  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function updateManifests() {
  const entries = fs.readdirSync(buildDir, { withFileTypes: true });
  const manifestFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^manifest(?:\.[a-z0-9-]+)?\.json$/i.test(name));

  if (manifestFiles.length === 0) {
    throw new Error(`No manifest files found in ${buildDir}`);
  }

  manifestFiles.forEach((fileName) => updateManifest(path.join(buildDir, fileName)));
}

updateIndexHtml();
updateManifests();

console.log('Applied Son Ahit branding to build output.');
