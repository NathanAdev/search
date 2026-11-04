// Roblox pitch categories and the expert claude who sits in the crowd for each one.
// When a pitch matches a category, its expert takes the expert seat (row 2, centre) and asks the questions
// someone who knows that format would ask. Facts here are general format knowledge, not claims about specific games.

const q = (topic, text, keywords, pushback, hint) => ({ topic, text, keywords, pushback, hint });

export const CATEGORIES = {
  steal: {
    label: 'Steal-a', match: [/\b(?:steal|throw|kick|launch|yeet|snatch|carry|rob|hook|swap|dig|juggle|tow|sneak|bowl|roll)\s+(?:a|an|the)\s+\w+/i, /\bsteal\w*\b/i, /\bbrainrots?\b/i],
    expert: { name: 'Pip', title: 'Steal-a expert', color: '#ff8a3d', hat: 'cap' },
    primer: 'Steal-a games: buy units off a conveyor or spawn, they earn cash per second in your base, other players run in and carry them away, you lock your base on a timer and steal back. Retextures ("throw an egg", "kick an egg") keep that loop and change the verb or the item.',
    conventions: ['conveyor or shop of units with rarities', 'cash per second while the unit sits in your base', 'stealing by carrying a unit back to your own base', 'base lock / shield on a timer', 'rebirth for multipliers and more slots'],
    pitfalls: ['a pure reskin with nothing new about how stealing feels', 'new players getting stripped bare in their first minute', 'paid units that out-earn everything free'],
    money: ['lock-duration or extra-slot game passes', 'developer products for instant units or lock refresh', 'limited event units', 'server luck boosts'],
    twists: ['every stolen egg has to be thrown into your base, and you can miss', 'eggs you kick bounce off walls and other bases', 'stolen units fight back and run home on their own'],
    questions: [
      q('steal_verb', 'Steal-a is a crowded format. What does your verb change about how stealing FEELS? Throwing, kicking, carrying... what is the new skill?', ['throw', 'kick', 'launch', 'aim', 'bounce', 'catch', 'carry', 'skill', 'physics', 'miss', 'timing', 'instead', 'unlike'],
        'That is a texture swap, not a mechanic. What new decision does the player make mid-steal?', 'Tell Pip what the player has to aim, time, or risk that a normal Steal-a never asks of them.'),
      q('steal_defense', 'How do new players keep anything? What stops a level-50 from emptying a fresh base in their first minute?', ['lock', 'shield', 'timer', 'protect', 'defend', 'trap', 'cooldown', 'new player', 'safe', 'grace', 'matchmaking', 'rebirth'],
        'So the new kid gets robbed and leaves. Lock timer? Grace period? Traps?', 'Mention a starter shield or grace period plus a lock that new players can afford.'),
      q('steal_ladder', 'What is the rarity ladder, and what event keeps the conveyor exciting in week three?', ['rare', 'legendary', 'mythic', 'secret', 'event', 'limited', 'weekly', 'admin', 'rarity', 'spawn'],
        'No ladder, no reason to watch the conveyor. Name the tiers and one event.', 'Give tiers (common to secret) and one limited weekend event.'),
    ],
  },
  plusone: {
    label: '+1 every second', match: [/(?:^|\s)\+\s?1\b/, /\bplus one\b/i, /\bgrows?\s+(?:by\s+)?(?:\+\s?1|one)\b/i, /\blong arm\b/i],
    expert: { name: 'Tick', title: '+1 expert', color: '#9b7bff', hat: 'clock' },
    primer: '+1 games: a stat grows by one every second (speed, jump, arm length, size, float height). The level is built so the growing stat opens new routes; you win, rebirth, and the stat resets with a multiplier.',
    conventions: ['one stat that visibly grows every second', 'a course, escape or tower that the stat unlocks', 'wins counter and rebirth with multipliers', 'trails, pets or titles for wins'],
    pitfalls: ['the stat does not change HOW you play, only how fast', 'the whole game is beaten in two minutes', 'idle players win just by standing still'],
    money: ['2x or 3x stat-per-second game passes', 'developer products for instant +1000', 'auto-rebirth pass', 'cosmetic trails'],
    twists: ['the stat grows only while you move, so idlers stay small', 'your +1 stat is shared with your teammate', 'at max stat the level flips and becomes a downhill escape'],
    questions: [
      q('plus_stat', 'Which stat grows, and what can a player do at 500 that they could not do at 50? Give me two concrete routes it opens.', ['arm', 'reach', 'float', 'jump', 'speed', 'size', 'height', 'grab', 'route', 'unlock', 'wall', 'gap', 'shortcut', 'at'],
        'Faster is not new. Name a route that only opens because the stat grew.', 'Say what the growing stat lets them reach, grab or float over that they could not before.'),
      q('plus_length', 'What stops this from being a two-minute game? Where do the wins and rebirths keep pulling people?', ['rebirth', 'wins', 'multiplier', 'stage', 'world', 'zone', 'leaderboard', 'reset', 'prestige', 'harder'],
        'Then it ends in two minutes. Rebirths? New worlds? A leaderboard?', 'Explain the rebirth loop: win, reset with a multiplier, unlock the next zone.'),
      q('plus_idle', 'Can someone just AFK and win? If yes, why play?', ['afk', 'idle', 'move', 'active', 'only while', 'skill', 'obstacle', 'trap', 'reset', 'fall'],
        'So the AFK kid wins. Make the stat depend on doing something.', 'Say the stat only grows while moving or that falls cost progress.'),
    ],
  },
  grow: {
    label: 'Grow / farm', match: [/\bgrow a\b/i, /\b(?:garden|seeds?|plant|harvest|crops?|farm)\b/i],
    expert: { name: 'Sprout', title: 'Grow-game expert', color: '#7ccf5a', hat: 'leaf' },
    primer: 'Grow games: plant seeds that grow in real time (even offline), harvest and sell, buy rarer seeds; mutations and weather events make some harvests worth far more; trading and gifting drive the social side.',
    conventions: ['real-time growth that continues while away', 'seed shop that restocks on a timer', 'mutations from weather events', 'selling and upgrading the plot'],
    pitfalls: ['nothing to do while things grow', 'economy inflation from mutations', 'trading scams on younger players'],
    money: ['growth speed and sprinkler items', 'restock skips', 'rare seed packs from events', 'garden cosmetics'],
    twists: ['plants grow toward whoever waters them, so neighbours fight over sunlight', 'weather is voted by the server', 'your crops are alive and wander off at night'],
    questions: [
      q('grow_wait', 'What does the player DO while the plants grow? Waiting is not gameplay.', ['while', 'meanwhile', 'decorate', 'trade', 'quest', 'visit', 'water', 'protect', 'minigame', 'event', 'help'],
        'So they stare at dirt. Give them something during the wait.', 'Name the thing they do between harvests: watering, defending, visiting other gardens.'),
      q('grow_events', 'Which events or mutations make one harvest worth ten normal ones?', ['mutation', 'weather', 'rain', 'storm', 'event', 'golden', 'rare', 'moon', 'frozen', 'lightning'],
        'No events means no reason to log in at 6pm. Name one.', 'Say which weather event mutates crops and when it happens.'),
    ],
  },
  towerdefense: {
    label: 'Tower defense', match: [/\btower defen[cs]e\b/i, /\bunits?\b.*\b(?:summon|banner|wave)/i, /\bsummon\b/i],
    expert: { name: 'Bastion', title: 'TD expert', color: '#5fb4c9', hat: 'helmet' },
    primer: 'Tower defense: place units along a path to stop waves; units come from summons with rarities; maps, difficulty modes and limited banners keep the meta moving.',
    conventions: ['unit summons with rarity and banners', 'placement limits and upgrades', 'difficulty modes and challenges', 'co-op lobbies'],
    pitfalls: ['power creep that makes old units worthless', 'the meta solved in a day', 'summon odds players feel are unfair'],
    money: ['summon currency', 'unit slot passes', 'battle pass with units', 'auto-skip waves'],
    twists: ['the path is redrawn by the other team each wave', 'units are recruited from defeated enemies', 'one player is the waves'],
    questions: [
      q('td_meta', 'How do you stop the meta being solved in a day and old units being worthless next update?', ['balance', 'synergy', 'counter', 'map', 'modifier', 'rotation', 'rework', 'buff', 'nerf', 'traits', 'evolve'],
        'Then week two everyone runs the same five units. What changes the answer?', 'Mention map modifiers or unit traits that change the best team.'),
      q('td_odds', 'What are the summon odds and the pity? Players will ask.', ['odds', 'percent', '%', 'pity', 'guarantee', 'rate', 'shown', 'chance'],
        'Hidden odds burn trust. Show them and add pity.', 'Say you show the exact odds and guarantee a rare after N pulls.'),
    ],
  },
  obby: {
    label: 'Obby / tower', match: [/\bobby\b/i, /\btower of\b/i, /\bparkour\b/i, /\bdifficulty chart\b/i],
    expert: { name: 'Hop', title: 'Obby expert', color: '#ff6fae', hat: 'band' },
    primer: 'Obbies: stages of jumps and traps with checkpoints; difficulty charts and towers add rounds, timers and leaderboards.',
    conventions: ['checkpoints', 'skip-stage products', 'difficulty progression', 'trolls and secret areas'],
    pitfalls: ['players finish and never return', 'unfair invisible traps', 'mobile controls failing on precise jumps'],
    money: ['skip stage', 'gravity coil and speed coil passes', 'trails', 'VIP checkpoint'],
    twists: ['the course is rebuilt from where players died most', 'two players chained together', 'the server votes which stage gets harder'],
    questions: [q('obby_replay', 'Once someone beats the last stage, why do they come back?', ['new', 'weekly', 'rotate', 'timer', 'speedrun', 'leaderboard', 'random', 'daily', 'hard mode'],
      'Then it is a one-time game. Rotation? Speedrun boards?', 'Say the tower rotates or there are daily speedrun boards.')],
  },
  tycoon: {
    label: 'Tycoon', match: [/\btycoon\b/i],
    expert: { name: 'Ledger', title: 'Tycoon expert', color: '#e0b04a', hat: 'visor' },
    primer: 'Tycoons: claim a plot, buy droppers and upgrades with buttons, money flows in, build up to a finished base, rebirth.',
    conventions: ['buttons that build the base piece by piece', 'droppers and conveyors', 'rebirth', 'PvP or raiding sometimes'],
    pitfalls: ['identical button-walking for 20 minutes', 'nothing to do once built'],
    money: ['2x cash', 'auto-collect', 'VIP area', 'special droppers'],
    twists: ['the tycoon is a ship that sinks if over-built', 'customers are other real players', 'your base is built inside a rival\'s'],
    questions: [q('tycoon_end', 'What happens when the base is finished? Most tycoons die right there.', ['rebirth', 'expand', 'new floor', 'world', 'prestige', 'raid', 'defend', 'customers', 'event'],
      'So it ends when the last button is pressed. What is after that?', 'Say what rebirth or expansion unlocks after the last button.')],
  },
  horror: {
    label: 'Co-op horror', match: [/\bhorror\b/i, /\b(?:monster|entity|scary|haunted|jumpscare|ghost)s?\b/i],
    expert: { name: 'Hush', title: 'Horror expert', color: '#8c8fa8', hat: 'hood' },
    primer: 'Co-op horror: a small group moves through rooms or a map while entities hunt them; procedural layouts, hiding, light and sound cues, and runs that end in death or escape.',
    conventions: ['procedural rooms or randomised maps', 'entities with readable tells', 'revives and co-op roles', 'currency for items between runs'],
    pitfalls: ['jumpscares that stop working on run two', 'unreadable deaths that feel unfair', 'too scary for the audience it attracts'],
    money: ['revives', 'cosmetic lights and skins', 'item boosts', 'private servers for friend groups'],
    twists: ['one player secretly controls the monster', 'the house remembers what scared each player', 'the lights are powered by players pedalling'],
    questions: [q('horror_replay', 'Run two: why is it still scary once I know where the monster is?', ['random', 'procedural', 'different', 'learn', 'adapt', 'rooms', 'seed', 'variant', 'modifier'],
      'Then it is scary once. What changes per run?', 'Say the rooms or the monster behaviour change every run.'),
      q('horror_fair', 'How does a player know why they died?', ['sound', 'cue', 'tell', 'light', 'warning', 'flicker', 'hint', 'learn', 'replay'],
        'Unreadable deaths make people quit. What is the tell?', 'Name the sound or light cue before each entity.')],
  },
  survival: {
    label: 'Survival nights', match: [/\bnights?\b.*\bsurviv/i, /\bsurviv\w*\b/i, /\bcampfire\b/i, /\bforest\b/i],
    expert: { name: 'Ember', title: 'Survival expert', color: '#ff7a59', hat: 'beanie' },
    primer: 'Survival-night games: a group gathers by day and survives escalating nights; classes, crafting and base upgrades; runs reset.',
    conventions: ['day gather / night defend', 'classes with perks', 'escalating nights', 'shared campfire or base'],
    pitfalls: ['slow early nights', 'one carry player doing everything', 'a solo player in an empty server'],
    money: ['class unlocks', 'revive tokens', 'cosmetic campfires', 'run boosts'],
    twists: ['the base is a moving train', 'nights last as long as the slowest player stays awake', 'you survive by trading with the other camp'],
    questions: [q('survival_roles', 'Why does each player in the group matter, not just the best one?', ['class', 'role', 'perk', 'healer', 'builder', 'scout', 'each', 'team', 'together'],
      'So one carry wins and four people watch. Give everyone a job.', 'Name three classes and what each one does at night.')],
  },
  battlegrounds: {
    label: 'Battlegrounds', match: [/\bbattlegrounds?\b/i, /\bmoveset\b/i, /\bcombos?\b/i, /\bfighting\b/i, /\bpvp\b/i],
    expert: { name: 'Combo', title: 'Fighting expert', color: '#e85a5a', hat: 'band' },
    primer: 'Battlegrounds: free-for-all arenas with character movesets, combos, ultimates and ranked or kill-streak goals.',
    conventions: ['movesets with 4 moves and an ultimate', 'combos and counters', 'kill streaks', 'emotes'],
    pitfalls: ['new players farmed by veterans', 'one overpowered character', 'ping and hit detection on Roblox'],
    money: ['character unlocks', 'emotes and kill effects', 'private servers', 'battle pass'],
    twists: ['moves are drawn as gestures', 'the arena shrinks around the current leader', 'you fight with props stolen from the map'],
    questions: [q('fight_newbie', 'What keeps a brand-new player from being farmed and quitting in two minutes?', ['matchmaking', 'skill', 'new player', 'protection', 'spawn', 'bounty', 'shield', 'tutorial', 'bots', 'servers'],
      'Then veterans eat them alive. Matchmaking? Bounties on top players?', 'Mention spawn protection plus bounties on high-streak players.')],
  },
  roleplay: {
    label: 'Roleplay town', match: [/\broleplay\b/i, /\brp\b/i, /\btown\b/i, /\b(?:houses?|family|school|hospital)\b.*\b(?:role|play)/i],
    expert: { name: 'Neighbor', title: 'Roleplay expert', color: '#5ab6f0', hat: 'cap' },
    primer: 'Roleplay towns: a shared map with houses, jobs, vehicles and props; players make their own stories; updates add places and items.',
    conventions: ['houses and vehicles', 'jobs and props', 'name tags and roles', 'regular map updates'],
    pitfalls: ['dead in an empty server', 'nothing to do without imagination', 'moderation of chat and behaviour'],
    money: ['premium houses', 'vehicles', 'roles and passes', 'private servers'],
    twists: ['every player has a secret job', 'the town changes era every week', 'the town is a cruise ship docking at events'],
    questions: [q('rp_spark', 'What gives a quiet server a story to play? Roleplay needs a spark.', ['event', 'job', 'quest', 'mystery', 'role', 'prompt', 'story', 'secret', 'npc', 'news'],
      'Then the server sits there. What starts the stories?', 'Say what event or role prompt kicks off stories every few minutes.')],
  },
  dressup: {
    label: 'Dress-up / fashion', match: [/\bdress(?:-| )?up\b/i, /\boutfits?\b/i, /\brunway\b/i, /\bfashion\b/i],
    expert: { name: 'Vogue', title: 'Fashion expert', color: '#f07ad6', hat: 'bow' },
    primer: 'Dress-up rounds: get a theme, build an outfit against a timer, walk the runway, others vote; levels unlock items.',
    conventions: ['theme, timer, runway, vote', 'item unlocks by level', 'poses and walks'],
    pitfalls: ['vote trolling', 'the same themes repeating', 'too few items early'],
    money: ['VIP items', 'extra outfit slots', 'poses and walks', 'themed packs'],
    twists: ['outfits must also survive an obstacle run', 'the theme is chosen by the losing player', 'clothes are stolen from other players'],
    questions: [q('dress_vote', 'How do you stop vote trolls from ruining a good outfit?', ['weight', 'anti', 'fair', 'judge', 'report', 'average', 'remove', 'reputation', 'stars'],
      'Then trolls decide every round. Weighting? Judges?', 'Say votes are weighted by reputation and outliers are dropped.')],
  },
  pets: {
    label: 'Pets / hatching', match: [/\bpets?\b/i, /\bhatch\w*\b/i, /\beggs?\b.*\b(?:open|hatch)/i],
    expert: { name: 'Paws', title: 'Pet expert', color: '#ffb36b', hat: 'ears' },
    primer: 'Pet games: hatch eggs for pets with rarities, equip them for multipliers, fuse or upgrade, trade.',
    conventions: ['eggs with rarities', 'equip slots', 'fusing / golden / rainbow tiers', 'trading'],
    pitfalls: ['trade scams', 'odds disclosure', 'power creep each egg'],
    money: ['luck and auto-hatch passes', 'extra equip slots', 'exclusive eggs'],
    twists: ['pets age and retire', 'fused pets get names players invent', 'pets can be stolen at night'],
    questions: [q('pets_trade', 'If pets trade, how do you protect younger players from scams?', ['trade', 'confirm', 'window', 'value', 'history', 'lock', 'cooldown', 'safe', 'accept'],
      'So the scammers win. Two-step confirm? Value display?', 'Say trades show values and need a two-step confirm.')],
  },
  social: {
    label: 'Social deduction', match: [/\bmurder(?:er)?\b/i, /\bsheriff\b/i, /\bimpost[eo]r\b/i, /\btraitor\b/i, /\bmystery\b/i, /\bsocial deduction\b/i, /\bhidden roles?\b/i],
    expert: { name: 'Sleuth', title: 'Deduction expert', color: '#b0a0ff', hat: 'detective' },
    primer: 'Social deduction: hidden roles (murderer, sheriff, innocents), short rounds, clues and accusations.',
    conventions: ['hidden roles', 'short rounds', 'knife and gun skins', 'role chance'],
    pitfalls: ['griefers and teamers', 'rounds decided in 5 seconds', 'small servers'],
    money: ['weapon skins', 'role chance boosts (careful)', 'emotes'],
    twists: ['roles swap mid-round', 'the murderer is the map itself', 'clues are other players\' footprints'],
    questions: [q('deduce_clues', 'What clues let innocents actually deduce, instead of guessing?', ['clue', 'footprint', 'evidence', 'sound', 'task', 'alibi', 'vote', 'meeting'],
      'Then it is random. What does a smart player notice?', 'Name two clues a sharp player can read.')],
  },
  escape: {
    label: 'Escape / prison', match: [/\bescape\b/i, /\bprison\b/i, /\bjail\b/i, /\bbreak out\b/i],
    expert: { name: 'Warden', title: 'Escape expert', color: '#9db0c4', hat: 'cap' },
    primer: 'Escape games: get out of a prison, room or place; routes, puzzles, guards or chasers; often combined with +1 or obby mechanics.',
    conventions: ['several escape routes', 'guards or a chaser', 'timer or rounds', 'secret exits'],
    pitfalls: ['one route everyone learns', 'puzzles that need a guide'],
    money: ['tools and keycards', 'skip doors', 'cosmetic jumpsuits'],
    twists: ['the prison floats and you escape by sinking it', 'guards are players from the last round', 'the exit moves each round'],
    questions: [q('escape_routes', 'How many ways out are there, and what changes between rounds?', ['route', 'routes', 'ways', 'exit', 'random', 'rotate', 'secret', 'different', 'each round'],
      'One route gets solved and posted in an hour. Variety?', 'Say there are several routes and the open one changes each round.')],
  },
  party: {
    label: 'Party / minigames', match: [/\bminigames?\b/i, /\bparty game\b/i, /\b(?:don'?t|do not) press\b/i, /\brandom event\b/i],
    expert: { name: 'Confetti', title: 'Party expert', color: '#ffd166', hat: 'party' },
    primer: 'Party games: quick rounds with random events or minigames, eliminations and wins, voting on the next round.',
    conventions: ['short rounds', 'voting', 'win streaks', 'chaos events'],
    pitfalls: ['too few minigames', 'long lobbies', 'unfair random deaths'],
    money: ['round votes', 'win effects', 'VIP servers'],
    twists: ['the losers design the next round', 'each round is a different genre', 'the floor is a board game'],
    questions: [q('party_variety', 'How many rounds at launch, and how do you keep adding them?', ['rounds', 'minigames', 'weekly', 'add', 'update', 'community', 'random', 'modifier', 'combo'],
      'Ten rounds get old in an evening. How do you grow the pool?', 'Give a launch count and a weekly new round or modifiers.')],
  },
  find: {
    label: 'Find the ___', match: [/\bfind the\b/i, /\bhidden\b.*\b(?:badges?|markers?)\b/i, /\bcollect all\b/i],
    expert: { name: 'Finder', title: 'Find-the expert', color: '#6fd3a8', hat: 'magnifier' },
    primer: 'Find-the games: hundreds of hidden collectables (markers, badges, characters) placed across maps with clues and difficulty tiers.',
    conventions: ['hundreds of finds', 'difficulty tiers', 'hint system', 'regular new finds'],
    pitfalls: ['finds that require a guide video', 'stale once complete'],
    money: ['hint tokens', 'radar pass', 'cosmetic finds'],
    twists: ['finds move when someone else finds them', 'finds are hidden by other players', 'every find unlocks a new ability for finding the next'],
    questions: [q('find_hints', 'How does someone stuck on find 47 get unstuck without leaving to watch a video?', ['hint', 'clue', 'radar', 'riddle', 'tier', 'warmer', 'map', 'compass'],
      'Then they leave for YouTube. In-game hints?', 'Describe the hint or radar system.')],
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);
export const expertId = (cat) => `expert:${cat}`;
export const isExpert = (id) => typeof id === 'string' && id.startsWith('expert:');
export const categoryOfExpert = (id) => (isExpert(id) ? id.slice(7) : null);

// Ordered by how strongly they match; the first is the pitch's main category.
// Named formats are more telling than broad words like "escape" or "survive".
const WEIGHT = { plusone: 3, steal: 3, tycoon: 3, obby: 2, grow: 2, towerdefense: 2, horror: 2, dressup: 2, social: 2, find: 2 };
export function detectCategories(text) {
  const t = String(text);
  const scored = [];
  for (const [id, c] of Object.entries(CATEGORIES)) {
    const n = c.match.reduce((s, re) => s + (re.test(t) ? 1 : 0), 0) * (WEIGHT[id] || 1);
    if (n) scored.push({ id, n });
  }
  // Specific formats beat broad ones when both match (a "+1 prison escape" is a +1 game first).
  const priority = ['plusone', 'steal', 'grow', 'towerdefense', 'dressup', 'social', 'find', 'battlegrounds', 'tycoon', 'horror', 'survival', 'escape', 'pets', 'obby', 'roleplay', 'party'];
  return scored.sort((a, b) => b.n - a.n || priority.indexOf(a.id) - priority.indexOf(b.id)).map((x) => x.id);
}

export function expertQuestionKeywords(topic) {
  for (const c of Object.values(CATEGORIES)) for (const x of c.questions) if (x.topic === topic) return x;
  return null;
}
