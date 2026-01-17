/**
 * Helper logic for transaction indexing and search.
 */

/**
 * Generates flat arrays of category and label IDs for indexing purposes.
 * This includes IDs from both the root transaction and all splits.
 */
export function generateSearchTags(data: {
  categoryId?: string;
  labelId?: string;
  isSplit?: boolean;
  splits?: Array<{
    categoryId: string;
    labelId?: string;
  }>;
}) {
  const categoryIds = new Set<string>();
  const labelIds = new Set<string>();

  // 1. Extract from root
  if (data.categoryId) categoryIds.add(String(data.categoryId));
  if (data.labelId) labelIds.add(String(data.labelId));

  // 2. Extract from splits
  if (data.isSplit && data.splits) {
    data.splits.forEach((split) => {
      if (split.categoryId) categoryIds.add(String(split.categoryId));
      if (split.labelId) labelIds.add(String(split.labelId));
    });
  }

  return {
    searchCategoryIds: Array.from(categoryIds),
    searchLabelIds: Array.from(labelIds),
  };
}
