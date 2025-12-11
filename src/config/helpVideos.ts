export type HelpVideo = {
  title: string;
  url: string;
  type: 'youtube' | 'loom';
};

export const helpVideos: Record<string, HelpVideo> = {
  // Dashboard
  'dashboard-overview': {
    title: 'Dashboard Overview',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder - will replace
    type: 'youtube'
  },
  
  // Explorer
  'explorer-intro': {
    title: 'Introduction to Explorer',
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Placeholder - will replace
    type: 'youtube'
  },
};
