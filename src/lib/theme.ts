export const C = {
  bg: '#0E1116',
  card: '#171B22',
  cardAlt: '#1F2530',
  border: '#2A313D',
  text: '#F2F4F7',
  muted: '#8B95A5',
  accent: '#C6F432', // lime
  accentText: '#0E1116',
  route: '#4FD1C5', // teal
  danger: '#FF6B6B',
};

export const F = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: C.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: C.text },
  body: { fontSize: 15, color: C.text },
  label: { fontSize: 12, color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' as const },
};
