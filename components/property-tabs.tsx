"use client";

import type { ReactNode } from "react";
import { Banknote, Home, Wrench, FolderClosed } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  loan: ReactNode;
  rent: ReactNode;
  renovation: ReactNode;
  files: ReactNode;
}

export function PropertyTabs({ loan, rent, renovation, files }: Props) {
  return (
    <Tabs defaultValue="rent">
      <TabsList className="mb-6">
        <TabsTrigger value="rent">
          <Home className="h-3.5 w-3.5" />
          Rent
        </TabsTrigger>
        <TabsTrigger value="renovation">
          <Wrench className="h-3.5 w-3.5" />
          Renovation
        </TabsTrigger>
        <TabsTrigger value="files">
          <FolderClosed className="h-3.5 w-3.5" />
          Files
        </TabsTrigger>
        <TabsTrigger value="loan">
          <Banknote className="h-3.5 w-3.5" />
          Loan
        </TabsTrigger>
      </TabsList>

      <TabsContent value="loan">{loan}</TabsContent>
      <TabsContent value="rent">{rent}</TabsContent>
      <TabsContent value="renovation">{renovation}</TabsContent>
      <TabsContent value="files">{files}</TabsContent>
    </Tabs>
  );
}
