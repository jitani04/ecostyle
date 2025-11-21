import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Leaf, ExternalLink, TrendingUp } from "lucide-react";

interface Product {
  name: string;
  price: number;
  image: string;
  sustainabilityScore: number;
}

interface ProductRecommendationsProps {
  currentProduct: Product;
}

const alternatives: Product[] = [
  {
    name: "Organic Cotton Essential Tee",
    price: 34.99,
    image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400",
    sustainabilityScore: 88
  },
  {
    name: "Recycled Fabric Basic Tee",
    price: 31.99,
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400",
    sustainabilityScore: 82
  },
  {
    name: "Hemp Blend Classic T-Shirt",
    price: 36.99,
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400",
    sustainabilityScore: 91
  }
];

export const ProductRecommendations = ({ currentProduct }: ProductRecommendationsProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Sustainable Alternatives</h3>
          <p className="text-xs text-muted-foreground">Better choices for the planet</p>
        </div>
      </div>

      <div className="grid gap-3">
        {alternatives.map((product, index) => (
          <Card key={index} className="p-3 hover:shadow-md transition-shadow border">
            <div className="flex gap-3">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-medium text-sm text-foreground line-clamp-2">
                    {product.name}
                  </h4>
                  <Badge 
                    className="bg-primary/10 text-primary border-primary/20 shrink-0"
                    variant="outline"
                  >
                    {product.sustainabilityScore}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  ${product.price.toFixed(2)}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{product.sustainabilityScore - currentProduct.sustainabilityScore} vs current</span>
                  </div>
                </div>
              </div>
            </div>
            <Button 
              size="sm" 
              className="w-full mt-3 bg-gradient-to-r from-primary to-earth-moss hover:opacity-90 transition-opacity"
            >
              View Product
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-3 bg-primary/5 border-primary/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          💡 <span className="font-medium text-foreground">Tip:</span> These alternatives have higher sustainability scores and similar styles to your current selection.
        </p>
      </Card>
    </div>
  );
};
