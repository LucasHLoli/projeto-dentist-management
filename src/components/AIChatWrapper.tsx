'use client';

import dynamic from 'next/dynamic';

const AIChat = dynamic(() => import('./AIChat').then(m => m.AIChat), {
  ssr: false,
  loading: () => null,
});

export function AIChatWrapper() {
  return <AIChat />;
}
