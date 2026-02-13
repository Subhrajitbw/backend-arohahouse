import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const TOKEN_HEADER = "x-image-conversion-token"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const expectedTokenRaw = process.env.IMAGE_CONVERSION_TOKEN
  const expectedToken = expectedTokenRaw?.trim() ?? ""

  const headerValue = req.headers[TOKEN_HEADER]
  const providedTokenRaw = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue
  const providedToken = providedTokenRaw?.trim() ?? ""

  res.status(200).json({
    expected_length: expectedToken.length,
    provided_length: providedToken.length,
    match: expectedToken.length > 0 && expectedToken === providedToken,
  })
}
