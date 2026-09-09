export interface WorkInquiry {
  booking?: Record<string, unknown> | null;
  clientName: string;
  clientPhoto?: string | null;
  clientRating?: number | null;
  description: string;
  id: string;
  messages: number;
  proposedBudget?: string;
  requestDate?: string;
  service: string;
  status: string;
}
