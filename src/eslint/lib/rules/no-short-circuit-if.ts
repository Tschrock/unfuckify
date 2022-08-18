import type { Rule } from 'eslint'
import { removePairs, getTokenBetween } from '../../eslint-utils'

const rule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallows using a short-circuit logical expression as a shorthand if statement.',
            category: 'De-Minification',
            recommended: true,
        },
        fixable: 'code',
        messages: {
            logicalIf: 'Logical expression used as an if statement.',
        },
    },
    create(context) {
        return {
            ExpressionStatement(node) {
                const expression = node.expression
                if (expression.type === 'LogicalExpression') {
                    context.report({
                        node,
                        messageId: 'logicalIf',
                        fix(fixer) {
                            const source = context.getSourceCode()
                            const left = expression.left
                            const right = expression.right
                            const op = expression.operator

                            const opToken = getTokenBetween(source, left, right, t => t.value === op)
                            if (opToken) {
                                if (op === '&&') {
                                    return [
                                        ...removePairs(fixer, source, left, ['(', ')']),
                                        fixer.insertTextBefore(left, 'if ('),
                                        fixer.insertTextAfter(left, ')'),
                                        fixer.replaceText(opToken, ''),
                                    ]
                                } else if (op === '||' || op === '??') {
                                    return [
                                        ...removePairs(fixer, source, left, ['(', ')']),
                                        fixer.insertTextBefore(left, 'if (!('),
                                        fixer.insertTextAfter(left, '))'),
                                        fixer.replaceText(opToken, ''),
                                    ]
                                }
                            }
                            return null
                        },
                    })
                }
            },
        }
    },
}

export = rule;
