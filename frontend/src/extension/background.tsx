// src/extension/background.ts
import { createClient } from '@supabase/supabase-js';

declare const chrome: any;

// Env vars (Vite replaces these at build time)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type RecommendationMatch = {
  score: number;
  image_path?: string;
  image_url?: string;
  [key: string]: unknown;
};

type RecommendationApiResponse = {
  matches?: RecommendationMatch[];
  error?: string;
};

function deriveAssetsBase(apiUrl?: string) {
  if (!apiUrl) return null;

  try {
    const url = new URL(apiUrl);
    url.pathname = url.pathname.replace(/\/api\/recommend\/?$/, '/');
    return url.toString();
  } catch (error) {
    console.warn('[background] Failed to derive assets base URL', error);
    return null;
  }
}

function dataUrlToBlob(dataUrl: string) {
  const parts = dataUrl.split(',');
  if (parts.length < 2) throw new Error('Malformed data URL');

  const header = parts[0];
  const mimeMatch = header.match(/data:([^;]+);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binaryStr = atob(parts[1]);

  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

  return { blob: new Blob([bytes], { type: mime }), mime };
}

function normalizeMatches(matches: RecommendationMatch[] | undefined, assetsBase: string | null): RecommendationMatch[] {
  if (!Array.isArray(matches)) return [];

  return matches.map((item) => {
    const imagePath = item?.image_path ?? '';
    let imageUrl = typeof item?.image_url === 'string' ? item.image_url : '';

    if (!imageUrl && imagePath) {
      if (/^https?:\/\//i.test(imagePath)) {
        imageUrl = imagePath;
      } else if (assetsBase) {
        try {
          const base = assetsBase.endsWith('/') ? assetsBase : `${assetsBase}/`;
          imageUrl = new URL(imagePath.replace(/^\//, ''), base).toString();
        } catch (error) {
          console.warn('[background] Failed to build image URL for match', error);
        }
      }
    }

    return {
      ...item,
      image_path: imagePath,
      image_url: imageUrl || imagePath,
    };
  });
}

const DEFAULT_RECOMMEND_API_URL = 'http://localhost:8000/search';
const RECOMMEND_API_URL =
  import.meta.env.VITE_RECOMMEND_API_URL || DEFAULT_RECOMMEND_API_URL;

const RECOMMEND_ASSETS_BASE_URL =
  import.meta.env.VITE_RECOMMEND_ASSETS_BASE_URL ||
  deriveAssetsBase(import.meta.env.VITE_RECOMMEND_API_URL) ||
  deriveAssetsBase(DEFAULT_RECOMMEND_API_URL);

/** Make POST request to your recommendation API */
async function requestSimilarItems(imageDataUrl: string, k?: number) {
  if (!imageDataUrl.startsWith('data:')) {
    throw new Error('Expected image data URL');
  }

  const { blob, mime } = dataUrlToBlob(imageDataUrl);
  const extension = mime.split('/')[1] || 'jpg';

  const formData = new FormData();
  formData.append('file', blob, `product.${extension}`);
  if (typeof k === 'number') formData.append('k', String(k));

  const response = await fetch(RECOMMEND_API_URL, { method: 'POST', body: formData });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Recommendation request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as RecommendationApiResponse;
  if (payload?.error) throw new Error(payload.error);

  // Support both /api/recommend (matches) and /search (results) shapes
  const rawMatches = (payload as any)?.matches ?? (payload as any)?.results ?? [];

  return { matches: normalizeMatches(rawMatches, RECOMMEND_ASSETS_BASE_URL) };
}

/**
 * This is the important one.
 * Fully CORS-safe image fetch.
 * Works for H&M, Zara, Mango, Uniqlo, Nike, Adidas, ASOS, etc.
 */
async function fetchUrlAsDataUrl(url: string) {
  console.log('[background] fetchUrlAsDataUrl', url);

  try {
    const response = await fetch(url, {
      mode: 'no-cors',
      credentials: 'omit',
      cache: 'force-cache'
    });

    // Even opaque responses can be read as blob in extensions
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to convert blob to DataURL'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('[background] fetchUrlAsDataUrl error', e);
    throw new Error(`Failed to fetch image: ${String(e instanceof Error ? e.message : e)}`);
  }
}

// Confirm background worker started
console.log('[background] service worker loaded, supabase url:', SUPABASE_URL ? 'SET' : 'MISSING');

/** Query by brand name */
async function queryOverallScore(brandName: string) {
  let { data, error } = await supabase
    .from('brands')
    .select('overall_score')
    .eq('brand_name', brandName)
    .limit(1)
    .maybeSingle();

  if (error) console.error('Supabase error (exact match):', error);

  if (!data) {
    const { data: fuzzy, error: fuzzyErr } = await supabase
      .from('brands')
      .select('brand_name, overall_score')
      .ilike('brand_name', `%${brandName}%`)
      .limit(1)
      .maybeSingle();

    if (fuzzyErr) throw fuzzyErr;
    return fuzzy?.overall_score ?? null;
  }

  return data.overall_score ?? null;
}

/** Query by URL */
async function queryOverallScoreByUrl(url: string) {
  try {
    let { data } = await supabase
      .from('brands')
      .select('brand_name, overall_score')
      .eq('brand_url', url)
      .limit(1)
      .maybeSingle();

    if (data) return { brand: data.brand_name, score: data.overall_score };

    const u = new URL(url);
    const origin = u.origin;

    const { data: byOrigin } = await supabase
      .from('brands')
      .select('brand_name, overall_score')
      .eq('brand_url', origin)
      .limit(1)
      .maybeSingle();

    if (byOrigin) return { brand: byOrigin.brand_name, score: byOrigin.overall_score };

    const host = u.hostname;
    const { data: fuzzy } = await supabase
      .from('brands')
      .select('brand_name, overall_score')
      .ilike('brand_url', `%${host}%`)
      .limit(1)
      .maybeSingle();

    if (fuzzy) return { brand: fuzzy.brand_name, score: fuzzy.overall_score };

    return { brand: null, score: null };
  } catch (e) {
    console.error('[background] queryOverallScoreByUrl exception', e);
    throw e;
  }
}

/** Fetch all brands */
async function fetchBrands() {
  const { data, error } = await supabase.from("brands").select("*");
  if (error) {
    console.error("Supabase query error:", error);
    return [];
  }
  return data;
}

/** Get sustainable recommendations */
async function getTopRecommendations(hostname: string) {
  const brands = await fetchBrands();

  const currentBrand = brands.find((b) => {
    try {
      return hostname.includes(new URL(b.brand_url).hostname);
    } catch {
      return false;
    }
  });

  const priceTier = currentBrand?.price_tier;

  const recommendations = brands
    .filter((b) => b.overall_score >= 60)
    .filter((b) => (priceTier ? b.price_tier === priceTier : true))
    .sort((a, b) => b.overall_score - a.overall_score)
    .slice(0, 5);

  return { currentBrand, recommendations };
}

/** Message Handler */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderInfo = { tabId: sender?.tab?.id, frameId: sender?.frameId };
  try {
    console.log('[background] received message', message?.type, senderInfo);

    if (message?.type === 'GET_BRAND_SCORE') {
      queryOverallScore(message.brand)
        .then((score) => sendResponse({ ok: true, score }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    if (message?.type === 'GET_BRAND_SCORE_BY_URL') {
      queryOverallScoreByUrl(message.url)
        .then((res) => sendResponse({ ok: true, brand: res.brand, score: res.score }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    if (message.type === "GET_RECOMMENDED_BRANDS") {
      getTopRecommendations(message.hostname)
        .then(result => sendResponse({ ok: true, ...result }))
        .catch(err => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    if (message?.type === 'GET_SIMILAR_ITEMS') {
      const k = Number.isFinite(message.k) ? message.k : undefined;
      requestSimilarItems(message.imageDataUrl, k)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((err) =>
          sendResponse({ ok: false, error: String(err instanceof Error ? err.message : err) })
        );
      return true;
    }

    /** UPDATED: CORS-safe background image fetch */
    if (message?.type === 'FETCH_IMAGE_AS_DATA_URL') {
      console.log('[background] FETCH_IMAGE_AS_DATA_URL', {
        url: message.url,
        sender: senderInfo,
      });
      fetchUrlAsDataUrl(message.url)
        .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
        .catch((err) =>
          sendResponse({ ok: false, error: String(err instanceof Error ? err.message : err) })
        );
      return true;
    }
  } catch (e) {
    console.error('[background] onMessage exception', e);
    sendResponse?.({ ok: false, error: String(e) });
  }

  return false;
});
