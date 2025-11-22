// src/extension/background.ts
import { createClient } from '@supabase/supabase-js';

declare const chrome: any;
// Vite will replace import.meta.env.* values at build time.
// Use env vars (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) for client-side reads.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Startup log to confirm the background service worker initialized
console.log('[background] service worker loaded, supabase url:', SUPABASE_URL ? 'SET' : 'MISSING');

/**
 * Query overall_score for the brand (best-effort match).
 */
async function queryOverallScore(brandName: string) {
  // try exact match first, then case-insensitive containment
  let { data, error } = await supabase
    .from('brands')
    .select('overall_score')
    .eq('brand_name', brandName)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase error (exact match):', error);
    // continue to try fuzzy
  }

  if (!data) {
    const { data: fuzzy, error: fuzzyErr } = await supabase
      .from('brands')
      .select('brand_name, overall_score')
      .ilike('brand_name', `%${brandName}%`)
      .limit(1)
      .maybeSingle();

    if (fuzzyErr) {
      console.error('Supabase error (fuzzy):', fuzzyErr);
      throw fuzzyErr;
    }
    return fuzzy?.overall_score ?? null;
  }

  return data.overall_score ?? null;
}

/**
 * Query overall_score by brand URL.
 * Tries exact URL, then origin, then fuzzy match on brand_url.
 */
async function queryOverallScoreByUrl(url: string) {
  try {
    // try exact match first
    let { data, error } = await supabase
      .from('brands')
      .select('brand_name, overall_score')
      .eq('brand_url', url)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[supabase] exact url query error', error);
    }

    if (data) return { brand: data.brand_name, score: data.overall_score };

    // try origin (scheme + host)
    try {
      const u = new URL(url);
      const origin = u.origin;

      const { data: byOrigin, error: originErr } = await supabase
        .from('brands')
        .select('brand_name, overall_score')
        .eq('brand_url', origin)
        .limit(1)
        .maybeSingle();

      if (originErr) console.error('[supabase] origin query error', originErr);
      if (byOrigin) return { brand: byOrigin.brand_name, score: byOrigin.overall_score };

      // fuzzy match on host or substring
      const host = u.hostname;
      const { data: fuzzy, error: fuzzyErr } = await supabase
        .from('brands')
        .select('brand_name, overall_score')
        .ilike('brand_url', `%${host}%`)
        .limit(1)
        .maybeSingle();

      if (fuzzyErr) console.error('[supabase] fuzzy url query error', fuzzyErr);
      if (fuzzy) return { brand: fuzzy.brand_name, score: fuzzy.overall_score };
    } catch (e) {
      console.warn('[background] invalid URL for url matching', url, e);
    }

    return { brand: null, score: null };
  } catch (e) {
    console.error('[background] queryOverallScoreByUrl exception', e);
    throw e;
  }
}

/** Fetch all brands from Supabase */
async function fetchBrands() {
  const { data, error } = await supabase.from("brands").select("*");

  if (error) {
    console.error("Supabase query error:", error);
    return [];
  }

  return data;
}

/** Compute recommendations based on current site’s price tier */
async function getTopRecommendations(hostname: string) {
  const brands = await fetchBrands();

  // Find brand that matches the website
  const currentBrand = brands.find((b) => {
    try {
      return hostname.includes(new URL(b.brand_url).hostname);
    } catch {
      return false;
    }
  });

  const priceTier = currentBrand?.price_tier;

  // Filter sustainable brands (score >= 60)
  const recommendations = brands
    .filter((b) => b.overall_score >= 60)
    .filter((b) => (priceTier ? b.price_tier === priceTier : true))
    .sort((a, b) => b.overall_score - a.overall_score)
    .slice(0, 5);

  return { currentBrand, recommendations };
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('[background] received message', message, 'from', sender?.id || sender?.origin || sender);
    if (message?.type === 'GET_BRAND_SCORE' && message.brand) {
      queryOverallScore(message.brand)
        .then((score) => {
          console.log('[background] queryOverallScore result for', message.brand, score);
          sendResponse({ ok: true, score });
        })
        .catch((err) => {
          console.error('[background] queryOverallScore error', err);
          sendResponse({ ok: false, error: String(err) });
        });

      // Indicate we will respond asynchronously
      return true;
    }

    if (message?.type === 'GET_BRAND_SCORE_BY_URL' && message.url) {
      queryOverallScoreByUrl(message.url)
        .then((res) => {
          console.log('[background] queryOverallScoreByUrl result for', message.url, res);
          sendResponse({ ok: true, brand: res.brand, score: res.score });
        })
        .catch((err) => {
          console.error('[background] queryOverallScoreByUrl error', err);
          sendResponse({ ok: false, error: String(err) });
        });
      return true;
    }

    /* GET_RECOMMENDED_BRANDS to display to user */
    if (message.type === "GET_RECOMMENDED_BRANDS" && message.hostname) {
      getTopRecommendations(message.hostname)
        .then(result => sendResponse({ ok: true, ...result }))
        .catch(err => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

  } catch (e) {
    console.error('[background] onMessage handler exception', e);
    try {
      sendResponse && sendResponse({ ok: false, error: String(e) });
    } catch (_) {}
  }
  return false;
});