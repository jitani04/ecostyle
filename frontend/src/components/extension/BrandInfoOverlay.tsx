import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Award, Leaf, ExternalLink } from "lucide-react";

interface BrandInfoOverlayProps {
  brandName: string;
  sustainabilityScore: number;
  certifications: string[];
}

export const BrandInfoOverlay = ({ 
  brandName, 
  sustainabilityScore, 
  certifications 
}: BrandInfoOverlayProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-primary";
    if (score >= 40) return "text-yellow-600";
    return "text-destructive";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Great";
    if (score >= 40) return "Good";
    return "Fair";
  };

  return (
    <Card className="p-4 space-y-4 shadow-lg border-2 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg text-foreground">{brandName}</h3>
          <p className="text-xs text-muted-foreground">Sustainability Profile</p>
        </div>
        <div className="flex flex-col items-end">
          <div className={`text-2xl font-bold ${getScoreColor(sustainabilityScore)}`}>
            {sustainabilityScore}
          </div>
          <Badge variant="secondary" className="mt-1 text-xs">
            {getScoreLabel(sustainabilityScore)}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall Score</span>
          <span className="font-medium text-foreground">{sustainabilityScore}/100</span>
        </div>
        <Progress value={sustainabilityScore} className="h-2" />
      </div>

      {certifications.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Award className="w-4 h-4 text-primary" />
            Certifications
          </div>
          <div className="flex flex-wrap gap-1.5">
            {certifications.map((cert, index) => (
              <Badge 
                key={index} 
                variant="outline"
                className="bg-primary/5 border-primary/20 text-xs"
              >
                <Leaf className="w-3 h-3 mr-1 text-primary" />
                {cert}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <button className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors py-2 rounded-md hover:bg-primary/5">
        <span className="font-medium">View Full Report</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </Card>
  );
};
