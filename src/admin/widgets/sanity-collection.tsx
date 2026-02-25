import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { HttpTypes, DetailWidgetProps } from "@medusajs/types"
import { ArrowUpRightOnBox } from "@medusajs/icons"
import { Button, CodeBlock, Container, StatusBadge, toast } from "@medusajs/ui"
import { useState } from "react"
import { useSanityDocument, useTriggerSanityCollectionSync } from "../hooks/sanity"

const CollectionWidget = ({ data }: DetailWidgetProps<HttpTypes.AdminCollection>) => {
  const { mutateAsync, isPending } = useTriggerSanityCollectionSync(data.id)
  const { sanity_document, studio_url, isLoading } = useSanityDocument(data.id)
  const [showCode, setShowCode] = useState(false)

  const handleSync = async () => {
    const tid = toast.loading("Syncing collection...")
    try {
      await mutateAsync()
      toast.success("Collection synced", { id: tid })
    } catch (e) { toast.error("Failed", { id: tid }) }
  }

  return (
    <Container className="p-0 overflow-hidden mt-4">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-x-2">
          <h2 className="txt-compact-xlarge-plus text-ui-fg-base">
            Sanity Status
          </h2>

          {isLoading ? (
            <span className="animate-pulse txt-compact-small text-ui-fg-muted">
              Checking...
            </span>
          ) : sanity_document?.title === data.title ? (
            <StatusBadge color="green">Synced</StatusBadge>
          ) : (
            <StatusBadge color="red">Not Synced</StatusBadge>
          )}
        </div>

        <Button
          size="small"
          variant="secondary"
          onClick={handleSync}
          isLoading={isPending}
        >
          Sync Now
        </Button>
      </div>

      <div className="px-6 py-4 flex gap-x-3">
        <Button
          size="small"
          variant="transparent"
          className="text-ui-fg-muted"
          onClick={() => setShowCode(!showCode)}
        >
          {showCode ? "Hide" : "View"} Sanity Data
        </Button>

        {studio_url && (
          <Button variant="transparent" size="small" asChild>
            <a
              href={studio_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-x-2"
            >
              <ArrowUpRightOnBox />
              Open in Studio
            </a>
          </Button>
        )}
      </div>

      {showCode && (
        <div className="px-6 pb-4">
          {sanity_document ? (
            <CodeBlock
              snippets={[
                {
                  language: "json",
                  label: "Sanity JSON",
                  code: JSON.stringify(sanity_document, null, 2),
                },
              ]}
            >
              <CodeBlock.Body />
            </CodeBlock>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center txt-small text-ui-fg-muted">
              No document found in Sanity. Click Sync to create it.
            </div>
          )}
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product_collection.details.after" })
export default CollectionWidget