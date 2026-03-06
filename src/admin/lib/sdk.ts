import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: "https://api.arohahouse.com",
  debug: process.env.NODE_ENV === "development",
  auth: {
    type: "session",
  },

})
