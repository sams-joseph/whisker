import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ParsedReceipt, RecipeSuggestions, type PantrySnapshotItem } from "./types";

/** A failed call to the Whisker API, with a message fit to show the user. */
export class ApiError extends Data.TaggedError("ApiError")<{ message: string }> {}

const ErrorBody = Schema.Struct({ error: Schema.String });

// Relative URLs resolve to the dev server in development and to the
// expo-router `origin` (the deployed API) in production builds.
const post = <S extends Schema.Top & Schema.Decoder<unknown>>(path: string, body: unknown, schema: S) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        }),
      catch: () => new ApiError({ message: "Couldn't reach Whisker. Check your connection." }),
    });
    const json = yield* Effect.tryPromise({
      try: () => response.json() as Promise<unknown>,
      catch: () => new ApiError({ message: `Request failed (${response.status})` }),
    });
    if (!response.ok) {
      const message = Schema.is(ErrorBody)(json) ? json.error : `Request failed (${response.status})`;
      return yield* new ApiError({ message });
    }
    return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
      Effect.mapError(() => new ApiError({ message: "Unexpected response from Whisker." })),
    );
  });

export const scanReceipt = (image: string, existingNames: ReadonlyArray<string>) =>
  post("/api/receipt", { image, mediaType: "image/jpeg", existingNames }, ParsedReceipt);

export const fetchRecipes = (pantry: ReadonlyArray<PantrySnapshotItem>, preferences: string) =>
  post("/api/recipes", { pantry, preferences }, RecipeSuggestions).pipe(Effect.map(({ recipes }) => recipes));
