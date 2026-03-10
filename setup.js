const express = require('express');
const path = require('path');
const fs = require('fs');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// Config del developer (tu token de bot, etc)
// ========================
let botConfig = {};
const botConfigPath = path.join(__dirname, 'bot-config.json');
const rustplusConfigPath = path.join(__dirname, 'rustplus.config.json');

// Cargar config del developer si existe
if (fs.existsSync(botConfigPath)) {
  botConfig = JSON.parse(fs.readFileSync(botConfigPath, 'utf-8'));
}

// Estado global del setup
const state = {
  fcmCredentials: null,
  pushClient: null,
  pairingData: null,
  ready: false,
};

// ========================
// Cargar credenciales FCM de rustplus.config.json
// (generado por: npx @liamcottle/rustplus.js fcm-register)
// ========================
function loadFcmCredentials() {
  if (!fs.existsSync(rustplusConfigPath)) {
    console.log('[Setup] ERROR: rustplus.config.json no encontrado!');
    console.log('[Setup] Ejecuta primero: npx @liamcottle/rustplus.js fcm-register');
    console.log('[Setup] Luego coloca el archivo rustplus.config.json en la carpeta del bot.');
    return false;
  }

  const rustPlusConfig = JSON.parse(fs.readFileSync(rustplusConfigPath, 'utf-8'));

  if (!rustPlusConfig.fcm_credentials) {
    console.log('[Setup] ERROR: fcm_credentials no encontrado en rustplus.config.json');
    console.log('[Setup] Ejecuta: npx @liamcottle/rustplus.js fcm-register');
    return false;
  }

  const creds = rustPlusConfig.fcm_credentials;

  // Soportar ambos formatos: snake_case (android_id) y camelCase (androidId)
  const androidId = creds.gcm.android_id || creds.gcm.androidId;
  const securityToken = creds.gcm.security_token || creds.gcm.securityToken;

  if (!androidId || !securityToken) {
    console.log('[Setup] ERROR: android_id o security_token no encontrados en fcm_credentials');
    console.log('[Setup] Contenido de gcm:', JSON.stringify(creds.gcm).substring(0, 200));
    return false;
  }

  // Normalizar al formato que espera PushReceiverClient
  state.fcmCredentials = {
    androidId: androidId.toString(),
    securityToken: securityToken.toString(),
  };

  console.log('[Setup] FCM credentials cargadas OK');
  console.log('[Setup] androidId:', state.fcmCredentials.androidId ? 'OK' : 'FALTA');
  console.log('[Setup] securityToken:', state.fcmCredentials.securityToken ? 'OK' : 'FALTA');
  state.ready = true;
  return true;
}

// ========================
// Iniciar escucha FCM (mismo patron que rustplusplus)
// ========================
async function startFcmListener() {
  if (!state.fcmCredentials) return;
  if (state.pushClient) state.pushClient.destroy();

  const androidId = state.fcmCredentials.androidId;
  const securityToken = state.fcmCredentials.securityToken;

  state.pushClient = new PushReceiverClient(androidId, securityToken, []);

  state.pushClient.on('ON_DATA_RECEIVED', (data) => {
    console.log('[Setup] FCM data recibida!');

    const appData = data.appData;
    if (!appData) {
      console.log('[Setup] No appData, ignorando');
      return;
    }

    const channelId = appData.find(item => item.key === 'channelId')?.value;
    const title = appData.find(item => item.key === 'title')?.value;
    const bodyCheck = appData.find(item => item.key === 'body');

    console.log('[Setup] channelId:', channelId, '| title:', title);

    if (!channelId) {
      console.log('[Setup] No channelId, ignorando');
      return;
    }

    if (!bodyCheck) {
      console.log('[Setup] No body en appData, ignorando');
      return;
    }

    const body = JSON.parse(bodyCheck.value);
    console.log('[Setup] Body:', JSON.stringify(body).substring(0, 300));

    if (channelId === 'pairing' && body.ip && body.port && body.playerId && body.playerToken) {
      state.pairingData = {
        serverIp: body.ip,
        serverPort: body.port.toString(),
        playerId: body.playerId.toString(),
        playerToken: body.playerToken.toString(),
        serverName: title || body.name || body.desc || 'Unknown Server',
      };
      console.log('[Setup] PAIRING EXITOSO:', state.pairingData.serverName);
      console.log('[Setup] IP:', state.pairingData.serverIp, 'Puerto:', state.pairingData.serverPort);
      console.log('[Setup] PlayerID:', state.pairingData.playerId);

      // Auto-guardar .env y arrancar el bot
      autoSaveAndStart();
    }
  });

  await state.pushClient.connect();
  console.log('[Setup] Push client conectado, escuchando pairing...');
  console.log('[Setup] Entra al servidor de Rust y presiona "PAIR WITH SERVER" en Rust+');
}

// ========================
// API - Developer (para que vos configures el bot)
// ========================
app.post('/api/admin/save-bot', (req, res) => {
  const { discordToken, discordClientId } = req.body;
  botConfig = { discordToken, discordClientId };
  fs.writeFileSync(botConfigPath, JSON.stringify(botConfig, null, 2));
  console.log('[Admin] Bot config guardada');
  res.json({ success: true });
});

app.get('/api/admin/bot-config', (req, res) => {
  res.json({
    configured: !!(botConfig.discordToken && botConfig.discordClientId),
    clientId: botConfig.discordClientId || null,
  });
});

// ========================
// API - Cliente
// ========================

// Info para el cliente (invite link, estado)
app.get('/api/bot-info', (req, res) => {
  const clientId = botConfig.discordClientId;
  const inviteUrl = clientId
    ? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2147483648&scope=bot%20applications.commands`
    : null;

  res.json({
    inviteUrl,
    botConfigured: !!(botConfig.discordToken && botConfig.discordClientId),
  });
});

// Estado del setup
app.get('/api/status', (req, res) => {
  res.json({
    fcmReady: state.ready,
    steamLinked: true, // Ya no necesitamos Steam login separado
    paired: !!state.pairingData,
    pairingData: state.pairingData,
  });
});

// Auto-guardar .env despues de pairing exitoso y arrancar el bot
function autoSaveAndStart() {
  const rustData = state.pairingData;
  if (!rustData) return;

  // Leer .env existente o crear nuevo
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Actualizar o agregar las variables de Rust+
  const rustVars = {
    RUST_SERVER_IP: rustData.serverIp,
    RUST_SERVER_PORT: rustData.serverPort,
    RUST_PLAYER_ID: rustData.playerId,
    RUST_PLAYER_TOKEN: rustData.playerToken,
  };

  for (const [key, value] of Object.entries(rustVars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('[Setup] Datos guardados en .env');

  // Destruir push client
  if (state.pushClient) {
    state.pushClient.destroy();
    state.pushClient = null;
  }

  // Recargar env y arrancar el bot
  console.log('[Setup] Arrancando el bot...\n');
  require('dotenv').config({ override: true });

  // Importar startBot del index (lazy require para evitar circular)
  const { spawn } = require('child_process');
  const child = spawn(process.argv[0], [path.join(__dirname, 'index.js')], {
    stdio: 'inherit',
    env: { ...process.env, ...rustVars },
  });
  child.on('exit', (code) => process.exit(code));
}

// Guardar config final del cliente (desde la web)
app.post('/api/save-config', (req, res) => {
  try {
    const rustData = state.pairingData || {};

    const envContent = [
      '# Discord Bot Configuration (developer)',
      `DISCORD_TOKEN=${botConfig.discordToken || ''}`,
      `DISCORD_CLIENT_ID=${botConfig.discordClientId || ''}`,
      '',
      '# Rust+ Server Configuration',
      `RUST_SERVER_IP=${rustData.serverIp || ''}`,
      `RUST_SERVER_PORT=${rustData.serverPort || ''}`,
      `RUST_PLAYER_ID=${rustData.playerId || ''}`,
      `RUST_PLAYER_TOKEN=${rustData.playerToken || ''}`,
    ].join('\n');

    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    console.log('[Setup] Configuracion guardada en .env');

    if (state.pushClient) {
      state.pushClient.destroy();
      state.pushClient = null;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Setup] Error guardando:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========================
// Iniciar servidor
// ========================
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`\n========================================`);
  console.log(`  Rust+ Bot Setup`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);

  if (!botConfig.discordToken) {
    console.log('[!] Bot no configurado. Abre /admin.html para configurar tu bot primero.');
  }

  // Paso 1: Cargar credenciales FCM
  const loaded = loadFcmCredentials();
  if (!loaded) {
    console.log('\n[!] Para generar rustplus.config.json ejecuta:');
    console.log('    npx @liamcottle/rustplus.js fcm-register');
    console.log('    Luego reinicia este setup.\n');
    return;
  }

  // Paso 2: Iniciar listener FCM para pairing
  await startFcmListener();
});
