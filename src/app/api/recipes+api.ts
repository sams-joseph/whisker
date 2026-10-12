import * as Effect from "effect/Effect";
import { Claude } from "@/server/claude";
import { jsonRoute } from "@/server/http";
import { RecipesRequest } from "@/lib/types";

export const POST = jsonRoute(RecipesRequest, (body) =>
  Effect.gen(function* () {
    const claude = yield* Claude;
    const recipes = yield* claude.suggestRecipes(body.pantry, body.preferences);
    return { recipes };
  }),
);
