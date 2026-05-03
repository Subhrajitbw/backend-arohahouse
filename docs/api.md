# Backend API

This document covers custom routes present in `src/api`. Core Medusa Store and Admin APIs are provided by Medusa itself and are not repeated here.

## Middleware

`src/api/middlewares.ts` configures:

- `adminProductTypeRoutesMiddlewares` for custom product type routes.
- A `20mb` body parser limit for `POST` and `PUT` requests matching `/custom/*`.
- Customer authentication for `/store/custom/customer/*` using session or bearer auth.
- Zod body validation for category image creation/batch updates and image conversion callbacks.

## Store Routes

### `GET /store/curated-categories`

Implemented in `src/api/store/curated-categories/route.ts`.

Fetches child product categories using Medusa Query Graph and returns curated category cards. A category must have at least three products to be included. The route attempts to avoid reusing product thumbnails across categories by tracking product IDs globally.

Response shape:

```json
{
  "curated_categories": [
    {
      "id": "pcat_...",
      "name": "Category",
      "handle": "category-handle",
      "parent_category_id": "pcat_parent",
      "image": "https://...",
      "featuredProducts": []
    }
  ]
}
```

### `GET /store/custom/new`

Implemented in `src/api/store/custom/new/route.ts`.

Returns published products ordered by `created_at DESC`. Query parameters include `limit`, `offset`, `region_id`, and `currency_code`. It requests `variants.calculated_price` using Medusa `QueryContext`, so storefront callers can render region/currency-aware prices.

### `GET /store/custom/discounted`

Implemented in `src/api/store/custom/discounted/route.ts`.

Returns products whose sale price is lower than the base price in active Medusa sale price lists. It supports `currency_code`, `limit`, and `offset`. The route first matches price list entries through `variant_id`; if that is unavailable, it falls back to scanning variant prices by `price_set_id`.

The response includes `products`, `count`, `offset`, `limit`, and a `debug` object with counts for price lists, entries, variants, and matched products.

### `GET /store/custom/top-selling`

Implemented in `src/api/store/custom/top-selling/route.ts`.

Aggregates order line items over a configurable number of days and returns products sorted by total ordered quantity. Query parameters include `days`, `region_id`, and `limit`.

### `GET /store/custom/fashion/:productHandle`

Implemented in `src/api/store/custom/fashion/[productHandle]/route.ts`.

Loads a Medusa product by handle, reads variant option values for `Material` and `Color`, then resolves matching records from the custom fashion module. It returns materials with colors filtered to the combinations actually present on product variants.

### `GET /store/custom/product-types`

Implemented in `src/api/store/custom/product-types/route.ts`.

Returns product types through Query Graph using fields and pagination prepared by the product type middleware.

### `GET /store/custom/product-types/:id`

Implemented in `src/api/store/custom/product-types/[id]/route.ts`.

Returns one product type using the helper in `src/api/store/custom/product-types/helpers.ts`.

### `POST /store/custom/customer/send-welcome-email`

Implemented in `src/api/store/custom/customer/send-welcome-email/route.ts`. This route is under the authenticated `/store/custom/customer/*` middleware scope.

### `GET /store/custom/debug-pricing`

Implemented in `src/api/store/custom/debug-pricing/route.ts`. It exists as a custom pricing inspection endpoint.

## Admin Routes

### `GET /admin/fashion`

Implemented in `src/api/admin/fashion/route.ts`.

Lists materials with optional `page` and `deleted` query parameters. The route paginates at 20 records per page and includes related colors.

### `POST /admin/fashion`

Creates a material. The request body is validated with Zod and requires a non-empty `name`.

### `/admin/fashion/:id` and nested color routes

The files under `src/api/admin/fashion/[id]` manage material details, restore behavior, colors, and color restore/delete/update behavior.

### `POST /admin/sanity/syncs`

Implemented in `src/api/admin/sanity/syncs/route.ts`.

Runs a full Sanity sync in this order: product types, collections, categories, then products. It returns a workflow transaction ID and a details message.

### `GET /admin/sanity/syncs`

Lists the last 20 workflow executions for the Sanity sync workflows.

### `GET /admin/sanity/documents/:id`

Implemented in `src/api/admin/sanity/documents/[id]/route.ts`.

Retrieves a Sanity document by Medusa ID through the Sanity module and returns a Studio URL when the document exists.

### `GET|POST /admin/sanity/documents/:id/sync`

Implemented in `src/api/admin/sanity/documents/[id]/sync/route.ts`.

Auto-detects document type from Medusa ID prefix:

- `pcat_` means category.
- `pcol_` means collection.
- `ptyp_` means product type.
- all other IDs default to product.

`POST` triggers the relevant targeted sync workflow for that ID.

### `POST /admin/custom/index-products`

Implemented in `src/api/admin/custom/index-products/route.ts`.

Runs `indexProductsWorkflow`, which indexes products for search.

### `POST /admin/meilisearch/sync`

Implemented in `src/api/admin/meilisearch/sync/route.ts`.

Emits a `meilisearch.sync` event.

### `POST /admin/algolia/sync`

Implemented in `src/api/admin/algolia/sync/route.ts`.

Emits an `algolia.sync` event.

### Category image and image-conversion routes

The category image routes under `src/api/admin/categories/[category_id]/images` and image conversion routes under `src/api/admin/image-conversions` are validated by `src/api/middlewares.ts` and backed by category image workflows in `src/workflows`.

## Hook Routes

`src/api/hooks/image-conversions/*` exposes hook-oriented image conversion callback/debug endpoints separate from Admin routes.
