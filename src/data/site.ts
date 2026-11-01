// Public profile only. The recipient address is configured only in the private contact service.
export const site = {
  name: 'Kristijan Lenković',
  careerStartYear: 2009,
  role: 'Engineering & IT Leader',
  headline: ['I deliver software.', 'I grow teams.'],
  introduction: 'I lead engineering teams and IT operations, connecting business priorities with the people and technology that deliver them.',
  opportunities: 'Head of Engineering, Head of IT, CTO, or a related leadership role. If you see a fit, let’s talk.',
  description: 'Kristijan Lenković — engineering and IT leader, software engineer, and founder. Experience building departments, leading transformation, and securing software delivery.',
  formEndpoint: import.meta.env.PUBLIC_CONTACT_ENDPOINT || '',
  profiles: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/klenkovic/', icon: '/icons/linkedin.svg' },
    { label: 'GitHub', url: 'https://github.com/klenkovic', icon: '/icons/github.svg' },
  ],
};
export const impact = [
  { title: 'Company-wide change', result: 'Restructured a technology company’s business model and internal operations, with responsibility for both development delivery and IT.' },
  { title: 'Cloud-native transformation', result: 'Led a cross-functional task force driving a multi-year move to cloud-native platforms.' },
  { title: 'Trust built into delivery', result: 'Made signed, traceable software builds a company-wide standard and unified release practices across engineering.' },
] as const;
export const expertise = [
  { id: 'leadership', number: '01', icon: 'people', title: 'Give people ownership.', text: 'I develop leaders, make responsibilities clear, and give teams room to make decisions.', tags: ['Team design', 'Leadership & mentoring'] },
  { id: 'delivery', number: '02', icon: 'architecture', title: 'Stay close to the work.', text: 'I connect strategy to architecture and delivery, staying technical enough to challenge assumptions and help solve difficult problems.', tags: ['Software architecture', 'Cloud platforms', 'Kubernetes (K8s)'] },
  { id: 'platforms', number: '03', icon: 'shield', title: 'Make reliability a habit.', text: 'I bring development and operations together, making security and dependable releases part of everyday engineering.', tags: ['DevSecOps', 'CI/CD', 'Software supply-chain security'] },
  { id: 'ai', number: '04', icon: 'spark', title: 'AI, with judgment.', text: 'I use coding agents to explore, build, and learn. Architecture decisions, review, and accountability stay with people.', tags: ['AI-assisted engineering', 'Agentic workflows', 'Human review'] },
] as const;
