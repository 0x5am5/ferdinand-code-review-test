import { zodResolver } from "@hookform/resolvers/zod";
import { type InsertClient, insertClientSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Figma, Package, Palette, Slack, Type, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function NewClientPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("client-info");

  // Feature toggles state (default to enabled for most features)
  const [featureToggles, setFeatureToggles] = useState({
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
    figmaIntegration: false,
    slackIntegration: false,
  });

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      address: "",
      phone: "",
    },
  });

  const createClient = useMutation({
    mutationFn: async (data: InsertClient) => {
      const response = await apiRequest("POST", "/api/clients", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create client");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertClient) => {
    // Include feature toggles in the client creation data
    const clientData = {
      ...data,
      featureToggles,
    };
    createClient.mutate(clientData);
  };

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">New Client</h1>

        <Card>
          <CardHeader>
            <CardTitle>Create New Client</CardTitle>
            <CardDescription>
              Set up a new client with their basic information and feature preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 mb-6">
                <TabsTrigger value="client-info">
                  <User className="h-4 w-4 mr-2" />
                  Client Information
                </TabsTrigger>
                <TabsTrigger value="features">
                  <Package className="h-4 w-4 mr-2" />
                  Features
                </TabsTrigger>
              </TabsList>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <TabsContent value="client-info" className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter client name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter client description"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter client address"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter phone number"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="features" className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Brand Features</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose which features to enable for this client. You can change these settings later.
                      </p>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <Package className="h-4 w-4 mr-2" />
                              <div className="font-medium">Logo System</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Logo variations, usage guidelines, and downloads
                            </div>
                          </div>
                          <Switch
                            checked={featureToggles.logoSystem}
                            onCheckedChange={(checked) =>
                              setFeatureToggles((prev) => ({
                                ...prev,
                                logoSystem: checked,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <Palette className="h-4 w-4 mr-2" />
                              <div className="font-medium">Color System</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Brand colors, palettes, and accessibility information
                            </div>
                          </div>
                          <Switch
                            checked={featureToggles.colorSystem}
                            onCheckedChange={(checked) =>
                              setFeatureToggles((prev) => ({
                                ...prev,
                                colorSystem: checked,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <Type className="h-4 w-4 mr-2" />
                              <div className="font-medium">Type System</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Typography, fonts, and text styling guidelines
                            </div>
                          </div>
                          <Switch
                            checked={featureToggles.typeSystem}
                            onCheckedChange={(checked) =>
                              setFeatureToggles((prev) => ({
                                ...prev,
                                typeSystem: checked,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2" />
                              <div className="font-medium">User Personas</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Customer personas and target audience profiles
                            </div>
                          </div>
                          <Switch
                            checked={featureToggles.userPersonas}
                            onCheckedChange={(checked) =>
                              setFeatureToggles((prev) => ({
                                ...prev,
                                userPersonas: checked,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <Eye className="h-4 w-4 mr-2" />
                              <div className="font-medium">Inspiration</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Brand inspiration boards and mood collections
                            </div>
                          </div>
                          <Switch
                            checked={featureToggles.inspiration}
                            onCheckedChange={(checked) =>
                              setFeatureToggles((prev) => ({
                                ...prev,
                                inspiration: checked,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <Figma className="h-4 w-4 mr-2" />
                              <div className="font-medium">Figma Integration</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Sync design tokens and styles with Figma design files
                            </div>
                          </div>
                          <Switch
                            checked={featureToggles.figmaIntegration}
                            onCheckedChange={(checked) =>
                              setFeatureToggles((prev) => ({
                                ...prev,
                                figmaIntegration: checked,
                              }))
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center">
                              <Slack className="h-4 w-4 mr-2" />
                              <div className="font-medium">Slack Integration</div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Access brand assets directly from Slack workspace
                            </div>
                          </div>
                          <Switch
                            checked={featureToggles.slackIntegration}
                            onCheckedChange={(checked) =>
                              setFeatureToggles((prev) => ({
                                ...prev,
                                slackIntegration: checked,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <div className="flex gap-4 pt-6">
                    <Button type="submit" disabled={createClient.isPending}>
                      {createClient.isPending ? "Creating..." : "Create Client"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation("/dashboard")}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
