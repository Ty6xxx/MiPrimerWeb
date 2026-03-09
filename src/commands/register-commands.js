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
    .setDescription('Muestra jugadores online y cola'),

  new SlashCommandBuilder()
    .setName('online')
    .setDescription('Muestra los miembros online del equipo'),

  new SlashCommandBuilder()
    .setName('offline')
    .setDescription('Muestra los miembros offline del equipo'),

  new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Muestra los miembros AFK'),

  new SlashCommandBuilder()
    .setName('alive')
    .setDescription('Muestra el jugador con mas tiempo vivo'),

  new SlashCommandBuilder()
    .setName('proximity')
    .setDescription('Muestra la distancia entre compañeros'),

  new SlashCommandBuilder()
    .setName('cargo')
    .setDescription('Info sobre el Cargo Ship'),

  new SlashCommandBuilder()
    .setName('heli')
    .setDescription('Info sobre el Patrol Helicopter'),

  new SlashCommandBuilder()
    .setName('small')
    .setDescription('Info sobre Small Oil Rig'),

  new SlashCommandBuilder()
    .setName('large')
    .setDescription('Info sobre Large Oil Rig'),

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
    .setName('item')
    .setDescription('Busca un item en las Vending Machines')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nombre del item a buscar')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('cost')
    .setDescription('Costo de raidear un item/estructura')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nombre de la estructura (ej: stone wall, garage door)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('tracker')
    .setDescription('Crea un tracker de estado para un item')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nombre del tracker')
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

  new SlashCommandBuilder()
    .setName('silence')
    .setDescription('Silencia el bot por un tiempo')
    .addStringOption((opt) =>
      opt
        .setName('time')
        .setDescription('Duracion (ej: 2h30m, 5m, 1h)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reactiva el bot si esta silenciado'),

  new SlashCommandBuilder()
    .setName('alarm')
    .setDescription('Crea una alarma con tiempo y nombre')
    .addStringOption((opt) =>
      opt
        .setName('time')
        .setDescription('Duracion (ej: 2h30m, 9m)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nombre de la alarma')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('remain')
    .setDescription('Muestra el tiempo restante de las alarmas'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Detiene una alarma')
    .addIntegerOption((opt) =>
      opt
        .setName('id')
        .setDescription('ID de la alarma')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('leader')
    .setDescription('Cambia el lider del equipo')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Nombre del jugador (vacio = robar lider)')
        .setRequired(false)
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
