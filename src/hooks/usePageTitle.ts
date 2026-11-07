import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_URL = 'https://www.aigsuite.com';
export const DEFAULT_SITE_TITLE = 'Al Ihsan Group (AIGMS) — Qurban & Aqiqah Management System | Singapore';
export const DEFAULT_SITE_DESCRIPTION =
  'Official Al Ihsan Group Singapore (AIGMS) platform for Qurban and Aqiqah registrations, Australia to Singapore meat delivery, Indonesia Breeding Programme tracking, payment verification, and digital Qurban certificates.';

export interface PageSeoMeta {
  fullTitle: string;
  description: string;
  canonicalUrl: string;
  robots: string;
}

/**
 * Pure helper computing dynamic SEO meta values for any route.
 * Public routes (`/`, `/login`) allow indexing; authenticated `/admin/*` and `/portal/*`
 * routes emit `noindex, nofollow` so private screens are never indexed by crawlers.
 */
export function computePageSeoMeta(
  pathname: string,
  title: string,
  description?: string,
): PageSeoMeta {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const isPrivateRoute = cleanPath.startsWith('/admin') || cleanPath.startsWith('/portal');
  const fullTitle = title ? `${title} — AIGMS | Al Ihsan Group` : DEFAULT_SITE_TITLE;
  const resolvedDescription = description?.trim() || DEFAULT_SITE_DESCRIPTION;
  const canonicalPath = cleanPath === '/' ? '/' : cleanPath.replace(/\/+$/, '');
  return {
    fullTitle,
    description: resolvedDescription,
    canonicalUrl: `${SITE_URL}${canonicalPath}`,
    robots: isPrivateRoute
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1',
  };
}

function setMetaContent(selector: string, attrName: 'name' | 'property', attrValue: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonicalHref(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Sets document.title and synchronizes SEO / OpenGraph / canonical / robots tags per route.
 */
export function usePageTitle(title: string, description?: string) {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.title;
    const meta = computePageSeoMeta(location.pathname, title, description);

    document.title = meta.fullTitle;
    setMetaContent('meta[name="description"]', 'name', 'description', meta.description);
    setMetaContent('meta[name="robots"]', 'name', 'robots', meta.robots);
    setMetaContent('meta[property="og:title"]', 'property', 'og:title', meta.fullTitle);
    setMetaContent('meta[property="og:description"]', 'property', 'og:description', meta.description);
    setMetaContent('meta[property="og:url"]', 'property', 'og:url', meta.canonicalUrl);
    setMetaContent('meta[name="twitter:title"]', 'name', 'twitter:title', meta.fullTitle);
    setMetaContent('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);
    setCanonicalHref(meta.canonicalUrl);

    return () => {
      document.title = prev;
    };
  }, [location.pathname, title, description]);
}
