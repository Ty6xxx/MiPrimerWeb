/**
 * Parche post-install para @liamcottle/rustplus.js
 * Cambia los campos 'required' a 'optional' en SellOrder
 * para evitar el crash "missing required 'itemIsBlueprint'"
 */
const fs = require('fs');
const path = require('path');

const protoPath = path.join(__dirname, '..', 'node_modules', '@liamcottle', 'rustplus.js', 'rustplus.proto');

if (!fs.existsSync(protoPath)) {
  console.log('[Patch] rustplus.proto no encontrado, saltando parche.');
  process.exit(0);
}

let content = fs.readFileSync(protoPath, 'utf-8');

const original = `	message SellOrder {
		required int32 itemId = 1;
		required int32 quantity = 2;
		required int32 currencyId = 3;
		required int32 costPerItem = 4;
		required int32 amountInStock = 5;
		required bool itemIsBlueprint = 6;
		required bool currencyIsBlueprint = 7;`;

const patched = `	message SellOrder {
		optional int32 itemId = 1;
		optional int32 quantity = 2;
		optional int32 currencyId = 3;
		optional int32 costPerItem = 4;
		optional int32 amountInStock = 5;
		optional bool itemIsBlueprint = 6;
		optional bool currencyIsBlueprint = 7;`;

if (content.includes(original)) {
  content = content.replace(original, patched);
  fs.writeFileSync(protoPath, content);
  console.log('[Patch] rustplus.proto parcheado: SellOrder fields -> optional');
} else if (content.includes(patched)) {
  console.log('[Patch] rustplus.proto ya esta parcheado.');
} else {
  console.log('[Patch] No se pudo aplicar el parche (formato inesperado).');
}
