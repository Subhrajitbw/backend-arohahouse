import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: proccess.env.MEDUSA_bACKEND_URL!,
  debug: process.env.NODE_ENV === "development",
  auth: {
    type: "session",
  },

})
