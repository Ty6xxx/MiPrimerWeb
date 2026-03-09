// ========================
// Costos de raidear estructuras en Rust
// ========================

const raidCosts = {
  // Paredes
  'twig wall': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'wood wall': { c4: 1, rockets: 2, satchels: 3, expAmmo: 49 },
  'stone wall': { c4: 2, rockets: 4, satchels: 10, expAmmo: 185 },
  'metal wall': { c4: 4, rockets: 8, satchels: 23, expAmmo: 400 },
  'armored wall': { c4: 8, rockets: 15, satchels: 46, expAmmo: 799 },

  // Puertas
  'wooden door': { c4: 1, rockets: 1, satchels: 2, expAmmo: 19 },
  'sheet metal door': { c4: 1, rockets: 2, satchels: 4, expAmmo: 63 },
  'garage door': { c4: 2, rockets: 3, satchels: 9, expAmmo: 150 },
  'armored door': { c4: 3, rockets: 4, satchels: 12, expAmmo: 200 },

  // Piso / Foundation
  'twig floor': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'wood floor': { c4: 1, rockets: 2, satchels: 3, expAmmo: 49 },
  'stone floor': { c4: 2, rockets: 4, satchels: 10, expAmmo: 185 },
  'metal floor': { c4: 4, rockets: 8, satchels: 23, expAmmo: 400 },
  'armored floor': { c4: 8, rockets: 15, satchels: 46, expAmmo: 799 },

  // Otros
  'high external stone wall': { c4: 2, rockets: 3, satchels: 10, expAmmo: 185 },
  'high external wood wall': { c4: 1, rockets: 2, satchels: 3, expAmmo: 49 },
  'metal barricade': { c4: 1, rockets: 1, satchels: 3, expAmmo: 38 },
  'tool cupboard': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'vending machine': { c4: 1, rockets: 1, satchels: 2, expAmmo: 30 },
  'dropbox': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'wood shutters': { c4: 1, rockets: 1, satchels: 2, expAmmo: 19 },
  'metal shop front': { c4: 1, rockets: 2, satchels: 4, expAmmo: 63 },
  'ladder hatch': { c4: 1, rockets: 2, satchels: 4, expAmmo: 63 },
  'floor grill': { c4: 1, rockets: 1, satchels: 3, expAmmo: 38 },
  'prison cell gate': { c4: 1, rockets: 2, satchels: 4, expAmmo: 63 },
  'chainlink fence': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'chainlink gate': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'metal window bars': { c4: 1, rockets: 2, satchels: 4, expAmmo: 63 },
  'reinforced glass window': { c4: 2, rockets: 3, satchels: 8, expAmmo: 140 },
  'wooden window bars': { c4: 1, rockets: 1, satchels: 2, expAmmo: 19 },
  'large wood box': { c4: 1, rockets: 1, satchels: 2, expAmmo: 30 },
  'small wood box': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'furnace': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'large furnace': { c4: 1, rockets: 1, satchels: 3, expAmmo: 38 },
  'workbench level 1': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'workbench level 2': { c4: 1, rockets: 1, satchels: 2, expAmmo: 30 },
  'workbench level 3': { c4: 1, rockets: 1, satchels: 3, expAmmo: 38 },
  'sleeping bag': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'bed': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'sam site': { c4: 1, rockets: 1, satchels: 2, expAmmo: 30 },
  'auto turret': { c4: 1, rockets: 1, satchels: 3, expAmmo: 38 },
  'flame turret': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
  'shotgun trap': { c4: 1, rockets: 1, satchels: 1, expAmmo: 19 },
};

function searchRaidCost(query) {
  const q = query.toLowerCase().trim();
  const results = [];

  for (const [name, costs] of Object.entries(raidCosts)) {
    if (name.includes(q)) {
      results.push({ name, ...costs });
    }
  }

  return results;
}

module.exports = { raidCosts, searchRaidCost };
