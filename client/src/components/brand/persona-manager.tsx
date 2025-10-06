import { PERSONA_EVENT_ATTRIBUTES, type UserPersona } from "@shared/schema";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PersonaMetrics {
  eventAttendance?: number;
  engagementRate?: number;
  averageSpend?: string;
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

// Form schema for persona creation/editing
const personaFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  ageRange: z.string().min(1, "Age range is required"),
  eventAttributes: z
    .array(z.string())
    .min(1, "At least one event attribute is required"),
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

function PersonaCard({
  persona,
  onEdit,
  onDelete,
}: {
  persona: UserPersona;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  if (!user) return null;

  const isAbleToEdit = ["super_admin", "admin", "editor"].includes(
    user.role as string
  );

  return (
    <div className="relative p-6 border rounded-lg bg-white shadow-sm group">
      {isAbleToEdit && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

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
              {persona.metrics &&
              (persona.metrics as PersonaMetrics).averageSpend ? (
                <p className="text-sm">
                  {String((persona.metrics as PersonaMetrics).averageSpend)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">
            EVENT ATTENDANCE ATTRIBUTES
          </Label>
          <p className="text-sm">
            {(persona.eventAttributes as string[]).join(", ")}
          </p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">MOTIVATIONS</Label>
          <p className="text-sm">{persona.motivations?.join(", ")}</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">CORE NEEDS</Label>
          <p className="text-sm">{persona.coreNeeds?.join(", ")}</p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">PAIN POINTS</Label>
          <p className="text-sm">{persona.painPoints?.join(", ")}</p>
        </div>
      </div>
    </div>
  );
}

function AddPersonaCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="p-6 border rounded-lg bg-white/50 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/80 transition-colors"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ minHeight: "300px" }}
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
    </div>
  );
}

export function PersonaManager({
  clientId,
  personas,
}: {
  clientId: number;
  personas: UserPersona[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingPersona, setIsAddingPersona] = useState(false);
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(
    null
  );
  const { user } = useAuth();

  // if (!user) return null;

  const isAbleToEdit = ["super_admin", "admin", "editor"].includes(
    user?.role as string
  );

  // Move useForm to top level
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

  // Move all mutations to top level
  const addPersona = useMutation({
    mutationFn: async (data: PersonaFormData) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      const response = await fetch(`/api/clients/${clientId}/personas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          eventAttributes: data.eventAttributes,
          motivations: data.motivations.split(",").map((m) => m.trim()),
          coreNeeds: data.coreNeeds.split(",").map((n) => n.trim()),
          painPoints: data.painPoints.split(",").map((p) => p.trim()),
          metrics: {
            averageSpend: data.metrics.averageSpend,
            eventAttendance: data.metrics.eventAttendance
              ? Number(data.metrics.eventAttendance)
              : undefined,
            engagementRate: data.metrics.engagementRate
              ? Number(data.metrics.engagementRate)
              : undefined,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add persona");
      }

      return await response.json();
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/personas`],
        });
      }
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

  const deletePersona = useMutation({
    mutationFn: async (personaId: number) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      const response = await fetch(
        `/api/clients/${clientId}/personas/${personaId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete persona");
      }
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/personas`],
        });
      }
      toast({
        title: "Success",
        description: "Persona deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePersona = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PersonaFormData }) => {
      if (!clientId) {
        throw new Error("Client ID is required");
      }

      const response = await fetch(`/api/clients/${clientId}/personas/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          eventAttributes: data.eventAttributes,
          motivations: data.motivations.split(",").map((m) => m.trim()),
          coreNeeds: data.coreNeeds.split(",").map((n) => n.trim()),
          painPoints: data.painPoints.split(",").map((p) => p.trim()),
          metrics: {
            averageSpend: data.metrics.averageSpend,
            eventAttendance: data.metrics.eventAttendance
              ? Number(data.metrics.eventAttendance)
              : undefined,
            engagementRate: data.metrics.engagementRate
              ? Number(data.metrics.engagementRate)
              : undefined,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update persona");
      }

      return await response.json();
    },
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/clients/${clientId}/personas`],
        });
      }
      toast({
        title: "Success",
        description: "Persona updated successfully",
      });
      setEditingPersona(null);
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

  // Move useEffect to top level
  useEffect(() => {
    // Control execution with condition inside effect
    if (editingPersona && form) {
      form.reset({
        name: editingPersona.name,
        role: editingPersona.role || "",
        ageRange: editingPersona.ageRange || "",
        eventAttributes: editingPersona.eventAttributes as string[],
        motivations: editingPersona.motivations?.join(", ") || "",
        coreNeeds: editingPersona.coreNeeds?.join(", ") || "",
        painPoints: editingPersona.painPoints?.join(", ") || "",
        metrics: {
          averageSpend:
            (editingPersona.metrics as PersonaMetrics)?.averageSpend || "",
          eventAttendance: (editingPersona.metrics as PersonaMetrics)
            ?.eventAttendance,
          engagementRate: (editingPersona.metrics as PersonaMetrics)
            ?.engagementRate,
        },
      });
    }
  }, [editingPersona, form]);

  const onSubmit = (data: PersonaFormData) => {
    if (editingPersona) {
      updatePersona.mutate({ id: editingPersona.id, data });
    } else {
      addPersona.mutate(data);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Personas</h1>
          <p className="text-muted-foreground mt-1">
            Define and manage user persona profiles for your brand
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onEdit={() => setEditingPersona(persona)}
              onDelete={() => deletePersona.mutate(persona.id)}
            />
          ))}
          {isAbleToEdit && (
            <AddPersonaCard onClick={() => setIsAddingPersona(true)} />
          )}
        </div>
      </div>

      {isAbleToEdit && (
        <Dialog
          open={isAddingPersona || !!editingPersona}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddingPersona(false);
              setEditingPersona(null);
              form.reset();
            }
          }}
        >
          <DialogContent className="max-w-[600px] max-h-[90vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle>
                {editingPersona ? "Edit Persona" : "Add New Persona"}
              </DialogTitle>
              <DialogDescription>
                {editingPersona
                  ? "Update the persona profile details"
                  : "Create a new user persona profile with detailed attributes"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col h-full"
              >
                <div className="flex-1 min-h-0">
                  <ScrollArea className="h-[calc(90vh-180px)]">
                    <div className="px-6 py-4 space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., Event Enthusiast Emily"
                              />
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
                              <Input
                                {...field}
                                placeholder="e.g., Marketing Manager"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                                          checked={field.value?.includes(
                                            attribute
                                          )}
                                          onCheckedChange={(checked) => {
                                            const current = field.value || [];
                                            const next = checked
                                              ? [...current, attribute]
                                              : current.filter(
                                                  (value) => value !== attribute
                                                );
                                            field.onChange(next);
                                          }}
                                        />
                                      </FormControl>
                                      <Label className="text-sm font-normal">
                                        {attribute
                                          .split("_")
                                          .map(
                                            (word) =>
                                              word.charAt(0).toUpperCase() +
                                              word.slice(1)
                                          )
                                          .join(" ")}
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
                              <Input
                                {...field}
                                placeholder="e.g., $500-750 per month"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </ScrollArea>
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-4 mt-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingPersona(false);
                      setEditingPersona(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addPersona.isPending || updatePersona.isPending}
                  >
                    {addPersona.isPending || updatePersona.isPending
                      ? "Saving..."
                      : editingPersona
                        ? "Update Persona"
                        : "Add Persona"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
