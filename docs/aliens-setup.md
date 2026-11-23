# The aliens

The aliens are in the game (`src/npcs.js`): workers (one per worker spot), 5 helpers who do the same jobs the player can do, and 34 citizens with no job who mostly walk the streets. 12 of the workers are managers (the first worker of each building).

## Daily plans
Every alien follows the same plan every day (`plan` = list of stops with a time, a place, and what they are doing):
- Workers walk from their home (near work) to their counter before opening, work their shift, relax at the tavern or plaza, then walk home to sleep (they disappear while asleep).
- Helpers (courier, bread runner, room cleaner, shelf stocker, book sorter) go from task to task during the day.
- Citizens run errands: shops that are open, the plaza, walks, dinner at the tavern, then home.
- They walk on the walking map in `src/navigation.js` (streets, plaza, stairs, doorways, and walking spots inside every building) using A* path finding.

## Talking (press E near an alien, then click an option)
- Everyone: who are you, what do you do every day, where are you going.
- Workers at their counter: buy things, rent/check out of rooms, healing, banking, library card, borrow/return books.
- Managers: ask for a job, get paid when done, quit. Citizens: tips. Helpers: what they're working on.

## Player jobs (`src/jobs.js`)
Parcel delivery (Post Office, 3 silver per parcel), bread delivery (Bakery, 3 each), room cleaning (Inn & Hotel, 2 each), stocking shelves (General Store, 2 each), sorting books (Library, 2 each). Glowing markers show the tasks; press E at each; go back to the manager to get paid.

## Bag (press B)
Eat food (gives health), drink potions, read books. Borrowed library books are due back in 3 days (you need a library card).

## Day and night
The sun rises at 6 AM and sets at 6 PM. The sky goes blue in the day and dark with stars at night; windows and lanterns glow after dark.

## Test shortcuts
`#test-town`, `#test-in=bakery`, plus `&time=21` (start at 9 PM) and `&talk` (start talking to the nearest alien).

---


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
