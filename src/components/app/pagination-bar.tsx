import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PaginationBar({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-foreground-muted text-xs">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page - 1)}>Previous</Link>
          </Button>
        )}
        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page + 1)}>Next</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
