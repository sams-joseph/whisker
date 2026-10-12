import * as Schema from "effect/Schema";

export const CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "seafood",
  "bakery",
  "pantry",
  "spices",
  "frozen",
  "beverages",
  "snacks",
  "household",
  "other",
] as const;

export const Category = Schema.Literals(CATEGORIES);
export type Category = typeof Category.Type;

const described = <S extends Schema.Top>(schema: S, description: string) =>
  schema.annotate({ description });

export const ReceiptItem = Schema.Struct({
  raw_text: described(Schema.String, "The line exactly as printed on the receipt"),
  name: described(
    Schema.String,
    "Plain, generic pantry name, e.g. 'Milk, 2%' for 'GV 2% MLK GAL'. Reuse an existing pantry name when it is the same product.",
  ),
  category: Category,
  quantity: described(Schema.Finite, "Count or amount purchased in `unit`"),
  unit: described(Schema.String, "Short unit: 'ea', 'lb', 'oz', 'gal', 'dozen', 'pack', etc."),
  price: described(Schema.NullOr(Schema.Finite), "Line total in the receipt currency"),
});
export type ReceiptItem = typeof ReceiptItem.Type;

export const ParsedReceipt = Schema.Struct({
  store: Schema.NullOr(Schema.String),
  purchased_on: described(Schema.NullOr(Schema.String), "YYYY-MM-DD if printed"),
  total: Schema.NullOr(Schema.Finite),
  items: Schema.Array(ReceiptItem),
});
export type ParsedReceipt = typeof ParsedReceipt.Type;

export const Recipe = Schema.Struct({
  title: Schema.String,
  summary: described(Schema.String, "One sentence"),
  minutes: Schema.Finite,
  servings: Schema.Finite,
  uses: described(Schema.Array(Schema.String), "Pantry item names this recipe uses"),
  missing: described(
    Schema.Array(Schema.String),
    "Ingredients needed that are not in the pantry; keep short",
  ),
  ingredients: described(Schema.Array(Schema.String), "With amounts"),
  steps: Schema.Array(Schema.String),
});
export type Recipe = typeof Recipe.Type;

export const RecipeSuggestions = Schema.Struct({ recipes: Schema.Array(Recipe) });

export const PantrySnapshotItem = Schema.Struct({
  name: Schema.String,
  quantity: Schema.Finite,
  unit: Schema.String,
  low: Schema.Boolean,
});
export type PantrySnapshotItem = typeof PantrySnapshotItem.Type;

// Request bodies for the API routes, shared by client and server.
export const ReceiptRequest = Schema.Struct({
  image: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(8_000_000)),
  mediaType: Schema.Literals(["image/jpeg", "image/png", "image/webp"]),
  existingNames: Schema.Array(Schema.String).check(Schema.isMaxLength(1000)),
});
export type ReceiptRequest = typeof ReceiptRequest.Type;

export const RecipesRequest = Schema.Struct({
  pantry: Schema.Array(PantrySnapshotItem).check(Schema.isMaxLength(1000)),
  preferences: Schema.String.check(Schema.isMaxLength(500)),
});
export type RecipesRequest = typeof RecipesRequest.Type;
