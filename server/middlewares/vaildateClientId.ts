import type { NextFunction, Response } from "express";
import type { RequestWithClientId } from "../routes";

export const validateClientId = (
  req: RequestWithClientId,
  res: Response,
  next: NextFunction
) => {
  const clientId = parseInt(req.params.clientId, 10);
  if (Number.isNaN(clientId)) {
    return res.status(400).json({ message: "Invalid client ID" });
  }
  req.clientId = clientId;
  next();
};
