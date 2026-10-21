"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: 2,
            networkMode: "offlineFirst",   // usa caché si se cae el internet del local
          },
          mutations: { networkMode: "offlineFirst", retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 16 } }}
      />
    </QueryClientProvider>
  );
}
