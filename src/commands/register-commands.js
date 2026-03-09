const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../config');

const commands = [
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Muestra info del servidor de Rust'),

  new SlashCommandBuilder()
    .setName('time')
    .setDescription('Muestra la hora actual del servidor'),

  new SlashCommandBuilder()
    .setName('team')
    .setDescription('Muestra info del equipo'),

  new SlashCommandBuilder()
    .setName('pop')
    .setDescription('Muestra jugadores online'),

  new SlashCommandBuilder()
    .setName('switch')
    .setDescription('Controla un Smart Switch')
    .addStringOption((opt) =>
      opt
        .setName('action')
        .setDescription('Accion a realizar')
        .setRequired(true)
        .addChoices(
          { name: 'Encender', value: 'on' },
          { name: 'Apagar', value: 'off' },
          { name: 'Estado', value: 'status' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('device')
        .setDescription('Nombre del dispositivo')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('device-add')
    .setDescription('Registra un Smart Device')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nombre para el dispositivo')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('entity_id')
        .setDescription('Entity ID del dispositivo')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('device-remove')
    .setDescription('Elimina un Smart Device registrado')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nombre del dispositivo')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('devices')
    .setDescription('Lista todos los Smart Devices registrados'),

  new SlashCommandBuilder()
    .setName('vending')
    .setDescription('Busca items en Vending Machines')
    .addStringOption((opt) =>
      opt
        .setName('item')
        .setDescription('Nombre del item a buscar')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Envia un mensaje al team chat de Rust')
    .addStringOption((opt) =>
      opt
        .setName('message')
        .setDescription('Mensaje a enviar')
        .setRequired(true)
    ),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    console.log('[Discord] Registrando slash commands...');
    await rest.put(Routes.applicationCommands(config.discord.clientId), {
      body: commands.map((c) => c.toJSON()),
    });
    console.log('[Discord] Slash commands registrados!');
  } catch (err) {
    console.error('[Discord] Error registrando commands:', err);
  }
}

module.exports = { registerCommands };
