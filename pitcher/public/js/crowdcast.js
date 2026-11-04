// The rest of the audience: named background claudes with pre-set lines for each moment of a pitch.
// They never ask questions; they react, so the room feels alive. Lines are short enough for a bubble.
export const CROWD_PEOPLE = [
  { name: 'Gus', vibe: 'grumpy dad', lines: { new: ['Hope this one has a story.', 'Another one, eh?'], heckle: ['Ha!', 'Called it.'], answered: ['Fair enough.'], convinced: ['Even Vex! Wow.'], greenlit: ['My kids would buy that.'], pass: ['Tough crowd.'], twist: ['Now that is clever.'], idle: ['Is it lunch yet?'] } },
  { name: 'Bea', vibe: 'superfan', lines: { new: ['OMG new pitch!!', "I'm already subscribed."], heckle: ['Oooh.'], answered: ['YES. Good answer.'], convinced: ['VEX IS CONVINCED!'], greenlit: ['Ship it!!'], pass: ['Noooo.'], twist: ['Take the twist! Take it!'], idle: ['Do more!'] } },
  { name: 'Lil Tim', vibe: 'ten-year-old player', lines: { new: ['Is there pets?', 'Can I play it now?'], heckle: ['lol'], answered: ['ok that sounds fun'], convinced: ['the red guy smiled'], greenlit: ['i would buy the 2x'], pass: ['aw'], twist: ['that is so cool'], idle: ['when does it come out'], steal: ['i would steal everything'], plusone: ['+1 hype!'], grow: ['can i grow a dragon'] } },
  { name: 'Grandma Glitch', vibe: 'sweet, confused', lines: { new: ['Is this the bingo?', 'What lovely colours.'], heckle: ['Oh my.'], answered: ['Very sensible, dear.'], convinced: ['Isn\'t that nice.'], greenlit: ['I\'ll tell my grandson.'], pass: ['Oh dear.'], twist: ['How clever!'], idle: ['Speak up, dear.'] } },
  { name: 'Dana', vibe: 'tired developer', lines: { new: ['Scope check incoming.', 'Who is scripting this?'], heckle: ['Exploiters are taking notes.'], answered: ['That is buildable.'], convinced: ['Respect.'], greenlit: ['Put it on the board.'], pass: ['Rough.'], twist: ['That is a week of physics work. Worth it.'], idle: ['Ship version one first.'] } },
  { name: 'xX_Noob_Xx', vibe: 'chaotic gamer', lines: { new: ['W pitch?', 'lets gooo'], heckle: ['L'], answered: ['W answer'], convinced: ['W'], greenlit: ['W W W'], pass: ['L'], twist: ['W twist'], idle: ['first'], steal: ['im stealing ur egg'], plusone: ['+1 W'] } },
  { name: 'Prof. Pixel', vibe: 'design professor', lines: { new: ['Mm. Let us see the loop.'], heckle: ['Noted.'], answered: ['A coherent answer.'], convinced: ['A rare consensus.'], greenlit: ['Commercially sound.'], pass: ['The fundamentals need work.'], twist: ['That changes the core verb. Good.'], idle: ['What is the first minute?'] } },
  { name: 'Mo', vibe: 'trader', lines: { new: ['Any trading?'], heckle: ['Hm.'], answered: ['Okay okay.'], convinced: ['Big if true.'], greenlit: ['Buy the dip.'], pass: ['Sell.'], twist: ['That changes the economy.'], idle: ['What is the rarest item?'] } },
  { name: 'Kiki', vibe: 'streamer', lines: { new: ['Chat, we are watching this.'], heckle: ['Clip that.'], answered: ['Okay that is content.'], convinced: ['CLIP IT.'], greenlit: ['I would stream it.'], pass: ['Chat says no.'], twist: ['That is a thumbnail.'], idle: ['Hello chat.'] } },
  { name: 'Ollie', vibe: 'quiet kid', lines: { new: ['...cool.'], heckle: ['...'], answered: ['mhm'], convinced: ['wow'], greenlit: ['yay'], pass: ['oh'], twist: ['nice'], idle: ['...'] } },
];

// Picks a crowd member and a line for a moment, never the same person twice in a row.
export function createCrowdcast(rng = Math.random) {
  let last = -1;
  const used = new Map();
  return {
    line(moment, category) {
      const pool = CROWD_PEOPLE.map((p, i) => ({ p, i })).filter(({ p, i }) => i !== last && (p.lines[category] || p.lines[moment]));
      if (!pool.length) return null;
      const { p, i } = pool[Math.floor(rng() * pool.length)];
      const list = (category && p.lines[category] && rng() < 0.6) ? p.lines[category] : p.lines[moment] || p.lines.idle;
      const k = `${i}:${moment}`;
      const n = (used.get(k) || 0) % list.length;
      used.set(k, n + 1);
      last = i;
      return { index: i, name: p.name, text: list[n] };
    },
  };
}
