export interface NotchPayWebhookDto {
  event?: string;
  data?: {
    reference?: string;
    trxref?: string;
    status?: string;
    amount?: number;
    currency?: string;
    customer?: { phone?: string; email?: string; name?: string };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
