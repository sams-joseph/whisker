import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Schema from "effect/Schema";
import { Claude, type ClaudeError } from "./claude";

const runtime = ManagedRuntime.make(Claude.layer);

/**
 * Builds an API route handler: decodes the JSON body with `schema`, runs
 * `handle`, and maps typed failures to HTTP responses.
 */
export function jsonRoute<S extends Schema.Top & Schema.Decoder<unknown>, A>(
  schema: S,
  handle: (body: S["Type"]) => Effect.Effect<A, ClaudeError, Claude>,
) {
  const decode = Schema.decodeUnknownEffect(schema);
  return async (request: Request): Promise<Response> => {
    const exit = await runtime.runPromiseExit(
      Effect.tryPromise(() => request.json()).pipe(
        Effect.flatMap(decode),
        Effect.mapError(() => ({ _tag: "BadRequest" as const })),
        Effect.flatMap(handle),
      ),
    );
    if (Exit.isSuccess(exit)) return Response.json(exit.value);

    const error = Cause.findErrorOption(exit.cause);
    if (error._tag === "Some") {
      switch (error.value._tag) {
        case "BadRequest":
          return Response.json({ error: "Invalid request" }, { status: 400 });
        case "ClaudeRefused":
        case "ClaudeUnparseable":
          return Response.json({ error: error.value.message }, { status: 422 });
        case "ClaudeUnavailable":
          console.error(error.value.cause);
          break;
      }
    } else {
      console.error(Cause.pretty(exit.cause));
    }
    return Response.json({ error: "Something went wrong. Try again." }, { status: 502 });
  };
}
