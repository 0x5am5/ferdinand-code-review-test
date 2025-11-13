import { Pencil, Search, X } from "lucide-react";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AssetFilters as Filters,
  useAssetCategoriesQuery,
  useAssetTagsQuery,
} from "@/lib/queries/assets";
import { TagManagementModal } from "./tag-management-modal";

interface AssetFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export const AssetFilters: FC<AssetFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const memoizedOnFiltersChange = useCallback(onFiltersChange, [
    onFiltersChange,
  ]);
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);
  const { data: categories = [] } = useAssetCategoriesQuery();
  const { data: tags = [] } = useAssetTagsQuery();
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      memoizedOnFiltersChange({ ...filters, search: searchInput || undefined });
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput, filters, memoizedOnFiltersChange]);

  const handleCategoryChange = (value: string) => {
    const categoryId = value === "all" ? undefined : parseInt(value, 10);
    memoizedOnFiltersChange({ ...filters, categoryId });
  };

  const handleVisibilityChange = (value: string) => {
    const visibility =
      value === "all" ? undefined : (value as "private" | "shared");
    memoizedOnFiltersChange({ ...filters, visibility });
  };

  const handleSourceChange = (value: string) => {
    const isGoogleDrive =
      value === "all" ? undefined : value === "google-drive";
    memoizedOnFiltersChange({ ...filters, isGoogleDrive });
  };

  const handleTagToggle = (tagId: number) => {
    const currentTags = filters.tagIds || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId];
    memoizedOnFiltersChange({
      ...filters,
      tagIds: newTags.length > 0 ? newTags : undefined,
    });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    memoizedOnFiltersChange({});
  };

  const hasActiveFilters =
    filters.search ||
    filters.categoryId ||
    filters.visibility ||
    filters.isGoogleDrive !== undefined ||
    (filters.tagIds && filters.tagIds.length > 0);

  return (
    <div className="p-4 bg-muted/30 rounded-lg">
      <div className="flex flex-wrap items-end gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="w-[180px] space-y-2">
          <Label>Category</Label>
          <Select
            value={filters.categoryId?.toString() || "all"}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Source Filter */}
        <div className="w-[180px] space-y-2">
          <Label>Source</Label>
          <Select
            value={
              filters.isGoogleDrive === undefined
                ? "all"
                : filters.isGoogleDrive
                  ? "google-drive"
                  : "uploaded"
            }
            onValueChange={handleSourceChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="google-drive">Google Drive</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Visibility Filter */}
        <div className="w-[150px] space-y-2">
          <Label>Visibility</Label>
          <Select
            value={filters.visibility || "all"}
            onValueChange={handleVisibilityChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Tag Filter */}
      {tags.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Label>Tags</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTagManagementOpen(true)}
              className="h-6 w-6 p-0"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isSelected = filters.tagIds?.includes(tag.id);
              return (
                <Badge
                  key={tag.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleTagToggle(tag.id)}
                >
                  {tag.name}
                  {isSelected && <X className="h-3 w-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <TagManagementModal
        open={isTagManagementOpen}
        onOpenChange={setIsTagManagementOpen}
      />
    </div>
  );
};
