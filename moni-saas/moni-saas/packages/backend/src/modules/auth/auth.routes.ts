// packages/backend/src/modules/auth/auth.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { authRateLimit } from '../../middleware/rate-limiter';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(255),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/register — rate limited to prevent abuse
router.post('/register', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await AuthService.register(body.email, body.password, body.fullName);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /auth/login — rate limited to prevent brute force
router.post('/login', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await AuthService.login(body.email, body.password);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Refresh token required' },
      });
    }
    const tokens = await AuthService.refreshToken(refreshToken);
    res.json({ success: true, data: tokens });
  } catch (err) { next(err); }
});

// POST /auth/logout
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await AuthService.logout(req.user!.userId);
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) { next(err); }
});

export default router;
