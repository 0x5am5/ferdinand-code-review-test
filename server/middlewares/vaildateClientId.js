export const validateClientId = (req, res, next) => {
    const clientId = parseInt(req.params.clientId, 10);
    if (Number.isNaN(clientId)) {
        return res.status(400).json({ message: "Invalid client ID" });
    }
    req.clientId = clientId;
    next();
};
