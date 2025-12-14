
"use client";
import React from 'react';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { Company, Governorate, ShipmentStatusConfig, User } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';

export const ShipmentFilters = ({
  governorates,
  companies,
  courierUsers,
  statuses,
  onFiltersChange
}: {
  governorates: Governorate[];
  companies: Company[];
  courierUsers: User[];
  statuses: ShipmentStatusConfig[];
  onFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}) => {
    const [localFilters, setLocalFilters] = React.useState<ColumnFiltersState>([]);

    const handleFilterChange = React.useCallback(() => {
        onFiltersChange(localFilters);
    }, [localFilters, onFiltersChange]);

    React.useEffect(() => {
        handleFilterChange();
    }, [handleFilterChange]);

    const governorateFilterValue = localFilters.find(f => f.id === 'governorateId')?.value as string[] | undefined;
    const companyFilterValue = localFilters.find(f => f.id === 'companyId')?.value as string[] | undefined;
    const courierFilterValue = localFilters.find(f => f.id === 'assignedCourierId')?.value as string[] | undefined;
    const statusFilterValue = localFilters.find(f => f.id === 'status')?.value as string[] | undefined;
    const assignmentFilterValue = localFilters.find(f => f.id === 'assignmentStatus')?.value as string | undefined;

    const setFilter = (id: string, value: any) => {
        setLocalFilters(prev => {
            const newFilters = prev.filter(f => f.id !== id);
            if (value !== undefined && (!Array.isArray(value) || value.length > 0)) {
                newFilters.push({ id, value });
            }
            return newFilters;
        });
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                        <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            الحالة
                            {statusFilterValue && statusFilterValue.length > 0 && ` (${statusFilterValue.length})`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {statuses.filter(s => s.enabled).map((status) => (
                        <DropdownMenuCheckboxItem
                            key={status.id}
                            checked={statusFilterValue?.includes(status.id)}
                            onCheckedChange={(checked) => {
                                const current = statusFilterValue || [];
                                const newFilter = checked
                                    ? [...current, status.id]
                                    : current.filter((id) => id !== status.id);
                                setFilter("status", newFilter.length ? newFilter : undefined);
                            }}
                        >
                            {status.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                        <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            المحافظة
                            {governorateFilterValue && governorateFilterValue.length > 0 && ` (${governorateFilterValue.length})`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {(governorates || []).map((governorate) => (
                    <DropdownMenuCheckboxItem
                        key={governorate.id}
                        checked={governorateFilterValue?.includes(governorate.id)}
                        onCheckedChange={(checked) => {
                            const current = governorateFilterValue || [];
                            const newFilter = checked
                                ? [...current, governorate.id]
                                : current.filter((id) => id !== governorate.id);
                            setFilter("governorateId", newFilter.length ? newFilter : undefined);
                        }}
                    >
                        {governorate.name}
                    </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                         <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            الشركة
                            {companyFilterValue && companyFilterValue.length > 0 && ` (${companyFilterValue.length})`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {(companies || []).map((company) => (
                    <DropdownMenuCheckboxItem
                        key={company.id}
                        checked={companyFilterValue?.includes(company.id)}
                        onCheckedChange={(checked) => {
                            const current = companyFilterValue || [];
                            const newFilter = checked
                                ? [...current, company.id]
                                : current.filter((id) => id !== company.id);
                            setFilter("companyId", newFilter.length ? newFilter : undefined);
                        }}
                    >
                        {company.name}
                    </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                         <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            المندوب
                            {courierFilterValue && courierFilterValue.length > 0 && ` (${courierFilterValue.length})`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {courierUsers.map((courier) => (
                    <DropdownMenuCheckboxItem
                        key={courier.id}
                        checked={courierFilterValue?.includes(courier.id)}
                        onCheckedChange={(checked) => {
                            const current = courierFilterValue || [];
                            const newFilter = checked
                                ? [...current, courier.id]
                                : current.filter((id) => id !== courier.id);
                            setFilter("assignedCourierId", newFilter.length ? newFilter : undefined);
                        }}
                    >
                        {courier.name}
                    </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                        <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            حالة التعيين
                            {assignmentFilterValue && `: ${assignmentFilterValue === 'assigned' ? 'معينة' : 'غير معينة'}`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="p-2">
                    <RadioGroup value={assignmentFilterValue} onValueChange={(value) => setFilter('assignmentStatus', value === 'all' ? undefined : value)}>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="all" id="assign-all" />
                            <Label htmlFor="assign-all">الكل</Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="assigned" id="assign-assigned" />
                            <Label htmlFor="assign-assigned">معينة لمندوب</Label>
                        </div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value="unassigned" id="assign-unassigned" />
                            <Label htmlFor="assign-unassigned">غير معينة</Label>
                        </div>
                    </RadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
