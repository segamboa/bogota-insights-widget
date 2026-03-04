/**
 * Test setup file - runs before each test file
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
