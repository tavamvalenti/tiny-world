// Default names for new players: prank-call puns (say them out loud), lower case, with two digits on the end, like
// chrispbacon07 or anitabath42. Cheeky but clean, since everyone gets one automatically and they show on the public
// boards. Names are unique: one that's already taken is simply re-rolled.
const PUNS = [
  'anitabath', 'chrispbacon', 'earlebird', 'dinahmite', 'barbdwyer', 'justinkase', 'warrenpeace', 'amandahugginkiss',
  'seymourbutz', 'ipfreely', 'hughjass', 'hughmungus', 'ivanatinkle', 'ollieoxenfree', 'pattyofurniture', 'carrieoakie',
  'alpacalunch', 'bennydrill', 'jimnasium', 'sandybeach', 'robinbanks', 'annamossity', 'terrybull', 'candicecane',
  'paulbearer', 'chuckwagon', 'dustinbinn', 'lounatic', 'hammondeggs', 'noahfence', 'standupp', 'dwaynepipe',
  'aligator', 'jackpott', 'crystalball', 'hazelnutt', 'monalott', 'waltermelon', 'sueflay', 'willpower', 'rockyroad',
  'kennydewitt', 'reidabook', 'maxpower', 'russellsprout', 'salmonella', 'jerryatrick', 'mattress', 'duncandonuts',
  'lessismore', 'pollyester', 'ottomobile', 'paigeturner', 'dandruff', 'shirleyknot', 'ellavator', 'barrycuda',
  'rhodaboat', 'franknstein', 'aldente', 'emmagrate', 'philharmonic', 'timburr', 'raygunn', 'teddybare', 'sallymander',
  'cliffhangr', 'bobsledd', 'frankfurtr', 'tiramissu', 'artmajor', 'pennywize', 'woodyforrest', 'beaminor', 'mikerophone',
  'gailforce', 'stormyweather', 'lettuceturnip', 'oliveoyl', 'perrywinkle', 'abbytoir', 'claudiahands', 'buckybeaver',
];
export function funnyName() {
  const r = new Uint32Array(2);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(r); else { r[0] = Math.random() * 1e9; r[1] = Math.random() * 1e9; }
  return `${PUNS[r[0] % PUNS.length]}${String(r[1] % 100).padStart(2, '0')}`;
}
// a name the game gave out (the old Player-1234 kind too), as opposed to one the player chose
export const isAutoName = (n) => /^Player-\d{3,6}$/.test(String(n || ''));
