const express = require('express');
const path = require('path');
const fs = require('fs');
const { register: registerFCM } = require('@liamcottle/push-receiver/src/android/fcm');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Estado global del proceso de registro
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

// Paso 1: Registrar con FCM (Firebase Cloud Messaging)
app.post('/api/fcm-register', async (req, res) => {
  try {
    console.log('[Setup] Registrando con FCM...');

    // Registrar con Firebase/GCM
    const fcmCredentials = await registerFCM({
      apiKey: RUST_COMPANION.apiKey,
      projectId: RUST_COMPANION.projectId,
      gcmSenderId: RUST_COMPANION.gcmSenderId,
      gmsAppId: RUST_COMPANION.gmsAppId,
      androidPackageName: RUST_COMPANION.androidPackageName,
      androidPackageCert: RUST_COMPANION.androidPackageCert,
    });

    state.fcmCredentials = fcmCredentials;
    console.log('[Setup] FCM registrado exitosamente');

    // Obtener Expo Push Token
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
    console.log('[Setup] Expo Push Token:', state.expoPushToken);

    res.json({
      success: true,
      message: 'FCM registrado. Ahora necesitas iniciar sesion con Steam.',
    });
  } catch (err) {
    console.error('[Setup] Error en FCM:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 2: Obtener URL de login de Steam
app.get('/api/steam-auth-url', (req, res) => {
  // La URL de autenticacion de Rust+ Companion
  const steamAuthUrl =
    'https://companion-rust.facepunch.com/login?returnUrl=' +
    encodeURIComponent(`http://localhost:3000/api/steam-callback`);

  res.json({ url: steamAuthUrl });
});

// Callback de Steam
app.get('/api/steam-callback', (req, res) => {
  const token = req.query.token;

  if (token) {
    state.rustplusAuthToken = token;
    console.log('[Setup] Steam Auth Token recibido');

    // Mostrar pagina de exito que cierra la ventana
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
  } else {
    res.status(400).send('No se recibio token de Steam.');
  }
});

// Paso 3: Registrar con Rust Companion API
app.post('/api/rust-register', async (req, res) => {
  try {
    if (!state.expoPushToken || !state.rustplusAuthToken) {
      return res.status(400).json({
        success: false,
        error: 'Primero completa FCM y Steam.',
      });
    }

    console.log('[Setup] Registrando con Rust Companion API...');

    const deviceId = 'rustbot-' + Date.now();

    const response = await fetch(
      'https://companion-rust.facepunch.com:443/api/push/register',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.rustplusAuthToken}`,
        },
        body: JSON.stringify({
          AuthToken: state.rustplusAuthToken,
          DeviceId: deviceId,
          PushKind: 3, // Expo
          PushToken: state.expoPushToken,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Rust API respondio con ${response.status}`);
    }

    console.log('[Setup] Registrado con Rust Companion API');

    res.json({
      success: true,
      message:
        'Registrado! Ahora ve al juego Rust y haz "Pair with Server" en el menu Rust+.',
    });
  } catch (err) {
    console.error('[Setup] Error registrando:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Paso 4: Escuchar notificaciones de pairing
app.post('/api/start-listening', async (req, res) => {
  try {
    if (!state.fcmCredentials) {
      return res
        .status(400)
        .json({ success: false, error: 'Primero registra con FCM.' });
    }

    if (state.pushClient) {
      state.pushClient.destroy();
    }

    console.log('[Setup] Escuchando notificaciones de pairing...');

    state.pushClient = new PushReceiverClient(
      state.fcmCredentials,
      state.fcmCredentials.fcm.persistentIds || []
    );

    state.pushClient.on('ON_NOTIFICATION_RECEIVED', (notification) => {
      console.log('[Setup] Notificacion recibida!');

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
              serverDesc: body.desc || '',
            };
            console.log('[Setup] Datos de pairing recibidos:', {
              server: state.pairingData.serverName,
              ip: state.pairingData.serverIp,
              port: state.pairingData.serverPort,
            });
          }
        }
      } catch (parseErr) {
        console.error('[Setup] Error parseando notificacion:', parseErr);
      }
    });

    await state.pushClient.connect();
    console.log('[Setup] Conectado a FCM, esperando pairing...');

    res.json({
      success: true,
      message:
        'Escuchando... Ve al juego Rust y haz click en "Pair with Server".',
    });
  } catch (err) {
    console.error('[Setup] Error escuchando:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Polling para verificar si se recibio pairing
app.get('/api/pairing-status', (req, res) => {
  if (state.pairingData) {
    res.json({ success: true, data: state.pairingData });
  } else {
    res.json({ success: false, message: 'Esperando pairing...' });
  }
});

// Paso final: Guardar configuracion en .env
app.post('/api/save-config', (req, res) => {
  try {
    const { discordToken, discordClientId, discordChannelId } = req.body;
    const rust = state.pairingData || req.body.rust || {};

    const envContent = [
      '# Discord Bot Configuration',
      `DISCORD_TOKEN=${discordToken || ''}`,
      `DISCORD_CLIENT_ID=${discordClientId || ''}`,
      `DISCORD_CHANNEL_ID=${discordChannelId || ''}`,
      '',
      '# Rust+ Server Configuration',
      `RUST_SERVER_IP=${rust.serverIp || ''}`,
      `RUST_SERVER_PORT=${rust.serverPort || ''}`,
      `RUST_PLAYER_ID=${rust.playerId || ''}`,
      `RUST_PLAYER_TOKEN=${rust.playerToken || ''}`,
    ].join('\n');

    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    console.log('[Setup] Configuracion guardada en .env');

    // Limpiar estado
    if (state.pushClient) {
      state.pushClient.destroy();
      state.pushClient = null;
    }

    res.json({
      success: true,
      message: 'Configuracion guardada! Ya puedes iniciar el bot con: npm start',
    });
  } catch (err) {
    console.error('[Setup] Error guardando:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset
app.post('/api/reset', (req, res) => {
  state.fcmCredentials = null;
  state.expoPushToken = null;
  state.rustplusAuthToken = null;
  state.pairingData = null;
  if (state.pushClient) {
    state.pushClient.destroy();
    state.pushClient = null;
  }
  res.json({ success: true });
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
