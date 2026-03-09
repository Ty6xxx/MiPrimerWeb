function formatEventMessage(event) {
  const emojis = {
    'CargoShip': '🚢',
    'PatrolHelicopter': '🚁',
    'CH47 (Chinook)': '🛩️',
    'Explosion': '💥',
    'Crate': '📦',
  };

  const emoji = emojis[event.type] || '⚠️';
  const coords = event.marker
    ? ` en (${Math.round(event.marker.x)}, ${Math.round(event.marker.y)})`
    : '';

  return `${emoji} **${event.type}** detectado${coords}!`;
}

function formatEventEndMessage(event) {
  const emojis = {
    'CargoShip': '🚢',
    'PatrolHelicopter': '🚁',
    'CH47 (Chinook)': '🛩️',
    'Explosion': '💥',
    'Crate': '📦',
  };

  const emoji = emojis[event.type] || '⚠️';
  return `${emoji} **${event.type}** ha desaparecido del mapa.`;
}

module.exports = { formatEventMessage, formatEventEndMessage };
