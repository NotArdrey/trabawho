import { Fragment } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";

type DataPaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label: string;
};

/** Button-based controls for client-side and server-side result pages. */
export function DataPagination({ page, pageCount, onPageChange, label }: DataPaginationProps) {
  if (pageCount <= 1) return null;
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const numberedPages = pageCount <= 5
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [...new Set([1, currentPage, pageCount])].sort((a, b) => a - b);

  return <Pagination aria-label={label}>
    <PaginationContent>
      <PaginationItem><Button type="button" variant="ghost" className="min-h-11 min-w-11 px-2 sm:px-3" aria-label="Previous" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Previous</span></Button></PaginationItem>
      {numberedPages.map((number, index) => <Fragment key={number}>
        {index > 0 && number - numberedPages[index - 1] > 1 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
        <PaginationItem><Button type="button" variant={number === currentPage ? "outline" : "ghost"} className="min-h-11 min-w-11 px-2" aria-label={`Page ${number}${number === currentPage ? ", current page" : ""}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => onPageChange(number)}>{number}</Button></PaginationItem>
      </Fragment>)}
      <PaginationItem><Button type="button" variant="ghost" className="min-h-11 min-w-11 px-2 sm:px-3" aria-label="Next" disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)}><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" aria-hidden="true" /></Button></PaginationItem>
    </PaginationContent>
    <span className="sr-only" role="status" aria-live="polite">Page {currentPage} of {pageCount}</span>
  </Pagination>;
}
