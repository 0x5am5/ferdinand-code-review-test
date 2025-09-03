import DesignSystemBuilder from "../design-system/design-system-builder";

interface FigmaIntegrationProps {
	clientId: number;
}

export default function FigmaIntegration({ clientId }: FigmaIntegrationProps) {
	// TEMPORARILY COMMENTED OUT - Replaced with Code-Based Design System Builder
	// All existing Figma integration functionality has been commented out
	// and replaced with the new code-based design system builder

	return <DesignSystemBuilder clientId={clientId} />;
}

/*
// ===== COMMENTED OUT FIGMA INTEGRATION CODE =====
// The following code implements Figma integration functionality
// It has been temporarily disabled in favor of the code-based design system builder

interface FigmaConnection {
  id: number;
  figmaFileId: string;
  figmaFileKey: string;
  figmaFileName: string;
  figmaTeamId?: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncStatus: "idle" | "syncing" | "success" | "error";
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

interface FigmaSyncLog {
  id: number;
  syncType: string;
  syncDirection: string;
  status: string;
  elementsChanged?: Array<{ type: string; name: string; action: string }>;
  errorMessage?: string;
  duration?: number;
  createdAt: string;
}

const figmaConnectionSchema = z.object({
  figmaFileKey: z.string().min(1, "Figma file key is required"),
  figmaFileName: z.string().min(1, "File name is required"),
  figmaTeamId: z.string().optional(),
  accessToken: z.string().min(1, "Figma access token is required"),
});

type FigmaConnectionForm = z.infer<typeof figmaConnectionSchema>;

// Full Figma integration implementation would go here...
// Including connection management, sync functionality, etc.

*/
