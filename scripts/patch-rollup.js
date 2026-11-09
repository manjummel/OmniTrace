import fs from 'node:fs';
import path from 'node:path';

const nativeJsPath = path.resolve('node_modules/rollup/dist/native.js');

if (fs.existsSync(nativeJsPath)) {
  let content = fs.readFileSync(nativeJsPath, 'utf8');
  if (content.includes('const nativeModule = requireWithFriendlyError(')) {
    const replacement = `let nativeModule;
try {
	nativeModule = require(existsSync(path.join(__dirname, localName)) ? localName : \`@rollup/rollup-\${packageBase}\`);
} catch (e) {
	try {
		nativeModule = require('@rollup/wasm-node/dist/native.js');
	} catch (wasmError) {
		throw e;
	}
}`;
    content = content.replace(
      'const nativeModule = requireWithFriendlyError(\n\texistsSync(path.join(__dirname, localName)) ? localName : `@rollup/rollup-${packageBase}`\n);',
      replacement
    );
    fs.writeFileSync(nativeJsPath, content, 'utf8');
    console.log('[Blast Radius] Successfully applied Rollup WASM fallback patch for restricted environments.');
  }
}

