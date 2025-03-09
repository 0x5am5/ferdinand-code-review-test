import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandAsset } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface ColorManagerProps {
  clientId: number;
  colors: BrandAsset[];
}

interface ColorData {
  hex: string;
  rgb?: string;
  hsl?: string;
  cmyk?: string;
  pantone?: string;
  name: string;
  category: 'brand' | 'neutral' | 'interactive';
}

const DEFAULT_COLORS = {
  brand: [
    { hex: '#FF983B', name: 'Neon Carrot', category: 'brand' },
    { hex: '#AA3A39', name: 'Medium Carmine', category: 'brand' },
    { hex: '#FE4E4E', name: 'Sunset Orange', category: 'brand' },
  ],
  neutral: Array.from({ length: 11 }, (_, i) => ({
    hex: `#${Math.floor((i * 255) / 10).toString(16).padStart(2, '0').repeat(3)}`,
    name: `Gray ${i * 10}`,
    category: 'neutral'
  })),
  interactive: [
    { hex: '#EE5397', name: 'Brilliant Rose', category: 'interactive' },
    { hex: '#634490', name: 'Affair', category: 'interactive' },
    { hex: '#3466A5', name: 'Azure', category: 'interactive' },
    { hex: '#00C4D4', name: "Robin's Egg Blue", category: 'interactive' },
  ],
} as const;

function ColorChip({ color }: { color: ColorData }) {
  return (
    <div className="min-w-[200px] border rounded-lg p-4 bg-white">
      <div 
        className="h-20 rounded-md mb-3" 
        style={{ backgroundColor: color.hex }}
      />
      <div className="space-y-2">
        <h4 className="font-medium">{color.name}</h4>
        <div className="space-y-1 text-sm">
          <p>HEX: {color.hex}</p>
          {color.rgb && <p>RGB: {color.rgb}</p>}
          {color.hsl && <p>HSL: {color.hsl}</p>}
          {color.cmyk && <p>CMYK: {color.cmyk}</p>}
          {color.pantone && <p>Pantone: {color.pantone}</p>}
        </div>
      </div>
    </div>
  );
}

function ColorSection({ title, colors, onAddColor }: { 
  title: string;
  colors: ColorData[];
  onAddColor: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Button variant="outline" size="icon" onClick={onAddColor}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <div className="flex w-max space-x-4 p-4">
          {colors.map((color, index) => (
            <ColorChip key={`${color.hex}-${index}`} color={color} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export function ColorManager({ clientId, colors = [] }: ColorManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'brand' | 'neutral' | 'interactive'>('brand');

  // If no colors are provided, use the default colors
  const brandColors = colors.length ? colors.filter(c => c.category === 'brand') : DEFAULT_COLORS.brand;
  const neutralColors = colors.length ? colors.filter(c => c.category === 'neutral') : DEFAULT_COLORS.neutral;
  const interactiveColors = colors.length ? colors.filter(c => c.category === 'interactive') : DEFAULT_COLORS.interactive;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Color System</h2>
      </div>

      <div className="space-y-8">
        <ColorSection 
          title="Brand Colors" 
          colors={brandColors}
          onAddColor={() => {
            setSelectedCategory('brand');
            setIsAddingColor(true);
          }}
        />
        
        <ColorSection 
          title="Neutral Colors" 
          colors={neutralColors}
          onAddColor={() => {
            setSelectedCategory('neutral');
            setIsAddingColor(true);
          }}
        />
        
        <ColorSection 
          title="Interactive Colors" 
          colors={interactiveColors}
          onAddColor={() => {
            setSelectedCategory('interactive');
            setIsAddingColor(true);
          }}
        />
      </div>

      <Dialog open={isAddingColor} onOpenChange={setIsAddingColor}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Color</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Color Name</Label>
              <Input id="name" placeholder="e.g., Primary Blue" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hex">Hex Code</Label>
              <Input id="hex" placeholder="#000000" />
            </div>
            {/* Add other color format inputs as needed */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
