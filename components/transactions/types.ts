import { Doc, Id } from '../../convex/_generated/dataModel';

export type TransactionWithDetails = Omit<Doc<'transactions'>, 'splits' | 'accountId' | 'categoryId' | 'toAccountId' | 'labelId' | 'merchantId'> & {
  accountId: Id<'accounts'>;
  categoryId?: Id<'categories'>;
  toAccountId?: Id<'accounts'>;
  labelId?: Id<'labels'>;
  merchantId?: Id<'merchants'>;
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  hideAmount: boolean;
  label?: Doc<'labels'> | null;
  merchant?: Doc<'merchants'> | null;
  splits?: Array<{
    categoryId: Id<'categories'>;
    amount: string;
    description?: string;
    labelId?: Id<'labels'>;
    categoryName?: string;
    labelName?: string;
    labelColor?: string;
  }>;
};
