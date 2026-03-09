const {
  handleDeviceCommand,
  registerDevice,
  removeDevice,
  getAllDevices,
} = require('../handlers/smart-devices');

async function handleInteraction(interaction, rustClient) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'server': {
        await interaction.deferReply();
        const info = await rustClient.getServerInfo();
        await interaction.editReply(
          [
            `**${info.name}**`,
            `Mapa: ${info.map} (${info.mapSize})`,
            `Jugadores: ${info.players}/${info.maxPlayers}`,
            `Cola: ${info.queuedPlayers}`,
            `Seed: ${info.seed}`,
          ].join('\n')
        );
        break;
      }

      case 'time': {
        await interaction.deferReply();
        const time = await rustClient.getTime();
        const dayNight =
          time.time >= 7 && time.time < 19.5 ? 'DIA' : 'NOCHE';
        await interaction.editReply(
          `Hora: **${time.time.toFixed(1)}** (${dayNight}) | Amanecer: ${time.sunrise.toFixed(1)} | Atardecer: ${time.sunset.toFixed(1)}`
        );
        break;
      }

      case 'team': {
        await interaction.deferReply();
        const teamInfo = await rustClient.getTeamInfo();
        const members = teamInfo.members
          .map(
            (m) =>
              `- **${m.name}**: ${m.isOnline ? 'Online' : 'Offline'}${m.isAlive ? '' : ' (MUERTO)'}`
          )
          .join('\n');
        await interaction.editReply(`**Equipo:**\n${members}`);
        break;
      }

      case 'pop': {
        await interaction.deferReply();
        const info = await rustClient.getServerInfo();
        await interaction.editReply(
          `Jugadores: **${info.players}/${info.maxPlayers}** | Cola: ${info.queuedPlayers}`
        );
        break;
      }

      case 'switch': {
        await interaction.deferReply();
        const action = interaction.options.getString('action');
        const device = interaction.options.getString('device');
        const result = await handleDeviceCommand(rustClient, action, device);
        await interaction.editReply(result);
        break;
      }

      case 'device-add': {
        const name = interaction.options.getString('name');
        const entityId = interaction.options.getString('entity_id');
        registerDevice(name, entityId);
        await interaction.reply(
          `Dispositivo **${name}** registrado con ID: ${entityId}`
        );
        break;
      }

      case 'device-remove': {
        const name = interaction.options.getString('name');
        const removed = removeDevice(name);
        await interaction.reply(
          removed
            ? `Dispositivo **${name}** eliminado.`
            : `No se encontro dispositivo "${name}".`
        );
        break;
      }

      case 'devices': {
        const deviceList = getAllDevices();
        if (deviceList.length === 0) {
          await interaction.reply(
            'No hay dispositivos registrados. Usa /device-add para agregar uno.'
          );
        } else {
          const list = deviceList
            .map((d) => `- **${d.name}**: ${d.id}`)
            .join('\n');
          await interaction.reply(`**Dispositivos registrados:**\n${list}`);
        }
        break;
      }

      case 'vending': {
        await interaction.deferReply();
        const itemName = interaction.options.getString('item');
        const results = await rustClient.searchVending(itemName);
        if (results.length === 0) {
          await interaction.editReply(
            `No se encontraron vending machines con "${itemName}".`
          );
        } else {
          const list = results
            .slice(0, 10)
            .map(
              (r) =>
                `- **${r.name}** en (${Math.round(r.location.x)}, ${Math.round(r.location.y)}): ${r.amountInStock}x disponibles`
            )
            .join('\n');
          await interaction.editReply(
            `**Resultados para "${itemName}":**\n${list}`
          );
        }
        break;
      }

      case 'say': {
        const message = interaction.options.getString('message');
        rustClient.sendTeamMessage(message);
        await interaction.reply(`Mensaje enviado al team chat: "${message}"`);
        break;
      }
    }
  } catch (err) {
    const reply = `Error: ${err.message}`;
    if (interaction.deferred) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

module.exports = { handleInteraction };
