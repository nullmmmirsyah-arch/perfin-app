import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

const predefinedIcons = [
  '🛒', '☕', '🍕', '⛽', '💊', '🎬', '✈️', '📱', '👔', '🏠',
  '💡', '🏋️', '📚', '🎁', '💰', '🏥', '🚗', '🐾', '💇', '🎮',
];

type BrandIcon = {
  name: string;
  svg: string;
};

type MerchantIconPickerProps = {
  value: string;
  onSelect: (icon: string) => void;
  className?: string;
};

const MerchantIconPicker = ({ value, onSelect, className }: MerchantIconPickerProps) => {
  const [search, setSearch] = useState('');
  const [brandIcons, setBrandIcons] = useState<BrandIcon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setBrandIcons([]);
      return;
    }

    const fetchIcons = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://api.iconify.design/search?query=${encodeURIComponent(debouncedSearch)}&limit=20`
        );
        const data = await response.json();
        
        if (data.icons) {
          const icons: BrandIcon[] = data.icons.slice(0, 20).map((iconName: string) => ({
            name: iconName,
            svg: `https://api.iconify.design/${iconName.split(':')[0]}/${iconName.split(':')[1]}.svg`,
          }));
          setBrandIcons(icons);
        }
      } catch (error) {
        console.error('Failed to fetch brand icons:', error);
        setBrandIcons([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIcons();
  }, [debouncedSearch]);

  return (
    <Tabs defaultValue="emojis" className={cn("w-full", className)}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="emojis">Emojis</TabsTrigger>
        <TabsTrigger value="brands">Brand Icons</TabsTrigger>
      </TabsList>
      
      <TabsContent value="emojis" className="mt-2">
        <div className="grid grid-cols-5 gap-2">
          {predefinedIcons.map((icon) => (
            <button
              key={icon}
              type="button"
              className={cn(
                "p-2 rounded-md border-2 text-xl hover:bg-muted transition-colors",
                value === icon ? "border-primary bg-primary/10" : "border-transparent"
              )}
              onClick={() => onSelect(icon)}
            >
              {icon}
            </button>
          ))}
        </div>
      </TabsContent>
      
      <TabsContent value="brands" className="mt-2">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brands (e.g., Starbucks, Google)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : brandIcons.length > 0 ? (
          <div className="grid grid-cols-5 gap-2">
            {brandIcons.map((icon) => (
              <button
                key={icon.name}
                type="button"
                className={cn(
                  "p-2 rounded-md border-2 hover:bg-muted transition-colors flex items-center justify-center",
                  value === icon.svg ? "border-primary bg-primary/10" : "border-transparent"
                )}
                onClick={() => onSelect(icon.svg)}
                title={icon.name}
              >
                <img 
                  src={icon.svg} 
                  alt={icon.name}
                  className="w-6 h-6"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </button>
            ))}
          </div>
        ) : search.trim() ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No brand icons found
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Search for brand icons above
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default MerchantIconPicker;
export { predefinedIcons };
