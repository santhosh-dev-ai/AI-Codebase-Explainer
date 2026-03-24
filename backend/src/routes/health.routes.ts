import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Codebase Explainer API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
