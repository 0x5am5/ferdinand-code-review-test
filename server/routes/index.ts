import type { Request } from "express";
import type { OAuth2Client } from "google-auth-library";

export interface RequestWithClientId extends Request {
  clientId?: number;
  googleAuth?: OAuth2Client;
}

export * from "./file-assets";
export * from "./google-drive";
