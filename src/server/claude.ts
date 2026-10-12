import Anthropic from "@anthropic-ai/sdk";
import { betaStandardSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/standard-schema";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  ParsedReceipt,
  RecipeSuggestions,
  type PantrySnapshotItem,
  type ReceiptRequest,
  type Recipe,
} from "../lib/types";

const MODEL = "claude-opus-5-5";

/** Claude declined the request (stop_reason "refusal") even after fallback. */
export class ClaudeRefused extends Data.TaggedError("ClaudeRefused")<{ message: string }> {}

/** The response could not be parsed into the expected shape. */
export class ClaudeUnparseable extends Data.TaggedError("ClaudeUnparseable")<{ message: string }> {}

/** Network, auth, rate-limit or server errors from the API. */
export class ClaudeUnavailable extends Data.TaggedError("ClaudeUnavailable")<{ cause: unknown }> {}

export type ClaudeError = ClaudeRefused | ClaudeUnparseable | ClaudeUnavailable;

const outputFormat = <S extends Schema.Top & Schema.Decoder<unknown>>(schema: S) =>
  betaStandardSchemaOutputFormat(Schema.toStandardSchemaV1(Schema.toStandardJSONSchemaV1(schema)));

export class Claude extends Context.Service<
  Claude,
  {
    readonly parseReceipt: (request: ReceiptRequest) => Effect.Effect<ParsedReceipt, ClaudeError>;
    readonly suggestRecipes: (
      pantry: ReadonlyArray<PantrySnapshotItem>,
      preferences: string,
    ) => Effect.Effect<ReadonlyArray<Recipe>, ClaudeError>;
  }
>()("whisker/Claude") {
  static readonly layer = Layer.sync(Claude, (): Claude["Service"] => {
    // Server-only: reads ANTHROPIC_API_KEY from the server environment.
    const client = new Anthropic({ timeout: 120_000 });

    const parse = <T>(
      params: Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "model" | "max_tokens" | "output_config"> & {
        effort: "low" | "medium";
        format: ReturnType<typeof outputFormat<any>>;
        unparseable: string;
      },
    ) =>
      Effect.tryPromise({
        try: (signal) =>
          client.beta.messages.parse(
            {
              model: MODEL,
              max_tokens: 16000,
              // Refusals are retried on Anthropic's recommended fallback model.
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
              system: params.system,
              messages: params.messages,
              output_config: { effort: params.effort, format: params.format },
            },
            { signal },
          ),
        catch: (cause) => new ClaudeUnavailable({ cause }),
      }).pipe(
        Effect.flatMap((response): Effect.Effect<T, ClaudeRefused | ClaudeUnparseable> => {
          if (response.stop_reason === "refusal") {
            return Effect.fail(new ClaudeRefused({ message: "This request could not be processed." }));
          }
          if (response.parsed_output == null) {
            return Effect.fail(new ClaudeUnparseable({ message: params.unparseable }));
          }
          return Effect.succeed(response.parsed_output as T);
        }),
      );

    return {
      parseReceipt: (request) =>
        parse<ParsedReceipt>({
          effort: "low",
          format: outputFormat(ParsedReceipt),
          unparseable: "Could not read items from this receipt.",
          system:
            "You read grocery receipts for a pantry-tracking app. Extract every purchased product line. " +
            "Skip subtotals, taxes, discounts, payment and loyalty lines. Decode store abbreviations into plain generic names. " +
            "If a line has a multiplier (e.g. '2 @ 1.99'), set quantity accordingly; weighed items use the printed weight and unit. " +
            "If the image is not a receipt, return an empty items list.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: request.mediaType, data: request.image },
                },
                {
                  type: "text",
                  text:
                    request.existingNames.length > 0
                      ? `Items already in the pantry (reuse these exact names for matching products):\n${request.existingNames.join("\n")}`
                      : "The pantry is currently empty.",
                },
              ],
            },
          ],
        }).pipe(Effect.withSpan("Claude.parseReceipt")),

      suggestRecipes: (pantry, preferences) => {
        const list = pantry
          .map((p) => `- ${p.name}: ${p.quantity} ${p.unit}${p.low ? " (running low)" : ""}`)
          .join("\n");
        return parse<typeof RecipeSuggestions.Type>({
          effort: "medium",
          format: outputFormat(RecipeSuggestions),
          unparseable: "Could not generate recipes. Try again.",
          system:
            "You are a home-cooking assistant. Suggest 5 recipes that make the most of what is in the user's pantry. " +
            "Favor recipes that need few or no missing ingredients; assume salt, pepper, oil and water are always available. " +
            "Prefer using perishables (produce, dairy, meat, seafood) before they spoil. Keep steps concise.",
          messages: [
            {
              role: "user",
              content: `My pantry:\n${list || "(empty)"}${preferences ? `\n\nPreferences: ${preferences}` : ""}`,
            },
          ],
        }).pipe(
          Effect.map(({ recipes }) => recipes),
          Effect.withSpan("Claude.suggestRecipes"),
        );
      },
    };
  });
}
