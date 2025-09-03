import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Edit2, Plus, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface Image {
  id: number;
  url: string;
  fileData: string;
  mimeType: string;
  order: number;
}

interface Section {
  id: number;
  label: string;
  order: number;
  images: Image[];
}

interface DropzoneProps {
  onDrop: (files: File[]) => void;
}

// Separate Dropzone component to manage its own hooks
function ImageDropzone({ onDrop }: DropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
    },
    maxSize: 5 * 1024 * 1024, // 5MB max size
  });

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg aspect-square
        flex items-center justify-center cursor-pointer
        transition-colors
        ${isDragActive ? "border-primary bg-primary/10" : "hover:border-primary"}
      `}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <div className="text-center p-4">
        <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop the image here..."
            : "Drop image here or click to select"}
        </p>
      </div>
    </div>
  );
}

interface InspirationBoardProps {
  clientId: number;
}

export function InspirationBoard({ clientId }: InspirationBoardProps) {
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch sections
  const { data: sections = [] } = useQuery<Section[]>({
    queryKey: [`/api/clients/${clientId}/inspiration/sections`],
    enabled: !!clientId,
  });

  // Create section mutation
  const createSection = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/clients/${clientId}/inspiration/sections`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label: "New Section",
            order: sections.length,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create section");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/inspiration/sections`],
      });
      toast({
        title: "Success",
        description: "Section created successfully",
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

  // Update section mutation
  const updateSection = useMutation({
    mutationFn: async ({ id, newLabel }: { id: number; newLabel: string }) => {
      const response = await fetch(
        `/api/clients/${clientId}/inspiration/sections/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label: newLabel,
            order: sections.find((s) => s.id === id)?.order || 0,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update section");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/inspiration/sections`],
      });
      toast({
        title: "Success",
        description: "Section updated successfully",
      });
      setEditingLabel(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload image mutation
  const uploadImage = useMutation({
    mutationFn: async ({
      sectionId,
      file,
    }: {
      sectionId: number;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("order", "0"); // Default order for now

      const response = await fetch(
        `/api/clients/${clientId}/inspiration/sections/${sectionId}/images`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload image");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/inspiration/sections`],
      });
      toast({
        title: "Success",
        description: "Image uploaded successfully",
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

  // Handle drop callback
  const handleDrop = useCallback(
    (files: File[], sectionId: number) => {
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (imageFiles.length === 0) {
        toast({
          title: "Invalid files",
          description: "Please upload image files only",
          variant: "destructive",
        });
        return;
      }

      imageFiles.forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Image must be less than 5MB",
            variant: "destructive",
          });
          return;
        }
        uploadImage.mutate({ sectionId, file });
      });
    },
    [uploadImage, toast]
  );

  if (!user) return null;

  // This code can be conditional since it's just calculating a boolean, not a hook
  const isAbleToEdit = ["super_admin", "admin", "editor"].includes(
    user.role as string
  );

  return (
    <div className="space-y-8">
      {sections.length === 0 && isAbleToEdit ? (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => createSection.mutate()}
        >
          <Plus className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium mb-2">Add Your First Section</h3>
          <p className="text-sm text-muted-foreground">
            Create a section to start building your inspiration board
          </p>
        </div>
      ) : (
        <div className="grid gap-8">
          <AnimatePresence>
            {sections.map((section) => (
              <motion.div
                key={section.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  {editingLabel === section.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const input = e.currentTarget.elements.namedItem(
                          "label"
                        ) as HTMLInputElement;
                        updateSection.mutate({
                          id: section.id,
                          newLabel: input.value,
                        });
                      }}
                      className="flex-1"
                    >
                      <Input
                        name="label"
                        defaultValue={section.label}
                        autoFocus
                        onBlur={(e) =>
                          updateSection.mutate({
                            id: section.id,
                            newLabel: e.target.value,
                          })
                        }
                      />
                    </form>
                  ) : (
                    <>
                      <Label className="text-lg font-medium">
                        {section.label}
                      </Label>
                      {isAbleToEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLabel(section.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {section.images.map((image) => (
                    <motion.div
                      key={image.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative group aspect-square"
                    >
                      <img
                        src={image.url}
                        alt=""
                        className="w-full h-full object-cover rounded-lg"
                      />
                      {isAbleToEdit && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            /* TODO: Implement delete */
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </motion.div>
                  ))}

                  {isAbleToEdit && (
                    <ImageDropzone
                      onDrop={(files) => handleDrop(files, section.id)}
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add Section Button */}
          {isAbleToEdit && (
            <motion.div
              layout
              onClick={() => createSection.mutate()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <Plus className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Add Another Section
              </p>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
