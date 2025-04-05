import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent, 
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

export default function DesignBuilder() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { designSystem: appliedDesignSystem, draftDesignSystem } = useTheme();
  
  // Define the designSystem variable to use throughout the component
  const designSystem = draftDesignSystem || appliedDesignSystem;
  
  // For simplified temporary version
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [navTarget, setNavTarget] = useState("");

  const confirmNavigation = () => {
    setShowLeaveAlert(false);
    if (navTarget) {
      navigate(navTarget);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Design Builder</h1>
      <p className="text-gray-500 mb-8">This page has been temporarily simplified while we fix the layout issues.</p>
      
      {/* Alert dialog for unsaved changes */}
      <AlertDialog open={showLeaveAlert} onOpenChange={setShowLeaveAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation}>
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}