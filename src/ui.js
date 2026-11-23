import { SERVICES } from './services.js';
import { wallet } from './money.js';
import * as economy from './economy.js';
import { JOBS, job, startJob, finishJob, quitJob } from './jobs.js';
import { introduce, describeDay, whereGoing, randomTip, timeText } from './npcs.js';

// Talking to aliens (click an option), the bag, the "Press E" prompt, and the job checklist.

const css = `
  .panel { position: fixed; z-index: 3; left: 50%; transform: translateX(-50%); width: min(620px, calc(100vw - 32px));
    background: rgba(30, 20, 12, 0.92); border: 3px solid #e8c25a; border-radius: 14px; color: #f6ecd6;
    font-family: Georgia, 'Times New Roman', serif; padding: 16px 18px; display: none; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  #talk { bottom: 24px; }
  #bag { top: 50%; transform: translate(-50%, -50%); max-height: 80vh; overflow-y: auto; }
  .panel h2 { font-size: 22px; margin-bottom: 2px; color: #ffd166; }
  .panel .who { font-size: 14px; opacity: 0.8; margin-bottom: 10px; }
  .panel .say { font-size: 17px; line-height: 1.45; margin-bottom: 12px; min-height: 24px; }
  .panel .options { display: flex; flex-direction: column; gap: 6px; }
  .panel button { text-align: left; font: inherit; font-size: 16px; padding: 7px 12px; border-radius: 8px; cursor: pointer;
    border: 2px solid #8a6239; background: #4a3222; color: #fff; }
  .panel button:hover { background: #6b4a30; border-color: #e8c25a; }
  .panel button.leave { background: #2d2a26; }
  .panel .item { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(232,194,90,0.25); }
  .panel .item button { padding: 4px 10px; font-size: 14px; }
  #prompt { position: fixed; z-index: 1; left: 50%; bottom: 96px; transform: translateX(-50%); display: none; padding: 6px 14px;
    background: rgba(0,0,0,0.55); border-radius: 8px; color: #fff; font-family: system-ui, sans-serif; font-size: 15px; pointer-events: none; }
  #prompt b { background: #e8c25a; color: #2b1d0e; padding: 0 7px; border-radius: 4px; }
  #jobs { position: fixed; z-index: 1; top: 52px; left: 16px; display: none; width: 260px; padding: 8px 12px; background: rgba(20,14,8,0.65);
    border: 2px solid rgba(232,194,90,0.7); border-radius: 10px; color: #f6ecd6; font-family: Georgia, serif; font-size: 14px; pointer-events: none; }
  #jobs h3 { font-size: 15px; color: #ffd166; margin-bottom: 4px; }
  #jobs .done { text-decoration: line-through; opacity: 0.6; }
`;
const style = document.createElement('style');
style.textContent = css;
document.head.append(style);

const make = (id, cls) => {
  const el = document.createElement('div');
  el.id = id;
  if (cls) el.className = cls;
  document.body.append(el);
  return el;
};
const talkPanel = make('talk', 'panel');
const bagPanel = make('bag', 'panel');
const promptEl = make('prompt');
const jobsEl = make('jobs');

export const ui = { open: false };
let onClose = null;
let talkingTo = null;

const price = (o) => (o.gold || o.silver ? economy.priceText(o) : 'free');
const lower = (s) => s.toLowerCase();

function button(label, run, cls) {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', run);
  return b;
}

// ---------- Talking ----------

function talkOptions(npc) {
  const options = [
    { label: 'Who are you?', run: () => introduce(npc) },
    { label: 'What do you do every day?', run: () => describeDay(npc) },
    { label: 'Where are you going right now?', run: () => whereGoing(npc) },
  ];
  const b = npc.workplace;
  if (npc.kind === 'worker' && npc.state === 'working') {
    const info = SERVICES[b];
    if (b === 'BANK') {
      options.push(
        { label: 'Put 10 silver in the bank', run: () => economy.deposit(npc, { silver: 10 }).message },
        { label: 'Put 1 gold in the bank', run: () => economy.deposit(npc, { gold: 1 }).message },
        { label: 'Take 10 silver out', run: () => economy.withdraw(npc, { silver: 10 }).message },
        { label: 'Take 1 gold out', run: () => economy.withdraw(npc, { gold: 1 }).message },
        { label: 'Swap 10 silver for 1 gold', run: () => economy.exchange(npc, true).message },
        { label: 'Swap 1 gold for 10 silver', run: () => economy.exchange(npc, false).message },
        { label: 'How much is in my account?', run: () => `You have ${economy.priceText(economy.bankAccount)} in the bank.` },
      );
    } else if (info.sells.some((o) => o.effect.type === 'room')) {
      const booking = economy.bookings.find((x) => x.hotel === b);
      const room = info.sells.find((o) => o.effect.type === 'room');
      if (booking) options.push({ label: `Check out of room ${booking.room.number}`, run: () => economy.checkOut(npc, b).message });
      else options.push({ label: `Rent a room (${price(room)} a night)`, run: () => economy.rentRoom(npc, b).message });
      for (const o of info.sells.filter((s) => s.effect.type !== 'room')) options.push({ label: `${o.name} (${price(o)})`, run: () => economy.sell(npc, b, o.name).message });
    } else {
      for (const o of info.sells) options.push({ label: `${o.name} (${price(o)})`, run: () => economy.sell(npc, b, o.name).message });
      if (b === 'LIBRARY') options.push({ label: 'Bring back my book', run: () => economy.returnBook(npc).message });
    }
  } else if (npc.kind === 'worker') {
    const [open, close] = SERVICES[b].hours;
    options.push({ label: `Is the ${lower(b)} open?`, run: () => (open === 0 && close === 24 ? `The ${lower(b)} never closes, but I'm off work right now.` : `We're open from ${timeText(open * 60)} to ${timeText(close * 60)}. Come see me at the counter!`) });
  }
  if (npc.isManager && JOBS[b]) {
    if (!job.current) options.push({ label: `Can I work here? (${lower(JOBS[b].title)}, ${JOBS[b].pay} silver per task)`, run: () => startJob(npc).message });
    else if (job.current.building === b) {
      options.push({ label: 'I finished my work! Can I get paid?', run: () => finishJob(npc).message });
      options.push({ label: 'I want to quit this job', run: () => quitJob().message });
    }
  }
  if (npc.kind === 'helper') {
    options.push({ label: 'What are you working on?', run: () => `I'm a ${lower(npc.role)} for the ${lower(b)}. If you want to do this job too, ask the manager there for work!` });
  }
  if (npc.kind === 'citizen') options.push({ label: 'Any tips for me?', run: () => randomTip() });
  return options;
}

function showTalk(npc, said) {
  talkPanel.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = npc.name;
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = npc.kind === 'citizen' ? 'Citizen' : `${npc.role}${npc.isManager ? ' (manager)' : ''} · ${npc.workplace.toLowerCase()}`;
  const say = document.createElement('div');
  say.className = 'say';
  say.textContent = said;
  const list = document.createElement('div');
  list.className = 'options';
  for (const option of talkOptions(npc)) list.append(button(option.label, () => showTalk(npc, option.run())));
  list.append(button('Goodbye', () => closeUI(true), 'leave'));
  talkPanel.append(h, who, say, list);
}

export function openTalk(npc, close) {
  ui.open = true;
  onClose = close;
  talkingTo = npc;
  npc.talking = true;
  const greetings = ['Hi there!', 'Oh, hello!', 'Greetings, traveler!', 'Hey! You must be the astronaut.'];
  showTalk(npc, greetings[Math.floor(Math.random() * greetings.length)]);
  talkPanel.style.display = 'block';
}

// ---------- Bag ----------

function showBag(said = '') {
  bagPanel.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = 'Your bag';
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = `Wallet: ${economy.priceText(wallet)} · In the bank: ${economy.priceText(economy.bankAccount)}`;
  const say = document.createElement('div');
  say.className = 'say';
  say.textContent = said || (economy.inventory.length ? 'Click to eat, drink or read.' : 'Your bag is empty. Buy things from the aliens in town!');
  bagPanel.append(h, who, say);
  economy.inventory.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'item';
    const name = document.createElement('span');
    name.textContent = item.kind === 'book' ? `📖 ${item.title}${item.borrowed ? ` (library book, due day ${item.dueDay})` : ''}` : item.name;
    row.append(name);
    const verb = { food: 'Eat', drink: 'Drink', book: 'Read' }[item.kind];
    if (verb) row.append(button(verb, () => showBag(economy.useItem(i).message)));
    bagPanel.append(row);
  });
  for (const b of economy.bookings) {
    const row = document.createElement('div');
    row.className = 'item';
    row.textContent = `🛏 Room ${b.room.number} at the ${lower(b.hotel)} (${economy.priceText(b.price)} every night at 9 PM)`;
    bagPanel.append(row);
  }
  const close = document.createElement('div');
  close.className = 'options';
  close.style.marginTop = '12px';
  close.append(button('Close bag', () => closeUI(true), 'leave'));
  bagPanel.append(close);
}

export function openBag(close) {
  ui.open = true;
  onClose = close;
  showBag();
  bagPanel.style.display = 'block';
}

export function closeUI(resume) {
  if (!ui.open) return;
  ui.open = false;
  talkPanel.style.display = 'none';
  bagPanel.style.display = 'none';
  if (talkingTo) talkingTo.talking = false;
  talkingTo = null;
  onClose?.(resume);
}

// ---------- Prompt and job checklist ----------

export function setPrompt(text) {
  promptEl.innerHTML = text;
  promptEl.style.display = text && !ui.open ? 'block' : 'none';
}

let shownJob = '';
export function updateJobPanel() {
  const j = job.current;
  const key = j ? `${j.title}|${j.tasks.map((t) => t.done).join()}` : '';
  if (key === shownJob) return;
  shownJob = key;
  jobsEl.style.display = j ? 'block' : 'none';
  if (!j) return;
  jobsEl.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = `Job: ${j.title} (${lower(j.building)})`;
  jobsEl.append(h);
  for (const t of j.tasks) {
    const line = document.createElement('div');
    line.textContent = `${t.done ? '✔' : '◆'} ${t.label}`;
    if (t.done) line.className = 'done';
    jobsEl.append(line);
  }
  if (j.tasks.every((t) => t.done)) {
    const back = document.createElement('div');
    back.textContent = `→ Go back to ${j.manager} to get paid!`;
    back.style.color = '#ffd166';
    jobsEl.append(back);
  }
}

