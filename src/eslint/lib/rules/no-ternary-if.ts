import type { Rule } from 'eslint'
import { removePairs, getTokenBetween, removeSpacingBefore, removeSpacingAfter } from '../../eslint-utils'

const rule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallows using a ternary expression as a shorthand if statement.',
            category: 'De-Minification',
            recommended: true,
        },
        fixable: 'code',
        messages: {
            ternaryIf: 'Ternary expression used as an if statement.',
        },
    },
    create(context) {
        return {
            ExpressionStatement(node) {
                const expression = node.expression
                if (expression.type === 'ConditionalExpression') {
                    context.report({
                        node,
                        messageId: 'ternaryIf',
                        fix(fixer) {
                            const source = context.getSourceCode()

                            const test = expression.test
                            const consequent = expression.consequent
                            const alternate = expression.alternate

                            const qToken = getTokenBetween(source, test, consequent, t => t.value === '?')
                            const cToken = getTokenBetween(source, consequent, alternate, t => t.value === ':')

                            if (qToken && cToken) {
                                return [
                                    ...removePairs(fixer, source, test, ['(', ')']),
                                    fixer.insertTextBefore(test, 'if ('),
                                    fixer.insertTextAfter(test, ') { '),
                                    ...removeSpacingBefore(fixer, source, qToken),
                                    fixer.remove(qToken),
                                    ...removeSpacingAfter(fixer, source, qToken),
                                    ...removeSpacingBefore(fixer, source, consequent),
                                    ...removePairs(fixer, source, consequent, ['(', ')'], ['{', '}']),
                                    ...removeSpacingAfter(fixer, source, consequent),
                                    ...removeSpacingBefore(fixer, source, cToken),
                                    fixer.replaceText(cToken, ' } else { '),
                                    ...removeSpacingAfter(fixer, source, cToken),
                                    ...removeSpacingBefore(fixer, source, alternate),
                                    ...removePairs(fixer, source, alternate, ['(', ')'], ['{', '}']),
                                    ...removeSpacingAfter(fixer, source, alternate),
                                    fixer.insertTextAfter(alternate, ' }'),
                                ]
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
