import { ClipboardList, Building2, Wrench } from '@lucide/vue';

export const sharedSteps = [
  ['Report it clearly', 'A location, a description, and helpful photos give every issue a useful starting point.'],
  ['Bring the right people together', 'Site teams review reports and coordinate the people who can help.'],
  ['Follow it through', 'Track progress, review completed work, and keep a shared record of the fix.'],
] as const;

export const audiences = {
  reporters: {
    icon: ClipboardList,
    label: 'For reporters',
    eyebrow: 'For reporters',
    title: 'Notice something? Make a little difference.',
    description: 'Give maintenance issues a clear place to go. Share what needs attention, follow your reports, and help your community keep things working.',
    action: 'Create your account',
    to: '/register',
    steps: [
      ['Pinpoint the problem', 'Choose your site and building, describe the issue, and add helpful photos.'],
      ['Stay in the loop', 'Track your reports and join an existing issue instead of reporting it twice.'],
      ['Close the loop', 'Review completed work and help confirm that your space is ready to use again.'],
    ],
    note: 'Reporter accounts belong to a site. If your site is missing, ask its administrator about getting it set up.',
  },
  'site-admins': {
    icon: Building2,
    label: 'For site admins',
    eyebrow: 'For site admins',
    title: 'Keep your spaces working, together.',
    description: 'Bring reports, buildings, and maintenance coordination into one workspace. Give your team a clearer view of what needs attention next.',
    action: 'Request a site',
    to: '/request-site',
    steps: [
      ['Bring your site on board', 'Apply for your school, hostel, or hotel. Site administration access is reviewed before approval.'],
      ['Make every location clear', 'Set up labelled buildings and review suggestions for missing places.'],
      ['Coordinate the next fix', 'Review incoming reports, manage site contracts, and assign eligible technicians.'],
    ],
    note: 'Site administrator access requires approval. After you apply, save the tracking token and use Track an application to check status. Submitting a request does not create an approved site or administrator account.',
  },
  technicians: {
    icon: Wrench,
    label: 'For technicians',
    eyebrow: 'For technicians',
    title: 'Put your skills to work in better spaces.',
    description: 'Build your trade profile, explore opportunities, and keep your work organised. Choose the sites you work with and track each job from start to finish.',
    action: 'Join as a technician',
    to: '/register',
    steps: [
      ['Introduce your skills', 'Create your account with verification details, structured skills, and terms acceptance. Request a site contract after signup.'],
      ['Request a site contract', 'Pick a site during registration; admins approve the contract and complete vetting.'],
      ['Follow through on the fix', 'Open assigned work, record your progress, and share the resolution.'],
    ],
    note: 'Registration submits platform verification, records terms acceptance, and files a site contract request. Jobs still wait on admin approval and site vetting.',
  },
} as const;

export type Audience = keyof typeof audiences;
