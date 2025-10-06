import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface ColorBlockProps {
  hex: string;
  onClick?: () => void;
}

export function ColorBlock({ hex, onClick }: ColorBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onClick?.();
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="relative cursor-pointer group"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div
        className="rounded-md transition-all duration-200 group-hover:ring-2 ring-primary/20"
        style={{ backgroundColor: hex, height: onClick ? "8rem" : "1.5rem" }}
      />
      <AnimatePresence>
        {copied ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md"
          >
            <Check className="h-4 w-4 text-white" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 rounded-md transition-colors"
          >
            <Copy className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
