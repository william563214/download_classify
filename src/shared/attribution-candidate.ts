import type { AttributionMethod, AttributionConfidence } from "./types";

export interface AttributionCandidate {
  id: string;
  site: string;
  page_url: string;
  page_title: string;
  method: AttributionMethod;
  confidence: AttributionConfidence;
  label: string;
}
