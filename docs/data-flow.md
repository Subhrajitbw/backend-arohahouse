# Backend Data Flow

## Storefront Request Flow

```text
aroha-front
  |
  | Medusa JS SDK / custom fetch
  v
Medusa HTTP API
  |
  +-- core Store APIs for products, categories, carts, customers, orders
  +-- custom routes in src/api/store/*
  |
  v
Query Graph / Medusa services / custom modules
  |
  v
JSON response to storefront
```

For catalog pages, the storefront usually uses `sdk.store.product.list` or `sdk.store.product.retrieve`. Custom merchandising sections call routes such as `/store/custom/new`, `/store/custom/discounted`, and `/store/curated-categories`.

## Product Sync to Sanity

Product, category, collection, and product type records are created and changed in Medusa. `src/subscribers/sanity-product-sync.ts` subscribes to create, update, and delete events for:

- `product.*`
- `product-category.*`
- `product-collection.*`
- `product-type.*`

For create/update events, the subscriber dispatches the appropriate workflow in `src/workflows/sanity-sync`. For delete events, it deletes the Sanity document with the same ID.

```text
Medusa product updated
  |
  v
sanity-product-sync subscriber
  |
  v
sanitySyncProductsWorkflow
  |
  v
syncProductsStep
  |
  v
Sanity document _id = Medusa product id
```

`src/workflows/sanity-sync/steps/sync-products.ts` writes these product fields into Sanity:

- `_id` and `medusaId` from the Medusa product ID.
- `_type: "product"`.
- `title`, `handle`, and `medusaType`.
- `thumbnailR2` from Medusa `thumbnail`.
- `galleryR2` from Medusa product images.

When a Sanity document already exists, the sync step preserves editorial fields such as `shortDescription`, `richDescription`, `features`, `specifications`, `extraSections`, `relatedProducts`, `upsellProducts`, and `crosssellProducts` if present.

## Category, Collection, and Product Type Sync

Category sync in `sync-categories.ts` fetches Medusa product categories, computes hierarchy depth, syncs parents before children, and writes Sanity references through `parent._ref`.

Collection sync in `sync-collections.ts` writes `medusaId`, `title`, and `handle`, while preserving CMS fields such as `heroImageR2`, `shortDescription`, `content`, and `seo`.

Product type sync in `sync-product-types.ts` writes `medusaId` and `title`, while preserving `description` and `seo`.

## Search Indexing Flow

Product events trigger `src/subscribers/product-sync.ts`, which runs `syncProductsWorkflow`. Product deletion triggers `src/subscribers/product-delete.ts`, which runs `deleteProductsFromMeilisearchWorkflow`.

The Meilisearch service in `src/modules/meilisearch/service.ts` supports:

- `indexData`
- `retrieveFromIndex`
- `deleteFromIndex`
- `search`

Admin routes can trigger search sync events:

```text
POST /admin/meilisearch/sync -> event "meilisearch.sync"
POST /admin/algolia/sync     -> event "algolia.sync"
```

Meilisearch is registered only when `MEILISEARCH_HOST` exists in the environment. Algolia service code exists, but `medusa-config.ts` does not currently register the Algolia local module.

## Pricing and Merchandising Flow

The `/store/custom/new` endpoint returns recently created published products and requests calculated variant prices with region/currency context.

The `/store/custom/discounted` endpoint reads active Medusa sale price lists and compares sale entries against base prices. It returns storefront-ready sale metadata such as `discount_percentage`, `original_price`, `sale_price`, and `currency_code`.

The `/store/custom/top-selling` endpoint reads orders from a date window, aggregates quantities by product ID, and returns the top products.

## Fashion Option Flow

```text
Product variants
  |
  | options titled "Material" and "Color"
  v
/store/custom/fashion/:productHandle
  |
  v
fashion module material/color records
  |
  v
materials[] with valid color combinations
```

The route depends on product options being titled exactly `Material` and `Color`. If either option is missing, it returns an empty `materials` array.

## Email Flow

The notification module is configured in `medusa-config.ts` to use `src/modules/resend`. Email templates live under `src/modules/resend/emails` and include auth confirmation, forgot/reset password, order placed/update, user invite, and welcome templates.

Subscribers such as `order-placed-notification.ts`, `admin-invite-notification.ts`, `auth-password-reset-notification.ts`, and `customer-welcome-notification.ts` connect Medusa events to email sending.
