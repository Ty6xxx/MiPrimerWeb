const path = require('path');
const fs = require('fs');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

require('dotenv').config();

const rustplusConfigPath = path.join(__dirname, 'rustplus.config.json');

// ========================
// Verificar si el .env ya tiene datos validos de Rust+
// ========================
function hasValidRustConfig() {
  const { RUST_SERVER_IP, RUST_SERVER_PORT, RUST_PLAYER_ID, RUST_PLAYER_TOKEN } = process.env;
  if (!RUST_SERVER_IP || !RUST_SERVER_PORT || !RUST_PLAYER_ID || !RUST_PLAYER_TOKEN) return false;
  if (RUST_SERVER_IP.includes('tu_') || RUST_SERVER_PORT.includes('tu_')) return false;
  if (RUST_PLAYER_ID.includes('tu_') || RUST_PLAYER_TOKEN.includes('tu_')) return false;
  return true;
}

if (hasValidRustConfig()) {
  console.log('[Bot] Datos de Rust+ encontrados en .env\n');
  startBot();
} else {
  console.log('[Bot] Faltan datos de Rust+ en .env, iniciando pairing...\n');
  startPairing();
}

// ========================
// MODO PAIRING
// ========================
async function startPairing() {
  if (!fs.existsSync(rustplusConfigPath)) {
    console.log('============================================');
    console.log('  CONFIGURACION INICIAL');
    console.log('============================================');
    console.log('');
    console.log('1. Ejecuta: npx @liamcottle/rustplus.js fcm-register');
    console.log('2. Coloca rustplus.config.json en esta carpeta');
    console.log('3. Vuelve a ejecutar: npm start');
    console.log('============================================\n');
    return;
  }

  let rustPlusConfig;
  try {
    rustPlusConfig = JSON.parse(fs.readFileSync(rustplusConfigPath, 'utf-8'));
  } catch (err) {
    console.log('[Pairing] ERROR: rustplus.config.json corrupto o ilegible:', err.message);
    return;
  }

  if (!rustPlusConfig.fcm_credentials) {
    console.log('[Pairing] ERROR: fcm_credentials no encontrado en rustplus.config.json.');
    console.log('[Pairing] Regenera el archivo ejecutando: npx @liamcottle/rustplus.js fcm-register');
    return;
  }

  const creds = rustPlusConfig.fcm_credentials;
  if (!creds.gcm) {
    console.log('[Pairing] ERROR: gcm no encontrado en fcm_credentials.');
    console.log('[Pairing] Regenera el archivo ejecutando: npx @liamcottle/rustplus.js fcm-register');
    return;
  }

  // Soportar camelCase (androidId) y snake_case (android_id)
  const androidId = String(creds.gcm.androidId || creds.gcm.android_id || '');
  const securityToken = String(creds.gcm.securityToken || creds.gcm.security_token || '');

  if (!androidId || !securityToken || androidId === 'undefined' || securityToken === 'undefined') {
    console.log('[Pairing] ERROR: Credenciales FCM invalidas (androidId o securityToken vacios).');
    console.log('[Pairing] Contenido gcm:', JSON.stringify(creds.gcm));
    console.log('[Pairing] Regenera el archivo ejecutando: npx @liamcottle/rustplus.js fcm-register');
    return;
  }

  console.log('[Pairing] FCM credentials OK');
  console.log('[Pairing] androidId:', androidId.slice(0, 6) + '...');
  console.log('[Pairing] securityToken:', securityToken.slice(0, 4) + '...');

  createFcmListener(androidId, securityToken);
}

function createFcmListener(androidId, securityToken) {
  let pushClient;
  try {
    pushClient = new PushReceiverClient(androidId, securityToken, []);
  } catch (err) {
    console.log('[Pairing] ERROR creando PushReceiverClient:', err.message);
    return;
  }

  pushClient.on('connect', () => {
    console.log('[FCM] Conexion establecida con Google FCM.');
    console.log('');
    console.log('============================================');
    console.log('  MODO PAIRING ACTIVO');
    console.log('============================================');
    console.log('');
    console.log('Entra al servidor de Rust y presiona');
    console.log('"PAIR WITH SERVER" en el menu de Rust+');
    console.log('');
    console.log('El bot arrancara automaticamente.');
    console.log('============================================\n');
  });

  pushClient.on('disconnect', () => {
    console.log('[FCM] Desconectado. Reconectando automaticamente...');
  });

  pushClient.on('ON_DATA_RECEIVED', (data) => {
    handleFcmData(data, pushClient);
  });

  // Iniciar conexion sin await para que el event loop maneje los eventos
  pushClient.connect().catch((err) => {
    console.log('[Pairing] ERROR al conectar FCM:', err.message);
    console.log('[Pairing] Causas comunes:');
    console.log('  - No hay conexion a internet');
    console.log('  - Las credenciales FCM estan caducadas (regenera rustplus.config.json)');
    console.log('  - Firewall bloqueando puerto 5228');
    console.log('');
    console.log('[Pairing] Reintentando en 30 segundos...');
    setTimeout(() => createFcmListener(androidId, securityToken), 30000);
  });
}

function handleFcmData(data, pushClient) {
  // La data puede venir en diferentes formatos segun la version de push-receiver
  const appData = data.appData || data.rawData || data.data;

  if (!appData) {
    console.log('[FCM] Notificacion recibida sin appData.');
    console.log('[FCM] Data raw:', JSON.stringify(data).slice(0, 200));
    return;
  }

  // appData puede ser un array [{key, value}] o un objeto {key: value}
  let channelId, title, bodyRaw;

  if (Array.isArray(appData)) {
    channelId = appData.find(item => item.key === 'channelId')?.value;
    title     = appData.find(item => item.key === 'title')?.value;
    const bodyItem = appData.find(item => item.key === 'body');
    bodyRaw   = bodyItem?.value;
  } else {
    channelId = appData.channelId;
    title     = appData.title;
    bodyRaw   = appData.body;
  }

  if (!channelId) {
    console.log('[FCM] Notificacion recibida sin channelId (ignorada).');
    return;
  }

  console.log(`[FCM] Notificacion recibida: channelId="${channelId}", title="${title || ''}"`);

  if (channelId !== 'pairing') {
    // Mostrar otras notificaciones (alarmas, muertes, etc.) pero no procesarlas aqui
    console.log(`[FCM] Canal "${channelId}" ignorado en modo pairing.`);
    return;
  }

  if (!bodyRaw) {
    console.log('[FCM] Notificacion de pairing sin body (ignorada).');
    return;
  }

  let body;
  try {
    body = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw;
  } catch (err) {
    console.log('[FCM] ERROR parseando body:', err.message);
    console.log('[FCM] Body raw:', bodyRaw);
    return;
  }

  console.log('[Pairing] Tipo de pairing:', body.type);

  // Solo nos interesa el pairing de servidor
  if (body.type !== 'server') {
    console.log(`[Pairing] Tipo "${body.type}" ignorado (solo procesamos "server").`);
    return;
  }

  // Validar campos necesarios
  if (!body.ip || !body.port || !body.playerId || body.playerToken === undefined) {
    console.log('[Pairing] ERROR: Faltan campos en la notificacion de pairing:');
    console.log('[Pairing] ip:', body.ip);
    console.log('[Pairing] port:', body.port);
    console.log('[Pairing] playerId:', body.playerId);
    console.log('[Pairing] playerToken:', body.playerToken !== undefined ? '[OK]' : '[MISSING]');
    return;
  }

  const serverName = title || body.name || 'Desconocido';
  const ip = String(body.ip);
  const port = String(body.port);
  const playerId = String(body.playerId);
  const playerToken = String(body.playerToken);

  console.log('');
  console.log('============================================');
  console.log('  PAIRING EXITOSO!');
  console.log('============================================');
  console.log(`  Servidor: ${serverName}`);
  console.log(`  IP:       ${ip}`);
  console.log(`  Puerto:   ${port}`);
  console.log(`  PlayerID: ${playerId}`);
  console.log(`  Token:    ${playerToken.slice(0, 6)}...`);
  console.log('============================================');
  console.log('');

  // Guardar en .env
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  const rustVars = {
    RUST_SERVER_IP:    ip,
    RUST_SERVER_PORT:  port,
    RUST_PLAYER_ID:    playerId,
    RUST_PLAYER_TOKEN: playerToken,
  };

  for (const [key, value] of Object.entries(rustVars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  try {
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('[Pairing] Datos guardados en .env');
  } catch (err) {
    console.log('[Pairing] ERROR guardando .env:', err.message);
    return;
  }

  // Destruir listener FCM y arrancar bot
  try {
    pushClient.destroy();
  } catch (_) {}

  // Setear en process.env para que config.js los lea sin releer el .env
  Object.assign(process.env, rustVars);

  console.log('[Pairing] Iniciando bot...');
  console.log('');
  startBot();
}

// ========================
// BOT PRINCIPAL
// ========================
function startBot() {
  const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
  const RustPlusClient = require('./src/rustplus-client');
  const { registerCommands } = require('./src/commands/register-commands');
  const { handleInteraction, setBotState: setHandlerState } = require('./src/commands/handle-commands');
  const { handleTeamMessage, setBotState: setChatState } = require('./src/handlers/team-chat');
  const { formatEventMessage, formatEventEndMessage, formatTeamChangeEmbed } = require('./src/handlers/events');
  const { BotState } = require('./src/handlers/state');
  const config = require('./src/config');

  if (!config.discord.token) {
    console.log('[Bot] ERROR: DISCORD_TOKEN no configurado en .env');
    return;
  }

  console.log('[Bot] Iniciando Rust+ Discord Bot...');
  console.log(`[Bot] Servidor: ${config.rust.serverIp}:${config.rust.serverPort}`);

  const botState = new BotState();

  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const rustClient = new RustPlusClient();

  let notificationChannel = null;
  let teamMonitorTimer = null;

  setHandlerState(botState);
  setChatState(botState);
  botState.setSendMessage((msg) => {
    if (!botState.isSilenced()) {
      rustClient.sendGameMessage(msg);
    }
  });

  // ========================
  // Discord Events
  // ========================
  discord.once('clientReady', async () => {
    console.log(`[Discord] Bot conectado como ${discord.user.tag}`);

    const guild = discord.guilds.cache.first();
    if (guild) {
      notificationChannel =
        guild.channels.cache.find(c => c.name === 'rust-bot' && c.type === ChannelType.GuildText) ||
        guild.channels.cache.find(c => c.name === 'rust'     && c.type === ChannelType.GuildText) ||
        guild.channels.cache.find(c => c.type === ChannelType.GuildText);

      if (notificationChannel) {
        console.log(`[Discord] Canal de notificaciones: #${notificationChannel.name}`);
      }
    }

    await registerCommands();
    rustClient.connect();
  });

  discord.on('interactionCreate', (interaction) => {
    handleInteraction(interaction, rustClient);
  });

  // ========================
  // Rust+ Events
  // ========================
  rustClient.on('ready', () => {
    console.log('');
    console.log('============================================');
    console.log('  BOT CONECTADO Y FUNCIONANDO!');
    console.log('============================================');
    console.log(`  Servidor: ${config.rust.serverIp}:${config.rust.serverPort}`);
    console.log('  Comandos ! activos en el team chat');
    console.log('  Escribe !help en Rust para ver comandos');
    console.log('============================================');
    console.log('');

    if (teamMonitorTimer) clearInterval(teamMonitorTimer);
    teamMonitorTimer = setInterval(async () => {
      try {
        const teamInfo = await rustClient.getTeamInfo();
        const changes = botState.updateTeamState(teamInfo.members);

        if (botState.isSilenced()) return;

        const chatMessages = [];
        for (const name of changes.connected)    chatMessages.push(`[BOT] ${name} se conecto.`);
        for (const name of changes.disconnected) chatMessages.push(`[BOT] ${name} se desconecto.`);
        for (const d of changes.died)            chatMessages.push(`[BOT] ${d.name} murio en (${Math.round(d.x)}, ${Math.round(d.y)}) | Muertes: ${d.deathCount}`);
        for (const name of changes.afkStart)     chatMessages.push(`[BOT] ${name} esta AFK.`);
        for (const name of changes.afkEnd)       chatMessages.push(`[BOT] ${name} volvio de AFK.`);

        for (let i = 0; i < chatMessages.length; i++) {
          setTimeout(() => rustClient.sendGameMessage(chatMessages[i]), i * 1800);
        }

        if (notificationChannel) {
          const embeds = formatTeamChangeEmbed(changes);
          for (const embed of embeds) {
            notificationChannel.send({ embeds: [embed] });
          }
        }
      } catch (_) {}
    }, 15000);
  });

  rustClient.on('gameEvent', (event) => {
    if (botState.isSilenced()) return;
    const message = formatEventMessage(event);
    rustClient.sendGameMessage(`[BOT] ${message}`);
    if (notificationChannel) notificationChannel.send(message);
  });

  rustClient.on('gameEventEnd', (event) => {
    if (botState.isSilenced()) return;
    const message = formatEventEndMessage(event);
    rustClient.sendGameMessage(`[BOT] ${message}`);
    if (notificationChannel) notificationChannel.send(message);
  });

  rustClient.on('teamMessage', async (msg) => {
    // Ignorar mensajes propios del bot
    if (msg.steamId === config.rust.playerId) return;
    const response = await handleTeamMessage(rustClient, msg);
    if (response) rustClient.sendGameMessage(response);
  });

  discord.login(config.discord.token).catch((err) => {
    console.error('[Bot] ERROR al conectar Discord:', err.message);
    console.log('[Bot] Verifica que DISCORD_TOKEN sea correcto en .env');
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    console.error('[Bot] Error no manejado:', err.message || err);
  });

  process.on('SIGINT', () => {
    console.log('\n[Bot] Apagando...');
    if (teamMonitorTimer) clearInterval(teamMonitorTimer);
    rustClient.stopEventPolling();
    discord.destroy();
    process.exit(0);
  });
}
