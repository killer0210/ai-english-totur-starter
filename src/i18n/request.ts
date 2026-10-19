import { getRequestConfig } from "next-intl/server";

// Single-language UI (docs/trd.md §1): next-intl without locale routing.
export default getRequestConfig(async () => ({
  locale: "mn",
  messages: (await import("../../messages/mn.json")).default,
}));
