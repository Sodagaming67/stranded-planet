// The rules alien workers follow when they serve the player.
// An alien is any object like { isAlien: true, name: 'Zib', workplace: 'BAKERY' }.
// Every action returns { ok, message } and the message also pops up on screen.

import { wallet, SILVER_PER_GOLD } from './money.js';
import { SERVICES, isOpenAt } from './services.js';
import { clock, atHour } from './clock.js';
import { buildingServices } from './town.js';

export const NIGHTLY_CHARGE_HOUR = 21; // hotels charge for the night at 9:00 PM

export const inventory = []; // things the player has bought
export const bookings = []; // hotel rooms the player is renting: { hotel, room, price, nights, paidThroughDay }
export const bankAccount = { gold: 0, silver: 0 }; // coins kept safe in the bank

let player = null;
export function setPlayer(p) {
  player = p;
}

const messageListeners = [];
export function onMessage(fn) {
  messageListeners.push(fn);
}
function result(ok, message) {
  messageListeners.forEach((fn) => fn(message));
  return { ok, message };
}

const hourText = (h) => `${((h + 11) % 12) + 1} ${h % 24 < 12 ? 'AM' : 'PM'}`;
const inSilver = (coins) => (coins.gold ?? 0) * SILVER_PER_GOLD + (coins.silver ?? 0);

export function priceText(coins) {
  const parts = [];
  if (coins.gold) parts.push(`${coins.gold} gold`);
  if (coins.silver || !coins.gold) parts.push(`${coins.silver ?? 0} silver`);
  return parts.join(' and ');
}

export function canAfford(price) {
  return inSilver(wallet) >= inSilver(price);
}

// Takes coins from the wallet. Pays with gold first, then silver; breaks a gold coin for change if needed.
function pay(price) {
  let cost = inSilver(price);
  if (inSilver(wallet) < cost) return false;
  const gold = Math.min(wallet.gold, Math.floor(cost / SILVER_PER_GOLD));
  wallet.gold -= gold;
  cost -= gold * SILVER_PER_GOLD;
  if (wallet.silver < cost) {
    const broken = Math.ceil((cost - wallet.silver) / SILVER_PER_GOLD);
    wallet.gold -= broken;
    wallet.silver += broken * SILVER_PER_GOLD;
  }
  wallet.silver -= cost;
  return true;
}

// Checks that this alien is allowed to serve here right now.
function cannotServe(worker, building) {
  if (!worker?.isAlien) return 'Only alien workers can do that.';
  if (worker.workplace !== building) return `${worker.name ?? 'That alien'} doesn't work at the ${building.toLowerCase()}.`;
  if (!SERVICES[building]) return `There is no ${building.toLowerCase()} in town.`;
  if (!isOpenAt(building, clock.hour)) {
    const [open, close] = SERVICES[building].hours;
    return `The ${building.toLowerCase()} is closed. It's open from ${hourText(open)} to ${hourText(close)}.`;
  }
  return null;
}

function findOffer(building, offerName) {
  return SERVICES[building]?.sells.find((s) => s.name === offerName);
}

// An alien worker sells the player something from their building's list (food, potions, healing...).
export function sell(worker, building, offerName) {
  const problem = cannotServe(worker, building);
  if (problem) return result(false, problem);
  const offer = findOffer(building, offerName);
  if (!offer) return result(false, `The ${building.toLowerCase()} doesn't sell "${offerName}".`);
  if (offer.effect.type === 'room') return rentRoom(worker, building);
  if (offer.effect.type === 'bank') return result(false, 'Use the bank actions for that.');
  if (!pay(offer)) return result(false, `You need ${priceText(offer)} for ${offerName.toLowerCase()}.`);

  const paid = `You paid ${priceText(offer)}.`;
  if (offer.effect.type === 'heal' && player) {
    player.health = Math.min(player.maxHealth, player.health + offer.effect.amount);
    return result(true, `${offerName}! ${paid}`);
  }
  if (offer.effect.type === 'eat' || offer.effect.type === 'service') return result(true, `${offerName}. ${paid}`);
  inventory.push({ name: offerName, from: building });
  return result(true, `You bought ${offerName.toLowerCase()}. ${paid}`);
}

// An alien innkeeper rents the player a free room. The first night is paid right away.
export function rentRoom(worker, hotel) {
  const problem = cannotServe(worker, hotel);
  if (problem) return result(false, problem);
  if (bookings.some((b) => b.hotel === hotel)) return result(false, `You already have a room at the ${hotel.toLowerCase()}.`);
  const offer = findOffer(hotel, 'Room for one night');
  const rooms = buildingServices.find((b) => b.name === hotel)?.rooms ?? [];
  const room = rooms.find((r) => !bookings.some((b) => b.hotel === hotel && b.room.number === r.number));
  if (!offer || !room) return result(false, `Sorry, the ${hotel.toLowerCase()} has no free rooms.`);
  if (!pay(offer)) return result(false, `A room costs ${priceText(offer)} a night. You don't have enough coins.`);
  // The first payment covers tonight, so the nightly charge starts tomorrow night.
  bookings.push({ hotel, room, price: { gold: offer.gold, silver: offer.silver }, nights: 1, paidThroughDay: clock.day });
  return result(true, `Room ${room.number} is yours! You paid ${priceText(offer)} for tonight. It costs that again every night at 9 PM.`);
}

// The player stops renting their room (an alien at the front desk checks them out).
export function checkOut(worker, hotel) {
  const problem = cannotServe(worker, hotel);
  if (problem) return result(false, problem);
  const i = bookings.findIndex((b) => b.hotel === hotel);
  if (i < 0) return result(false, `You don't have a room at the ${hotel.toLowerCase()}.`);
  const [booking] = bookings.splice(i, 1);
  return result(true, `You checked out of room ${booking.room.number}. You stayed ${booking.nights} night${booking.nights === 1 ? '' : 's'}.`);
}

// Every night the hotels charge for each room the player rents. No coins means no room.
function chargeForTheNight(day) {
  for (const booking of [...bookings]) {
    if (booking.paidThroughDay >= day) continue;
    const name = booking.hotel.toLowerCase();
    if (pay(booking.price)) {
      booking.nights++;
      booking.paidThroughDay = day;
      result(true, `The ${name} charged you ${priceText(booking.price)} for tonight in room ${booking.room.number}.`);
    } else {
      bookings.splice(bookings.indexOf(booking), 1);
      result(false, `You couldn't pay the ${name} for tonight, so you lost room ${booking.room.number}.`);
    }
  }
}
atHour(NIGHTLY_CHARGE_HOUR, chargeForTheNight);

// Bank: an alien teller moves coins between the player's wallet and their bank account.
export function deposit(worker, coins) {
  const problem = cannotServe(worker, 'BANK');
  if (problem) return result(false, problem);
  if ((coins.gold ?? 0) > wallet.gold || (coins.silver ?? 0) > wallet.silver) return result(false, "You don't have those coins.");
  wallet.gold -= coins.gold ?? 0;
  wallet.silver -= coins.silver ?? 0;
  bankAccount.gold += coins.gold ?? 0;
  bankAccount.silver += coins.silver ?? 0;
  return result(true, `You put ${priceText(coins)} in the bank.`);
}

export function withdraw(worker, coins) {
  const problem = cannotServe(worker, 'BANK');
  if (problem) return result(false, problem);
  if ((coins.gold ?? 0) > bankAccount.gold || (coins.silver ?? 0) > bankAccount.silver) return result(false, "You don't have that much in the bank.");
  bankAccount.gold -= coins.gold ?? 0;
  bankAccount.silver -= coins.silver ?? 0;
  wallet.gold += coins.gold ?? 0;
  wallet.silver += coins.silver ?? 0;
  return result(true, `You took ${priceText(coins)} out of the bank.`);
}

// Swaps 10 silver for 1 gold, or 1 gold for 10 silver.
export function exchange(worker, toGold = true) {
  const problem = cannotServe(worker, 'BANK');
  if (problem) return result(false, problem);
  if (toGold) {
    if (wallet.silver < SILVER_PER_GOLD) return result(false, `You need ${SILVER_PER_GOLD} silver coins to get 1 gold coin.`);
    wallet.silver -= SILVER_PER_GOLD;
    wallet.gold += 1;
    return result(true, `You swapped ${SILVER_PER_GOLD} silver for 1 gold.`);
  }
  if (wallet.gold < 1) return result(false, "You don't have a gold coin to swap.");
  wallet.gold -= 1;
  wallet.silver += SILVER_PER_GOLD;
  return result(true, `You swapped 1 gold for ${SILVER_PER_GOLD} silver.`);
}

// Every job in town: which building, what the alien is called, and where it stands to work.
export function alienJobs() {
  return buildingServices.flatMap((b) =>
    b.stations.map((station, i) => ({ building: b.name, role: SERVICES[b.name]?.role ?? 'Shopkeeper', hours: SERVICES[b.name]?.hours, station, number: i + 1 })),
  );
}
