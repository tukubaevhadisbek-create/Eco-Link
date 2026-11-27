"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/primitives";

export const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full rounded-2xl" />,
});
export const LocationPicker = dynamic(() => import("./location-picker"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full rounded-2xl" />,
});
export type { MapPoint } from "./map-view";
