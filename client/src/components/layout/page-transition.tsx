import { ReactNode, FC } from "react";
import { motion } from "framer-motion";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Animates page content transitions with a fade effect
 */
export const PageTransition: FC<PageTransitionProps> = ({ 
  children,
  className = ""
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};