"use client";
import { createContext, useContext } from "react";
import type { Brand } from "@/lib/brand";

const BrandContext = createContext<Brand | null>(null);

export function BrandProvider({
  brand,
  children,
}: {
  brand: Brand | null;
  children: React.ReactNode;
}) {
  return (
    <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);

/** Ô logo: ảnh nếu có, nếu không thì chữ cái đầu tên nhà xe. */
export function BrandMark({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl)
    return (
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="size-10 shrink-0 rounded-xl bg-surface object-contain"
      />
    );
  return (
    <span className="pn-brand" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
