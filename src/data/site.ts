// Public profile only. The recipient address is configured only in the private contact service.
export const site = {
  name: 'Kristijan Lenković',
  careerStartYear: 2009,
  role: 'Software Engineer & Engineering Leader',
  headline: ['I deliver software.', 'I grow teams.'],
  introduction: 'You get software that reaches production, an engineering team that takes ownership, and a leader who makes technology work for your business.',
  opportunities: 'Building a product, growing engineering, or taking your platform forward? Tell me what you need to achieve.',
  description: 'Kristijan Lenković — software engineer and engineering leader helping businesses deliver dependable products, grow capable teams, and build secure cloud platforms.',
  formEndpoint: import.meta.env.PUBLIC_CONTACT_ENDPOINT || '',
  profiles: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/klenkovic/', icon: '/icons/linkedin.svg' },
    { label: 'GitHub', url: 'https://github.com/klenkovic', icon: '/icons/github.svg' },
  ],
};
export const impact = [
  { title: 'An organization built to grow', result: 'Created a multidisciplinary engineering department and developed the leaders who helped it scale.' },
  { title: 'A platform ready for change', result: 'Led engineering, product, and operations through a multi-year platform transformation.' },
  { title: 'A more dependable way to ship', result: 'Established shared release practices and build verification across engineering.' },
] as const;
export const expertise = [
  { id: 'delivery', number: '01', icon: 'architecture', title: 'Turn plans into working software.', text: 'I turn business priorities into pragmatic architecture and working products, staying close to the code and accountable through delivery.', tags: ['Software architecture', 'Cloud platforms', 'Kubernetes (K8s)'] },
  { id: 'leadership', number: '02', icon: 'people', title: 'Build a team that can lead.', text: 'I give engineers clear direction, develop future leaders, and build the structure your team needs to grow without losing ownership.', tags: ['Team design', 'Leadership & mentoring'] },
  { id: 'platforms', number: '03', icon: 'shield', title: 'Move forward with confidence.', text: 'I build security and reliability into cloud platforms and delivery pipelines, so your team can release with confidence as the product grows.', tags: ['DevSecOps', 'CI/CD', 'Software supply-chain security'] },
  { id: 'ai', number: '04', icon: 'spark', title: 'AI, with judgment.', text: 'I use coding agents to explore, build, and learn. Architecture decisions, review, and accountability stay with people.', tags: ['AI-assisted engineering', 'Agentic workflows', 'Human review'] },
] as const;
