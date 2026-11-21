/**
 * Demo data for the static product pictures on the audience pages (mockups landing-pages/01–03).
 * All fictitious and shown with the "Demonstrativo" badge (CLAUDE.md rule 7). Like mocks/fixtures,
 * this text is demo *data*, not UI copy; labels around it live in messages/pt-BR.json.
 */

export const DEMO_BROKER = { name: 'Ana Ribeiro', creci: 'CRECI-SP 000.000-F' };
export const DEMO_AGENCY = {
  name: 'Imobiliária Exemplo',
  creci: 'CRECI-SP 00.000-J',
  coordinator: 'Carla Rocha',
};

/** The owner's own listing: no broker, no CRECI (CLAUDE.md rule 15). */
export const OWNER_LISTING = {
  kicker: 'Apartamento à venda · Vila Mariana, São Paulo',
  shortKicker: 'Apartamento à venda · Vila Mariana',
  title: 'Apartamento de 2 quartos na Vila Mariana',
  priceCents: 69_000_000,
  condoCents: 98_000,
  iptuCents: 16_000,
  specs: '2 quartos · 68 m² · 1 vaga',
  shortSpecs: '2 qts · 68 m²',
  chips: ['68 m²', '2 quartos', '1 suíte', '1 vaga', '5º andar'],
  description:
    'Apartamento claro, com varanda e armários na cozinha. A 6 minutos a pé da estação Ana Rosa. Condomínio com portaria 24 horas.',
  until: '2026-12-14',
};

/** A broker's listing next to the owner's, in the highlight band (owners page). */
export const BROKER_LISTING_NEARBY = {
  kicker: 'Apartamento à venda · Vila Mariana',
  priceCents: 72_000_000,
  specs: '2 qts · 70 m²',
};

export const BROKER_PORTAL_LISTINGS = [
  {
    key: 'vm',
    kicker: 'Apartamento à venda · Vila Mariana',
    price: { cents: 69_000_000 },
    specs: '2 qts · 68 m² · 1 vaga',
  },
  {
    key: 'pin',
    kicker: 'Studio para alugar · Pinheiros',
    price: { cents: 290_000, monthly: true },
    specs: '1 qto · 32 m²',
  },
];

export const AGENCY_PORTAL_LISTINGS = [
  {
    key: 'moema',
    kicker: 'Apartamento à venda · Moema',
    priceCents: 120_000_000,
    specs: '3 qts · 110 m² · 2 vagas',
    highlight: false,
  },
  {
    key: 'cb',
    kicker: 'Casa à venda · Campo Belo',
    priceCents: 210_000_000,
    specs: '4 qts · 240 m²',
    highlight: true,
  },
];

export type PreviewStatus = 'published' | 'draft' | 'paused';

export const BROKER_PROPERTIES: {
  key: string;
  title: string;
  detail: string;
  priceCents: number;
  status: PreviewStatus;
}[] = [
  {
    key: '1',
    title: 'Apto 2 qts · Vila Mariana',
    detail: 'Rua Tutóia · venda',
    priceCents: 69_000_000,
    status: 'published',
  },
  {
    key: '2',
    title: 'Apto 3 qts · Moema',
    detail: 'Av. Ibirapuera · venda',
    priceCents: 120_000_000,
    status: 'published',
  },
  {
    key: '3',
    title: 'Studio · Pinheiros',
    detail: 'Rua dos Pinheiros · aluguel',
    priceCents: 290_000,
    status: 'published',
  },
  {
    key: '4',
    title: 'Casa 3 qts · Saúde',
    detail: 'Rua Carneiro da Cunha · venda',
    priceCents: 98_000_000,
    status: 'draft',
  },
];

/** Times as "10h", "14h30" (CLAUDE.md §2). */
export const BROKER_TODAY = [
  { key: 'm', who: 'Marina · Apto Vila Mariana', time: '10h' },
  { key: 'r', who: 'Rafael · Studio Pinheiros', time: '14h30' },
  { key: 'j', who: 'Júlia · Casa Saúde', time: '17h' },
];

export const BROKER_USAGE = { value: 32, max: 50 };
export const AGENCY_USAGE = { value: 148, max: 200 };

export const BROKER_RECORD = {
  title: 'Apto 2 qts · Vila Mariana',
  photos: 12,
  priceCents: 69_000_000,
  condoCents: 98_000,
  areaM2: 68,
  parking: 1,
  note: 'Nota interna: chaves com o porteiro. Proprietário prefere visitas após 18h.',
};

export const BROKER_HISTORY = {
  title: 'Marina · interessada',
  items: [
    { key: '1', date: '12/11', text: 'Chegou pelo portal · Apto Vila Mariana' },
    { key: '2', date: '13/11', text: 'Pediu fotos do segundo quarto' },
    { key: '3', date: '15/11', text: 'Visita feita · gostou da varanda' },
    { key: '4', date: '18/11', text: 'Quer saber se aceita proposta' },
  ],
};

export const BROKER_NEXT_STEPS = [
  { key: '1', text: 'Ligar para Marina · proposta', when: 'Hoje 10h', urgent: true },
  { key: '2', text: 'Enviar fotos a Rafael · Studio Pinheiros', when: 'Hoje 14h30', urgent: true },
  { key: '3', text: 'Confirmar visita com Júlia · Casa Saúde', when: 'Amanhã', urgent: false },
];

export const BROKER_STAGES = [
  {
    key: 'new',
    title: 'Novo',
    cards: [
      { name: 'Marina', area: 'Vila Mariana' },
      { name: 'Pedro', area: 'Moema' },
    ],
  },
  { key: 'talk', title: 'Em conversa', cards: [{ name: 'Rafael', area: 'Pinheiros' }] },
  { key: 'visit', title: 'Visita', cards: [{ name: 'Júlia', area: 'Saúde' }] },
  { key: 'proposal', title: 'Proposta', cards: [{ name: 'Carla', area: 'Moema' }] },
];

/** "Como funciona" mini pictures (brokers page). */
export const HOW_CONTACTS = [
  { name: 'Marina', source: 'portal' },
  { name: 'Rafael', source: 'indicação' },
  { name: 'Júlia', source: 'placa' },
];
export const HOW_STAGES = [
  { stage: 'Novo', name: 'Marina', area: 'Vila Mariana' },
  { stage: 'Visita', name: 'Rafael', area: 'Pinheiros' },
  { stage: 'Proposta', name: 'Júlia', area: 'Saúde' },
];

export const AGENCY_FILTERS = [
  { key: 'carla', label: 'Carla · 41' },
  { key: 'rafael', label: 'Rafael · 38' },
  { key: 'lucia', label: 'Lúcia · 36' },
  { key: 'tiago', label: 'Tiago · 33' },
];

export const AGENCY_PROPERTIES: {
  key: string;
  title: string;
  transaction: string;
  opportunities: number;
  priceCents: number;
  status: PreviewStatus;
  owner: string;
}[] = [
  {
    key: '1',
    title: 'Apto 3 qts · Moema',
    transaction: 'Venda',
    opportunities: 2,
    priceCents: 120_000_000,
    status: 'published',
    owner: 'Carla Rocha',
  },
  {
    key: '2',
    title: 'Apto 2 qts · Vila Mariana',
    transaction: 'Venda',
    opportunities: 1,
    priceCents: 69_000_000,
    status: 'published',
    owner: 'Rafael Faria',
  },
  {
    key: '3',
    title: 'Casa 4 qts · Campo Belo',
    transaction: 'Venda',
    opportunities: 3,
    priceCents: 210_000_000,
    status: 'published',
    owner: 'Lúcia Moraes',
  },
  {
    key: '4',
    title: 'Studio · Pinheiros',
    transaction: 'Aluguel',
    opportunities: 4,
    priceCents: 290_000,
    status: 'published',
    owner: 'Rafael Faria',
  },
  {
    key: '5',
    title: 'Apto 1 qto · Paraíso',
    transaction: 'Aluguel',
    opportunities: 0,
    priceCents: 240_000,
    status: 'paused',
    owner: 'Tiago Souza',
  },
];

export const AGENCY_ACTIVITY = [
  {
    key: '1',
    when: 'Hoje 9h12',
    who: 'Carla',
    text: 'registrou visita de Pedro ao Apto 3 qts · Moema',
  },
  {
    key: '2',
    when: 'Hoje 9h40',
    who: 'Rafael',
    text: 'assumiu os atendimentos de Carla durante as férias',
  },
  {
    key: '3',
    when: 'Hoje 10h05',
    who: 'Rafael',
    text: 'abriu o histórico de Pedro e marcou retorno para amanhã',
  },
  { key: '4', when: 'Ontem', who: 'Lúcia', text: 'atualizou o preço da Casa 4 qts · Campo Belo' },
];
