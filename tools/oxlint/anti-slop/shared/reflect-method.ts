import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

function resolveVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return null;
}

function isGlobalReflect(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	if (expression.type === "Identifier" && expression.name === "Reflect") {
		if (sourceCode.isGlobalReference(expression)) return true;
		const variable = resolveVariable(sourceCode, expression);
		return variable === null || variable.defs.length === 0;
	}
	if (!("property" in expression) || !("object" in expression) || !("computed" in expression)) {
		return false;
	}
	if (expression.object.type !== "Identifier" || expression.object.name !== "globalThis" ||
		!sourceCode.isGlobalReference(expression.object)) return false;
	return expression.computed
		? expression.property.type === "Literal" && expression.property.value === "Reflect"
		: expression.property.type === "Identifier" && expression.property.name === "Reflect";
}

/** Reports whether a call target names one method on the global Reflect object. */
export function isGlobalReflectMethodCall(
  sourceCode: SourceCode,
  callee: ESTree.Expression,
  methodName: string,
): boolean {
  if (!("property" in callee) || !("object" in callee) || !("computed" in callee)) return false;
  if (!isGlobalReflect(sourceCode, callee.object)) return false;
  const property = callee.property;
  return callee.computed
    ? property.type === "Literal" && property.value === methodName
    : property.type === "Identifier" && property.name === methodName;
}
