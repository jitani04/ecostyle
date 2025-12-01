/*
  Content script: detect main product image on ecommerce/clothing pages

  Features:
  - `detectMainProductImage()` scans <img> elements and other signals, filters
    out icons/logos/tiny/invisible images, scores candidates by display size,
    closeness to viewport center, and portrait orientation, and returns the
    best candidate.
  - `fetchAndSendToBackend(imageUrl)` fetches the image as a Blob and POSTS it
    to http://127.0.0.1:8000/embedding as FormData. Best-effort with timeouts.
  - Listens for `CAPTURE_PRODUCT_IMAGE` messages and responds with
    { ok: true, imageDataUrl } (data URL when possible) or { ok: false, error }.
  - Sends a background message `{ type: 'product-image-detected', imageUrl }`.
  - No UI elements are injected.

  Usage: drop this file into the extension as `content.js` (Manifest V3
  content script). No UI elements are injected.
*/

(function () {
  'use strict';

  const MIN_NATURAL_DIM = 150; // ignore images smaller than this (intrinsic)
  const MIN_RENDERED_DIM = 50; // ignore rendered images smaller than this
  const FETCH_TIMEOUT = 10000; // ms

  function isElementVisible(el) {
    if (!el) return false;
    if (!(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false;
    // offsetParent is null for display:none or elements not in layout (but can be null for fixed positioned in some contexts)
    if (el.offsetParent === null && style.position !== 'fixed' && style.position !== 'sticky') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    // not offscreen entirely
    if (rect.bottom < 0 || rect.right < 0 || rect.top > (window.innerHeight || document.documentElement.clientHeight) || rect.left > (window.innerWidth || document.documentElement.clientWidth)) return false;
    return true;
  }

  function resolveImageUrl(img) {
    // Prefer currentSrc (accounts for srcset), fall back to common attributes used by lazy loaders
    const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || img.getAttribute('srcset') || '';
    try {
      return src ? new URL(src.split(' ')[0], location.href).href : '';
    } catch (e) {
      return '';
    }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed converting blob to data URL'));
      reader.readAsDataURL(blob);
    });
  }

  async function tryFetchAsDataUrl(url, timeout = FETCH_TIMEOUT) {
    // Try fetching image via fetch() to avoid canvas tainting when CORS is allowed.
    if (!url) throw new Error('Empty image URL');
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, { mode: 'cors', signal: controller.signal });
      clearTimeout(id);
      if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
      const blob = await resp.blob();
      return await blobToDataURL(blob);
    } finally {
      clearTimeout(id);
    }
  }

  async function canvasFallbackToDataUrl(url, imgEl, timeout = 5000) {
    // Create an image element with crossOrigin anonymous and draw to canvas.
    // This will fail (taint the canvas) if server doesn't allow CORS.
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let timer = setTimeout(() => {
        img.src = '';
        reject(new Error('Image load timeout'));
      }, timeout);
      img.onload = async () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error('Image load error'));
      };
      img.src = url;
    });
  }

  function getMetaImage() {
    // Try common metadata (og:image, twitter:image, link rel=image_src)
    const og = document.querySelector('meta[property="og:image"]') || document.querySelector('meta[name="og:image"]');
    if (og && og.content) return og.content;
    const tw = document.querySelector('meta[name="twitter:image"]');
    if (tw && tw.content) return tw.content;
    const link = document.querySelector('link[rel="image_src"]');
    if (link && link.href) return link.href;
    // Schema.org itemprop images
    const itemImg = document.querySelector('[itemprop="image"]');
    if (itemImg) {
      if (itemImg.tagName === 'IMG') return resolveImageUrl(itemImg);
      if (itemImg.content) return itemImg.content;
    }
    return null;
  }

  function collectImageCandidates() {
    const imgs = Array.from(document.getElementsByTagName('img'));
    const candidates = [];
    for (const img of imgs) {
      try {
        if (!isElementVisible(img)) continue;
        const naturalW = img.naturalWidth || 0;
        const naturalH = img.naturalHeight || 0;
        if (naturalW < MIN_NATURAL_DIM || naturalH < MIN_NATURAL_DIM) continue;
        const rect = img.getBoundingClientRect();
        if (rect.width < MIN_RENDERED_DIM || rect.height < MIN_RENDERED_DIM) continue;
        const url = resolveImageUrl(img);
        if (!url) continue;
        // heuristics to skip known icons/logos by file name
        const lower = url.toLowerCase();
        if (/(logo|sprite|icon|thumb|avatar|badge|pixel)/.test(lower)) continue;

        candidates.push({ img, url, naturalW, naturalH, rect });
      } catch (e) {
        // ignore problematic images
        continue;
      }
    }
    return candidates;
  }

  function scoreCandidates(candidates) {
    if (!candidates || candidates.length === 0) return [];
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const centerX = vw / 2;
    const centerY = vh / 2;
    let maxArea = 0;
    for (const c of candidates) {
      const area = Math.max(0, c.rect.width) * Math.max(0, c.rect.height);
      c.area = area;
      if (area > maxArea) maxArea = area;
    }
    const maxDistance = Math.hypot(centerX, centerY);
    for (const c of candidates) {
      // size score (0-1)
      const sizeScore = maxArea > 0 ? c.area / maxArea : 0;
      // center proximity score (0-1)
      const cx = c.rect.left + c.rect.width / 2;
      const cy = c.rect.top + c.rect.height / 2;
      const dist = Math.hypot(Math.abs(cx - centerX), Math.abs(cy - centerY));
      const centerScore = 1 - Math.min(1, dist / maxDistance);
      // portrait orientation bonus
      const portrait = (c.naturalH > c.naturalW || c.rect.height > c.rect.width) ? 1 : 0;
      const portraitScore = portrait;
      // weighted total
      const total = sizeScore * 0.6 + centerScore * 0.25 + portraitScore * 0.15;
      c.score = total;
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  async function detectMainProductImage() {
    // 1) Try meta tags first
    try {
      const meta = getMetaImage();
      if (meta) {
        const absolute = new URL(meta, location.href).href;
        return { imageUrl: absolute, reason: 'meta' };
      }
    } catch (e) {
      // ignore
    }

    // 2) Try structured data images (e.g., schema.org product image)
    try {
      // Many sites have <img itemprop="image"> or JSON-LD with image fields.
      const itemImg = document.querySelector('img[itemprop="image"]');
      if (itemImg && isElementVisible(itemImg)) {
        const url = resolveImageUrl(itemImg);
        if (url) return { imageUrl: url, reason: 'itemprop' };
      }
      // parse simple JSON-LD for images (best-effort)
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || '{}');
          if (!data) continue;
          // product.image could be string or array
          const possible = data.image || data['@type'] === 'Product' && data.image;
          if (possible) {
            const url = Array.isArray(possible) ? possible[0] : possible;
            if (url) return { imageUrl: new URL(url, location.href).href, reason: 'json-ld' };
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      // ignore
    }

    // 3) Collect and score <img> candidates
    const candidates = collectImageCandidates();
    const scored = scoreCandidates(candidates);
    if (scored.length > 0) {
      const best = scored[0];
      return { imageUrl: best.url, score: best.score, reason: 'scored' };
    }

    // 4) No good candidate found
    return { imageUrl: null, error: 'no-candidate' };
  }

  async function fetchAndSendToBackend(imageUrl) {
    if (!imageUrl) throw new Error('No imageUrl provided');
    // Try fetch -> blob -> send as FormData
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const resp = await fetch(imageUrl, { mode: 'cors', signal: controller.signal });
      clearTimeout(id);
      if (!resp.ok) throw new Error('Image fetch failed: ' + resp.status);
      const blob = await resp.blob();

      const form = new FormData();
      // Try to infer filename
      const filename = (imageUrl.split('/').pop() || 'image').split('?')[0];
      form.append('file', blob, filename);

      const backendResp = await fetch('http://127.0.0.1:8000/embedding', {
        method: 'POST',
        body: form,
      });
      if (!backendResp.ok) {
        const text = await backendResp.text();
        throw new Error('Backend responded with ' + backendResp.status + ' - ' + text);
      }
      return await backendResp.json();
    } finally {
      clearTimeout(id);
    }
  }

  // Message listener for CAPTURE_PRODUCT_IMAGE
  chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'CAPTURE_PRODUCT_IMAGE') return;
    (async () => {
      try {
        const detected = await detectMainProductImage();
        if (!detected || !detected.imageUrl) {
          sendResponse({ ok: false, error: detected && detected.error ? detected.error : 'no-image-detected' });
          return;
        }

        const imageUrl = detected.imageUrl;

        // Best-effort: try to produce a data URL. Prefer fetch->blob->dataURL to avoid canvas taint.
        let dataUrl = null;
        try {
          dataUrl = await tryFetchAsDataUrl(imageUrl);
        } catch (fetchErr) {
          // fallback to canvas drawing (may fail due to CORS)
          try {
            dataUrl = await canvasFallbackToDataUrl(imageUrl);
          } catch (canvasErr) {
            // ignore — we'll still send the URL
            dataUrl = null;
          }
        }

        // Notify background about detected product image
        try {
          chrome.runtime.sendMessage({ type: 'product-image-detected', imageUrl });
        } catch (e) {
          console.warn('Failed to send product-image-detected message', e);
        }

        sendResponse({ ok: true, imageDataUrl: dataUrl, imageUrl, reason: detected.reason || 'detected' });
      } catch (err) {
        console.error('[content-script] CAPTURE_PRODUCT_IMAGE error', err);
        try { sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }); } catch (e) {}
      }
    })();
    return true; // keep the message channel open for async response
  });

  // Expose the detection function on window for debugging or direct invocation
  try {
    window.__ecostyle_detectMainProductImage = detectMainProductImage;
    window.__ecostyle_fetchAndSendToBackend = fetchAndSendToBackend;
  } catch (e) {
    // ignore non-writable window in some sandboxed contexts
  }

  console.log('[EcoStyle] content script ready');
})();
