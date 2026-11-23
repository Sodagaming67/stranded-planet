// What every building offers. Prices are in coins: 10 silver = 1 gold.
// `stock` is what sits on the shelves and tables. Workers (aliens) will use these later:
// each building also gets worker and customer spots (see `buildingServices` in town.js).

const item = (name, gold, silver) => ({ name, gold, silver });

export const SERVICES = {
  'GENERAL STORE': {
    service: 'Sells supplies',
    stock: ['tool', 'sack', 'box', 'candle', 'pot'],
    sells: [item('Rope', 0, 3), item('Lantern', 0, 8), item('Backpack', 1, 2), item('Water flask', 0, 4), item('Pickaxe', 2, 0)],
  },
  BAKERY: {
    service: 'Sells baked food',
    stock: ['bread', 'pie'],
    sells: [item('Loaf of bread', 0, 2), item('Sweet roll', 0, 3), item('Moonberry pie', 0, 5)],
  },
  GROCER: {
    service: 'Sells fruit and vegetables',
    stock: ['veg', 'sack'],
    sells: [item('Crunch apple', 0, 1), item('Star carrot', 0, 1), item('Glow melon', 0, 4)],
  },
  BUTCHER: {
    service: 'Sells meat',
    stock: ['meat'],
    sells: [item('Sausages', 0, 4), item('Roast ham', 0, 8)],
  },
  'CHEESE SHOP': {
    service: 'Sells cheese',
    stock: ['cheese'],
    sells: [item('Cheese wedge', 0, 3), item('Whole cheese wheel', 2, 0)],
  },
  'POTION SHOP': {
    service: 'Sells potions',
    stock: ['potion'],
    sells: [item('Healing potion', 1, 5), item('Breathing potion', 2, 0), item('Speed potion', 1, 0)],
  },
  TAILOR: {
    service: 'Sells and fixes clothes',
    stock: ['cloth'],
    sells: [item('Shirt', 0, 6), item('Warm cloak', 1, 2), item('Patch your space suit', 1, 0)],
  },
  SHOEMAKER: {
    service: 'Sells and fixes shoes',
    stock: ['shoe'],
    sells: [item('Sandals', 0, 4), item('Hiking boots', 1, 0), item('Fix boots', 0, 3)],
  },
  HERBALIST: {
    service: 'Sells herbs and remedies',
    stock: ['herb', 'potion'],
    sells: [item('Healing herbs', 0, 3), item('Soothing salve', 0, 6)],
  },
  'TOY SHOP': {
    service: 'Sells toys',
    stock: ['toy'],
    sells: [item('Bouncy ball', 0, 2), item('Wooden alien', 0, 5), item('Spinning top', 0, 3)],
  },
  'CANDLE MAKER': {
    service: 'Sells candles',
    stock: ['candle'],
    sells: [item('Candle', 0, 1), item('Big lantern candle', 0, 3)],
  },
  POTTER: {
    service: 'Sells pots',
    stock: ['pot'],
    sells: [item('Clay pot', 0, 4), item('Fancy vase', 0, 9)],
  },
  CARPENTER: {
    service: 'Builds furniture',
    stock: ['plank', 'tool'],
    sells: [item('Chair', 1, 0), item('Table', 2, 0), item('Repair', 0, 5)],
  },
  'FARM SUPPLY': {
    service: 'Sells farming supplies',
    stock: ['sack', 'tool', 'veg'],
    sells: [item('Seeds', 0, 2), item('Watering can', 0, 6), item('Hoe', 1, 0)],
  },
  'BOOK SHOP': {
    service: 'Sells books',
    stock: ['book'],
    sells: [item('Map of the planet', 0, 5), item('Storybook', 0, 7)],
  },
  'POST OFFICE': {
    service: 'Sends letters and parcels',
    stock: ['parcel'],
    sells: [item('Send a letter', 0, 1), item('Send a parcel', 0, 4)],
  },
  BLACKSMITH: {
    service: 'Makes and fixes tools',
    stock: ['tool'],
    sells: [item('Pickaxe', 2, 0), item('Better pickaxe', 4, 0), item('Fix a tool', 0, 5)],
  },
  TAVERN: {
    service: 'Serves food and drinks',
    stock: ['potion'],
    sells: [item('Hot meal', 0, 4), item('Moonberry juice', 0, 2), item('Bowl of stew', 0, 3)],
  },
  'INN & HOTEL': {
    service: 'Rents rooms',
    sells: [item('Room for one night', 0, 8), item('Breakfast', 0, 3)],
  },
  HOTEL: {
    service: 'Rents rooms',
    sells: [item('Room for one night', 0, 8), item('Breakfast', 0, 3)],
  },
  'BOARDING HOUSE': {
    service: 'Rents cheap rooms',
    sells: [item('Room for one night', 0, 5)],
  },
  HOSPITAL: {
    service: 'Heals you',
    sells: [item('Check-up', 0, 3), item('Full healing', 1, 0)],
  },
  CLINIC: {
    service: 'Patches you up',
    sells: [item('Bandage', 0, 2), item('Healing', 0, 6)],
  },
  LIBRARY: {
    service: 'Lends books',
    sells: [item('Library card', 0, 2), item('Borrow a book', 0, 0)],
  },
  STABLE: {
    service: 'Rents rides',
    stock: ['sack'],
    sells: [item('Ride across town', 0, 5)],
  },
  BANK: {
    service: 'Keeps your coins safe',
    sells: [item('Deposit coins', 0, 0), item('Withdraw coins', 0, 0), item('Swap 10 silver for 1 gold', 0, 0)],
  },
};

// When each building is open (24-hour clock). Anything not listed is open 8:00 to 20:00.
const HOURS = {
  'INN & HOTEL': [0, 24],
  HOTEL: [0, 24],
  'BOARDING HOUSE': [0, 24],
  HOSPITAL: [0, 24],
  CLINIC: [0, 24],
  TAVERN: [10, 24],
  BANK: [9, 17],
  LIBRARY: [9, 19],
};

// The job an alien has when it works at each building. Anything not listed is a Shopkeeper.
const ROLES = {
  'GENERAL STORE': 'Storekeeper', BAKERY: 'Baker', GROCER: 'Grocer', BUTCHER: 'Butcher', 'CHEESE SHOP': 'Cheesemaker',
  'POTION SHOP': 'Potion brewer', TAILOR: 'Tailor', SHOEMAKER: 'Shoemaker', HERBALIST: 'Herbalist', 'TOY SHOP': 'Toymaker',
  'CANDLE MAKER': 'Candle maker', POTTER: 'Potter', CARPENTER: 'Carpenter', 'FARM SUPPLY': 'Farm supplier',
  'BOOK SHOP': 'Bookseller', 'POST OFFICE': 'Postmaster', BLACKSMITH: 'Blacksmith', TAVERN: 'Tavern keeper',
  'INN & HOTEL': 'Innkeeper', HOTEL: 'Innkeeper', 'BOARDING HOUSE': 'Landlord', HOSPITAL: 'Doctor', CLINIC: 'Nurse',
  LIBRARY: 'Librarian', STABLE: 'Stable hand', BANK: 'Bank teller',
};

// What some paid services do (everything else just goes into your bag).
const EFFECTS = {
  'Room for one night': { type: 'room' },
  'Check-up': { type: 'heal', amount: 20 },
  'Full healing': { type: 'heal', amount: 100 },
  Bandage: { type: 'heal', amount: 15 },
  Healing: { type: 'heal', amount: 50 },
  'Hot meal': { type: 'eat' },
  'Bowl of stew': { type: 'eat' },
  'Moonberry juice': { type: 'eat' },
  Breakfast: { type: 'eat' },
  'Send a letter': { type: 'service' },
  'Send a parcel': { type: 'service' },
  'Fix boots': { type: 'service' },
  'Fix a tool': { type: 'service' },
  Repair: { type: 'service' },
  'Patch your space suit': { type: 'service' },
  'Ride across town': { type: 'service' },
  'Deposit coins': { type: 'bank' },
  'Withdraw coins': { type: 'bank' },
  'Swap 10 silver for 1 gold': { type: 'bank' },
};

for (const [name, info] of Object.entries(SERVICES)) {
  info.hours = HOURS[name] ?? [8, 20];
  info.role = ROLES[name] ?? 'Shopkeeper';
  for (const offer of info.sells) offer.effect = EFFECTS[offer.name] ?? { type: 'item' };
}

export function isOpenAt(building, hour) {
  const [open, close] = SERVICES[building]?.hours ?? [0, 0];
  return hour >= open && hour < close;
}
