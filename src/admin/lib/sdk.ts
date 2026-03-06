import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: "https://api.arohahouse.com/,
  debug: import.meta.env.DEV,
  auth: {
    type: "session",
  },
})
