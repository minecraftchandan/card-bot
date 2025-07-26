// packrarity.js

// Rarity groups ordered from most common to most rare
const GROUPS = {
  Common: ["Common", "Uncommon"],
  Rare: ["Rare", "Rare Holo"],
  Ultra: [
    "Rare Holo V",
    "Rare Holo GX",
    "Rare Holo EX",
    "Rare Holo LV.X",
    "Rare Holo VMAX",
    "Rare Holo VSTAR"
  ],
  Shiny: [
    "Shiny Rare",
    "Rare Shiny",
    "Rare Shiny GX",
    "Shiny Ultra Rare",
    "Radiant Rare"
  ],
  Secret: [
    "Ultra Rare",
    "Rare Secret",
    "Rare Rainbow",
    "Hyper Rare",
    "Rare Ultra",
    "Rare ACE",
    "Rare Prime",
    "Rare BREAK"
  ],
  Special: [
    "Rare Prism Star",
    "Rare Holo Star",
    "Rare Shining",
    "Amazing Rare",
    "Classic Collection",
    "LEGEND",
    "Special Illustration Rare",
    "Trainer Gallery Rare Holo"
  ]
};

// Pack rarity distributions - numbers represent percentage chance
// Higher rarities (Special, Secret) have lower numbers making them rarer
module.exports = {
  daily: {
    Common: 75,    // Most common - cheapest pack
    Rare: 20,
    Ultra: 4,
    Shiny: 0.8,
    Secret: 0.15,
    Special: 0.05, // Most rare
    groups: GROUPS
  },

  bronze: {
    Common: 65,    // Most common - 50 coins
    Rare: 25,
    Ultra: 8,
    Shiny: 1.5,
    Secret: 0.4,
    Special: 0.1,  // Most rare
    groups: GROUPS
  },

  silver: {
    Common: 55,    // Most common - 100 coins
    Rare: 30,
    Ultra: 12,
    Shiny: 2.5,
    Secret: 0.8,
    Special: 0.2,  // Most rare
    groups: GROUPS
  },

  gold: {
    Common: 45,    // Most common - 200 coins
    Rare: 30,
    Ultra: 18,
    Shiny: 5,
    Secret: 1.5,
    Special: 0.5,  // Most rare
    groups: GROUPS
  },

  prestige: {
    Common: 35,    // Most common - 500 coins
    Rare: 30,
    Ultra: 22,
    Shiny: 8,
    Secret: 3.5,
    Special: 1.5,  // Most rare
    groups: GROUPS
  },

  legendary: {
    Common: 25,    // Most common - 1000 coins
    Rare: 30,
    Ultra: 25,
    Shiny: 12,
    Secret: 5,
    Special: 3,    // Most rare
    groups: GROUPS
  }
};
