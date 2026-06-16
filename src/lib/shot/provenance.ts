// Provenance (Section 10 / compliance). Every generated output gets a C2PA-style manifest that
// records it as AI-generated, with the model, app, and timestamp. This is stored alongside the
// output as a sidecar JSON. The visible "Created with AI" label is a separate, user-positionable
// toggle on the result screen.
//
// Note: this is a C2PA-SHAPED manifest, not a cryptographically signed C2PA claim. Hardening to a
// signed claim (c2pa-node + a signing certificate) is a drop-in upgrade that reuses this shape.

export interface ProvenanceManifest {
  "@context": string;
  claim_generator: string;
  format: string;
  assertions: Array<{ label: string; data: Record<string, unknown> }>;
  created_at: string;
}

export interface ProvenanceInput {
  jobId: string;
  modelSlug: string;
  need: string;
  category: string;
  subType: string;
  tier: string | null;
  outputFormat: string; // mime type
  createdAt?: string;
}

export function buildProvenanceManifest(input: ProvenanceInput): ProvenanceManifest {
  return {
    "@context": "https://c2pa.org/specifications",
    claim_generator: "Drape/1.0",
    format: input.outputFormat,
    created_at: input.createdAt ?? new Date().toISOString(),
    assertions: [
      {
        // The standard "trained algorithmic media" digital-source-type assertion.
        label: "c2pa.actions",
        data: {
          actions: [
            {
              action: "c2pa.created",
              digitalSourceType:
                "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
              softwareAgent: "Drape",
            },
          ],
        },
      },
      {
        label: "com.drape.generation",
        data: {
          jobId: input.jobId,
          need: input.need,
          model: input.modelSlug,
          category: input.category,
          subType: input.subType,
          tier: input.tier,
          aiGenerated: true,
        },
      },
    ],
  };
}
