import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Doc } from '../../convex/_generated/dataModel';

type AutoSaveFieldsProps = {
    form: UseFormReturn<any>;
    liquidAccounts: Doc<'accounts'>[];
    formatNumber: (val: string) => string;
};

export const AutoSaveFields = ({ form, liquidAccounts, formatNumber }: AutoSaveFieldsProps) => {
    const enableAutoSave = form.watch('enableAutoSave');

    return (
        <div className="space-y-3 bg-muted/30 p-4 rounded-lg border border-dashed border-primary/30">
            <FormField
                control={form.control}
                name="enableAutoSave"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between space-y-0">
                        <div className="space-y-0.5">
                            <FormLabel className="text-sm font-bold flex items-center gap-2">
                                ⚡ Enable Auto-Save
                            </FormLabel>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Automated monthly transfers
                            </div>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            {enableAutoSave && (
                <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1">
                    <FormField
                        control={form.control}
                        name="autoSaveSourceAccountId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Source Account</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Select source" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {liquidAccounts.map(account => (
                                            <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={form.control}
                            name="autoSaveAmount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Amount</FormLabel>
                                    <FormControl>
                                        <Input 
                                            className="h-8 text-xs"
                                            placeholder="0"
                                            {...field}
                                            onChange={(e) => field.onChange(formatNumber(e.target.value))}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="autoSaveDay"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Day of Month</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Array.from({ length: 28 }, (_, i) => (
                                                <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
