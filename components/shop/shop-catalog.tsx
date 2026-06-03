import { ProductGrid } from "@/components/shop/product-grid";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Product } from "@/lib/woocommerce.d";

interface ShopCatalogProps {
  products: Product[];
  totalPages: number;
  currentPage: number;
  createPageUrl: (page: number) => string;
  columns?: 3 | 4;
}

export function ShopCatalog({
  products,
  totalPages,
  currentPage,
  createPageUrl,
  columns = 3,
}: ShopCatalogProps) {
  return (
    <div className="space-y-8">
      <ProductGrid products={products} columns={columns} />

      {totalPages > 1 && (
        <div className="flex justify-center items-center py-8">
          <Pagination>
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious
                    href={createPageUrl(currentPage - 1)}
                  />
                </PaginationItem>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((pageNum) => {
                  return (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    Math.abs(pageNum - currentPage) <= 1
                  );
                })
                .map((pageNum, index, array) => {
                  const showEllipsis =
                    index > 0 && pageNum - array[index - 1] > 1;
                  return (
                    <div key={pageNum} className="flex items-center">
                      {showEllipsis && <span className="px-2">...</span>}
                      <PaginationItem>
                        <PaginationLink
                          href={createPageUrl(pageNum)}
                          isActive={pageNum === currentPage}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  );
                })}

              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext href={createPageUrl(currentPage + 1)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
