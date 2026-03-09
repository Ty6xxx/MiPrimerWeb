// Almacén de dispositivos emparejados (nombre -> entityId)
const devices = new Map();

function registerDevice(name, entityId) {
  devices.set(name.toLowerCase(), entityId);
}

function removeDevice(name) {
  return devices.delete(name.toLowerCase());
}

function getDevice(name) {
  return devices.get(name.toLowerCase());
}

function getAllDevices() {
  return Array.from(devices.entries()).map(([name, id]) => ({ name, id }));
}

async function handleDeviceCommand(rustClient, action, deviceName) {
  const entityId = getDevice(deviceName);
  if (!entityId) {
    return `No se encontro un dispositivo llamado "${deviceName}". Usa /device-add para registrar uno.`;
  }

  try {
    if (action === 'on') {
      await rustClient.turnOn(entityId);
      return `Smart Switch "${deviceName}" (${entityId}) ENCENDIDO`;
    } else if (action === 'off') {
      await rustClient.turnOff(entityId);
      return `Smart Switch "${deviceName}" (${entityId}) APAGADO`;
    } else if (action === 'status') {
      const info = await rustClient.getEntityInfo(entityId);
      const state = info.payload.value ? 'ENCENDIDO' : 'APAGADO';
      return `Smart Switch "${deviceName}" (${entityId}): ${state}`;
    }
  } catch (err) {
    return `Error al controlar "${deviceName}": ${err.message}`;
  }
}

module.exports = {
  registerDevice,
  removeDevice,
  getDevice,
  getAllDevices,
  handleDeviceCommand,
};
