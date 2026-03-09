const express = require('express');
const path = require('path');
const fs = require('fs');
const { register: registerFCM } = require('@liamcottle/push-receiver/src/android/fcm');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========================
// Config del developer (tu token de bot, etc)
// ========================
let botConfig = {};
const botConfigPath = path.join(__dirname, 'bot-config.json');

// Cargar config del developer si existe
if (fs.existsSync(botConfigPath)) {
  botConfig = JSON.parse(fs.readFileSync(botConfigPath, 'utf-8'));
}

// Estado global del setup del cliente
const state = {
  fcmCredentials: null,
  expoPushToken: null,
  rustplusAuthToken: null,
  pushClient: null,
  pairingData: null,
  ready: false,
};

// Constantes de Rust+ Companion App
const RUST_COMPANION = {
  apiKey: 'AIzaSyB5y2y-Tzqb4-I4Qnlsh_9naYv_TD8pCvY',
  projectId: 'rust-companion-app',
  gcmSenderId: '976529667804',
  gmsAppId: '1:976529667804:android:d6f1ddeb4403b338fea619',
  androidPackageName: 'com.facepunch.rust.companion',
  androidPackageCert: 'E28D05345FB78A7A1A63D70F4A302DBF426CA5AD',
  expoProjectId: '49451aca-a822-41e6-ad59-955718d0ff9c',
};

// ========================
// Al iniciar: registrar FCM automaticamente
// ========================
async function initFCM() {
  try {
    console.log('[Setup] Registrando con FCM...');
    state.fcmCredentials = await registerFCM({
      apiKey: RUST_COMPANION.apiKey,
      projectId: RUST_COMPANION.projectId,
      gcmSenderId: RUST_COMPANION.gcmSenderId,
      gmsAppId: RUST_COMPANION.gmsAppId,
      androidPackageName: RUST_COMPANION.androidPackageName,
      androidPackageCert: RUST_COMPANION.androidPackageCert,
    });
    console.log('[Setup] FCM registrado OK');

    const expoPushTokenResponse = await fetch(
      'https://exp.host/--/api/v2/push/getExpoPushToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fcm',
          deviceId: state.fcmCredentials.fcm.token,
          development: false,
          experienceId: '@anthropic/rust-companion',
          appId: 'com.facepunch.rust.companion',
          deviceToken: state.fcmCredentials.fcm.token,
          projectId: RUST_COMPANION.expoProjectId,
        }),
      }
    );
    const expoPushTokenData = await expoPushTokenResponse.json();
    state.expoPushToken = expoPushTokenData.data.expoPushToken;
    state.ready = true;
    console.log('[Setup] Listo para recibir clientes');
  } catch (err) {
    console.error('[Setup] Error en FCM:', err);
  }
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
    steamLinked: !!state.rustplusAuthToken,
    paired: !!state.pairingData,
    pairingData: state.pairingData,
  });
});

// Callback de Rust+ login
app.get('/api/rust-callback', async (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.redirect('/?error=no_token');
  }

  state.rustplusAuthToken = token;
  console.log('[Setup] Rust+ Auth Token recibido');

  // Registrar push con Rust Companion API
  try {
    if (state.expoPushToken) {
      const deviceId = 'rustbot-' + Date.now();
      await fetch('https://companion-rust.facepunch.com:443/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          AuthToken: token,
          DeviceId: deviceId,
          PushKind: 3,
          PushToken: state.expoPushToken,
        }),
      });
      console.log('[Setup] Registrado con Rust Companion API');
    }
  } catch (err) {
    console.error('[Setup] Error registrando push:', err);
  }

  // Iniciar escucha de pairing
  try {
    if (state.fcmCredentials) {
      if (state.pushClient) state.pushClient.destroy();

      state.pushClient = new PushReceiverClient(
        state.fcmCredentials,
        state.fcmCredentials.fcm.persistentIds || []
      );

      state.pushClient.on('ON_NOTIFICATION_RECEIVED', (notification) => {
        try {
          if (notification.data && notification.data.body) {
            const body = JSON.parse(notification.data.body);
            if (body.ip && body.port && body.playerId && body.playerToken) {
              state.pairingData = {
                serverIp: body.ip,
                serverPort: body.port.toString(),
                playerId: body.playerId.toString(),
                playerToken: body.playerToken.toString(),
                serverName: body.name || 'Unknown Server',
              };
              console.log('[Setup] Pairing recibido:', state.pairingData.serverName);
            }
          }
        } catch (e) {
          console.error('[Setup] Error parseando notificacion:', e);
        }
      });

      await state.pushClient.connect();
      console.log('[Setup] Escuchando pairing...');
    }
  } catch (err) {
    console.error('[Setup] Error iniciando escucha:', err);
  }

  res.redirect('/?rust=ok');
});

// Guardar config final del cliente
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

  await initFCM();
});
