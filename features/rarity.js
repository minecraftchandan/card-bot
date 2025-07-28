// rarity.js
module.exports = {
  // Common and Uncommon are now much more frequent
  Common: 60,   // Was 45
  Uncommon: 35, // Was 30

  // Rare and Rare Holo categories are drastically reduced
  Rare: 4,      // Was 8 (halved)
  "Rare Holo": 2,     // Was 4 (halved)
  "Rare Holo V": 1.5, // Was 3
  "Rare Holo GX": 1.5, // Was 3
  "Rare Holo EX": 1.5, // Was 3
  "Rare Holo LV.X": 1, // Was 2
  "Rare Holo VMAX": 0.7, // Was 1.5
  "Rare Holo VSTAR": 0.7, // Was 1.5

  // Ultra Rare and above (extremely rare - very low probabilities)
  "Ultra Rare": 0.5, // Was 1.8
  "Double Rare": 0.4, // Was 1.5
  "Trainer Gallery Rare Holo": 0.3, // Was 1.2
  "Illustration Rare": 0.25, // Was 1.0
  "Special Illustration Rare": 0.15, // Was 0.8
  "Shiny Rare": 0.1, // Was 0.7
  "Rare Shiny": 0.1, // Was 0.7
  "Rare Shiny GX": 0.08, // Was 0.6
  "Shiny Ultra Rare": 0.07, // Was 0.5
  "Radiant Rare": 0.07, // Was 0.5
  "Rare BREAK": 0.06, // Was 0.4
  "Rare Prime": 0.06, // Was 0.4
  "Rare ACE": 0.05, // Was 0.3
  "Rare Ultra": 0.04, // Was 0.25
  "Rare Rainbow": 0.03, // Was 0.2
  "Rare Secret": 0.02, // Was 0.15
  "Rare Shining": 0.02, // Was 0.15
  "Rare Holo Star": 0.015, // Was 0.1
  "Rare Prism Star": 0.015, // Was 0.1
  "Hyper Rare": 0.01, // Was 0.08
  "Amazing Rare": 0.005, // Was 0.05
  "Classic Collection": 0.003, // Was 0.03
  Promo: 0.002, // Was 0.02
  LEGEND: 0.001, // Was 0.01

  // Keep Unknown as is, assuming it has a specific purpose
  Unknown: 20,
};
