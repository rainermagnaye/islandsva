import { Suspense } from "react";
import { HeaderSearch } from "../../_components/header-search";

/** Header search everywhere except the VA section, which has its own empty slot. */
export default function HeaderSearchSlot() {
  return (
    <Suspense fallback={null}>
      <HeaderSearch />
    </Suspense>
  );
}
