
"use client";
import React from 'react';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Calendar as CalendarIcon, Plus, X } from 'lucide-react';
import type { Company, Governorate, ShipmentStatusConfig, User } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { ar } from 'date-fns/locale';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface ShipmentFiltersProps {
  governorates: Governorate[];
  companies: Company[];
  courierUsers: User[];
  statuses: ShipmentStatusConfig[];
  onFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}

export function ShipmentFilters({
  governorates = [],
  companies = [],
  courierUsers = [],
  statuses = [],
  onFiltersChange,
}: ShipmentFiltersProps) {
  const [localFilters, setLocalFilters] = React.useState<ColumnFiltersState>([]);
  const [addressInput, setAddressInput] = React.useState('');

  // This effect synchronizes the local state with the parent state.
  React.useEffect(() => {
    onFiltersChange(localFilters);
  }, [localFilters, onFiltersChange]);

  const handleMultiSelectFilterChange = (id: string, optionId: string, checked: boolean) => {
    setLocalFilters(prev => {
      const currentFilter = prev.find(f => f.id === id);
      const currentValue = (currentFilter?.value as string[]) || [];
      const newValue = checked
        ? [...currentValue, optionId]
        : currentValue.filter(val => val !== optionId);
      
      const otherFilters = prev.filter(f => f.id !== id);
      if (newValue.length > 0) {
        return [...otherFilters, { id, value: newValue }];
      }
      return otherFilters;
    });
  };

  const handleDateRangeFilterChange = (range: DateRange | undefined) => {
     setLocalFilters(prev => {
        const otherFilters = prev.filter(f => f.id !== 'createdAt');
        if (range) {
            return [...otherFilters, { id: 'createdAt', value: range }];
        }
        return otherFilters;
    });
  };
  
  const handleAddressAdd = () => {
    if (!addressInput.trim()) return;
    const newTerm = addressInput.trim().toLowerCase();
    setLocalFilters(prev => {
        const addressFilter = prev.find(f => f.id === 'address');
        const currentTerms = (addressFilter?.value as string[]) || [];
        if (!currentTerms.includes(newTerm)) {
            const newTerms = [...currentTerms, newTerm];
            const otherFilters = prev.filter(f => f.id !== 'address');
            return [...otherFilters, { id: 'address', value: newTerms }];
        }
        return prev; // Term already exists
    });
    setAddressInput(''); // Clear input after adding
  };

  const handleAddressRemove = (termToRemove: string) => {
    setLocalFilters(prev => {
        const addressFilter = prev.find(f => f.id === 'address');
        if (!addressFilter) return prev;
        
        const newTerms = ((addressFilter.value as string[]) || []).filter(t => t !== termToRemove);
        const otherFilters = prev.filter(f => f.id !== 'address');
        
        if (newTerms.length > 0) {
            return [...otherFilters, { id: 'address', value: newTerms }];
        }
        return otherFilters; // Remove address filter if no terms are left
    });
  };

  const statusFilterValue = localFilters.find(f => f.id === 'status')?.value as string[] | undefined;
  const governorateFilterValue = localFilters.find(f => f.id === 'governorateId')?.value as string[] | undefined;
  const companyFilterValue = localFilters.find(f => f.id === 'companyId')?.value as string[] | undefined;
  const courierFilterValue = localFilters.find(f => f.id === 'assignedCourierId')?.value as string[] | undefined;
  const dateRangeFilterValue = localFilters.find(f => f.id === 'createdAt')?.value as DateRange | undefined;
  const addressFilterValues = localFilters.find(f => f.id === 'address')?.value as string[] || [];

  return (
    <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
                <Input
                    placeholder="فلترة حسب العنوان"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressAdd(); } }}
                    className="h-8 w-[200px]"
                />
                <Button variant="outline" size="sm" className="h-8" onClick={handleAddressAdd}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        <Popover>
            <PopoverTrigger asChild>
            <Button
                id="date"
                variant={"outline"}
                size="sm"
                className={cn(
                "w-[240px] justify-start text-right font-normal h-8",
                !dateRangeFilterValue && "text-muted-foreground"
                )}
            >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {dateRangeFilterValue?.from ? (
                dateRangeFilterValue.to ? (
                    <>
                    {format(dateRangeFilterValue.from, "LLL dd, y", {locale: ar})} -{' '}
                    {format(dateRangeFilterValue.to, "LLL dd, y", {locale: ar})}
                    </>
                ) : (
                    format(dateRangeFilterValue.from, "LLL dd, y")
                )
                ) : (
                <span>اختر التاريخ</span>
                )}
            </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
            <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRangeFilterValue?.from}
                selected={dateRangeFilterValue}
                onSelect={handleDateRangeFilterChange}
                numberOfMonths={2}
                locale={ar}
            />
            </PopoverContent>
        </Popover>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
                <span>
                الحالة
                {statusFilterValue && statusFilterValue.length > 0 && ` (${statusFilterValue.length})`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
            {statuses.filter(s => s.enabled).map((status) => (
                <DropdownMenuCheckboxItem
                key={status.id}
                checked={statusFilterValue?.includes(status.id)}
                onCheckedChange={(checked) => handleMultiSelectFilterChange("status", status.id, checked)}
                >
                {status.label}
                </DropdownMenuCheckboxItem>
            ))}
            </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
                <span>
                الشركة
                {companyFilterValue && companyFilterValue.length > 0 && ` (${companyFilterValue.length})`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
            {companies.map((company) => (
                <DropdownMenuCheckboxItem
                key={company.id}
                checked={companyFilterValue?.includes(company.id)}
                onCheckedChange={(checked) => handleMultiSelectFilterChange("companyId", company.id, checked)}
                >
                {company.name}
                </DropdownMenuCheckboxItem>
            ))}
            </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
                <span>
                المندوب
                {courierFilterValue && courierFilterValue.length > 0 && ` (${courierFilterValue.length})`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
            {courierUsers.map((courier) => (
                <DropdownMenuCheckboxItem
                key={courier.id}
                checked={courierFilterValue?.includes(courier.id)}
                onCheckedChange={(checked) => handleMultiSelectFilterChange("assignedCourierId", courier.id, checked)}
                >
                {courier.name}
                </DropdownMenuCheckboxItem>
            ))}
            </DropdownMenuContent>
        </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                        <span>
                            المحافظة
                            {governorateFilterValue && governorateFilterValue.length > 0 && ` (${governorateFilterValue.length})`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {governorates.map((governorate) => (
                        <DropdownMenuCheckboxItem
                        key={governorate.id}
                        checked={governorateFilterValue?.includes(governorate.id)}
                        onCheckedChange={(checked) => handleMultiSelectFilterChange("governorateId", governorate.id, checked)}
                        >
                        {governorate.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        {addressFilterValues.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-2">
                <span className="text-sm text-muted-foreground">فلاتر العنوان النشطة:</span>
                {addressFilterValues.map(term => (
                    <Badge key={term} variant="secondary" className="gap-1">
                        {term}
                        <button onClick={() => handleAddressRemove(term)} className="rounded-full hover:bg-muted-foreground/20">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
        )}
    </div>
  );
};
