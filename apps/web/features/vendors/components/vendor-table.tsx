"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import type { Vendor } from "@/types/vendor";

interface VendorTableProps {
  vendors: Vendor[];
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function VendorTable({ vendors, onEdit, onDelete }: VendorTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell className="font-medium text-foreground">{vendor.company_name}</TableCell>
              <TableCell className="text-foreground-secondary">
                {vendor.contact_name ?? "—"}
              </TableCell>
              <TableCell className="text-foreground-secondary">{vendor.email ?? "—"}</TableCell>
              <TableCell className="text-foreground-secondary">{vendor.phone ?? "—"}</TableCell>
              <TableCell className="text-muted">{formatDate(vendor.created_at)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${vendor.company_name}`}
                    onClick={() => onEdit(vendor)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Archive ${vendor.company_name}`}
                    onClick={() => onDelete(vendor)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
