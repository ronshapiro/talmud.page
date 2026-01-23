import * as fs from 'fs';
import * as path from 'path';

const distDir = 'dist';
const templatesDir = 'templates';

// Ensure dist exists and is empty
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// 1. Find inputs
const templates = fs.readdirSync(templatesDir).filter(f => f.endsWith('.html'));

// Matches src="/..." ending in .js, .ts, .jsx, .tsx
const scriptRegex = /src=["'](\/[^"']+\.[jt]sx?)["']/g;
// Matches href="/..." ending in .css
const cssRegex = /href=["'](\/[^"']+\.css)["']/g;

const foundAssets = new Set<string>();

for (const tmpl of templates) {
  const content = fs.readFileSync(path.join(templatesDir, tmpl), 'utf-8');
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    foundAssets.add(match[1]);
  }
  while ((match = cssRegex.exec(content)) !== null) {
    foundAssets.add(match[1]);
  }
}

// Convert absolute paths to relative to root (remove leading /)
const inputList = Array.from(foundAssets).map(p => p.startsWith('/') ? p.slice(1) : p);

console.log('Building with inputs:', inputList);

(async () => {
  const { build } = await import('vite');

  // 2. Build
  if (inputList.length > 0) {
    await build({
      build: {
        rollupOptions: {
          input: inputList,
        },
        outDir: distDir,
        manifest: true,
        emptyOutDir: true,
      },
      configFile: 'vite.config.ts', // Use common config
    });
  } else {
    console.warn("No inputs found to build.");
  }

  // 3. Copy templates
  for (const tmpl of templates) {
    fs.copyFileSync(path.join(templatesDir, tmpl), path.join(distDir, tmpl));
  }

  // 4. Process templates
  const manifestPath = path.join(distDir, '.vite/manifest.json');
  let manifest: any = {};

  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } else if (fs.existsSync(path.join(distDir, 'manifest.json'))) {
    manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf-8'));
  } else {
    // It is possible that manifest is missing if no assets were built, but we have inputs.
    // Or vite config didn't output manifest.
  }

  for (const tmpl of templates) {
    const tmplPath = path.join(distDir, tmpl);
    let content = fs.readFileSync(tmplPath, 'utf-8');

    for (const [key, entry] of Object.entries(manifest)) {
        const inputPath = '/' + key;
        const outputPath = '/' + (entry as any).file;

        // Global replace
        content = content.split(inputPath).join(outputPath);
    }

    fs.writeFileSync(tmplPath, content);
  }

  console.log("Build complete.");

})();
