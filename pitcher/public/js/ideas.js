// 100 Roblox game ideas to pitch, grouped by category. Each: [title, category, core loop, twist, money].
// "Steal-a" retextures change the verb or the item so stealing plays differently; "+1" games pick a stat
// that grows every second and build the level around what that stat unlocks.
import { CATEGORIES } from './categories.js';

const RAW = [
  // ---------------- Steal-a retextures (22) ----------------
  ['Throw an Egg', 'steal', 'Steal eggs from other bases and throw them over the walls into your nest; eggs in your nest earn cash every second.', 'nothing is carried home, every steal is an aimed throw and a miss cracks the egg, so stealing becomes a skill shot', 'nest-lock game pass, egg skins, a trajectory trail that is cosmetic only'],
  ['Kick an Egg', 'steal', 'Kick eggs like footballs across the map into your base, where they earn cash per second.', 'eggs bounce off walls and other bases, defenders can block shots like goalkeepers, so bases become little football pitches', 'boot cosmetics, goal-net base lock, developer product for an instant egg'],
  ['Roll an Egg', 'steal', 'Steal giant eggs from bases on a hill and roll them down to your base at the bottom.', 'the map is a slope, eggs pick up speed and can flatten other players, and uphill bases are harder to rob but slower to fill', 'lock passes, egg skins, a sticky-glove product to stop a runaway egg'],
  ['Launch an Egg', 'steal', 'Steal eggs and fire them home from a catapult you upgrade in your base.', 'other players can shoot your eggs out of the sky with their own catapults, so every steal is an artillery duel', 'catapult skins, extra catapult slot pass, shield products'],
  ['Steal a Dragon Egg', 'steal', 'Steal dragon eggs that hatch in your base on a timer; hatched dragons earn far more cash.', 'eggs can be stolen only until they hatch, so the last minute before hatching is a siege', 'hatch-speed pass, nest lock, limited event dragons'],
  ['Steal a Snowball', 'steal', 'Steal snowballs from other bases and roll them home; they grow bigger the further you roll.', 'bigger snowballs earn more but make you slower and easier to catch, so greed is the risk', 'winter skins, lock pass, a sled product for a fast getaway'],
  ['Carry a Cake', 'steal', 'Steal layered cakes from bakeries and carry them to your bakery to earn cash per second.', 'carrying a tall cake makes you wobble, and every hit knocks a layer off for someone else to grab', 'cake toppers, a tray pass that steadies one layer, bakery lock'],
  ['Steal a Meteor', 'steal', 'Meteors crash into random spots; carry them to your base before they cool to earn cash.', 'hot meteors burn the carrier, so you pass them between teammates like hot potatoes', 'heat-glove cosmetics, landing radar pass, lock refresh products'],
  ['Bowl an Egg', 'steal', 'Steal eggs and bowl them through other bases to knock defenders over, then collect them in your base.', 'a strike stuns every defender in a base for five seconds, so one good roll opens a raid', 'bowling-egg skins, lane-guide cosmetic, base lock'],
  ['Hook an Egg', 'steal', 'Steal eggs from other islands by casting fishing rods and reeling them into your base.', 'lines can be cut by defenders and tangled by other fishers, so stealing is a tug of war', 'rod skins, extra line pass, bait products for rarer eggs'],
  ['Steal a Cloud', 'steal', 'Bases are floating clouds; jump across and carry cloud creatures back to earn cash.', 'clouds drift, so bases move closer and further over time and routes change every minute', 'cloud skins, drift-anchor pass, cloud lock'],
  ['Balloon Steal', 'steal', 'Tie stolen eggs to balloons and let them float back to your base.', 'balloons can be popped by anyone with a dart, so you escort your loot through the sky', 'balloon skins, extra balloon slot, dart cosmetics'],
  ['Magnet Heist', 'steal', 'Steal metal eggs from bases using magnets you upgrade.', 'magnets have polarity, so the right defence can push a thief\'s magnet away and fling their loot', 'magnet skins, strength upgrades capped for fairness, base lock'],
  ['Steal a Train Car', 'steal', 'Every base is a train car on a looping track; jump between moving trains to steal cargo.', 'stations stop the trains for ten seconds, which is when the big raids happen', 'car skins, station-pass for a longer stop at your car, lock'],
  ['Swap an Egg', 'steal', 'Instead of stealing, sneak into bases and swap their best egg for a fake.', 'decoys look identical until someone tries to sell them, so bluffing and checking become the game', 'decoy skins, scanner pass that reveals one fake per hour, lock'],
  ['Sneak an Egg', 'steal', 'Steal eggs past guard cones in each base using stealth.', 'owners place guards and cameras, so defending is a puzzle you design and stealing is a puzzle you solve', 'guard skins, extra guard slot, cosmetic disguises'],
  ['Steal a Ghost', 'steal', 'Catch ghosts drifting out of other bases with a lantern and lead them home to haunt-earn cash.', 'ghosts phase through walls and drift back unless the lantern stays lit, so you keep an eye on fuel', 'lantern skins, fuel products, spooky lock'],
  ['Dig an Egg', 'steal', 'Steal eggs buried under other bases by digging tunnels and pulling them down into your vault.', 'owners can flood tunnels or collapse them, so stealing happens underground in real time', 'shovel skins, tunnel-map pass, drill products'],
  ['Juggle Eggs', 'steal', 'Steal several eggs at once by juggling them all the way home.', 'every hit you take drops one egg, so greedy jugglers lose the most', 'juggling-trail cosmetics, extra-hand pass capped at five eggs, lock'],
  ['Steal a Bee', 'steal', 'Steal bees from other hives; bees make honey cash in your hive.', 'stolen bees fly home unless you also steal the queen, so the queen raid is the big play', 'hive skins, queen-guard pass, flower boost products'],
  ['Slingshot Heist', 'steal', 'Slingshot yourself into other bases, grab an egg and slingshot back.', 'landing is physics, so misses bounce you into the moat and bases are built around the landing zones', 'slingshot skins, aim-preview cosmetic, lock'],
  ['Tow a Car', 'steal', 'Steal cars from other garages by hooking them to your tow truck and dragging them home.', 'cars swing on the tow rope and can be cut loose, so every steal is a getaway chase', 'truck skins, chain upgrades, garage lock'],
  // ---------------- +1 games (22) ----------------
  ['+1 Long Arm Escape', 'plusone', 'Your arm grows +1 stud every second; reach ledges, levers and keys further away to escape the pit.', 'long arms are hard to control in tight corridors, so the escape route alternates between far grabs and tight squeezes', '2x arm growth pass, instant +500 product, arm skins'],
  ['+1 Float Prison Escape', 'plusone', 'You float +1 stud higher every second; rise over the prison walls to escape the guards.', 'ceilings and nets block the way up, so you also need to drift sideways at the right moment', '2x float pass, net-cutter product, jumpsuit skins'],
  ['+1 Size Giant Escape', 'plusone', 'You grow +1 size every second; smash through walls of the toy city to escape.', 'being big smashes walls but stops you fitting through doors, so you choose when to grow', 'growth pass, shrink-potion product, giant skins'],
  ['+1 Jump Tower', 'plusone', 'Your jump grows +1 every second; climb the endless tower before the floor rises.', 'jumping too high bonks you on spikes in the ceiling, so you have to hold back sometimes', '2x jump pass, checkpoint product, trails'],
  ['+1 Speed Lava Run', 'plusone', 'Your speed grows +1 every second; outrun the rising lava across the island.', 'at high speed corners kill you, so the map mixes straights with hairpins', 'speed pass, brake cosmetic, lava-shield product'],
  ['+1 Tiny Vent Escape', 'plusone', 'You shrink +1 every second; crawl through smaller and smaller vents to escape the lab.', 'tiny you is weak, so lab cats and fans become deadly', 'shrink pass, cat-repellent product, scientist skins'],
  ['+1 Magnet Every Second', 'plusone', 'Your magnet strength grows +1 every second; pull coins and pull yourself along metal walls.', 'strong magnets pull you into traps too, so you switch polarity to survive', 'magnet pass, polarity skins, instant strength product'],
  ['+1 Wall Climb Skyscraper', 'plusone', 'Your climbing speed grows +1 every second; climb the skyscraper before the window cleaners knock you off.', 'falling keeps your stat but drops you floors, so risk versus speed', 'climb pass, safety rope product, glove skins'],
  ['+1 Balloon Every Second', 'plusone', 'Every second you gain a balloon; float up through the sky layers.', 'birds pop balloons, so you collect more than you need and dodge flocks', '2x balloons pass, bird-shield product, balloon skins'],
  ['+1 Wings Glide Escape', 'plusone', 'Your wingspan grows +1 every second; glide from cliff to cliff to escape the canyon.', 'big wings catch wind gusts that push you off course', 'wing pass, wind-map cosmetic, feather skins'],
  ['+1 Swim Speed Shark Escape', 'plusone', 'Your swim speed grows +1 every second; escape the sharks across the reef.', 'air runs out, so faster swimmers still need to surface at the right reefs', 'swim pass, oxygen product, fin skins'],
  ['+1 Long Neck Jungle', 'plusone', 'Your neck grows +1 every second; reach higher fruit and look over the jungle walls to find the exit.', 'long necks get tangled in vines, so you crouch through some parts', 'neck pass, vine-cutter product, giraffe skins'],
  ['+1 Push Power Arena', 'plusone', 'Your push power grows +1 every second; shove other players off shrinking platforms.', 'the strongest player glows and everyone targets them', 'push pass with a cap, arena skins, revive product'],
  ['+1 Bounce Trampoline World', 'plusone', 'Your bounce grows +1 every second; bounce across a world of trampolines to the sky island.', 'some trampolines are fake and drop you, so you watch for tells', 'bounce pass, parachute product, trails'],
  ['+1 Brain Escape', 'plusone', 'Your brain grows +1 IQ every second; doors in the school only open for high enough IQ answers.', 'puzzles get harder as IQ grows, so the stat changes what you must solve, not just how fast', 'IQ pass, hint product, graduation hats'],
  ['+1 Weight Smash Down', 'plusone', 'You gain +1 weight every second; smash down through floors to escape the tower from the top.', 'heavy you breaks floors you wanted to stand on, so timing the smash is the game', 'weight pass, feather product to stop falling, anvil skins'],
  ['+1 Stilt Legs Escape', 'plusone', 'Your legs grow +1 every second; step over walls and rivers to escape the castle.', 'tall legs are easy to trip, so knights with ropes are the danger', 'leg pass, balance product, stilt skins'],
  ['+1 Heat Ice Prison', 'plusone', 'Your heat aura grows +1 every second; melt the walls of the ice prison to break out.', 'melted water refreezes behind you and blocks other prisoners, so the prison is shared chaos', 'heat pass, ice-pick product, flame auras'],
  ['+1 Clone Every Ten Seconds', 'plusone', 'You gain a clone every ten seconds; clones stand on buttons so you can open the escape doors.', 'clones copy your moves, so you plan paths that work for every copy', 'clone pass, clone skins, instant clone product'],
  ['+1 Rope Swing City', 'plusone', 'Your grapple rope grows +1 every second; swing between rooftops to escape the city.', 'longer rope means wider swings that can slam you into walls', 'rope pass, grapple skins, safety-net product'],
  ['+1 Light Radius Maze', 'plusone', 'Your flashlight radius grows +1 every second; escape the dark maze before the monster finds you.', 'the bigger your light, the easier the monster sees you, so you dim it to hide', 'light pass, battery product, flashlight skins'],
  ['+1 Hamster Ball Escape', 'plusone', 'Your hamster ball grows +1 every second; roll through the house to escape the cat.', 'bigger balls stop fitting under furniture, so the safe hiding spots disappear', 'ball pass, cat-distraction product, ball skins'],
  // ---------------- Grow (5) ----------------
  ['Grow a Volcano', 'grow', 'Plant lava seeds in your garden, grow magma crops and harvest obsidian to sell.', 'eruptions mutate crops and can spill into neighbour gardens', 'growth sprinkler pass, eruption-forecast product, garden skins'],
  ['Grow a Reef', 'grow', 'Grow a coral garden underwater; fish visit and pay you in pearls.', 'rare fish only visit reefs with the right coral combination, so planting is a puzzle', 'growth pass, rare seed packs, reef decorations'],
  ['Grow a Monster', 'grow', 'Plant seeds that grow into monsters; harvest them or keep them as garden guards.', 'guards protect your garden from night raids, so you balance selling and defending', 'growth pass, guard slots, monster skins'],
  ['Grow a Desert', 'grow', 'Grow cacti and desert fruit in a garden where water is shared across the server.', 'every garden pulls from one river, so planting upstream hurts neighbours', 'well pass, rain-dance product, desert decor'],
  ['Grow a Sky Garden', 'grow', 'Plant seeds on floating islands; wind events carry seeds between gardens.', 'your rare plants can seed someone else\'s island, so wind maps matter', 'anchor pass, wind-forecast product, island skins'],
  // ---------------- Tower defense (4) ----------------
  ['Kitchen Defense', 'towerdefense', 'Place chef units along the counter to stop waves of runaway food in this tower defense.', 'recipes combine units, so two chefs next to each other cook a new attack', 'summon currency, unit slot pass, chef skins'],
  ['Toy Box Tower Defense', 'towerdefense', 'Toys defend the bedroom from bedtime monster waves in tower defense.', 'a second team draws the monster path with crayons each wave', 'summon currency, toy skins, battle pass'],
  ['Weather Tower Defense', 'towerdefense', 'Summon weather units like storms and suns to stop waves crossing the valley.', 'weather combos change the map, so rain plus cold makes ice paths', 'summon currency, weather skins, auto-skip pass'],
  ['Museum Night Defense', 'towerdefense', 'Museum exhibits come alive at night and defend against thieves in tower defense.', 'exhibits level up from the era of the room they stand in', 'summon currency, exhibit skins, extra room pass'],
  // ---------------- Obby (5) ----------------
  ['Elevator Obby', 'obby', 'An obby where an elevator stops at random floors, each one a different obstacle course.', 'the server votes the next floor, so no two runs match', 'skip stage, speed coil pass, trails'],
  ['Mirror Obby', 'obby', 'A two-player obby where one player sees the course mirrored and must guide the other.', 'only talking or pinging gets you through', 'skip stage, mirror skins, VIP checkpoint'],
  ['Rhythm Obby', 'obby', 'An obby where platforms appear on the beat of the music.', 'each tower has its own song and the beat speeds up near the top', 'skip stage, song packs, trails'],
  ['Paint Obby', 'obby', 'An obby where you paint your own platforms that other players can use.', 'paint dries after a minute, so you race to finish on the paint left behind', 'paint colours, skip stage, brush skins'],
  ['Shrinking Tower Obby', 'obby', 'A tower obby where the stages shrink every round.', 'the last players standing get to design the next stage', 'skip stage, gravity coil pass, trails'],
  // ---------------- Tycoon (5) ----------------
  ['Haunted Hotel Tycoon', 'tycoon', 'Run a hotel for ghosts in this tycoon: build rooms, hire staff, earn ecto coins from guests.', 'guests are other players\' ghosts who leave reviews that change your rating', '2x coins pass, VIP lobby pass, room themes'],
  ['Space Station Tycoon', 'tycoon', 'Build a space station tycoon, add modules and earn from docking ships.', 'oxygen runs through every module, so a bad build can suffocate your crew', '2x cash, auto-collect, module skins'],
  ['Theme Park Tycoon Live', 'tycoon', 'Build a theme park tycoon where the riders are real visiting players.', 'visitors rate rides live, and the best-rated park gets featured on the server board', '2x cash, VIP rides, ride skins'],
  ['Pizza Delivery Tycoon', 'tycoon', 'Run a pizza shop tycoon and deliver orders to other players\' bases.', 'deliveries cross other tycoons, so the map is shared traffic', '2x cash, scooter skins, auto-oven pass'],
  ['Zoo Breakout Tycoon', 'tycoon', 'Build a zoo tycoon and keep animals happy to earn ticket cash.', 'neglected animals escape and wander into other zoos', '2x cash, rare animal packs, zoo decor'],
  // ---------------- Horror (5) ----------------
  ['Night Shift Arcade', 'horror', 'Co-op horror: survive the night shift in an arcade while the machines hunt you.', 'every machine has a sound tell, and the arcade layout changes each night', 'revives, flashlight skins, private servers'],
  ['The Quiet Library', 'horror', 'Co-op horror in a library where a monster hunts anyone too loud.', 'a sound meter tracks every footstep and voice line', 'revives, quiet-shoe cosmetics, private servers'],
  ['Dentist Waiting Room', 'horror', 'Co-op horror: escape a dentist office where the doors lead to different rooms each run.', 'patients disappear one by one and the monster wears their faces', 'revives, skins, private servers'],
  ['Snow Cabin', 'horror', 'Co-op horror in a snowed-in cabin where something knocks every night.', 'a cold meter means you have to leave the fire to find wood', 'revives, cosy skins, private servers'],
  ['Going Down', 'horror', 'Co-op horror in an elevator that only goes down, each floor a new scary room.', 'players vote which button to press and the floor remembers who chose', 'revives, elevator skins, private servers'],
  // ---------------- Survival nights (4) ----------------
  ['99 Floors Flood', 'survival', 'Survive 99 nights as the building floods one floor higher every night.', 'classes like plumber, builder and scout each block water differently', 'class unlocks, revive tokens, raft skins'],
  ['Raft Nights', 'survival', 'Survive nights on a raft in the ocean, gathering by day from passing islands.', 'the raft is the base and it can be split if the crew argues', 'class unlocks, revive tokens, sail skins'],
  ['Haunted Campground', 'survival', 'Survive nights at a campground while the forest gets closer every night.', 'the campfire must be fed and every log comes from the dark', 'class unlocks, revive tokens, tent skins'],
  ['Blizzard Train', 'survival', 'Survive nights on a train crossing a frozen world; stop at stations to scavenge.', 'the train leaves on time, with or without you', 'class unlocks, revive tokens, carriage skins'],
  // ---------------- Battlegrounds (4) ----------------
  ['Kitchen Battlegrounds', 'battlegrounds', 'A battlegrounds fighting game where every moveset is a kitchen utensil.', 'combos are recipes, so mixing two players\' moves cooks a finisher', 'character unlocks, emotes, kill effects'],
  ['Paint Battlegrounds', 'battlegrounds', 'A battlegrounds fighting game where your moves paint the floor and your colour powers you up.', 'standing on enemy paint weakens you, so the arena is always shifting', 'character unlocks, colour packs, emotes'],
  ['Pillow Fight Battlegrounds', 'battlegrounds', 'A soft battlegrounds fighting game with pillow movesets at a sleepover.', 'feathers fill the room as you fight and slow everyone down', 'character unlocks, pyjama skins, emotes'],
  ['Shadow Battlegrounds', 'battlegrounds', 'A battlegrounds fighting game where your shadow fights with you and copies your last combo.', 'lights on the map change how big your shadow is', 'character unlocks, shadow skins, emotes'],
  // ---------------- Roleplay (3) ----------------
  ['Cruise Ship Roleplay', 'roleplay', 'A roleplay town on a cruise ship with cabins, jobs and shore trips.', 'the ship docks at a new island event every hour, which sparks stories', 'premium cabins, roles, private servers'],
  ['Wizard School Roleplay', 'roleplay', 'A wizard school roleplay town with classes, houses and jobs.', 'every player gets a secret role like spy or prefect', 'premium houses, wands, private servers'],
  ['Space Colony Roleplay', 'roleplay', 'A roleplay town on Mars with jobs, houses and rovers.', 'random storms force everyone indoors and create stories', 'premium houses, rovers, roles'],
  // ---------------- Dress-up (3) ----------------
  ['Dress to Escape', 'dressup', 'A dress-up runway game where your outfit also has to survive an obstacle run.', 'heavy outfits score more style but run slower', 'VIP items, outfit slots, poses'],
  ['Monster Makeover', 'dressup', 'A dress-up game where you style monsters for a runway in a theme.', 'monsters react to clothes they hate, so you read their mood', 'VIP items, monster packs, poses'],
  ['Decades Runway', 'dressup', 'A dress-up runway game where every round is a different decade.', 'the decade changes halfway through, so you remix your outfit', 'VIP items, decade packs, walks'],
  // ---------------- Pets (4) ----------------
  ['Pet Fusion Lab', 'pets', 'Hatch pets and fuse two into a new species you get to name.', 'the first player to fuse a species names it for the whole game', 'luck pass, fusion slots, exclusive eggs'],
  ['Pet Daycare', 'pets', 'Run a pet daycare: hatch pets, care for other players\' pets and earn tips.', 'happy pets learn tricks from you and go home better', 'luck pass, extra kennels, toy packs'],
  ['Pet Racing League', 'pets', 'Hatch pets and race them in leagues.', 'pets have moods, so the fastest pet loses when grumpy', 'luck pass, racing skins, exclusive eggs'],
  ['Pet Guardians', 'pets', 'Hatch pets that guard your base from raiding players.', 'pets level up only by defending, so collecting is not enough', 'luck pass, guard slots, exclusive eggs'],
  // ---------------- Social deduction (3) ----------------
  ['Murder on the Express', 'social', 'A murder mystery on a moving train; find the murderer before the last station.', 'carriages detach as the train goes, splitting players apart', 'weapon skins, emotes, private servers'],
  ['Werewolf Village', 'social', 'A social deduction game with a traitor werewolf in a village at night.', 'footprints in the snow are clues that fade by morning', 'skins, emotes, private servers'],
  ['Spy Party', 'social', 'A social deduction party where one spy must finish tasks without being caught.', 'tasks leave small changes others can notice', 'skins, emotes, private servers'],
  // ---------------- Escape (4) ----------------
  ['Escape the Giant Kitchen', 'escape', 'Escape a giant kitchen as a tiny chef with several routes past the cook.', 'the open route changes each round depending on what the cook is making', 'tool passes, skip doors, chef skins'],
  ['Escape the Dentist', 'escape', 'Escape the dentist before your check-up, sneaking past the nurses.', 'the dentist remembers how you escaped last time and blocks it', 'tool passes, skip doors, mouthguard skins'],
  ['Escape the Classroom', 'escape', 'Escape a classroom where the teacher chases anyone out of their seat.', 'one player each round secretly plays the teacher', 'tool passes, skip doors, backpack skins'],
  ['Escape the Museum', 'escape', 'Escape a museum at night with several exits and moving guards.', 'exhibits you touch come alive and help or chase you', 'tool passes, skip doors, explorer skins'],
  // ---------------- Party (4) ----------------
  ['Don\'t Press the Button: Chaos', 'party', 'A party game where one random button press triggers a random event for everyone.', 'the button moves and the player who pressed last picks the next event', 'round votes, win effects, VIP servers'],
  ['Floor Is Lava Party', 'party', 'Party minigames where the floor turns to lava in a new way each round.', 'the losers choose the next lava pattern', 'round votes, win effects, VIP servers'],
  ['Simon Says Arena', 'party', 'Party minigames where Simon gives orders and wrong moves eliminate you.', 'one player each round secretly plays Simon', 'round votes, win effects, VIP servers'],
  ['Hot Potato Bomb', 'party', 'Party minigames where a bomb passes between players until it blows up.', 'the bomb gets faster and switches rules every round', 'round votes, bomb skins, VIP servers'],
  // ---------------- Find the ___ (3) ----------------
  ['Find the Lost Socks', 'find', 'Find the hidden socks scattered across a giant house, 300 to collect.', 'socks come in pairs and the second one is always somewhere stranger', 'hint tokens, radar pass, sock skins'],
  ['Find the City Ducks', 'find', 'Find the hidden ducks across a whole city, from easy to impossible.', 'ducks move when someone else finds them', 'hint tokens, radar pass, duck skins'],
  ['Find the Hidden Doors', 'find', 'Find the hidden doors that lead to secret rooms in a mansion.', 'each door you find unlocks an ability that helps find the next', 'hint tokens, radar pass, key skins'],
];

export const IDEAS = RAW.map(([title, category, line, hook, money], i) => ({ id: `idea-${String(i + 1).padStart(3, '0')}`, n: i + 1, title, category, line, hook, money }));

export function pitchScript(idea) {
  const label = CATEGORIES[idea.category]?.label || 'Roblox';
  return [
    `My game is called ${idea.title}. ${idea.line}`,
    `Unlike other ${label} games, ${idea.hook}.`,
    `Monetization: ${idea.money}.`,
  ];
}

export function ideasMarkdown() {
  const out = ['# 100 Roblox game ideas', '', 'Generated from `public/js/ideas.js`. Each idea: the core loop, the twist that makes it different, and how it makes Robux. Load any of them in Pitcher from the Ideas tab and press "Pitch it for me".', ''];
  for (const [cat, c] of Object.entries(CATEGORIES)) {
    const list = IDEAS.filter((i) => i.category === cat);
    if (!list.length) continue;
    out.push(`## ${c.label} (${list.length})`, '', `Expert in the crowd: ${c.expert.name}, ${c.expert.title}.`, '');
    for (const i of list) out.push(`${i.n}. **${i.title}**: ${i.line} *Twist:* ${i.hook}. *Money:* ${i.money}.`);
    out.push('');
  }
  return out.join('\n');
}
