import {
    Logger,
} from "@medusajs/framework/types"
import {
    SanityClient,
    createClient,
    FirstDocumentMutationOptions
} from "@sanity/client"

const SyncDocumentTypes = {
    PRODUCT: "product",
} as const

type SyncDocumentTypes =
    (typeof SyncDocumentTypes)[keyof typeof SyncDocumentTypes];


type ModuleOptions = {
    api_token: string;
    project_id: string;
    api_version: string;
    dataset: "production" | "development";
    type_map?: Record<SyncDocumentTypes, string>;
    studio_url?: string;
}

type InjectedDependencies = {
    logger: Logger
};

// RELAXED TYPE: Accept any object, not just ProductDTO
type SyncDocumentInputs = Record<string, any>;

class SanityModuleService {
    private client: SanityClient
    private studioUrl?: string
    private logger: Logger
    private typeMap: Record<SyncDocumentTypes, string>

    constructor({
        logger,
    }: InjectedDependencies, options: ModuleOptions) {
        this.client = createClient({
            projectId: options.project_id,
            apiVersion: options.api_version,
            dataset: options.dataset,
            token: options.api_token,
            useCdn: false, // Important for write operations
        })
        this.logger = logger

        this.logger.info("Connected to Sanity")

        this.studioUrl = options.studio_url
        this.typeMap = Object.assign(
            {},
            {
                [SyncDocumentTypes.PRODUCT]: "product",
            },
            options.type_map || {}
        )
    }

    // --- MAIN LOGIC: PASSTHROUGH ---
    // We assume the Workflow Step has already formatted the data correctly.
    
    async upsertSyncDocument(
        type: SyncDocumentTypes,
        data: SyncDocumentInputs
    ) {
        // Use _id if present (from our workflow), otherwise fall back to id
        const docId = data._id || data.id;
        
        const existing = await this.client.getDocument(docId)
        if (existing) {
            return await this.updateSyncDocument(type, data)
        }

        return await this.createSyncDocument(type, data)
    }

    async createSyncDocument(
        type: SyncDocumentTypes,
        data: SyncDocumentInputs,
        options?: FirstDocumentMutationOptions
    ) {
        // Ensure _type is set
        const doc = {
            ...data,
            _type: this.typeMap[type], 
            // Ensure _id is set (Sanity needs this to link back to Medusa)
            _id: data._id || data.id 
        }
        return await this.client.create(doc, options)
    }

    async updateSyncDocument(
        type: SyncDocumentTypes,
        data: SyncDocumentInputs
    ) {
        const docId = data._id || data.id;
        
        // Remove sensitive fields we shouldn't overwrite like _id or _type in a patch
        const { _id, _type, id, medusaId, ...updateData } = data;

        // Perform a patch
        return await this.client.patch(docId)
            .set(updateData) // Update all fields provided by the workflow
            .commit()
    }

    // --- UTILS ---

    async retrieve(id: string) {
        return this.client.getDocument(id)
    }

    async delete(id: string) {
        return this.client.delete(id)
    }

    async update(id: string, data: any) {
        return await this.client.patch(id, {
            set: data,
        }).commit()
    }

    async list(filter: { id: string | string[] }) {
        const data = await this.client.getDocuments(
            Array.isArray(filter.id) ? filter.id : [filter.id]
        )
        return data.map((doc) => ({
            id: doc?._id,
            ...doc,
        }))
    }

    async getStudioLink(
        type: string,
        id: string,
        config: { explicit_type?: boolean } = {}
    ) {
        const resolvedType = config.explicit_type ? type : this.typeMap[type as SyncDocumentTypes]
        if (!this.studioUrl) {
            throw new Error("No studio URL provided")
        }
        return `${this.studioUrl}/structure/${resolvedType};${id}`
    }
}

export default SanityModuleService
