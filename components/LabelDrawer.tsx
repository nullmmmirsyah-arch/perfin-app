import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2, Search } from 'lucide-react';
import {
  Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  Briefcase, Building, GraduationCap, BookOpen, Laptop, Code,
  Car, Bus, Plane, Train, Bike, Ship, Fuel,
  Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake,
  Activity, Pill, Stethoscope, Dumbbell, Moon,
  Users, User, Baby, PawPrint,
  Tag, Clock, MapPin, Phone, Music, Camera, Umbrella,
  Wrench, Hammer, Palette, Zap, Globe, Bookmark, Shield,
  TrendingUp, DollarSign, BarChart3, Folder, FileText,
} from 'lucide-react';

const ICON_LIST = [
  { name: 'Tag', Icon: Tag },
  { name: 'Home', Icon: Home },
  { name: 'Heart', Icon: Heart },
  { name: 'Star', Icon: Star },
  { name: 'Gift', Icon: Gift },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Gem', Icon: Gem },
  { name: 'Crown', Icon: Crown },
  { name: 'Flame', Icon: Flame },
  { name: 'Wallet', Icon: Wallet },
  { name: 'CreditCard', Icon: CreditCard },
  { name: 'Banknote', Icon: Banknote },
  { name: 'Coins', Icon: Coins },
  { name: 'PiggyBank', Icon: PiggyBank },
  { name: 'Receipt', Icon: Receipt },
  { name: 'DollarSign', Icon: DollarSign },
  { name: 'TrendingUp', Icon: TrendingUp },
  { name: 'BarChart3', Icon: BarChart3 },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'Building', Icon: Building },
  { name: 'GraduationCap', Icon: GraduationCap },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'Laptop', Icon: Laptop },
  { name: 'Code', Icon: Code },
  { name: 'Car', Icon: Car },
  { name: 'Bus', Icon: Bus },
  { name: 'Plane', Icon: Plane },
  { name: 'Train', Icon: Train },
  { name: 'Bike', Icon: Bike },
  { name: 'Ship', Icon: Ship },
  { name: 'Fuel', Icon: Fuel },
  { name: 'Coffee', Icon: Coffee },
  { name: 'UtensilsCrossed', Icon: UtensilsCrossed },
  { name: 'ShoppingBag', Icon: ShoppingBag },
  { name: 'Apple', Icon: Apple },
  { name: 'Beer', Icon: Beer },
  { name: 'Cake', Icon: Cake },
  { name: 'Activity', Icon: Activity },
  { name: 'Pill', Icon: Pill },
  { name: 'Stethoscope', Icon: Stethoscope },
  { name: 'Dumbbell', Icon: Dumbbell },
  { name: 'Moon', Icon: Moon },
  { name: 'Users', Icon: Users },
  { name: 'User', Icon: User },
  { name: 'Baby', Icon: Baby },
  { name: 'PawPrint', Icon: PawPrint },
  { name: 'Clock', Icon: Clock },
  { name: 'MapPin', Icon: MapPin },
  { name: 'Phone', Icon: Phone },
  { name: 'Music', Icon: Music },
  { name: 'Camera', Icon: Camera },
  { name: 'Umbrella', Icon: Umbrella },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Hammer', Icon: Hammer },
  { name: 'Palette', Icon: Palette },
  { name: 'Zap', Icon: Zap },
  { name: 'Globe', Icon: Globe },
  { name: 'Bookmark', Icon: Bookmark },
  { name: 'Shield', Icon: Shield },
  { name: 'Folder', Icon: Folder },
  { name: 'FileText', Icon: FileText },
];

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_LIST.map(({ name, Icon }) => [name, Icon])
);

const LabelFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
});

type LabelFormValues = z.infer<typeof LabelFormSchema>;

type LabelDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: Doc<'labels'>;
};

const LabelDrawer = ({ open, onOpenChange, label }: LabelDrawerProps) => {
  const { householdId } = useHousehold();
  const createLabel = useMutation(api.labels.create);
  const updateLabel = useMutation(api.labels.update);

  const isEditMode = !!label;
  const [isProcessing, setIsProcessing] = React.useState(false);
  const submitLock = React.useRef(false);
  const [searchQuery, setSearchQuery] = useState('');

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(LabelFormSchema),
  });

  const filteredIcons = useMemo(() => {
    if (!searchQuery) return ICON_LIST;
    const q = searchQuery.toLowerCase();
    return ICON_LIST.filter(({ name }) => name.toLowerCase().includes(q));
  }, [searchQuery]);

  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;
      setSearchQuery('');

      if (isEditMode) {
        form.reset({ name: label.name, icon: label.icon });
      } else {
        form.reset({ name: '', icon: 'Tag' });
      }
    }
  }, [open, isEditMode, label, form]);

  const onSubmit = async (data: LabelFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
      submitLock.current = true;
      setIsProcessing(true);

      if (isEditMode) {
        await updateLabel({ id: label._id, ...data });
      } else {
        await createLabel({ ...data, householdId: householdId ?? undefined });
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      submitLock.current = false;
    }
  };

  const selectedIcon = form.watch('icon');
  const SelectedIconComponent = ICON_MAP[selectedIcon] || Tag;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit Label' : 'Create a new Label'}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Work" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search icons..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                          />
                        </div>
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-[200px] overflow-y-auto">
                          {filteredIcons.map(({ name, Icon }) => (
                            <button
                              key={name}
                              type="button"
                              className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center transition-all hover:bg-muted active:scale-95",
                                field.value === name
                                  ? "bg-primary/10 ring-2 ring-primary"
                                  : "bg-muted/50"
                              )}
                              onClick={() => field.onChange(name)}
                              title={name}
                            >
                              <Icon
                                className={cn(
                                  "h-4 w-4",
                                  field.value === name
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Preview:</span>
                <SelectedIconComponent className="h-4 w-4" />
                <span className="font-medium text-foreground">{form.watch('name') || 'Label'}</span>
              </div>
              <DrawerFooter className="px-0 pt-2">
                <Button
                  type="submit"
                  disabled={isProcessing}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" disabled={isProcessing}>Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default LabelDrawer;
