// The four main claudes in the crowd. Ids are stable; names and colours are presentation.
export const PERSONAS = {
  critic: { id: 'critic', name: 'Vex', role: 'Critic', color: '#e5484d', shade: '#a8323a', voice: { pitch: 0.7, rate: 1.05 },
    blurb: 'Always negative until every one of his questions is answered. Convince him or change the pitch.' },
  monetizer: { id: 'monetizer', name: 'Mint', role: 'Monetizer', color: '#f2b53a', shade: '#b07f1c', voice: { pitch: 1.0, rate: 1.1 },
    blurb: 'Asks how it makes Robux and decides if the game is good enough to back.' },
  hype: { id: 'hype', name: 'Sunny', role: 'Hype', color: '#43b87c', shade: '#2c8457', voice: { pitch: 1.45, rate: 1.15 },
    blurb: 'Finds what is strong, and coaches you on how to win the Critic over.' },
  wrestler: { id: 'wrestler', name: 'Brawl', role: 'Wrestler', color: '#4c8df6', shade: '#2f63b8', voice: { pitch: 0.95, rate: 1.0 },
    blurb: 'Wrestles your idea: throws twists, forces you to pick the heart of the game.' },
};
export const PERSONA_IDS = Object.keys(PERSONAS);
export const YOU = { id: 'you', name: 'You', role: 'Pitcher', color: '#d97757', shade: '#a6553a' };
export const nameOf = (id) => (PERSONAS[id] || (id === 'you' ? YOU : { name: 'System' })).name;
