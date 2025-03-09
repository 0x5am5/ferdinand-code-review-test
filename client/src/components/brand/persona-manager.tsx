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
import { UserPersona, PersonaEventAttribute, PERSONA_EVENT_ATTRIBUTES } from "@shared/schema";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

// Form schema for persona creation/editing
const personaFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  ageRange: z.string().min(1, "Age range is required"),
  eventAttributes: z.array(z.string()).min(1, "At least one event attribute is required"),
  motivations: z.string().min(1, "Motivations are required"),
  coreNeeds: z.string().min(1, "Core needs are required"),
  painPoints: z.string().min(1, "Pain points are required"),
  metrics: z.object({
    averageSpend: z.string().optional(),
    eventAttendance: z.number().optional(),
    engagementRate: z.number().optional(),
  }),
});

type PersonaFormData = z.infer<typeof personaFormSchema>;

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

export function PersonaManager({ clientId, personas }: { clientId: number; personas: UserPersona[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingPersona, setIsAddingPersona] = useState(false);
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(null);

  const form = useForm<PersonaFormData>({
    resolver: zodResolver(personaFormSchema),
    defaultValues: {
      name: "",
      role: "",
      ageRange: "",
      eventAttributes: [],
      motivations: "",
      coreNeeds: "",
      painPoints: "",
      metrics: {
        averageSpend: "",
        eventAttendance: undefined,
        engagementRate: undefined,
      },
    },
  });

  const addPersona = useMutation({
    mutationFn: async (data: PersonaFormData) => {
      const response = await fetch(`/api/clients/${clientId}/personas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          motivations: data.motivations.split(',').map(m => m.trim()),
          coreNeeds: data.coreNeeds.split(',').map(n => n.trim()),
          painPoints: data.painPoints.split(',').map(p => p.trim()),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add persona");
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/personas`] });
      toast({
        title: "Success",
        description: "Persona added successfully",
      });
      setIsAddingPersona(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PersonaFormData) => {
    addPersona.mutate(data);
  };

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

      <Dialog open={isAddingPersona} onOpenChange={setIsAddingPersona}>
        <DialogContent className="max-w-[600px] max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Add New Persona</DialogTitle>
            <DialogDescription>
              Create a new user persona profile with detailed attributes
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
              <ScrollArea className="flex-1 px-6">
                <div className="py-4 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Event Enthusiast Emily" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Marketing Manager" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="ageRange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age Range</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 25-34" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eventAttributes"
                    render={() => (
                      <FormItem>
                        <FormLabel>Event Attendance Attributes</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {PERSONA_EVENT_ATTRIBUTES.map((attribute) => (
                            <FormField
                              key={attribute}
                              control={form.control}
                              name="eventAttributes"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(attribute)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        const next = checked
                                          ? [...current, attribute]
                                          : current.filter((value) => value !== attribute);
                                        field.onChange(next);
                                      }}
                                    />
                                  </FormControl>
                                  <Label className="text-sm font-normal">
                                    {attribute.split('_').map(word =>
                                      word.charAt(0).toUpperCase() + word.slice(1)
                                    ).join(' ')}
                                  </Label>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="motivations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivations</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Enter motivations, separated by commas"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="coreNeeds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Core Needs</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Enter core needs, separated by commas"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="painPoints"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pain Points</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Enter pain points, separated by commas"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metrics.averageSpend"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Average Spend</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., $500-750 per month" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </ScrollArea>

              <div className="px-6 py-4 border-t flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingPersona(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addPersona.isPending}>
                  {addPersona.isPending ? "Adding..." : "Add Persona"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}