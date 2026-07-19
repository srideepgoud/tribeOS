"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import type { Client } from "@/types/client";

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ClientTable({ clients, onEdit, onDelete }: ClientTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>GST</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium text-foreground">{client.company_name}</TableCell>
              <TableCell className="text-foreground-secondary">{client.email ?? "—"}</TableCell>
              <TableCell className="text-foreground-secondary">{client.phone ?? "—"}</TableCell>
              <TableCell className="text-foreground-secondary">
                {client.gst_number ?? "—"}
              </TableCell>
              <TableCell className="text-muted">{formatDate(client.created_at)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${client.company_name}`}
                    onClick={() => onEdit(client)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Archive ${client.company_name}`}
                    onClick={() => onDelete(client)}
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
