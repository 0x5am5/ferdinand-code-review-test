import { Plus, Download, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BrandAsset, FontSource, FontWeight, FontStyle } from "@shared/schema";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface FontManagerProps {
  clientId: number;
  fonts: BrandAsset[];
}

interface FontData {
  id?: number;
  name: string;
  source: typeof FontSource[keyof typeof FontSource];
  weights: string[];
  styles: string[];
  sourceData: {
    projectId?: string;
    url?: string;
    files?: {
      weight: string;
      style: string;
      format: string;
      fileName: string;
      fileData: string;
    }[];
  };
}

function FontCard({ font, onEdit, onDelete }: {
  font: FontData;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const previewText = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative p-6 border rounded-lg bg-white group"
    >
      {/* Quick action menu */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {font.source === 'file' && (
          <Button variant="ghost" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Font info */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{font.name}</h3>
        <p className="text-sm text-muted-foreground">
          {font.weights.length} weights · {font.styles.length} styles
        </p>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        {font.weights.map(weight => (
          <div key={weight} className="space-y-2">
            {font.styles.map(style => (
              <div key={`${weight}-${style}`} className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {weight} {style !== 'normal' ? style : ''}
                </p>
                <p
                  className="text-xl truncate"
                  style={{
                    fontFamily: font.name,
                    fontWeight: weight,
                    fontStyle: style,
                  }}
                >
                  {previewText}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AddFontCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/80 transition-colors"
      onClick={onClick}
      style={{ minHeight: '300px' }}
    >
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Plus className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center">
        <h3 className="font-medium">Add New Font</h3>
        <p className="text-sm text-muted-foreground">
          Upload files or connect to Adobe/Google Fonts
        </p>
      </div>
    </motion.div>
  );
}

export function FontManager({ clientId, fonts }: FontManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingFont, setIsAddingFont] = useState(false);
  const [selectedSource, setSelectedSource] = useState<keyof typeof FontSource>("FILE");

  const addFont = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to add font");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`]
      });
      toast({
        title: "Success",
        description: "Font added successfully",
      });
      setIsAddingFont(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const parseFontAsset = (asset: BrandAsset): FontData | null => {
    try {
      const data = typeof asset.data === 'string' ? JSON.parse(asset.data) : asset.data;
      if (!data?.source) return null;

      return {
        id: asset.id,
        name: asset.name,
        source: data.source,
        weights: data.weights,
        styles: data.styles,
        sourceData: data.sourceData,
      };
    } catch (error) {
      console.error('Error parsing font asset:', error);
      return null;
    }
  };

  const transformedFonts = fonts
    .filter(asset => asset.category === 'font')
    .map(parseFontAsset)
    .filter((font): font is FontData => font !== null);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Typography System</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {transformedFonts.map((font) => (
            <FontCard
              key={font.id}
              font={font}
              onEdit={() => {/* TODO: Implement edit */}}
              onDelete={() => {/* TODO: Implement delete */}}
            />
          ))}
        </AnimatePresence>
        <AddFontCard onClick={() => setIsAddingFont(true)} />
      </div>

      <Dialog open={isAddingFont} onOpenChange={setIsAddingFont}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Font</DialogTitle>
            <DialogDescription>
              Add fonts from your computer or connect to Adobe/Google Fonts
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="file" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="file">Upload Files</TabsTrigger>
              <TabsTrigger value="adobe">Adobe Fonts</TabsTrigger>
              <TabsTrigger value="google">Google Fonts</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label>Font Files</Label>
                <Input
                  type="file"
                  accept=".woff,.woff2,.otf,.ttf,.eot"
                  multiple
                  onChange={(e) => {
                    // TODO: Handle file upload
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Supported formats: WOFF, WOFF2, OTF, TTF, EOT
                </p>
              </div>
            </TabsContent>
            <TabsContent value="adobe" className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label>Adobe Fonts Project ID</Label>
                <Input placeholder="Enter your Adobe Fonts project ID" />
              </div>
            </TabsContent>
            <TabsContent value="google" className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label>Google Fonts URL</Label>
                <Input placeholder="Enter Google Fonts URL" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingFont(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Font</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
