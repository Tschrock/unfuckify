import type { Rule, SourceCode, AST } from 'eslint';
import type { Node } from 'estree';

export function getTokenBetween(source: SourceCode, left: Node, right: Node, filter: (token: AST.Token) => boolean) {
    const token = source.getTokensBetween(left, right, { filter });
    return token.length === 1 && token[0];
}

export function findPairs(source: SourceCode, node: Node, ...pairs: [string, string][]) {
    const rtn: [AST.Token, AST.Token][] = [];
    let left = source.getTokenBefore(node);
    let right = source.getTokenAfter(node);
    while (left && right && pairs.some(([l, r]) => left?.value === l && right?.value === r)) {
        rtn.push([left, right]);
        left = source.getTokenBefore(left);
        right = source.getTokenAfter(right);
    }
    return rtn;
}

export function removePairs(fixer: Rule.RuleFixer, source: SourceCode, node: Node, ...pairs: [string, string][]) {
    const replacements = [];
    let left = source.getTokenBefore(node);
    let right = source.getTokenAfter(node);
    while (left && right && pairs.some(([l, r]) => left?.value === l && right?.value === r)) {
        replacements.push(fixer.remove(left), fixer.remove(right))
        left = source.getTokenBefore(left);
        right = source.getTokenAfter(right);
    }
    return replacements;
}
