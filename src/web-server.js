/**
 * Servidor web de configuracion del bot.
 * - /admin        → admin ingresa Discord token + client ID
 * - /             → usuario hace login con Steam + pairing de Rust
 * Cuando el setup termina llama a onSetupComplete() para arrancar el bot.
 */
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const axios   = require('axios');
const { v4: uuidv4 } = require('uuid');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');
const AndroidFCM = require('@liamcottle/push-receiver/src/android/fcm');

const ENV_PATH    = path.join(__dirname, '..', '.env');
const CONFIG_PATH = path.join(__dirname, '..', 'rustplus.config.json');
const PUBLIC_DIR  = path.join(__dirname, '..', 'public');

// Estado en memoria del proceso de setup
let pendingPairingData = null;   // datos recibidos via FCM
let fcmClient          = null;   // cliente FCM activo
let rustAuthToken      = null;   // token Steam de Rust+ companion

// ========================
// Helpers
// ========================
function readEnv() {
  try {
    const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const [k, ...v] = line.split('=');
      if (k && k.trim()) env[k.trim()] = v.join('=').trim();
    }
    return env;
  } catch {
    return {};
  }
}

function writeEnvVars(vars) {
  let content = '';
  try { content = fs.readFileSync(ENV_PATH, 'utf-8'); } catch {}
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(ENV_PATH, content.trim() + '\n');
}

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

async function getExpoPushToken(fcmToken) {
  const res = await axios.post('https://exp.host/--/api/v2/push/getExpoPushToken', {
    type:        'fcm',
    deviceId:    uuidv4(),
    development: false,
    appId:       'com.facepunch.rust.companion',
    deviceToken: fcmToken,
    projectId:   '49451aca-a822-41e6-ad59-955718d0ff9c',
  });
  return res.data.data.expoPushToken;
}

async function registerWithRustPlus(authToken, expoPushToken) {
  return axios.post('https://companion-rust.facepunch.com:443/api/push/register', {
    AuthToken:  authToken,
    DeviceId:   'rustplus.js',
    PushKind:   3,
    PushToken:  expoPushToken,
  });
}

function startFcmListener(androidId, securityToken) {
  if (fcmClient) { try { fcmClient.destroy(); } catch {} }

  fcmClient = new PushReceiverClient(String(androidId), String(securityToken), []);

  fcmClient.on('ON_DATA_RECEIVED', (data) => {
    const appData = data.appData || data.rawData || data.data;
    if (!appData) return;

    let channelId, title, bodyRaw;
    if (Array.isArray(appData)) {
      channelId = appData.find(i => i.key === 'channelId')?.value;
      title     = appData.find(i => i.key === 'title')?.value;
      bodyRaw   = appData.find(i => i.key === 'body')?.value;
    } else {
      channelId = appData.channelId;
      title     = appData.title;
      bodyRaw   = appData.body;
    }

    if (channelId !== 'pairing' || !bodyRaw) return;

    let body;
    try { body = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw; } catch { return; }

    if (body.type !== 'server') return;
    if (!body.ip || !body.port || !body.playerId || body.playerToken === undefined) return;

    console.log(`[Web] Pairing recibido: ${title || body.name} (${body.ip}:${body.port})`);

    pendingPairingData = {
      serverName: title || body.name || 'Rust Server',
      serverIp:   String(body.ip),
      serverPort: String(body.port),
      playerId:   String(body.playerId),
      playerToken: String(body.playerToken),
    };
  });

  fcmClient.connect().catch(err => {
    console.log('[Web] FCM connect error:', err.message);
  });
}

// ========================
// Crear app Express
// ========================
function createWebServer(onSetupComplete) {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  // ---- Paginas ----
  app.get('/',      (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
  app.get('/admin', (_, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

  // ---- Admin: leer config actual ----
  app.get('/api/admin/bot-config', (_, res) => {
    const env = readEnv();
    res.json({
      clientId:   env.DISCORD_CLIENT_ID || '',
      configured: !!(env.DISCORD_TOKEN),
    });
  });

  // ---- Admin: guardar Discord token + client ID ----
  app.post('/api/admin/save-bot', (req, res) => {
    const { discordToken, discordClientId } = req.body;
    if (!discordToken || !discordClientId) {
      return res.status(400).json({ success: false, error: 'Faltan campos' });
    }
    writeEnvVars({ DISCORD_TOKEN: discordToken, DISCORD_CLIENT_ID: discordClientId });
    // Recargar en process.env
    process.env.DISCORD_TOKEN    = discordToken;
    process.env.DISCORD_CLIENT_ID = discordClientId;
    console.log('[Web] Discord credentials guardadas.');
    res.json({ success: true });
  });

  // ---- Bot info (para el invite link) ----
  app.get('/api/bot-info', (_, res) => {
    const env = readEnv();
    const clientId = env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
    const botConfigured = !!(env.DISCORD_TOKEN || process.env.DISCORD_TOKEN);
    const inviteUrl = clientId
      ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`
      : null;
    res.json({ inviteUrl, botConfigured });
  });

  // ---- Rust+ OAuth callback ----
  app.get('/api/rust-callback', async (req, res) => {
    const token = req.query.token;
    if (!token) {
      return res.redirect('/?error=no_token');
    }

    rustAuthToken = token;
    console.log('[Web] Steam auth token recibido.');

    try {
      // Necesitamos FCM credentials para registrarnos con Rust companion
      let config = readConfig();

      // Si no hay config FCM, registrar ahora
      if (!config.fcm_credentials) {
        console.log('[Web] Registrando FCM por primera vez...');
        const fcmCreds = await AndroidFCM.register(
          'AIzaSyB5y2y-Tzqb4-I4Qnlsh_9naYv_TD8pCvY',
          'rust-companion-app',
          '976529667804',
          '1:976529667804:android:d6f1ddeb4403b338fea619',
          'com.facepunch.rust.companion',
          'E28D05345FB78A7A1A63D70F4A302DBF426CA5AD'
        );
        config.fcm_credentials = fcmCreds;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log('[Web] FCM credentials guardadas en rustplus.config.json');
      }

      const { androidId, securityToken } = config.fcm_credentials.gcm;
      const fcmToken = config.fcm_credentials.fcm.token;

      // Obtener Expo push token
      console.log('[Web] Obteniendo Expo push token...');
      const expoPushToken = await getExpoPushToken(fcmToken);

      // Registrar con Rust companion API
      console.log('[Web] Registrando con Rust companion API...');
      await registerWithRustPlus(token, expoPushToken);
      console.log('[Web] Registrado! Esperando pairing en el juego...');

      // Iniciar listener FCM para recibir el pairing
      startFcmListener(androidId, securityToken);

      // Redirigir al usuario al setup con estado "esperando pairing"
      res.redirect('/?rust=ok');
    } catch (err) {
      console.error('[Web] Error en rust-callback:', err.message);
      res.redirect('/?error=registration_failed');
    }
  });

  // ---- Status (polling del frontend) ----
  app.get('/api/status', (_, res) => {
    if (pendingPairingData) {
      res.json({ paired: true, pairingData: pendingPairingData });
    } else {
      res.json({ paired: false });
    }
  });

  // ---- Guardar config y arrancar bot ----
  app.post('/api/save-config', async (req, res) => {
    if (!pendingPairingData) {
      return res.status(400).json({ success: false, error: 'No hay datos de pairing aun' });
    }

    writeEnvVars({
      RUST_SERVER_IP:    pendingPairingData.serverIp,
      RUST_SERVER_PORT:  pendingPairingData.serverPort,
      RUST_PLAYER_ID:    pendingPairingData.playerId,
      RUST_PLAYER_TOKEN: pendingPairingData.playerToken,
    });

    Object.assign(process.env, {
      RUST_SERVER_IP:    pendingPairingData.serverIp,
      RUST_SERVER_PORT:  pendingPairingData.serverPort,
      RUST_PLAYER_ID:    pendingPairingData.playerId,
      RUST_PLAYER_TOKEN: pendingPairingData.playerToken,
    });

    console.log('[Web] Config guardada. Arrancando bot...');

    // Destruir cliente FCM del setup
    if (fcmClient) { try { fcmClient.destroy(); } catch {} fcmClient = null; }

    res.json({ success: true });

    // Arrancar bot despues de responder
    setTimeout(() => onSetupComplete(), 500);
  });

  return app;
}

module.exports = { createWebServer };
