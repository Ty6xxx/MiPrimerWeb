/**
 * Parche post-install para @liamcottle/rustplus.js
 * Cambia TODOS los campos 'required' a 'optional' en rustplus.proto
 * para evitar crashes por campos faltantes del servidor de Rust.
 */
const fs = require('fs');
const path = require('path');

const protoPath = path.join(__dirname, '..', 'node_modules', '@liamcottle', 'rustplus.js', 'rustplus.proto');

if (!fs.existsSync(protoPath)) {
  console.log('[Patch] rustplus.proto no encontrado, saltando parche.');
  process.exit(0);
}

let content = fs.readFileSync(protoPath, 'utf-8');
const count = (content.match(/required/g) || []).length;

if (count > 0) {
  content = content.replace(/required/g, 'optional');
  fs.writeFileSync(protoPath, content);
  console.log(`[Patch] rustplus.proto parcheado: ${count} campos 'required' -> 'optional'`);
} else {
  console.log('[Patch] rustplus.proto ya esta parcheado (0 campos required).');
}
