/**
 * Helper logic for transaction indexing and search.
 */

/**
 * Generates flat arrays of category and label IDs for indexing purposes.
 * This includes IDs from both the root transaction and all splits.
 * Supports both legacy single labelId and new labelIds array.
 */
export function generateSearchTags(data: {
  categoryId?: string;
  labelId?: string;
  labelIds?: string[];
  isSplit?: boolean;
  splits?: Array<{
    categoryId: string;
    labelId?: string;
    labelIds?: string[];
  }>;
}) {
  const categoryIds = new Set<string>();
  const labelIdsSet = new Set<string>();

  // 1. Extract from root
  if (data.categoryId) categoryIds.add(String(data.categoryId));
  if (data.labelIds && Array.isArray(data.labelIds)) {
    data.labelIds.forEach((id) => labelIdsSet.add(String(id)));
  } else if (data.labelId) {
    labelIdsSet.add(String(data.labelId));
  }

  // 2. Extract from splits
  if (data.isSplit && data.splits) {
    data.splits.forEach((split) => {
      if (split.categoryId) categoryIds.add(String(split.categoryId));
      if (split.labelIds && Array.isArray(split.labelIds)) {
        split.labelIds.forEach((id) => labelIdsSet.add(String(id)));
      } else if (split.labelId) {
        labelIdsSet.add(String(split.labelId));
      }
    });
  }

  return {
    searchCategoryIds: Array.from(categoryIds),
    searchLabelIds: Array.from(labelIdsSet),
  };
}
