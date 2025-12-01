// Universal Product Image Detector
// Runs in all frames; responds to CAPTURE_PRODUCT_IMAGE by asking the background
// worker to fetch the image (no-cors blob -> data URL) so canvas tainting is avoided.

declare const chrome: any;

const DEBUG = true;
const MIN_RENDERED = 48;
const MIN_NATURAL = 120;
const MUTATION_DEBOUNCE = 300;
const BACKGROUND_TIMEOUT = 12000;

type Candidate = {
  el: HTMLImageElement;
  url: string;
  rect: DOMRect;
  naturalWidth: number;
  naturalHeight: number;
  score: number;
  reason: string;
};

let lastClicked: Candidate | null = null;
let currentMain: Candidate | null = null;
let mutationTimer: number | null = null;

const frameLabel = (() => {
  try {
    return window.top === window ? 'top' : 'child';
  } catch {
    return 'cross-child';
  }
})();

function log(...args: unknown[]) {
  if (!DEBUG) return;
  try {
    console.log(`[detector][${frameLabel}]`, ...args);
  } catch {
    // noop
  }
}

function resolveImageUrl(img: HTMLImageElement): string {
  const raw =
    img.currentSrc ||
    img.src ||
    img.getAttribute('data-src') ||
    img.getAttribute('data-lazy-src') ||
    img.getAttribute('data-original') ||
    img.getAttribute('srcset') ||
    '';

  if (!raw) return '';

  const token = raw.split(' ')[0];
  try {
    return new URL(token, location.href).href;
  } catch {
    return token;
  }
}

function isVisible(img: HTMLImageElement) {
  const style = window.getComputedStyle(img);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return null;
  }

  const rect = img.getBoundingClientRect();
  if (rect.width < MIN_RENDERED || rect.height < MIN_RENDERED) return null;
  if (rect.bottom <= 0 || rect.right <= 0) return null;
  if (rect.top >= window.innerHeight || rect.left >= window.innerWidth) return null;

  return rect;
}

function scoreCandidate(img: HTMLImageElement, rect: DOMRect, url: string): Candidate {
  const area = rect.width * rect.height;
  const vw = window.innerWidth || document.documentElement.clientWidth || 1;
  const vh = window.innerHeight || document.documentElement.clientHeight || 1;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dist = Math.hypot(Math.abs(cx - vw / 2), Math.abs(cy - vh / 2));
  const maxDist = Math.hypot(vw / 2, vh / 2) || 1;
  const centerScore = 1 - Math.min(1, dist / maxDist);

  const naturalW = img.naturalWidth || 0;
  const naturalH = img.naturalHeight || 0;
  const naturalArea = Math.max(naturalW * naturalH, 1);
  const portraitBonus = rect.height > rect.width || naturalH > naturalW ? 0.15 : 0;

  const attrBoost =
    (img.closest('[itemprop="image"]') ? 0.25 : 0) +
    (img.closest('picture') ? 0.1 : 0) +
    (/zoom|product|hero/i.test(img.className) ? 0.1 : 0);

  const score =
    0.55 * (area / Math.max(vw * vh, 1)) +
    0.25 * centerScore +
    portraitBonus +
    attrBoost;

  return {
    el: img,
    url,
    rect,
    naturalWidth: naturalW,
    naturalHeight: naturalH,
    score,
    reason: 'scored',
  };
}

function candidateFromMeta(): Candidate | null {
  const tags = [
    document.querySelector('meta[property="og:image"]'),
    document.querySelector('meta[name="og:image"]'),
    document.querySelector('meta[name="twitter:image"]'),
  ].filter(Boolean) as HTMLMetaElement[];

  for (const tag of tags) {
    if (!tag?.content) continue;
    try {
      const metaUrl = new URL(tag.content, location.href).href;
      return {
        el: document.body as unknown as HTMLImageElement,
        url: metaUrl,
        rect: new DOMRect(0, 0, 0, 0),
        naturalWidth: 0,
        naturalHeight: 0,
        score: 0.1,
        reason: 'meta',
      };
    } catch {
      continue;
    }
  }

  return null;
}

function collectCandidates(): Candidate[] {
  const list: Candidate[] = [];

  for (const img of Array.from(document.images)) {
    try {
      const rect = isVisible(img);
      if (!rect) continue;

      const naturalW = img.naturalWidth || 0;
      const naturalH = img.naturalHeight || 0;
      if (naturalW < MIN_NATURAL || naturalH < MIN_NATURAL) continue;

      const url = resolveImageUrl(img);
      if (!url || /(sprite|icon|logo|avatar|thumb|badge)/i.test(url)) continue;

      const cand = scoreCandidate(img, rect, url);
      list.push(cand);
    } catch {
      continue;
    }
  }

  // If nothing visible, try meta tags to give the popup something to work with.
  if (list.length === 0) {
    const meta = candidateFromMeta();
    if (meta) list.push(meta);
  }

  return list.sort((a, b) => b.score - a.score);
}

function describeCandidate(c: Candidate) {
  return {
    url: c.url,
    score: Number(c.score.toFixed(3)),
    rect: { w: Math.round(c.rect.width), h: Math.round(c.rect.height) },
    natural: { w: c.naturalWidth, h: c.naturalHeight },
    reason: c.reason,
  };
}

function setCurrent(candidate: Candidate, origin: string) {
  currentMain = candidate;
  log('main image set via', origin, describeCandidate(candidate));

  try {
    chrome?.runtime?.sendMessage({
      type: 'PRODUCT_IMAGE_DETECTED',
      imageUrl: candidate.url,
      frame: frameLabel,
      origin,
      naturalWidth: candidate.naturalWidth,
      naturalHeight: candidate.naturalHeight,
    });
  } catch {
    // ignore
  }
}

function detectMainImage(origin: string): Candidate | null {
  const candidates = collectCandidates();
  const best = candidates[0] || null;
  if (best) best.reason = best.reason || 'scored';

  if (best) log('detected candidate', origin, describeCandidate(best));
  else log('no candidate found', origin);

  return best;
}

function scheduleMutationScan() {
  if (mutationTimer) window.clearTimeout(mutationTimer);
  mutationTimer = window.setTimeout(() => {
    const found = detectMainImage('mutation');
    if (found && (!currentMain || found.url !== currentMain.url)) {
      setCurrent(found, 'mutation');
    }
  }, MUTATION_DEBOUNCE);
}

function fetchDataUrlViaBackground(url: string) {
  return new Promise<string | null>((resolve, reject) => {
    if (!url) {
      reject(new Error('Missing image URL'));
      return;
    }

    const timer = window.setTimeout(() => {
      reject(new Error('Background fetch timeout'));
    }, BACKGROUND_TIMEOUT);

    try {
      chrome.runtime.sendMessage(
        { type: 'FETCH_IMAGE_AS_DATA_URL', url },
        (resp: any) => {
          window.clearTimeout(timer);

          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (!resp) {
            reject(new Error('No response from background'));
            return;
          }

          if (resp.ok && resp.dataUrl) {
            resolve(resp.dataUrl);
          } else if (resp.ok) {
            resolve(null);
          } else {
            reject(new Error(resp.error || 'Background fetch failed'));
          }
        }
      );
    } catch (e) {
      window.clearTimeout(timer);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

function handleCaptureProductImage(sendResponse: (payload: unknown) => void) {
  const found = detectMainImage('message');

  if (!found || !found.url) {
    sendResponse({ ok: false, error: 'no-image-found', frame: frameLabel });
    return;
  }

  setCurrent(found, 'message');

  fetchDataUrlViaBackground(found.url)
    .then((dataUrl) => {
      sendResponse({
        ok: true,
        imageUrl: found.url,
        imageDataUrl: dataUrl,
        reason: found.reason,
        frame: frameLabel,
        naturalWidth: found.naturalWidth,
        naturalHeight: found.naturalHeight,
      });
    })
    .catch((err) => {
      log('background fetch failed; returning URL only', err);
      sendResponse({
        ok: false,
        error: String(err instanceof Error ? err.message : err),
        imageUrl: found.url,
        frame: frameLabel,
      });
    });
}

// --- Event wiring ---
document.addEventListener(
  'click',
  (ev) => {
    const target = ev.target as Element | null;
    const img = target instanceof HTMLImageElement ? target : target?.closest('img');
    if (img instanceof HTMLImageElement) {
      const rect = isVisible(img);
      if (!rect) return;

      const url = resolveImageUrl(img);
      if (!url) return;

      lastClicked = scoreCandidate(img, rect, url);
      lastClicked.reason = 'click';
      setCurrent(lastClicked, 'click');
    }
  },
  { capture: true }
);

const observer = new MutationObserver(scheduleMutationScan);
observer.observe(document.documentElement || document.body, {
  childList: true,
  attributes: true,
  subtree: true,
});

// Listen for popup requests
try {
  chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
    if (!message || message.type !== 'CAPTURE_PRODUCT_IMAGE') return undefined;

    // Only the top frame should respond to avoid child iframes replying with "no-image-found".
    if (frameLabel !== 'top') {
      log('ignoring CAPTURE_PRODUCT_IMAGE in non-top frame');
      return undefined;
    }

    log('CAPTURE_PRODUCT_IMAGE received');

    handleCaptureProductImage(sendResponse);
    return true;
  });
} catch (e) {
  log('failed to register onMessage listener', e);
}

// Initial scan once DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  const initial = detectMainImage('init');
  if (initial) setCurrent(initial, 'init');
} else {
  document.addEventListener('DOMContentLoaded', () => {
    const initial = detectMainImage('domcontentloaded');
    if (initial) setCurrent(initial, 'domcontentloaded');
  });
}

// Expose debug helpers
try {
  (window as any).__ECOSTYLE_DEBUG = {
    scan: () => detectMainImage('manual'),
    current: () => currentMain,
  };
} catch {
  // ignore
}

log('content script loaded', {
  frame: frameLabel,
  images: document.images.length,
  href: location.href,
});
