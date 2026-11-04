// Roblox game-design knowledge the scripted crowd draws on. Numbers marked "assumption" are estimates to check, not facts.

export const DEVEX_USD_PER_ROBUX = 0.0038; // assumption: DevEx rate as last known; check the current rate
export const CREATOR_SHARE = 0.7; // assumption: creator keeps about 70% of game pass and developer product sales

export const GENRES = {
  obby: { label: 'Obby', words: ['obby', 'obstacle course', 'parkour', 'speedrun', 'tower of'], saturation: 'extreme',
    risk: 'players finish the last stage and never come back', twists: ['the course rebuilds itself from where players died most', 'two players are tied together and must jump in sync', 'the server votes which stage gets harder each round'] },
  tycoon: { label: 'Tycoon', words: ['tycoon', 'idle', 'incremental', 'factory', 'empire'], saturation: 'extreme',
    risk: 'it is the most cloned format on the platform', twists: ['your tycoon is built inside a rival player\'s base', 'the tycoon is a ship that sinks if you over-build', 'customers are other real players'] },
  simulator: { label: 'Simulator', words: ['simulator', 'sim', 'clicker', 'grind'], saturation: 'high',
    risk: 'click-and-rebirth loops feel identical after ten minutes', twists: ['every click is a rhythm-game beat', 'the zone you farm is shared and can run dry', 'rebirth keeps one random mutation'] },
  horror: { label: 'Horror', words: ['horror', 'scary', 'haunted', 'ghost', 'jumpscare', 'creepy', 'monster'], saturation: 'high',
    risk: 'jumpscares wear off after one playthrough', twists: ['one player secretly controls the monster', 'the map remembers what scared you last time', 'the lights are powered by players pedalling'] },
  survival: { label: 'Survival', words: ['survival', 'survive', 'zombie', 'zombies', 'waves', 'nights', 'apocalypse'], saturation: 'medium',
    risk: 'early nights are boring and late nights are unfair', twists: ['the base is a moving train', 'the night lasts as long as the slowest player stays awake', 'you survive by trading with the other team'] },
  towerdefense: { label: 'Tower defense', words: ['tower defense', 'tower defence', 'td', 'defend the base'], saturation: 'high',
    risk: 'balance and unit power creep break the economy', twists: ['towers are other players\' avatars', 'the path is drawn live by the enemy team', 'towers level up from emotes'] },
  rpg: { label: 'RPG', words: ['rpg', 'dungeon', 'quests', 'quest', 'level up', 'boss', 'loot', 'adventure'], saturation: 'medium',
    risk: 'content costs explode for a small team', twists: ['every dungeon is built by another player', 'your class is decided by what you did in the lobby', 'the boss learns from the last party'] },
  fighting: { label: 'Fighting', words: ['fighting', 'pvp', 'arena', 'combat', 'sword', 'swords', 'battlegrounds'], saturation: 'high',
    risk: 'new players get farmed by veterans and quit', twists: ['moves are drawn as gestures', 'the arena shrinks around the winner', 'you fight with props you stole from the map'] },
  shooter: { label: 'Shooter', words: ['shooter', 'fps', 'guns', 'gun', 'battle royale', 'sniper'], saturation: 'high',
    risk: 'netcode and exploiters ruin shooters on Roblox fast', twists: ['bullets are slow and visible', 'every round swaps the teams\' maps', 'paintball where the map colour decides the winner'] },
  racing: { label: 'Racing', words: ['racing', 'race', 'cars', 'car', 'drift', 'kart'], saturation: 'medium',
    risk: 'vehicle physics feel bad on mobile', twists: ['the track is built by the losers of the last race', 'cars are animals', 'the race is up a falling tower'] },
  roleplay: { label: 'Roleplay / hangout', words: ['roleplay', 'rp', 'hangout', 'town', 'dress up', 'school', 'hospital', 'family', 'social'], saturation: 'high',
    risk: 'empty servers kill roleplay; it needs a crowd to be fun', twists: ['every player has a secret job', 'the town changes era every week', 'a roleplay set on a cruise ship that docks at events'] },
  party: { label: 'Party / minigames', words: ['minigames', 'mini games', 'party game', 'rounds', 'round based'], saturation: 'medium',
    risk: 'minigames need a steady stream of new rounds', twists: ['the losers design the next round', 'every round is a different genre', 'the floor is a giant board game'] },
  collector: { label: 'Pet / collector', words: ['pets', 'pet', 'hatch', 'eggs', 'egg', 'collect', 'collection', 'brainrot', 'units'], saturation: 'high',
    risk: 'odds and trading economies need careful balance and fair disclosure', twists: ['pets fuse into new species you name', 'collected items are stolen from other players\' bases', 'pets age and retire'] },
  sports: { label: 'Sports', words: ['soccer', 'football', 'basketball', 'sports', 'volleyball', 'baseball', 'hockey'], saturation: 'medium',
    risk: 'controls on mobile and team balance decide everything', twists: ['the ball has a mind of its own', 'players are the size of their score', 'matches on a moving platform'] },
  sandbox: { label: 'Sandbox / building', words: ['sandbox', 'building game', 'build battle', 'creative mode', 'build anything'], saturation: 'medium',
    risk: 'without goals, players do not know what to do', twists: ['builds are judged by the other players live', 'a build battle where the theme changes mid-round', 'builds must survive a disaster'] },
};

export const MECHANISMS = {
  gamepass: { label: 'Game passes', words: ['gamepass', 'game pass', 'game passes', 'gamepasses', '2x', 'double coins', 'vip pass'] },
  devproduct: { label: 'Developer products (consumables)', words: ['developer product', 'developer products', 'dev product', 'dev products', 'consumable', 'boost', 'boosts', 'skip stage', 'revive', 'robux packs', 'currency packs', 'buy coins', 'buy gems'] },
  privateserver: { label: 'Private servers', words: ['private server', 'private servers', 'vip server', 'vip servers'] },
  premium: { label: 'Premium payouts', words: ['premium payouts', 'premium payout', 'engagement payouts', 'premium players', 'premium benefits'] },
  cosmetics: { label: 'Cosmetics / UGC', words: ['cosmetic', 'cosmetics', 'skins', 'skin', 'trails', 'emotes', 'ugc', 'accessories', 'outfits', 'hats'] },
  battlepass: { label: 'Battle pass', words: ['battle pass', 'season pass', 'seasonal pass'] },
  subscription: { label: 'Subscription', words: ['subscription', 'subscriptions', 'monthly'] },
  ads: { label: 'Ads', words: ['rewarded ads', 'immersive ads', 'video ads', 'ads', 'sponsor', 'sponsored'] },
};

export const RETENTION = {
  daily: { label: 'daily rewards', words: ['daily reward', 'daily rewards', 'daily login', 'daily chest', 'daily'] },
  streak: { label: 'streaks', words: ['streak', 'streaks'] },
  events: { label: 'live events', words: ['event', 'events', 'limited time', 'limited-time', 'weekend', 'holiday'] },
  quests: { label: 'quests', words: ['quest', 'quests', 'missions', 'challenges', 'achievements'] },
  leaderboard: { label: 'leaderboards', words: ['leaderboard', 'leaderboards', 'ranked', 'ranking'] },
  rebirth: { label: 'rebirth / prestige', words: ['rebirth', 'rebirths', 'prestige'] },
  collection: { label: 'collection goals', words: ['collect', 'collection', 'hatch', 'index', 'catalogue', 'catalog'] },
  updates: { label: 'regular updates', words: ['update', 'updates', 'weekly', 'season', 'seasons', 'new content'] },
  social: { label: 'friends and groups', words: ['friends', 'friend', 'clan', 'clans', 'guild', 'party', 'group'] },
  unlocks: { label: 'unlock goals', words: ['unlock', 'unlocks', 'progression', 'level up', 'levels'] },
};

// Keywords that count as addressing a question topic, used to judge whether an answer is real.
export const TOPICS = {
  saturation: ['unique', 'different', 'twist', 'unlike', 'only', 'first', 'nobody', 'no one', 'never', 'instead', 'except', 'compared', 'better than', 'special', 'new'],
  loop: ['collect', 'earn', 'upgrade', 'unlock', 'fight', 'survive', 'escape', 'build', 'trade', 'race', 'hatch', 'rebirth', 'explore', 'defend', 'solve', 'craft', 'mine', 'farm', 'buy', 'sell', 'level', 'win', 'minute', 'minutes', 'then', 'loop', 'round', 'each'],
  retention: Object.values(RETENTION).flatMap((r) => r.words).concat(['come back', 'return', 'tomorrow', 'day two', 'day 2', 'reason to']),
  audience: ['kids', 'kid', 'teens', 'teen', 'players who', 'fans of', 'audience', 'age', 'ages', 'years old', 'younger', 'older', 'casual', 'hardcore', 'people who', 'girls', 'boys', 'who play', 'already play'],
  scope: ['solo', 'myself', 'alone', 'team', 'weeks', 'week', 'months', 'month', 'mvp', 'prototype', 'scripter', 'builder', 'modeller', 'modeler', 'artist', 'first version', 'launch with', 'start with', 'cut', 'small'],
  onboarding: ['tutorial', 'spawn', 'first', 'seconds', 'instantly', 'immediately', 'intro', 'onboarding', 'right away', 'straight into', 'arrow', 'guide'],
  fairness: ['cosmetic', 'cosmetics', 'not pay to win', 'fair', 'balance', 'balanced', 'cap', 'capped', 'earnable', 'grind for', 'free players', 'everyone can', 'skill'],
  exploits: ['server', 'server-side', 'server side', 'authoritative', 'validate', 'validation', 'anti-cheat', 'anticheat', 'sanity check', 'rate limit', 'exploiters', 'remote'],
  social: ['solo', 'bots', 'npc', 'npcs', 'alone', 'single player', 'friends', 'invite', 'matchmaking', 'small servers', 'fill', 'empty'],
  safety: ['filter', 'filtered', 'textservice', 'moderation', 'report', 'age', 'safe', 'safety', 'block', 'parental', 'age-appropriate'],
  monetize: Object.values(MECHANISMS).flatMap((m) => m.words).concat(['robux', 'monetize', 'monetise', 'sell', 'buy', 'pay', 'paid', 'price', 'revenue']),
  price: ['robux', 'r$', 'price', 'priced', 'costs', 'cost', 'cheap', 'expensive', 'tier', 'tiers'],
  payers: ['percent', '%', 'payers', 'pay', 'spend', 'spenders', 'whales', 'parents', 'allowance', 'premium', 'conversion', 'dau', 'ccu', 'players'],
  fun: ['fun', 'funny', 'moment', 'laugh', 'scream', 'clip', 'satisfying', 'feel', 'feels', 'rush', 'proud', 'chaos', 'tension', 'clutch'],
};
