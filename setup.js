const express = require('express');
const path = require('path');
const fs = require('fs');
const AndroidFCM = require('@liamcottle/push-receiver/src/android/fcm');
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
    state.fcmCredentials = await AndroidFCM.register(
      RUST_COMPANION.apiKey,
      RUST_COMPANION.projectId,
      RUST_COMPANION.gcmSenderId,
      RUST_COMPANION.gmsAppId,
      RUST_COMPANION.androidPackageName,
      RUST_COMPANION.androidPackageCert,
    );
    console.log('[Setup] FCM registrado OK');
    console.log('[Setup] GCM androidId:', state.fcmCredentials.gcm.androidId ? 'OK' : 'FALTA');
    console.log('[Setup] FCM token:', state.fcmCredentials.fcm.token ? 'OK' : 'FALTA');

    // Intentar obtener Expo push token (opcional, funciona sin esto)
    try {
      const expoPushTokenResponse = await fetch(
        'https://exp.host/--/api/v2/push/getExpoPushToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'fcm',
            deviceId: state.fcmCredentials.fcm.token,
            development: false,
            experienceId: '@nicatronTg/rust-companion-app',
            appId: 'com.facepunch.rust.companion',
            deviceToken: state.fcmCredentials.fcm.token,
            projectId: RUST_COMPANION.expoProjectId,
          }),
        }
      );
      const expoPushTokenData = await expoPushTokenResponse.json();
      if (expoPushTokenData.data && expoPushTokenData.data.expoPushToken) {
        state.expoPushToken = expoPushTokenData.data.expoPushToken;
        console.log('[Setup] ExpoPushToken:', state.expoPushToken);
      } else {
        console.log('[Setup] Expo token no disponible, usando FCM directo (esto es OK)');
      }
    } catch (expoErr) {
      console.log('[Setup] Expo token fallo, usando FCM directo (esto es OK)');
    }
    state.ready = true;
    console.log('[Setup] FCM listo. Esperando clientes...');
  } catch (err) {
    console.error('[Setup] Error en FCM:', err.message);
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

  // Registrar push con Rust Companion API usando FCM directo
  try {
    if (state.fcmCredentials && state.fcmCredentials.fcm.token) {
      const deviceId = 'rustbot-' + Date.now();
      const fcmToken = state.fcmCredentials.fcm.token;
      console.log('[Setup] Registrando push con Facepunch (FCM directo)...');
      console.log('[Setup] FCM Token (primeros 20):', fcmToken.substring(0, 20) + '...');

      // Intentar con ExpoPushToken si existe, sino FCM directo
      const pushToken = state.expoPushToken || fcmToken;
      const pushKind = state.expoPushToken ? 3 : 0;
      console.log('[Setup] PushKind:', pushKind, '| Token type:', state.expoPushToken ? 'Expo' : 'FCM');

      const pushRes = await fetch('https://companion-rust.facepunch.com:443/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          AuthToken: token,
          DeviceId: deviceId,
          PushKind: pushKind,
          PushToken: pushToken,
        }),
      });
      const pushResText = await pushRes.text();
      console.log('[Setup] Respuesta de Facepunch:', pushRes.status, pushResText);
    } else {
      console.error('[Setup] No hay FCM credentials! Reinicia el setup.');
    }
  } catch (err) {
    console.error('[Setup] Error registrando push:', err.message);
  }

  // Iniciar escucha de pairing
  try {
    if (state.fcmCredentials) {
      if (state.pushClient) state.pushClient.destroy();

      // Client necesita: androidId, securityToken, persistentIds
      await PushReceiverClient.init();
      state.pushClient = new PushReceiverClient(
        state.fcmCredentials.gcm.androidId,
        state.fcmCredentials.gcm.securityToken,
        []
      );

      // Funcion para procesar datos de pairing
      function processPairingData(data) {
        try {
          let body = null;

          if (typeof data === 'string') {
            body = JSON.parse(data);
          } else if (data && data.body) {
            body = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
          } else if (data && data.ip) {
            body = data;
          }

          if (body) {
            console.log('[Setup] Body parseado:', JSON.stringify(body).substring(0, 300));
            if (body.ip && body.port && body.playerId && body.playerToken) {
              state.pairingData = {
                serverIp: body.ip,
                serverPort: body.port.toString(),
                playerId: body.playerId.toString(),
                playerToken: body.playerToken.toString(),
                serverName: body.name || body.desc || 'Unknown Server',
              };
              console.log('[Setup] PAIRING EXITOSO:', state.pairingData.serverName);
              console.log('[Setup] IP:', state.pairingData.serverIp, 'Puerto:', state.pairingData.serverPort);
            }
          }
        } catch (e) {
          console.error('[Setup] Error parseando:', e.message);
        }
      }

      // Notificaciones encriptadas (push notifications)
      state.pushClient.on('ON_NOTIFICATION_RECEIVED', ({ notification, persistentId }) => {
        console.log('[Setup] Notificacion recibida:', JSON.stringify(notification).substring(0, 300));
        if (notification && notification.data) {
          processPairingData(notification.data);
        }
      });

      // Mensajes de datos no encriptados
      state.pushClient.on('ON_DATA_RECEIVED', (data) => {
        console.log('[Setup] Data recibida:', JSON.stringify(data).substring(0, 300));
        // Buscar en appData
        if (data && data.appData) {
          const appDataObj = {};
          for (const item of data.appData) {
            appDataObj[item.key] = item.value;
          }
          console.log('[Setup] AppData:', JSON.stringify(appDataObj).substring(0, 300));
          processPairingData(appDataObj);
        }
      });

      await state.pushClient.connect();
      console.log('[Setup] Push client conectado, escuchando pairing...');
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
