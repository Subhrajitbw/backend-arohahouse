# Aroha House System Overview

## Repositories

Aroha House is split into three repositories:

- `backend-arohahouse`: Medusa backend, commerce APIs, custom modules, workflows, integrations, search indexing, and email.
- `aroha-front`: Vite React storefront that renders customer-facing pages and calls Medusa, Sanity, and Meilisearch.
- `arohahouse`: Sanity Studio and schemas for editorial product content, navigation, SEO, blog/content, and system-level content masters.

## System Architecture

```text
                      +------------------+
                      |   arohahouse     |
                      |   Sanity CMS     |
                      +---------^--------+
                                |
                      sync by Medusa ID
                                |
+---------------+     +---------+----------+     +----------------+
| aroha-front   +---->+ backend-arohahouse +---->+ PostgreSQL     |
| React/Vite    |     | Medusa APIs        |     | Redis          |
+-------+-------+     +---------+----------+     +----------------+
        |                       |
        |                       +---- R2/S3 file storage
        |                       +---- Meilisearch / Algolia search
        |                       +---- Resend email
        |
        +---- direct Sanity reads for editorial content
        +---- direct Meilisearch reads for search modal
```

## Data Flow: Sanity to Backend to Frontend

The actual implementation is bidirectional in practice:

1. Medusa is the source of truth for commerce records such as products, variants, categories, collections, product types, prices, customers, carts, and orders.
2. Backend subscribers and workflows sync selected Medusa fields into Sanity documents. The Sanity document `_id` is the Medusa ID.
3. Editors enrich those Sanity documents with product descriptions, specifications, SEO fields, customization/policy/trust references, navigation settings, and content.
4. The storefront reads commerce data from Medusa and editorial data from Sanity. Product detail pages first locate the Sanity product by `handle`, then retrieve the Medusa product by `medusaId`.

```text
Medusa product prod_123
  |
  v
Sanity product _id=prod_123, medusaId=prod_123, handle=...
  |
  v
aroha-front product page reads Sanity by handle and Medusa by medusaId
```

## Product Lifecycle

1. A product is created or updated in Medusa.
2. Medusa emits product events.
3. `src/subscribers/sanity-product-sync.ts` runs `sanitySyncProductsWorkflow`.
4. `sync-products.ts` writes or patches the Sanity `product` document using the Medusa product ID as `_id`.
5. Editors enrich the Sanity product with fields defined in `arohahouse/schemaTypes/product.jsx`.
6. The storefront route `/products/:handle` queries Sanity for the product by handle, then retrieves the Medusa product by `medusaId` for pricing, variants, inventory, and images.
7. Search indexing workflows send products to Meilisearch, which the storefront search modal queries directly.

## ID Mapping

The code uses these ID conventions:

- Medusa product IDs are stored as Sanity product `_id` and `medusaId`.
- Medusa category IDs are stored as Sanity category `_id` and `medusaId`.
- Medusa collection IDs are stored as Sanity collection `_id` and `medusaId`.
- Medusa product type IDs are stored as Sanity productType `_id` and `medusaId`.
- Admin sync route type detection uses Medusa ID prefixes: `pcat_`, `pcol_`, and `ptyp_`; other IDs are treated as product IDs.
- Variant SKUs remain in Medusa variant data and are included in search/indexing types, but Sanity product sync currently does not write SKU fields into product documents.

## Integration Boundaries

Medusa owns operational commerce. Sanity owns editorial enrichment. The storefront composes both at render time. Search is denormalized from backend product data into Meilisearch and queried directly by the storefront.

One implementation detail to watch: some storefront GROQ queries reference type-based fields such as `applicableMedusaTypes`, while CMS master schemas define `applicableProductTypes` as references to `productType`. This documentation reflects the code as it exists; verify this contract before relying on type-based default policy/customization resolution.
