import { z } from 'zod';

export const createUrlRequestSchema = z.object({
  url: z.string().url().refine((value) => /^https?:\/\//i.test(value), 'Only http(s) URLs are supported.'),
  customCode: z.string().regex(/^[a-zA-Z0-9_-]{4,24}$/).optional(),
  expiresInDays: z.number().int().positive().max(3650).optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  idempotencyKey: z.string().min(8).max(120).optional()
});

export const workflowTriggerSchema = z.object({
  approvals: z.record(z.string(), z.object({ approved: z.boolean(), approver: z.string(), reason: z.string().optional() })).optional(),
  input: z.record(z.string(), z.unknown()).optional()
});

export type CreateUrlRequest = z.infer<typeof createUrlRequestSchema>;

export type UrlAccessEvent = {
  timestamp: string;
  requester: string;
  userAgent?: string;
  referrer?: string;
};

export type UrlRecord = {
  code: string;
  targetUrl: string;
  shortUrl: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  tags: string[];
  clickCount: number;
  uniqueRequesterCount: number;
  requesters: string[];
  accessLog: UrlAccessEvent[];
  idempotencyKey?: string;
};

export type CreateUrlResult = {
  record: UrlRecord;
  created: boolean;
};

export type AnalyticsSnapshot = {
  code: string;
  targetUrl: string;
  shortUrl: string;
  clickCount: number;
  uniqueRequesterCount: number;
  lastAccessedAt?: string;
  createdAt: string;
  expiresAt?: string;
  tags: string[];
  recentAccesses: UrlAccessEvent[];
};

export interface UrlRepository {
  getByCode(code: string): Promise<UrlRecord | undefined>;
  getByIdempotencyKey(idempotencyKey: string): Promise<UrlRecord | undefined>;
  save(record: UrlRecord): Promise<void>;
  list(): Promise<UrlRecord[]>;
}