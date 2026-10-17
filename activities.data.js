// Hand-written notes for each way of making money, shown on the Overview cards and at the top of
// a contract's details. Keys match the activity ids in catalog.data.js (CONTRACTS_META.activities).
// The numbers on the cards (counts, rewards, UEC per hour) come from the catalog, not from here.
//
// Each entry can have:
//   summary:  one or two sentences on what the work is
//   need:     the ship or gear it takes
//   tips:     short extra notes
//   verified: false until you've checked the notes in game (set true when you have)
//
// Edit freely. refresh/ never touches this file.
window.ACTIVITIES = {
  bounty: {
    summary: "Hunt wanted criminals for the reward. Most targets fly ships. Higher risk levels add escorts and waves of reinforcements.",
    need: "A combat ship. A light fighter handles low-risk targets; high and extreme risk bounties bring escorts, so take a heavier ship or friends.",
    tips: [
      "Bounty Hunters Guild contracts unlock in steps through its certification contracts.",
      "Lawful bounties need a low CrimeStat.",
    ],
    verified: false,
  },
  "ship-combat": {
    summary: "Fight ships: ambushes, escorts, defending outposts and stations, clearing out pirates.",
    need: "A combat ship. The hardest tiers expect a crewed ship or a group.",
    verified: false,
  },
  "ground-combat": {
    summary: "Work on foot: clear outposts and asteroid bases, take out a named target, or sabotage equipment.",
    need: "Armor, a primary weapon, spare magazines and medpens, plus a ship to get there.",
    verified: false,
  },
  hauling: {
    summary: "Move cargo boxes between stations, outposts and cities. Pay grows with the amount and the distance.",
    need: "A ship with cargo space. Each contract lists the largest box size, which has to fit your ship.",
    tips: [
      "Delivering part of the cargo pays part of the reward (see the contract's partial pay table).",
      "Each hauling company (Covalex, Ling Family, Red Wind) has its own rank. Higher ranks unlock bigger loads.",
    ],
    verified: false,
  },
  delivery: {
    summary: "Carry small packages, on foot or in any ship. Quick and low-risk, so a good place to start.",
    need: "Any ship. A tractor beam helps with boxes.",
    verified: false,
  },
  mining: {
    summary: "Purchase orders: mine the listed ores or gems and hand them in at the contractor's freight elevator. Ship mining, ground vehicle (ROC) mining, or hand mining.",
    need: "A mining ship, a ROC, or a multitool with a mining attachment, depending on the order.",
    tips: [
      "Community run times only cover the hand-in, not the mining, so UEC per hour isn't shown.",
      "You can also refine ore and sell it at commodity terminals without a contract.",
    ],
    verified: false,
  },
  salvage: {
    summary: "Strip wrecks you have salvage rights to, or recover their cargo.",
    need: "A salvage ship, or a multitool with a salvage attachment for small jobs.",
    tips: ["Some salvage claims cost a buy-in before you start."],
    verified: false,
  },
  refueling: {
    summary: "Refuel stranded ships and fleets for the United Wayfarers Club.",
    need: "A ship that can carry and transfer fuel, such as the MISC Starfarer.",
    verified: false,
  },
  repair: {
    summary: "Fix damaged outposts and stations.",
    need: "Whatever the contract lists. Usually a multitool and spare parts.",
    verified: false,
  },
  investigation: {
    summary: "Find missing people, recover black boxes and cargo, and find out what happened. Often some combat.",
    need: "A ship to search with, and gear for on-foot work.",
    verified: false,
  },
  gathering: {
    summary: "Collect plants and creature parts for Rayari's research.",
    need: "Space to carry what you collect. Some items need special handling.",
    verified: false,
  },
  wikelo: {
    summary: "Trade collected items to Wikelo for special ships, armor and weapons. You pay in items, not UEC.",
    need: "The items listed on each trade, usually a lot of them.",
    verified: false,
  },
  event: {
    summary: "Limited-time event contracts. They're only offered while their event is running.",
    verified: false,
  },
  other: {
    summary: "Story and one-off contracts that don't fit the other groups.",
    verified: false,
  },
};
