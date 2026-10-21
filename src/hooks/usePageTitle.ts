import { useEffect } from 'react';

/**
 * Sets the document <title> for SEO.
 * Automatically appends " | AIGMS — Al Ihsan Group" brand suffix.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} | AIGMS — Al Ihsan Group`;
    return () => { document.title = prev; };
  }, [title]);
}
