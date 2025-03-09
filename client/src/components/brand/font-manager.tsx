import { Plus, Download, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Form schemas for different font sources
const fileUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, "At least one font file is required"),
  name: z.string().min(1, "Font name is required"),
});

const adobeFontSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "Font name is required"),
});

const googleFontSchema = z.object({
  url: z.string().url("Invalid Google Fonts URL"),
  name: z.string().min(1, "Font name is required"),
});

type FileUploadForm = z.infer<typeof fileUploadSchema>;
type AdobeFontForm = z.infer<typeof adobeFontSchema>;
type GoogleFontForm = z.infer<typeof googleFontSchema>;

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
      className="p-6 border rounded-lg bg-white group"
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
  const [activeTab, setActiveTab] = useState<"file" | "adobe" | "google">("file");

  // Forms for different font sources
  const fileForm = useForm<FileUploadForm>({
    resolver: zodResolver(fileUploadSchema),
  });

  const adobeForm = useForm<AdobeFontForm>({
    resolver: zodResolver(adobeFontSchema),
  });

  const googleForm = useForm<GoogleFontForm>({
    resolver: zodResolver(googleFontSchema),
  });

  const addFont = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: 'POST',
        body: data,
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
      fileForm.reset();
      adobeForm.reset();
      googleForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (data: FileUploadForm) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('category', 'font');
    formData.append('source', FontSource.FILE);

    data.files.forEach((file, index) => {
      formData.append(`font_${index}`, file);
    });

    addFont.mutate(formData);
  };

  const handleAdobeFont = (data: AdobeFontForm) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('category', 'font');
    formData.append('source', FontSource.ADOBE);
    formData.append('projectId', data.projectId);

    addFont.mutate(formData);
  };

  const handleGoogleFont = (data: GoogleFontForm) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('category', 'font');
    formData.append('source', FontSource.GOOGLE);
    formData.append('url', data.url);

    addFont.mutate(formData);
  };

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

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="file">Upload Files</TabsTrigger>
              <TabsTrigger value="adobe">Adobe Fonts</TabsTrigger>
              <TabsTrigger value="google">Google Fonts</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-4">
              <Form {...fileForm}>
                <form onSubmit={fileForm.handleSubmit(handleFileUpload)} className="space-y-4">
                  <FormField
                    control={fileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Font Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Helvetica Neue" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={fileForm.control}
                    name="files"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Font Files</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".woff,.woff2,.otf,.ttf,.eot"
                            multiple
                            onChange={(e) => onChange(Array.from(e.target.files || []))}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Supported formats: WOFF, WOFF2, OTF, TTF, EOT
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddingFont(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addFont.isPending}>
                      {addFont.isPending ? "Adding..." : "Add Font"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="adobe" className="space-y-4">
              <Form {...adobeForm}>
                <form onSubmit={adobeForm.handleSubmit(handleAdobeFont)} className="space-y-4">
                  <FormField
                    control={adobeForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Font Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Adobe Clean" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={adobeForm.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adobe Fonts Project ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter your Adobe Fonts project ID" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddingFont(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addFont.isPending}>
                      {addFont.isPending ? "Adding..." : "Add Font"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="google" className="space-y-4">
              <Form {...googleForm}>
                <form onSubmit={googleForm.handleSubmit(handleGoogleFont)} className="space-y-4">
                  <FormField
                    control={googleForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Font Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Roboto" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={googleForm.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google Fonts URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://fonts.googleapis.com/css2?family=..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddingFont(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addFont.isPending}>
                      {addFont.isPending ? "Adding..." : "Add Font"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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