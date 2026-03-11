const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'bot-config.json');

const DEFAULTS = {
  pairingNotifications: true,
  teamNotifications: true,
  eventNotifications: true,
  deathNotifications: true,
  afkNotifications: true,
  prefix: '!',
};

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return { ...DEFAULTS, ...data };
    }
  } catch (err) {
    console.error('[Config] Error leyendo config:', err.message);
  }
  return { ...DEFAULTS };
}

function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error('[Config] Error guardando config:', err.message);
    return false;
  }
}

function getSetting(key) {
  const config = readConfig();
  return config[key];
}

function setSetting(key, value) {
  const config = readConfig();
  config[key] = value;
  return writeConfig(config);
}

module.exports = { readConfig, writeConfig, getSetting, setSetting, DEFAULTS };
