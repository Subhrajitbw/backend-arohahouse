import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules } from '@medusajs/framework/utils';
import { ISearchService, ProductDTO } from '@medusajs/framework/types';
import { logger } from '@medusajs/framework'; // optional but handy

const retrieveProductsStep = createStep(
  {
    name: 'retrieveProductsStep',
  },
  async (input: undefined, context) => {
    const productModuleService = context.container.resolve(Modules.PRODUCT);

    const products = await productModuleService.listProducts(undefined, {
      relations: [
        'variants',
        'options',
        'tags',
        'collection',
        'type',
        'images',
      ],
    });

    // Ensure we always return an array
    return new StepResponse(Array.isArray(products) ? products : []);
  },
);

const indexProductsStep = createStep(
  {
    name: 'indexProductsStep',
  },
  async (input: ProductDTO[] = [], context) => {
    const meilisearchService = context.container.resolve(
      'meilisearchService',
    ) as ISearchService;

    if (!Array.isArray(input) || input.length === 0) {
      logger.info('indexProductsStep: no products to index');
      return new StepResponse({ indexed: 0 });
    }

    // sanitize + normalize products into safe documents for Meili
    const docs = input
      .filter(Boolean) // remove null/undefined
      .map((p: any) => {
        // use safe access and defaults
        return {
          id: p?.id,
          title: p?.title ?? '',
          subtitle: p?.subtitle ?? '',
          description: p?.description ?? '',
          handle: p?.handle ?? '',
          tags: Array.isArray(p?.tags) ? p.tags.map((t: any) => t.value ?? t) : [],
          collection: p?.collection?.id ?? null,
          type: p?.type?.value ?? p?.type ?? null,
          images: Array.isArray(p?.images) ? p.images : [],
          variants: Array.isArray(p?.variants) ? p.variants : [],
          // example price fallback; adjust to your data shape
          price:
            (p?.variants && p.variants[0] && p.variants[0].prices && p.variants[0].prices[0]
              ? p.variants[0].prices[0].amount
              : p?.price ?? 0),
          // attach any other fields you need for search
        };
      })
      .filter(d => d.id); // ensure we don't send docs without an id

    if (docs.length === 0) {
      logger.warn('indexProductsStep: all products were filtered out (no valid id or empty docs)');
      return new StepResponse({ indexed: 0 });
    }

    // chunking to avoid huge batches
    const chunkSize = 500;
    let indexedCount = 0;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      try {
        // you can use replaceDocuments if you want to fully overwrite an index
        await meilisearchService.addDocuments('products', chunk, 'product');
        indexedCount += chunk.length;
      } catch (err) {
        // log and continue — don't fail the whole workflow for one bad batch
        logger.error('indexProductsStep: failed to index a chunk', err);
        //logger.info('chunk preview', { chunkPreview: chunk.slice(0, 3) });

      }
    }

    return new StepResponse({ indexed: indexedCount });
  },
);

export const indexProductsWorkflow = createWorkflow(
  {
    name: 'indexProducts',
    idempotent: true,
    retentionTime: 60 * 60 * 24 * 3, // 3 days
    store: true,
  },
  () => {
    const products = retrieveProductsStep();
    const result = indexProductsStep(products);

    return new WorkflowResponse(result);
  },
);
