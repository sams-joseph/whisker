import * as Effect from "effect/Effect";
import { Claude } from "@/server/claude";
import { jsonRoute } from "@/server/http";
import { ReceiptRequest } from "@/lib/types";

export const POST = jsonRoute(ReceiptRequest, (body) =>
  Effect.gen(function* () {
    const claude = yield* Claude;
    return yield* claude.parseReceipt(body);
  }),
);
