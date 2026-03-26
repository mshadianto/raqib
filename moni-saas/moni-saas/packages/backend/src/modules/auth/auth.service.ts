// packages/backend/src/modules/auth/auth.service.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { AppError } from '@moni/shared';
import { JwtPayload } from '../../middleware/auth';

const prisma = new PrismaClient();

export class AuthService {
  static async register(email: string, password: string, fullName: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('EMAIL_EXISTS', 'An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, fullName },
      select: { id: true, email: true, fullName: true, createdAt: true },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    return { user, ...tokens };
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      ...tokens,
    };
  }

  static async refreshToken(token: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError('INVALID_TOKEN', 'Refresh token is invalid or expired', 401);
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await this.generateTokens(stored.user.id, stored.user.email);
    return tokens;
  }

  static async logout(userId: string) {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private static async generateTokens(userId: string, email: string) {
    const payload: JwtPayload = { userId, email };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiry as any,
    });

    const refreshToken = uuidv4();
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: refreshExpiry,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
