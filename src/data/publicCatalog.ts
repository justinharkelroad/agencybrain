import { fetchActivePromptsOnly, fetchActiveProcessVaultTypes as fetchProcessVaultTypes } from "@/lib/dataFetchers";

export async function fetchActivePrompts() {
  return await fetchActivePromptsOnly();
}

export async function fetchActiveProcessVaultTypes() {
  return await fetchProcessVaultTypes();
}