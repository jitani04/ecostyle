import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExtensionPopup } from "@/components/extension/ExtensionPopup";
import { BrandInfoOverlay } from "@/components/extension/BrandInfoOverlay";
import { ProductRecommendations } from "@/components/extension/ProductRecommendations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const [activeDemo, setActiveDemo] = useState<"popup" | "brand" | "products">("popup");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-earth-moss flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-earth-brown via-primary to-earth-moss bg-clip-text text-transparent">
              EcoStyle
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Shop sustainably with AI-powered recommendations and brand transparency
          </p>
          <Button 
            onClick={() => navigate("/auth")}
            className="bg-gradient-to-r from-primary to-earth-moss hover:opacity-90"
          >
            Get Started
          </Button>
        </div>

        <Tabs value={activeDemo} onValueChange={(v) => setActiveDemo(v as any)} className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="popup">Extension Popup</TabsTrigger>
            <TabsTrigger value="brand">Brand Info</TabsTrigger>
            <TabsTrigger value="products">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="popup" className="space-y-4">
            <div className="bg-card/50 backdrop-blur p-6 rounded-lg border shadow-lg">
              <h2 className="text-xl font-semibold mb-2 text-foreground">Extension Popup</h2>
              <p className="text-sm text-muted-foreground mb-6">
                This is what appears when you click the extension icon in your browser
              </p>
              <div className="max-w-sm mx-auto">
                <ExtensionPopup />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="brand" className="space-y-4">
            <div className="bg-card/50 backdrop-blur p-6 rounded-lg border shadow-lg">
              <h2 className="text-xl font-semibold mb-2 text-foreground">Brand Sustainability Info</h2>
              <p className="text-sm text-muted-foreground mb-6">
                This overlay appears when browsing a brand's website
              </p>
              <div className="max-w-md mx-auto">
                <BrandInfoOverlay 
                  brandName="Example Fashion Co."
                  sustainabilityScore={72}
                  certifications={["Fair Trade", "Organic Cotton"]}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <div className="bg-card/50 backdrop-blur p-6 rounded-lg border shadow-lg">
              <h2 className="text-xl font-semibold mb-2 text-foreground">Sustainable Alternatives</h2>
              <p className="text-sm text-muted-foreground mb-6">
                These recommendations appear when you click on a clothing item
              </p>
              <ProductRecommendations 
                currentProduct={{
                  name: "Basic Cotton T-Shirt",
                  price: 29.99,
                  image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
                  sustainabilityScore: 45
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
