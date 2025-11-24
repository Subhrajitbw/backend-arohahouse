import { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';
import { IProductModuleService } from '@medusajs/framework/types';
import { FASHION_MODULE } from '../../../../../modules/fashion';
import FashionModuleService from '../../../../../modules/fashion/service';

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService: IProductModuleService = req.scope.resolve(
    Modules.PRODUCT,
  );
  const fashionModuleService: FashionModuleService =
    req.scope.resolve(FASHION_MODULE);

  const product = await productModuleService.retrieveProduct(req.params.id, {
    relations: ['options', 'variants', 'variants.options'],
  });

  // ✅ Add null checks
  const materialOption = product.options?.find(
    (option) => option.title === 'Material',
  );
  const colorOption = product.options?.find(
    (option) => option.title === 'Color',
  );

  // ✅ Early return if required options don't exist
  if (!materialOption || !colorOption) {
    return res.status(200).json({
      missing_materials: [],
      materials: [],
      message: 'Product does not have Material or Color options configured',
    });
  }

  const materialsAndColorsNamesTree = new Map<string, string[]>();

  for (const productVariant of product.variants || []) { // ✅ Add fallback for variants
    const materialName = productVariant.options?.find(
      (option) => option.option_id === materialOption.id,
    )?.value;

    if (!materialName) {
      continue;
    }

    const colorNames = productVariant.options
      ?.filter((option) => option.option_id === colorOption.id)
      .map((option) => option.value) || []; // ✅ Add fallback

    if (!materialsAndColorsNamesTree.has(materialName)) {
      materialsAndColorsNamesTree.set(materialName, colorNames);
    } else {
      const existingColorNames = materialsAndColorsNamesTree.get(materialName) || []; // ✅ Add fallback

      materialsAndColorsNamesTree.set(
        materialName,
        Array.from(new Set([...existingColorNames, ...colorNames])),
      );
    }
  }

  // ✅ Early return if no materials found
  if (materialsAndColorsNamesTree.size === 0) {
    return res.status(200).json({
      missing_materials: [],
      materials: [],
      message: 'No material/color combinations found in product variants',
    });
  }

  const materials = await fashionModuleService.listMaterials(
    {
      name: Array.from(materialsAndColorsNamesTree.keys()),
    },
    {
      relations: ['colors'],
    },
  );

  res.status(200).json({
    missing_materials: Array.from(materialsAndColorsNamesTree.keys()).filter(
      (materialName) =>
        materials.every((material) => material.name !== materialName),
    ),
    materials: materials.map((material) => ({
      ...material,
      colors: material.colors?.filter((color) => // ✅ Add optional chaining
        materialsAndColorsNamesTree.get(material.name)?.includes(color.name),
      ) || [], // ✅ Add fallback
      missing_colors: (materialsAndColorsNamesTree.get(material.name) || []) // ✅ Add fallback
        .filter((colorName) =>
          material.colors?.every((color) => color.name !== colorName) ?? true, // ✅ Add nullish coalescing
        ),
    })),
  });
};
