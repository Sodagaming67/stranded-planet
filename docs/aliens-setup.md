# Ready for the aliens

Everything the alien NPCs need is built. When aliens are added, they only have to walk to their spot and call these.

## Who works where
- `alienJobs()` in `src/economy.js`: every job in town (18 right now): building, job title (Baker, Innkeeper, Doctor, Bank teller...), opening hours, and the worker spot to stand on.
- An alien is any object like `{ isAlien: true, name: 'Zib', workplace: 'INN & HOTEL' }`.
- Only an alien who works at that building can serve, and only while it is open (`SERVICES[...].hours` in `src/services.js`; hotels, hospital and clinic never close; bank 9 AM-5 PM; most shops 8 AM-8 PM).

## Where to walk (`townWalkways` in `src/town.js`)
- `services`: every building's door (outside + inside spots), worker spots, customer spots, and hotel room spots.
- `roads`, `stairs`, `plaza`: the streets and the bank plaza.
- `vaults`: the 3 bank vault doors.

## What aliens can do (`src/economy.js`) - each returns `{ ok, message }` and shows the message on screen
- `sell(alien, building, itemName)`: sells anything on that building's list. Food/drinks are eaten, healing heals the player, services just happen, everything else goes in `inventory`.
- `rentRoom(alien, hotel)`: gives the player a free numbered room and takes the first night's payment.
- **Every night at 9 PM** each hotel charges the player for their room. If they can't pay, they lose the room. (Renting covers the night you rent it; charging starts the next night.)
- `checkOut(alien, hotel)`: ends the player's room rental.
- `deposit(teller, coins)`, `withdraw(teller, coins)`, `exchange(teller, toGold)`: the bank. Coins in the bank are in `bankAccount`.
- Bank vaults: `vault.open(alien)` / `vault.close(alien)` (only aliens). Closed by default.

## Time
- `src/clock.js`: 1 real minute = 1 game hour (a day is 24 real minutes). The game starts Day 1, 8:00 AM. `atHour(hour, fn)` runs something every day at that hour.
- The sky does not get dark at night yet.
