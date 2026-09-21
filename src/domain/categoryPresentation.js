const categoryIconTypes = Object.freeze({
  food: "food",
  grocery: "cart",
  bills: "bolt",
  travel: "travel",
  shopping: "shopping",
  medical: "medical",
  other: "other",
});

export const getExpenseCategoryKey = (category) => {
  const key = String(category || "")
    .trim()
    .toLowerCase();

  return Object.hasOwn(categoryIconTypes, key) ? key : "other";
};

export const getExpenseCategoryIconType = (category) =>
  categoryIconTypes[getExpenseCategoryKey(category)];
