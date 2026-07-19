import { Doc, Id } from '../../convex/_generated/dataModel';

export type TransactionWithDetails = Omit<Doc<'transactions'>, 'splits' | 'accountId' | 'categoryId' | 'toAccountId' | 'labelIds' | 'merchantId'> & {
  accountId: Id<'accounts'>;
  categoryId?: Id<'categories'>;
  toAccountId?: Id<'accounts'>;
  labelIds?: Id<'labels'>[];
  merchantId?: Id<'merchants'>;
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  hideAmount: boolean;
  labels?: Doc<'labels'>[];
  merchant?: Doc<'merchants'> | null;
  splits?: Array<{
    categoryId: Id<'categories'>;
    amount: string;
    description?: string;
    labelIds?: Id<'labels'>[];
    categoryName?: string;
    labelNames?: string[];
    labelColors?: string[];
  }>;
};
