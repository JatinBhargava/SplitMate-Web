import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import { Search, X, CalendarIcon, SlidersHorizontal } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Member { id: string; name: string; }

interface FilterValues {
  search: string;
  category: string;
  memberId: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  sortBy: "date" | "amount" | "paid_by" | "description";
  sortOrder: "asc" | "desc";
}

interface ExpenseFiltersProps {
  members: Member[];
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
}

export type { FilterValues };

export function ExpenseFilters({ members, filters, onChange }: ExpenseFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<FilterValues>) => onChange({ ...filters, ...partial });
  const hasFilters = filters.search || filters.category || filters.memberId || filters.dateFrom || filters.dateTo;

  const clearAll = () => onChange({ search: "", category: "", memberId: "", dateFrom: undefined, dateTo: undefined, sortBy: "date", sortOrder: "desc" });

  return (
    <div className="space-y-2 mb-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Button variant={expanded ? "secondary" : "outline"} size="icon" onClick={() => setExpanded(!expanded)} title="Filters">
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearAll} title="Clear filters">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 animate-fade-in">
          <Select value={filters.category} onValueChange={(v) => update({ category: v === "all" ? "" : v })}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.memberId} onValueChange={(v) => update({ memberId: v === "all" ? "" : v })}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Paid by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.sortBy} onValueChange={(v) => update({ sortBy: v as FilterValues["sortBy"] })}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="paid_by">Paid by</SelectItem>
              <SelectItem value="description">Description</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("text-xs justify-start font-normal", !filters.dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="w-3 h-3 mr-1" />
                {filters.dateFrom ? format(filters.dateFrom, "dd MMM") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => update({ dateFrom: d })} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("text-xs justify-start font-normal", !filters.dateTo && "text-muted-foreground")}>
                <CalendarIcon className="w-3 h-3 mr-1" />
                {filters.dateTo ? format(filters.dateTo, "dd MMM") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => update({ dateTo: d })} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
      )}
      {expanded && (
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
          >
            Order: {filters.sortOrder === "asc" ? "Ascending" : "Descending"}
          </Button>
        </div>
      )}
    </div>
  );
}
