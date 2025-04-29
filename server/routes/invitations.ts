
import type { Express } from "express";
import { storage } from "../storage";
import { invitations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { emailService } from "../email-service";

export function registerInvitationRoutes(app: Express) {
  // Get all invitations
  app.get("/api/invitations", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const allInvitations = await db.query.invitations.findMany();
      res.json(allInvitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Error fetching invitations" });
    }
  });

  // Create invitation
  app.post("/api/invitations", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const invitation = await db.insert(invitations).values(req.body);
      
      // Send invitation email
      await emailService.sendInvitation(req.body.email, {
        inviterId: req.session.userId,
        role: req.body.role,
      });

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Error creating invitation" });
    }
  });

  // Delete invitation
  app.delete("/api/invitations/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      await db.delete(invitations).where(eq(invitations.id, parseInt(req.params.id)));
      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ message: "Error deleting invitation" });
    }
  });
}
