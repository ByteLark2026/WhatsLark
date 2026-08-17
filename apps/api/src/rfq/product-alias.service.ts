import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { ErpAdapterFactory } from '../integrations/erp/erp-adapter.factory';
import { resolveAiProviderKey } from '../common/ai-key.util';
import { ErpProduct } from '../integrations/erp/erp-adapter.interface';

/** Bridges customer wording ("surgical masks") to catalog wording ("LOMAR Face Mask
 *  3Ply...") without requiring manual edits in the ERP/product catalog. Generates a
 *  handful of likely customer search terms per product via AI and stores them for the
 *  matcher to search alongside the ERP/catalog's own product names. */
@Injectable()
export class ProductAliasService {
  private readonly logger = new Logger(ProductAliasService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly erpAdapters: ErpAdapterFactory,
  ) {}

  /** Pulls the company's product list (ERP if connected, else local product_catalog),
   *  generates 3-5 aliases per product via one batched AI call, and upserts them.
   *  Returns how many products were processed and how many alias rows were written. */
  async generateForCompany(companyId: string): Promise<{ products: number; aliases: number }> {
    const products = await this.loadProducts(companyId);
    if (!products.length) return { products: 0, aliases: 0 };

    const apiKey = await resolveAiProviderKey(this.supabase.getAdminClient());
    if (!apiKey) throw new Error('No AI provider key configured');

    // Batch in chunks so one prompt/response stays a manageable size.
    const chunkSize = 25;
    let aliasCount = 0;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const generated = await this.generateChunk(chunk, apiKey);
      if (!generated.length) continue;

      const rows = generated.flatMap((g) => {
        const product = chunk.find((p) => p.sku === g.sku);
        if (!product) return [];
        return g.aliases.map((alias) => ({
          company_id: companyId,
          sku: product.sku,
          product_name: product.name,
          alias: alias.toLowerCase().trim(),
          source: 'ai_generated',
        }));
      }).filter((r) => r.alias.length > 0);

      if (rows.length) {
        const { error } = await this.supabase.getAdminClient()
          .from('product_aliases')
          .upsert(rows, { onConflict: 'company_id,sku,alias', ignoreDuplicates: true });
        if (error) this.logger.error(`Alias upsert error: ${error.message}`);
        else aliasCount += rows.length;
      }
    }

    return { products: products.length, aliases: aliasCount };
  }

  private async loadProducts(companyId: string): Promise<{ sku: string; name: string }[]> {
    const adapter = await this.erpAdapters.getAdapter(companyId).catch(() => null);
    if (adapter) {
      // No generic "list all" on the ErpAdapter interface — searchProducts('') returns
      // the store's default listing, which covers the common case well enough for a
      // batch aliasing pass without requiring a per-provider pagination API.
      const results: ErpProduct[] = await adapter.searchProducts('', 100).catch(() => []);
      return results.map((p) => ({ sku: p.sku, name: p.name }));
    }

    const { data } = await this.supabase.getAdminClient()
      .from('product_catalog')
      .select('sku, name')
      .eq('company_id', companyId)
      .eq('is_active', true);
    return data || [];
  }

  private async generateChunk(
    products: { sku: string; name: string }[],
    apiKey: string,
  ): Promise<{ sku: string; aliases: string[] }[]> {
    const systemPrompt = `You generate alternate customer search terms for a B2B product catalog.
For each product, list 3-5 short phrases a buyer might type in a WhatsApp chat that mean the same product but use different, more common/colloquial wording than the formal catalog name (e.g. "LOMAR Face Mask 3Ply Ear Loop Blue" -> "surgical mask", "medical mask", "disposable face mask", "3 ply mask"). Skip brand names and packaging codes in the aliases. Reply with ONLY strict JSON, no prose, no markdown fences:
{"items": [{"sku": string, "aliases": string[]}]}`;

    const userContent = products.map((p) => `${p.sku}: ${p.name}`).join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 2000,
        temperature: 0.5,
      }),
    });
    if (!res.ok) {
      this.logger.error(`Alias generation: OpenAI call failed (${res.status})`);
      return [];
    }
    const raw = (await res.json()).choices?.[0]?.message?.content?.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      this.logger.error(`Alias generation: failed to parse LLM output: ${raw.substring(0, 200)}`);
      return [];
    }
  }
}
