# Backend Services, Workflows, and Subscribers

## Sanity Module

`src/modules/sanity/service.ts` wraps `@sanity/client`. It is configured by `medusa-config.ts` with API token, project ID, API version, dataset, Studio URL, and a type map.

The module exposes:

- `upsertSyncDocument(type, data)` to create or update by `_id` or `id`.
- `createSyncDocument(type, data)` to create a document with `_type` and `_id`.
- `updateSyncDocument(type, data)` to patch existing documents while excluding `_id`, `_type`, `id`, and `medusaId`.
- `retrieve(id)`, `delete(id)`, `update(id, data)`, and `list(filter)`.
- `getStudioLink(type, id, config)` for Admin UI links.

The sync convention is important: Sanity document `_id` equals the Medusa ID. That makes cross-system lookup deterministic.

## Fashion Module

`src/modules/fashion/service.ts` extends `MedusaService` over `Material` and `Color`.

The module supports Admin material/color management and storefront resolution of material/color combinations for product variants. It does not add pricing logic by itself; it provides structured metadata that maps onto Medusa variant options.

## Product Media Module

`src/modules/product-media/service.ts` extends `MedusaService` over `ProductCategoryImage`.

It supports custom category image workflows and Admin widgets. The `product_category_image` model stores R2/file URLs and enforces one thumbnail per category through a unique partial index.

## Search Modules

`src/modules/meilisearch/service.ts` creates a Meilisearch client and indexes product documents into the configured product index. It uses the document `id` as the primary key.

`src/modules/algolia/service.ts` creates an Algolia client and maps product IDs to Algolia `objectID` values. Algolia sync endpoints and subscribers exist, but the local Algolia module is not currently registered in `medusa-config.ts`.

## Resend Notification Module

`src/modules/resend/service.tsx` is registered as the Medusa notification provider with `channels: ["email"]`. Email templates live in `src/modules/resend/emails`.

Templates include:

- `auth-email-confirm.tsx`
- `auth-forgot-password.tsx`
- `auth-password-reset.tsx`
- `order-placed.tsx`
- `order-update.tsx`
- `user-invite.tsx`
- `welcome.tsx`

## Sanity Workflows

`src/workflows/sanity-sync/index.ts` defines four workflows:

- `sanity-sync-types`
- `sanity-sync-collections`
- `sanity-sync-categories`
- `sanity-sync-products`

Each workflow delegates to a step file in `src/workflows/sanity-sync/steps`. The full Admin sync route runs types, collections, categories, then products so taxonomy records exist before product records reference or depend on them.

## Search Workflows

`src/workflows/sync-products.ts` queries Medusa products and builds sync inputs for product, type, collection, and category sync. `src/workflows/steps/sync-products.ts` indexes products into Meilisearch and implements compensation by deleting newly indexed products or restoring existing indexed records if the workflow rolls back.

`src/workflows/delete-products-from-meilisearch.ts` handles deletion from the Meilisearch index.

## Category Image Workflows

Category image workflows include:

- `create-category-images.ts`
- `update-category-images.ts`
- `delete-category-image.ts`
- `steps/convert-category-thumbnails.ts`
- `steps/create-category-images.ts`
- `steps/update-category-images.ts`
- `steps/delete-category-image.ts`

These workflows support the Admin category media widgets and validation middleware for category image routes.

## Subscribers

The subscribers directory contains event handlers for external integrations and notifications:

- `sanity-product-sync.ts` syncs Medusa products, categories, collections, and product types into Sanity.
- `product-sync.ts` indexes products on create/update/delete events.
- `product-delete.ts` deletes products from Meilisearch on product deletion.
- `meiliserach-sync.ts` and `alogolia-sync.ts` handle explicit sync events.
- `index-products.ts` supports product indexing jobs.
- `image-conversion-dispatch.ts` supports category/media image conversion.
- Notification subscribers handle order placement, admin invites, password reset, and customer welcome emails.

## Link Definitions

`src/links/product-sanity.ts` declares a read-only link between Medusa product IDs and Sanity product IDs through the Sanity module alias `sanity_product`.

`src/links/product-category-image.ts` links product category data with custom category image data.
