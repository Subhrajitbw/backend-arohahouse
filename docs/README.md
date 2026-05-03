# Aroha House Backend

This repository is the Medusa v2 backend for Aroha House. It owns commerce data, store/admin APIs, product pricing, customer authentication, order/customer notifications, search indexing, file storage, and synchronization of commerce records into the Sanity CMS.

The backend sits between the storefront and the operational data stores. The React storefront calls Medusa Store APIs and custom `/store/custom/*` endpoints for catalog, account, search-adjacent, and merchandising data. The backend also writes product, category, collection, and product type documents into Sanity so editorial content can be layered onto Medusa commerce records.

```text
Sanity CMS <---- sync workflows/subscribers ---- Medusa backend ---- Store APIs ---- aroha-front
     ^                                          |       |
     |                                          |       +---- Meilisearch / Algolia
     +------------- editorial content ----------+       +---- Resend / S3-compatible R2
```

## Tech Stack

The backend is built on Medusa `2.13.6` with TypeScript, PostgreSQL, Redis, Medusa modules/workflows/subscribers, custom Admin UI extensions, Sanity client integration, Meilisearch, Algolia, Resend, and S3-compatible object storage configured for R2. The runtime requires Node `>=20` and Yarn `4.7.0`.

Key configuration is in `medusa-config.ts`. The source tree follows Medusa conventions:

- `src/api` contains custom Store, Admin, and hook endpoints.
- `src/modules` contains custom Medusa modules for Sanity, fashion data, category media, search, Resend, and social auth providers.
- `src/workflows` contains Medusa workflows and workflow steps for syncing and indexing.
- `src/subscribers` reacts to Medusa events such as product changes, order placement, auth events, and search/sync triggers.
- `src/admin` contains Admin UI widgets, routes, hooks, and components.
- `src/links` contains Medusa link definitions.

## Responsibilities

The backend is responsible for canonical commerce behavior: products, variants, prices, regions, carts, customers, orders, categories, collections, product types, and auth. Custom code adds Aroha-specific capabilities for material/color modeling, product merchandising endpoints, curated categories, category media, Sanity synchronization, search indexing, and transactional email.

Sanity content is not the source of truth for core commerce. The backend syncs Medusa IDs and selected fields into Sanity documents, then preserves editorial fields such as descriptions, SEO, policies, trust content, and related products.

## Documentation Map

- `architecture.md` explains the backend structure and Medusa customizations.
- `api.md` documents custom endpoints discovered under `src/api`.
- `data-flow.md` explains request, sync, product, and search flows.
- `services.md` documents modules, workflows, subscribers, Admin extensions, and integration services.
- `system-overview.md` explains how all three repositories work together.
