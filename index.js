const { Client, GatewayIntentBits } = require('discord.js');
const RustPlusClient = require('./src/rustplus-client');
const { registerCommands } = require('./src/commands/register-commands');
const { handleInteraction } = require('./src/commands/handle-commands');
const { handleTeamMessage } = require('./src/handlers/team-chat');
const { formatEventMessage } = require('./src/handlers/events');
const config = require('./src/config');

// --- Discord Client ---
const discord = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// --- Rust+ Client ---
const rustClient = new RustPlusClient();

// ========================
// Discord Events
// ========================
discord.once('ready', async () => {
  console.log(`[Discord] Bot conectado como ${discord.user.tag}`);

  // Registrar slash commands
  await registerCommands();

  // Conectar a Rust+ despues de Discord
  rustClient.connect();
});

discord.on('interactionCreate', (interaction) => {
  handleInteraction(interaction, rustClient);
});

// ========================
// Rust+ Events
// ========================
rustClient.on('ready', async () => {
  console.log('[Rust+] Conectado al servidor');
});

// Notificar eventos del juego en team chat
rustClient.on('gameEvent', (event) => {
  const message = formatEventMessage(event);
  rustClient.sendTeamMessage(`[BOT] ${message.replace(/\*\*/g, '')}`);
});

// Manejar mensajes del team chat
rustClient.on('teamMessage', async (msg) => {
  const response = await handleTeamMessage(rustClient, msg);
  if (response) {
    rustClient.sendTeamMessage(response);
  }
});

// ========================
// Iniciar Bot
// ========================
console.log('[Bot] Iniciando Rust+ Discord Bot...');
discord.login(config.discord.token);

// Manejo de errores globales
process.on('unhandledRejection', (err) => {
  console.error('[Bot] Error no manejado:', err);
});
