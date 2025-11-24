import { Meilisearch } from "meilisearch"
import { MedusaError } from "@medusajs/framework/utils"

type MeilisearchOptions = {
  host: string;
  apiKey: string;
  productIndexName: string;
}

export type MeilisearchIndexType = "product"

export default class MeilisearchModuleService {
  private client: Meilisearch
  private options: MeilisearchOptions

  constructor({}, options: MeilisearchOptions) {
    if (!options.host || !options.apiKey || !options.productIndexName) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT, 
        "Meilisearch options are required"
      )
    }
    this.client = new Meilisearch({
      host: options.host,
      apiKey: options.apiKey,
    })
    this.options = options
  }

  async getIndexName(type: MeilisearchIndexType) {
    switch (type) {
      case "product":
        return this.options.productIndexName
      default:
        throw new Error(`Invalid index type: ${type}`)
    }
  }

  // ✅ Changed to accept any[] instead of Record<string, unknown>[]
  async indexData(data: any[], type: MeilisearchIndexType = "product") {
    const indexName = await this.getIndexName(type)
    const index = this.client.index(indexName)
    
    // Transform data to ensure id exists as primary key
    const documents = data.map((item) => ({
      ...item,
      id: item.id || item.product_id, // Fallback for nested structures
    }))

    await index.addDocuments(documents)
  }

  async retrieveFromIndex(documentIds: string[], type: MeilisearchIndexType = "product") {
    const indexName = await this.getIndexName(type)
    const index = this.client.index(indexName)
    
    const results = await Promise.all(
      documentIds.map(async (id) => {
        try {
          return await index.getDocument(id)
        } catch (error) {
          return null
        }
      })
    )

    return results.filter(Boolean)
  }

  async deleteFromIndex(documentIds: string[], type: MeilisearchIndexType = "product") {
    const indexName = await this.getIndexName(type)
    const index = this.client.index(indexName)
    
    await index.deleteDocuments(documentIds)
  }

  async search(query: string, options?: any, type: MeilisearchIndexType = "product") {
    const indexName = await this.getIndexName(type)
    const index = this.client.index(indexName)
    
    return await index.search(query, options)
  }
}
