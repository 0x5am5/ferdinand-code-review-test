import { FileIcon, Upload, X } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAssetCategoriesQuery,
  useAssetTagsQuery,
  useUploadAssetMutation,
} from "@/lib/queries/assets";

interface FilePreview {
  file: File;
  preview?: string;
}

interface AssetUploadProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialFiles?: File[];
}

export const AssetUpload: FC<AssetUploadProps> = ({
  open: controlledOpen,
  onOpenChange,
  initialFiles = [],
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [visibility, setVisibility] = useState<"private" | "shared">("shared");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useAssetCategoriesQuery();
  const { data: tags = [] } = useAssetTagsQuery();
  const uploadMutation = useUploadAssetMutation();

  // Handle initial files when dialog opens
  useEffect(() => {
    if (initialFiles.length > 0 && open) {
      const filePreviews: FilePreview[] = initialFiles.map((file) => {
        const preview = file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
        return { file, preview };
      });
      setFiles(filePreviews);
    }
  }, [initialFiles, open]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const filePreviews: FilePreview[] = newFiles.map((file) => {
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      return { file, preview };
    });

    setFiles((prev) => [...prev, ...filePreviews]);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files) as File[];
      addFiles(droppedFiles);
    },
    [addFiles]
  );

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files) as File[];
      addFiles(selectedFiles);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploadProgress(0);
    const progressIncrement = 100 / files.length;

    // Parse tag input into array of tag names
    const tagNames = tagInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    for (const { file } of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("visibility", visibility);
      if (selectedCategories.length > 0) {
        formData.append("categoryIds", JSON.stringify(selectedCategories));
      }
      if (tagNames.length > 0) {
        formData.append("tags", JSON.stringify(tagNames));
      }

      await uploadMutation.mutateAsync(formData);
      setUploadProgress((prev) => Math.min(prev + progressIncrement, 100));
    }

    // Cleanup
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });

    setFiles([]);
    setSelectedCategories([]);
    setTagInput("");
    setUploadProgress(0);
    setVisibility("shared");
    setOpen(false);
  };

  const handleClose = () => {
    // Cleanup previews when closing
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setSelectedCategories([]);
    setTagInput("");
    setUploadProgress(0);
    setVisibility("shared");
    setOpen(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => (isOpen ? setOpen(true) : handleClose())}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Assets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Assets</DialogTitle>
          <DialogDescription>
            Upload multiple files and organize them with categories and tags
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag and drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum file size: 500MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* File previews */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({files.length})</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {files.map((filePreview, index) => (
                  <div
                    key={`${filePreview.file.name}-${filePreview.file.size}-${index}`}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    {filePreview.preview ? (
                      <img
                        src={filePreview.preview}
                        alt={filePreview.file.name}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ) : (
                      <FileIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {filePreview.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(filePreview.file.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visibility */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value: "private" | "shared") =>
                setVisibility(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">
                  Shared (All team members)
                </SelectItem>
                <SelectItem value="private">Private (Only me)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label>Categories (Optional)</Label>
            <Select
              onValueChange={(value) => {
                const categoryId = parseInt(value, 10);
                if (!selectedCategories.includes(categoryId)) {
                  setSelectedCategories([...selectedCategories, categoryId]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedCategories.map((catId) => {
                  const category = categories.find((c) => c.id === catId);
                  return (
                    <Badge key={catId} variant="secondary">
                      {category?.name}
                      <X
                        className="h-3 w-3 ml-1 cursor-pointer"
                        onClick={() =>
                          setSelectedCategories((prev) =>
                            prev.filter((id) => id !== catId)
                          )
                        }
                      />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags (Optional)</Label>
            <div className="relative">
              <Input
                placeholder="Enter tags separated by commas (e.g. marketing, social, 2024)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                list="tag-suggestions"
              />
              {tags.length > 0 && (
                <datalist id="tag-suggestions">
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.name} />
                  ))}
                </datalist>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Separate tags with commas. New tags will be created automatically.
            </p>
          </div>

          {/* Upload progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || uploadMutation.isPending}
            >
              {uploadMutation.isPending
                ? "Uploading..."
                : `Upload ${files.length} file${files.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
