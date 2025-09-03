import { insertUserPersonaSchema } from "@shared/schema";
import type { Express } from "express";
import { validateClientId } from "server/middlewares/vaildateClientId";
import type { RequestWithClientId } from "server/routes";
import { storage } from "server/storage";

export function registerPersonasRoutes(app: Express) {
  // User Persona routes
  app.get(
    "/api/clients/:clientId/personas",
    validateClientId,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId!;
        const personas = await storage.getClientPersonas(clientId);
        res.json(personas);
      } catch (error: unknown) {
        console.error(
          "Error fetching client personas:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error fetching client personas" });
      }
    }
  );

  app.post(
    "/api/clients/:clientId/personas",
    validateClientId,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId!;
        const personaData = {
          ...req.body,
          clientId,
        };

        const parsed = insertUserPersonaSchema.safeParse(personaData);

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid persona data",
            errors: parsed.error.errors,
          });
        }

        const persona = await storage.createPersona(parsed.data);
        res.status(201).json(persona);
      } catch (error: unknown) {
        console.error(
          "Error creating persona:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error creating persona" });
      }
    }
  );

  app.patch(
    "/api/clients/:clientId/personas/:personaId",
    validateClientId,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId!;
        const personaId = parseInt(req.params.personaId);

        const persona = await storage.getPersona(personaId);

        if (!persona) {
          return res.status(404).json({ message: "Persona not found" });
        }

        if (persona.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Not authorized to update this persona" });
        }

        const parsed = insertUserPersonaSchema.safeParse({
          ...req.body,
          clientId,
        });

        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid persona data",
            errors: parsed.error.errors,
          });
        }

        const updatedPersona = await storage.updatePersona(
          personaId,
          parsed.data
        );
        res.json(updatedPersona);
      } catch (error: unknown) {
        console.error(
          "Error updating persona:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error updating persona" });
      }
    }
  );

  app.delete(
    "/api/clients/:clientId/personas/:personaId",
    validateClientId,
    async (req: RequestWithClientId, res) => {
      try {
        const clientId = req.clientId!;
        const personaId = parseInt(req.params.personaId);

        const persona = await storage.getPersona(personaId);

        if (!persona) {
          return res.status(404).json({ message: "Persona not found" });
        }

        if (persona.clientId !== clientId) {
          return res
            .status(403)
            .json({ message: "Not authorized to delete this persona" });
        }

        await storage.deletePersona(personaId);
        res.status(200).json({ message: "Persona deleted successfully" });
      } catch (error: unknown) {
        console.error(
          "Error deleting persona:",
          error instanceof Error ? error.message : "Unknown error"
        );
        res.status(500).json({ message: "Error deleting persona" });
      }
    }
  );
}
