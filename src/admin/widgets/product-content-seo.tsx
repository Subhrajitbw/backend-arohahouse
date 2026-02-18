import * as React from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct, DetailWidgetProps } from "@medusajs/types"
import { PencilSquare } from "@medusajs/icons"
import { Button, Container, Drawer, Heading, Text, toast } from "@medusajs/ui"
import { z } from "zod"

import { Form } from "../components/Form/Form"
import { InputField } from "../components/Form/InputField"
import { TextareaField } from "../components/Form/TextareaField"
import { MarkdownField } from "../components/Form/MarkdownField"

const productContentSchema = z.object({
  description: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  ai_summary: z.string().optional(),
  material_type: z.string().optional(),
  style_category: z.string().optional(),
  target_audience: z.string().optional(),
  gtin_equivalent: z.string().optional(),
  brand_origin: z.string().optional(),
  dimensions_text: z.string().optional(),
  care_upholstery: z.string().optional(),
  care_frame: z.string().optional(),
  warranty: z.string().optional(),
  delivery_timeline: z.string().optional(),
  return_policy: z.string().optional(),
  consultation_phone: z.string().optional(),
  structured_data: z.string().optional(),
})

type ProductContentForm = z.infer<typeof productContentSchema>

type AdminProductDetails = {
  id: string
  description?: string | null
  metadata?: Record<string, unknown> | null
}

const META_KEYS: Array<keyof Omit<ProductContentForm, "description">> = [
  "seo_title",
  "seo_description",
  "ai_summary",
  "material_type",
  "style_category",
  "target_audience",
  "gtin_equivalent",
  "brand_origin",
  "dimensions_text",
  "care_upholstery",
  "care_frame",
  "warranty",
  "delivery_timeline",
  "return_policy",
  "consultation_phone",
  "structured_data",
]

const toStringValue = (value: unknown) => {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    return value.join(", ")
  }

  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return ""
    }
  }

  return ""
}

const toNullableTrimmedString = (value?: string) => {
  const next = value?.trim()
  return next ? next : undefined
}

const toFormValues = (product: AdminProductDetails): ProductContentForm => {
  const metadata = product.metadata ?? {}

  return {
    description: product.description ?? "",
    seo_title: toStringValue(metadata.seo_title),
    seo_description: toStringValue(metadata.seo_description),
    ai_summary: toStringValue(metadata.ai_summary),
    material_type: toStringValue(metadata.material_type),
    style_category: toStringValue(metadata.style_category),
    target_audience: toStringValue(metadata.target_audience),
    gtin_equivalent: toStringValue(metadata.gtin_equivalent),
    brand_origin: toStringValue(metadata.brand_origin),
    dimensions_text: toStringValue(metadata.dimensions_text),
    care_upholstery: toStringValue(metadata.care_upholstery),
    care_frame: toStringValue(metadata.care_frame),
    warranty: toStringValue(metadata.warranty),
    delivery_timeline: toStringValue(metadata.delivery_timeline),
    return_policy: toStringValue(metadata.return_policy),
    consultation_phone: toStringValue(metadata.consultation_phone),
    structured_data: toStringValue(metadata.structured_data),
  }
}

const ProductContentSeoWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [productDetails, setProductDetails] =
    React.useState<AdminProductDetails | null>(null)

  const loadProduct = React.useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/admin/products/${data.id}`, {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to load product ${data.id}`)
      }

      const json = (await response.json()) as {
        product?: AdminProductDetails
      }
      if (!json.product) {
        throw new Error("Product payload missing")
      }
      setProductDetails(json.product)
    } catch (error) {
      console.error(error)
      toast.error("Couldn't load content metadata")
    } finally {
      setIsLoading(false)
    }
  }, [data.id])

  React.useEffect(() => {
    void loadProduct()
  }, [loadProduct])

  const defaultValues = React.useMemo(() => {
    if (!productDetails) {
      return undefined
    }

    return toFormValues(productDetails)
  }, [productDetails])

  const handleSave = async (values: ProductContentForm) => {
    if (!productDetails) {
      return
    }

    const metadata = {
      ...(productDetails.metadata ?? {}),
    } as Record<string, unknown>

    for (const key of META_KEYS) {
      const value = toNullableTrimmedString(values[key])
      if (!value) {
        delete metadata[key]
        continue
      }

      if (key === "structured_data") {
        try {
          metadata[key] = JSON.parse(value)
        } catch {
          metadata[key] = value
        }
      } else {
        metadata[key] = value
      }
    }

    const response = await fetch(`/admin/products/${data.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        description: values.description ?? "",
        metadata,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to save product content")
    }

    const json = (await response.json()) as { product?: AdminProductDetails }
    if (json.product) {
      setProductDetails(json.product)
    } else {
      await loadProduct()
    }

    setIsDrawerOpen(false)
    toast.success("Product content saved")
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading>Content &amp; SEO</Heading>
        <Button
          variant="transparent"
          size="small"
          className="text-fg-muted dark:text-fg-muted-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark"
          onClick={(event) => {
            event.preventDefault()
            setIsDrawerOpen(true)
          }}
          disabled={!defaultValues}
        >
          <PencilSquare /> Edit
        </Button>
      </div>
      <div className="px-6 py-4 flex flex-col gap-2 text-fg-subtle dark:text-fg-subtle-dark">
        {isLoading ? (
          <Text>Loading...</Text>
        ) : !productDetails ? (
          <Text>Unable to load product content</Text>
        ) : (
          <>
            <Text>
              Description:{" "}
              {(productDetails.description?.trim().length ?? 0) > 0
                ? "Available"
                : "Not set"}
            </Text>
            <Text>
              SEO title:{" "}
              {toStringValue(productDetails.metadata?.seo_title).trim() || "Not set"}
            </Text>
            <Text>
              SEO description:{" "}
              {toStringValue(productDetails.metadata?.seo_description).trim()
                ? "Available"
                : "Not set"}
            </Text>
            <Text>
              AI summary:{" "}
              {toStringValue(productDetails.metadata?.ai_summary).trim()
                ? "Available"
                : "Not set"}
            </Text>
          </>
        )}
      </div>
      {defaultValues && (
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <Drawer.Content className="max-h-full">
            <Drawer.Header>
              <Drawer.Title>Edit Product Content &amp; Metadata</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="p-4 overflow-auto">
              <Form
                schema={productContentSchema}
                defaultValues={defaultValues}
                onSubmit={handleSave}
                formProps={{
                  id: `product-content-seo-${data.id}`,
                }}
              >
                <div className="flex flex-col gap-4">
                  <MarkdownField
                    name="description"
                    label="Description (Markdown)"
                    textareaProps={{
                      rows: 16,
                    }}
                  />
                  <InputField name="seo_title" label="SEO Title" />
                  <TextareaField
                    name="seo_description"
                    label="SEO Description"
                    textareaProps={{ rows: 3 }}
                  />
                  <TextareaField
                    name="ai_summary"
                    label="AI Summary"
                    textareaProps={{ rows: 3 }}
                  />
                  <InputField name="material_type" label="Material Type" />
                  <InputField name="style_category" label="Style Category" />
                  <InputField name="target_audience" label="Target Audience" />
                  <InputField name="gtin_equivalent" label="GTIN Equivalent" />
                  <InputField name="brand_origin" label="Brand Origin" />
                  <InputField name="dimensions_text" label="Dimensions Text" />
                  <TextareaField
                    name="care_upholstery"
                    label="Care Instructions (Upholstery)"
                    textareaProps={{ rows: 3 }}
                  />
                  <TextareaField
                    name="care_frame"
                    label="Care Instructions (Frame)"
                    textareaProps={{ rows: 3 }}
                  />
                  <InputField name="warranty" label="Warranty" />
                  <InputField
                    name="delivery_timeline"
                    label="Delivery Timeline"
                  />
                  <TextareaField
                    name="return_policy"
                    label="Return Policy"
                    textareaProps={{ rows: 3 }}
                  />
                  <InputField
                    name="consultation_phone"
                    label="Consultation Phone"
                  />
                  <TextareaField
                    name="structured_data"
                    label="JSON-LD / Structured Data"
                    textareaProps={{ rows: 6 }}
                  />
                </div>
              </Form>
            </Drawer.Body>
            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button variant="secondary">Cancel</Button>
              </Drawer.Close>
              <Button type="submit" form={`product-content-seo-${data.id}`}>
                Save
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductContentSeoWidget
