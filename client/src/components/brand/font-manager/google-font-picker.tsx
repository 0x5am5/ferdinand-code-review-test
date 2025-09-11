import { motion } from "framer-motion";
import { ChevronDown, Search, Type } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { GoogleFontPickerProps } from "./types";
import { generateGoogleFontUrl } from "./utils";

export function GoogleFontPicker({
  onFontSelect,
  isLoading,
  googleFonts,
  isFontsLoading,
}: GoogleFontPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [displayCount, setDisplayCount] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [previewFont, setPreviewFont] = useState<string | null>(null);

  // Load font for preview
  const loadFontForPreview = useCallback((fontName: string) => {
    if (!fontName) return;

    const link = document.createElement("link");
    link.href = generateGoogleFontUrl(fontName, ["400"], ["normal"]);
    link.rel = "stylesheet";
    link.id = `preview-font-${fontName.replace(/\s+/g, "-")}`;

    // Remove existing preview font
    const existingLink = document.head.querySelector('[id^="preview-font-"]');
    if (existingLink) {
      document.head.removeChild(existingLink);
    }

    document.head.appendChild(link);
    setPreviewFont(fontName);
  }, []);

  // Load first font for preview when fonts are available
  React.useEffect(() => {
    if (googleFonts.length > 0 && !previewFont) {
      loadFontForPreview(googleFonts[0].name);
    }
  }, [googleFonts, previewFont, loadFontForPreview]);

  const filteredFonts = googleFonts.filter(
    (font) =>
      font.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      font.category.toLowerCase().includes(searchValue.toLowerCase())
  );

  const displayedFonts = filteredFonts.slice(0, displayCount);
  const hasMore = displayCount < filteredFonts.length;

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    setDisplayCount((prev) => Math.min(prev + 25, filteredFonts.length));
    setIsLoadingMore(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setDisplayCount(50);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-4 transition-colors"
      style={{ minHeight: "300px" }}
    >
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Type className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center space-y-4">
        <div className="text-center">
          <h3 className="font-medium">Add Google Font</h3>
          <p className="text-sm text-muted-foreground">
            Search and select from popular Google Fonts
          </p>
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[300px] justify-between"
              disabled={isLoading || isFontsLoading}
            >
              <Search className="mr-2 h-4 w-4" />
              {isLoading
                ? "Adding font..."
                : isFontsLoading
                  ? "Loading fonts..."
                  : googleFonts.length === 0
                    ? "No fonts available"
                    : "Search Google Fonts..."}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 bg-white border shadow-lg">
            <Command>
              <CommandInput
                placeholder="Search fonts..."
                value={searchValue}
                onValueChange={handleSearchChange}
              />
              <CommandList
                onScroll={(e) => {
                  const { scrollTop, scrollHeight, clientHeight } =
                    e.currentTarget;
                  if (
                    scrollHeight - scrollTop - clientHeight < 100 &&
                    hasMore &&
                    !isLoadingMore
                  ) {
                    loadMore();
                  }
                }}
              >
                <CommandEmpty>No fonts found.</CommandEmpty>
                <CommandGroup>
                  {displayedFonts.map((font) => (
                    <CommandItem
                      key={font.name}
                      value={font.name}
                      onSelect={() => {
                        onFontSelect(font.name);
                        setOpen(false);
                        setSearchValue("");
                        setDisplayCount(50);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{font.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {font.category}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {font.weights?.length || 0} weights
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </motion.div>
  );
}
