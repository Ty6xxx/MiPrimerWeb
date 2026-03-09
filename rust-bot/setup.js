const express = require('express');
const path = require('path');
const fs = require('fs');
const { register: registerFCM } = require('@liamcottle/push-receiver/src/android/fcm');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Estado global
const state = {
  fcmCredentials: null,
  expoPushToken: null,
  rustplusAuthToken: null,
  pushClient: null,
  pairingData: null,
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
// API Endpoints
// ========================

// Paso automatico: Registrar FCM + obtener Expo token (se llama automaticamente)
app.post('/api/fcm-register', async (req, res) => {
  try {
    console.log('[Setup] Registrando con FCM...');

    const fcmCredentials = await registerFCM({
      apiKey: RUST_COMPANION.apiKey,
      projectId: RUST_COMPANION.projectId,
      gcmSenderId: RUST_COMPANION.gcmSenderId,
      gmsAppId: RUST_COMPANION.gmsAppId,
      androidPackageName: RUST_COMPANION.androidPackageName,
      androidPackageCert: RUST_COMPANION.androidPackageCert,
    });

    state.fcmCredentials = fcmCredentials;
    console.log('[Setup] FCM registrado');

    const expoPushTokenResponse = await fetch(
      'https://exp.host/--/api/v2/push/getExpoPushToken',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fcm',
          deviceId: fcmCredentials.fcm.token,
          development: false,
          experienceId: '@anthropic/rust-companion',
          appId: 'com.facepunch.rust.companion',
          deviceToken: fcmCredentials.fcm.token,
          projectId: RUST_COMPANION.expoProjectId,
        }),
      }
    );

    const expoPushTokenData = await expoPushTokenResponse.json();
    state.expoPushToken = expoPushTokenData.data.expoPushToken;
    console.log('[Setup] Expo Push Token obtenido');

    res.json({ success: true });
  } catch (err) {
    console.error('[Setup] Error en FCM:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// URL de login de Steam
app.get('/api/steam-auth-url', (req, res) => {
  const steamAuthUrl =
    'https://companion-rust.facepunch.com/login?returnUrl=' +
    encodeURIComponent(`http://localhost:3000/api/steam-callback`);
  res.json({ url: steamAuthUrl });
});

// Callback de Steam - recibe token y automaticamente registra + escucha pairing
app.get('/api/steam-callback', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send('No se recibio token de Steam.');
  }

  state.rustplusAuthToken = token;
  console.log('[Setup] Steam Auth Token recibido');

  // Auto-registrar con Rust Companion API
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
    console.error('[Setup] Error registrando con Rust API:', err);
  }

  // Auto-iniciar escucha de pairing
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

  res.send(`
    <!DOCTYPE html>
    <html><body style="background:#1a1a2e;color:#0f0;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <h1>Steam Vinculado!</h1>
        <p>Puedes cerrar esta ventana.</p>
        <script>
          if(window.opener) { window.opener.postMessage({type:'steam-auth-success'},'*'); }
          setTimeout(()=>window.close(), 2000);
        </script>
      </div>
    </body></html>
  `);
});

// Polling de pairing
app.get('/api/pairing-status', (req, res) => {
  if (state.pairingData) {
    res.json({ success: true, data: state.pairingData });
  } else {
    res.json({ success: false });
  }
});

// Guardar configuracion
app.post('/api/save-config', (req, res) => {
  try {
    const { discordToken, discordClientId, discordChannelId, rust } = req.body;
    const rustData = state.pairingData || rust || {};

    const envContent = [
      '# Discord Bot Configuration',
      `DISCORD_TOKEN=${discordToken || ''}`,
      `DISCORD_CLIENT_ID=${discordClientId || ''}`,
      `DISCORD_CHANNEL_ID=${discordChannelId || ''}`,
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
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Rust+ Bot Setup Wizard`);
  console.log(`  Abre tu navegador en:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
