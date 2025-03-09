import { Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserPersona } from "@shared/schema";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

interface PersonaManagerProps {
  clientId: number;
  personas: UserPersona[];
}

function PersonaCard({ persona, onEdit, onDelete }: {
  persona: UserPersona;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative p-6 border rounded-lg bg-white shadow-sm group"
    >
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-4">
        {persona.imageUrl && (
          <img
            src={persona.imageUrl}
            alt={persona.name}
            className="w-32 h-32 rounded-lg object-cover"
          />
        )}
        <div className="flex-1">
          <h3 className="text-xl font-semibold">{persona.name}</h3>
          <p className="text-sm text-muted-foreground">{persona.role}</p>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">ABOUT</Label>
              <p className="text-sm">Age: {persona.ageRange}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">STATS</Label>
              {persona.metrics && (
                <p className="text-sm">{persona.metrics.averageSpend}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">EVENT ATTENDANCE ATTRIBUTES</Label>
          <p className="text-sm">{persona.eventAttributes.join(", ")}</p>
        </div>
        
        <div>
          <Label className="text-xs text-muted-foreground">MOTIVATIONS</Label>
          <p className="text-sm">{persona.motivations.join(", ")}</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">CORE NEEDS</Label>
          <p className="text-sm">{persona.coreNeeds.join(", ")}</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">PAIN POINTS</Label>
          <p className="text-sm">{persona.painPoints.join(", ")}</p>
        </div>
      </div>
    </motion.div>
  );
}

function AddPersonaCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/80 transition-colors"
      onClick={onClick}
      style={{ minHeight: '300px' }}
    >
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Plus className="h-6 w-6 text-primary" />
      </div>
      <div className="text-center">
        <h3 className="font-medium">Add New Persona</h3>
        <p className="text-sm text-muted-foreground">
          Create a new user persona profile
        </p>
      </div>
    </motion.div>
  );
}

export function PersonaManager({ clientId, personas }: PersonaManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingPersona, setIsAddingPersona] = useState(false);
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(null);

  // TODO: Implement mutations for CRUD operations

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Personas</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onEdit={() => setEditingPersona(persona)}
              onDelete={() => {/* TODO: Implement delete */}}
            />
          ))}
        </AnimatePresence>
        <AddPersonaCard onClick={() => setIsAddingPersona(true)} />
      </div>

      {/* TODO: Add Dialog for creating/editing personas */}
    </div>
  );
}
