import { Response, NextFunction } from "express";

export const validateClientId = (
  req: RequestWithClientId,
  res: Response,
  next: NextFunction,
) => {
  const clientId = parseInt(req.params.clientId);
  if (isNaN(clientId)) {
    return res.status(400).json({ message: "Invalid client ID" });
  }
  req.clientId = clientId;
  next();
};
