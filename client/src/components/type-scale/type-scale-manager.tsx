import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Download, Copy, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TypeScaleBuilder } from "./type-scale-builder";
import { motion, AnimatePresence } from "framer-motion";

interface TypeScale {
  id: number;
  clientId: number;
  name: string;
  unit: "px" | "rem" | "em";
  baseSize: number;
  scaleRatio: number;
  customRatio?: number;
  responsiveSizes: {
    mobile: { baseSize: number; scaleRatio: number };
    tablet: { baseSize: number; scaleRatio: number };
    desktop: { baseSize: number; scaleRatio: number };
  };
  typeStyles: any[];
  exports: any[];
  createdAt: string;
  updatedAt: string;
}

interface TypeScaleManagerProps {
  clientId: number;
}

export function TypeScaleManager({ clientId }: TypeScaleManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<TypeScale | undefined>();

  const { data: typeScales = [], isLoading } = useQuery({
    queryKey: ["/api/clients", clientId, "type-scales"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/type-scales`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch type scales');
      return response.json();
    },
  });

  const deleteTypeScaleMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/type-scales/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Type scale deleted",
        description: "The type scale has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "type-scales"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete type scale. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (typeScale: TypeScale) => {
    setEditingScale(typeScale);
    setIsBuilderOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this type scale?")) {
      deleteTypeScaleMutation.mutate(id);
    }
  };

  const handleSave = (typeScale: TypeScale) => {
    setIsBuilderOpen(false);
    setEditingScale(undefined);
  };

  const handleCancel = () => {
    setIsBuilderOpen(false);
    setEditingScale(undefined);
  };

  const formatRatio = (scaleRatio: number) => {
    return (scaleRatio / 1000).toFixed(3);
  };

  const getLastExportDate = (exports: any[]) => {
    if (!exports || exports.length === 0) return "Never";
    const lastExport = exports.reduce((latest, exp) => 
      new Date(exp.exportedAt) > new Date(latest.exportedAt) ? exp : latest
    );
    return new Date(lastExport.exportedAt).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Type Scales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading type scales...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Type Scales</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage responsive typography scales for consistent text hierarchy
          </p>
        </div>
        <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingScale(undefined)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Type Scale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingScale ? "Edit Type Scale" : "Create Type Scale"}
              </DialogTitle>
            </DialogHeader>
            <TypeScaleBuilder
              clientId={clientId}
              typeScale={editingScale}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
      </div>

      {typeScales.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">
                <div className="text-6xl mb-4">📐</div>
                <h3 className="text-lg font-medium">No type scales yet</h3>
                <p className="text-sm">
                  Create your first type scale to establish consistent typography hierarchy
                </p>
              </div>
              <Button onClick={() => setIsBuilderOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Type Scale
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence>
            {typeScales.map((typeScale: TypeScale) => (
              <motion.div
                key={typeScale.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{typeScale.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {typeScale.baseSize}{typeScale.unit}
                          </Badge>
                          <Badge variant="outline">
                            Ratio: {formatRatio(typeScale.scaleRatio)}
                          </Badge>
                          <Badge variant="secondary">
                            {typeScale.typeStyles.length} styles
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => handleEdit(typeScale)}
                          size="sm"
                          variant="ghost"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(typeScale.id)}
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Type Styles Preview */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Style Preview</h4>
                      <div className="space-y-1">
                        {typeScale.typeStyles.slice(0, 3).map((style: any, index: number) => {
                          const ratio = typeScale.scaleRatio / 1000;
                          const fontSize = Math.round(typeScale.baseSize * Math.pow(ratio, style.size) * 100) / 100;
                          return (
                            <div
                              key={style.level}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-muted-foreground">{style.name}</span>
                              <Badge variant="outline">
                                {fontSize}{typeScale.unit}
                              </Badge>
                            </div>
                          );
                        })}
                        {typeScale.typeStyles.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{typeScale.typeStyles.length - 3} more styles
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Responsive Breakpoints */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Responsive Settings</h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <div className="font-medium">Mobile</div>
                          <div className="text-muted-foreground">
                            {typeScale.responsiveSizes.mobile.baseSize}{typeScale.unit}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Tablet</div>
                          <div className="text-muted-foreground">
                            {typeScale.responsiveSizes.tablet.baseSize}{typeScale.unit}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">Desktop</div>
                          <div className="text-muted-foreground">
                            {typeScale.responsiveSizes.desktop.baseSize}{typeScale.unit}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Export Info */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Export Information</h4>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Last exported: {getLastExportDate(typeScale.exports)}
                        </span>
                        <div className="flex gap-1">
                          {typeScale.exports.map((exp: any) => (
                            <Badge key={exp.format} variant="outline" className="text-xs">
                              {exp.format.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        onClick={() => handleEdit(typeScale)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Button
                        onClick={() => handleEdit(typeScale)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}