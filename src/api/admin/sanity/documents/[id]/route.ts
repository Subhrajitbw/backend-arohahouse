import { 
  MedusaRequest, 
  MedusaResponse,
} from "@medusajs/framework/http"
import SanityModuleService from "src/modules/sanity/service"
import { SANITY_MODULE } from "../../../../../modules/sanity"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const sanityModule: SanityModuleService = req.scope.resolve(
    SANITY_MODULE
  )

  // Retrieve the document from Sanity using the Medusa ID.
  // This should return the document regardless of whether it's a 
  // product, category, collection, or type.
  const sanityDocument = await sanityModule.retrieve(id)

  let url = ""
  
  if (sanityDocument) {
    // We pass the sanityDocument._type (e.g., "product", "category") 
    // to ensure the Studio Link points to the correct desk structure.
    url = await sanityModule.getStudioLink(
      sanityDocument._type,
      sanityDocument._id,
      { explicit_type: true }
    )
  }

  res.json({ 
    sanity_document: sanityDocument, 
    studio_url: url 
  })
}