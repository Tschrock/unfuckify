import type { Rule } from 'eslint'
import { removePairs } from '../../eslint-utils'

const rule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallows joining expression statements into a sequence.',
            category: 'De-Minification',
            recommended: true,
        },
        fixable: 'code',
    },
    create(context) {
        return {
            ExpressionStatement(node) {
                const expression = node.expression
                if (expression.type === 'SequenceExpression') {
                    context.report({
                        node,
                        message: 'Unused Sequence Expression.',
                        fix(fixer) {
                            const source = context.getSourceCode()
                            const expressions = expression.expressions
                            // Replace the comma tokens with semicolons
                            const replacements = expressions
                                .map((current, i) => {
                                    const next = expressions[i + 1]
                                    return next && source.getTokensBetween(current, next, {
                                        filter: t => t.value == ',',
                                    })
                                })
                                .filter(t => t && t.length == 1)
                                .map(t => fixer.replaceText(t[0], ';'))

                            replacements.push(
                                ...removePairs(fixer, source, expression, ['(', ')'], ['{', '}']),
                                // Wrap in block just in case
                                fixer.insertTextBefore(node, '{'),
                                fixer.insertTextAfter(node, '}'),
                            )

                            return replacements
                        },
                    })
                }
            },
        }
    },
}

export = rule;
