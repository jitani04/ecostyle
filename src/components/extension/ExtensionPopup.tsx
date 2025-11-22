import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaf, TrendingUp, Award, Settings } from "lucide-react";
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
      </div>

      <div className="space-y-3">
  <div className="flex items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Show Recommendations</p>
              <p className="text-xs text-muted-foreground">When viewing products</p>
            </div>
          </div>
        </div>

  <div className="flex items-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Brand Scores</p>
              <p className="text-xs text-muted-foreground">Display sustainability ratings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Your Impact</span>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            <Leaf className="w-3 h-3 mr-1" />
            12 eco choices
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          You've viewed 12 sustainable alternatives this month. Keep it up! 🌱
        </p>
      </div>

      <div className="space-y-2">
        <Button onClick={getBrandScore} className="w-full bg-indigo-600 hover:opacity-90 transition-opacity">
          Get Brand Score
        </Button>
        <Button onClick={getRecommendations} className="w-full bg-emerald-600 hover:opacity-90 transition-opacity">
          Show Recommended Brands
        </Button>
        <Button onClick={openDashboard} className="w-full bg-gradient-to-r from-primary to-earth-moss hover:opacity-90 transition-opacity">
          View Full Dashboard
        </Button>
      </div>
      {/* Inline result area */}
      <div className="pt-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : score !== null ? (
          <div className="text-sm">
            <div className="font-medium">{foundBrand ?? 'Brand'}</div>
            <div className="text-xs text-muted-foreground">Overall score: {score}</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No brand score loaded</div>
        )}
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
                    Score: {b.overall_score}
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </div>
                </a>
              // <div key={i} className="p-2 border rounded-lg text-sm">
              //   <div className="font-medium">{b.brand_name}</div>
              //   <div className="text-xs text-muted-foreground">
              //     Score: {b.overall_score}
              //   </div>
              // </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
};
