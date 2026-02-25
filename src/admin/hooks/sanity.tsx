import { 
  useMutation, 
  UseMutationOptions, 
  useQueryClient, 
  useQuery, 
} from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

// --- TYPES & INTERFACES ---

interface SanityDocumentResponse {
  sanity_document: Record<string, any> | null
  studio_url: string | null
}

interface SanitySyncResponse {
  workflow_executions: any[]
  count: number
}

// --- TARGETED SYNC HOOKS ---

const useTriggerDocumentSync = (
  id: string,
  type: "product" | "category" | "collection" | "type",
  options?: UseMutationOptions
) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/sanity/documents/${id}/sync`, {
        method: "post",
        query: { type } 
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      console.log(data)
      queryClient.invalidateQueries({
        queryKey: ["sanity_document", id],
      })
      options?.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

export const useTriggerSanityProductSync = (id: string, options?: UseMutationOptions) => 
  useTriggerDocumentSync(id, "product", options)

export const useTriggerSanityCategorySync = (id: string, options?: UseMutationOptions) => 
  useTriggerDocumentSync(id, "category", options)

export const useTriggerSanityCollectionSync = (id: string, options?: UseMutationOptions) => 
  useTriggerDocumentSync(id, "collection", options)

export const useTriggerSanityTypeSync = (id: string, options?: UseMutationOptions) => 
  useTriggerDocumentSync(id, "type", options)


// --- DATA FETCHING HOOKS ---

/**
 * Fetches status of a specific document in Sanity
 */
export const useSanityDocument = (id: string, query?: Record<string, any>) => {
  const { data, ...rest } = useQuery<SanityDocumentResponse>({
    queryFn: async () => sdk.client.fetch<SanityDocumentResponse>(`/admin/sanity/documents/${id}`, { query }),
    queryKey: ["sanity_document", id],
    enabled: !!id,
    retry: false,
    refetchOnWindowFocus: true,
  })

  return { 
    sanity_document: data?.sanity_document, 
    studio_url: data?.studio_url, 
    ...rest 
  }
}

/**
 * Triggers a full bulk sync (Used in Sanity Dashboard)
 */
export const useTriggerSanitySync = (options?: UseMutationOptions) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/sanity/syncs`, {
        method: "post",
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: ["sanity_sync"] })
      options?.onSuccess?.(data, variables, context)
    },
    ...options,
  })
}

/**
 * Fetches sync history (Used in Sanity Dashboard)
 * Fixed: Explicit typing resolves ts(2339)
 */
export const useSanitySyncs = (
  query?: Record<string, any>,
  options?: any
) => {
  const { data, ...rest } = useQuery<SanitySyncResponse>({
    queryFn: async () => sdk.client.fetch<SanitySyncResponse>(`/admin/sanity/syncs`, { query }),
    queryKey: ["sanity_sync"],
    ...options,
  })

  return { 
    workflow_executions: data?.workflow_executions || [], 
    count: data?.count || 0, 
    ...rest 
  }
}