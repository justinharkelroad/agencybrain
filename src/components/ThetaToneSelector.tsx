import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Zap, Heart, Sun } from "lucide-react";

interface ThetaToneSelectorProps {
  selectedTone: string;
  onToneChange: (tone: string) => void;
}

const tones = [
  {
    value: 'inspiring',
    label: 'Inspiring',
    icon: Sparkles,
    description: 'Uplifting affirmations focusing on potential and possibility',
    gradient: 'from-purple-500/10 to-pink-500/10 border-purple-500/20'
  },
  {
    value: 'motivational',
    label: 'Motivational',
    icon: Zap,
    description: 'Action-oriented affirmations focusing on drive and achievement',
    gradient: 'from-orange-500/10 to-red-500/10 border-orange-500/20'
  },
  {
    value: 'calm',
    label: 'Calm',
    icon: Heart,
    description: 'Peaceful affirmations focusing on inner peace and balance',
    gradient: 'from-blue-500/10 to-cyan-500/10 border-blue-500/20'
  },
  {
    value: 'energizing',
    label: 'Energizing',
    icon: Sun,
    description: 'Powerful affirmations focusing on strength and vitality',
    gradient: 'from-yellow-500/10 to-amber-500/10 border-yellow-500/20'
  }
];

export function ThetaToneSelector({ selectedTone, onToneChange }: ThetaToneSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Your Tone</h3>
        <p className="text-sm text-muted-foreground">
          Select the energy and style for your personalized affirmations
        </p>
      </div>

      <RadioGroup value={selectedTone} onValueChange={onToneChange}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tones.map((tone) => {
            const Icon = tone.icon;
            const isSelected = selectedTone === tone.value;
            
            return (
              <Label
                key={tone.value}
                htmlFor={tone.value}
                className="cursor-pointer"
              >
                <Card
                  className={`
                    transition-all duration-200 hover:shadow-md
                    ${isSelected 
                      ? `bg-gradient-to-br ${tone.gradient} border-2` 
                      : 'border hover:border-border/60'
                    }
                  `}
                >
                  <CardContent className="p-4 flex items-start space-x-3">
                    <RadioGroupItem
                      value={tone.value}
                      id={tone.value}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Icon className="h-5 w-5" />
                        <span className="font-semibold">{tone.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tone.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Label>
            );
          })}
        </div>
      </RadioGroup>
    </div>
  );
}
