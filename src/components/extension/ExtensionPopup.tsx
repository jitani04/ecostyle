import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Leaf, TrendingUp, Award, Settings } from "lucide-react";

export const ExtensionPopup = () => {
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
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Show Recommendations</p>
              <p className="text-xs text-muted-foreground">When viewing products</p>
            </div>
          </div>
          <Switch defaultChecked />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Brand Scores</p>
              <p className="text-xs text-muted-foreground">Display sustainability ratings</p>
            </div>
          </div>
          <Switch defaultChecked />
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

      <Button className="w-full bg-gradient-to-r from-primary to-earth-moss hover:opacity-90 transition-opacity">
        View Full Dashboard
      </Button>
    </Card>
  );
};
