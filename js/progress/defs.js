// What there is to earn. Only things the game can actually measure: every definition here is driven by a real
// gameplay event reported to js/progress/core.js (blocks destroyed, places reached, throws landed, boats sunk,
// vehicles flown, landmarks brought down...). Activities that don't exist yet (races, casino, taxi, boat races) get
// their records and challenges added here when they're built: see ACTIVITIES at the bottom.

// ---------- ranks: early ones come quickly, later ones take real play. Add more by appending. ----------
export const RANKS = [
  { name: 'Tourist', xp: 0 },
  { name: 'Menace', xp: 600 },
  { name: 'Stunt Driver', xp: 2500 },
  { name: 'Demolition Expert', xp: 7500 },
  { name: 'City Legend', xp: 20000 },
];

export const MAP_LABELS = { downtown: 'Gaslamp District', suburbs: 'Chicago', tropical: 'La Playa', vegas: 'Las Vegas', london: 'London', greenland: 'Sisimiut', cairo: 'Cairo' };
export const ALL_MAPS = Object.keys(MAP_LABELS);
export const TOOLS = ['hand', 'laser', 'bomb', 'wind', 'meteor'];
export const VEHICLES = ['rick', 'drone', 'chair', 'jetpack'];

// a world unit is about 2.3 m (a person is ~0.75 units tall)
export const M_PER_UNIT = 2.33;

// ---------- personal records (and which ones go on the global boards) ----------
// better: 'high' or 'low'; perMap: kept per map as well as overall; max: anything above is impossible and rejected
export const RECORDS = {
  destruction_event: { label: 'Biggest destruction event', unit: 'blocks', better: 'high', perMap: true, board: true, max: 60000, icon: 'boom' },
  rampage_60: { label: 'Most destruction in 60 seconds', unit: 'blocks', better: 'high', perMap: true, board: true, max: 60000, icon: 'fire' },
  car_throw: { label: 'Longest Free Hand car throw', unit: 'm', better: 'high', perMap: false, board: true, max: 900, icon: 'hand' },
  person_throw: { label: 'Longest Free Hand person throw', unit: 'm', better: 'high', perMap: false, board: true, max: 1200, icon: 'hand' },
  drone_kamikaze: { label: 'Most blocks destroyed by one drone crash', unit: 'blocks', better: 'high', perMap: false, board: true, max: 5000, icon: 'drone' },
  jetpack_fall: { label: 'Highest jetpack drop survived', unit: 'm', better: 'high', perMap: false, board: true, max: 80, icon: 'jet' },
  chair_altitude: { label: 'Highest balloon chair flight', unit: 'm', better: 'high', perMap: false, board: true, max: 260, icon: 'balloon' },
  // mini-games (js/activities/): each metric its own board, the right way round (times: lower is better)
  traffic_score90: { label: 'Highway Cut-Up: 90-second score', unit: 'pts', better: 'high', perMap: false, board: true, max: 5e6, icon: 'car', group: 'Highway Cut-Up' },
  traffic_distance: { label: 'Highway Cut-Up: survival distance', unit: 'm', better: 'high', perMap: false, board: true, max: 1e6, icon: 'car', group: 'Highway Cut-Up' },
  traffic_combo: { label: 'Highway Cut-Up: highest combo', unit: 'x', better: 'high', perMap: false, board: true, max: 5000, icon: 'car', group: 'Highway Cut-Up' },
  traffic_clean: { label: 'Highway Cut-Up: longest clean run', unit: 'm', better: 'high', perMap: false, board: true, max: 1e6, icon: 'car', group: 'Highway Cut-Up' },
  sled_time: { label: 'Snowmobile: fastest lap', unit: 's', better: 'low', perMap: false, board: true, min: 20, max: 900, icon: 'sled', group: 'Snowmobile' },
  sled_clean: { label: 'Snowmobile: fastest clean lap', unit: 's', better: 'low', perMap: false, board: true, min: 20, max: 900, icon: 'sled', group: 'Snowmobile' },
  sled_jump: { label: 'Snowmobile: longest jump', unit: 'm', better: 'high', perMap: false, board: true, max: 400, icon: 'sled', group: 'Snowmobile' },
  sled_stunt: { label: 'Snowmobile: highest stunt score', unit: 'pts', better: 'high', perMap: false, board: true, max: 2e6, icon: 'sled', group: 'Snowmobile' },
  casino_jackpot: { label: 'Casino: biggest single win', unit: 'credits', better: 'high', perMap: false, board: true, max: 1e7, icon: 'chip', group: 'Casino' },
  casino_session: { label: 'Casino: most won in the 50-spin challenge', unit: 'credits', better: 'high', perMap: false, board: true, max: 1e7, icon: 'chip', group: 'Casino' },
  casino_streak: { label: 'Casino: longest win streak', unit: 'wins', better: 'high', perMap: false, board: true, max: 200, icon: 'chip', group: 'Casino' },
  boats_session: { label: 'Boats sunk in one visit', unit: 'boats', better: 'high', perMap: true, board: false, max: 500, icon: 'boat' },
};

// ---------- achievements: id -> { name, desc, cat, xp, test(S) -> [have, need] } ----------
// S is the profile's stats. Each test returns progress so partial progress can be shown.
const tot = (o) => Object.values(o || {}).reduce((a, v) => a + (Array.isArray(v) ? v.length : v || 0), 0);
const cnt = (o) => Object.keys(o || {}).length;
export const ACHIEVEMENTS = [
  // destruction
  { id: 'first_crack', name: 'First Crack', desc: 'Destroy your first building block.', cat: 'Destruction', xp: 25, test: (S) => [S.cells, 1] },
  { id: 'wrecking_crew', name: 'Wrecking Crew', desc: 'Destroy 1,000 building blocks.', cat: 'Destruction', xp: 150, test: (S) => [S.cells, 1000] },
  { id: 'urban_renewal', name: 'Urban Renewal', desc: 'Destroy 25,000 building blocks.', cat: 'Destruction', xp: 600, test: (S) => [S.cells, 25000] },
  { id: 'hundred_million', name: 'Nine Figures', desc: 'Cause $100 million of property damage.', cat: 'Destruction', xp: 400, test: (S) => [S.damage, 100e6] },
  { id: 'billionaire', name: 'Billion-Dollar Menace', desc: 'Cause $1 billion of property damage.', cat: 'Destruction', xp: 1200, test: (S) => [S.damage, 1e9] },
  { id: 'chain_reaction', name: 'Chain Reaction', desc: 'Destroy 300 blocks in a single destruction event.', cat: 'Destruction', xp: 200, test: (S) => [S.best.destruction_event || 0, 300] },
  { id: 'catastrophe', name: 'Catastrophe', desc: 'Destroy 2,000 blocks in a single destruction event.', cat: 'Destruction', xp: 700, test: (S) => [S.best.destruction_event || 0, 2000] },
  { id: 'toolbox', name: 'Full Toolbox', desc: 'Use the Free Hand, Laser, Bomb, Wind and Meteor.', cat: 'Destruction', xp: 100, test: (S) => [cnt(S.tools), 5] },
  { id: 'landmark_hunter', name: 'Landmark Hunter', desc: 'Bring down 5 different landmarks.', cat: 'Destruction', xp: 300, test: (S) => [tot(S.landmarks), 5] },
  { id: 'skyline_eraser', name: 'Skyline Eraser', desc: 'Bring down 25 different landmarks.', cat: 'Destruction', xp: 900, test: (S) => [tot(S.landmarks), 25] },
  { id: 'shipwrecker', name: 'Shipwrecker', desc: 'Sink 10 boats.', cat: 'Destruction', xp: 150, test: (S) => [S.boats, 10] },
  { id: 'admiral', name: 'Scourge of the Seas', desc: 'Sink 100 boats.', cat: 'Destruction', xp: 500, test: (S) => [S.boats, 100] },
  // exploration
  { id: 'first_steps', name: 'Sightseer', desc: 'Discover 10 named places.', cat: 'Exploration', xp: 100, test: (S) => [tot(S.discovered), 10] },
  { id: 'explorer', name: 'Explorer', desc: 'Discover 60 named places.', cat: 'Exploration', xp: 400, test: (S) => [tot(S.discovered), 60] },
  { id: 'cartographer', name: 'Cartographer', desc: 'Discover every named place on one map.', cat: 'Exploration', xp: 300, test: (S) => [Object.keys(S.discovered || {}).some((m) => S.mapPlaces[m] && S.discovered[m].length >= S.mapPlaces[m]) ? 1 : 0, 1] },
  { id: 'globetrotter', name: 'Globetrotter', desc: 'Visit all seven cities.', cat: 'Exploration', xp: 350, test: (S) => [cnt(S.maps), ALL_MAPS.length] },
  // vehicles and stunts
  { id: 'wubba', name: 'Wubba Lubba', desc: "Fly Rick's ship.", cat: 'Vehicles', xp: 50, test: (S) => [S.vehicles.rick ? 1 : 0, 1] },
  { id: 'licensed', name: 'Licensed to Fly', desc: 'Fly the drone, the balloon chair and the jetpack.', cat: 'Vehicles', xp: 150, test: (S) => [['drone', 'chair', 'jetpack'].filter((k) => S.vehicles[k]).length, 3] },
  { id: 'kamikaze', name: 'Kamikaze', desc: 'Destroy 60 blocks with a single drone crash.', cat: 'Vehicles', xp: 200, test: (S) => [S.best.drone_kamikaze || 0, 60] },
  { id: 'up_up', name: 'Up, Up and Away', desc: 'Take the balloon chair above 150 m.', cat: 'Vehicles', xp: 150, test: (S) => [Math.round(S.best.chair_altitude || 0), 150] },
  { id: 'stuck_landing', name: 'Stuck the Landing', desc: 'Survive a jetpack drop of 20 m.', cat: 'Vehicles', xp: 150, test: (S) => [Math.round(S.best.jetpack_fall || 0), 20] },
  { id: 'splat', name: 'Gravity Always Wins', desc: 'Hit the ground too hard in the jetpack.', cat: 'Vehicles', xp: 40, test: (S) => [S.splats, 1] },
  { id: 'strongman', name: 'Strongman', desc: 'Throw a car 120 m with the Free Hand.', cat: 'Vehicles', xp: 200, test: (S) => [Math.round(S.best.car_throw || 0), 120] },
  { id: 'yeet', name: 'Long Distance Call', desc: 'Throw a person 150 m with the Free Hand.', cat: 'Vehicles', xp: 200, test: (S) => [Math.round(S.best.person_throw || 0), 150] },
  // mini-games
  { id: 'cutup_first', name: 'Merging Traffic', desc: 'Finish a Highway Cut-Up run.', cat: 'Mini-games', xp: 50, test: (S) => [((S.acts || {}).traffic || {}).runs || 0, 1] },
  { id: 'cutup_combo', name: 'Thread the Needle', desc: 'Build a x15 near-miss combo on the highway.', cat: 'Mini-games', xp: 200, test: (S) => [S.best.traffic_combo || 0, 15] },
  { id: 'cutup_score', name: 'Highway Star', desc: 'Score 40,000 in the 90-second Highway Cut-Up.', cat: 'Mini-games', xp: 300, test: (S) => [Math.round(S.best.traffic_score90 || 0), 40000] },
  { id: 'cutup_far', name: 'Long Haul', desc: 'Survive 10 km in endless Highway Cut-Up.', cat: 'Mini-games', xp: 300, test: (S) => [Math.round((S.best.traffic_distance || 0) / 1000), 10] },
  { id: 'cutup_misses', name: 'Close Shave', desc: 'Make 250 near misses on the highway.', cat: 'Mini-games', xp: 200, test: (S) => [Math.round((((S.acts || {}).traffic || {}).totals || {}).nearMisses || 0), 250] },
  { id: 'sled_first', name: 'Fresh Powder', desc: 'Finish a valid snowmobile lap.', cat: 'Mini-games', xp: 50, test: (S) => [Math.round((((S.acts || {}).sled || {}).totals || {}).laps || 0), 1] },
  { id: 'sled_big', name: 'Big Air', desc: 'Land a 40 m snowmobile jump.', cat: 'Mini-games', xp: 250, test: (S) => [Math.round(S.best.sled_jump || 0), 40] },
  { id: 'sled_clean', name: 'Clean Sheet', desc: 'Finish a snowmobile lap without a wipeout.', cat: 'Mini-games', xp: 150, test: (S) => [S.best.sled_clean ? 1 : 0, 1] },
  { id: 'sled_stunt', name: 'Stuntman', desc: 'Score 6,000 stunt points in one lap.', cat: 'Mini-games', xp: 300, test: (S) => [Math.round(S.best.sled_stunt || 0), 6000] },
  { id: 'sled_perfect', name: 'Stomped It', desc: 'Land 25 perfect snowmobile jumps.', cat: 'Mini-games', xp: 200, test: (S) => [Math.round((((S.acts || {}).sled || {}).totals || {}).perfects || 0), 25] },
  { id: 'casino_first', name: 'Feeling Lucky', desc: 'Spin a slot machine at Caesars Palace.', cat: 'Mini-games', xp: 25, test: (S) => [Math.round((((S.acts || {}).casino || {}).totals || {}).spins || 0), 1] },
  { id: 'casino_high', name: 'High Roller', desc: 'Win 5,000 credits on a single spin.', cat: 'Mini-games', xp: 300, test: (S) => [Math.round(S.best.casino_jackpot || 0), 5000] },
  { id: 'casino_streak', name: 'Hot Streak', desc: 'Win 5 spins in a row.', cat: 'Mini-games', xp: 150, test: (S) => [Math.round(S.best.casino_streak || 0), 5] },
  { id: 'casino_jp', name: 'JACKPOT!', desc: "Hit the Dragon's Hoard progressive jackpot.", cat: 'Mini-games', xp: 500, test: (S) => [Math.round((((S.acts || {}).casino || {}).totals || {}).jackpots || 0), 1] },
  { id: 'casino_regular', name: 'Regular', desc: 'Spin 1,000 times.', cat: 'Mini-games', xp: 200, test: (S) => [Math.round((((S.acts || {}).casino || {}).totals || {}).spins || 0), 1000] },
  // landmarks with their own events
  { id: 'eye_down', name: 'Eye Sore', desc: 'Topple the London Eye.', cat: 'Landmarks', xp: 300, test: (S) => [S.events.london_eye || 0, 1] },
  { id: 'big_ben', name: 'Time Out', desc: "Bring down Big Ben.", cat: 'Landmarks', xp: 250, test: (S) => [(S.landmarks.london || []).includes('Big Ben') ? 1 : 0, 1] },
  { id: 'pyramid', name: 'Four Thousand Years', desc: 'Bring down the Great Pyramid.', cat: 'Landmarks', xp: 300, test: (S) => [(S.landmarks.cairo || []).includes('the Great Pyramid') ? 1 : 0, 1] },
  { id: 'icebreaker', name: 'Icebreaker', desc: 'Break up 3 icebergs off Sisimiut.', cat: 'Landmarks', xp: 200, test: (S) => [S.events.iceberg || 0, 3] },
  // milestones
  { id: 'rank_menace', name: 'Menace', desc: 'Reach the rank of Menace.', cat: 'Milestones', xp: 0, test: (S, P) => [P.rankIndex, 1] },
  { id: 'rank_stunt', name: 'Stunt Driver', desc: 'Reach the rank of Stunt Driver.', cat: 'Milestones', xp: 0, test: (S, P) => [P.rankIndex, 2] },
  { id: 'rank_demo', name: 'Demolition Expert', desc: 'Reach the rank of Demolition Expert.', cat: 'Milestones', xp: 0, test: (S, P) => [P.rankIndex, 3] },
  { id: 'rank_legend', name: 'City Legend', desc: 'Reach the rank of City Legend.', cat: 'Milestones', xp: 0, test: (S, P) => [P.rankIndex, 4] },
  { id: 'xp_50k', name: 'Lifer', desc: 'Earn 50,000 XP in total.', cat: 'Milestones', xp: 0, test: (S, P) => [P.xp, 50000] },
  { id: 'collector', name: 'Collector', desc: 'Unlock 20 other achievements.', cat: 'Milestones', xp: 400, test: (S, P) => [P.unlockedCount, 20] },
  { id: 'records_4maps', name: 'World Record Tour', desc: 'Set a record on four different maps.', cat: 'Milestones', xp: 400, test: (S) => [cnt(S.recordMaps), 4] },
  { id: 'challenger', name: 'Challenger', desc: 'Complete 10 daily or weekly challenges.', cat: 'Milestones', xp: 300, test: (S) => [S.challengesDone, 10] },
];

// ---------- map challenges (one-time; each map has its own) ----------
// Each: { id, map, name, desc, xp, test(S, ctx) -> [have, need] }. ctx.places / ctx.landmarks: counts on that map.
const MC = (map, list) => list.map((c) => ({ map, ...c, id: `${map}_${c.id}` }));
const disc = (map) => (S) => (S.discovered[map] || []).length;
const lmk = (map) => (S) => (S.landmarks[map] || []).length;
const md = (map, k) => (S) => (S.mapStats[map] || {})[k] || 0;
const common = (map, label) => [
  { id: 'explore', name: `See all of ${label}`, desc: `Discover every named place in ${label}.`, xp: 300, test: (S) => [disc(map)(S), S.mapPlaces[map] || 99] },
  { id: 'wreck', name: `${label} Wrecker`, desc: `Destroy 2,000 blocks in ${label}.`, xp: 250, test: (S) => [md(map, 'cells')(S), 2000] },
  { id: 'landmarks', name: `Tourist Trap`, desc: `Bring down 3 landmarks in ${label}.`, xp: 300, test: (S) => [lmk(map)(S), 3] },
];
export const MAP_CHALLENGES = [
  ...MC('downtown', [...common('downtown', 'the Gaslamp'), { id: 'harbor', name: 'Harbour Patrol', desc: 'Sink 5 boats in San Diego Bay.', xp: 200, test: (S) => [md('downtown', 'boats')(S), 5] }]),
  ...MC('suburbs', [...common('suburbs', 'Chicago'), { id: 'throw', name: 'Windy City', desc: 'Throw a car 40 m with the Free Hand in Chicago.', xp: 200, test: (S) => [Math.round(md('suburbs', 'carThrow')(S)), 40] }]),
  ...MC('tropical', [...common('tropical', 'La Playa'), { id: 'fleet', name: 'Gone Fishing', desc: 'Sink 8 boats off La Playa.', xp: 200, test: (S) => [md('tropical', 'boats')(S), 8] }]),
  ...MC('vegas', [...common('vegas', 'Las Vegas'), { id: 'strip', name: 'House Always Loses', desc: 'Destroy 5,000 blocks on the Strip.', xp: 350, test: (S) => [md('vegas', 'cells')(S), 5000] }]),
  ...MC('london', [...common('london', 'London'), { id: 'eye', name: 'Wheel of Misfortune', desc: 'Topple the London Eye.', xp: 400, test: (S) => [S.events.london_eye || 0, 1] }, { id: 'thames', name: 'Thames Clearance', desc: 'Sink 8 boats on the Thames.', xp: 250, test: (S) => [md('london', 'boats')(S), 8] }]),
  ...MC('greenland', [...common('greenland', 'Sisimiut'), { id: 'bergs', name: 'Icebreaker', desc: 'Break up 3 icebergs.', xp: 300, test: (S) => [S.events.iceberg || 0, 3] }]),
  ...MC('cairo', [...common('cairo', 'Cairo'), { id: 'pyramid', name: 'Pharaoh\'s Curse', desc: 'Bring down the Great Pyramid.', xp: 450, test: (S) => [(S.landmarks.cairo || []).includes('the Great Pyramid') ? 1 : 0, 1] }, { id: 'nile', name: 'Nile Fleet', desc: 'Sink 10 boats on the Nile.', xp: 250, test: (S) => [md('cairo', 'boats')(S), 10] }]),
];

// ---------- daily and weekly challenges: templates; the period's set is picked from these by date ----------
// Each counts a period counter (core.js keeps them per day / week): key, target, xp.
export const DAILY_POOL = [
  { id: 'd_cells', name: 'Daily Demolition', desc: 'Destroy 600 building blocks.', key: 'cells', target: 600, xp: 150 },
  { id: 'd_bigevent', name: 'Make It Big', desc: 'Destroy 150 blocks in a single destruction event.', key: 'bigEvent150', target: 1, xp: 180 },
  { id: 'd_discover', name: 'New Places', desc: 'Discover 3 places you haven\'t been before.', key: 'discover', target: 3, xp: 150, needsUndiscovered: 3 },
  { id: 'd_boats', name: 'Man Overboard', desc: 'Sink 3 boats.', key: 'boats', target: 3, xp: 150 },
  { id: 'd_throw', name: 'Toss It', desc: 'Throw a car 25 m with the Free Hand.', key: 'carThrow25', target: 1, xp: 150 },
  { id: 'd_vehicles', name: 'Joyride', desc: 'Fly two different vehicles (Rick\'s ship counts).', key: 'vehicles', target: 2, xp: 150 },
  { id: 'd_landmark', name: 'Tear It Down', desc: 'Bring down a landmark.', key: 'landmarks', target: 1, xp: 200 },
  { id: 'd_record', name: 'Personal Best', desc: 'Beat one of your own records.', key: 'records', target: 1, xp: 200 },
  { id: 'd_minigame', name: 'Game On', desc: 'Finish 3 mini-game runs.', key: 'actRuns', target: 3, xp: 150 },
  { id: 'd_medal', name: 'On the Podium', desc: 'Win a medal in a mini-game.', key: 'medals', target: 1, xp: 200 },
  { id: 'd_tools', name: 'Mix It Up', desc: 'Use three different tools.', key: 'tools', target: 3, xp: 120 },
];
export const WEEKLY_POOL = [
  { id: 'w_maps', name: 'World Tour', desc: 'Play on 4 different maps this week.', key: 'maps', target: 4, xp: 800 },
  { id: 'w_cells', name: 'Week of Ruin', desc: 'Destroy 8,000 building blocks.', key: 'cells', target: 8000, xp: 900 },
  { id: 'w_landmarks', name: 'Landmark Week', desc: 'Bring down 5 landmarks.', key: 'landmarks', target: 5, xp: 900 },
  { id: 'w_records', name: 'Record Breaker', desc: 'Beat your own records 4 times.', key: 'records', target: 4, xp: 800 },
  { id: 'w_boats', name: 'Naval Warfare', desc: 'Sink 20 boats.', key: 'boats', target: 20, xp: 700 },
  { id: 'w_dailies', name: 'Regular', desc: 'Complete 5 daily challenges.', key: 'dailies', target: 5, xp: 900 },
  { id: 'w_gold', name: 'Gold Standard', desc: 'Win 3 gold medals in mini-games.', key: 'golds', target: 3, xp: 900 },
  { id: 'w_discover', name: 'Off the Map', desc: 'Discover 12 new places.', key: 'discover', target: 12, xp: 800, needsUndiscovered: 12 },
];

// ---------- rewards: what each unlock gives, and how it's earned ----------
// slot: where it equips. how: { rank: i } | { ach: id } | { mapc: id }
export const REWARDS = [
  // titles
  { id: 't_tourist', slot: 'title', label: 'Tourist', how: { rank: 0 } },
  { id: 't_menace', slot: 'title', label: 'Menace', how: { rank: 1 } },
  { id: 't_stunt', slot: 'title', label: 'Stunt Driver', how: { rank: 2 } },
  { id: 't_demo', slot: 'title', label: 'Demolition Expert', how: { rank: 3 } },
  { id: 't_legend', slot: 'title', label: 'City Legend', how: { rank: 4 } },
  { id: 't_explorer', slot: 'title', label: 'Explorer', how: { ach: 'explorer' } },
  { id: 't_record', slot: 'title', label: 'Record Holder', how: { ach: 'records_4maps' } },
  { id: 't_strong', slot: 'title', label: 'Stunt King', how: { ach: 'strongman' } },
  { id: 't_admiral', slot: 'title', label: 'Admiral of Destruction', how: { ach: 'admiral' } },
  { id: 't_pharaoh', slot: 'title', label: 'Tomb Raider', how: { mapc: 'cairo_pyramid' } },
  { id: 't_eye', slot: 'title', label: 'Wheel Breaker', how: { mapc: 'london_eye' } },
  // vehicle paint: the drone's body, the jetpack's tanks, the balloon chair's balloons
  { id: 'p_drone_black', slot: 'drone_paint', label: 'Matte Black', value: 0x141518, how: { rank: 0 } },
  { id: 'p_drone_desert', slot: 'drone_paint', label: 'Desert Tan', value: 0x9a845e, how: { rank: 1 } },
  { id: 'p_drone_arctic', slot: 'drone_paint', label: 'Arctic White', value: 0xe8ecee, how: { mapc: 'greenland_bergs' } },
  { id: 'p_drone_red', slot: 'drone_paint', label: 'Racing Red', value: 0xb3141c, how: { ach: 'kamikaze' } },
  { id: 'p_drone_gold', slot: 'drone_paint', label: 'Gold', value: 0xd4a83a, how: { rank: 4 } },
  { id: 'p_jet_red', slot: 'jetpack_paint', label: 'Rocket Red', value: 0xd8262a, how: { rank: 0 } },
  { id: 'p_jet_cobalt', slot: 'jetpack_paint', label: 'Cobalt', value: 0x1f4fa8, how: { rank: 2 } },
  { id: 'p_jet_chrome', slot: 'jetpack_paint', label: 'Chrome', value: 0xc8ccd2, how: { ach: 'stuck_landing' } },
  { id: 'p_jet_gold', slot: 'jetpack_paint', label: 'Gold', value: 0xd4a83a, how: { rank: 4 } },
  { id: 'p_bal_party', slot: 'chair_balloons', label: 'Party Mix', value: 'party', how: { rank: 0 } },
  { id: 'p_bal_pastel', slot: 'chair_balloons', label: 'Pastel', value: 'pastel', how: { ach: 'up_up' } },
  { id: 'p_bal_mono', slot: 'chair_balloons', label: 'Black & Gold', value: 'blackgold', how: { rank: 3 } },
  { id: 'p_bal_flag', slot: 'chair_balloons', label: 'Red, White & Blue', value: 'flag', how: { ach: 'globetrotter' } },
  // badges (shown on the profile card)
  { id: 'b_destroyer', slot: 'badge', label: 'Wrecking Crew', icon: 'boom', how: { ach: 'wrecking_crew' } },
  { id: 'b_globe', slot: 'badge', label: 'Globetrotter', icon: 'globe', how: { ach: 'globetrotter' } },
  { id: 'b_ship', slot: 'badge', label: 'Shipwrecker', icon: 'boat', how: { ach: 'shipwrecker' } },
  { id: 'b_landmark', slot: 'badge', label: 'Landmark Hunter', icon: 'tower', how: { ach: 'landmark_hunter' } },
  { id: 'b_pilot', slot: 'badge', label: 'Licensed to Fly', icon: 'drone', how: { ach: 'licensed' } },
  { id: 'b_chain', slot: 'badge', label: 'Chain Reaction', icon: 'fire', how: { ach: 'chain_reaction' } },
  { id: 'b_legend', slot: 'badge', label: 'City Legend', icon: 'crown', how: { rank: 4 } },
];
export const BALLOON_PALETTES = {
  party: [0xe8342a, 0x2a7ae8, 0x2ac85a, 0xf2c21a, 0xe83a9a, 0x8a4ae8, 0xf2802a, 0x2ac8c8, 0xffffff, 0x9ae82a],
  pastel: [0xf4b6c2, 0xb6d8f4, 0xc8f4c0, 0xf8e8a8, 0xdcc8f4, 0xf8d0b0],
  blackgold: [0x141414, 0x2a2a2a, 0xd4a83a, 0xe8c45a],
  flag: [0xc8102e, 0xffffff, 0x0a3d91],
};

// ---------- activities that aren't built yet: their records and challenges plug in here when they are ----------
// e.g. { id: 'chicago_race', map: 'suburbs', record: { label: 'Fastest Chicago street race', unit: 's', better: 'low', min: 20, max: 900 } }
export const ACTIVITIES = [];
