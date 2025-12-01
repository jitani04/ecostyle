import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaf, Settings } from "lucide-react";
import { ExternalLink } from "lucide-react";

// `chrome` may not be available in non-extension contexts; declare for TS
declare const chrome: any;

export const ExtensionPopup = () => {
  const openDashboard = () => {
    try {
      // Prefer chrome.runtime URL when available (extension context)
      const base = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL("index.html")
        : "/index.html";
      const url = `${base}#/dashboard`;
      window.open(url, "_blank");
    } catch (e) {
      // Fallback
      window.open("/index.html#/dashboard", "_blank");
    }
  };

  const [loading, setLoading] = React.useState(false);
  const [score, setScore] = React.useState<number | null>(null);
  const [foundBrand, setFoundBrand] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [recsLoading, setRecsLoading] = React.useState(false);
  const [recommendations, setRecommendations] = React.useState<any[]>([]);
  const [currentBrandTier, setCurrentBrandTier] = React.useState<string | null>(null);

  // Image capture state for "See similar sustainable pieces"
  const [imgLoading, setImgLoading] = React.useState(false);
  const [productImage, setProductImage] = React.useState<string | null>(null);
  const [similarLoading, setSimilarLoading] = React.useState(false);
  const [similarItems, setSimilarItems] = React.useState<Array<{ score: number; image_path?: string; image_url?: string }>>([]);
  // Remove dropzone fallback; we will always show a loading state

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setImgLoading(true);
    setError(null);
    setSimilarItems([]);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProductImage(dataUrl);
      fetchSimilarItems(dataUrl);
    } catch (e) {
      setError(String(e));
    } finally {
      setImgLoading(false);
    }
  };

  const fetchSimilarItems = (imageDataUrl: string) => {
    if (!chrome?.runtime?.sendMessage) {
      setError('Extension APIs not available');
      return;
    }

    setError(null);
    setSimilarLoading(true);
    setSimilarItems([]);

    try { console.log('[popup] requesting GET_SIMILAR_ITEMS'); } catch {}
    chrome.runtime.sendMessage(
      { type: 'GET_SIMILAR_ITEMS', imageDataUrl, k: 3 },
      (resp: any) => {
        if (chrome.runtime?.lastError) {
          try { console.error('[popup] similar-items lastError', chrome.runtime.lastError); } catch {}
          setError(String(chrome.runtime.lastError.message || chrome.runtime.lastError));
          setSimilarLoading(false);
          return;
        }

        if (!resp) {
          setError('No response from background');
          setSimilarLoading(false);
          return;
        }

        try { console.log('[popup] similar-items response', resp); } catch {}
        if (resp.ok) {
          setSimilarItems(resp.matches ?? []);
        } else {
          setError(resp.error ?? 'Failed to fetch similar items');
        }

        setSimilarLoading(false);
      },
    );
  };

  const getBrandScore = () => {
    setLoading(true);
    setError(null);
    setScore(null);
    setFoundBrand(null);

    try {
      if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.runtime) {
        setError('Extension APIs not available');
        setLoading(false);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        if (chrome.runtime.lastError) {
          console.error('[popup] tabs.query error', chrome.runtime.lastError);
          setError(String(chrome.runtime.lastError.message || chrome.runtime.lastError));
          setLoading(false);
          return;
        }

        const tab = tabs && tabs[0];
        const url = tab?.url;
        if (!url) {
          setError('Could not determine active tab URL');
          setLoading(false);
          return;
        }

        console.log('[popup] sending GET_BRAND_SCORE_BY_URL for', url);
        chrome.runtime.sendMessage({ type: 'GET_BRAND_SCORE_BY_URL', url }, (resp: any) => {
          if (chrome.runtime.lastError) {
            console.error('[popup] runtime.lastError', chrome.runtime.lastError);
            setError(String(chrome.runtime.lastError.message || chrome.runtime.lastError));
            setLoading(false);
            return;
          }

          if (!resp) {
            setError('No response from background');
            setLoading(false);
            return;
          }

          if (resp.ok) {
            setFoundBrand(resp.brand ?? null);
            setScore(resp.score ?? null);
          } else {
            setError(resp.error ?? 'Unknown error');
          }
          setLoading(false);
        });
      });
    } catch (e) {
      console.error('[popup] getBrandScore exception', e);
      setError(String(e));
      setLoading(false);
    }
  };

  const getRecommendations = () => {
    setRecsLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        const tab = tabs[0];
        if (!tab?.url) {
          setError("Could not determine active tab URL");
          setRecsLoading(false);
          return;
        }

        const hostname = new URL(tab.url).hostname;

        chrome.runtime.sendMessage(
          { type: "GET_RECOMMENDED_BRANDS", hostname },
          (resp: any) => {
            if (chrome.runtime.lastError) {
              setError(String(chrome.runtime.lastError.message));
              setRecsLoading(false);
              return;
            }

            if (!resp) {
              setError("No response from background");
              setRecsLoading(false);
              return;
            }

            if (resp.ok) {
              setCurrentBrandTier(resp.currentBrand?.price_tier ?? null);
              setRecommendations(resp.recommendations ?? []);
            } else {
              setError(resp.error ?? "Unknown error");
            }

            setRecsLoading(false);
          }
        );
      });
    } catch (e) {
      setError(String(e));
      setRecsLoading(false);
    }
  };

  const captureProductImage = () => {
    setImgLoading(true);
    setError(null);
    setProductImage(null);
    setSimilarItems([]);
    setSimilarLoading(false);

    try {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        setError('Extension APIs not available');
        setImgLoading(false);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        const tab = tabs && tabs[0];
        if (!tab?.id) {
          setError('Could not determine active tab');
          setImgLoading(false);
          return;
        }

        try { console.log('[popup] sending CAPTURE_PRODUCT_IMAGE to tab', tab.id); } catch {}
        // Ask content script in the active tab to locate/capture the product image
        chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_PRODUCT_IMAGE' }, (resp: any) => {
          // If content script missing this will set runtime.lastError (receiving end does not exist)
          if (chrome.runtime && chrome.runtime.lastError) {
            try { console.warn('[popup] captureProductImage runtime.lastError', chrome.runtime.lastError); } catch {}
            // show a friendly message rather than a dropzone
            setError('Could not capture the image from this page. Try clicking directly on the product image or refresh the page.');
            setImgLoading(false);
            return;
          }

          if (!resp) {
            // no response — show a friendly message
            setError('No response from content script. Try again after clicking the product image.');
            setImgLoading(false);
            return;
          }

          try { console.log('[popup] capture response', resp); } catch {}
          if (resp.ok && resp.imageDataUrl) {
            setProductImage(resp.imageDataUrl);
            setImgLoading(false);
            fetchSimilarItems(resp.imageDataUrl);
          } else {
            setError(resp.error ?? 'Could not capture image from page');
            setImgLoading(false);
          }
        });
      });
    } catch (e) {
      try { console.error('[popup] capture exception', e); } catch {}
      setError(String(e));
      setImgLoading(false);
    }
  };

  return (
    <Card className="w-80 p-5 space-y-4 border-2 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-earth-moss flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </div>
          <h2 className="font-semibold text-lg text-foreground">EcoStyle</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4" />
        </Button>
      </div> {/* close header div (logo + settings) */}

      <div className="flex flex-col p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors space-y-3">
        {/* Brand score above the buttons */}
        <div className="pt-0">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : score !== null ? (
            <div className="flex flex-col items-center">
              <div className="text-sm font-medium mb-1">{foundBrand ?? 'Brand'}</div>
              <div className="text-3xl font-extrabold text-foreground">
                {Math.round(score)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Overall score</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No brand score loaded</div>
          )}
        </div>

        <div className="space-y-1">
          <Button onClick={getBrandScore} className="w-full bg-gradient-to-br from-primary to-earth-moss text-primary-foreground hover:opacity-90 transition-opacity">
            Get Brand Score
          </Button>
          <Button onClick={getRecommendations} className="w-full bg-gradient-to-br from-primary to-earth-moss text-primary-foreground hover:opacity-90 transition-opacity">
            Show Recommended Brands
          </Button>
          <Button onClick={openDashboard} className="w-full bg-gradient-to-br from-primary to-earth-moss text-primary-foreground hover:opacity-90 transition-opacity">
            View Full Dashboard
          </Button>
          <Button onClick={captureProductImage} className="w-full bg-gradient-to-br from-primary to-earth-moss text-primary-foreground hover:opacity-90 transition-opacity">
            See similar sustainable pieces
          </Button>
        </div>

        {/* Small capture preview */}
        <div className="flex flex-col items-center">
          {imgLoading ? (
            <div className="text-sm text-muted-foreground animate-pulse">Finding similar cute pieces…</div>
          ) : productImage ? (
            <img src={productImage} alt="Captured product" className="w-16 h-16 object-cover rounded mb-2" />
          ) : null}
        </div>

        {similarLoading ? (
          <div className="text-sm text-muted-foreground text-center animate-pulse">Finding similar cute pieces…</div>
        ) : null}

        {!similarLoading && similarItems.length > 0 ? (
          <div className="w-full space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Similar sustainable pieces</div>
            <div className="grid grid-cols-3 gap-2">
            {similarItems.map((item, idx) => {
              const similarity = Number.isFinite(item.score) ? Math.round(item.score * 100) : null;
              const src = item.image_url || item.image_path || '';
              const productUrl = (item as any).item_url || (item as any).product_url || (item as any).page_url || item.image_url || '';
              return (
                <div key={`similar-${idx}`} className="flex flex-col items-center text-center">
                  {src ? (
                    <img
                      src={src}
                      alt="Similar sustainable piece"
                      className="w-20 h-20 object-cover rounded border"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded border flex items-center justify-center text-[10px] text-muted-foreground">
                      No image
                    </div>
                  )}
                  {similarity !== null ? (
                    <span className="mt-1 text-xs text-muted-foreground">{similarity}% match</span>
                  ) : null}
                  {productUrl ? (
                    <a
                      href={productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-[10px] px-2 py-1 border rounded hover:bg-muted/20"
                      title="Open product page in new tab"
                    >
                      Open in new tab
                    </a>
                  ) : null}
                </div>
              );
            })}
            </div>
          </div>
        ) : null}
      </div>
  
      <div className="pt-3">
        {recsLoading ? (
          <div className="text-sm text-muted-foreground">Loading recommendations…</div>
        ) : recommendations.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Recommended Sustainable Brands
            </div>

            <div className="text-xs text-muted-foreground mb-1">
              {currentBrandTier
                ? `Based on your site's price tier: ${currentBrandTier}`
                : "Top sustainable picks"}
            </div>

            {recommendations.map((b, i) => (
                <a
                  key={i}
                  href={b.brand_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 border rounded-lg text-sm hover:bg-muted/10 transition-colors"
                >
                  <div className="font-medium">{b.brand_name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    Score: {Math.round(b.overall_score)}%
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </a>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
};
