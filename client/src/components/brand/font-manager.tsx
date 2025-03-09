import { useState } from "react";
import { Plus, Edit2, Trash2, Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandAsset, FontSource, FontFormat } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Form validation schema
const fontFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  source: z.enum(["adobe", "google", "custom"] as const),
  projectId: z.string().optional(),
  projectUrl: z.string().optional(),
  previewText: z.string().optional(),
}).refine((data) => {
  if (data.source === 'adobe') {
    return !!data.projectId?.trim();
  }
  if (data.source === 'google') {
    return !!data.projectUrl?.trim();
  }
  return true;
}, {
  message: "Required field missing for selected font source",
});

type FontFormData = z.infer<typeof fontFormSchema>;

function FontCard({ font, onEdit, onDelete }: {
  font: FontData;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const previewText = font.previewText || "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";
  const { toast } = useToast();

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={onEdit}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
        {font.source !== "adobe" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={() => {
              // TODO: Implement font download
              toast({
                title: "Coming soon",
                description: "Font download functionality will be available soon.",
              });
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-white/90 hover:bg-white"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Font</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this font? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <div className="p-4">
          <h3 className="text-lg font-semibold">{font.name}</h3>
          <p className="text-sm text-muted-foreground">{font.family}</p>
        </div>

        <div className="border-t border-b bg-gray-50 p-4">
          <div
            className="text-2xl leading-relaxed"
            style={{ fontFamily: font.family }}
          >
            {previewText}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Weights & Styles</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {font.weights.map((weight, index) => (
                <div
                  key={`${weight}-${index}`}
                  className="text-sm p-2 bg-gray-50 rounded"
                  style={{ fontFamily: font.family, fontWeight: weight }}
                >
                  {weight} {font.styles[index] || "Regular"}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Source</Label>
            <p className="text-sm mt-1 capitalize">{font.source}</p>
          </div>

          {font.projectUrl && (
            <div>
              <Label className="text-xs text-muted-foreground">Project Link</Label>
              <a
                href={font.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline block mt-1"
              >
                View Project
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddFontCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="min-h-[200px] border-2 border-dashed rounded-lg hover:bg-accent/50 transition-colors cursor-pointer flex items-center justify-center"
      onClick={onClick}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Plus className="h-8 w-8" />
        <span>Add New Font</span>
      </div>
    </div>
  );
}

export function FontManager({ clientId, fonts }: FontManagerProps) {
  const [isAddingFont, setIsAddingFont] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FontFormData>({
    resolver: zodResolver(fontFormSchema),
    defaultValues: {
      name: '',
      source: 'custom',
    },
  });

  const createFont = useMutation({
    mutationFn: async (data: FontFormData & { formData: FormData }) => {
      const response = await fetch(`/api/clients/${clientId}/assets`, {
        method: 'POST',
        body: data.formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.message || "Failed to upload font");
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
      setUploadedFiles([]);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFont = useMutation({
    mutationFn: async (fontId: number) => {
      const response = await fetch(`/api/clients/${clientId}/assets/${fontId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete font");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/assets`]
      });
      toast({
        title: "Success",
        description: "Font deleted successfully",
      });
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
      if (!data?.family) return null;

      return {
        id: asset.id,
        name: asset.name,
        family: data.family,
        source: data.source,
        weights: data.weights,
        styles: data.styles,
        formats: data.formats,
        files: data.files,
        projectId: data.projectId,
        projectUrl: data.projectUrl,
        previewText: data.previewText,
        characters: data.characters,
      };
    } catch (error) {
      console.error('Error parsing font asset:', error);
      return null;
    }
  };

  // Parse and transform font assets
  const transformedFonts = fonts
    .filter(asset => asset.category === 'typography')
    .map(parseFontAsset)
    .filter((font): font is FontData => font !== null);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Typography System</h2>
      </div>

      {transformedFonts.length === 0 ? (
        <AddFontCard onClick={() => setIsAddingFont(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transformedFonts.map((font) => (
            <FontCard
              key={font.id}
              font={font}
              onEdit={() => {
                toast({
                  title: "Coming soon",
                  description: "Font editing functionality will be available soon.",
                });
              }}
              onDelete={() => font.id && deleteFont.mutate(font.id)}
            />
          ))}
          <AddFontCard onClick={() => setIsAddingFont(true)} />
        </div>
      )}

      <Dialog open={isAddingFont} onOpenChange={setIsAddingFont}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Font</DialogTitle>
            <DialogDescription>
              Add a new font to your typography system. You can connect Adobe Fonts,
              add Google Fonts, or upload custom font files.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                const source = form.getValues('source');

                // Validate based on source
                if (source === 'adobe' && !data.projectId?.trim()) {
                  form.setError('projectId', {
                    type: 'manual',
                    message: 'Adobe Fonts Project ID is required'
                  });
                  return;
                }

                if (source === 'google' && !data.projectUrl?.trim()) {
                  form.setError('projectUrl', {
                    type: 'manual',
                    message: 'Google Fonts URL is required'
                  });
                  return;
                }

                if (source === 'custom' && !uploadedFiles.length) {
                  toast({
                    title: "Error",
                    description: "Please select at least one font file",
                    variant: "destructive",
                  });
                  return;
                }

                // Only include files for custom fonts
                const formData = new FormData();
                formData.append('name', data.name);
                formData.append('category', 'typography');
                formData.append('source', data.source);

                if (source === 'adobe') {
                  formData.append('projectId', data.projectId!);
                } else if (source === 'google') {
                  formData.append('projectUrl', data.projectUrl!);
                } else if (source === 'custom') {
                  uploadedFiles.forEach(file => formData.append('files', file));
                }

                if (data.previewText) {
                  formData.append('previewText', data.previewText);
                }

                createFont.mutate({ formData });
              })}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Font Source</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Reset form errors and uploaded files when changing source
                        form.clearErrors();
                        setUploadedFiles([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adobe">Adobe Fonts</SelectItem>
                        <SelectItem value="google">Google Fonts</SelectItem>
                        <SelectItem value="custom">Upload Font Files</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Font Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Brand Sans" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('source') === 'adobe' && (
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adobe Fonts Project ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter your Adobe Fonts project ID" />
                      </FormControl>
                      <p className="text-sm text-muted-foreground mt-1">
                        You can find this in your Adobe Fonts project settings
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch('source') === 'google' && (
                <FormField
                  control={form.control}
                  name="projectUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Fonts URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://fonts.google.com/specimen/..." />
                      </FormControl>
                      <p className="text-sm text-muted-foreground mt-1">
                        Copy the URL from the font's page on fonts.google.com
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch('source') === 'custom' && (
                <div className="space-y-2">
                  <Label>Font Files</Label>
                  <div className="border-2 border-dashed rounded-lg p-4">
                    <Input
                      type="file"
                      multiple
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          const invalidFiles = files.filter(file => {
                            const ext = file.name.split('.').pop()?.toLowerCase();
                            return !['ttf', 'otf', 'woff', 'woff2'].includes(ext || '');
                          });

                          if (invalidFiles.length > 0) {
                            toast({
                              title: "Invalid file type",
                              description: "Please upload only TTF, OTF, WOFF, or WOFF2 files",
                              variant: "destructive",
                            });
                            return;
                          }

                          setUploadedFiles(files);
                          // Auto-set name if not set
                          if (!form.getValues('name')) {
                            const fileName = files[0].name.split('.')[0];
                            form.setValue('name', fileName);
                          }
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Supported formats: TTF, OTF, WOFF, WOFF2. Files will be automatically converted to all supported formats.
                    </p>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-2">
                        <Label>Selected Files:</Label>
                        <ul className="text-sm text-muted-foreground">
                          {uploadedFiles.map((file, index) => (
                            <li key={index}>{file.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="previewText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preview Text (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="The quick brown fox jumps over the lazy dog" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingFont(false);
                    setUploadedFiles([]);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createFont.isPending}
                >
                  {createFont.isPending ? "Adding..." : "Add Font"}
                </Button>
              </div>
            </form>
          </Form>
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
  family: string;
  source: typeof FontSource[keyof typeof FontSource];
  weights: number[];
  styles: string[];
  formats: typeof FontFormat[keyof typeof FontFormat][];
  files: Array<{
    format: typeof FontFormat[keyof typeof FontFormat];
    weight: number;
    style: string;
    url?: string;
    fileData?: string;
  }>;
  projectId?: string;
  projectUrl?: string;
  previewText?: string;
  characters?: string;
}