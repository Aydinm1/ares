import { AIRTABLE_BASE_ID } from "./schema.js";

export interface AirtableRecord<TFields> {
  id: string;
  createdTime?: string;
  fields: TFields;
}

export interface AirtableListResponse<TFields> {
  records: AirtableRecord<TFields>[];
  offset?: string;
}

export class AirtableClient {
  private readonly apiKey: string;
  private readonly baseId: string;
  private readonly apiBase = "https://api.airtable.com/v0";

  constructor(options?: { apiKey?: string; baseId?: string }) {
    this.apiKey = options?.apiKey ?? process.env.AIRTABLE_API_KEY ?? "";
    this.baseId = options?.baseId ?? process.env.AIRTABLE_BASE_ID ?? AIRTABLE_BASE_ID;
    if (!this.apiKey) {
      throw new Error("AIRTABLE_API_KEY is required for live Airtable access.");
    }
  }

  async list<TFields>(table: string, query?: URLSearchParams): Promise<AirtableRecord<TFields>[]> {
    const records: AirtableRecord<TFields>[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams(query);
      if (offset) params.set("offset", offset);
      const path = `${this.tableUrl(table)}?${params.toString()}`;
      const page = await this.request<AirtableListResponse<TFields>>(path, { method: "GET" });
      records.push(...page.records);
      offset = page.offset;
    } while (offset);

    return records;
  }

  async update<TFields>(table: string, recordId: string, fields: Partial<TFields>): Promise<AirtableRecord<TFields>> {
    return this.request<AirtableRecord<TFields>>(`${this.tableUrl(table)}/${encodeURIComponent(recordId)}`, {
      method: "PATCH",
      body: JSON.stringify({ fields })
    });
  }

  private tableUrl(table: string): string {
    return `${this.apiBase}/${this.baseId}/${encodeURIComponent(table)}`;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Airtable ${response.status}: ${body}`);
    }

    return response.json() as Promise<T>;
  }
}
