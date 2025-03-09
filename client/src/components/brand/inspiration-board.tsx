import { Plus, Edit2, X } from "lucide-react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Section {
  id: string;
  label: string;
  images: Array<{
    id: string;
    url: string;
  }>;
}

interface InspirationBoardProps {
  clientId: number;
}

export function InspirationBoard({ clientId }: InspirationBoardProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const onDrop = useCallback((files: File[], sectionId: string) => {
    // Handle file upload here
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please upload image files only",
        variant: "destructive",
      });
      return;
    }

    // TODO: Implement file upload mutation
    console.log('Uploading files:', imageFiles);
  }, [toast]);

  const addSection = () => {
    const newSection: Section = {
      id: crypto.randomUUID(),
      label: "New Section",
      images: [],
    };
    setSections([...sections, newSection]);
  };

  const updateSectionLabel = (sectionId: string, newLabel: string) => {
    setSections(sections.map(section => 
      section.id === sectionId 
        ? { ...section, label: newLabel }
        : section
    ));
    setEditingLabel(null);
  };

  const removeImage = (sectionId: string, imageId: string) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? {
            ...section,
            images: section.images.filter(img => img.id !== imageId)
          }
        : section
    ));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inspiration Board</h2>
        <Button onClick={addSection}>
          <Plus className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </div>

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
                      const input = e.currentTarget.elements.namedItem('label') as HTMLInputElement;
                      updateSectionLabel(section.id, input.value);
                    }}
                    className="flex-1"
                  >
                    <Input
                      name="label"
                      defaultValue={section.label}
                      autoFocus
                      onBlur={(e) => updateSectionLabel(section.id, e.target.value)}
                    />
                  </form>
                ) : (
                  <>
                    <Label className="text-lg font-medium">{section.label}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingLabel(section.id)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
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
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(section.id, image.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}

                <DropZone onDrop={(files) => onDrop(files, section.id)} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sections.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No sections yet. Add a section to start creating your inspiration board.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DropZone({ onDrop }: { onDrop: (files: File[]) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    }
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg aspect-square
        flex items-center justify-center cursor-pointer
        transition-colors
        ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}
      `}
    >
      <input {...getInputProps()} />
      <div className="text-center p-4">
        <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {isDragActive
            ? "Drop the files here..."
            : "Drag & drop images here, or click to select"}
        </p>
      </div>
    </div>
  );
}
