# Backend Architecture

## Runtime Shape

`medusa-config.ts` defines a Medusa v2 application with PostgreSQL, Redis, CORS, cross-domain cookies, worker mode, file storage, notifications, auth providers, custom modules, and plugins.

Important configuration points:

- `projectConfig.databaseUrl` uses `DATABASE_URL`; PostgreSQL SSL is configured with `rejectUnauthorized: false`.
- Database pool limits are tuned for low-memory infrastructure with `max: 5`.
- `redisUrl` defaults to `redis://localhost:6379`.
- Store/Admin/Auth CORS values are environment-driven with local defaults for ports `5173`, `7001`, and `9000`.
- Cookies are `httpOnly`, `sameSite: "lax"`, and `secure` only in production.
- `workerMode: "server"` keeps workflow/event processing in the server process.

## Medusa Modules

The backend registers both built-in Medusa modules and local modules.

Built-in and plugin-backed modules:

- `@medusajs/medusa/file` with the S3 provider for R2-compatible storage.
- `@medusajs/medusa/notification` using the local Resend provider.
- `@medusajs/medusa/auth` with email/password, Google, and Facebook customer providers.
- Plugins for product SEO, variant images, collection images, and analytics.

Local modules:

- `src/modules/product-media` stores category images in the `product_category_image` model.
- `src/modules/fashion` stores `material` and `color` records used by product fashion options.
- `src/modules/sanity` wraps `@sanity/client` and exposes document upsert, update, delete, list, retrieve, and Studio-link helpers.
- `src/modules/meilisearch` indexes and searches product documents when `MEILISEARCH_HOST` is configured.
- `src/modules/algolia` contains a parallel Algolia search service.
- `src/modules/resend` implements the Medusa notification provider for email templates.

## Custom Data Models

`src/modules/fashion/models/material.ts` defines a `material` model with `id`, `name`, and a one-to-many `colors` relationship.

`src/modules/fashion/models/color.ts` defines a `color` model with `id`, `name`, `hex_code`, and a `belongsTo` relation to material.

`src/modules/product-media/models/product-category-image.ts` defines `product_category_image` with `url`, `file_id`, `type`, and `category_id`. It has a unique partial index that allows only one `thumbnail` per category.

## API Layer

Custom API code lives under `src/api`. It includes:

- Admin routes for fashion materials/colors, Sanity sync, search sync, category images, image conversion callbacks, product metadata widgets, and product type/collection details.
- Store routes for curated categories, product merchandising lists, fashion option resolution, custom product types, authenticated customer actions, and pricing debug.
- Hook routes for image conversion callbacks.
- `src/api/middlewares.ts` for custom route body limits, customer auth on `/store/custom/customer/*`, and Zod validation for image routes.

## Event-Driven Workflows

The backend uses Medusa subscribers and workflows to keep external systems synchronized:

```text
Medusa product/category/collection/type event
        |
        v
src/subscribers/sanity-product-sync.ts
        |
        v
src/workflows/sanity-sync/*
        |
        v
Sanity documents keyed by Medusa IDs
```

Search indexing is handled through product events and explicit sync endpoints. `src/subscribers/product-sync.ts`, `src/subscribers/product-delete.ts`, `src/subscribers/meiliserach-sync.ts`, and `src/workflows/steps/sync-products.ts` coordinate Meilisearch indexing and deletion.

## Admin Extensions

`src/admin` contains Medusa Admin widgets and custom pages:

- `routes/fashion/page.tsx` and `routes/sanity/page.tsx` add Admin pages.
- `widgets/product-fashion.tsx`, `widgets/product-content-seo.tsx`, and `widgets/sanity-product.tsx` extend product workflows.
- `widgets/sanity-category.tsx`, `widgets/sanity-collection.tsx`, and `widgets/sanity-product-type.tsx` expose Sanity linking/sync for taxonomy documents.
- `widgets/category-media-widget.tsx` and `components/category-media/*` manage category images.

The Admin SDK client is configured in `src/admin/lib/sdk.ts`.
